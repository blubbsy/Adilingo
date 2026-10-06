import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, Flag, Volume2 } from 'lucide-react';
import type { CardProgress, DirectionProgress, Grade, SessionCard, Settings, VocabItem } from '../types';
import { checkPinyin, numberedToMarked } from '../utils/pinyinHelper';
import { GRADE_LABELS, nextInterval } from '../utils/srsEngine';
import { levelLabel } from '../data/vocab';
import type { SpeechApi } from '../utils/speech';
import { AudioButton } from './AudioButton';
import { FreePinyin } from './ToneText';
import { playCorrect, playError } from '../utils/sound';

export function formatInterval(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return `${months} mo`;
}

export interface CardResult {
  correct: boolean;
  latencyMs: number;
}

interface Props {
  card: SessionCard;
  vocab: VocabItem[];
  progress?: CardProgress;
  settings: Settings;
  speech: SpeechApi;
  onGrade: (grade: Grade, result: CardResult) => void;
}

/** Random sample of wrong options from the same level. */
function pickDistractors(item: VocabItem, vocab: VocabItem[], n = 3): VocabItem[] {
  const sameLevel = vocab.filter((v) => v.hskLevel === item.hskLevel && v.id !== item.id);
  const pool = sameLevel.length >= n ? sameLevel : vocab.filter((v) => v.id !== item.id);

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function ReviewCard({ card, vocab, progress, settings, speech, onGrade }: Props) {
  const { item, direction, prompt } = card;
  const dirProgress: DirectionProgress | undefined = direction === 'recall' ? progress?.recall : progress?.recognition;

  const [revealed, setRevealed] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [pinyinInput, setPinyinInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const mountTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Play audio automatically for listening drill
  useEffect(() => {
    if (prompt === 'audio') {
      speech.speak(item.hanzi, settings.speechRate);
    }
  }, [prompt, item.hanzi, settings.speechRate, speech]);

  // Distractors & options for multiple-choice modes
  const options = useMemo(() => {
    const distractors = pickDistractors(item, vocab, 3);
    const list = [...distractors, item].sort(() => Math.random() - 0.5);
    return list;
  }, [item, vocab]);

  const correctIndex = useMemo(() => options.findIndex((o) => o.id === item.id), [options, item.id]);

  // Focus typing input
  useEffect(() => {
    if (prompt === 'pinyin' && !revealed) {
      inputRef.current?.focus();
    }
  }, [prompt, revealed]);

  function handleAnswer(choiceIdx: number) {
    if (revealed) return;
    const ok = choiceIdx === correctIndex;
    setSelectedIdx(choiceIdx);
    setIsCorrect(ok);
    setRevealed(true);

    if (settings.soundEffects) {
      if (ok) playCorrect();
      else playError();
    }
  }

  function handlePinyinSubmit(e: FormEvent) {
    e.preventDefault();
    if (revealed) return;
    const check = checkPinyin(pinyinInput, item);
    const ok = check.correct;
    setIsCorrect(ok);
    setRevealed(true);

    if (settings.soundEffects) {
      if (ok) playCorrect();
      else playError();
    }
  }

  function handlePinyinInputChange(raw: string) {
    // Live tone numbers conversion, e.g. hao3 -> hǎo
    const converted = numberedToMarked(raw);
    setPinyinInput(converted);
  }

  function handleRevealWithoutAnswer() {
    if (revealed) return;
    setIsCorrect(false);
    setRevealed(true);
    if (settings.soundEffects) playError();
  }

  function submitGrade(grade: Grade) {
    const latencyMs = Math.max(0, Date.now() - mountTime.current);
    onGrade(grade, {
      correct: Boolean(isCorrect),
      latencyMs,
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') return; // let form handle submit
      }

      if (!revealed) {
        if (prompt === 'hanzi' || prompt === 'english' || prompt === 'audio') {
          if (['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < options.length) {
              handleAnswer(idx);
            }
          }
        }
        if (e.key === ' ' || e.key === 'Enter') {
          if (prompt !== 'pinyin') {
            e.preventDefault();
            handleRevealWithoutAnswer();
          }
        }
      } else {
        // Revealed: 1-4 for grades, or Enter/Space for suggested grade
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          submitGrade(parseInt(e.key, 10) as Grade);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          submitGrade(isCorrect ? 3 : 1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [revealed, isCorrect, prompt, options.length]);

  const suggestedGrade: Grade = isCorrect ? 3 : 1;

  return (
    <div className="mx-auto max-w-2xl">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {levelLabel(item.hskLevel)}
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {direction === 'recall' ? 'Recall (Meaning → Hanzi)' : prompt === 'audio' ? 'Listening' : prompt === 'pinyin' ? 'Pinyin Typing' : 'Recognition'}
            </span>
            {dirProgress?.isLeech && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Leech
              </span>
            )}
          </div>

          <a
            href={`https://github.com/Sibby/Vocubulary/issues/new?title=${encodeURIComponent(`[Vocab Issue] ${item.hanzi} (${item.id})`)}&body=${encodeURIComponent(`### Word Issue\nWord: ${item.hanzi} (${item.pinyin})\nID: ${item.id}\nIssue:\n`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Report an error with this word"
          >
            <Flag className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Report</span>
          </a>
        </div>

        {/* Central Question Prompt */}
        <div className="my-8 text-center">
          {prompt === 'audio' && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => speech.speak(item.hanzi, settings.speechRate)}
                className="flex h-24 w-24 items-center justify-center rounded-3xl bg-rose-500 text-white shadow-xl shadow-rose-500/25 transition active:scale-95 hover:bg-rose-600"
                aria-label="Replay audio"
              >
                <Volume2 className="h-10 w-10 animate-pulse" />
              </button>
              <p className="mt-4 text-sm font-medium text-slate-500">Listen and select the meaning</p>
            </div>
          )}

          {prompt === 'english' && (
            <div className="space-y-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
                {item.english.slice(0, 2).join('; ')}
              </div>
              <p className="text-sm text-slate-500">Select the matching character</p>
            </div>
          )}

          {(prompt === 'hanzi' || prompt === 'pinyin') && (
            <div className="space-y-3">
              <div className="font-hanzi text-6xl font-bold tracking-wide text-slate-900 dark:text-slate-100 sm:text-7xl">
                {item.hanzi}
              </div>
              <div className="flex items-center justify-center gap-2">
                <AudioButton speech={speech} text={item.hanzi} rate={settings.speechRate} />
                <span className="text-sm text-slate-500">
                  {prompt === 'pinyin' ? 'Type the pinyin with tones' : 'What does this mean?'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Multiple Choice Answers */}
        {(prompt === 'hanzi' || prompt === 'english' || prompt === 'audio') && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {options.map((opt, idx) => {
              const label = prompt === 'english' ? opt.hanzi : opt.english.slice(0, 2).join('; ');
              let btnStyle =
                'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-700/50';

              if (revealed) {
                if (idx === correctIndex) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 font-semibold';
                } else if (idx === selectedIdx) {
                  btnStyle = 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200';
                } else {
                  btnStyle = 'opacity-40 border-slate-200 dark:border-slate-700';
                }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={revealed}
                  onClick={() => handleAnswer(idx)}
                  className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-left text-sm transition ${btnStyle}`}
                >
                  <span className={prompt === 'english' ? 'font-hanzi text-lg' : ''}>{label}</span>
                  <kbd className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                    {idx + 1}
                  </kbd>
                </button>
              );
            })}
          </div>
        )}

        {/* Pinyin Typing Input */}
        {prompt === 'pinyin' && !revealed && (
          <form onSubmit={handlePinyinSubmit} className="mt-4 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={pinyinInput}
              onChange={(e) => handlePinyinInputChange(e.target.value)}
              placeholder="e.g. ni3hao3"
              className="w-full rounded-2xl border-2 border-slate-300 px-4 py-3 text-lg font-medium outline-none focus:border-rose-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-6 font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Check
            </button>
          </form>
        )}

        {/* Revealed Details Breakdown */}
        {revealed && (
          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-700/60 animate-fade-in">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-hanzi text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {item.hanzi}
                </span>
                <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                  <FreePinyin text={item.pinyin} color={settings.colorTones} />
                </span>
                <span className="text-sm text-slate-500">
                  {item.english.join('; ')}
                </span>
              </div>

              {item.exampleSentence && (
                <div className="mt-3 border-t border-slate-200/60 pt-3 dark:border-slate-700/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-hanzi text-base text-slate-800 dark:text-slate-200">
                        {item.exampleSentence.hanzi}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <FreePinyin text={item.exampleSentence.pinyin} color={settings.colorTones} />
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.exampleSentence.english}
                      </p>
                    </div>
                    <AudioButton speech={speech} text={item.exampleSentence.hanzi} rate={settings.speechRate} />
                  </div>
                </div>
              )}
            </div>

            {/* FSRS Rating Actions */}
            <div className="mt-6 space-y-3">
              {/* Primary Next Action */}
              <button
                type="button"
                onClick={() => submitGrade(suggestedGrade)}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-base font-bold text-white shadow-lg transition active:scale-[0.99] ${
                  isCorrect
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <span>{isCorrect ? 'Next (Good)' : 'Review Again'}</span>
                <ArrowRight className="h-4 w-4" />
                <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-normal">Space / Enter</kbd>
              </button>

              {/* FSRS 4-grade breakdown preview */}
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as Grade[]).map((g) => {
                  const days = nextInterval(dirProgress, g);
                  const isSuggested = g === suggestedGrade;

                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => submitGrade(g)}
                      className={`flex flex-col items-center rounded-xl border p-2 text-center transition ${
                        isSuggested
                          ? 'border-slate-400 bg-slate-100 font-semibold dark:border-slate-500 dark:bg-slate-700'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-xs font-semibold">{GRADE_LABELS[g]}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{days}d</div>
                      <kbd className="mt-1 text-[10px] text-slate-400">[{g}]</kbd>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!revealed && prompt !== 'pinyin' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleRevealWithoutAnswer}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Don't know? Reveal answer (Space)
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
