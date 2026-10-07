import { useMemo, useRef, useState, useEffect } from 'react';
import { ArrowLeft, Maximize2, Minimize2, RotateCcw, Trophy, Undo2 } from 'lucide-react';
import type { Grade, SessionCard, SessionRequest, UserState, VocabItem } from '../types';
import type { SpeechApi } from '../utils/speech';
import { ReviewCard, type CardResult } from './ReviewCard';
import { HanziText } from './ToneText';
import { playFanfare } from '../utils/sound';

interface Props {
  request: SessionRequest;
  initialCards: SessionCard[];
  vocab: VocabItem[];
  state: UserState;
  speech: SpeechApi;
  onReview: (card: SessionCard, grade: Grade, result: CardResult, learningStep: boolean) => void;
  /** Restores the user state from before the last grade. */
  onUndo: () => void;
  onExit: () => void;
  onRestart: () => void;
}

interface Outcome {
  card: SessionCard;
  grade: Grade;
  correct: boolean;
  latencyMs: number;
}

/** Number of cards before a failed card comes back within the same session. */
const REQUEUE_GAP = 3;

export function StudySession({ request, initialCards, vocab, state, speech, onReview, onUndo, onExit, onRestart }: Props) {
  const [queue, setQueue] = useState<SessionCard[]>(initialCards);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const requeued = useRef(new Set<string>());
  /** Session snapshot before the last grade (one level of undo). */
  const [undo, setUndo] = useState<{ queue: SessionCard[]; index: number; outcomes: Outcome[]; requeued: Set<string> } | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const done = index >= queue.length;
  const current = queue[index];

  function handleGrade(grade: Grade, result: CardResult) {
    const card = queue[index];
    const isCorrect = grade >= 2;
    const finalResult: CardResult = { ...result, correct: isCorrect };
    setUndo({ queue, index, outcomes, requeued: new Set(requeued.current) });
    onReview(card, grade, finalResult, Boolean(card.learningStep));
    setOutcomes((o) => [...o, { card, grade, correct: isCorrect, latencyMs: result.latencyMs }]);
    if (grade === 1 && !requeued.current.has(card.item.id)) {
      // Failed cards come back once later in the session (learning step).
      requeued.current.add(card.item.id);
      setQueue((q) => {
        const next = [...q];
        next.splice(Math.min(next.length, index + 1 + REQUEUE_GAP), 0, { ...card, isNew: false, learningStep: true });
        return next;
      });
    }
    setIndex((i) => i + 1);
  }

  function handleUndo() {
    if (!undo) return;
    onUndo();
    setQueue(undo.queue);
    setIndex(undo.index);
    setOutcomes(undo.outcomes);
    requeued.current = undo.requeued;
    setUndo(null);
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800/70">
        <p className="text-lg font-semibold">Nothing to study here right now.</p>
        <p className="mt-1 text-slate-500">All cards in this selection are scheduled for later, or today's limit is reached.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={onRestart} className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white hover:bg-rose-700 shadow-sm">
            Study 10 cards anyway
          </button>
          <button onClick={onExit} className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl xl:max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onExit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="End session">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="truncate font-medium">{request.label}</span>
            <span className="tabular-nums text-slate-500">
              {Math.min(index + 1, queue.length)} / {queue.length}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
        </div>
        <button
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-1 rounded-lg p-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={isFullscreen ? 'Exit focus mode' : 'Focus mode'}
          title={isFullscreen ? 'Exit focus mode' : 'Focus mode (Fullscreen)'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button
          onClick={handleUndo}
          disabled={!undo}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          aria-label="Undo last grade"
          title="Undo last grade"
        >
          <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Undo</span>
        </button>
      </div>

      {!done && current && (
        <ReviewCard
          key={`${index}-${current.item.id}`}
          card={current}
          vocab={vocab}
          progress={state.progress[current.item.id]}
          settings={state.settings}
          speech={speech}
          onGrade={handleGrade}
        />
      )}

      {done && <Summary outcomes={outcomes} onExit={onExit} onRestart={onRestart} soundEffects={state.settings.soundEffects} />}
    </div>
  );
}

function Summary({
  outcomes,
  onExit,
  onRestart,
  soundEffects = true,
}: {
  outcomes: Outcome[];
  onExit: () => void;
  onRestart: () => void;
  soundEffects?: boolean;
}) {
  useEffect(() => {
    playFanfare(soundEffects);
  }, [soundEffects]);

  const stats = useMemo(() => {
    const correct = outcomes.filter((o) => o.correct).length;
    const avg = outcomes.length ? outcomes.reduce((s, o) => s + o.latencyMs, 0) / outcomes.length / 1000 : 0;
    const missed = [...new Map(outcomes.filter((o) => !o.correct).map((o) => [o.card.item.id, o.card.item])).values()];
    return { correct, total: outcomes.length, pct: outcomes.length ? Math.round((correct / outcomes.length) * 100) : 0, avg, missed };
  }, [outcomes]);

  return (
    <div className="animate-pop rounded-3xl border border-slate-200 bg-white p-6 text-center sm:p-8 dark:border-slate-700 dark:bg-slate-800/70">
      <Trophy className="mx-auto h-10 w-10 text-amber-500" />
      <h2 className="mt-2 text-2xl font-bold">Session complete</h2>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <SummaryStat label="Reviews" value={String(stats.total)} />
        <SummaryStat label="Accuracy" value={`${stats.pct}%`} />
        <SummaryStat label="Avg. time" value={`${stats.avg.toFixed(1)}s`} />
      </div>
      {stats.missed.length > 0 && (
        <div className="mt-6 text-left">
          <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Worth another look</p>
          <ul className="flex flex-wrap gap-2">
            {stats.missed.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-700">
                <HanziText item={item} color={false} className="text-lg" /> <span className="text-slate-500">{item.english[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button onClick={onExit} className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white hover:bg-rose-700">
          Back to dashboard
        </button>
        <button
          onClick={onRestart}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          <RotateCcw className="h-4 w-4" /> Another round
        </button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
