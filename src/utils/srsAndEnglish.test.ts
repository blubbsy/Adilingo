import { describe, it, expect } from 'vitest';
import { checkEnglish, stem, cleanEnglish, normEnglish, maxTypoTolerance } from './pinyinHelper';
import { buildSession, applyGrade, recordReview, newDirectionProgress, promptFor, promptForDirection, bulkMarkLevelKnown, calculateTrueRetention, queueSummary, isDirectionDue } from './srsEngine';
import { dayKey } from './dates';
import type { SessionRequest, UserState, VocabItem } from '../types';

describe('English stemmer and normalization', () => {
  it('does not stem protected words', () => {
    expect(stem('this')).toBe('this');
    expect(stem('speed')).toBe('speed');
    expect(stem('feed')).toBe('feed');
    expect(stem('bleed')).toBe('bleed');
    expect(stem('morning')).toBe('morning');
    expect(stem('evening')).toBe('evening');
    expect(stem('building')).toBe('building');
    expect(stem('status')).toBe('status');
    expect(stem('famous')).toBe('famous');
  });

  it('safely stems regular plurals, past tense, and gerunds', () => {
    expect(stem('eating')).toBe('eat');
    expect(stem('eats')).toBe('eat');
    expect(stem('walked')).toBe('walk');
    expect(stem('walks')).toBe('walk');
    expect(stem('cities')).toBe('city');
  });

  it('normalizes parentheticals and punctuation properly', () => {
    expect(cleanEnglish('(noun) this')).toBe('this');
    expect(cleanEnglish('apple (fruit)')).toBe('apple');
    expect(cleanEnglish('CL:個|个[gè]')).toBe('');
    expect(cleanEnglish('good-looking')).toBe('good looking');
    expect(normEnglish('(noun) this')).toBe('this');
  });

  it('verifies typo tolerance boundaries', () => {
    expect(maxTypoTolerance(4)).toBe(0);
    expect(maxTypoTolerance(5)).toBe(1);
    expect(maxTypoTolerance(8)).toBe(1);
    expect(maxTypoTolerance(9)).toBe(2);
    expect(maxTypoTolerance(15)).toBe(2);
  });
});

describe('checkEnglish matching', () => {
  const phoneCallItem: VocabItem = {
    id: 'da3dian4hua4',
    hanzi: '打电话',
    pinyin: 'dǎ diàn huà',
    pinyinNumbered: 'da3 dian4 hua4',
    english: ['to make a telephone call', 'to make a phone call'],
    hskLevel: 1,
    levels: { hsk3_2026: 1 },
    frequency: 100,
    topics: ['Communication'],
  };

  const examItem: VocabItem = {
    id: 'kao3shi4',
    hanzi: '考试',
    pinyin: 'kǎo shì',
    pinyinNumbered: 'kao3 shi4',
    english: ['to take an exam', 'exam', 'test'],
    hskLevel: 2,
    levels: { hsk3_2026: 2 },
    frequency: 200,
    topics: ['School'],
  };

  const makeItem: VocabItem = {
    id: 'zuo4',
    hanzi: '做',
    pinyin: 'zuò',
    pinyinNumbered: 'zuo4',
    english: ['to make', 'to do', 'to produce'],
    hskLevel: 1,
    levels: { hsk3_2026: 1 },
    frequency: 50,
    topics: ['General'],
  };

  const thisItem: VocabItem = {
    id: 'zhe4',
    hanzi: '这',
    pinyin: 'zhè',
    pinyinNumbered: 'zhe4',
    english: ['(pronoun) this', 'these', '(bound form) this'],
    hskLevel: 1,
    levels: { hsk3_2026: 1 },
    frequency: 10,
    topics: ['Pronouns'],
  };

  it('matches keyword/token-set subsets for phone call', () => {
    expect(checkEnglish('phone call', phoneCallItem).correct).toBe(true);
    expect(checkEnglish('call', phoneCallItem).correct).toBe(true);
    expect(checkEnglish('to call', phoneCallItem).correct).toBe(true);
    expect(checkEnglish('make a call', phoneCallItem).correct).toBe(true);
    expect(checkEnglish('telephone', phoneCallItem).correct).toBe(true);
    // Light verb alone should not match
    expect(checkEnglish('make', phoneCallItem).correct).toBe(false);
  });

  it('matches exam and test keywords', () => {
    expect(checkEnglish('exam', examItem).correct).toBe(true);
    expect(checkEnglish('test', examItem).correct).toBe(true);
    expect(checkEnglish('take an exam', examItem).correct).toBe(true);
    expect(checkEnglish('take', examItem).correct).toBe(false);
  });

  it('matches light verb when it is the core meaning of the word', () => {
    expect(checkEnglish('make', makeItem).correct).toBe(true);
    expect(checkEnglish('do', makeItem).correct).toBe(true);
  });

  it('matches "this" without false negative stemming', () => {
    expect(checkEnglish('this', thisItem).correct).toBe(true);
  });

  it('tolerates small typos based on word length', () => {
    // length >= 5 allows 1 typo
    expect(checkEnglish('aple', { ...makeItem, english: ['apple'] }).correct).toBe(true);
    // length >= 9 allows 2 typos
    expect(checkEnglish('telephne', phoneCallItem).correct).toBe(true);
    // length < 5 does not allow typos
    expect(checkEnglish('bok', { ...makeItem, english: ['book'] }).correct).toBe(false);
  });
});

describe('SRS Overdue Backlog Throttling & Grading', () => {
  const dummyVocab: VocabItem[] = [
    { id: '1', hanzi: '一', pinyin: 'yī', pinyinNumbered: 'yi1', english: ['one'], hskLevel: 1, levels: {}, frequency: 1, topics: [] },
    { id: '2', hanzi: '二', pinyin: 'èr', pinyinNumbered: 'er4', english: ['two'], hskLevel: 1, levels: {}, frequency: 2, topics: [] },
    { id: '3', hanzi: '三', pinyin: 'sān', pinyinNumbered: 'san1', english: ['three'], hskLevel: 1, levels: {}, frequency: 3, topics: [] },
    { id: '4', hanzi: '四', pinyin: 'sì', pinyinNumbered: 'si4', english: ['four'], hskLevel: 1, levels: {}, frequency: 4, topics: [] },
  ];

  const now = new Date('2026-10-06T12:00:00Z');
  const pastDate = new Date('2026-10-01T12:00:00Z').toISOString();

  it('throttles new cards to 0 when due backlog >= remainingToday', () => {
    const state: UserState = {
      version: 1,
      settings: {
        speechRate: 1,
        colorTones: true,
        dailyCap: 2,
        defaultMode: 'mixed',
        newCardsPerDay: 5,
        curriculum: 'hsk3_2026',
        theme: 'system',
        soundEffects: true,
      },
      progress: {
        '1': { recognition: { ...newDirectionProgress(now), due: pastDate } },
        '2': { recognition: { ...newDirectionProgress(now), due: pastDate } },
      },
      stats: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: '2026-10-05',
        totalReviewed: 0,
        toneAccuracy: { '0': { correct: 0, total: 0 }, '1': { correct: 0, total: 0 }, '2': { correct: 0, total: 0 }, '3': { correct: 0, total: 0 }, '4': { correct: 0, total: 0 } },
        totalCorrect: 0,
        totalLatencyMs: 0,
        latencySamples: 0,
        modeCounts: { hanzi: 0, pinyin: 0, english: 0, audio: 0, tone: 0, cloze: 0 },
        toneConfusion: { '0': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '1': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '2': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '3': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '4': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 } },
        daily: {},
      },
      starredWords: [],
      unlockedBadges: [],
    };

    const req: SessionRequest = {
      label: 'Test',
      mode: 'english',
      levels: [1],
      topics: [],
    };

    const session = buildSession(dummyVocab, state, req, now);
    // Since due.length (2) >= remainingToday (2), new cards should be 0!
    expect(session.length).toBe(2);
    expect(session.every((c) => !c.isNew)).toBe(true);
    // Dedicated english mode prompt
    expect(session[0].prompt).toBe('english');
  });

  it('records correct: true for grade >= 2 in applyGrade and recordReview', () => {
    const p = applyGrade(undefined, 2, { now, correct: false, mode: 'hanzi' });
    expect(p.history[p.history.length - 1].correct).toBe(true);

    const pAgain = applyGrade(undefined, 1, { now, correct: true, mode: 'hanzi' });
    expect(pAgain.history[pAgain.history.length - 1].correct).toBe(false);

    const baseState: UserState = {
      version: 1,
      settings: { speechRate: 1, colorTones: true, dailyCap: 50, defaultMode: 'mixed', newCardsPerDay: 5, curriculum: 'hsk3_2026', theme: 'system', soundEffects: true },
      progress: {},
      stats: {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: '',
        totalReviewed: 0,
        toneAccuracy: { '0': { correct: 0, total: 0 }, '1': { correct: 0, total: 0 }, '2': { correct: 0, total: 0 }, '3': { correct: 0, total: 0 }, '4': { correct: 0, total: 0 } },
        totalCorrect: 0,
        totalLatencyMs: 0,
        latencySamples: 0,
        modeCounts: { hanzi: 0, pinyin: 0, english: 0, audio: 0, tone: 0, cloze: 0 },
        toneConfusion: { '0': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '1': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '2': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '3': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, '4': { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 } },
        daily: {},
      },
      starredWords: [],
      unlockedBadges: [],
    };

    // Even if initial result was correct: false, grade 3 overrides it to correct: true
    const updated = recordReview(baseState, { item: dummyVocab[0], grade: 3, correct: false, prompt: 'hanzi', latencyMs: 1000 }, now);
    expect(updated.stats.totalCorrect).toBe(1);
    expect(updated.progress['1'].recognition?.history[0].correct).toBe(true);
  });

  it('handles dedicated english mode in promptFor', () => {
    expect(promptFor('english', 0, ['hanzi', 'pinyin', 'english'])).toBe('english');
  });

  it('calculates true retention only on mature cards (stability >= 21)', () => {
    const state: UserState = {
      version: 3,
      settings: { speechRate: 1, colorTones: true, dailyCap: 30, defaultMode: 'mixed', newCardsPerDay: 10, curriculum: 'hsk3_2026', theme: 'system', soundEffects: true },
      progress: {
        'young': {
          recognition: {
            ...newDirectionProgress(now),
            stability: 5,
            history: [{ date: now.toISOString(), grade: 3, correct: true, stability: 5 }],
          },
        },
        'mature1': {
          recognition: {
            ...newDirectionProgress(now),
            stability: 25,
            history: [{ date: now.toISOString(), grade: 3, correct: true, stability: 25 }],
          },
        },
        'mature2': {
          recognition: {
            ...newDirectionProgress(now),
            stability: 30,
            history: [{ date: now.toISOString(), grade: 1, correct: false, stability: 30 }],
          },
        },
      },
      stats: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: '',
        totalReviewed: 3,
        toneAccuracy: {} as any,
        totalCorrect: 2,
        totalLatencyMs: 0,
        latencySamples: 0,
        modeCounts: {} as any,
        toneConfusion: {} as any,
        daily: {},
      },
      unlockedBadges: [],
      starredWords: [],
    };

    const ret = calculateTrueRetention(state);
    expect(ret.matureTotal).toBe(2);
    expect(ret.matureCorrect).toBe(1);
    expect(ret.rate).toBe(50);
  });

  it('bulk marks level as known and unmarks correctly', () => {
    const state: UserState = {
      version: 3,
      settings: { speechRate: 1, colorTones: true, dailyCap: 30, defaultMode: 'mixed', newCardsPerDay: 10, curriculum: 'hsk3_2026', theme: 'system', soundEffects: true },
      progress: {},
      stats: {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: '',
        totalReviewed: 0,
        toneAccuracy: {} as any,
        totalCorrect: 0,
        totalLatencyMs: 0,
        latencySamples: 0,
        modeCounts: {} as any,
        toneConfusion: {} as any,
        daily: {},
      },
      unlockedBadges: [],
      starredWords: [],
    };

    const updated = bulkMarkLevelKnown(state, dummyVocab, 1, true);
    expect(updated.progress['1']?.manuallyMarkedKnown).toBe(true);
    expect(updated.progress['2']?.manuallyMarkedKnown).toBe(true);
    expect(updated.knownLevels).toContain(1);

    const reverted = bulkMarkLevelKnown(updated, dummyVocab, 1, false);
    expect(reverted.progress['1']).toBeUndefined();
    expect(reverted.knownLevels).not.toContain(1);
  });

  it('promptForDirection strictly avoids pinyin in English course even at high stability', () => {
    const englishItem: VocabItem = {
      id: 'en-apple',
      hanzi: 'apple',
      pinyin: '/ˈæpl/',
      pinyinNumbered: '',
      english: ['苹果'],
      hskLevel: 1,
      levels: { cefr: 1 },
      frequency: 1,
      topics: ['Food'],
      exampleSentence: {
        hanzi: 'She eats an apple.',
        pinyin: '',
        english: '她吃一个苹果。',
      },
    };

    // Chinese item at stability 10 returns pinyin
    const chineseItem: VocabItem = {
      id: 'zh-apple',
      hanzi: '苹果',
      pinyin: 'píng guǒ',
      pinyinNumbered: 'ping2 guo3',
      english: ['apple'],
      hskLevel: 1,
      levels: { hsk3_2026: 1 },
      frequency: 1,
      topics: ['Food'],
    };

    const prog10 = { ...newDirectionProgress(new Date()), stability: 10 };

    // In Chinese, stability 10 gives pinyin drill
    const zhPrompt = promptForDirection('recognition', prog10, undefined, chineseItem, 'chinese');
    expect(zhPrompt).toBe('pinyin');

    // In English, stability 10 gives audio drill (never pinyin)
    const enPrompt = promptForDirection('recognition', prog10, undefined, englishItem, 'english');
    expect(enPrompt).toBe('audio');
    expect(enPrompt).not.toBe('pinyin');

    // In English, low stability gives headword or cloze
    const prog1 = { ...newDirectionProgress(new Date()), stability: 1 };
    expect(promptForDirection('recognition', prog1, undefined, englishItem, 'english')).toBe('hanzi');

    const prog5 = { ...newDirectionProgress(new Date()), stability: 5 };
    expect(promptForDirection('recognition', prog5, undefined, englishItem, 'english')).toBe('cloze');
  });

  it('buildSession fills cards reliably when ignoreCap or includeNotDue is requested on fresh words', () => {
    const today = dayKey(new Date());
    // Simulate user who maxed out daily cards
    const state: UserState = {
      version: 3,
      settings: {
        speechRate: 1,
        colorTones: true,
        dailyCap: 20,
        defaultMode: 'mixed',
        newCardsPerDay: 5,
        curriculum: 'cefr',
        theme: 'system',
        soundEffects: true,
        course: 'english',
      },
      progress: {},
      stats: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        totalReviewed: 20,
        toneAccuracy: {} as any,
        totalCorrect: 20,
        totalLatencyMs: 0,
        latencySamples: 0,
        modeCounts: {} as any,
        toneConfusion: {} as any,
        daily: {
          [today]: { reviewed: 20, correct: 20, newCards: 5 },
        },
      },
      unlockedBadges: [],
      starredWords: [],
    };

    // Standard session without ignoreCap has 0 available due to daily cap
    const normalCards = buildSession(dummyVocab, state, {
      label: 'Standard',
      mode: 'mixed',
      levels: [],
      topics: [],
    });
    expect(normalCards.length).toBe(0);

    // Extra practice or level practice with ignoreCap / includeNotDue MUST return cards
    const extraCards = buildSession(dummyVocab, state, {
      label: 'Extra Practice',
      mode: 'mixed',
      levels: [],
      topics: [],
      ignoreCap: true,
      includeNotDue: true,
      limit: 2,
    });
    expect(extraCards.length).toBe(2);
    expect(extraCards[0].item.id).toBe('1');
    expect(extraCards[1].item.id).toBe('2');
  });

  it('queueSummary isolates daily limits between courses using dailyByCourse', () => {
    const today = dayKey(new Date());
    const state: UserState = {
      version: 3,
      settings: {
        speechRate: 1,
        colorTones: true,
        dailyCap: 20,
        defaultMode: 'mixed',
        newCardsPerDay: 5,
        curriculum: 'cefr',
        theme: 'system',
        soundEffects: true,
        course: 'english',
      },
      progress: {},
      stats: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        totalReviewed: 20,
        toneAccuracy: {} as any,
        totalCorrect: 20,
        totalLatencyMs: 0,
        latencySamples: 0,
        modeCounts: {} as any,
        toneConfusion: {} as any,
        daily: {
          [today]: { reviewed: 20, correct: 20, newCards: 5 },
        },
        dailyByCourse: {
          chinese: { [today]: { reviewed: 20, correct: 20, newCards: 5 } },
          english: { [today]: { reviewed: 0, correct: 0, newCards: 0 } },
        },
      },
      unlockedBadges: [],
      starredWords: [],
    };

    // In English course, today's quota is fresh because chinese reviews are isolated
    const summary = queueSummary(dummyVocab, state);
    expect(summary.newAvailable).toBe(4); // 4 dummy words unstarted <= newCardsPerDay (5)
    expect(summary.remainingToday).toBe(20);
  });

  it('applyGrade graduates new words to future days and prevents same-day re-review in isDirectionDue', () => {
    const now = new Date('2026-10-08T09:00:00Z');
    // First review with Good (grade 3)
    const progGood = applyGrade(undefined, 3, { now, correct: true, mode: 'hanzi' });
    expect(progGood.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(new Date(progGood.due).getTime()).toBeGreaterThan(now.getTime());

    // Because it was reviewed today, isDirectionDue MUST return false on the same day
    expect(isDirectionDue(progGood, now)).toBe(false);

    // Later on the same calendar day (e.g. 2 hours later), it should still NOT be due
    const laterToday = new Date('2026-10-08T11:00:00Z');
    expect(isDirectionDue(progGood, laterToday)).toBe(false);

    // On the scheduled due date in the future (e.g. 2 days later), it becomes due
    const futureDate = new Date('2026-10-10T09:00:00Z');
    expect(isDirectionDue(progGood, futureDate)).toBe(true);
  });
});
