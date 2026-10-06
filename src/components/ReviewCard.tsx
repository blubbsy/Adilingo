import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, Eye, Lightbulb, X } from 'lucide-react';
import type { CardProgress, Grade, SessionCard, Settings, ToneKey, VocabItem } from '../types';
import { checkEnglish, checkPinyin, markSyllable, numberedToMarked, parseNumbered, sandhiTones, stripTones, tonesOf } from '../utils/pinyinHelper';
import { GRADE_LABELS, nextInterval } from '../utils/srsEngine';
import { RADICAL_MEANINGS } from '../utils/radicals';
import { levelLabel } from '../data/vocab';
import type { SpeechApi } from '../utils/speech';
import { TONE_NAMES } from '../utils/analytics';
import { AudioButton } from './AudioButton';
import { FreePinyin, HanziText, PinyinText, TONE_BG_CLASS, ToneBadge, ToneContourIcon } from './ToneText';
import { playClick, playCorrect, playError, playTonePitch } from '../utils/sound';

export interface CardResult {
  correct: boolean;
  latencyMs: number;
  tones?: { expected: ToneKey; given: ToneKey }[];
}

interface Props {
  card: SessionCard;
  vocab: VocabItem[];
  progress?: CardProgress;
  settings: Settings;
  speech: SpeechApi;
  onGrade: (grade: Grade, result: CardResult) => void;
}

interface Evaluation {
  correct: boolean;
  overridden?: boolean;
  pinyinOk?: boolean;
  /** Accepted with full tones on a neutral syllable. */
  pinyinVariant?: boolean;
  umlautMissing?: boolean;
  tonesWrong?: boolean;
  englishOk?: boolean;
  choiceOk?: boolean;
  skipped?: boolean;
  /** Tone drill answered with the spoken (sandhi) tones rather than dictionary tones. */
  sandhiMatch?: boolean;
  tones?: { expected: ToneKey; given: ToneKey }[];
}

const TONE_BUTTONS: { tone: ToneKey; key: string; mark: string }[] = [
  { tone: '1', key: '1', mark: 'ā' },
  { tone: '2', key: '2', mark: 'á' },
  { tone: '3', key: '3', mark: 'ǎ' },
  { tone: '4', key: '4', mark: 'à' },
  { tone: '0', key: '5', mark: 'a' },
];

/** Grade keys are ignored this long after reveal so a stray keypress can't grade an auto-checked card. */
const GRADE_LOCKOUT_MS = 400;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random sample of n items without shuffling the whole (possibly 10k-word) list. */
function sample<T>(arr: T[], n: number, accept: (x: T) => boolean): T[] {
  const out: T[] = [];
  const tried = new Set<number>();
  while (out.length < n && tried.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length);
    if (tried.has(i)) continue;
    tried.add(i);
    if (accept(arr[i]) && !out.includes(arr[i])) out.push(arr[i]);
  }
  return out;
}

/** Plausible wrong options: same level and word class first, similar length. */
function pickDistractors(item: VocabItem, vocab: VocabItem[], n = 3): VocabItem[] {
  const len = [...item.hanzi].length;
  const valid = (v: VocabItem) => v.id !== item.id && v.hanzi !== item.hanzi && v.english[0] !== item.english[0];
  const sameLevel = vocab.filter((v) => v.hskLevel === item.hskLevel);
  const close = sample(sameLevel, n, (v) => valid(v) && v.topics.some((t) => item.topics.includes(t)) && Math.abs([...v.hanzi].length - len) <= 1);
  const rest = sample(sameLevel.length > 20 ? sameLevel : vocab, n - close.length, (v) => valid(v) && !close.includes(v));
  return [...close, ...rest];
}

export function formatInterval(days: number): string {
  if (days < 1) return '<1d';
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-rose-900';

export function ReviewCard({ card, vocab, progress, settings, speech, onGrade }: Props) {
  const { item, prompt } = card;
  const color = settings.colorTones;
  const expectedTones = useMemo(() => tonesOf(item), [item]);
  const spokenTones = useMemo(() => sandhiTones(expectedTones), [expectedTones]);
  const options = useMemo(() => shuffle([item, ...pickDistractors(item, vocab)]), [item, vocab]);
  // Tone drill: show characters, or (only with a real Chinese voice) play audio alone.
  const toneAudioOnly = useMemo(() => prompt === 'tone' && !!speech.voice && Math.random() < 0.4, [prompt, speech.voice]);
  const audioFallback = prompt === 'audio' && !speech.supported;

  // New words get a short "meet the word" step before being tested.
  const [introducing, setIntroducing] = useState(card.isNew);
  const [pinyin, setPinyin] = useState('');
  const [english, setEnglish] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [taps, setTaps] = useState<ToneKey[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [reaction, setReaction] = useState<'correct' | 'error' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const started = useRef(performance.now());
  const revealedAt = useRef(0);
  const latency = useRef(0);
  const firstInput = useRef<HTMLInputElement>(null);
  const revealed = evaluation !== null;
  const isLeech = progress?.isLeech ?? false;

  // Focus on a single question target per card to eliminate cognitive overload.
  const questionTarget = useMemo<'pinyin' | 'meaning' | 'hanzi' | 'tone'>(() => {
    if (prompt === 'tone') return 'tone';
    if (prompt === 'audio') return 'meaning';
    if (prompt === 'hanzi') {
      return Math.random() < 0.5 ? 'pinyin' : 'meaning';
    }
    if (prompt === 'pinyin') {
      return Math.random() < 0.5 ? 'hanzi' : 'meaning';
    }
    if (prompt === 'english') {
      return Math.random() < 0.5 ? 'hanzi' : 'pinyin';
    }
    return 'meaning';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.item.id, prompt]);

  const needs = {
    pinyin: questionTarget === 'pinyin',
    pinyinOptional: false,
    english: questionTarget === 'meaning' && prompt !== 'audio',
    hanziChoice: questionTarget === 'hanzi',
    meaningChoice: prompt === 'audio' && questionTarget === 'meaning',
    tones: questionTarget === 'tone',
  };
  const hasChoice = needs.hanziChoice || needs.meaningChoice;

  // Auto-play for listening prompts once the card is in test mode.
  useEffect(() => {
    if (introducing) return undefined;
    started.current = performance.now();
    firstInput.current?.focus();
    if ((prompt === 'audio' || toneAudioOnly) && speech.supported) {
      const t = window.setTimeout(() => speech.speak(item.hanzi, settings.speechRate), 250);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, introducing]);

  function evaluateTones(given: ToneKey[]): Evaluation {
    const citation = expectedTones.every((t, i) => t === given[i]);
    const hasSandhi = spokenTones.some((t, i) => t !== expectedTones[i]);
    const spoken = !citation && hasSandhi && spokenTones.every((t, i) => t === given[i]);
    // A sandhi answer matches what was heard: count each syllable as correct.
    const tones = expectedTones.map((expected, i) => ({ expected, given: spoken ? expected : given[i] }));
    return { correct: citation || spoken, sandhiMatch: spoken, tones };
  }

  function evaluate(skipped = false): Evaluation {
    if (skipped) return { correct: false, skipped: true };
    if (needs.tones) return evaluateTones(taps);
    const ev: Evaluation = { correct: true };
    if (needs.pinyin && (!needs.pinyinOptional || pinyin.trim())) {
      const r = checkPinyin(pinyin, item);
      ev.pinyinOk = r.correct;
      ev.pinyinVariant = r.variant;
      ev.tonesWrong = r.tonesWrong;
      ev.umlautMissing = r.umlautMissing;
      if (r.givenTones) {
        const given = r.givenTones;
        ev.tones = expectedTones
          .map((expected, i) => ({ expected, given: given[i] }))
          // Full tones on neutral syllables are an accepted variant, not a tone error.
          .filter((t) => !(r.variant && t.expected === '0' && t.given !== '0'));
      }
      ev.correct &&= r.correct;
    }
    if (needs.english) {
      ev.englishOk = checkEnglish(english, item).correct;
      ev.correct &&= ev.englishOk;
    }
    if (hasChoice) {
      ev.choiceOk = choice === item.id;
      ev.correct &&= ev.choiceOk;
    }
    return ev;
  }

  function finish(ev: Evaluation) {
    latency.current = performance.now() - started.current;
    revealedAt.current = performance.now();
    setEvaluation(ev);
    if (!ev.skipped) {
      if (ev.correct) {
        setReaction('correct');
        playCorrect(settings.soundEffects);
      } else {
        setReaction('error');
        playError(settings.soundEffects);
      }
    }
    if (speech.supported && prompt !== 'audio') speech.speak(item.hanzi, settings.speechRate);
  }

  function reveal(skipped = false) {
    if (revealed) return;
    finish(evaluate(skipped));
  }

  const canSubmit =
    (needs.tones ? taps.length === expectedTones.length : true) &&
    (!hasChoice || choice !== null) &&
    (!needs.pinyin || needs.pinyinOptional || pinyin.trim() !== '') &&
    (!needs.english || english.trim() !== '');

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (revealed || !canSubmit) return;
    reveal();
  }

  function grade(g: Grade) {
    if (!evaluation) return;
    playClick(settings.soundEffects);
    const isCorrect = g >= 2;
    onGrade(g, { correct: isCorrect, latencyMs: latency.current, tones: evaluation.tones });
  }

  function toggleOverride() {
    setEvaluation((prev) => {
      if (!prev) return null;
      const nextCorrect = !prev.correct;
      if (nextCorrect) {
        setReaction('correct');
        playCorrect(settings.soundEffects);
      } else {
        setReaction('error');
      }
      return { ...prev, correct: nextCorrect, overridden: nextCorrect };
    });
  }

  function tapTone(t: ToneKey) {
    if (revealed || taps.length >= expectedTones.length) return;
    playTonePitch(t, settings.soundEffects);
    const next = [...taps, t];
    setTaps(next);
    if (next.length === expectedTones.length) {
      // Auto-check once every syllable has a tone.
      window.setTimeout(() => finish(evaluateTones(next)), 120);
    }
  }

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      // Focused buttons keep their native Space/Enter activation.
      const onButton = target.tagName === 'BUTTON';
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (introducing) {
        if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          setIntroducing(false);
        } else if (e.key === ' ' && !onButton) {
          e.preventDefault();
          speech.speak(item.hanzi, settings.speechRate);
        }
        return;
      }
      if (revealed) {
        if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          if (performance.now() - revealedAt.current < GRADE_LOCKOUT_MS) return;
          grade(suggested);
          return;
        }
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          if (performance.now() - revealedAt.current < GRADE_LOCKOUT_MS) return;
          grade(Number(e.key) as Grade);
        } else if (e.key === ' ' && !typing && !onButton) {
          e.preventDefault();
          speech.speak(item.hanzi, settings.speechRate);
        }
        return;
      }
      if (typing) return;
      if (needs.tones) {
        const btn = TONE_BUTTONS.find((b) => b.key === e.key || (e.key === '0' && b.tone === '0'));
        if (btn) {
          e.preventDefault();
          tapTone(btn.tone);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          setTaps((t) => t.slice(0, -1));
          return;
        }
      }
      if (hasChoice) {
        const idx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
        if (idx >= 0 && options[idx]) {
          e.preventDefault();
          setChoice(options[idx].id);
          return;
        }
      }
      if (e.key === ' ' && !onButton && speech.supported) {
        e.preventDefault();
        speech.speak(item.hanzi, settings.speechRate);
      }
      if (e.key === 'Enter' && !onButton && canSubmit) {
        e.preventDefault();
        reveal();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const suggested: Grade = evaluation?.correct ? (latency.current < 5000 && !isLeech ? 4 : 3) : 1;

  return (
    <div
      className={`animate-pop rounded-3xl border bg-white p-5 shadow-sm transition-all duration-300 sm:p-8 short:p-4 dark:bg-slate-800 ${
        reaction === 'correct'
          ? 'border-emerald-400 ring-2 ring-emerald-200 dark:border-emerald-500 dark:ring-emerald-900/50'
          : reaction === 'error'
            ? 'animate-shake border-rose-300 ring-2 ring-rose-200 dark:border-rose-700 dark:ring-rose-900/50'
            : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{levelLabel(item.hskLevel)}</span>
        {item.topics.map((t) => (
          <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500 dark:bg-slate-700 dark:text-slate-400">{t}</span>
        ))}
        {card.isNew && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">New</span>}
        {isLeech && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Leech
          </span>
        )}
      </div>

      {introducing ? (
        <IntroView item={item} color={color} speech={speech} rate={settings.speechRate} onContinue={() => setIntroducing(false)} />
      ) : (
        <>
          {/* Prompt */}
          <div className="flex min-h-[9rem] flex-col items-center justify-center gap-3 text-center short:min-h-0 short:gap-2">
            <PromptView
              card={card}
              color={color}
              revealed={revealed}
              speech={speech}
              rate={settings.speechRate}
              toneAudioOnly={toneAudioOnly}
              audioFallback={audioFallback}
              questionTarget={questionTarget}
            />
          </div>

          {isLeech && !revealed && (
            <div className="mx-auto mt-3 max-w-md rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">This word keeps slipping — take your time.</p>
              {showHint ? (
                <ul className="mt-1 space-y-0.5 text-left">
                  {item.radical && (
                    <li>
                      Radical: <span className="font-hanzi text-base">{item.radical}</span> {RADICAL_MEANINGS[item.radical] && `(${RADICAL_MEANINGS[item.radical]})`}
                    </li>
                  )}
                  <li>
                    Starts with “{item.pinyinNumbered.split(' ')[0].replace(/\d/, '')}…”, {expectedTones.length} syllable{expectedTones.length > 1 ? 's' : ''}
                  </li>
                  {item.exampleSentence && <li>Context: “{item.exampleSentence.english}”</li>}
                </ul>
              ) : (
                <button type="button" onClick={() => setShowHint(true)} className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2">
                  <Lightbulb className="h-4 w-4" /> Show memory hint
                </button>
              )}
            </div>
          )}

          {/* Answer area */}
          {!revealed && (
            <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4">
              {needs.tones && <ToneInput expected={expectedTones} taps={taps} onTap={tapTone} onUndo={() => setTaps((t) => t.slice(0, -1))} />}

              {needs.hanziChoice && (
                <ChoiceGrid
                  label="Which characters?"
                  options={options.map((o) => ({
                    id: o.id,
                    content: (
                      <span className="font-hanzi text-2xl" lang="zh-CN">
                        {o.hanzi}
                      </span>
                    ),
                  }))}
                  value={choice}
                  onChange={setChoice}
                />
              )}
              {needs.meaningChoice && (
                <ChoiceGrid
                  label="What does it mean?"
                  options={options.map((o) => ({ id: o.id, content: <span className="text-sm">{o.english.slice(0, 2).join(', ')}</span> }))}
                  value={choice}
                  onChange={setChoice}
                />
              )}

              {needs.pinyin && (
                <div className="block text-left">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                      Pinyin pronunciation
                    </span>
                    <input
                      ref={firstInput}
                      className={inputCls}
                      value={pinyin}
                      onChange={(e) => {
                        const el = e.target;
                        // Only auto-convert while typing at the end, so mid-word edits keep the cursor.
                        const atEnd = el.selectionStart === el.value.length;
                        setPinyin(atEnd ? numberedToMarked(el.value) : el.value);
                      }}
                      placeholder="e.g. ni3hao3 → nǐhǎo"
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      lang="zh-Latn-pinyin"
                      aria-label="Pinyin answer"
                    />
                  </label>
                  <PinyinSuggestions item={item} value={pinyin} onSelect={(val) => setPinyin(val)} />
                </div>
              )}

              {needs.english && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">English meaning</span>
                  <input
                    ref={needs.pinyin ? undefined : firstInput}
                    className={inputCls}
                    value={english}
                    onChange={(e) => setEnglish(e.target.value)}
                    placeholder="any synonym works"
                    autoCapitalize="off"
                    autoComplete="off"
                    aria-label="English answer"
                  />
                </label>
              )}

              {!needs.tones && (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Check <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 text-xs sm:inline">Enter</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => reveal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-3 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Eye className="h-4 w-4" /> Show
                  </button>
                </div>
              )}
              {needs.tones && (
                <button type="button" onClick={() => reveal(true)} className="mx-auto block text-sm text-slate-500 underline underline-offset-2">
                  I don't know — show me
                </button>
              )}
            </form>
          )}

          {revealed && evaluation && (
            <RevealPanel
              item={item}
              evaluation={evaluation}
              answers={{ pinyin, english, choice, taps }}
              options={options}
              color={color}
              speech={speech}
              rate={settings.speechRate}
              isLeech={isLeech}
              onToggleOverride={toggleOverride}
            />
          )}

          {revealed && (
            // Pinned to the bottom edge on phones so grading never needs a scroll.
            <div className="sticky bottom-0 -mx-5 mt-6 border-t border-slate-200 bg-white/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none dark:border-slate-700 dark:bg-slate-800/95 sm:dark:bg-transparent">
              {/* Primary Next Card Action */}
              <button
                type="button"
                onClick={() => grade(suggested)}
                className={`mb-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-base font-bold shadow-md transition active:scale-[0.99] ${
                  evaluation?.correct
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <span>Next Card · {GRADE_LABELS[suggested]}</span>
                <ArrowRight className="h-5 w-5" />
                <kbd className="hidden rounded bg-white/20 px-2 py-0.5 text-xs font-mono font-medium sm:inline">Enter</kbd>
              </button>

              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Or adjust rating:<span className="touch:hidden"> Keys 1–4</span>
                </p>
                {evaluation && (!evaluation.correct || evaluation.overridden) && (
                  <button
                    type="button"
                    onClick={toggleOverride}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition ${
                      evaluation.correct
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    {evaluation.correct ? 'Marked correct (undo)' : 'I was right'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as Grade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => grade(g)}
                    className={`flex flex-col items-center rounded-xl border px-2 py-2 text-xs font-semibold transition ${GRADE_STYLE[g]} ${
                      g === suggested ? 'ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-800' : ''
                    }`}
                  >
                    <span>{GRADE_LABELS[g]}</span>
                    <span className="text-[10px] font-normal opacity-75">
                      <kbd>{g}</kbd> · {g === 1 ? '↻ soon' : formatInterval(nextInterval(progress, g))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const GRADE_STYLE: Record<Grade, string> = {
  1: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  2: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  3: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  4: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function stableShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr];
  let h = hashString(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    h = (Math.imul(31, h) + 17) | 0;
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateWordToneOptions(syllables: { base: string; tone: ToneKey }[]): string[] {
  const correct = syllables.map((s) => markSyllable(s.base, Number(s.tone) || 1)).join('');
  const options = new Set<string>();
  options.add(correct);

  // Distractor 1: All tone 1 (or 2 if already 1)
  const d1 = syllables.map((s) => markSyllable(s.base, s.tone === '1' ? 2 : 1)).join('');
  options.add(d1);

  // Distractor 2: All tone 4 (or 3 if already 4)
  const d2 = syllables.map((s) => markSyllable(s.base, s.tone === '4' ? 3 : 4)).join('');
  options.add(d2);

  // Distractor 3: Shift tone of first syllable
  const firstToneNum = Number(syllables[0]?.tone) || 1;
  const shifted1 = ((firstToneNum % 4) + 1);
  const d3 = syllables.map((s, i) => (i === 0 ? markSyllable(s.base, shifted1) : markSyllable(s.base, Number(s.tone) || 1))).join('');
  options.add(d3);

  // Distractor 4: Shift tone of second syllable if multi-syllable
  if (syllables.length > 1) {
    const secondToneNum = Number(syllables[1]?.tone) || 1;
    const shifted2 = ((secondToneNum % 4) + 1);
    const d4 = syllables.map((s, i) => (i === 1 ? markSyllable(s.base, shifted2) : markSyllable(s.base, Number(s.tone) || 1))).join('');
    options.add(d4);
  }

  // Safety fallbacks if set size < 4
  for (let t = 1; t <= 4 && options.size < 4; t++) {
    options.add(syllables.map((s) => markSyllable(s.base, t)).join(''));
  }

  return Array.from(options).slice(0, 4);
}

function PinyinSuggestions({
  item,
  value,
  onSelect,
}: {
  item: VocabItem;
  value: string;
  onSelect: (val: string) => void;
}) {
  const syllables = useMemo(() => {
    return parseNumbered(item.pinyinNumbered).map((s) => ({
      base: s.base,
      tone: s.tone,
    }));
  }, [item.pinyinNumbered]);

  // Generate 4 plausible tone pattern choices for this word (shuffled stably per item.id without spoilers)
  const wordToneOptions = useMemo(() => {
    const rawOptions = generateWordToneOptions(syllables);
    return stableShuffle(rawOptions, item.id);
  }, [syllables, item.id]);

  // Extract the current syllable being typed to show live autocomplete tone chips
  const lastToken = value.trim().split(/\s+/).pop() ?? '';
  const untonedToken = stripTones(lastToken).toLowerCase();
  const hasVowels = /[aeiouü]/.test(untonedToken);

  const activeSyllableTones = useMemo(() => {
    if (!hasVowels || untonedToken.length < 1) return [];
    const t1 = markSyllable(untonedToken, 1);
    // If markSyllable could not place a mark (e.g. only consonants), return empty
    if (t1 === untonedToken) return [];
    return [1, 2, 3, 4].map((t) => markSyllable(untonedToken, t));
  }, [untonedToken, hasVowels]);

  function handleSyllableSelect(toned: string) {
    const parts = value.trim().split(/\s+/);
    if (parts.length === 0 || parts[0] === '') {
      onSelect(toned);
      return;
    }
    parts[parts.length - 1] = toned;
    const hasMore = parts.length < syllables.length;
    onSelect(parts.join(' ') + (hasMore ? ' ' : ''));
  }

  return (
    <div className="mt-2.5 space-y-2 text-left">
      {/* 1. Live Syllable Autocomplete (shown while typing an unaccented syllable) */}
      {activeSyllableTones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 p-2 text-xs dark:border-rose-900/50 dark:bg-rose-950/30">
          <span className="font-medium text-rose-800 dark:text-rose-200">
            Tones for “{untonedToken}”:
          </span>
          {activeSyllableTones.map((toned, i) => (
            <button
              key={toned}
              type="button"
              onClick={() => handleSyllableSelect(toned)}
              className="inline-flex items-center gap-0.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-100 active:scale-95 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-200"
            >
              <span>{toned}</span>
              <span className="text-[10px] font-normal text-slate-400">({i + 1})</span>
            </button>
          ))}
        </div>
      )}

      {/* 2. Word Tone Pattern Choices (4 options with different accents — look closely to pick the right one) */}
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Choose matching tone accents:
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {wordToneOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`flex items-center justify-center rounded-xl border px-3 py-2 text-base font-semibold transition active:scale-95 ${
                value === opt
                  ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-sm dark:bg-rose-950/50 dark:text-rose-200'
                  : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Tone Accents Toolbar for manual letter insertion */}
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="text-slate-400 dark:text-slate-500">Accents:</span>
        {['ā', 'á', 'ǎ', 'à', 'ē', 'é', 'ě', 'è', 'ī', 'í', 'ǐ', 'ì', 'ō', 'ó', 'ǒ', 'ò', 'ū', 'ú', 'ǔ', 'ù', 'ü'].map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => onSelect(value + char)}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white font-medium hover:bg-slate-100 active:scale-90 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
}

function IntroView({ item, color, speech, rate, onContinue }: { item: VocabItem; color: boolean; speech: SpeechApi; rate: number; onContinue: () => void }) {
  useEffect(() => {
    if (!speech.supported) return undefined;
    const t = window.setTimeout(() => speech.speak(item.hanzi, rate), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  return (
    <div className="space-y-4 text-center">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <span>✨ New word preview</span>
      </div>
      <div>
        <button
          type="button"
          onClick={() => speech.speak(item.hanzi, rate)}
          className="group cursor-pointer rounded-2xl p-2 transition hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700/60"
          title="Click to hear pronunciation"
        >
          <HanziText item={item} color={color} className="text-6xl font-medium sm:text-7xl xl:text-8xl short:text-5xl" />
          <span className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            🔊 Click to listen
          </span>
        </button>
      </div>
      <div className="flex items-center justify-center gap-3">
        <PinyinText item={item} color={color} className="text-2xl" />
        <AudioButton speech={speech} text={item.hanzi} rate={rate} />
      </div>
      <p className="text-lg font-medium">{item.english.join(' · ')}</p>
      {item.exampleSentence && (
        <div className="mx-auto max-w-md rounded-xl bg-slate-50 p-3 text-left text-sm dark:bg-slate-900/60">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-400">Example</span>
            <AudioButton speech={speech} text={item.exampleSentence.hanzi} rate={rate} />
          </div>
          <p
            className="font-hanzi text-lg cursor-pointer hover:opacity-80 transition"
            lang="zh-CN"
            onClick={() => speech.speak(item.exampleSentence!.hanzi, rate)}
            title="Click to hear example sentence"
          >
            <HighlightedSentence sentence={item.exampleSentence.hanzi} word={item.hanzi} />
          </p>
          <FreePinyin text={item.exampleSentence.pinyin} color={color} className="block" />
          <p className="text-slate-600 dark:text-slate-300">{item.exampleSentence.english}</p>
        </div>
      )}
      <div className="pt-2">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-rose-700 active:scale-95"
        >
          Got it — test me <ArrowRight className="h-4 w-4" />
          <kbd className="hidden rounded bg-white/20 px-1.5 text-xs sm:inline">Enter</kbd>
        </button>
      </div>
    </div>
  );
}

function PromptView({
  card,
  color,
  revealed,
  speech,
  rate,
  toneAudioOnly,
  audioFallback,
  questionTarget,
}: {
  card: SessionCard;
  color: boolean;
  revealed: boolean;
  speech: SpeechApi;
  rate: number;
  toneAudioOnly: boolean;
  audioFallback: boolean;
  questionTarget: 'pinyin' | 'meaning' | 'hanzi' | 'tone';
}) {
  const { item, prompt } = card;
  const hint = (text: string) => <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>;
  switch (prompt) {
    case 'hanzi':
      return (
        <>
          <button
            type="button"
            onClick={() => speech.speak(item.hanzi, rate)}
            className="group relative cursor-pointer rounded-2xl p-2 transition hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700/60"
            title="Click to hear pronunciation"
          >
            <HanziText item={item} color={false} className="text-6xl font-medium sm:text-7xl xl:text-8xl short:text-5xl" />
            <span className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
              🔊 Click to listen
            </span>
          </button>
          {!revealed && hint(questionTarget === 'pinyin' ? 'Type or select the pinyin pronunciation' : 'What does this word mean?')}
        </>
      );
    case 'pinyin':
      return (
        <>
          <PinyinText item={item} color={color} className="text-4xl font-medium sm:text-5xl" />
          <AudioButton speech={speech} text={item.hanzi} rate={rate} />
          {!revealed && hint(questionTarget === 'hanzi' ? 'Pick the characters (A–D)' : 'What does this word mean?')}
        </>
      );
    case 'english':
      return (
        <>
          <p className="text-3xl font-semibold sm:text-4xl">{item.english.slice(0, 3).join(' · ')}</p>
          {!revealed && hint(questionTarget === 'hanzi' ? 'Pick the characters (A–D)' : 'Type or select the pinyin pronunciation')}
        </>
      );
    case 'audio':
      return (
        <>
          {revealed ? null : audioFallback ? (
            <div className="space-y-2">
              <PinyinText item={item} color={color} className="text-4xl font-medium" />
              <p className="flex items-center justify-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" /> Speech isn't available in this browser — reading pinyin instead.
              </p>
            </div>
          ) : (
            <>
              <AudioButton speech={speech} text={item.hanzi} rate={rate} size="lg" label="Play" />
            </>
          )}
          {!revealed && hint(audioFallback ? 'Identify the meaning (A–D)' : 'Listen, then identify the meaning (A–D, Space replays)')}
        </>
      );
    case 'tone':
      return (
        <>
          {toneAudioOnly && !revealed ? (
            <AudioButton speech={speech} text={item.hanzi} rate={rate} size="lg" label="Play" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => speech.speak(item.hanzi, rate)}
                className="group relative cursor-pointer rounded-2xl p-2 transition hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700/60"
                title="Click to hear pronunciation"
              >
                <HanziText item={item} color={false} className="text-6xl font-medium sm:text-7xl xl:text-8xl short:text-5xl" />
                <span className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                  🔊 Click to listen
                </span>
              </button>
              <AudioButton speech={speech} text={item.hanzi} rate={rate} />
            </>
          )}
          {!revealed && hint('Tap the tone of each syllable (keys 1–4, 5 = neutral)')}
        </>
      );
  }
}

function ToneInput({ expected, taps, onTap, onUndo }: { expected: ToneKey[]; taps: ToneKey[]; onTap: (t: ToneKey) => void; onUndo: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2" aria-live="polite">
        {expected.map((_, i) => (
          <span
            key={i}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-bold ${
              taps[i] ? `${TONE_BG_CLASS[taps[i]]} border-transparent text-white` : i === taps.length ? 'border-rose-400' : 'border-slate-200 dark:border-slate-600'
            }`}
          >
            {taps[i] ? (taps[i] === '0' ? '·' : taps[i]) : ''}
          </span>
        ))}
        {taps.length > 0 && (
          <button type="button" onClick={onUndo} className="ml-1 text-xs text-slate-500 underline" aria-label="Undo last tone">
            undo
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {TONE_BUTTONS.map((b) => (
          <button
            key={b.tone}
            type="button"
            onClick={() => onTap(b.tone)}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-3 font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95 ${TONE_BG_CLASS[b.tone]}`}
            aria-label={`${TONE_NAMES[b.tone]} (key ${b.key})`}
          >
            <span className="flex items-center gap-1 text-xl">
              <span>{b.mark}</span>
              <ToneContourIcon tone={b.tone} className="h-3.5 w-3.5 stroke-white/80" />
            </span>
            <span className="text-xs font-medium opacity-90">{b.tone === '0' ? 'neutral' : `tone ${b.tone}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoiceGrid({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; content: ReactNode }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`relative min-h-[3.5rem] rounded-xl border-2 px-3 py-2 transition ${
              value === o.id
                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
            }`}
          >
            <kbd className="absolute left-2 top-1 text-[10px] uppercase text-slate-400">{'abcd'[i]}</kbd>
            {o.content}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Verdict({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>
        <span className="font-medium">{label}</span>
        {detail && <span className="text-slate-600 dark:text-slate-400"> — {detail}</span>}
      </span>
    </li>
  );
}

function RevealPanel({
  item,
  evaluation,
  answers,
  options,
  color,
  speech,
  rate,
  isLeech,
  onToggleOverride,
}: {
  item: VocabItem;
  evaluation: Evaluation;
  answers: { pinyin: string; english: string; choice: string | null; taps: ToneKey[] };
  options: VocabItem[];
  color: boolean;
  speech: SpeechApi;
  rate: number;
  isLeech: boolean;
  onToggleOverride?: () => void;
}) {
  const chosen = options.find((o) => o.id === answers.choice);
  const ex = item.exampleSentence;
  const pinyinDetail = evaluation.tonesWrong
    ? 'spelling right, check the tones'
    : evaluation.umlautMissing
      ? 'needs ü (type v or u:) — u and ü are different sounds'
      : evaluation.pinyinVariant
        ? `accepted; the standard form is ${item.pinyin} (neutral tone)`
        : undefined;
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-2 xl:items-start xl:gap-8">
      <div className="space-y-5">
      <div
        className={`rounded-xl px-4 py-3 text-sm transition-colors ${
          evaluation.correct ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
        }`}
        role="status"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">
            {evaluation.skipped
              ? 'Revealed'
              : evaluation.overridden
                ? 'Marked as correct (override)'
                : evaluation.correct
                  ? 'Correct!'
                  : 'Not quite'}
          </p>
          {(!evaluation.correct || evaluation.overridden) && onToggleOverride && (
            <button
              type="button"
              onClick={onToggleOverride}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                evaluation.correct
                  ? 'border-emerald-300 bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200/70 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                  : 'border-red-300 bg-white/80 text-red-800 hover:bg-white dark:border-red-700 dark:bg-slate-800 dark:text-red-200'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {evaluation.correct ? 'Undo override' : 'I was right'}
            </button>
          )}
        </div>
        {!evaluation.skipped && (
          <ul className="mt-1 space-y-0.5">
            {evaluation.pinyinOk !== undefined && <Verdict ok={evaluation.pinyinOk} label={`Pinyin: ${answers.pinyin || '—'}`} detail={pinyinDetail} />}
            {evaluation.englishOk !== undefined && <Verdict ok={evaluation.englishOk} label={`Meaning: ${answers.english || '—'}`} />}
            {evaluation.choiceOk !== undefined && (
              <Verdict ok={evaluation.choiceOk} label={`Chose: ${chosen ? `${chosen.hanzi} (${chosen.english[0]})` : '—'}`} />
            )}
            {evaluation.sandhiMatch && (
              <li className="text-slate-700 dark:text-slate-300">
                You matched the spoken tones (3rd-tone sandhi: two 3rd tones in a row → the first is said as 2nd). Dictionary tones: {citationLabel(item)}.
              </li>
            )}
            {evaluation.tones && answers.taps.length > 0 && !evaluation.sandhiMatch && (
              <li className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">Tones:</span>
                {evaluation.tones.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5">
                    <ToneBadge tone={t.given} />
                    {t.given !== t.expected && (
                      <>
                        <span className="text-xs">→</span>
                        <ToneBadge tone={t.expected} />
                      </>
                    )}
                  </span>
                ))}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => speech.speak(item.hanzi, rate)}
          className="group cursor-pointer rounded-2xl p-2 transition hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700/60"
          title="Click to hear pronunciation"
        >
          <HanziText item={item} color={color} className="text-5xl font-medium" />
          <span className="mt-0.5 flex items-center justify-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            🔊 Click to listen
          </span>
        </button>
        <div className="flex items-center gap-3">
          <PinyinText item={item} color={color} className="text-2xl" />
          <AudioButton speech={speech} text={item.hanzi} rate={rate} />
        </div>
        <p className="text-lg text-slate-700 dark:text-slate-200">{item.english.join(' · ')}</p>
        {sandhiTones(tonesOf(item)).some((t, i) => t !== tonesOf(item)[i]) && (
          <p className="text-xs text-slate-500">Spoken with tone sandhi: the first 3rd tone is pronounced as a 2nd tone.</p>
        )}
      </div>
      </div>

      <div className="space-y-5">

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {item.radical && (
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Radical</dt>
            <dd className="mt-0.5">
              <span className="font-hanzi text-2xl">{item.radical}</span>{' '}
              {RADICAL_MEANINGS[item.radical] && <span className="text-slate-500">{RADICAL_MEANINGS[item.radical]}</span>}
            </dd>
          </div>
        )}
        {item.measureWord && (
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Measure word</dt>
            <dd className="mt-0.5">
              <span className="font-hanzi text-2xl">{item.measureWord.hanzi}</span> <FreePinyin text={item.measureWord.pinyin} color={color} />
              <span className="ml-1 font-hanzi text-slate-500">
                一{item.measureWord.hanzi}
                {item.hanzi}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {ex && (
        <div className={`rounded-xl border p-4 ${isLeech ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Example</span>
            <AudioButton speech={speech} text={ex.hanzi} rate={rate} />
          </div>
          <p
            className="font-hanzi text-xl cursor-pointer hover:opacity-80 transition"
            lang="zh-CN"
            onClick={() => speech.speak(ex.hanzi, rate)}
            title="Click to hear example sentence"
          >
            <HighlightedSentence sentence={ex.hanzi} word={item.hanzi} />
          </p>
          <FreePinyin text={ex.pinyin} color={color} className="block text-base" />
          <p className="text-slate-600 dark:text-slate-300">{ex.english}</p>
          {ex.source && (
            <p className="mt-1 text-[11px] text-slate-400">
              Sentence{' '}
              <a href={`https://tatoeba.org/sentences/show/${ex.source}`} target="_blank" rel="noreferrer" className="underline">
                #{ex.source}
              </a>{' '}
              from Tatoeba (CC-BY 2.0 FR) · pinyin auto-generated
            </p>
          )}
          {isLeech && (
            <div className="mt-3 border-t border-amber-200 pt-3 text-sm text-amber-900 dark:border-amber-800 dark:text-amber-200">
              <p className="font-medium">Breakdown</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>
                  <span className="font-hanzi">{item.hanzi}</span> = “{item.english[0]}” — find it highlighted above.
                </li>
                {item.radical && RADICAL_MEANINGS[item.radical] && (
                  <li>
                    Memory hook: the radical <span className="font-hanzi">{item.radical}</span> means “{RADICAL_MEANINGS[item.radical]}”.
                  </li>
                )}
                <li>Say the whole sentence aloud twice with the audio — context sticks better than isolated drilling.</li>
              </ul>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function citationLabel(item: VocabItem): string {
  return tonesOf(item)
    .map((t) => (t === '0' ? 'neutral' : t))
    .join('-');
}

function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  const idx = sentence.indexOf(word);
  if (idx < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, idx)}
      <mark className="rounded bg-rose-100 px-0.5 text-inherit dark:bg-rose-900/60">{word}</mark>
      {sentence.slice(idx + word.length)}
    </>
  );
}
