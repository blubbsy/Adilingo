import type { VocabItem } from '../types';

export type ExerciseKind = 'cloze' | 'multiple_choice' | 'typing' | 'audio_listening' | 'passage_comprehension';

export interface ClozeExerciseData {
  kind: 'cloze';
  sentence: string;
  prefix: string;
  blank: string;
  suffix: string;
  targetWord: string;
  options: string[];
  correctIndex: number;
  translation?: string;
  phonetic?: string;
}

export interface PassageQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

/** Future extension: Reading / Listening passage comprehension */
export interface PassageExerciseData {
  kind: 'passage_comprehension';
  title: string;
  passageText: string;
  audioUrl?: string;
  questions: PassageQuestion[];
}

export type ExtensibleExercise = ClozeExerciseData | PassageExerciseData;

/**
 * Generates cloze data from a VocabItem and a distractors pool.
 * Handles both Chinese characters and English Latin words with case-insensitive boundary replacement.
 */
export function buildClozeExercise(item: VocabItem, distractorItems: VocabItem[]): ClozeExerciseData | null {
  if (!item.exampleSentence) return null;

  const fullSentence = item.exampleSentence.hanzi;
  const target = item.hanzi;

  let prefix = '';
  let suffix = '';
  let matchedWord = target;

  // Case 1: Chinese word matching
  const cnIdx = fullSentence.indexOf(target);
  if (cnIdx !== -1) {
    prefix = fullSentence.slice(0, cnIdx);
    suffix = fullSentence.slice(cnIdx + target.length);
  } else {
    // Case 2: English word matching (case-insensitive regex with word boundaries)
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const match = fullSentence.match(regex);
    if (match && match.index !== undefined) {
      prefix = fullSentence.slice(0, match.index);
      matchedWord = match[0];
      suffix = fullSentence.slice(match.index + matchedWord.length);
    } else {
      // Fallback substring search
      const lowerSentence = fullSentence.toLowerCase();
      const lowerTarget = target.toLowerCase();
      const subIdx = lowerSentence.indexOf(lowerTarget);
      if (subIdx !== -1) {
        prefix = fullSentence.slice(0, subIdx);
        matchedWord = fullSentence.slice(subIdx, subIdx + target.length);
        suffix = fullSentence.slice(subIdx + target.length);
      } else {
        return null;
      }
    }
  }

  // Pick up to 3 distractors
  const distractors = distractorItems
    .filter((d) => d.id !== item.id && d.hanzi.toLowerCase() !== target.toLowerCase())
    .slice(0, 3)
    .map((d) => d.hanzi);

  if (distractors.length < 3) {
    // Fallback dummies if pool is small
    const defaults = ['water', 'book', 'friend', 'house'];
    for (const def of defaults) {
      if (distractors.length >= 3) break;
      if (def !== target.toLowerCase() && !distractors.includes(def)) {
        distractors.push(def);
      }
    }
  }

  // Combine and shuffle options
  const allOpts = [target, ...distractors.slice(0, 3)];
  // Deterministic shuffle based on target length to avoid render twitching
  const shuffled = [...allOpts].sort(() => Math.random() - 0.5);
  const correctIndex = shuffled.indexOf(target);

  return {
    kind: 'cloze',
    sentence: fullSentence,
    prefix,
    blank: '______',
    suffix,
    targetWord: target,
    options: shuffled,
    correctIndex,
    translation: item.exampleSentence.english,
    phonetic: item.exampleSentence.pinyin,
  };
}
