import type { HskLevel, SessionRequest, ToneKey, UserState, VocabItem } from '../types';
import { addDays, dayKey } from './dates';
import { tonesOf } from './pinyinHelper';
import { effectiveStreak, isDue, itemHasTone, weakness } from './srsEngine';
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
    for (const h of state.progress[item.id]?.history ?? []) {
      t += 1;
      if (h.correct ?? h.grade >= 2) c += 1;
    }
  }
  return ratio(c, t);
}

export function overallAccuracy(state: UserState): Ratio {
  return ratio(state.stats.totalCorrect, state.stats.totalReviewed);
}

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

/** "Learned" = reviewed and currently on an interval of at least 3 days. */
export function isLearned(state: UserState, item: VocabItem): boolean {
  const p = state.progress[item.id];
  return !!p && p.repetitions >= 2 && p.interval >= 3;
}

export function averageLatencySec(state: UserState): number | null {
  const { totalLatencyMs, latencySamples } = state.stats;
  return latencySamples ? totalLatencyMs / latencySamples / 1000 : null;
}

export function leeches(state: UserState, vocab: VocabItem[]): VocabItem[] {
  return vocab.filter((v) => state.progress[v.id]?.isLeech);
}

export function frequentFailures(state: UserState, vocab: VocabItem[], n = 8): VocabItem[] {
  return vocab
    .filter((v) => (state.progress[v.id]?.failureCount ?? 0) > 0)
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
  const studied = vocab.filter((v) => state.progress[v.id]);

  // 1. Weakest tone with enough data → targeted tone drill in the group where most misses happen.
  const weakTone = toneAccuracyList(state)
    .filter((t) => t.ratio.total >= 5 && (t.ratio.pct ?? 100) < 75)
    .sort((a, b) => (a.ratio.pct ?? 0) - (b.ratio.pct ?? 0))[0];
  if (weakTone) {
    const withTone = studied.filter((v) => itemHasTone(v, weakTone.tone));
    const groups = new Map<string, { level: HskLevel; topic: string; misses: number; ids: string[] }>();
    for (const v of withTone) {
      const misses = (state.progress[v.id]?.history ?? []).filter((h) => h.correct === false).length;
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

  // 6. Unstarted words.
  const unseen = vocab.filter((v) => !state.progress[v.id]);
  if (unseen.length && due === 0) {
    const level = Math.min(...unseen.map((u) => u.hskLevel));
    recs.push({
      id: 'new',
      kind: 'new',
      title: `${unseen.length.toLocaleString('en')} new words waiting`,
      body: `Next up: ${levelLabel(level)} vocabulary such as ${unseen.slice(0, 3).map((u) => u.hanzi).join('、')}.`,
      action: {
        label: 'Learn new words',
        request: { label: `New ${levelLabel(level)} words`, mode: 'hanzi', levels: [level as HskLevel], topics: [] },
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

export interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** Level badges only apply when the curriculum has that level. */
  level?: HskLevel;
  /** progress toward the goal, 0..1 */
  progress: (state: UserState, vocab: VocabItem[]) => number;
}

const frac = (n: number, goal: number) => Math.min(1, n / goal);
const levelLearned = (state: UserState, vocab: VocabItem[], level: HskLevel) => {
  const items = vocab.filter((v) => v.hskLevel === level);
  return items.length ? items.filter((i) => isLearned(state, i)).length / items.length : 0;
};

export const BADGES: Badge[] = [
  { id: 'first-steps', title: 'First Steps', description: 'Complete your first review.', emoji: '👣', progress: (s) => frac(s.stats.totalReviewed, 1) },
  { id: 'streak-3', title: '3-Day Streak', description: 'Study three days in a row.', emoji: '🔥', progress: (s) => frac(s.stats.longestStreak, 3) },
  { id: 'streak-7', title: '7-Day Streak', description: 'Study seven days in a row.', emoji: '🏮', progress: (s) => frac(s.stats.longestStreak, 7) },
  { id: 'streak-30', title: 'Month of Flow', description: 'A 30-day study streak.', emoji: '🐉', progress: (s) => frac(s.stats.longestStreak, 30) },
  { id: 'reviews-100', title: 'Century', description: 'Review 100 cards.', emoji: '💯', progress: (s) => frac(s.stats.totalReviewed, 100) },
  { id: 'reviews-500', title: 'Dedicated Scholar', description: 'Review 500 cards.', emoji: '📜', progress: (s) => frac(s.stats.totalReviewed, 500) },
  { id: 'listening-25', title: 'Listening Novice', description: 'Complete 25 audio drills.', emoji: '🎧', progress: (s) => frac(s.stats.modeCounts.audio, 25) },
  { id: 'tone-50', title: 'Tone Tamer', description: 'Complete 50 tone drills.', emoji: '🎵', progress: (s) => frac(s.stats.modeCounts.tone, 50) },
  {
    id: 'tone-master',
    title: 'Perfect Pitch',
    description: '90%+ accuracy on every tone (min. 10 each).',
    emoji: '🎼',
    progress: (s) =>
      Math.min(
        ...(['1', '2', '3', '4'] as ToneKey[]).map((t) => {
          const { correct, total } = s.stats.toneAccuracy[t];
          return total >= 10 && correct / total >= 0.9 ? 1 : frac(total, 10) * 0.9;
        }),
      ),
  },
  ...([100, 500, 1000, 2500, 5000, 10000] as const).map(
    (n, i): Badge => ({
      id: `words-${n}`,
      title: `${n.toLocaleString('en')} Words`,
      description: `Learn ${n.toLocaleString('en')} words (recalled twice, interval ≥ 3 days).`,
      emoji: ['🌱', '🌿', '🌳', '🏯', '⛰️', '🌏'][i],
      progress: (s) => frac(Object.values(s.progress).filter((p) => p.repetitions >= 2 && p.interval >= 3).length, n),
    }),
  ),
  ...([1, 2, 3, 4, 5, 6, 7] as HskLevel[]).map(
    (level): Badge => ({
      id: `hsk${level}-complete`,
      title: `${levelLabel(level)} Completer`,
      description: `Learn every ${levelLabel(level)} word of your curriculum.`,
      emoji: ['🥉', '🥈', '🥇', '🏅', '🎖️', '🏆', '👑'][level - 1],
      level,
      progress: (s, v) => levelLearned(s, v, level),
    }),
  ),
  {
    id: 'leech-slayer',
    title: 'Leech Slayer',
    description: 'Cure a leech with 3 correct recalls in a row.',
    emoji: '🗡️',
    progress: (s) =>
      Object.values(s.progress).some((p) => p.curedLeech) ? 1 : 0,
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
