import rawGrammar from '../data/grammarData.json';
import rawPaths from '../data/learningPaths.json';
import legacyIds from '../data/legacyIds.json';
import type { HskLevel } from '../types';
import type {
  GrammarExample,
  GrammarExercise,
  GrammarPoint,
  LearningPath,
  PathIcon,
  PathStep,
  PathUnit,
} from './types';

/*
 * Typed loaders for the grammar / learning-path JSON.
 * JSON imports widen literals (`type: string`), so instead of a blind cast every entry is
 * validated at runtime; malformed entries are dropped (and reported in dev) rather than crashing the UI.
 */

type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
export const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
export const optStr = (v: unknown): string | undefined => (isStr(v) ? v : undefined);
export const HSK: HskLevel[] = [1, 2, 3, 4, 5, 6, 7];
const ICONS: PathIcon[] = ['sprout', 'plane', 'bridge', 'music', 'mountain', 'crown'];

const problems: string[] = [];
export function warn(msg: string) {
  problems.push(msg);
}

function parseExample(v: unknown): GrammarExample | null {
  if (!isObj(v) || !isStr(v.hanzi) || !isStr(v.pinyin) || !isStr(v.english)) return null;
  return { hanzi: v.hanzi, pinyin: v.pinyin, english: v.english, note: optStr(v.note) };
}

function validOptions(v: Obj): v is Obj & { options: string[]; answer: number } {
  return (
    isStrArr(v.options) &&
    v.options.length >= 2 &&
    v.options.length <= 9 &&
    typeof v.answer === 'number' &&
    Number.isInteger(v.answer) &&
    v.answer >= 0 &&
    v.answer < v.options.length
  );
}

export function parseExercise(v: unknown, id: string): GrammarExercise | null {
  if (!isObj(v) || !isStr(v.prompt) || !isStr(v.explanation)) return null;
  const base = { id, prompt: v.prompt, explanation: v.explanation };
  switch (v.type) {
    case 'choice':
      if (!validOptions(v) || !isStr(v.sentence)) return null;
      return { ...base, type: 'choice', sentence: v.sentence, english: optStr(v.english), options: v.options, answer: v.answer };
    case 'translate':
      if (!validOptions(v) || !isStr(v.english)) return null;
      return {
        ...base,
        type: 'translate',
        english: v.english,
        optionScript: v.optionScript === 'pinyin' ? 'pinyin' : 'hanzi',
        options: v.options,
        answer: v.answer,
      };
    case 'error':
      if (!validOptions(v)) return null;
      return { ...base, type: 'error', options: v.options, answer: v.answer };
    case 'order': {
      if (!isStrArr(v.tokens) || v.tokens.length < 2 || v.tokens.length > 12 || !isStr(v.english)) return null;
      const key = [...v.tokens].sort().join('\u0000');
      const alternatives = Array.isArray(v.alternatives)
        ? v.alternatives.filter((a): a is string[] => isStrArr(a) && [...a].sort().join('\u0000') === key)
        : undefined;
      return { ...base, type: 'order', tokens: v.tokens, alternatives, english: v.english, pinyin: optStr(v.pinyin) };
    }
    default:
      return null;
  }
}

function parsePoint(v: unknown): GrammarPoint | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title) || !isStr(v.pattern)) return null;
  const hskLevel = HSK.find((l) => l === v.hskLevel);
  if (!hskLevel) return null;
  const pointId = v.id;
  const examples = (Array.isArray(v.examples) ? v.examples : []).map(parseExample);
  const exercises = (Array.isArray(v.exercises) ? v.exercises : []).map((e, i) => parseExercise(e, `${pointId}-${i}`));
  examples.forEach((e, i) => e === null && warn(`${pointId}: invalid example #${i}`));
  exercises.forEach((e, i) => e === null && warn(`${pointId}: invalid exercise #${i}`));
  return {
    id: pointId,
    track: 'chinese',
    hskLevel,
    title: v.title,
    titleHanzi: optStr(v.titleHanzi),
    pattern: v.pattern,
    summary: optStr(v.summary) ?? '',
    explanation: isStrArr(v.explanation) ? v.explanation : [],
    mistakes: isStrArr(v.mistakes) ? v.mistakes : [],
    examples: examples.filter((e): e is GrammarExample => e !== null),
    exercises: exercises.filter((e): e is GrammarExercise => e !== null),
  };
}

export function parseGrammarData(raw: unknown, parse: (v: unknown) => GrammarPoint | null = parsePoint): GrammarPoint[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GrammarPoint[] = [];
  raw.forEach((r, i) => {
    const p = parse(r);
    if (!p) return warn(`grammar point #${i} is invalid`);
    if (seen.has(p.id)) return warn(`duplicate grammar id ${p.id}`);
    seen.add(p.id);
    out.push(p);
  });
  return out;
}

function parseStep(v: unknown, grammarIds: Set<string>): PathStep | null {
  if (!isObj(v) || !isStr(v.id)) return null;
  if (v.type === 'vocab' && isStrArr(v.wordIds) && v.wordIds.length > 0) {
    // Paths were authored with the original starter-set ids; map them to full-list ids.
    const wordIds = v.wordIds.map((id) => (legacyIds as Record<string, string>)[id] ?? id);
    return { id: v.id, type: 'vocab', title: optStr(v.title) ?? 'Vocabulary', wordIds };
  }
  if (v.type === 'grammar' && isStr(v.grammarId) && grammarIds.has(v.grammarId)) {
    return { id: v.id, type: 'grammar', grammarId: v.grammarId };
  }
  return null;
}

export function parseLearningPaths(raw: unknown, grammarIds: Set<string>): LearningPath[] {
  if (!Array.isArray(raw)) return [];
  const out: LearningPath[] = [];
  for (const p of raw) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.title) || !Array.isArray(p.units)) {
      warn('invalid learning path');
      continue;
    }
    const units: PathUnit[] = [];
    for (const u of p.units) {
      if (!isObj(u) || !isStr(u.id) || !isStr(u.title) || !Array.isArray(u.steps)) {
        warn(`${p.id}: invalid unit`);
        continue;
      }
      const steps = u.steps.map((s) => parseStep(s, grammarIds));
      steps.forEach((s, i) => s === null && warn(`${p.id}/${u.id}: invalid step #${i}`));
      const valid = steps.filter((s): s is PathStep => s !== null);
      if (valid.length) units.push({ id: u.id, title: u.title, goal: optStr(u.goal) ?? '', steps: valid });
    }
    const icon = ICONS.find((i) => i === p.icon) ?? 'sprout';
    out.push({ id: p.id, title: p.title, description: optStr(p.description) ?? '', icon, units });
  }
  return out;
}

/** Per-level grammar files (src/data/grammar/hsk{n}.json) are merged with the original HSK 1–2 set. */
const levelFiles = import.meta.glob<unknown[]>('../data/grammar/*.json', { eager: true, import: 'default' });
const allRawGrammar: unknown[] = [
  ...(Array.isArray(rawGrammar) ? rawGrammar : []),
  ...Object.keys(levelFiles)
    .sort()
    .flatMap((k) => (Array.isArray(levelFiles[k]) ? levelFiles[k] : [])),
];

export const GRAMMAR_POINTS: GrammarPoint[] = parseGrammarData(allRawGrammar).sort((a, b) => a.hskLevel - b.hskLevel);

/** Chinese lessons by id. English lessons live in `englishGrammarData` (loaded on demand). */
export const GRAMMAR_BY_ID: ReadonlyMap<string, GrammarPoint> = new Map(GRAMMAR_POINTS.map((g) => [g.id, g]));
export const LEARNING_PATHS: LearningPath[] = parseLearningPaths(rawPaths, new Set(GRAMMAR_BY_ID.keys()));

if (import.meta.env.DEV && problems.length) {
  console.warn('[grammar] content problems:', problems);
}
