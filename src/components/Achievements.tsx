import { Lock } from 'lucide-react';
import type { UserState, VocabItem } from '../types';
import { useMemo } from 'react';
import { badgesFor } from '../utils/analytics';

export function Achievements({ state, vocab }: { state: UserState; vocab: VocabItem[] }) {
  const BADGES = useMemo(() => badgesFor(state, vocab), [state, vocab]);
  const unlocked = BADGES.filter((b) => state.unlockedBadges.includes(b.id)).length;
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Achievements</h2>
        <span className="text-sm text-slate-500">
          {unlocked}/{BADGES.length} unlocked
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {BADGES.map((b) => {
          const got = state.unlockedBadges.includes(b.id);
          const p = got ? 1 : b.progress(state, vocab);
          return (
            <article
              key={b.id}
              className={`flex gap-3 rounded-2xl border p-4 ${
                got
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70'
              }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${got ? '' : 'grayscale opacity-50'}`} aria-hidden>
                {b.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-1 font-semibold">
                  {b.title} {!got && <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="locked" />}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{b.description}</p>
                {!got && (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700" title={`${Math.round(p * 100)}%`}>
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${p * 100}%` }} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
