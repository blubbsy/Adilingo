import { describe, it, expect } from 'vitest';
import { isUnitUnlocked, isUnitStudied, isStepStudied, type PathContext } from '../pathLogic';
import type { LearningPath, VocabStep } from '../types';
import type { UserState, VocabItem } from '../../types';

describe('Learning Path Adaptive Progression', () => {
  const dummyVocab: VocabItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: `w-${i + 1}`,
    hanzi: `字${i + 1}`,
    pinyin: `zi${i + 1}`,
    pinyinNumbered: `zi${i + 1}`,
    english: [`word ${i + 1}`],
    hskLevel: 1,
    levels: { hsk3_2026: 1 },
    frequency: i + 1,
    topics: ['Basics'],
  }));

  const vocabById = new Map(dummyVocab.map((v) => [v.id, v]));

  const path: LearningPath = {
    id: 'hsk1-syllabus',
    title: 'HSK 1 Syllabus',
    description: 'Level 1 vocabulary and grammar',
    icon: 'sprout',
    units: [
      {
        id: 'u1',
        title: 'Unit 1',
        goal: '10 words',
        steps: [
          {
            id: 'u1-vocab',
            type: 'vocab',
            title: 'Words 1–10',
            wordIds: dummyVocab.slice(0, 10).map((v) => v.id),
          } as VocabStep,
        ],
      },
      {
        id: 'u2',
        title: 'Unit 2',
        goal: '10 words',
        steps: [
          {
            id: 'u2-vocab',
            type: 'vocab',
            title: 'Words 11–20',
            wordIds: dummyVocab.slice(10, 20).map((v) => v.id),
          } as VocabStep,
        ],
      },
    ],
  };

  it('Unit 1 is always unlocked initially, while Unit 2 is locked before studying', () => {
    const ctx: PathContext = {
      vocabById,
      vocabProgress: {},
      grammar: { points: {}, paths: {}, version: 1 },
    };

    expect(isUnitUnlocked(path, 0, ctx)).toBe(true);
    expect(isUnitUnlocked(path, 1, ctx)).toBe(false);
  });

  it('Unit 2 automatically unlocks as soon as Unit 1 words have been practiced', () => {
    // User has practiced the 10 words of Unit 1 once (reps = 1)
    const vocabProgress: UserState['progress'] = {};
    for (let i = 0; i < 10; i++) {
      vocabProgress[`w-${i + 1}`] = {
        recognition: {
          due: new Date().toISOString(),
          stability: 2,
          difficulty: 3,
          elapsed_days: 0,
          scheduled_days: 2,
          reps: 1,
          lapses: 0,
          state: 1,
          history: [],
          failureCount: 0,
          consecutiveCorrect: 1,
          isLeech: false,
        },
      };
    }

    const ctx: PathContext = {
      vocabById,
      vocabProgress,
      grammar: { points: {}, paths: {}, version: 1 },
    };

    expect(isStepStudied(path.units[0].steps[0], ctx)).toBe(true);
    expect(isUnitStudied(path.units[0], ctx)).toBe(true);
    // Student can now advance to Unit 2 without being trapped on Unit 1!
    expect(isUnitUnlocked(path, 1, ctx)).toBe(true);
  });
});
