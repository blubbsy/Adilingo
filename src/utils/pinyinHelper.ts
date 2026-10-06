import type { ToneKey, VocabItem } from '../types';

const MARKS: Record<string, string> = {
  a: 'aāáǎà', e: 'eēéěè', i: 'iīíǐì', o: 'oōóǒò', u: 'uūúǔù', ü: 'üǖǘǚǜ',
  A: 'AĀÁǍÀ', E: 'EĒÉĚÈ', I: 'IĪÍǏÌ', O: 'OŌÓǑÒ', U: 'UŪÚǓÙ', Ü: 'ÜǕǗǙǛ',
};

const COMBINING_TONE: Record<string, ToneKey> = {
  '\u0304': '1',
  '\u0301': '2',
  '\u030C': '3',
  '\u0300': '4',
};

/** Normalises the ASCII stand-ins for ü (v, u:) to the real letter. */
export function normalizeUmlaut(s: string): string {
  return s.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü');
}

/**
 * Places a tone mark on a single toneless syllable following the standard rule:
 * a / e take the mark; in "ou" the o does; otherwise the last vowel.
 */
export function markSyllable(syllable: string, tone: number): string {
  const s = normalizeUmlaut(syllable);
  if (tone < 1 || tone > 4) return s;
  const lower = s.toLowerCase();
  let idx = lower.indexOf('a');
  if (idx < 0) idx = lower.indexOf('e');
  if (idx < 0 && lower.includes('ou')) idx = lower.indexOf('o');
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return s;
  const marks = MARKS[s[idx]];
  if (!marks) return s;
  return s.slice(0, idx) + marks[tone] + s.slice(idx + 1);
}

const MARKED_VOWELS = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ';
/** The final pinyin syllable of a run of letters (initial + vowels + optional n/ng/r coda). */
const LAST_SYLLABLE = /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[aeiouü]+(?:ng|n|r)?$/i;

/**
 * Converts numbered pinyin anywhere in a string to tone marks:
 * "zhong1wen2" → "zhōngwén", "lv4" → "lǜ", "nu:3" → "nǚ". 5 / 0 = neutral tone.
 * In an unspaced run only the LAST syllable takes the digit ("xiexie4" → "xiexiè").
 * Digits typed after an already-marked syllable are dropped ("nǐ3" → "nǐ"),
 * so it is safe to run on every keystroke.
 */
export function numberedToMarked(input: string): string {
  return input
    .replace(new RegExp(`([${MARKED_VOWELS}])[0-5]`, 'g'), '$1')
    .replace(/([a-zA-ZüÜ:]+)([0-5])/g, (match: string, run: string, digit: string, offset: number, whole: string) => {
      const norm = normalizeUmlaut(run);
      const prev = whole[offset - 1] ?? '';
      const continuesMarked = prev !== '' && MARKED_VOWELS.includes(prev);
      const m = norm.match(LAST_SYLLABLE);
      if (!m || m.index === undefined) return continuesMarked ? run : match;
      const prefix = norm.slice(0, m.index);
      // "hǎo" + "3": the run is the tail of a syllable that already carries a mark.
      if (continuesMarked && prefix === '' && /^[aeiouü]/i.test(m[0])) return run;
      return prefix + markSyllable(m[0], Number(digit));
    });
}

/** Removes tone diacritics but keeps ü. */
export function stripTones(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0304\u030C]/g, '')
    .normalize('NFC');
}

/** Canonical comparison form: marked, lower-case, no whitespace/punctuation. */
export function normalizePinyin(s: string): string {
  return normalizeUmlaut(numberedToMarked(s.trim()))
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\s'’\-.,!?·]/g, '');
}

/** Tone of a marked syllable (first diacritic found), or '0' for neutral. */
export function toneOfMarked(syllable: string): ToneKey {
  for (const ch of syllable.normalize('NFD')) {
    const t = COMBINING_TONE[ch];
    if (t) return t;
  }
  return '0';
}

export interface Syllable {
  /** Toneless base, lower-case, with ü. */
  base: string;
  tone: ToneKey;
}

/** Parses "ni3 hao3" / "xie4 xie5" into syllables. */
export function parseNumbered(numbered: string): Syllable[] {
  return numbered
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^([a-zA-ZüÜ:]+)([0-5])?$/);
      const base = normalizeUmlaut(m ? m[1] : raw).toLowerCase();
      const d = m?.[2];
      const tone: ToneKey = !d || d === '5' || d === '0' ? '0' : (d as ToneKey);
      return { base, tone };
    });
}

export function tonesOf(item: VocabItem): ToneKey[] {
  return parseNumbered(item.pinyinNumbered).map((s) => s.tone);
}

export interface PinyinCheck {
  correct: boolean;
  /** Accepted, but a neutral-tone syllable was given its full tone (e.g. xiè xiè). */
  variant: boolean;
  /** Letters right but at least one tone wrong. */
  tonesWrong: boolean;
  /** Only the ü / u distinction is wrong. */
  umlautMissing: boolean;
  /** Tones the user gave per syllable, if the spelling aligned with the target. */
  givenTones: ToneKey[] | null;
}

/**
 * Aligns a user's (marked or numbered) answer with the target syllables so that
 * tone accuracy can be measured even when the user typed no spaces.
 */
export function extractGivenTones(input: string, item: VocabItem): ToneKey[] | null {
  const norm = normalizePinyin(input);
  // Toneless input says nothing about the learner's tones — don't count it as "all neutral".
  if (!/[0-5]/.test(input) && stripTones(norm) === norm) return null;
  const syllables = parseNumbered(item.pinyinNumbered);
  const tones: ToneKey[] = [];
  let pos = 0;
  for (const syl of syllables) {
    const seg = norm.slice(pos, pos + syl.base.length);
    if (stripTones(seg) !== syl.base) return null;
    tones.push(toneOfMarked(seg));
    pos += syl.base.length;
  }
  return pos === norm.length ? tones : null;
}

export function checkPinyin(input: string, item: VocabItem): PinyinCheck {
  const given = normalizePinyin(input);
  const target = normalizePinyin(item.pinyin);
  const givenTones = extractGivenTones(input, item);
  if (!given) return { correct: false, variant: false, tonesWrong: false, umlautMissing: false, givenTones: null };
  let correct = given === target;
  let variant = false;
  if (!correct && givenTones) {
    const expected = tonesOf(item);
    if (givenTones.every((g, i) => g === expected[i] || expected[i] === '0')) {
      correct = true;
      variant = true;
    }
  }
  const bare = (x: string) => stripTones(x).replace(/ü/g, 'u');
  return {
    correct,
    variant,
    tonesWrong: !correct && stripTones(given) === stripTones(target),
    umlautMissing: !correct && stripTones(given) !== stripTones(target) && bare(given) === bare(target),
    givenTones,
  };
}

/**
 * Tones as actually spoken: a 3rd tone before another 3rd tone becomes 2nd (你好 → ní hǎo).
 * Applied right-to-left, which matches the common reading of 3-3-3 runs (2-2-3).
 */
export function sandhiTones(tones: ToneKey[]): ToneKey[] {
  const out = [...tones];
  for (let i = out.length - 2; i >= 0; i--) {
    if (tones[i] === '3' && out[i + 1] === '3') out[i] = '2';
  }
  return out;
}

/** Splits a vocab item's marked pinyin into display syllables with their tones. */
export function toneSyllables(pinyin: string, numbered: string): { text: string; tone: ToneKey }[] {
  const parts = pinyin.split(/\s+/).filter(Boolean);
  const tones = parseNumbered(numbered).map((s) => s.tone);
  return parts.map((text, i) => ({ text, tone: tones[i] ?? toneOfMarked(text) }));
}

// ---------- English matching ----------

const NO_STEM = new Set([
  'this', 'thus', 'plus', 'bus', 'gas', 'yes', 'always', 'sometimes', 'perhaps',
  'news', 'series', 'species', 'basis', 'crisis', 'axis', 'focus', 'status', 'virus',
  'speed', 'feed', 'bleed', 'breed', 'seed', 'need', 'weed', 'steed', 'hundred',
  'morning', 'evening', 'spring', 'ring', 'sing', 'wing', 'king', 'string', 'bring',
  'thing', 'nothing', 'something', 'everything', 'anything', 'ceiling', 'building',
  'during', 'sibling', 'darling'
]);

/**
 * Very light stemming so regular plurals/gerunds/past tenses match their roots,
 * while protecting irregular words and words ending in -is, -us, -ous, -eed, etc.
 */
export function stem(w: string): string {
  const lower = w.toLowerCase();
  if (NO_STEM.has(lower)) return lower;
  if (lower.endsWith('eed')) return lower;
  if (lower.length > 5 && lower.endsWith('ing')) return lower.slice(0, -3);
  if (lower.length > 4 && lower.endsWith('ed')) return lower.slice(0, -2);
  if (
    lower.length > 3 &&
    lower.endsWith('s') &&
    !lower.endsWith('ss') &&
    !lower.endsWith('us') &&
    !lower.endsWith('is') &&
    !lower.endsWith('os') &&
    !lower.endsWith('as') &&
    !lower.endsWith('ous')
  ) {
    if (lower.length > 4 && lower.endsWith('ies')) return lower.slice(0, -3) + 'y';
    if (lower.length > 4 && lower.endsWith('es')) return lower.slice(0, -2);
    return lower.slice(0, -1);
  }
  return lower;
}

export function cleanEnglish(s: string): string {
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\bcl\s*:[^;,/]+/gi, ' ')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normEnglish(s: string): string {
  const cleaned = cleanEnglish(s).replace(/^(to|a|an|the) /, '');
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(stem)
    .join('');
}

export function maxTypoTolerance(len: number): number {
  if (len >= 9) return 2;
  if (len >= 5) return 1;
  return 0;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

const STOP_WORDS = new Set([
  'to', 'a', 'an', 'the', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
  'into', 'through', 'over', 'from', 'sb', 'sth', 'someone', 'something', 'somebody',
  'oneself', 'etc', 'or', 'and'
]);

const LIGHT_VERBS = new Set([
  'make', 'do', 'have', 'take', 'give', 'get', 'be', 'let'
]);

function extractTokens(s: string): string[] {
  return cleanEnglish(s).split(/\s+/).filter(Boolean);
}

function meaningfulTokens(tokens: string[]): string[] {
  const filtered = tokens.filter((t) => !STOP_WORDS.has(t));
  return filtered.length > 0 ? filtered : tokens;
}

function coreTokens(tokens: string[]): string[] {
  const filtered = tokens.filter((t) => !LIGHT_VERBS.has(t));
  return filtered.length > 0 ? filtered : tokens;
}

function tokensMatch(u: string, t: string): boolean {
  if (u === t) return true;
  const su = stem(u);
  const st = stem(t);
  if (su === st) return true;
  if ((u === 'phone' && t === 'telephone') || (u === 'telephone' && t === 'phone')) return true;
  if ((su === 'phone' && st === 'telephon') || (su === 'telephon' && st === 'phone')) return true;
  const maxLen = Math.max(u.length, t.length);
  const tol = maxTypoTolerance(maxLen);
  if (tol > 0 && levenshtein(u, t) <= tol) return true;
  if (tol > 0 && levenshtein(su, st) <= tol) return true;
  return false;
}

function matchesSynonym(guess: string, syn: string): boolean {
  const normGuess = normEnglish(guess);
  const normTarget = normEnglish(syn);
  if (normGuess && normTarget) {
    if (normGuess === normTarget) return true;
    const tol = maxTypoTolerance(normTarget.length);
    if (levenshtein(normGuess, normTarget) <= tol) return true;
  }

  // Token-set / keyword matching
  const userRaw = extractTokens(guess);
  const targetRaw = extractTokens(syn);
  if (userRaw.length === 0 || targetRaw.length === 0) return false;

  const userTokens = meaningfulTokens(userRaw);
  const targetTokens = meaningfulTokens(targetRaw);
  const targetCore = coreTokens(targetTokens);

  const matchedTargetIndices = new Set<number>();
  let matchesCore = false;

  for (const u of userTokens) {
    let matched = false;
    for (let i = 0; i < targetTokens.length; i++) {
      if (matchedTargetIndices.has(i)) continue;
      const t = targetTokens[i];
      if (tokensMatch(u, t)) {
        matched = true;
        matchedTargetIndices.add(i);
        if (targetCore.some((c) => tokensMatch(t, c) || tokensMatch(u, c))) {
          matchesCore = true;
        }
        break;
      }
    }
    if (!matched) {
      return false;
    }
  }

  return matchesCore;
}

/**
 * Accepts any listed synonym or keyword/token set; ignores case, whitespace,
 * punctuation, parentheticals, and tolerates typos (1 typo for length >= 5, 2 typos for >= 9).
 * Several guesses may be separated by , ; / or "or".
 */
export function checkEnglish(input: string, item: VocabItem): { correct: boolean; matched?: string } {
  const guesses = input.split(/[,;/]| or /).map((g) => g.trim()).filter(Boolean);
  for (const guess of guesses) {
    for (const syn of item.english) {
      const subSyns = syn.split(/[;/]/).map((s) => s.trim()).filter(Boolean);
      for (const target of subSyns) {
        if (matchesSynonym(guess, target)) {
          return { correct: true, matched: syn };
        }
      }
    }
  }
  return { correct: false };
}
