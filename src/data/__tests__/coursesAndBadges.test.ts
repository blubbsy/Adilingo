import { describe, expect, it } from 'vitest';
import { getCourseConfig, COURSES } from '../courses';
import { loadLibrary, levelLabel, vocabForCurriculum } from '../vocab';
import { BADGES } from '../../utils/analytics';
import { createDefaultState } from '../../utils/storage';

describe('Multi-course Framework & Level Mapping', () => {
  it('defines valid Chinese and English courses', () => {
    expect(COURSES.chinese).toBeDefined();
    expect(COURSES.english).toBeDefined();

    const enConfig = getCourseConfig('english');
    expect(enConfig.id).toBe('english');
    expect(enConfig.speechVoiceLang).toBe('en');
    expect(enConfig.levels.length).toBe(6);
    expect(enConfig.levels[0].code).toBe('A1');
  });

  it('renders correct level labels for both Chinese and English courses', () => {
    expect(levelLabel(1, 'chinese')).toBe('HSK 1');
    expect(levelLabel(7, 'chinese')).toBe('HSK 7–9');

    expect(levelLabel(1, 'english')).toBe('A1 · 基础');
    expect(levelLabel(4, 'english')).toBe('B2 · 四级');
    expect(levelLabel(6, 'english')).toBe('C2 · 考研');
  });

  it('loads English vocabulary with example sentences across levels', async () => {
    const lib = await loadLibrary('english');
    expect(lib.all.length).toBeGreaterThan(10);
    const vocab = vocabForCurriculum(lib, 'cefr');
    expect(vocab.length).toBeGreaterThan(10);

    const levels = new Set(vocab.map((v) => v.hskLevel));
    expect(levels.has(1)).toBe(true);
    expect(levels.has(4)).toBe(true);

    const withSentences = vocab.filter((v) => Boolean(v.exampleSentence));
    expect(withSentences.length).toBe(vocab.length);
  });
});

describe('Cloze and Multi-course Badges', () => {
  it('includes cloze achievements', () => {
    const clozeBadges = BADGES.filter((b) => b.id.startsWith('cloze-'));
    expect(clozeBadges.length).toBeGreaterThanOrEqual(4);
    expect(clozeBadges.some((b) => b.id === 'cloze-first')).toBe(true);
    expect(clozeBadges.some((b) => b.id === 'cloze-10')).toBe(true);
  });

  it('progresses cloze-first when cloze count increases', () => {
    const state = createDefaultState();
    const badge = BADGES.find((b) => b.id === 'cloze-first');
    expect(badge).toBeDefined();
    if (!badge) return;

    expect(badge.progress(state, [])).toBe(0);

    state.stats.modeCounts.cloze = 1;
    expect(badge.progress(state, [])).toBe(1);
  });

  it('detects bridge of tongues multi-course badge', () => {
    const state = createDefaultState();
    const polyglotBadge = BADGES.find((b) => b.id === 'course-polyglot');
    expect(polyglotBadge).toBeDefined();
    if (!polyglotBadge) return;

    expect(polyglotBadge.progress(state, [])).toBe(0);

    state.courseProgress = {
      chinese: { '1': { manuallyMarkedKnown: true } },
      english: { 'en-apple': { manuallyMarkedKnown: true } },
    };

    expect(polyglotBadge.progress(state, [])).toBe(1);
  });
});
