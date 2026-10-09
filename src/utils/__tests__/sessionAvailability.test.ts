import { describe, expect, it } from 'vitest';
import { buildSession, dailyLogFor, queueSummary, recordReview } from '../srsEngine';
import { createDefaultState } from '../storage';
import { loadLibrary, vocabForCurriculum } from '../../data/vocab';
import { loadChinesePacks, buildTopicSessionRequest, packsForCourse, resolveTopicWords } from '../../data/topicPacks';
import type { CourseId, UserState, VocabItem } from '../../types';

const CJK = /[一-龥]/;

async function vocabFor(course: CourseId): Promise<VocabItem[]> {
  const lib = await loadLibrary(course as 'chinese' | 'english');
  return vocabForCurriculum(lib, course === 'english' ? 'cefr' : 'hsk3_2026');
}

function review(state: UserState, item: VocabItem, now = new Date()): UserState {
  return recordReview(state, { item, direction: 'recognition', grade: 3, correct: true, prompt: 'hanzi', latencyMs: 1000 }, now, {});
}

describe('daily limits are isolated per course', () => {
  it('finishing the day in Chinese does not use up the English limits', async () => {
    const zh = await vocabFor('chinese');
    const en = await vocabFor('english');
    let s = createDefaultState();
    s.settings.dailyCap = 30;
    s.settings.newCardsPerDay = 10;
    for (let i = 0; i < 30; i++) s = review(s, zh[i]);
    expect(queueSummary(zh, s).remainingToday).toBe(0);

    const english: UserState = { ...s, settings: { ...s.settings, course: 'english', curriculum: 'cefr' }, progress: {} };
    const summary = queueSummary(en, english);
    expect(summary.remainingToday).toBe(30);
    expect(summary.newAvailable).toBe(10);
    expect(dailyLogFor(english).reviewed).toBe(0);
    expect(buildSession(en, english, { label: 'daily', mode: 'mixed', levels: [], topics: [], limit: 10 }).length).toBe(10);
  });

  it('still uses the global log for states that predate per-course tracking', () => {
    const s = createDefaultState();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    s.stats.daily[key] = { reviewed: 7, correct: 7, newCards: 3 };
    expect(s.stats.dailyByCourse).toBeUndefined();
    expect(dailyLogFor(s, today).reviewed).toBe(7);
  });
});

describe('finished day never leaves the learner stuck', () => {
  for (const course of ['chinese', 'english'] as const) {
    it(`extra practice still yields cards after the daily cap (${course})`, async () => {
      const vocab = await vocabFor(course);
      let s = createDefaultState();
      s.settings.course = course;
      s.settings.dailyCap = 5;
      for (let i = 0; i < 5; i++) s = review(s, vocab[i]);
      expect(queueSummary(vocab, s).remainingToday).toBe(0);
      const extra = buildSession(vocab, s, { label: 'extra', mode: 'mixed', levels: [], topics: [], includeNotDue: true, ignoreCap: true, limit: 15 });
      expect(extra.length).toBeGreaterThan(0);
    });
  }
});

describe('topic training always starts a session', () => {
  it('every Chinese pack yields a session containing all of its words, including supplementary ones', async () => {
    const vocab = await vocabFor('chinese');
    const libraryIds = new Set(vocab.map((v) => v.id));
    let sawSupplementary = false;
    for (const pack of await loadChinesePacks()) {
      const words = resolveTopicWords(pack, vocab);
      expect(words.length, pack.id).toBeGreaterThan(0);
      const req = buildTopicSessionRequest(words, 'mixed', pack.title, words.length);
      // Even with the daily cap reached and a fresh learner
      const state = createDefaultState();
      const cards = buildSession(vocab, state, req);
      expect(new Set(cards.map((c) => c.item.id)).size, pack.id).toBe(words.length);
      if (words.some((w) => !libraryIds.has(w.id))) sawSupplementary = true;
    }
    expect(sawSupplementary).toBe(true);
  });

  it('the default session size is respected when no limit is given', async () => {
    const vocab = await vocabFor('chinese');
    const pack = (await loadChinesePacks())[0];
    const words = resolveTopicWords(pack, vocab);
    const cards = buildSession(vocab, createDefaultState(), buildTopicSessionRequest(words, 'mixed', pack.title));
    expect(cards.length).toBe(Math.min(words.length, createDefaultState().settings.sessionSize ?? 15));
  });
});

describe('English course topics stay English', () => {
  it('never show Chinese-script words and every pack can be studied', async () => {
    const vocab = await vocabFor('english');
    const packs = packsForCourse('english', vocab);
    expect(packs.length).toBeGreaterThan(0);
    for (const pack of packs) {
      const words = resolveTopicWords(pack, vocab);
      expect(words.length, pack.id).toBeGreaterThan(0);
      expect(words.some((w) => CJK.test(w.hanzi)), pack.id).toBe(false);
      const cards = buildSession(vocab, createDefaultState(), buildTopicSessionRequest(words, 'mixed', pack.title, words.length));
      expect(cards.length, pack.id).toBeGreaterThan(0);
    }
  });

  it('Chinese keeps the curated packs', async () => {
    const vocab = await vocabFor('chinese');
    const curated = await loadChinesePacks();
    expect(packsForCourse('chinese', vocab, curated)).toBe(curated);
    expect(packsForCourse(undefined, vocab, curated)).toBe(curated);
  });
});
