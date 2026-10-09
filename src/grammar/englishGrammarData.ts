import rawPathsEn from '../data/learningPathsEn.json';
import { HSK, isObj, isStr, isStrArr, optStr, parseExercise, parseGrammarData, parseLearningPaths, warn } from './grammarData';
import type { GrammarExample, GrammarExercise, GrammarPoint, LearningPath } from './types';

/*
 * English grammar lessons. This module is only imported dynamically (see `loadEnglishGrammar`), so the ~75 lessons
 * are a separate chunk that is fetched when the English course opens its learning screen.
 */

/**
 * English lesson (authored in content/README.md §5) -> the shared lesson shape: the English sentence goes to `hanzi`,
 * its Chinese translation to `english`; exercises keep their option lists.
 */
function parseEnglishPoint(v: unknown): GrammarPoint | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title) || !isStr(v.pattern)) return null;
  const level = HSK.find((l) => l === v.cefr);
  if (!level || level > 6) return null;
  const pointId = v.id;
  const examples: GrammarExample[] = [];
  (Array.isArray(v.examples) ? v.examples : []).forEach((e, i) => {
    if (isObj(e) && isStr(e.text) && isStr(e.translation)) examples.push({ hanzi: e.text, pinyin: '', english: e.translation, note: optStr(e.note) });
    else warn(`${pointId}: invalid example #${i}`);
  });
  const exercises: GrammarExercise[] = [];
  (Array.isArray(v.exercises) ? v.exercises : []).forEach((e, i) => {
    const id = `${pointId}-${i}`;
    // `translate` keeps the Chinese source in `english`; `choice` / `order` keep the Chinese translation there.
    const mapped = isObj(e) ? { ...e, english: e.source ?? e.translation, optionScript: 'hanzi' } : e;
    const parsed = parseExercise(mapped, id);
    if (parsed) exercises.push(parsed);
    else warn(`${pointId}: invalid exercise #${i}`);
  });
  return {
    id: pointId,
    track: 'english',
    hskLevel: level,
    wikiId: optStr(v.wikiId),
    title: v.title,
    titleHanzi: optStr(v.tag),
    pattern: v.pattern,
    summary: optStr(v.summary) ?? '',
    explanation: isStrArr(v.explanation) ? v.explanation : [],
    mistakes: isStrArr(v.mistakes) ? v.mistakes : [],
    examples,
    exercises,
  };
}

/** One JSON object per file under data/grammarEn/<a1…c2>/ (ordered by level, then file name). */
const englishFiles = import.meta.glob<unknown>('../data/grammarEn/*/*.json', { eager: true, import: 'default' });

export const ENGLISH_GRAMMAR_POINTS: GrammarPoint[] = parseGrammarData(
  Object.keys(englishFiles)
    .sort()
    .map((k) => englishFiles[k]),
  parseEnglishPoint,
).sort((a, b) => a.hskLevel - b.hskLevel);

export const ENGLISH_GRAMMAR_BY_ID: ReadonlyMap<string, GrammarPoint> = new Map(ENGLISH_GRAMMAR_POINTS.map((g) => [g.id, g]));
export const ENGLISH_LEARNING_PATHS: LearningPath[] = parseLearningPaths(rawPathsEn, new Set(ENGLISH_GRAMMAR_BY_ID.keys()));
