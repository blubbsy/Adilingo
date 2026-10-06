import { levelLabel } from '../data/vocab';
import { useMemo } from 'react';
import { ChevronRight, CircleCheck } from 'lucide-react';
import type { GrammarProgress } from './grammarStorage';
import type { GrammarPoint } from './types';
import { HskBadge, PatternFormula, RichText, card, focusRing } from './ui';

export type LevelFilter = 'all' | number;

interface Props {
  points: GrammarPoint[];
  progress: GrammarProgress;
  level: LevelFilter;
  onLevelChange: (l: LevelFilter) => void;
  onOpen: (id: string) => void;
}

export function GrammarList({ points, progress, level, onLevelChange, onOpen }: Props) {
  const levels = useMemo(() => [...new Set(points.map((p) => p.hskLevel))].sort((a, b) => a - b), [points]);
  const shown = level === 'all' ? points : points.filter((p) => p.hskLevel === level);
  const doneCount = shown.filter((p) => progress.points[p.id]?.completed).length;
  const filters: LevelFilter[] = ['all', ...levels];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Filter by HSK level" className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const active = f === level;
            return (
              <button
                key={String(f)}
                type="button"
                aria-pressed={active}
                onClick={() => onLevelChange(f)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${focusRing} ${
                  active
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {f === 'all' ? 'All' : levelLabel(f)}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {doneCount} / {shown.length} completed
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {shown.map((p) => {
          const pr = progress.points[p.id];
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className={`${card} group flex h-full w-full items-start gap-3 p-4 text-left transition hover:border-rose-300 dark:hover:border-rose-800 ${focusRing}`}
              >
                <span
                  lang="zh-CN"
                  className={`flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-xl px-1.5 font-hanzi text-lg ${
                    pr?.completed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                  aria-hidden
                >
                  {(p.titleHanzi ?? '').split(/[\s/…]+/)[0] || '文'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <HskBadge level={p.hskLevel} />
                    {pr?.completed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Completed
                      </span>
                    ) : pr?.bestScore !== undefined ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">Best {Math.round(pr.bestScore * 100)} %</span>
                    ) : (
                      <span className="text-xs text-slate-400">New</span>
                    )}
                  </span>
                  <span className="mt-1 block font-semibold text-slate-900 dark:text-slate-100">
                    <RichText text={p.title} />
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                    <RichText text={p.summary} />
                  </span>
                  <span className="mt-2 block">
                    <PatternFormula pattern={p.pattern} size="sm" />
                  </span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-rose-500" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
