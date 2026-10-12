import SYLLABLES from './data/syllables.json';

/** Interjections and fragments that exist in dictionaries but are not syllables a learner builds words from. */
const EXCLUDED = new Set(['m', 'n', 'ng', 'ê', 'hm', 'hng']);

const VALID = new Set<string>((SYLLABLES as string[]).filter((s) => !EXCLUDED.has(s)));

export const isValidSyllable = (s: string): boolean => VALID.has(s);

export const validSyllables = (): string[] => [...VALID];

export type PinyinRuleId =
  | 'syl-g-end'
  | 'syl-gn'
  | 'syl-ng-start'
  | 'syl-jqx'
  | 'syl-gkh-i'
  | 'syl-umlaut'
  | 'syl-labial-ong'
  | 'syl-initial-clash'
  | 'syl-end-letters';

export interface SyllableProblem {
  syllable: string;
  rule: PinyinRuleId;
  /** A valid syllable the learner probably meant. */
  fix?: string;
}

let cache: SyllableProblem[] | null = null;

/** Every invalid syllable the rules below can produce; each is verified to be absent from the valid set. */
export function pinyinProblems(): SyllableProblem[] {
  if (cache) return cache;
  const out: SyllableProblem[] = [];
  const seen = new Set<string>();
  const add = (syllable: string, rule: PinyinRuleId, fix?: string) => {
    if (VALID.has(syllable) || seen.has(syllable)) return;
    seen.add(syllable);
    out.push({ syllable, rule, fix });
  };

  // g only starts a syllable (gao, guo …) or closes it as part of -ng (hang, ting …)
  for (const s of VALID) {
    if (s.endsWith('ng') && s.length >= 4) {
      add(s.slice(0, -2) + 'g', 'syl-g-end', s);
      add(s.slice(0, -2) + 'gn', 'syl-gn', s);
    }
  }
  for (const f of ['a', 'an', 'ao', 'e', 'ei', 'i', 'u']) add('ng' + f, 'syl-ng-start');

  for (const i of ['j', 'q', 'x']) {
    for (const f of ['a', 'o', 'e', 'ai', 'ei', 'ao', 'an', 'ang', 'eng', 'ong', 'uo']) add(i + f, 'syl-jqx');
  }
  for (const i of ['g', 'k', 'h']) {
    for (const f of ['i', 'in', 'ing', 'ia', 'ie', 'iu', 'iao', 'ü', 'üe']) add(i + f, 'syl-gkh-i');
  }
  for (const i of ['d', 't', 'g', 'k', 'h', 'z', 'c', 's', 'zh', 'ch', 'sh', 'b', 'p', 'm', 'f']) {
    for (const f of ['ü', 'üe']) add(i + f, 'syl-umlaut');
  }
  for (const i of ['b', 'p', 'm', 'f']) add(i + 'ong', 'syl-labial-ong');
  for (const i of ['zh', 'ch', 'sh', 'r', 'z', 'c', 's']) {
    for (const f of ['ia', 'ie', 'iao', 'iu']) add(i + f, 'syl-initial-clash');
  }
  for (const base of ['ba', 'da', 'ka', 'ma', 'ta', 'le', 'ge', 'bi', 'di', 'ti']) {
    for (const c of ['t', 'k', 'p', 'b', 'd', 'm', 's', 'l']) add(base + c, 'syl-end-letters', base);
  }
  cache = out;
  return out;
}

/** One example per rule, handy for a reference table. */
export function invalidSyllableExamples(): SyllableProblem[] {
  const byRule = new Map<PinyinRuleId, SyllableProblem>();
  for (const p of pinyinProblems()) if (!byRule.has(p.rule)) byRule.set(p.rule, p);
  return [...byRule.values()];
}

export const PINYIN_RULE_IDS: PinyinRuleId[] = ['syl-g-end', 'syl-gn', 'syl-ng-start', 'syl-jqx', 'syl-gkh-i', 'syl-umlaut', 'syl-labial-ong', 'syl-initial-clash', 'syl-end-letters'];
