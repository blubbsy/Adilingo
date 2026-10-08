import type { HskLevel, SessionRequest, ToneKey, UserState, VocabItem } from '../types';
import { addDays, dayKey } from './dates';
import { tonesOf } from './pinyinHelper';
import { calculateTrueRetention, effectiveStreak, isDue, isWordLearned, isWordStudied, itemHasTone, weakness, MATURE_STABILITY_DAYS } from './srsEngine';
import { levelLabel } from '../data/vocab';

export const TONE_KEYS: ToneKey[] = ['1', '2', '3', '4', '0'];
export const TONE_NAMES: Record<ToneKey, string> = {
  '1': 'Tone 1',
  '2': 'Tone 2',
  '3': 'Tone 3',
  '4': 'Tone 4',
  '0': 'Neutral',
};

export interface Ratio {
  correct: number;
  total: number;
  pct: number | null;
}

const ratio = (correct: number, total: number): Ratio => ({
  correct,
  total,
  pct: total > 0 ? Math.round((correct / total) * 100) : null,
});

function tally(state: UserState, items: VocabItem[]): Ratio {
  let c = 0;
  let t = 0;
  for (const item of items) {
    const wp = state.progress[item.id];
    if (!wp) continue;
    for (const dp of [wp.recognition, wp.recall]) {
      if (!dp) continue;
      for (const h of dp.history) {
        t += 1;
        if (h.correct ?? h.grade >= 2) c += 1;
      }
    }
  }
  return ratio(c, t);
}

export function overallAccuracy(state: UserState): Ratio {
  return ratio(state.stats.totalCorrect, state.stats.totalReviewed);
}

export { calculateTrueRetention };

export function accuracyByLevel(state: UserState, vocab: VocabItem[]): { level: HskLevel; ratio: Ratio; words: number; learned: number }[] {
  const levels = [...new Set(vocab.map((v) => v.hskLevel))].sort((a, b) => a - b);
  return levels.map((level) => {
    const items = vocab.filter((v) => v.hskLevel === level);
    return { level, ratio: tally(state, items), words: items.length, learned: items.filter((i) => isLearned(state, i)).length };
  });
}

export function accuracyByTopic(state: UserState, vocab: VocabItem[]): { topic: string; ratio: Ratio }[] {
  return allTopics(vocab).map((topic) => ({ topic, ratio: tally(state, vocab.filter((v) => v.topics.includes(topic))) }));
}

export function toneAccuracyList(state: UserState): { tone: ToneKey; ratio: Ratio }[] {
  return TONE_KEYS.map((tone) => ({
    tone,
    ratio: ratio(state.stats.toneAccuracy[tone].correct, state.stats.toneAccuracy[tone].total),
  }));
}

export function allTopics(vocab: VocabItem[]): string[] {
  return [...new Set(vocab.flatMap((v) => v.topics))];
}

/** "Learned" = reviewed and consolidated or marked known. */
export function isLearned(state: UserState, item: VocabItem): boolean {
  return isWordLearned(state.progress[item.id]);
}

export function averageLatencySec(state: UserState): number | null {
  const { totalLatencyMs, latencySamples } = state.stats;
  return latencySamples ? totalLatencyMs / latencySamples / 1000 : null;
}

export function leeches(state: UserState, vocab: VocabItem[]): VocabItem[] {
  return vocab.filter((v) => {
    const wp = state.progress[v.id];
    return Boolean(wp?.recognition?.isLeech || wp?.recall?.isLeech);
  });
}

export function frequentFailures(state: UserState, vocab: VocabItem[], n = 8): VocabItem[] {
  return vocab
    .filter((v) => {
      const wp = state.progress[v.id];
      return (wp?.recognition?.failureCount ?? 0) > 0 || (wp?.recall?.failureCount ?? 0) > 0;
    })
    .sort((a, b) => weakness(state.progress[b.id]) - weakness(state.progress[a.id]))
    .slice(0, n);
}

export function activity(state: UserState, days = 14, now = new Date()): { day: string; reviewed: number; correct: number }[] {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(addDays(now, -i));
    const log = state.stats.daily[day];
    out.push({ day, reviewed: log?.reviewed ?? 0, correct: log?.correct ?? 0 });
  }
  return out;
}

// ---------- Recommendations ----------

export interface Recommendation {
  id: string;
  kind: 'tone' | 'leech' | 'topic' | 'due' | 'listening' | 'new' | 'streak';
  title: string;
  body: string;
  action?: { label: string; request: SessionRequest };
}

export function recommendations(state: UserState, vocab: VocabItem[], now = new Date()): Recommendation[] {
  const recs: Recommendation[] = [];
  const studied = vocab.filter((v) => isWordStudied(state.progress[v.id]));

  // 1. Weakest tone with enough data → targeted tone drill in the group where most misses happen.
  const weakTone = toneAccuracyList(state)
    .filter((t) => t.ratio.total >= 5 && (t.ratio.pct ?? 100) < 75)
    .sort((a, b) => (a.ratio.pct ?? 0) - (b.ratio.pct ?? 0))[0];
  if (weakTone) {
    const withTone = studied.filter((v) => itemHasTone(v, weakTone.tone));
    const groups = new Map<string, { level: HskLevel; topic: string; misses: number; ids: string[] }>();
    for (const v of withTone) {
      const wp = state.progress[v.id];
      const hist = [...(wp?.recognition?.history ?? []), ...(wp?.recall?.history ?? [])];
      const misses = hist.filter((h) => h.correct === false).length;
      for (const topic of v.topics) {
        const key = `${v.hskLevel}|${topic}`;
        const g = groups.get(key) ?? { level: v.hskLevel, topic, misses: 0, ids: [] };
        g.misses += misses;
        g.ids.push(v.id);
        groups.set(key, g);
      }
    }
    const worst = [...groups.values()].sort((a, b) => b.misses - a.misses || b.ids.length - a.ids.length)[0];
    if (worst) {
      recs.push({
        id: 'tone',
        kind: 'tone',
        title: `${TONE_NAMES[weakTone.tone]} needs attention`,
        body: `Your ${TONE_NAMES[weakTone.tone]} accuracy is ${weakTone.ratio.pct}%, with most misses in ${levelLabel(worst.level)} ${worst.topic} words. Start a 3-minute targeted review?`,
        action: {
          label: '3-min tone drill',
          request: {
            label: `${TONE_NAMES[weakTone.tone]} · ${levelLabel(worst.level)} ${worst.topic}`,
            mode: 'tone',
            levels: [],
            topics: [],
            wordIds: withTone.filter((v) => v.hskLevel === worst.level && v.topics.includes(worst.topic)).map((v) => v.id),
            includeNotDue: true,
            ignoreCap: true,
            limit: 10,
          },
        },
      });
    }
  }

  // 2. Leeches.
  const leechList = leeches(state, vocab);
  if (leechList.length) {
    recs.push({
      id: 'leech',
      kind: 'leech',
      title: `${leechList.length} leech${leechList.length > 1 ? 'es' : ''} detected`,
      body: `${leechList.map((l) => l.hanzi).join('、')} keep slipping away. Review them slowly with example sentences.`,
      action: {
        label: 'Leech clinic',
        request: { label: 'Leech clinic', mode: 'hanzi', levels: [], topics: [], wordIds: leechList.map((l) => l.id), includeNotDue: true, ignoreCap: true, limit: 10 },
      },
    });
  }

  // 3. Weakest topic.
  const weakTopic = accuracyByTopic(state, vocab)
    .filter((t) => t.ratio.total >= 6 && (t.ratio.pct ?? 100) < 80)
    .sort((a, b) => (a.ratio.pct ?? 0) - (b.ratio.pct ?? 0))[0];
  if (weakTopic) {
    recs.push({
      id: 'topic',
      kind: 'topic',
      title: `Shore up “${weakTopic.topic}”`,
      body: `Only ${weakTopic.ratio.pct}% correct across ${weakTopic.ratio.total} ${weakTopic.topic} reviews — your lowest topic.`,
      action: {
        label: 'Review topic',
        request: { label: weakTopic.topic, mode: 'mixed', levels: [], topics: [weakTopic.topic], includeNotDue: true, ignoreCap: true, limit: 12 },
      },
    });
  }

  // 4. Due cards.
  const due = vocab.filter((v) => isDue(state.progress[v.id], now)).length;
  const capLeft = state.settings.dailyCap - (state.stats.daily[dayKey(now)]?.reviewed ?? 0);
  if (due > 0 && capLeft > 0) {
    recs.push({
      id: 'due',
      kind: 'due',
      title: `${due} card${due > 1 ? 's' : ''} due`,
      body: 'Clearing due reviews first gives spaced repetition the biggest payoff.',
      action: {
        label: 'Review now',
        request: { label: 'Due reviews', mode: state.settings.defaultMode, levels: [], topics: [] },
      },
    });
  }

  // 5. Listening practice is under-used.
  if (state.stats.totalReviewed >= 20 && state.stats.modeCounts.audio < state.stats.totalReviewed * 0.15) {
    recs.push({
      id: 'listening',
      kind: 'listening',
      title: 'Train your ear',
      body: `Only ${state.stats.modeCounts.audio} of your ${state.stats.totalReviewed} reviews were listening drills. Recognising words by sound is key for conversation.`,
      action: {
        label: 'Listening drill',
        request: { label: 'Listening drill', mode: 'audio', levels: [], topics: [], includeNotDue: true, ignoreCap: true, limit: 10 },
      },
    });
  }

  // 6. Unstarted words / Daily intake.
  const unseen = vocab.filter((v) => !isWordStudied(state.progress[v.id]));
  if (unseen.length && capLeft > 0) {
    const level = Math.min(...unseen.map((u) => u.hskLevel));
    const intake = Math.min(state.settings.newCardsPerDay, unseen.length);
    recs.push({
      id: 'new',
      kind: 'new',
      title: `Daily intake: ${intake} new words`,
      body: `Ready for your next set of ${levelLabel(level)} vocabulary (${unseen.slice(0, 3).map((u) => u.hanzi).join('、')}).`,
      action: {
        label: `Learn ${intake} new words`,
        request: { label: `New ${levelLabel(level)} words`, mode: 'hanzi', levels: [level as HskLevel], topics: [], limit: intake },
      },
    });
  }

  // 7. Streak at risk.
  const streak = effectiveStreak(state, now);
  if (streak > 0 && state.stats.lastActiveDate !== dayKey(now)) {
    recs.push({
      id: 'streak',
      kind: 'streak',
      title: `Keep your ${streak}-day streak alive`,
      body: 'One short review today keeps the flame burning.',
    });
  }

  return recs;
}

// ---------- Achievements ----------

export type BadgeCategory = 'streaks' | 'reviews' | 'words' | 'memory' | 'tones' | 'grammar' | 'levels' | 'special';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';

export const TIER_POINTS: Record<BadgeTier, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  diamond: 100,
  legendary: 250,
};

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  streaks: 'Streaks & Consistency',
  reviews: 'Reviews & Endurance',
  words: 'Vocabulary Volume',
  memory: 'Deep Memory (SRS)',
  tones: 'Tones & Audio',
  grammar: 'Grammar & Paths',
  levels: 'HSK Levels',
  special: 'Special Feats',
};

export interface BadgeMetric {
  current: (state: UserState, vocab: VocabItem[]) => number;
  target: number;
  unit: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  tier: BadgeTier;
  /** Level badges only apply when the curriculum has that level. */
  level?: HskLevel;
  metric?: BadgeMetric;
  /** progress toward the goal, 0..1 */
  progress: (state: UserState, vocab: VocabItem[]) => number;
}

const frac = (n: number, goal: number) => (goal <= 0 ? 1 : Math.min(1, Math.max(0, n / goal)));

const countLearnedWords = (state: UserState) =>
  Object.values(state.progress ?? {}).filter((p) => isWordLearned(p)).length;

const countMatureCards = (state: UserState) =>
  Object.values(state.progress ?? {}).reduce(
    (sum, p) =>
      sum +
      (p?.recognition && p.recognition.stability >= MATURE_STABILITY_DAYS ? 1 : 0) +
      (p?.recall && p.recall.stability >= MATURE_STABILITY_DAYS ? 1 : 0),
    0,
  );

const countDualDirectionLearned = (state: UserState) =>
  Object.values(state.progress ?? {}).filter(
    (p) =>
      Boolean(
        p &&
          (p.manuallyMarkedKnown ||
            (p.recognition &&
              p.recognition.stability >= MATURE_STABILITY_DAYS &&
              p.recall &&
              p.recall.stability >= MATURE_STABILITY_DAYS)),
      ),
  ).length;

const countCuredLeeches = (state: UserState) =>
  Object.values(state.progress ?? {}).filter((p) => Boolean(p?.recognition?.curedLeech || p?.recall?.curedLeech)).length;

const countActiveDays = (state: UserState) =>
  Object.values(state.stats?.daily ?? {}).filter((d) => (d?.reviewed ?? 0) > 0).length;

const maxDailyReviews = (state: UserState) =>
  Math.max(0, ...Object.values(state.stats?.daily ?? {}).map((d) => d?.reviewed ?? 0));

const countFlawlessDays = (state: UserState) =>
  Object.values(state.stats?.daily ?? {}).filter((d) => (d?.reviewed ?? 0) >= 15 && d.correct === d.reviewed).length;

function getStoredGrammarStats(): { completedPoints: number; completedPathSteps: number } {
  try {
    if (typeof localStorage === 'undefined') return { completedPoints: 0, completedPathSteps: 0 };
    const raw = localStorage.getItem('hanzi-flow:grammar-progress') || localStorage.getItem('adilingo:grammar-progress');
    if (!raw) return { completedPoints: 0, completedPathSteps: 0 };
    const parsed = JSON.parse(raw);
    const points = parsed?.points ?? {};
    const paths = parsed?.paths ?? {};
    const completedPoints = Object.values(points).filter((p: unknown) => (p as { completed?: boolean })?.completed === true).length;
    const completedPathSteps = Object.values(paths).reduce(
      (sum: number, p: unknown) => sum + (Array.isArray((p as { completedSteps?: string[] })?.completedSteps) ? (p as { completedSteps: string[] }).completedSteps.length : 0),
      0,
    );
    return { completedPoints, completedPathSteps };
  } catch {
    return { completedPoints: 0, completedPathSteps: 0 };
  }
}

const levelLearned = (state: UserState, vocab: VocabItem[], level: HskLevel) => {
  const items = vocab.filter((v) => v.hskLevel === level);
  return items.length ? items.filter((i) => isLearned(state, i)).length / items.length : 0;
};

const duoLevelLearned = (state: UserState, vocab: VocabItem[], levels: HskLevel[]) => {
  const items = vocab.filter((v) => levels.includes(v.hskLevel));
  return items.length ? items.filter((i) => isLearned(state, i)).length / items.length : 0;
};

export const BADGES: Badge[] = [
  // ==========================================
  // 1. STREAKS & CONSISTENCY
  // ==========================================
  {
    id: 'streak-3',
    title: '3-Day Streak',
    description: 'Study three days in a row.',
    emoji: '🔥',
    category: 'streaks',
    tier: 'bronze',
    metric: { current: (s) => s.stats.longestStreak, target: 3, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 3),
  },
  {
    id: 'streak-7',
    title: '7-Day Streak',
    description: 'Study seven days in a row.',
    emoji: '🏮',
    category: 'streaks',
    tier: 'silver',
    metric: { current: (s) => s.stats.longestStreak, target: 7, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 7),
  },
  {
    id: 'streak-14',
    title: 'Fortnight of Focus',
    description: 'Maintain a 14-day study streak.',
    emoji: '⚡',
    category: 'streaks',
    tier: 'silver',
    metric: { current: (s) => s.stats.longestStreak, target: 14, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 14),
  },
  {
    id: 'streak-21',
    title: 'Habit Formed',
    description: 'Reach 21 consecutive days of Chinese study.',
    emoji: '✨',
    category: 'streaks',
    tier: 'silver',
    metric: { current: (s) => s.stats.longestStreak, target: 21, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 21),
  },
  {
    id: 'streak-30',
    title: 'Month of Flow',
    description: 'A 30-day study streak.',
    emoji: '🐉',
    category: 'streaks',
    tier: 'gold',
    metric: { current: (s) => s.stats.longestStreak, target: 30, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 30),
  },
  {
    id: 'streak-60',
    title: 'Two-Month Rhythm',
    description: 'Maintain a 60-day study streak.',
    emoji: '🌊',
    category: 'streaks',
    tier: 'gold',
    metric: { current: (s) => s.stats.longestStreak, target: 60, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 60),
  },
  {
    id: 'streak-100',
    title: 'Century of Consistency',
    description: 'Reach a 100-day unbroken study streak.',
    emoji: '💯',
    category: 'streaks',
    tier: 'gold',
    metric: { current: (s) => s.stats.longestStreak, target: 100, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 100),
  },
  {
    id: 'streak-180',
    title: 'Half-Year Dedication',
    description: 'Study every day for 180 consecutive days.',
    emoji: '⛩️',
    category: 'streaks',
    tier: 'diamond',
    metric: { current: (s) => s.stats.longestStreak, target: 180, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 180),
  },
  {
    id: 'streak-365',
    title: 'Year of the Dragon',
    description: 'A full 365-day streak without skipping a day.',
    emoji: '🐲',
    category: 'streaks',
    tier: 'diamond',
    metric: { current: (s) => s.stats.longestStreak, target: 365, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 365),
  },
  {
    id: 'streak-500',
    title: '500-Day Ascent',
    description: 'Maintain a 500-day daily study streak.',
    emoji: '⛰️',
    category: 'streaks',
    tier: 'diamond',
    metric: { current: (s) => s.stats.longestStreak, target: 500, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 500),
  },
  {
    id: 'streak-730',
    title: 'Two Full Years',
    description: '730 consecutive days of unwavering study.',
    emoji: '🌌',
    category: 'streaks',
    tier: 'legendary',
    metric: { current: (s) => s.stats.longestStreak, target: 730, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 730),
  },
  {
    id: 'streak-1000',
    title: 'Millennial Discipline',
    description: 'Reach a mythical 1,000-day streak.',
    emoji: '👑',
    category: 'streaks',
    tier: 'legendary',
    metric: { current: (s) => s.stats.longestStreak, target: 1000, unit: 'days' },
    progress: (s) => frac(s.stats.longestStreak, 1000),
  },
  {
    id: 'active-days-7',
    title: '7 Active Days',
    description: 'Study across 7 distinct calendar days.',
    emoji: '📅',
    category: 'streaks',
    tier: 'bronze',
    metric: { current: (s) => countActiveDays(s), target: 7, unit: 'days' },
    progress: (s) => frac(countActiveDays(s), 7),
  },
  {
    id: 'active-days-30',
    title: '30 Active Days',
    description: 'Study across 30 distinct calendar days.',
    emoji: '🗓️',
    category: 'streaks',
    tier: 'silver',
    metric: { current: (s) => countActiveDays(s), target: 30, unit: 'days' },
    progress: (s) => frac(countActiveDays(s), 30),
  },
  {
    id: 'active-days-100',
    title: '100 Active Days',
    description: 'Study across 100 distinct calendar days.',
    emoji: '🏅',
    category: 'streaks',
    tier: 'gold',
    metric: { current: (s) => countActiveDays(s), target: 100, unit: 'days' },
    progress: (s) => frac(countActiveDays(s), 100),
  },
  {
    id: 'active-days-365',
    title: '365 Active Days',
    description: 'Study across 365 total calendar days.',
    emoji: '🏆',
    category: 'streaks',
    tier: 'diamond',
    metric: { current: (s) => countActiveDays(s), target: 365, unit: 'days' },
    progress: (s) => frac(countActiveDays(s), 365),
  },

  // ==========================================
  // 2. TOTAL REVIEWS & ENDURANCE
  // ==========================================
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Complete your first review.',
    emoji: '👣',
    category: 'reviews',
    tier: 'bronze',
    metric: { current: (s) => s.stats.totalReviewed, target: 1, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 1),
  },
  {
    id: 'reviews-50',
    title: 'Warm Up',
    description: 'Review 50 flashcards.',
    emoji: '☕',
    category: 'reviews',
    tier: 'bronze',
    metric: { current: (s) => s.stats.totalReviewed, target: 50, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 50),
  },
  {
    id: 'reviews-100',
    title: 'Century',
    description: 'Review 100 cards.',
    emoji: '💯',
    category: 'reviews',
    tier: 'bronze',
    metric: { current: (s) => s.stats.totalReviewed, target: 100, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 100),
  },
  {
    id: 'reviews-250',
    title: 'Dedicated Student',
    description: 'Review 250 cards.',
    emoji: '📖',
    category: 'reviews',
    tier: 'bronze',
    metric: { current: (s) => s.stats.totalReviewed, target: 250, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 250),
  },
  {
    id: 'reviews-500',
    title: 'Dedicated Scholar',
    description: 'Review 500 cards.',
    emoji: '📜',
    category: 'reviews',
    tier: 'silver',
    metric: { current: (s) => s.stats.totalReviewed, target: 500, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 500),
  },
  {
    id: 'reviews-1000',
    title: 'Flashcard Veteran',
    description: 'Review 1,000 cards.',
    emoji: '📚',
    category: 'reviews',
    tier: 'silver',
    metric: { current: (s) => s.stats.totalReviewed, target: 1000, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 1000),
  },
  {
    id: 'reviews-2500',
    title: 'Diligent Practitioner',
    description: 'Review 2,500 cards.',
    emoji: '🎯',
    category: 'reviews',
    tier: 'gold',
    metric: { current: (s) => s.stats.totalReviewed, target: 2500, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 2500),
  },
  {
    id: 'reviews-5000',
    title: 'Repetition Master',
    description: 'Review 5,000 cards.',
    emoji: '⚙️',
    category: 'reviews',
    tier: 'gold',
    metric: { current: (s) => s.stats.totalReviewed, target: 5000, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 5000),
  },
  {
    id: 'reviews-10000',
    title: '10K Milestone',
    description: 'Complete 10,000 flashcard reviews.',
    emoji: '🏛️',
    category: 'reviews',
    tier: 'diamond',
    metric: { current: (s) => s.stats.totalReviewed, target: 10000, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 10000),
  },
  {
    id: 'reviews-25000',
    title: 'Scribe of Repetition',
    description: 'Complete 25,000 flashcard reviews.',
    emoji: '🖋️',
    category: 'reviews',
    tier: 'diamond',
    metric: { current: (s) => s.stats.totalReviewed, target: 25000, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 25000),
  },
  {
    id: 'reviews-50000',
    title: '50K Marathon',
    description: 'Complete 50,000 flashcard reviews.',
    emoji: '⭐',
    category: 'reviews',
    tier: 'legendary',
    metric: { current: (s) => s.stats.totalReviewed, target: 50000, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 50000),
  },
  {
    id: 'reviews-100000',
    title: 'SRS Grandmaster',
    description: 'Achieve 100,000 total flashcard reviews.',
    emoji: '👑',
    category: 'reviews',
    tier: 'legendary',
    metric: { current: (s) => s.stats.totalReviewed, target: 100000, unit: 'reviews' },
    progress: (s) => frac(s.stats.totalReviewed, 100000),
  },
  {
    id: 'daily-reviews-30',
    title: 'Quick Sprint',
    description: 'Review at least 30 cards in a single day.',
    emoji: '🏃',
    category: 'reviews',
    tier: 'bronze',
    metric: { current: (s) => maxDailyReviews(s), target: 30, unit: 'cards in a day' },
    progress: (s) => frac(maxDailyReviews(s), 30),
  },
  {
    id: 'daily-reviews-75',
    title: 'Power Session',
    description: 'Review at least 75 cards in a single day.',
    emoji: '⚡',
    category: 'reviews',
    tier: 'silver',
    metric: { current: (s) => maxDailyReviews(s), target: 75, unit: 'cards in a day' },
    progress: (s) => frac(maxDailyReviews(s), 75),
  },
  {
    id: 'daily-reviews-150',
    title: 'Century & A Half',
    description: 'Review at least 150 cards in a single day.',
    emoji: '🔥',
    category: 'reviews',
    tier: 'gold',
    metric: { current: (s) => maxDailyReviews(s), target: 150, unit: 'cards in a day' },
    progress: (s) => frac(maxDailyReviews(s), 150),
  },
  {
    id: 'daily-reviews-300',
    title: 'Daily Marathon',
    description: 'Review at least 300 cards in a single day.',
    emoji: '🌪️',
    category: 'reviews',
    tier: 'diamond',
    metric: { current: (s) => maxDailyReviews(s), target: 300, unit: 'cards in a day' },
    progress: (s) => frac(maxDailyReviews(s), 300),
  },

  // ==========================================
  // 3. VOCABULARY VOLUME
  // ==========================================
  {
    id: 'words-10',
    title: 'First Words',
    description: 'Learn your first 10 Chinese words.',
    emoji: '🌱',
    category: 'words',
    tier: 'bronze',
    metric: { current: (s) => countLearnedWords(s), target: 10, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 10),
  },
  {
    id: 'words-25',
    title: 'Budding Speaker',
    description: 'Learn 25 words.',
    emoji: '🌿',
    category: 'words',
    tier: 'bronze',
    metric: { current: (s) => countLearnedWords(s), target: 25, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 25),
  },
  {
    id: 'words-50',
    title: 'Conversation Starter',
    description: 'Learn 50 words.',
    emoji: '💬',
    category: 'words',
    tier: 'bronze',
    metric: { current: (s) => countLearnedWords(s), target: 50, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 50),
  },
  {
    id: 'words-100',
    title: '100 Words',
    description: 'Learn 100 words.',
    emoji: '🌱',
    category: 'words',
    tier: 'bronze',
    metric: { current: (s) => countLearnedWords(s), target: 100, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 100),
  },
  {
    id: 'words-250',
    title: 'Practical Speaker',
    description: 'Learn 250 words.',
    emoji: '🎋',
    category: 'words',
    tier: 'silver',
    metric: { current: (s) => countLearnedWords(s), target: 250, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 250),
  },
  {
    id: 'words-500',
    title: '500 Words',
    description: 'Learn 500 words.',
    emoji: '🌿',
    category: 'words',
    tier: 'silver',
    metric: { current: (s) => countLearnedWords(s), target: 500, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 500),
  },
  {
    id: 'words-1000',
    title: '1,000 Words',
    description: 'Learn 1,000 words.',
    emoji: '🌳',
    category: 'words',
    tier: 'silver',
    metric: { current: (s) => countLearnedWords(s), target: 1000, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 1000),
  },
  {
    id: 'words-1500',
    title: 'Expressive Thinker',
    description: 'Learn 1,500 words.',
    emoji: '🏮',
    category: 'words',
    tier: 'gold',
    metric: { current: (s) => countLearnedWords(s), target: 1500, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 1500),
  },
  {
    id: 'words-2500',
    title: '2,500 Words',
    description: 'Learn 2,500 words.',
    emoji: '🏯',
    category: 'words',
    tier: 'gold',
    metric: { current: (s) => countLearnedWords(s), target: 2500, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 2500),
  },
  {
    id: 'words-3500',
    title: 'Literate Reader',
    description: 'Learn 3,500 words.',
    emoji: '📜',
    category: 'words',
    tier: 'gold',
    metric: { current: (s) => countLearnedWords(s), target: 3500, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 3500),
  },
  {
    id: 'words-5000',
    title: '5,000 Words',
    description: 'Learn 5,000 words.',
    emoji: '⛰️',
    category: 'words',
    tier: 'diamond',
    metric: { current: (s) => countLearnedWords(s), target: 5000, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 5000),
  },
  {
    id: 'words-7500',
    title: 'Fluent Scholar',
    description: 'Learn 7,500 words.',
    emoji: '🌌',
    category: 'words',
    tier: 'diamond',
    metric: { current: (s) => countLearnedWords(s), target: 7500, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 7500),
  },
  {
    id: 'words-10000',
    title: '10,000 Words',
    description: 'Learn 10,000 words.',
    emoji: '🌏',
    category: 'words',
    tier: 'legendary',
    metric: { current: (s) => countLearnedWords(s), target: 10000, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 10000),
  },
  {
    id: 'words-11000',
    title: 'Walking Lexicon',
    description: 'Learn 11,000 words across the curriculum.',
    emoji: '🌠',
    category: 'words',
    tier: 'legendary',
    metric: { current: (s) => countLearnedWords(s), target: 11000, unit: 'words' },
    progress: (s) => frac(countLearnedWords(s), 11000),
  },
  {
    id: 'starred-10',
    title: 'Star Curator',
    description: 'Star 10 words for targeted focus practice.',
    emoji: '⭐',
    category: 'words',
    tier: 'bronze',
    metric: { current: (s) => (s.starredWords ?? []).length, target: 10, unit: 'starred words' },
    progress: (s) => frac((s.starredWords ?? []).length, 10),
  },
  {
    id: 'starred-50',
    title: 'Golden Treasury',
    description: 'Star 50 words in your personal vocabulary treasury.',
    emoji: '🌟',
    category: 'words',
    tier: 'silver',
    metric: { current: (s) => (s.starredWords ?? []).length, target: 50, unit: 'starred words' },
    progress: (s) => frac((s.starredWords ?? []).length, 50),
  },

  // ==========================================
  // 4. DEEP MEMORY & SRS STABILITY
  // ==========================================
  {
    id: 'mature-10',
    title: 'Long-Term Sparks',
    description: 'Anchor 10 flashcards into mature stability (≥ 21 days).',
    emoji: '⚓',
    category: 'memory',
    tier: 'bronze',
    metric: { current: (s) => countMatureCards(s), target: 10, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 10),
  },
  {
    id: 'mature-50',
    title: 'Memory Anchor',
    description: 'Reach 50 mature flashcards with long-term stability.',
    emoji: '⚓',
    category: 'memory',
    tier: 'bronze',
    metric: { current: (s) => countMatureCards(s), target: 50, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 50),
  },
  {
    id: 'mature-100',
    title: 'Stable Mind',
    description: 'Reach 100 mature flashcards (stability ≥ 21 days).',
    emoji: '🧠',
    category: 'memory',
    tier: 'silver',
    metric: { current: (s) => countMatureCards(s), target: 100, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 100),
  },
  {
    id: 'mature-250',
    title: 'Deep Rooted',
    description: 'Reach 250 mature flashcards.',
    emoji: '🌳',
    category: 'memory',
    tier: 'silver',
    metric: { current: (s) => countMatureCards(s), target: 250, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 250),
  },
  {
    id: 'mature-500',
    title: '500 Engrams',
    description: 'Reach 500 mature cards in long-term memory.',
    emoji: '🗿',
    category: 'memory',
    tier: 'gold',
    metric: { current: (s) => countMatureCards(s), target: 500, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 500),
  },
  {
    id: 'mature-1000',
    title: 'Ironclad Memory',
    description: 'Anchor 1,000 flashcards in deep memory.',
    emoji: '🏰',
    category: 'memory',
    tier: 'gold',
    metric: { current: (s) => countMatureCards(s), target: 1000, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 1000),
  },
  {
    id: 'mature-2000',
    title: 'Vault of Knowledge',
    description: 'Reach 2,000 mature flashcards.',
    emoji: '💎',
    category: 'memory',
    tier: 'diamond',
    metric: { current: (s) => countMatureCards(s), target: 2000, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 2000),
  },
  {
    id: 'mature-3500',
    title: 'Monumental Recall',
    description: 'Reach 3,500 mature flashcards.',
    emoji: '🏛️',
    category: 'memory',
    tier: 'diamond',
    metric: { current: (s) => countMatureCards(s), target: 3500, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 3500),
  },
  {
    id: 'mature-5000',
    title: 'Permanent Engram',
    description: 'Reach 5,000 mature flashcards with long-term retention.',
    emoji: '🔮',
    category: 'memory',
    tier: 'legendary',
    metric: { current: (s) => countMatureCards(s), target: 5000, unit: 'mature cards' },
    progress: (s) => frac(countMatureCards(s), 5000),
  },
  {
    id: 'dual-direction-50',
    title: 'Bilateral Novice',
    description: 'Master 50 words in BOTH recognition and recall directions.',
    emoji: '🔄',
    category: 'memory',
    tier: 'bronze',
    metric: { current: (s) => countDualDirectionLearned(s), target: 50, unit: 'dual-direction words' },
    progress: (s) => frac(countDualDirectionLearned(s), 50),
  },
  {
    id: 'dual-direction-200',
    title: 'Dual Master',
    description: 'Master 200 words in BOTH recognition and recall directions.',
    emoji: '☯️',
    category: 'memory',
    tier: 'silver',
    metric: { current: (s) => countDualDirectionLearned(s), target: 200, unit: 'dual-direction words' },
    progress: (s) => frac(countDualDirectionLearned(s), 200),
  },
  {
    id: 'dual-direction-500',
    title: 'Ambidextrous Fluency',
    description: 'Master 500 words in BOTH recognition and recall directions.',
    emoji: '🎭',
    category: 'memory',
    tier: 'gold',
    metric: { current: (s) => countDualDirectionLearned(s), target: 500, unit: 'dual-direction words' },
    progress: (s) => frac(countDualDirectionLearned(s), 500),
  },
  {
    id: 'dual-direction-1000',
    title: 'Total Bilateral Fluency',
    description: 'Master 1,000 words in both recognition and recall.',
    emoji: '🔱',
    category: 'memory',
    tier: 'diamond',
    metric: { current: (s) => countDualDirectionLearned(s), target: 1000, unit: 'dual-direction words' },
    progress: (s) => frac(countDualDirectionLearned(s), 1000),
  },
  {
    id: 'retention-90',
    title: 'High Fidelity',
    description: 'Achieve ≥ 90% True Retention on mature cards (min. 50 reviews).',
    emoji: '🎯',
    category: 'memory',
    tier: 'gold',
    metric: {
      current: (s) => {
        const tr = calculateTrueRetention(s);
        return tr.matureTotal >= 50 && tr.rate !== null ? Math.round(tr.rate * 100) : 0;
      },
      target: 90,
      unit: '% retention',
    },
    progress: (s) => {
      const tr = calculateTrueRetention(s);
      if (tr.matureTotal < 50 || tr.rate === null) return frac(tr.matureTotal, 50) * 0.5;
      return tr.rate >= 0.9 ? 1 : frac(tr.rate, 0.9);
    },
  },
  {
    id: 'retention-95',
    title: 'Crystalline Memory',
    description: 'Achieve ≥ 95% True Retention on mature cards (min. 100 reviews).',
    emoji: '💠',
    category: 'memory',
    tier: 'diamond',
    metric: {
      current: (s) => {
        const tr = calculateTrueRetention(s);
        return tr.matureTotal >= 100 && tr.rate !== null ? Math.round(tr.rate * 100) : 0;
      },
      target: 95,
      unit: '% retention',
    },
    progress: (s) => {
      const tr = calculateTrueRetention(s);
      if (tr.matureTotal < 100 || tr.rate === null) return frac(tr.matureTotal, 100) * 0.5;
      return tr.rate >= 0.95 ? 1 : frac(tr.rate, 0.95);
    },
  },

  // ==========================================
  // 5. TONES & AUDIO MASTERY
  // ==========================================
  {
    id: 'listening-25',
    title: 'Listening Novice',
    description: 'Complete 25 audio drills.',
    emoji: '🎧',
    category: 'tones',
    tier: 'bronze',
    metric: { current: (s) => s.stats.modeCounts.audio, target: 25, unit: 'audio drills' },
    progress: (s) => frac(s.stats.modeCounts.audio, 25),
  },
  {
    id: 'listening-100',
    title: 'Tuned Ear',
    description: 'Complete 100 audio listening drills.',
    emoji: '👂',
    category: 'tones',
    tier: 'silver',
    metric: { current: (s) => s.stats.modeCounts.audio, target: 100, unit: 'audio drills' },
    progress: (s) => frac(s.stats.modeCounts.audio, 100),
  },
  {
    id: 'listening-300',
    title: 'Golden Ear',
    description: 'Complete 300 audio drills.',
    emoji: '📻',
    category: 'tones',
    tier: 'gold',
    metric: { current: (s) => s.stats.modeCounts.audio, target: 300, unit: 'audio drills' },
    progress: (s) => frac(s.stats.modeCounts.audio, 300),
  },
  {
    id: 'listening-1000',
    title: 'Audiophile Linguist',
    description: 'Complete 1,000 audio listening drills.',
    emoji: '🎙️',
    category: 'tones',
    tier: 'diamond',
    metric: { current: (s) => s.stats.modeCounts.audio, target: 1000, unit: 'audio drills' },
    progress: (s) => frac(s.stats.modeCounts.audio, 1000),
  },
  {
    id: 'tone-50',
    title: 'Tone Tamer',
    description: 'Complete 50 tone drills.',
    emoji: '🎵',
    category: 'tones',
    tier: 'bronze',
    metric: { current: (s) => s.stats.modeCounts.tone, target: 50, unit: 'tone drills' },
    progress: (s) => frac(s.stats.modeCounts.tone, 50),
  },
  {
    id: 'tone-150',
    title: 'Tone Explorer',
    description: 'Complete 150 tone drills.',
    emoji: '🎶',
    category: 'tones',
    tier: 'silver',
    metric: { current: (s) => s.stats.modeCounts.tone, target: 150, unit: 'tone drills' },
    progress: (s) => frac(s.stats.modeCounts.tone, 150),
  },
  {
    id: 'tone-500',
    title: 'Harmony Hunter',
    description: 'Complete 500 tone drills.',
    emoji: '🎸',
    category: 'tones',
    tier: 'gold',
    metric: { current: (s) => s.stats.modeCounts.tone, target: 500, unit: 'tone drills' },
    progress: (s) => frac(s.stats.modeCounts.tone, 500),
  },
  {
    id: 'tone-1500',
    title: 'Resonance Master',
    description: 'Complete 1,500 tone drills.',
    emoji: '🎻',
    category: 'tones',
    tier: 'diamond',
    metric: { current: (s) => s.stats.modeCounts.tone, target: 1500, unit: 'tone drills' },
    progress: (s) => frac(s.stats.modeCounts.tone, 1500),
  },
  {
    id: 'tone-master',
    title: 'Perfect Pitch',
    description: '90%+ accuracy on every tone (min. 10 each).',
    emoji: '🎼',
    category: 'tones',
    tier: 'gold',
    progress: (s) =>
      Math.min(
        ...(['1', '2', '3', '4'] as ToneKey[]).map((t) => {
          const { correct, total } = s.stats.toneAccuracy[t];
          return total >= 10 && correct / total >= 0.9 ? 1 : frac(total, 10) * 0.9;
        }),
      ),
  },
  {
    id: 'tone-virtuoso',
    title: 'Sonic Perfectionist',
    description: '95%+ accuracy on every tone (min. 25 each).',
    emoji: '🎹',
    category: 'tones',
    tier: 'diamond',
    progress: (s) =>
      Math.min(
        ...(['1', '2', '3', '4'] as ToneKey[]).map((t) => {
          const { correct, total } = s.stats.toneAccuracy[t];
          return total >= 25 && correct / total >= 0.95 ? 1 : frac(total, 25) * 0.9;
        }),
      ),
  },

  // ==========================================
  // 6. GRAMMAR & LEARNING PATHS
  // ==========================================
  {
    id: 'grammar-1',
    title: 'Grammar Awakening',
    description: 'Complete your first grammar lesson practice.',
    emoji: '💡',
    category: 'grammar',
    tier: 'bronze',
    metric: { current: () => getStoredGrammarStats().completedPoints, target: 1, unit: 'lessons' },
    progress: () => frac(getStoredGrammarStats().completedPoints, 1),
  },
  {
    id: 'grammar-5',
    title: 'Grammar Student',
    description: 'Complete 5 grammar lessons.',
    emoji: '📘',
    category: 'grammar',
    tier: 'bronze',
    metric: { current: () => getStoredGrammarStats().completedPoints, target: 5, unit: 'lessons' },
    progress: () => frac(getStoredGrammarStats().completedPoints, 5),
  },
  {
    id: 'grammar-15',
    title: 'Sentence Crafter',
    description: 'Complete 15 grammar lessons.',
    emoji: '✍️',
    category: 'grammar',
    tier: 'silver',
    metric: { current: () => getStoredGrammarStats().completedPoints, target: 15, unit: 'lessons' },
    progress: () => frac(getStoredGrammarStats().completedPoints, 15),
  },
  {
    id: 'grammar-30',
    title: 'Syntactic Explorer',
    description: 'Complete 30 grammar lessons.',
    emoji: '🧭',
    category: 'grammar',
    tier: 'gold',
    metric: { current: () => getStoredGrammarStats().completedPoints, target: 30, unit: 'lessons' },
    progress: () => frac(getStoredGrammarStats().completedPoints, 30),
  },
  {
    id: 'grammar-50',
    title: 'Grammar Architect',
    description: 'Complete 50 grammar lessons across levels.',
    emoji: '🏛️',
    category: 'grammar',
    tier: 'diamond',
    metric: { current: () => getStoredGrammarStats().completedPoints, target: 50, unit: 'lessons' },
    progress: () => frac(getStoredGrammarStats().completedPoints, 50),
  },
  {
    id: 'path-1',
    title: 'First Step on the Path',
    description: 'Complete 1 learning path step.',
    emoji: '🗺️',
    category: 'grammar',
    tier: 'bronze',
    metric: { current: () => getStoredGrammarStats().completedPathSteps, target: 1, unit: 'steps' },
    progress: () => frac(getStoredGrammarStats().completedPathSteps, 1),
  },
  {
    id: 'path-5',
    title: 'Path Explorer',
    description: 'Complete 5 learning path steps.',
    emoji: '🚶',
    category: 'grammar',
    tier: 'silver',
    metric: { current: () => getStoredGrammarStats().completedPathSteps, target: 5, unit: 'steps' },
    progress: () => frac(getStoredGrammarStats().completedPathSteps, 5),
  },
  {
    id: 'path-15',
    title: 'Trailblazer',
    description: 'Complete 15 learning path steps.',
    emoji: '⛺',
    category: 'grammar',
    tier: 'gold',
    metric: { current: () => getStoredGrammarStats().completedPathSteps, target: 15, unit: 'steps' },
    progress: () => frac(getStoredGrammarStats().completedPathSteps, 15),
  },
  {
    id: 'path-30',
    title: 'Path Conqueror',
    description: 'Complete 30 learning path steps.',
    emoji: '🚩',
    category: 'grammar',
    tier: 'diamond',
    metric: { current: () => getStoredGrammarStats().completedPathSteps, target: 30, unit: 'steps' },
    progress: () => frac(getStoredGrammarStats().completedPathSteps, 30),
  },

  // ==========================================
  // 7. HSK CURRICULUM LEVELS
  // ==========================================
  ...([1, 2, 3, 4, 5, 6, 7] as HskLevel[]).map(
    (level): Badge => ({
      id: `hsk${level}-complete`,
      title: `${levelLabel(level)} Completer`,
      description: `Learn every ${levelLabel(level)} word of your curriculum.`,
      emoji: ['🥉', '🥈', '🥇', '🏅', '🎖️', '🏆', '👑'][level - 1],
      category: 'levels',
      tier: level <= 1 ? 'bronze' : level <= 3 ? 'silver' : level <= 5 ? 'gold' : level === 6 ? 'diamond' : 'legendary',
      level,
      progress: (s, v) => levelLearned(s, v, level),
    }),
  ),
  {
    id: 'hsk-duo-1-2',
    title: 'Elementary Duo',
    description: 'Learn all vocabulary in both HSK 1 and HSK 2.',
    emoji: '🌱',
    category: 'levels',
    tier: 'silver',
    progress: (s, v) => duoLevelLearned(s, v, [1, 2]),
  },
  {
    id: 'hsk-duo-3-4',
    title: 'Intermediate Duo',
    description: 'Learn all vocabulary in both HSK 3 and HSK 4.',
    emoji: '🌿',
    category: 'levels',
    tier: 'gold',
    progress: (s, v) => duoLevelLearned(s, v, [3, 4]),
  },
  {
    id: 'hsk-duo-5-6',
    title: 'Advanced Duo',
    description: 'Learn all vocabulary in both HSK 5 and HSK 6.',
    emoji: '🌳',
    category: 'levels',
    tier: 'diamond',
    progress: (s, v) => duoLevelLearned(s, v, [5, 6]),
  },
  {
    id: 'hsk-omniscient',
    title: 'Curriculum Omniscient',
    description: 'Master every single word in your chosen curriculum.',
    emoji: '🌌',
    category: 'levels',
    tier: 'legendary',
    progress: (s, v) => (v.length ? v.filter((i) => isLearned(s, i)).length / v.length : 0),
  },

  // ==========================================
  // 8. SPECIAL FEATS & PRECISION
  // ==========================================
  {
    id: 'leech-slayer',
    title: 'Leech Slayer',
    description: 'Cure a leech with 3 correct recalls in a row.',
    emoji: '🗡️',
    category: 'special',
    tier: 'bronze',
    metric: { current: (s) => countCuredLeeches(s), target: 1, unit: 'cured leeches' },
    progress: (s) => (countCuredLeeches(s) >= 1 ? 1 : 0),
  },
  {
    id: 'leech-purifier-5',
    title: 'Leech Purifier',
    description: 'Cure 5 distinct leeches with disciplined practice.',
    emoji: '⚔️',
    category: 'special',
    tier: 'silver',
    metric: { current: (s) => countCuredLeeches(s), target: 5, unit: 'cured leeches' },
    progress: (s) => frac(countCuredLeeches(s), 5),
  },
  {
    id: 'leech-purifier-20',
    title: 'Leech Exorcist',
    description: 'Cure 20 difficult cards that once tripped you up.',
    emoji: '🛡️',
    category: 'special',
    tier: 'gold',
    metric: { current: (s) => countCuredLeeches(s), target: 20, unit: 'cured leeches' },
    progress: (s) => frac(countCuredLeeches(s), 20),
  },
  {
    id: 'flawless-day',
    title: 'Flawless Day',
    description: 'Achieve 100% accuracy on a day with at least 15 reviews.',
    emoji: '💎',
    category: 'special',
    tier: 'silver',
    metric: { current: (s) => countFlawlessDays(s), target: 1, unit: 'flawless days' },
    progress: (s) => (countFlawlessDays(s) >= 1 ? 1 : 0),
  },
  {
    id: 'accuracy-overall-85',
    title: 'Sharp Marksman',
    description: 'Maintain ≥ 85% overall review accuracy (min. 200 reviews).',
    emoji: '🎯',
    category: 'special',
    tier: 'silver',
    metric: {
      current: (s) => (s.stats.totalReviewed >= 200 ? Math.round((s.stats.totalCorrect / s.stats.totalReviewed) * 100) : 0),
      target: 85,
      unit: '% accuracy',
    },
    progress: (s) => {
      if (s.stats.totalReviewed < 200) return frac(s.stats.totalReviewed, 200) * 0.5;
      const acc = s.stats.totalCorrect / s.stats.totalReviewed;
      return acc >= 0.85 ? 1 : frac(acc, 0.85);
    },
  },
  {
    id: 'accuracy-overall-92',
    title: 'Sharpshooter',
    description: 'Maintain ≥ 92% overall review accuracy (min. 500 reviews).',
    emoji: '🏹',
    category: 'special',
    tier: 'gold',
    metric: {
      current: (s) => (s.stats.totalReviewed >= 500 ? Math.round((s.stats.totalCorrect / s.stats.totalReviewed) * 100) : 0),
      target: 92,
      unit: '% accuracy',
    },
    progress: (s) => {
      if (s.stats.totalReviewed < 500) return frac(s.stats.totalReviewed, 500) * 0.5;
      const acc = s.stats.totalCorrect / s.stats.totalReviewed;
      return acc >= 0.92 ? 1 : frac(acc, 0.92);
    },
  },
  {
    id: 'accuracy-overall-96',
    title: 'Deadeye Scholar',
    description: 'Maintain ≥ 96% overall review accuracy (min. 1,000 reviews).',
    emoji: '🦅',
    category: 'special',
    tier: 'diamond',
    metric: {
      current: (s) => (s.stats.totalReviewed >= 1000 ? Math.round((s.stats.totalCorrect / s.stats.totalReviewed) * 100) : 0),
      target: 96,
      unit: '% accuracy',
    },
    progress: (s) => {
      if (s.stats.totalReviewed < 1000) return frac(s.stats.totalReviewed, 1000) * 0.5;
      const acc = s.stats.totalCorrect / s.stats.totalReviewed;
      return acc >= 0.96 ? 1 : frac(acc, 0.96);
    },
  },
  {
    id: 'speed-demon',
    title: 'Swift Lightning',
    description: 'Average response time under 1.8s (min. 100 reviews).',
    emoji: '⚡',
    category: 'special',
    tier: 'silver',
    metric: {
      current: (s) => (s.stats.latencySamples >= 100 ? Math.round(s.stats.totalLatencyMs / s.stats.latencySamples) : 0),
      target: 1800,
      unit: 'ms avg',
    },
    progress: (s) => {
      if (s.stats.latencySamples < 100) return frac(s.stats.latencySamples, 100) * 0.5;
      const avg = s.stats.totalLatencyMs / s.stats.latencySamples;
      return avg <= 1800 ? 1 : frac(1800, avg);
    },
  },
  // ==========================================
  // 9. CLOZE & SENTENCE EXERCISES
  // ==========================================
  {
    id: 'cloze-first',
    title: 'First Gap Filled',
    description: 'Complete your first fill-in-the-gap sentence card.',
    emoji: '🧩',
    category: 'special',
    tier: 'bronze',
    metric: {
      current: (s) => s.stats.modeCounts.cloze ?? 0,
      target: 1,
      unit: 'cards',
    },
    progress: (s) => frac(s.stats.modeCounts.cloze ?? 0, 1),
  },
  {
    id: 'cloze-10',
    title: 'Sentence Mason',
    description: 'Complete 10 fill-in-the-gap sentence cards.',
    emoji: '🧱',
    category: 'reviews',
    tier: 'bronze',
    metric: {
      current: (s) => s.stats.modeCounts.cloze ?? 0,
      target: 10,
      unit: 'cards',
    },
    progress: (s) => frac(s.stats.modeCounts.cloze ?? 0, 10),
  },
  {
    id: 'cloze-50',
    title: 'Sentence Architect',
    description: 'Complete 50 fill-in-the-gap sentence cards.',
    emoji: '🏛️',
    category: 'reviews',
    tier: 'silver',
    metric: {
      current: (s) => s.stats.modeCounts.cloze ?? 0,
      target: 50,
      unit: 'cards',
    },
    progress: (s) => frac(s.stats.modeCounts.cloze ?? 0, 50),
  },
  {
    id: 'cloze-150',
    title: 'Master of Context',
    description: 'Complete 150 fill-in-the-gap sentence cards.',
    emoji: '📜',
    category: 'reviews',
    tier: 'gold',
    metric: {
      current: (s) => s.stats.modeCounts.cloze ?? 0,
      target: 150,
      unit: 'cards',
    },
    progress: (s) => frac(s.stats.modeCounts.cloze ?? 0, 150),
  },
  // ==========================================
  // 10. MULTI-COURSE & POLYGLOT
  // ==========================================
  {
    id: 'course-polyglot',
    title: 'Bridge of Tongues',
    description: 'Study vocabulary across both Chinese and English courses.',
    emoji: '🌐',
    category: 'special',
    tier: 'silver',
    metric: {
      current: (s) => {
        const hasZh = Object.keys(s.courseProgress?.chinese ?? s.progress ?? {}).length > 0;
        const hasEn = Object.keys(s.courseProgress?.english ?? (s.settings.course === 'english' ? s.progress : {}) ?? {}).length > 0;
        return (hasZh ? 1 : 0) + (hasEn ? 1 : 0);
      },
      target: 2,
      unit: 'courses',
    },
    progress: (s) => {
      const hasZh = Object.keys(s.courseProgress?.chinese ?? s.progress ?? {}).length > 0;
      const hasEn = Object.keys(s.courseProgress?.english ?? (s.settings.course === 'english' ? s.progress : {}) ?? {}).length > 0;
      return frac((hasZh ? 1 : 0) + (hasEn ? 1 : 0), 2);
    },
  },
  {
    id: 'course-english-scholar',
    title: 'Global Communicator',
    description: 'Learn at least 15 English words in the English track.',
    emoji: '🇬🇧',
    category: 'special',
    tier: 'gold',
    metric: {
      current: (s) => {
        const enProg = s.settings.course === 'english' ? s.progress : (s.courseProgress?.english ?? {});
        return Object.values(enProg).filter(isWordLearned).length;
      },
      target: 15,
      unit: 'words',
    },
    progress: (s) => {
      const enProg = s.settings.course === 'english' ? s.progress : (s.courseProgress?.english ?? {});
      return frac(Object.values(enProg).filter(isWordLearned).length, 15);
    },
  },
];

/** Badges that apply to the current curriculum (unlocked ones always stay visible). */
export function badgesFor(state: UserState, vocab: VocabItem[]): Badge[] {
  const levels = new Set(vocab.map((v) => v.hskLevel));
  return BADGES.filter((b) => b.level === undefined || levels.has(b.level) || state.unlockedBadges.includes(b.id));
}

export function newlyUnlocked(state: UserState, vocab: VocabItem[]): Badge[] {
  return badgesFor(state, vocab).filter((b) => !state.unlockedBadges.includes(b.id) && b.progress(state, vocab) >= 1);
}

export function tonesSummary(item: VocabItem): string {
  return tonesOf(item).map((t) => (t === '0' ? '·' : t)).join(' ');
}
