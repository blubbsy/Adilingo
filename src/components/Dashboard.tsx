import { useMemo } from 'react';
import { AlertTriangle, ChevronRight, Ear, Flame, Layers, Music, Sparkles, Target, Timer } from 'lucide-react';
import type { SessionRequest, UserState, VocabItem } from '../types';
import { accuracyByLevel, averageLatencySec, overallAccuracy, recommendations, type Recommendation } from '../utils/analytics';
import { dayKey } from '../utils/dates';
import { effectiveStreak } from '../utils/srsEngine';
import { curriculumInfo, levelLabel } from '../data/vocab';
import { ModeSelector } from './ModeSelector';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
  onNavigate: (view: 'learn' | 'dictionary' | 'insights') => void;
}

const REC_ICON: Record<Recommendation['kind'], typeof Flame> = {
  tone: Music,
  leech: AlertTriangle,
  topic: Target,
  due: Layers,
  listening: Ear,
  new: Sparkles,
  streak: Flame,
};

const panel = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70';

export function Dashboard({ vocab, state, onStart, onNavigate }: Props) {
  const recs = useMemo(() => recommendations(state, vocab), [state, vocab]);
  const levels = useMemo(() => accuracyByLevel(state, vocab), [state, vocab]);
  const streak = effectiveStreak(state);
  const acc = overallAccuracy(state);
  const latency = averageLatencySec(state);
  const today = state.stats.daily[dayKey()]?.reviewed ?? 0;
  const seen = useMemo(() => vocab.filter((v) => state.progress[v.id]).length, [vocab, state.progress]);
  const info = curriculumInfo(state.settings.curriculum);
  const currentLevel = levels.find((l) => l.learned < l.words) ?? levels[levels.length - 1];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:hidden">
          <Tiles streak={streak} best={state.stats.longestStreak} today={today} cap={state.settings.dailyCap} acc={acc.pct} reviews={state.stats.totalReviewed} latency={latency} />
        </section>

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

        <ModeSelector vocab={vocab} state={state} onStart={onStart} />
      </div>

      <aside className="space-y-6">
        <section className="hidden grid-cols-2 gap-3 xl:grid">
          <Tiles streak={streak} best={state.stats.longestStreak} today={today} cap={state.settings.dailyCap} acc={acc.pct} reviews={state.stats.totalReviewed} latency={latency} />
        </section>

        <section className={`${panel} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Syllabus progress</h2>
            <span className="text-xs text-slate-500">{info.short}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {seen.toLocaleString('en')} of {vocab.length.toLocaleString('en')} words started
          </p>
          <ul className="mt-4 space-y-3">
            {levels.map((l) => {
              const pct = l.words ? Math.round((l.learned / l.words) * 100) : 0;
              const isCurrent = l.level === currentLevel?.level;
              return (
                <li key={l.level} title={`${l.learned} of ${l.words} ${levelLabel(l.level)} words learned`}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={isCurrent ? 'font-semibold' : ''}>
                      {levelLabel(l.level)} {isCurrent && <span className="ml-1 rounded bg-rose-100 px-1.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">current</span>}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {l.learned.toLocaleString('en')}/{l.words.toLocaleString('en')}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${levelLabel(l.level)} progress`}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(pct, l.learned ? 1 : 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => onNavigate('learn')} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">
              Open learning paths <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <button onClick={() => onNavigate('dictionary')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">
              Browse words
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Tiles({
  streak,
  best,
  today,
  cap,
  acc,
  reviews,
  latency,
}: {
  streak: number;
  best: number;
  today: number;
  cap: number;
  acc: number | null;
  reviews: number;
  latency: number | null;
}) {
  return (
    <>
      <Tile icon={Flame} label="Day streak" value={String(streak)} sub={`best ${best}`} accent="text-orange-500" highlight={streak > 0} />
      <RadialTile label="Today" value={today} max={cap} sub={`of ${cap} goal`} accent="text-rose-500" />
      <Tile icon={Target} label="Accuracy" value={acc === null ? '—' : `${acc}%`} sub={`${reviews.toLocaleString('en')} reviews`} accent="text-emerald-500" />
      <Tile icon={Timer} label="Avg. answer" value={latency === null ? '—' : `${latency.toFixed(1)}s`} sub="per card" accent="text-sky-500" />
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
        <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
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
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${panel} p-4 transition-colors ${highlight ? 'bg-gradient-to-br from-white to-orange-50/50 dark:from-slate-800/70 dark:to-orange-950/20' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className={`h-4 w-4 ${accent} ${highlight ? 'animate-pulse' : ''}`} aria-hidden /> {label}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}
