import type { VocabItem } from '../types';
import { markSyllable } from '../utils/pinyinHelper';
import { COMPOUND_LIST, DISTRACTOR_PARTS, type Compound } from './data/compounds';
import { RADICALS, radicalForms, type Radical } from './data/radicals';
import { SENTENCES, type SentenceItem } from './data/sentences';
import { MARK_CASES, SANDHI_CASES, TONE_SETS, WORD_PAIRS } from './data/tones';
import { pinyinProblems, validSyllables, invalidSyllableExamples, type SyllableProblem } from './pinyinRules';

export type FoundationModule = 'radicals' | 'build' | 'tones' | 'pinyin' | 'pinyin2hanzi' | 'sentences';

/** The modules every learner should have passed before the harder levels; the rest are optional extras. */
export const CORE_MODULES: FoundationModule[] = ['radicals', 'tones', 'pinyin', 'sentences'];
export const ALL_MODULES: FoundationModule[] = ['radicals', 'build', 'tones', 'pinyin', 'pinyin2hanzi', 'sentences'];

export type Rng = () => number;

/** Small deterministic generator (for tests); the app passes Math.random. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

export interface ChoiceOption {
  text: string;
  /** Rendered in the hanzi font. */
  hanzi?: boolean;
  /** Small second line (pinyin or meaning). */
  sub?: string;
  /** Interface text instead of `text` (valid / invalid, tone names): a message key and its variables. */
  labelKey?: string;
  vars?: Record<string, string | number>;
}

export interface ChoiceQuestion {
  kind: 'choice';
  id: string;
  module: FoundationModule;
  /** Picks the instruction text, `foundations.q.<variant>`. */
  variant: string;
  /** Large text shown above the options (a glyph, a pinyin syllable …). */
  shown?: string;
  shownHanzi?: boolean;
  /** Smaller line under it (a meaning, a pattern). */
  hint?: string;
  /** Text the speaker button reads (listening questions). */
  audio?: string;
  options: ChoiceOption[];
  correct: number;
  /** Explanation: a rule from the locale (`foundations.rule.<id>`) and/or plain facts (course content). */
  rule?: string;
  facts: string[];
}

export interface OrderQuestion {
  kind: 'order';
  id: string;
  module: 'sentences';
  item: SentenceItem;
  /** Roles are printed on the tiles (levels 1–4 teach, later levels test). */
  showRoles: boolean;
}

export type Question = ChoiceQuestion | OrderQuestion;

/** Builds a choice question from the right answer and wrong answers (deduplicated, shuffled). */
function choice(
  rng: Rng,
  base: Omit<ChoiceQuestion, 'kind' | 'options' | 'correct'>,
  right: ChoiceOption,
  wrong: ChoiceOption[],
  count = 4,
): ChoiceQuestion {
  const seen = new Set([right.text]);
  const distractors: ChoiceOption[] = [];
  for (const w of shuffle(wrong, rng)) {
    if (seen.has(w.text)) continue;
    seen.add(w.text);
    distractors.push(w);
    if (distractors.length === count - 1) break;
  }
  const options = shuffle([right, ...distractors], rng);
  return { kind: 'choice', ...base, options, correct: options.findIndex((o) => o === right) };
}

// ---------- radicals ----------

const glyph = (x: Radical) => x.variant && x.variant !== x.id ? `${x.id} ${x.variant}` : x.id;

function radicalQuestion(rng: Rng, n: number): ChoiceQuestion {
  const x = pick(RADICALS, rng);
  const others = RADICALS.filter((o) => o !== x);
  const variant = ['rad-meaning', 'meaning-rad', 'char-rad', 'rad-char'][n % 4];
  const facts = [`${glyph(x)} ${x.pinyin} · ${x.meaning}`, x.hint, ...x.examples.map((e) => `${e.hanzi} ${e.pinyin} · ${e.meaning}`)];
  const base = { id: `rad-${variant}-${x.id}`, module: 'radicals' as const, variant, facts };
  if (variant === 'rad-meaning') {
    const clash = (o: Radical) => o.meaning !== x.meaning;
    return choice(rng, { ...base, shown: x.variant && x.variant !== x.id ? `${x.id}  ${x.variant}` : x.id, shownHanzi: true }, { text: x.meaning }, others.filter(clash).map((o) => ({ text: o.meaning })));
  }
  if (variant === 'meaning-rad') {
    return choice(rng, { ...base, shown: x.meaning }, { text: x.id, hanzi: true, sub: x.variant && x.variant !== x.id ? x.variant : undefined }, others.map((o) => ({ text: o.id, hanzi: true, sub: o.variant && o.variant !== o.id ? o.variant : undefined })));
  }
  const ex = pick(x.examples, rng);
  if (variant === 'char-rad') {
    // Only radicals whose examples do not also contain this character's radical forms are safe distractors.
    const forms = radicalForms(x);
    const safe = others.filter((o) => !radicalForms(o).some((f) => ex.hanzi.includes(f)) && !o.examples.some((e) => e.hanzi === ex.hanzi));
    return choice(rng, { ...base, shown: ex.hanzi, shownHanzi: true, hint: ex.meaning }, { text: forms[0], hanzi: true, sub: x.meaning }, safe.map((o) => ({ text: o.id, hanzi: true, sub: o.meaning })));
  }
  // rad-char: which character contains the radical?
  const taken = new Set(x.examples.map((e) => e.hanzi));
  const pool = others.flatMap((o) => o.examples).filter((e) => !taken.has(e.hanzi) && !radicalForms(x).some((f) => e.hanzi.includes(f)));
  return choice(rng, { ...base, shown: radicalForms(x).join(' '), shownHanzi: true, hint: x.meaning }, { text: ex.hanzi, hanzi: true, sub: ex.pinyin }, pool.map((e) => ({ text: e.hanzi, hanzi: true, sub: e.pinyin })));
}

// ---------- word building ----------

const partOpt = (c: string): ChoiceOption => ({ text: c, hanzi: true });

function buildQuestion(rng: Rng, n: number): ChoiceQuestion {
  const comp: Compound = pick(COMPOUND_LIST, rng);
  const [first, second] = comp.parts;
  const facts = [
    `${comp.hanzi} ${comp.pinyin} · ${comp.meaning}`,
    `${first.c} ${first.pinyin} (${first.gloss}) + ${second.c} ${second.pinyin} (${second.gloss})`,
  ];
  const rule = comp.type === 'phonetic' ? 'build-phonetic' : 'build-meaning';
  const variant = ['build-missing', 'build-char', 'build-sound'][n % 3];
  const base = { id: `build-${variant}-${comp.hanzi}`, module: 'build' as const, variant, rule, facts };
  const partPool = [...new Set([...DISTRACTOR_PARTS, ...COMPOUND_LIST.flatMap((c) => c.parts.map((p) => p.c))])];
  if (variant === 'build-missing') {
    const hideSecond = comp.parts[1].c !== comp.parts[0].c && n % 2 === 0;
    const given = hideSecond ? first : second;
    const answer = hideSecond ? second : first;
    return choice(
      rng,
      { ...base, shown: hideSecond ? `${given.c} + ?` : `? + ${given.c}`, shownHanzi: true, hint: `${comp.meaning} · ${comp.pinyin}` },
      partOpt(answer.c),
      partPool.filter((p) => p !== answer.c && p !== given.c).map(partOpt),
    );
  }
  if (variant === 'build-char') {
    return choice(
      rng,
      { ...base, shown: `${first.c} + ${second.c}`, shownHanzi: true },
      { text: comp.hanzi, hanzi: true, sub: comp.pinyin },
      COMPOUND_LIST.filter((c) => c.hanzi !== comp.hanzi).map((c) => ({ text: c.hanzi, hanzi: true, sub: c.pinyin })),
    );
  }
  // build-sound: which part tells you how the character sounds?
  if (comp.type === 'meaning') return buildQuestion(rng, 0);
  const sound = comp.parts.find((p) => p.role === 'sound')!;
  const other = comp.parts.find((p) => p.role !== 'sound')!;
  return choice(
    rng,
    { ...base, shown: comp.hanzi, shownHanzi: true, hint: `${comp.pinyin} · ${comp.meaning}` },
    { text: sound.c, hanzi: true, sub: sound.pinyin },
    [{ text: other.c, hanzi: true, sub: other.pinyin }, ...partPool.filter((p) => p !== sound.c && p !== other.c).map(partOpt)],
    3,
  );
}

// ---------- tones ----------

const toneOption = (n: number): ChoiceOption => ({ text: String(n), labelKey: 'foundations.opt.tone', vars: { n } });

/** Places the mark on the vowel at `index` of the toneless `syllable`. */
export function markAt(syllable: string, index: number, tone: number): string {
  const marked = markSyllable(syllable[index], tone);
  return syllable.slice(0, index) + marked + syllable.slice(index + 1);
}

const VOWEL_MARKS = ['a', 'o', 'e', 'i', 'u', 'ü'];

function toneQuestion(rng: Rng, n: number): ChoiceQuestion {
  const variant = ['tone-listen', 'tone-read', 'tone-mark', 'tone-sandhi', 'mark-tone', 'tone-pair', 'tone-letter'][n % 7];
  if (variant === 'tone-listen' || variant === 'tone-read') {
    const set = pick(TONE_SETS.filter((s) => s.members.length >= 3), rng);
    const right = pick(set.members, rng);
    const facts = set.members.map((m) => `${m.hanzi} ${m.pinyin} · ${m.meaning}`);
    const base = { id: `${variant}-${set.syllable}-${right.tone}`, module: 'tones' as const, variant, rule: 'tone-meaning', facts };
    const opts = (m: (typeof set.members)[number]): ChoiceOption => ({ text: m.meaning });
    return choice(
      rng,
      variant === 'tone-listen' ? { ...base, audio: right.hanzi } : { ...base, shown: right.pinyin },
      opts(right),
      set.members.filter((m) => m !== right).map(opts),
    );
  }
  if (variant === 'tone-mark') {
    const c = pick(MARK_CASES.filter((m) => [...m.numbered.slice(0, -1)].filter((ch) => 'aeiouü'.includes(ch)).length >= 2), rng);
    const syl = c.numbered.slice(0, -1);
    const tone = Number(c.numbered.slice(-1));
    const vowelIdx = [...syl].map((ch, i) => ('aeiouü'.includes(ch) ? i : -1)).filter((i) => i >= 0);
    const right = markAt(syl, syl.indexOf(c.letter) >= 0 ? syl.lastIndexOf(c.letter) : vowelIdx[vowelIdx.length - 1], tone);
    const forms = vowelIdx.map((i) => markAt(syl, i, tone));
    return choice(
      rng,
      { id: `mark-${c.numbered}`, module: 'tones', variant, shown: c.numbered, rule: `mark-${c.rule}`, facts: [`${c.numbered} → ${right}`] },
      { text: right },
      forms.filter((f) => f !== right).map((f) => ({ text: f })),
    );
  }
  if (variant === 'tone-sandhi') {
    const c = pick(SANDHI_CASES, rng);
    const wrongForms = [...new Set([c.written, ...c.wrong])].filter((w) => w !== c.spoken);
    return choice(
      rng,
      { id: `sandhi-${c.hanzi}`, module: 'tones', variant, shown: c.hanzi, shownHanzi: true, hint: c.meaning, audio: c.hanzi, rule: `sandhi-${c.rule}`, facts: [`${c.hanzi}: ${c.written} → ${c.spoken}`] },
      { text: c.spoken },
      wrongForms.map((w) => ({ text: w })),
      3,
    );
  }
  if (variant === 'mark-tone') {
    const v = pick(VOWEL_MARKS, rng);
    const tone = 1 + Math.floor(rng() * 4);
    const shown = markSyllable(v, tone);
    return choice(
      rng,
      { id: `marktone-${v}-${tone}`, module: 'tones', variant, shown, rule: 'tone-marks', facts: VOWEL_MARKS.map((x) => [1, 2, 3, 4].map((tt) => markSyllable(x, tt)).join(' ')) },
      toneOption(tone),
      [1, 2, 3, 4].filter((x) => x !== tone).map(toneOption),
    );
  }
  if (variant === 'tone-pair') {
    const pair = pick(WORD_PAIRS, rng);
    const [right, other] = rng() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
    return choice(
      rng,
      { id: `pair-${right.hanzi}`, module: 'tones', variant, audio: right.hanzi, rule: 'tone-pair', facts: [`${pair.a.hanzi} ${pair.a.pinyin} · ${pair.a.meaning}`, `${pair.b.hanzi} ${pair.b.pinyin} · ${pair.b.meaning}`] },
      { text: right.hanzi, hanzi: true, sub: right.meaning },
      [{ text: other.hanzi, hanzi: true, sub: other.meaning }],
      2,
    );
  }
  // tone-letter: which letter carries the mark?
  const c = pick(MARK_CASES, rng);
  const syl = c.numbered.slice(0, -1);
  const letters = [...new Set([...syl].filter((ch) => 'aeiouü'.includes(ch)))];
  if (letters.length < 2) return toneQuestion(rng, 2);
  return choice(
    rng,
    { id: `letter-${c.numbered}`, module: 'tones', variant, shown: c.numbered, rule: `mark-${c.rule}`, facts: [`${c.numbered} → ${markAt(syl, syl.lastIndexOf(c.letter), Number(c.numbered.slice(-1)))}`] },
    { text: c.letter },
    letters.filter((l) => l !== c.letter).map((text) => ({ text })),
  );
}

// ---------- pinyin spelling rules ----------

const VALID_OPT: ChoiceOption = { text: 'valid', labelKey: 'foundations.opt.valid' };
const INVALID_OPT: ChoiceOption = { text: 'invalid', labelKey: 'foundations.opt.invalid' };

function pinyinQuestion(rng: Rng, n: number): ChoiceQuestion {
  const variant = n % 2 === 0 ? 'syl-valid' : 'syl-which';
  const valid = pick(validSyllables(), rng);
  const bad: SyllableProblem = pick(pinyinProblems(), rng);
  if (variant === 'syl-valid') {
    const showValid = rng() < 0.4;
    if (showValid) {
      return choice(rng, { id: `syl-${valid}`, module: 'pinyin', variant, shown: valid, rule: 'syl-valid', facts: [valid] }, VALID_OPT, [INVALID_OPT], 2);
    }
    return choice(rng, { id: `syl-${bad.syllable}`, module: 'pinyin', variant, shown: bad.syllable, rule: bad.rule, facts: [bad.fix ? `${bad.syllable} → ${bad.fix}` : bad.syllable] }, INVALID_OPT, [VALID_OPT], 2);
  }
  const wrong = shuffle(invalidSyllableExamples(), rng).slice(0, 3);
  return choice(
    rng,
    { id: `which-${valid}`, module: 'pinyin', variant, rule: 'syl-which', facts: [valid, ...wrong.map((w) => `${w.syllable} ✗ — ${w.rule}`)] },
    { text: valid },
    wrong.map((w) => ({ text: w.syllable })),
  );
}

// ---------- pinyin → hanzi ----------

/** Words with 1–2 characters from the learner's vocabulary; needs enough of them for plausible wrong answers. */
export function pinyinHanziPool(vocab: readonly VocabItem[]): VocabItem[] {
  return vocab.filter((v) => /^[㐀-鿿]{1,2}$/.test(v.hanzi) && v.pinyin && v.english.length > 0);
}

const toneless = (numbered: string) => numbered.replace(/[0-5]/g, '').toLowerCase();

export function pinyinHanziQuestion(rng: Rng, pool: VocabItem[]): ChoiceQuestion | null {
  if (pool.length < 8) return null;
  const word = pick(pool, rng);
  const key = toneless(word.pinyinNumbered);
  // Hardest first: same syllables, other tone or other character (homophones); then anything of the same length.
  const near = pool.filter((v) => v.id !== word.id && v.hanzi !== word.hanzi && toneless(v.pinyinNumbered) === key);
  const sameLength = pool.filter((v) => v.id !== word.id && v.hanzi !== word.hanzi && v.hanzi.length === word.hanzi.length && !near.includes(v));
  const wrong = [...shuffle(near, rng), ...shuffle(sameLength, rng)].slice(0, 3);
  const opt = (v: VocabItem): ChoiceOption => ({ text: v.hanzi, hanzi: true });
  const hint = word.english.slice(0, 2).join('; ');
  return choice(
    rng,
    { id: `py-${word.id}`, module: 'pinyin2hanzi', variant: 'py-hanzi', shown: word.pinyin, hint, audio: word.hanzi, rule: near.length ? 'py-homophones' : undefined, facts: [`${word.hanzi} ${word.pinyin} · ${hint}`, ...near.slice(0, 2).map((v) => `${v.hanzi} ${v.pinyin} · ${v.english[0]}`)] },
    opt(word),
    wrong.map(opt),
  );
}

// ---------- sentences ----------

function sentenceQuestion(rng: Rng, levels?: SentenceItem['level'][]): OrderQuestion {
  const pool = levels ? SENTENCES.filter((s) => levels.includes(s.level)) : SENTENCES;
  const item = pick(pool, rng);
  return { kind: 'order', id: `ord-${item.id}`, module: 'sentences', item, showRoles: item.level <= 4 };
}

// ---------- public ----------

export interface BuildOptions {
  vocab?: readonly VocabItem[];
  rng?: Rng;
  /** Sentence levels to draw from (default: all). */
  sentenceLevels?: SentenceItem['level'][];
}

/** `count` questions for one module, never repeating a question id within the round. */
export function buildQuestions(module: FoundationModule, count: number, opts: BuildOptions = {}): Question[] {
  const rng = opts.rng ?? Math.random;
  const pool = module === 'pinyin2hanzi' ? pinyinHanziPool(opts.vocab ?? []) : [];
  const out: Question[] = [];
  const seen = new Set<string>();
  const start = Math.floor(rng() * 7);
  for (let i = 0, guard = 0; out.length < count && guard < count * 25; guard++) {
    let q: Question | null = null;
    const n = start + i;
    switch (module) {
      case 'radicals':
        q = radicalQuestion(rng, n);
        break;
      case 'build':
        q = buildQuestion(rng, n);
        break;
      case 'tones':
        q = toneQuestion(rng, n);
        break;
      case 'pinyin':
        q = pinyinQuestion(rng, n);
        break;
      case 'pinyin2hanzi':
        q = pinyinHanziQuestion(rng, pool);
        break;
      case 'sentences':
        q = sentenceQuestion(rng, opts.sentenceLevels);
        break;
    }
    if (!q) break;
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
    i++;
  }
  return out;
}

/** Whether the module can be practised with the given vocabulary (pinyin → hanzi needs enough words). */
export function moduleAvailable(module: FoundationModule, vocab: readonly VocabItem[]): boolean {
  return module !== 'pinyin2hanzi' || pinyinHanziPool(vocab).length >= 8;
}
