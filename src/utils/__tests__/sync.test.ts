import { describe, expect, it } from 'vitest';
import { generateSyncKey, deriveRoomId, encryptData, decryptData, normalizeSyncKey } from '../syncCrypto';
import { mergeUserStates, mergeGrammar } from '../syncMerge';
import type { UserState } from '../../types';

function createDummyState(overrides: Partial<UserState> = {}): UserState {
  return {
    version: 3,
    settings: {
      speechRate: 1,
      colorTones: true,
      dailyCap: 30,
      defaultMode: 'mixed',
      newCardsPerDay: 10,
      curriculum: 'hsk3_2026',
      theme: 'system',
      soundEffects: true,
    },
    progress: {},
    stats: {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      totalReviewed: 0,
      totalCorrect: 0,
      totalLatencyMs: 0,
      latencySamples: 0,
      toneAccuracy: {
        '1': { correct: 0, total: 0 },
        '2': { correct: 0, total: 0 },
        '3': { correct: 0, total: 0 },
        '4': { correct: 0, total: 0 },
        '0': { correct: 0, total: 0 },
      },
      toneConfusion: {
        '1': { '1': 0, '2': 0, '3': 0, '4': 0, '0': 0 },
        '2': { '1': 0, '2': 0, '3': 0, '4': 0, '0': 0 },
        '3': { '1': 0, '2': 0, '3': 0, '4': 0, '0': 0 },
        '4': { '1': 0, '2': 0, '3': 0, '4': 0, '0': 0 },
        '0': { '1': 0, '2': 0, '3': 0, '4': 0, '0': 0 },
      },
      modeCounts: {
        hanzi: 0,
        pinyin: 0,
        english: 0,
        audio: 0,
        tone: 0,
      },
      daily: {},
    },
    unlockedBadges: [],
    starredWords: [],
    knownLevels: [],
    ...overrides,
  };
}

describe('Sync Crypto & Merging', () => {
  it('generates well-formatted sync keys and normalizes them', () => {
    const key = generateSyncKey();
    expect(key).toMatch(/^AD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const normalized = normalizeSyncKey(key);
    expect(normalized).toHaveLength(14); // 'AD' + 12 chars
  });

  it('consistently derives identical SHA-256 room_id for the same key', async () => {
    const key = 'AD-8B4K-9M2P-4W1Q';
    const room1 = await deriveRoomId(key);
    const room2 = await deriveRoomId('ad-8b4k-9m2p-4w1q');
    expect(room1).toBe(room2);
    expect(room1).toHaveLength(64); // SHA-256 hex
  });

  it('encrypts and decrypts payloads correctly with zero data loss', async () => {
    const key = generateSyncKey();
    const payload = {
      user: 'Alice',
      reviews: 120,
      streak: 14,
      words: ['你好', '谢谢', '锅'],
    };

    const { ciphertext, iv } = await encryptData(key, payload);
    expect(ciphertext).toBeTruthy();
    expect(iv).toBeTruthy();

    const decrypted = await decryptData<typeof payload>(key, ciphertext, iv);
    expect(decrypted).toEqual(payload);
  });

  it('merges UserStates without losing progress or badges from either device', () => {
    const deviceA = createDummyState({
      unlockedBadges: ['badge-1', 'badge-2'],
      starredWords: ['w1'],
      stats: {
        ...createDummyState().stats,
        totalReviewed: 50,
        longestStreak: 5,
        daily: {
          '2026-10-01': { reviewed: 20, correct: 18, newCards: 5 },
        },
      },
      progress: {
        'w1': {
          manuallyMarkedKnown: true,
          recognition: {
            due: '2026-10-10',
            stability: 10,
            difficulty: 5,
            elapsed_days: 2,
            scheduled_days: 10,
            reps: 3,
            lapses: 0,
            state: 2,
            last_review: '2026-10-05T10:00:00Z',
            history: [{ date: '2026-10-05T10:00:00Z', grade: 3 }],
            failureCount: 0,
            consecutiveCorrect: 3,
            isLeech: false,
          },
        },
      },
    });

    const deviceB = createDummyState({
      unlockedBadges: ['badge-2', 'badge-3'],
      starredWords: ['w2'],
      stats: {
        ...createDummyState().stats,
        totalReviewed: 40,
        longestStreak: 7,
        daily: {
          '2026-10-02': { reviewed: 15, correct: 14, newCards: 3 },
        },
      },
      progress: {
        'w1': {
          manuallyMarkedKnown: false,
          recognition: {
            due: '2026-10-12',
            stability: 15,
            difficulty: 4.8,
            elapsed_days: 1,
            scheduled_days: 12,
            reps: 4,
            lapses: 0,
            state: 2,
            last_review: '2026-10-06T12:00:00Z', // Newer review!
            history: [{ date: '2026-10-06T12:00:00Z', grade: 4 }],
            failureCount: 0,
            consecutiveCorrect: 4,
            isLeech: false,
          },
        },
        'w2': {
          manuallyMarkedKnown: true,
        },
      },
    });

    const merged = mergeUserStates(deviceA, deviceB);

    // Badges & stars are unioned
    expect(merged.unlockedBadges.sort()).toEqual(['badge-1', 'badge-2', 'badge-3']);
    expect(merged.starredWords.sort()).toEqual(['w1', 'w2']);

    // Stats take max
    expect(merged.stats.longestStreak).toBe(7);
    expect(merged.stats.daily['2026-10-01']).toBeDefined();
    expect(merged.stats.daily['2026-10-02']).toBeDefined();

    // Word progress adopts newer review and combines history
    expect(merged.progress['w1'].recognition?.reps).toBe(4);
    expect(merged.progress['w1'].recognition?.last_review).toBe('2026-10-06T12:00:00Z');
    expect(merged.progress['w1'].recognition?.history.length).toBe(2);
    expect(merged.progress['w1'].manuallyMarkedKnown).toBe(true);
    expect(merged.progress['w2']).toBeDefined();
  });

  it('merges GrammarProgress correctly across devices', () => {
    const localGrammar = {
      version: 1,
      points: {
        'g1': { attempts: 5, correct: 4, completed: true, bestScore: 0.8 },
      },
      paths: {
        'p1': { completedSteps: ['s1', 's2'] },
      },
    };

    const remoteGrammar = {
      version: 1,
      points: {
        'g1': { attempts: 6, correct: 6, completed: true, bestScore: 1.0 },
        'g2': { attempts: 3, correct: 2, completed: false, bestScore: 0.66 },
      },
      paths: {
        'p1': { completedSteps: ['s2', 's3'] },
      },
    };

    const merged = mergeGrammar(localGrammar, remoteGrammar);
    expect(merged).toBeDefined();
    expect(merged?.points['g1'].bestScore).toBe(1.0);
    expect(merged?.points['g1'].attempts).toBe(6);
    expect(merged?.points['g2']).toBeDefined();
    expect(merged?.paths['p1'].completedSteps.sort()).toEqual(['s1', 's2', 's3']);
  });
});
