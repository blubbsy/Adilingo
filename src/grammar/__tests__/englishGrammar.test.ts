import { describe, expect, it } from 'vitest';
import rawPathsEn from '../../data/learningPathsEn.json';
import { ENGLISH_GRAMMAR_POINTS, ENGLISH_LEARNING_PATHS, GRAMMAR_BY_ID, GRAMMAR_POINTS } from '../grammarData';
import { ENGLISH_GRAMMAR_WIKI } from '../../data/englishGrammarWiki';
import { loadLibrary, vocabForCurriculum } from '../../data/vocab';
import { buildDomainPaths, buildLevelPaths } from '../levelPaths';

describe('English grammar lessons', () => {
  it('loads every authored lesson with all exercises valid (none dropped by the loader)', () => {
    expect(ENGLISH_GRAMMAR_POINTS.length).toBeGreaterThanOrEqual(70);
    for (const p of ENGLISH_GRAMMAR_POINTS) {
      expect(p.track).toBe('english');
      expect(p.id).toMatch(/^e[1-6]-/);
      expect(p.hskLevel).toBe(Number(p.id[1]));
      expect(p.exercises.length, p.id).toBeGreaterThanOrEqual(8);
      expect(p.examples.length, p.id).toBeGreaterThanOrEqual(5);
      for (const e of p.examples) expect(e.pinyin).toBe('');
    }
  });

  it('keeps Chinese and English lesson ids apart', () => {
    expect(GRAMMAR_POINTS.every((p) => p.track === 'chinese')).toBe(true);
    expect(GRAMMAR_BY_ID.size).toBe(GRAMMAR_POINTS.length + ENGLISH_GRAMMAR_POINTS.length);
  });

  it('links lessons to existing wiki articles', () => {
    const wiki = new Set(ENGLISH_GRAMMAR_WIKI.map((a) => a.id));
    const linked = ENGLISH_GRAMMAR_POINTS.filter((p) => p.wikiId);
    expect(linked.length).toBeGreaterThan(10);
    for (const p of linked) expect(wiki.has(p.wikiId!), p.id).toBe(true);
  });

  it('keeps every step of the themed paths (passive/active, adverbs, tenses …)', () => {
    const expected = (rawPathsEn as { units: unknown[] }[]).reduce((n, p) => n + p.units.length, 0);
    const got = ENGLISH_LEARNING_PATHS.reduce((n, p) => n + p.units.length, 0);
    expect(got).toBe(expected);
    const voice = ENGLISH_LEARNING_PATHS.find((p) => p.id === 'en-voice');
    expect(voice?.units.length).toBeGreaterThanOrEqual(4);
  });
});

describe('generated paths', () => {
  it('builds CEFR syllabus paths that contain the English lessons of each level', async () => {
    const lib = await loadLibrary('english');
    const vocab = vocabForCurriculum(lib, 'cefr');
    const paths = buildLevelPaths(vocab, ENGLISH_GRAMMAR_POINTS, 'cefr');
    expect(paths).toHaveLength(6);
    const grammarSteps = paths.flatMap((p) => p.units.flatMap((u) => u.steps)).filter((s) => s.type === 'grammar');
    expect(grammarSteps.length).toBe(ENGLISH_GRAMMAR_POINTS.length);
  });

  it('builds topic-cluster paths for a specialty course: one per tier, every term exactly once', async () => {
    const lib = await loadLibrary('chinese:emotor');
    const vocab = vocabForCurriculum(lib, 'domain');
    const paths = buildDomainPaths(vocab);
    expect(paths.map((p) => p.id)).toEqual(['level-domain-1', 'level-domain-2', 'level-domain-3']);
    const ids = paths.flatMap((p) => p.units.flatMap((u) => u.steps.flatMap((s) => (s.type === 'vocab' ? s.wordIds : []))));
    expect(ids).toHaveLength(vocab.length);
    expect(new Set(ids).size).toBe(vocab.length);
    for (const p of paths) for (const u of p.units) expect(u.title.length).toBeGreaterThan(0);
  });
});
