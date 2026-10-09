import type { HskLevel, VocabItem } from '../types';
import generated from './generated/enWords.json';

/** Row compiled from `content/topics/en` by `npm run build:content`: id, word, IPA, Chinese glosses, CEFR level, topic, example, example translation. */
type Row = [string, string, string, string[], number, string, string, string];

const fromRows = (rows: Row[]): VocabItem[] =>
  rows.map(([id, word, ipa, zh, level, topic, example, exampleZh], i) => ({
    id,
    hanzi: word,
    pinyin: ipa,
    pinyinNumbered: '',
    english: zh,
    hskLevel: level as HskLevel,
    levels: { cefr: level as HskLevel, cet: level as HskLevel },
    frequency: i + 1,
    topics: [topic],
    exampleSentence: { hanzi: example, pinyin: ipa, english: exampleZh },
  }));

/** The topic word lists in `content/topics/en` (ids are `en-<word>`, stable across rebuilds so progress survives). */
export const ENGLISH_VOCABULARY: VocabItem[] = fromRows(generated as unknown as Row[]);
