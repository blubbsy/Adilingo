import { describe, expect, it } from 'vitest';
import { RADICALS } from '../data/radicals';
import { COMPOUND_LIST } from '../data/compounds';
import { MARK_CASES, SANDHI_CASES, TONE_SETS } from '../data/tones';
import { SENTENCES, isAcceptedOrder } from '../data/sentences';
import { isValidSyllable, pinyinProblems, validSyllables } from '../pinyinRules';
import { ALL_MODULES, buildQuestions, markAt, seededRng, type ChoiceQuestion } from '../questions';
import { emptyFoundations, gateSummary, moduleStatus, recordRound, sanitizeFoundations } from '../progress';
import { markSyllable, numberedToMarked } from '../../utils/pinyinHelper';

describe('content data', () => {
  it('radicals have unique ids and three examples each', () => {
    expect(new Set(RADICALS.map((r) => r.id)).size).toBe(RADICALS.length);
    for (const r of RADICALS) expect(r.examples).toHaveLength(3);
  });
  it('compounds list the parts they are made of', () => {
    for (const c of COMPOUND_LIST) {
      expect(c.parts).toHaveLength(2);
      if (c.type === 'phonetic') expect(c.parts.some((p) => p.role === 'sound')).toBe(true);
    }
  });
  it('tone set pinyin carries the tone it claims', () => {
    for (const set of TONE_SETS) {
      for (const m of set.members) {
        expect(numberedToMarked(set.syllable + m.tone).replace('ü', 'ü')).toBe(m.pinyin.replace(/^./, (c) => c.toLowerCase()));
      }
    }
  });
  it('mark placement agrees with the pinyin helper', () => {
    for (const c of MARK_CASES) {
      const syl = c.numbered.slice(0, -1);
      const tone = Number(c.numbered.slice(-1));
      const marked = markSyllable(syl, tone);
      expect(marked, c.numbered).toBe(markAt(syl, syl.lastIndexOf(c.letter), tone));
    }
  });
  it('sandhi cases offer wrong readings that differ from the spoken one', () => {
    for (const c of SANDHI_CASES) {
      expect(c.wrong.length).toBeGreaterThan(0);
      expect(c.wrong).not.toContain(c.spoken);
    }
  });
  it('every sentence has a unique correct order and accepted alternatives of the right length', () => {
    for (const s of SENTENCES) {
      expect(isAcceptedOrder(s, s.tiles.map((_, i) => i))).toBe(true);
      for (const alt of s.alternatives ?? []) {
        expect(alt).toHaveLength(s.tiles.length);
        expect([...alt].sort()).toEqual(s.tiles.map((_, i) => i));
      }
    }
  });
});

describe('pinyin spelling rules', () => {
  it('knows the real syllables and none of the generated invalid ones', () => {
    expect(validSyllables().length).toBeGreaterThan(380);
    for (const s of ['hang', 'gao', 'ni', 'ju', 'nü', 'lüe', 'zhi', 'xiong']) expect(isValidSyllable(s), s).toBe(true);
    for (const p of pinyinProblems()) expect(isValidSyllable(p.syllable), p.syllable).toBe(false);
  });
  it('covers the g rules: g only starts a syllable or ends as -ng', () => {
    const rules = new Set(pinyinProblems().map((p) => p.rule));
    expect(rules.has('syl-g-end')).toBe(true);
    expect(rules.has('syl-gn')).toBe(true);
    expect(pinyinProblems().find((p) => p.syllable === 'hag')?.fix).toBe('hang');
  });
});

describe('question generators', () => {
  const vocab = Array.from({ length: 30 }, (_, i) => ({
    id: `v${i}`,
    hanzi: ['你', '我', '他', '好', '大', '小', '人', '水', '火', '木'][i % 10] + (i >= 10 ? ['们', '的', '是'][i % 3] : ''),
    pinyin: 'nǐ',
    pinyinNumbered: `ni${(i % 4) + 1}`,
    english: ['x'],
  })) as never[];

  it('every choice question has a correct answer inside its options and unique option texts', () => {
    for (const module of ALL_MODULES) {
      for (let seed = 1; seed <= 20; seed++) {
        const qs = buildQuestions(module, 10, { rng: seededRng(seed), vocab });
        expect(qs.length, module).toBeGreaterThan(0);
        const ids = new Set(qs.map((q) => q.id));
        expect(ids.size).toBe(qs.length);
        for (const q of qs) {
          if (q.kind !== 'choice') continue;
          const c: ChoiceQuestion = q;
          expect(c.correct, c.id).toBeGreaterThanOrEqual(0);
          expect(c.correct, c.id).toBeLessThan(c.options.length);
          expect(c.options.length, c.id).toBeGreaterThanOrEqual(2);
          expect(new Set(c.options.map((o) => o.text)).size, c.id).toBe(c.options.length);
        }
      }
    }
  });
  it('a radical-in-character question never offers a second correct radical', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of buildQuestions('radicals', 8, { rng: seededRng(seed) })) {
        if (q.kind !== 'choice' || q.variant !== 'char-rad') continue;
        const wrong = q.options.filter((_, i) => i !== q.correct);
        for (const w of wrong) expect(q.shown!.includes(w.text), `${q.shown} contains ${w.text}`).toBe(false);
      }
    }
  });
});

describe('gate and scheduling', () => {
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const day = 86_400_000;
  it('a new module becomes ok after a pass and due again after its interval', () => {
    let p = emptyFoundations();
    expect(moduleStatus(p.modules.tones, t0)).toBe('new');
    p = recordRound(p, 'tones', 9, 10, t0);
    expect(moduleStatus(p.modules.tones, t0 + day)).toBe('ok');
    expect(moduleStatus(p.modules.tones, t0 + 4 * day)).toBe('due');
    p = recordRound(p, 'tones', 10, 10, t0 + 4 * day);
    expect(p.modules.tones?.box).toBe(2);
    expect(moduleStatus(p.modules.tones, t0 + 10 * day)).toBe('ok');
    expect(moduleStatus(p.modules.tones, t0 + 12 * day)).toBe('due');
  });
  it('a bad round sends a passed module back a box, a middling one changes nothing', () => {
    let p = recordRound(emptyFoundations(), 'pinyin', 10, 10, t0);
    p = recordRound(p, 'pinyin', 10, 10, t0);
    expect(p.modules.pinyin?.box).toBe(2);
    expect(recordRound(p, 'pinyin', 7, 10, t0).modules.pinyin?.box).toBe(2);
    expect(recordRound(p, 'pinyin', 3, 10, t0).modules.pinyin?.box).toBe(1);
  });
  it('lists never-passed core modules as missing and re-checks as due', () => {
    let p = recordRound(emptyFoundations(), 'radicals', 10, 10, t0);
    const g = gateSummary(p, t0 + day);
    expect(g.missing).toEqual(['tones', 'pinyin', 'sentences']);
    p = recordRound(p, 'tones', 10, 10, t0);
    expect(gateSummary(p, t0 + 5 * day).due).toEqual(['radicals', 'tones']);
  });
  it('sanitises foreign data', () => {
    expect(sanitizeFoundations('x')).toEqual(emptyFoundations());
    const s = sanitizeFoundations({ modules: { tones: { box: 99, passes: -3, lastScore: 7, lastPassed: 'nope' }, evil: {} } });
    expect(s.modules.tones).toMatchObject({ box: 4, passes: 0, lastScore: 1 });
    expect(s.modules.tones?.lastPassed).toBeUndefined();
  });
});
