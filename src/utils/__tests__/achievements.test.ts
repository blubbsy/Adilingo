import { describe, expect, it } from 'vitest';
import { BADGES, badgesFor, newlyUnlocked, TIER_POINTS, CATEGORY_LABELS } from '../analytics';
import type { UserState, VocabItem } from '../../types';

function mockState(overrides: Partial<UserState> = {}): UserState {
  return {
    version: 1,
    settings: {
      speechRate: 1,
      colorTones: true,
      dailyCap: 50,
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
    ...overrides,
  };
}

const mockVocab: VocabItem[] = [
  { id: 'v1', hanzi: '你', pinyin: 'nǐ', pinyinNumbered: 'ni3', english: ['you'], hskLevel: 1, levels: {}, frequency: 1, topics: ['greetings'] },
  { id: 'v2', hanzi: '好', pinyin: 'hǎo', pinyinNumbered: 'hao3', english: ['good'], hskLevel: 1, levels: {}, frequency: 2, topics: ['greetings'] },
  { id: 'v3', hanzi: '谢谢', pinyin: 'xièxie', pinyinNumbered: 'xie4xie0', english: ['thank you'], hskLevel: 1, levels: {}, frequency: 3, topics: ['polite'] },
];

describe('Achievement Badge System', () => {
  it('contains over 80 badges across multiple tiers and categories', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(80);
    const categories = new Set(BADGES.map((b) => b.category));
    expect(categories.has('streaks')).toBe(true);
    expect(categories.has('reviews')).toBe(true);
    expect(categories.has('words')).toBe(true);
    expect(categories.has('memory')).toBe(true);
    expect(categories.has('tones')).toBe(true);
    expect(categories.has('grammar')).toBe(true);
    expect(categories.has('levels')).toBe(true);
    expect(categories.has('special')).toBe(true);
  });

  it('preserves all legacy badge IDs', () => {
    const legacyIds = [
      'first-steps',
      'streak-3',
      'streak-7',
      'streak-30',
      'reviews-100',
      'reviews-500',
      'listening-25',
      'tone-50',
      'tone-master',
      'words-100',
      'words-500',
      'words-1000',
      'words-2500',
      'words-5000',
      'words-10000',
      'hsk1-complete',
      'hsk2-complete',
      'hsk3-complete',
      'hsk4-complete',
      'hsk5-complete',
      'hsk6-complete',
      'hsk7-complete',
      'leech-slayer',
    ];
    const badgeIds = new Set(BADGES.map((b) => b.id));
    for (const legacyId of legacyIds) {
      expect(badgeIds.has(legacyId)).toBe(true);
    }
  });

  it('has valid progress callback and metric for every badge on initial state', () => {
    const state = mockState();
    for (const badge of BADGES) {
      expect(badge.id).toBeTruthy();
      expect(badge.title).toBeTruthy();
      expect(badge.description).toBeTruthy();
      expect(badge.emoji).toBeTruthy();
      expect(TIER_POINTS[badge.tier]).toBeGreaterThan(0);
      expect(CATEGORY_LABELS[badge.category]).toBeTruthy();

      const p = badge.progress(state, mockVocab);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);

      if (badge.metric) {
        expect(badge.metric.target).toBeGreaterThan(0);
        expect(badge.metric.unit).toBeTruthy();
        const current = badge.metric.current(state, mockVocab);
        expect(typeof current).toBe('number');
      }
    }
  });

  it('detects newly unlocked badges when conditions are met', () => {
    const state = mockState({
      stats: {
        ...mockState().stats,
        totalReviewed: 1,
        longestStreak: 3,
      },
      unlockedBadges: [],
    });
    const fresh = newlyUnlocked(state, mockVocab);
    const freshIds = fresh.map((b) => b.id);
    expect(freshIds).toContain('first-steps');
    expect(freshIds).toContain('streak-3');
  });

  it('correctly filters badgesFor curriculum levels while retaining unlocked badges', () => {
    // Vocab only has level 1
    const state = mockState({
      unlockedBadges: ['hsk5-complete'],
    });
    const badges = badgesFor(state, mockVocab);
    const badgeIds = new Set(badges.map((b) => b.id));
    expect(badgeIds.has('hsk1-complete')).toBe(true);
    expect(badgeIds.has('hsk5-complete')).toBe(true); // unlocked keeps it visible
    expect(badgeIds.has('hsk6-complete')).toBe(false); // locked and level 6 not in vocab
  });
});
