import { useMemo, useState } from 'react';
import { Award, CheckCircle2, Lock, Search, Sparkles, Trophy, X, Zap, Flame, Clock, BookOpen, Brain, Music, GraduationCap, Layers } from 'lucide-react';
import type { UserState, VocabItem } from '../types';
import {
  badgesFor,
  CATEGORY_LABELS,
  TIER_POINTS,
  type BadgeCategory,
  type BadgeTier,
} from '../utils/analytics';

const TIER_ORDER: BadgeTier[] = ['bronze', 'silver', 'gold', 'diamond', 'legendary'];

const TIER_STYLES: Record<BadgeTier, { pill: string; cardBorder: string; dot: string; label: string }> = {
  bronze: {
    pill: 'bg-amber-100/90 text-amber-800 border-amber-300/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80',
    cardBorder: 'border-amber-200 dark:border-amber-900/50',
    dot: 'bg-amber-500',
    label: 'Bronze',
  },
  silver: {
    pill: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    cardBorder: 'border-slate-200 dark:border-slate-700/60',
    dot: 'bg-slate-400',
    label: 'Silver',
  },
  gold: {
    pill: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-700/80',
    cardBorder: 'border-yellow-300 dark:border-yellow-800/60',
    dot: 'bg-yellow-500',
    label: 'Gold',
  },
  diamond: {
    pill: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-700/80',
    cardBorder: 'border-cyan-300 dark:border-cyan-800/60',
    dot: 'bg-cyan-400',
    label: 'Diamond',
  },
  legendary: {
    pill: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700/80',
    cardBorder: 'border-purple-300 dark:border-purple-800/60',
    dot: 'bg-purple-500',
    label: 'Legendary',
  },
};

const CATEGORY_ICONS: Record<BadgeCategory, React.ComponentType<{ className?: string }>> = {
  streaks: Flame,
  reviews: Clock,
  words: BookOpen,
  memory: Brain,
  tones: Music,
  grammar: GraduationCap,
  levels: Layers,
  special: Sparkles,
};

function getScholarRank(points: number): { title: string; nextThreshold: number | null } {
  if (points < 250) return { title: 'Novice Scholar', nextThreshold: 250 };
  if (points < 750) return { title: 'Diligent Apprentice', nextThreshold: 750 };
  if (points < 1500) return { title: 'Adept Linguist', nextThreshold: 1500 };
  if (points < 3000) return { title: 'Senior Scholar', nextThreshold: 3000 };
  if (points < 5000) return { title: 'Master Sinologist', nextThreshold: 5000 };
  return { title: 'Grandmaster of Mandarin', nextThreshold: null };
}

export function Achievements({ state, vocab }: { state: UserState; vocab: VocabItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | 'all'>('all');
  const [selectedTier, setSelectedTier] = useState<BadgeTier | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'in_progress' | 'locked'>('all');
  const [search, setSearch] = useState('');

  const allCurriculumBadges = useMemo(() => badgesFor(state, vocab), [state, vocab]);

  // Precompute badge status and progress map
  const badgeData = useMemo(() => {
    return allCurriculumBadges.map((badge) => {
      const isUnlocked = state.unlockedBadges.includes(badge.id);
      const rawProgress = isUnlocked ? 1 : badge.progress(state, vocab);
      const clampedProgress = Math.min(1, Math.max(0, rawProgress));
      const metricCurrent = badge.metric ? badge.metric.current(state, vocab) : null;
      return {
        badge,
        isUnlocked,
        progress: clampedProgress,
        metricCurrent,
      };
    });
  }, [allCurriculumBadges, state, vocab]);

  // Overall points & unlocks summary
  const summary = useMemo(() => {
    let totalPoints = 0;
    let earnedPoints = 0;
    let unlockedCount = 0;

    const tierCount: Record<BadgeTier, { unlocked: number; total: number }> = {
      bronze: { unlocked: 0, total: 0 },
      silver: { unlocked: 0, total: 0 },
      gold: { unlocked: 0, total: 0 },
      diamond: { unlocked: 0, total: 0 },
      legendary: { unlocked: 0, total: 0 },
    };

    const categoryCount: Record<BadgeCategory, { unlocked: number; total: number }> = {
      streaks: { unlocked: 0, total: 0 },
      reviews: { unlocked: 0, total: 0 },
      words: { unlocked: 0, total: 0 },
      memory: { unlocked: 0, total: 0 },
      tones: { unlocked: 0, total: 0 },
      grammar: { unlocked: 0, total: 0 },
      levels: { unlocked: 0, total: 0 },
      special: { unlocked: 0, total: 0 },
    };

    for (const item of badgeData) {
      const pts = TIER_POINTS[item.badge.tier];
      totalPoints += pts;
      tierCount[item.badge.tier].total += 1;
      categoryCount[item.badge.category].total += 1;

      if (item.isUnlocked) {
        earnedPoints += pts;
        unlockedCount += 1;
        tierCount[item.badge.tier].unlocked += 1;
        categoryCount[item.badge.category].unlocked += 1;
      }
    }

    return {
      totalPoints,
      earnedPoints,
      unlockedCount,
      totalCount: badgeData.length,
      tierCount,
      categoryCount,
    };
  }, [badgeData]);

  const rank = useMemo(() => getScholarRank(summary.earnedPoints), [summary.earnedPoints]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return badgeData.filter(({ badge, isUnlocked, progress }) => {
      // Category filter
      if (selectedCategory !== 'all' && badge.category !== selectedCategory) return false;

      // Tier filter
      if (selectedTier !== 'all' && badge.tier !== selectedTier) return false;

      // Status filter
      if (statusFilter === 'unlocked' && !isUnlocked) return false;
      if (statusFilter === 'locked' && (isUnlocked || progress > 0)) return false;
      if (statusFilter === 'in_progress' && (isUnlocked || progress <= 0)) return false;

      // Search query filter
      if (q) {
        const catLabel = CATEGORY_LABELS[badge.category].toLowerCase();
        const matchTitle = badge.title.toLowerCase().includes(q);
        const matchDesc = badge.description.toLowerCase().includes(q);
        const matchCat = catLabel.includes(q);
        const matchTier = badge.tier.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat && !matchTier) return false;
      }

      return true;
    });
  }, [badgeData, selectedCategory, selectedTier, statusFilter, search]);

  const completionPct = summary.totalCount > 0 ? Math.round((summary.unlockedCount / summary.totalCount) * 100) : 0;
  const pointsPct = summary.totalPoints > 0 ? Math.round((summary.earnedPoints / summary.totalPoints) * 100) : 0;

  return (
    <section className="space-y-6 pb-12">
      {/* Hero Overview Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-purple-500/10 p-6 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-rose-950/20 dark:to-purple-950/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Trophy className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Achievements & Milestones</h1>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {rank.title} · {summary.earnedPoints.toLocaleString()} XP
                </p>
              </div>
            </div>
            <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
              Track your journey from first characters to legendary fluency. Unlock badges across daily streaks, vocabulary volume, deep SRS stability, and auditory tone drills.
            </p>
          </div>

          {/* XP & Progress Card */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:gap-6">
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Total Badges</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {summary.unlockedCount} / {summary.totalCount} ({completionPct}%)
                </span>
              </div>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Achievement XP</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {summary.earnedPoints.toLocaleString()} / {summary.totalPoints.toLocaleString()} XP
                </span>
              </div>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 transition-all duration-500"
                  style={{ width: `${pointsPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tier Milestones Quick Filter Pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-4 dark:border-slate-800/80">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Tiers:</span>
          <button
            onClick={() => setSelectedTier('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              selectedTier === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'bg-white/70 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            All Tiers ({summary.totalCount})
          </button>
          {TIER_ORDER.map((tier) => {
            const count = summary.tierCount[tier];
            const active = selectedTier === tier;
            const style = TIER_STYLES[tier];
            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(active ? 'all' : tier)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : `${style.pill} hover:opacity-90`
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {style.label} (+{TIER_POINTS[tier]})
                <span className="opacity-75">
                  {count.unlocked}/{count.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="space-y-4">
        {/* Search bar & status filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search badges, goals, categories, tiers..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60">
            {(
              [
                { id: 'all', label: 'All Status' },
                { id: 'unlocked', label: 'Unlocked' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'locked', label: 'Locked' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === st.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              selectedCategory === 'all'
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            All Categories ({summary.totalCount})
          </button>
          {(Object.keys(CATEGORY_LABELS) as BadgeCategory[]).map((cat) => {
            const count = summary.categoryCount[cat];
            const active = selectedCategory === cat;
            const Icon = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {CATEGORY_LABELS[cat]}
                <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                  active
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {count.unlocked}/{count.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Badges Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Award className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
          <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-200">No achievements found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try adjusting your search query, tier filter, or category selection.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
              setSelectedTier('all');
              setStatusFilter('all');
            }}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(({ badge, isUnlocked, progress, metricCurrent }) => {
            const tierStyle = TIER_STYLES[badge.tier];
            const pct = Math.round(progress * 100);

            return (
              <article
                key={badge.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                  isUnlocked
                    ? `bg-white dark:bg-slate-800/90 shadow-sm ${tierStyle.cardBorder} hover:shadow-md ring-1 ring-amber-400/20 dark:ring-amber-400/10`
                    : 'border-slate-200/80 bg-white/60 dark:border-slate-800 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header: Emoji, Tier Tag & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-transform ${
                        isUnlocked
                          ? 'bg-amber-500/10 dark:bg-amber-400/10 shadow-inner'
                          : 'bg-slate-100 dark:bg-slate-800 grayscale opacity-45'
                      }`}
                      aria-hidden
                    >
                      {badge.emoji}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tierStyle.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tierStyle.dot}`} />
                        {tierStyle.label} · +{TIER_POINTS[badge.tier]}
                      </span>

                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          <Lock className="h-3 w-3" aria-hidden />
                          {pct > 0 ? `${pct}%` : 'Locked'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-[15px] leading-snug text-slate-900 dark:text-white">
                      {badge.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar and details */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-400 dark:text-slate-500">
                      {CATEGORY_LABELS[badge.category]}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {badge.metric && metricCurrent !== null ? (
                        `${Math.min(metricCurrent, badge.metric.target).toLocaleString()} / ${badge.metric.target.toLocaleString()} ${badge.metric.unit}`
                      ) : (
                        `${pct}%`
                      )}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/80">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isUnlocked
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : progress > 0
                          ? 'bg-amber-500 dark:bg-amber-400'
                          : 'bg-transparent'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
