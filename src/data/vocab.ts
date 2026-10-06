import type { Curriculum, HskLevel, VocabItem } from '../types';

/** Compact record produced by scripts/build-vocab.mjs. */
export interface WordRecord {
  i: string;
  h: string;
  p: string;
  n: string;
  e: string[];
  l: Partial<Record<Curriculum, number>>;
  t: string[];
  m?: string;
  r?: string;
  q: number;
  c?: 1;
  x?: number;
}

export interface CurriculumInfo {
  id: Curriculum;
  name: string;
  short: string;
  description: string;
  levels: HskLevel[];
}

export const CURRICULA: CurriculumInfo[] = [
  {
    id: 'hsk3_2026',
    name: 'HSK 3.0 (2026 community draft)',
    short: 'HSK 3.0 · 2026',
    description: 'Community draft syllabus for HSK 3.0: levels 1–6 plus the advanced 7–9 band (~10,000 words).',
    levels: [1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: 'hsk3_2021',
    name: 'HSK 3.0 (2021 standard)',
    short: 'HSK 3.0 · 2021',
    description: 'The 2021 nine-level standard (~11,000 words).',
    levels: [1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: 'hsk2',
    name: 'HSK 2.0 (classic)',
    short: 'HSK 2.0',
    description: 'The classic six-level exam (~5,000 words).',
    levels: [1, 2, 3, 4, 5, 6],
  },
];

export function curriculumInfo(id: Curriculum): CurriculumInfo {
  return CURRICULA.find((c) => c.id === id) ?? CURRICULA[0];
}

export function levelLabel(level: number): string {
  return level === 7 ? 'HSK 7–9' : `HSK ${level}`;
}

export interface VocabLibrary {
  /** Every word in any standard, curriculum-independent order. */
  all: VocabItem[];
}

/** Loads the bundled word list lazily (separate chunks, cached by the browser / service worker). */
export async function loadLibrary(): Promise<VocabLibrary> {
  const [words, examples, measure] = await Promise.all([
    import('./hsk/words.json').then((m) => m.default as unknown as WordRecord[]),
    import('./hsk/examples.json').then((m) => m.default as unknown as [string, string, string, string][]),
    import('./hsk/measureWords.json').then((m) => m.default as unknown as Record<string, string>),
  ]);
  const all: VocabItem[] = words.map((w) => {
    const ex = w.x !== undefined ? examples[w.x] : undefined;
    return {
      id: w.i,
      hanzi: w.h,
      pinyin: w.p,
      pinyinNumbered: w.n,
      english: w.e,
      hskLevel: (w.l.hsk3_2026 ?? w.l.hsk3_2021 ?? w.l.hsk2 ?? 7) as HskLevel,
      levels: w.l as VocabItem['levels'],
      frequency: w.c ? 0 : w.q,
      topics: w.t,
      measureWord: w.m ? { hanzi: w.m, pinyin: measure[w.m] ?? '' } : undefined,
      radical: w.r,
      exampleSentence: ex ? { hanzi: ex[0], pinyin: ex[1], english: ex[2], source: ex[3] || undefined } : undefined,
    };
  });
  return { all };
}

/**
 * Words of one curriculum, with `hskLevel` set to that curriculum's level and ordered as a
 * syllabus: level → hand-curated starter words → corpus frequency.
 */
export function vocabForCurriculum(lib: VocabLibrary, curriculum: Curriculum): VocabItem[] {
  return lib.all
    .filter((v) => v.levels[curriculum] !== undefined)
    .map((v) => ({ ...v, hskLevel: v.levels[curriculum]! }))
    .sort((a, b) => a.hskLevel - b.hskLevel || Number(b.frequency === 0) - Number(a.frequency === 0) || a.frequency - b.frequency);
}
