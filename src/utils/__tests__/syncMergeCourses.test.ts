import { describe, expect, it } from 'vitest';
import { mergeUserStates } from '../syncMerge';
import { createDefaultState } from '../storage';
import type { CardProgress, CourseId, UserState } from '../../types';

function card(reps: number, lastReview: string): CardProgress {
  return {
    recognition: {
      due: '2026-12-01',
      stability: 5,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 5,
      reps,
      lapses: 0,
      state: 2,
      last_review: lastReview,
      history: [{ date: lastReview, grade: 3 }],
      failureCount: 0,
      consecutiveCorrect: reps,
      isLeech: false,
    },
  };
}

/** A device whose flat fields belong to `active`, with optional snapshots of other courses. */
function device(active: CourseId, flat: Record<string, CardProgress>, others: Partial<Record<CourseId, Record<string, CardProgress>>> = {}): UserState {
  const s = createDefaultState();
  s.settings.course = active;
  s.progress = flat;
  s.courseProgress = { ...others, [active]: flat };
  return s;
}

/** Drops defaults that a merge may add (`false` flags, `undefined` directions) so states compare by meaning. */
function canon(map: UserState['courseProgress']): unknown {
  return JSON.parse(
    JSON.stringify(map, (key, value) => ((key === 'manuallyMarkedKnown' || key === 'curedLeech') && value === false ? undefined : value)),
  );
}

const FUTURE = 'chinese:future-domain' as CourseId;
const ids = (m: Record<string, CardProgress> | undefined) => Object.keys(m ?? {}).sort();

describe('mergeUserStates is course-aware', () => {
  it('keeps the local active course and never mixes flat progress across different active courses', () => {
    const phone = device('chinese', { zh1: card(3, '2026-10-01T10:00:00Z') });
    const laptop = device('english', { en1: card(2, '2026-10-02T10:00:00Z') });

    const merged = mergeUserStates(phone, laptop);

    expect(merged.settings.course).toBe('chinese');
    // The laptop's English card must not leak into the phone's active (Chinese) progress
    expect(ids(merged.progress)).toEqual(['zh1']);
    // ...but it is not lost: it lives in the English snapshot
    expect(ids(merged.courseProgress?.english)).toEqual(['en1']);
    expect(ids(merged.courseProgress?.chinese)).toEqual(['zh1']);
  });

  it('merges non-active course snapshots from both devices', () => {
    const a = device('chinese', { zh1: card(1, '2026-10-01T00:00:00Z') }, { english: { en1: card(1, '2026-10-01T00:00:00Z') } });
    const b = device('chinese', { zh1: card(2, '2026-10-02T00:00:00Z') }, { english: { en2: card(1, '2026-10-03T00:00:00Z') } });

    const merged = mergeUserStates(a, b);

    expect(ids(merged.courseProgress?.english)).toEqual(['en1', 'en2']);
    expect(merged.progress.zh1.recognition?.reps).toBe(2);
  });

  it('handles three courses and keeps ids it does not know about', () => {
    const a = device('chinese', { zh1: card(1, '2026-10-01T00:00:00Z') }, { [FUTURE]: { d1: card(1, '2026-10-01T00:00:00Z') } });
    const b = device('english', { en1: card(1, '2026-10-01T00:00:00Z') }, { [FUTURE]: { d2: card(1, '2026-10-01T00:00:00Z') } });

    const merged = mergeUserStates(a, b);

    expect(ids(merged.courseProgress?.[FUTURE])).toEqual(['d1', 'd2']);
    expect(ids(merged.courseProgress?.english)).toEqual(['en1']);
    expect(ids(merged.progress)).toEqual(['zh1']);
  });

  it('merges daily logs per course using the maximum for each day', () => {
    const a = device('chinese', {});
    a.stats.dailyByCourse = { chinese: { '2026-10-01': { reviewed: 10, correct: 8, newCards: 4 } } };
    const b = device('english', {});
    b.stats.dailyByCourse = {
      chinese: { '2026-10-01': { reviewed: 14, correct: 9, newCards: 2 } },
      english: { '2026-10-01': { reviewed: 5, correct: 5, newCards: 5 } },
    };

    const merged = mergeUserStates(a, b);

    expect(merged.stats.dailyByCourse?.chinese?.['2026-10-01']).toEqual({ reviewed: 14, correct: 9, newCards: 4 });
    expect(merged.stats.dailyByCourse?.english?.['2026-10-01']).toEqual({ reviewed: 5, correct: 5, newCards: 5 });
  });

  it('unions stars and known levels per course', () => {
    const a = device('chinese', {});
    a.starredWords = ['zh1'];
    a.knownLevels = [1];
    a.starredWordsByCourse = { english: ['en1'] };
    const b = device('english', {});
    b.starredWords = ['en2'];
    b.knownLevels = [2, 3];
    b.starredWordsByCourse = { chinese: ['zh2'] };

    const merged = mergeUserStates(a, b);

    expect(merged.starredWords.sort()).toEqual(['zh1', 'zh2']);
    expect(merged.knownLevels).toEqual([1]);
    expect(merged.starredWordsByCourse?.english?.sort()).toEqual(['en1', 'en2']);
    expect(merged.knownLevelsByCourse?.english).toEqual([2, 3]);
  });

  it('is idempotent and symmetric for per-course card data', () => {
    const a = device('chinese', { zh1: card(3, '2026-10-05T00:00:00Z') }, { english: { en1: card(1, '2026-10-01T00:00:00Z') } });
    const b = device('english', { en1: card(4, '2026-10-06T00:00:00Z'), en2: card(1, '2026-10-02T00:00:00Z') }, { chinese: { zh1: card(2, '2026-10-04T00:00:00Z') } });

    const ab = mergeUserStates(a, b);
    const ba = mergeUserStates(b, a);
    expect(canon(ab.courseProgress)).toEqual(canon(ba.courseProgress));

    const again = mergeUserStates(ab, b);
    expect(canon(again.courseProgress)).toEqual(canon(ab.courseProgress));
    expect(canon(mergeUserStates(ab, ab).courseProgress)).toEqual(canon(ab.courseProgress));
    expect(ab.courseProgress?.english?.en1.recognition?.reps).toBe(4);
  });

  it('keeps old single-course states working (no course data on either side)', () => {
    const a = createDefaultState();
    a.progress = { w1: card(1, '2026-10-01T00:00:00Z') };
    const b = createDefaultState();
    b.progress = { w2: card(1, '2026-10-02T00:00:00Z') };
    const merged = mergeUserStates(a, b);
    expect(ids(merged.progress)).toEqual(['w1', 'w2']);
    expect(merged.stats.dailyByCourse).toBeUndefined();
  });
});
