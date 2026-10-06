import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCheck,
  ChevronRight,
  Flame,
  Layers,
  Music,
  Play,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Volume2,
} from 'lucide-react';
import type { HskLevel, SessionRequest, UserState, VocabItem } from '../types';
import { accuracyByLevel, averageLatencySec, calculateTrueRetention, recommendations, type Recommendation } from '../utils/analytics';
import { dayKey } from '../utils/dates';
import { bulkMarkLevelKnown, effectiveStreak, isWordStudied, queueSummary } from '../utils/srsEngine';
import { curriculumInfo, levelLabel } from '../data/vocab';
import { ModeSelector } from './ModeSelector';
import { PlacementTestModal } from './PlacementTestModal';
import { BulkMarkModal } from './BulkMarkModal';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
  onNavigate: (view: 'learn' | 'dictionary' | 'insights') => void;
  onUpdateState: (newState: UserState) => void;
}

const REC_ICON: Record<Recommendation['kind'], typeof Flame> = {
  tone: Music,
  leech: AlertTriangle,
  topic: Target,
  due: Layers,
  listening: Volume2,
  new: Sparkles,
  streak: Flame,
};

const panel = 'rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70';

export function Dashboard({ vocab, state, onStart, onNavigate, onUpdateState }: Props) {
  const [showPlacementTest, setShowPlacementTest] = useState(false);
  const [showBulkMark, setShowBulkMark] = useState(false);
  const [showCustomPractice, setShowCustomPractice] = useState(false);

  const recs = useMemo(() => recommendations(state, vocab), [state, vocab]);
  const levels = useMemo(() => accuracyByLevel(state, vocab), [state, vocab]);
  const streak = effectiveStreak(state);
  const latency = averageLatencySec(state);
  const today = state.stats.daily[dayKey()]?.reviewed ?? 0;
  const seen = useMemo(() => vocab.filter((v) => isWordStudied(state.progress[v.id])).length, [vocab, state.progress]);
  const info = curriculumInfo(state.settings.curriculum);
  const currentLevel = levels.find((l) => l.learned < l.words) ?? levels[levels.length - 1];

  const summary = useMemo(() => queueSummary(vocab, state), [vocab, state]);
  const trueRet = useMemo(() => calculateTrueRetention(state), [state]);

  const activeDailyCount = Math.min(summary.dueCount + summary.newAvailable, summary.remainingToday);

  function handleStartDailySession() {
    if (activeDailyCount > 0) {
      onStart({
        label: "Today's Session",
        mode: 'mixed',
        levels: [],
        topics: [],
        limit: activeDailyCount,
      });
    } else {
      // Extra practice
      onStart({
        label: 'Extra Practice',
        mode: 'mixed',
        levels: [],
        topics: [],
        includeNotDue: true,
        ignoreCap: true,
        limit: 10,
      });
    }
  }

  function handlePlacementComplete(estimatedLevel: HskLevel, markLevelsKnown: HskLevel[]) {
    let nextState: UserState = {
      ...state,
      placementResult: {
        estimatedLevel,
        date: new Date().toISOString(),
        score: 12,
        total: 15,
      },
    };
    for (const lvl of markLevelsKnown) {
      nextState = bulkMarkLevelKnown(nextState, vocab, lvl, true);
    }
    onUpdateState(nextState);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {/* Metric tiles on mobile */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:hidden">
          <Tiles
            streak={streak}
            best={state.stats.longestStreak}
            today={today}
            cap={state.settings.dailyCap}
            trueRetentionRate={trueRet.rate}
            matureTotal={trueRet.matureTotal}
            latency={latency}
          />
        </section>

        {/* HERO: One Main Action - Today's Daily Plan */}
        <section className={`${panel} relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-white via-white to-rose-50/40 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/20 shadow-sm`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <Sparkles className="h-3.5 w-3.5" /> FSRS Daily Schedule
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {activeDailyCount > 0 ? (
                  <>
                    <span className="text-rose-600 dark:text-rose-400">{summary.dueCount}</span> reviews +{' '}
                    <span className="text-slate-900 dark:text-slate-100">{summary.newAvailable}</span> new
                  </>
                ) : (
                  'All caught up for today!'
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeDailyCount > 0
                  ? `Estimated time: about ${summary.estimatedMinutes} min (${summary.reviewedToday}/${state.settings.dailyCap} reviewed today)`
                  : 'Great job! Memory consolidates during rest. You can still do extra practice below.'}
              </p>
            </div>

            <button
              onClick={handleStartDailySession}
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-7 py-4 text-lg font-bold text-white shadow-xl shadow-rose-600/25 transition active:scale-[0.98] hover:bg-rose-700"
            >
              <Play className="h-5 w-5 fill-current" />
              {activeDailyCount > 0 ? "Start today's session" : 'Extra practice (10)'}
            </button>
          </div>

          {/* Quick onboarding & level shortcuts */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setShowPlacementTest(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            >
              <Award className="h-4 w-4 text-amber-500" />
              Take placement test
            </button>

            <button
              onClick={() => setShowBulkMark(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            >
              <CheckCheck className="h-4 w-4 text-emerald-500" />
              I already know this (mark levels)
            </button>

            <button
              onClick={() => setShowCustomPractice((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 ml-auto"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              {showCustomPractice ? 'Hide custom practice' : 'Custom practice (modes & levels)'}
            </button>
          </div>
        </section>

        {/* Collapsible Custom Practice Panel */}
        {showCustomPractice && (
          <section className="animate-fade-in">
            <ModeSelector vocab={vocab} state={state} onStart={onStart} />
          </section>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Recommended for you</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recs.slice(0, 4).map((r) => {
                const Icon = REC_ICON[r.kind];
                return (
                  <article key={r.id} className={`${panel} flex gap-3 p-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{r.title}</h3>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{r.body}</p>
                      {r.action && (
                        <button
                          onClick={() => onStart(r.action!.request)}
                          className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                        >
                          {r.action.label}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sidebar on desktop */}
      <aside className="space-y-6">
        <section className="hidden grid-cols-2 gap-3 xl:grid">
          <Tiles
            streak={streak}
            best={state.stats.longestStreak}
            today={today}
            cap={state.settings.dailyCap}
            trueRetentionRate={trueRet.rate}
            matureTotal={trueRet.matureTotal}
            latency={latency}
          />
        </section>

        <section className={`${panel} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Syllabus progress</h2>
            <span className="text-xs text-slate-500">{info.short}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {seen.toLocaleString('en')} of {vocab.length.toLocaleString('en')} words learned or started
          </p>

          <ul className="mt-4 space-y-3">
            {levels.map((l) => {
              const pct = l.words ? Math.round((l.learned / l.words) * 100) : 0;
              const isCurrent = l.level === currentLevel?.level;
              return (
                <li key={l.level} title={`${l.learned} of ${l.words} ${levelLabel(l.level)} words learned`}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={isCurrent ? 'font-semibold' : ''}>
                      {levelLabel(l.level)}{' '}
                      {isCurrent && (
                        <span className="ml-1 rounded bg-rose-100 px-1.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">
                          current
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-slate-500 text-xs">
                      {l.learned.toLocaleString('en')}/{l.words.toLocaleString('en')}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${levelLabel(l.level)} progress`}
                  >
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(pct, l.learned ? 1 : 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('learn')}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Learning paths <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              onClick={() => setShowBulkMark(true)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              Bulk mark levels
            </button>
          </div>
        </section>
      </aside>

      {/* Modals */}
      <PlacementTestModal
        vocab={vocab}
        isOpen={showPlacementTest}
        onClose={() => setShowPlacementTest(false)}
        onComplete={handlePlacementComplete}
      />

      <BulkMarkModal
        vocab={vocab}
        state={state}
        isOpen={showBulkMark}
        onClose={() => setShowBulkMark(false)}
        onUpdateState={onUpdateState}
      />
    </div>
  );
}

function Tiles({
  streak,
  best,
  today,
  cap,
  trueRetentionRate,
  matureTotal,
  latency,
}: {
  streak: number;
  best: number;
  today: number;
  cap: number;
  trueRetentionRate: number | null;
  matureTotal: number;
  latency: number | null;
}) {
  return (
    <>
      <Tile icon={Flame} label="Streak" value={String(streak)} sub={`best ${best}d`} accent="text-orange-500" highlight={streak > 0} />
      <RadialTile label="Today" value={today} max={cap} sub={`of ${cap} goal`} accent="text-rose-500" />
      <Tile
        icon={Target}
        label="True Retention"
        value={trueRetentionRate === null ? '—' : `${trueRetentionRate}%`}
        sub={matureTotal > 0 ? `${matureTotal} mature cards` : 'needs ≥21d cards'}
        accent="text-emerald-500"
        title="Accuracy on mature cards (scheduled interval ≥ 21 days)"
      />
      <Tile icon={Timer} label="Speed" value={latency === null ? '—' : `${latency.toFixed(1)}s`} sub="per card" accent="text-sky-500" />
    </>
  );
}

function RadialTile({
  label,
  value,
  max,
  sub,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  sub: string;
  accent: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const radius = 17;
  const stroke = 3.5;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className={`${panel} flex items-center justify-between p-4`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Layers className={`h-4 w-4 ${accent}`} aria-hidden /> {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500">{sub}</div>
      </div>
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <svg className="h-12 w-12 -rotate-90 transform" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} className="stroke-slate-100 dark:stroke-slate-700" strokeWidth={stroke} fill="transparent" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-rose-500 transition-all duration-700 ease-out"
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{pct}%</span>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  highlight,
  title,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  accent: string;
  highlight?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`${panel} p-4 transition-colors ${
        highlight ? 'bg-gradient-to-br from-white to-orange-50/50 dark:from-slate-800/70 dark:to-orange-950/20' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className={`h-4 w-4 ${accent} ${highlight ? 'animate-pulse' : ''}`} aria-hidden /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}
