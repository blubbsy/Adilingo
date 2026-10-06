import type {
  CardProgress,
  Grade,
  PromptKind,
  SessionCard,
  SessionRequest,
  ToneKey,
  UserState,
  VocabItem,
} from '../types';
import { addDays, dayKey, daysBetween } from './dates';
import { tonesOf } from './pinyinHelper';

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
/** A card becomes a leech once it has been failed MORE than this many times. */
export const LEECH_THRESHOLD = 4;
const MAX_HISTORY = 50;

export const GRADE_LABELS: Record<Grade, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export function newProgress(now: Date = new Date()): CardProgress {
  return {
    easeFactor: INITIAL_EASE,
    interval: 0,
    repetitions: 0,
    dueDate: now.toISOString(),
    isLeech: false,
    history: [],
    consecutiveCorrect: 0,
    failureCount: 0,
  };
}

/** Next interval in days for a grade, without mutating anything (used for button previews). */
export function nextInterval(p: CardProgress | undefined, grade: Grade): number {
  const cur = p ?? newProgress();
  const ease = cur.easeFactor;
  switch (grade) {
    case 1:
      return 1;
    case 2:
      return cur.repetitions === 0 ? 1 : Math.max(cur.interval + 1, Math.round(cur.interval * 1.2));
    case 3:
      if (cur.repetitions === 0) return 1;
      if (cur.repetitions === 1) return Math.max(3, cur.interval + 1);
      return Math.max(cur.interval + 1, Math.round(cur.interval * ease));
    case 4:
      if (cur.repetitions === 0) return 4;
      return Math.max(cur.interval + 2, Math.round(cur.interval * (ease + 0.15) * 1.3));
  }
}

/**
 * SM-2 variant with four grades.
 *  1 Again – interval resets to 1 day, ease −0.20 (leeches are not penalised further)
 *  2 Hard  – ~1.2× interval, ease −0.15
 *  3 Good  – classic SM-2 expansion (1 → 3 → interval × ease)
 *  4 Easy  – ease +0.15 and a 1.3× bonus
 */
export function applyGrade(
  prev: CardProgress | undefined,
  grade: Grade,
  meta: { now?: Date; correct: boolean; mode: PromptKind; latencyMs?: number },
): CardProgress {
  const now = meta.now ?? new Date();
  const p: CardProgress = prev ? { ...prev, history: [...prev.history] } : newProgress(now);
  const interval = nextInterval(p, grade);

  if (grade === 1) {
    p.repetitions = 0;
    p.consecutiveCorrect = 0;
    p.failureCount += 1;
    if (!p.isLeech) p.easeFactor = Math.max(MIN_EASE, p.easeFactor - 0.2);
    if (p.failureCount > LEECH_THRESHOLD) p.isLeech = true;
  } else {
    p.repetitions += 1;
    p.consecutiveCorrect += 1;
    if (grade === 2) p.easeFactor = Math.max(MIN_EASE, p.easeFactor - 0.15);
    if (grade === 4) p.easeFactor += 0.15;
    // A leech recalled 3 times in a row is "cured"; leave headroom so one slip doesn't re-flag it.
    if (p.isLeech && p.consecutiveCorrect >= 3) {
      p.isLeech = false;
      p.failureCount = Math.min(p.failureCount, LEECH_THRESHOLD - 2);
      p.curedLeech = true;
    }
  }

  p.interval = interval;
  p.dueDate = addDays(now, interval).toISOString();
  p.lastReviewed = now.toISOString();
  const isCorrect = grade >= 2;
  p.history.push({ date: now.toISOString(), grade, correct: isCorrect, mode: meta.mode, latencyMs: meta.latencyMs });
  if (p.history.length > MAX_HISTORY) p.history.splice(0, p.history.length - MAX_HISTORY);
  return p;
}

export function isDue(p: CardProgress | undefined, now: Date = new Date()): boolean {
  if (!p) return false;
  // Anything due before the end of today counts as due today.
  return new Date(p.dueDate) <= addDays(new Date(now.toDateString()), 1);
}

export interface ReviewEvent {
  item: VocabItem;
  grade: Grade;
  correct: boolean;
  prompt: PromptKind;
  latencyMs: number;
  /** Per-syllable tone outcome, when the answer revealed tones. */
  tones?: { expected: ToneKey; given: ToneKey }[];
}

/**
 * Applies a review to the whole user state (progress + telemetry + streaks).
 * A `learningStep` is the in-session repeat of a card already failed today: it feeds
 * accuracy/tone telemetry but leaves the schedule, ease, failure count and daily cap alone.
 */
export function recordReview(
  state: UserState,
  ev: ReviewEvent,
  now: Date = new Date(),
  opts: { learningStep?: boolean } = {},
): UserState {
  const today = dayKey(now);
  const isCorrect = ev.grade >= 2;
  const prev = state.progress[ev.item.id];
  const isNew = !prev;
  const learning = Boolean(opts.learningStep && prev);
  const progress: CardProgress = learning
    ? {
        ...prev,
        history: [...prev.history, { date: now.toISOString(), grade: ev.grade, correct: isCorrect, mode: ev.prompt, latencyMs: ev.latencyMs, learningStep: true }].slice(-MAX_HISTORY),
      }
    : applyGrade(prev, ev.grade, { now, correct: isCorrect, mode: ev.prompt, latencyMs: ev.latencyMs });

  const s = state.stats;
  let { currentStreak, longestStreak } = s;
  if (s.lastActiveDate !== today) {
    const gap = s.lastActiveDate ? daysBetween(s.lastActiveDate, today) : Infinity;
    currentStreak = gap === 1 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  const toneAccuracy = { ...s.toneAccuracy };
  const toneConfusion = { ...s.toneConfusion };
  for (const t of ev.tones ?? []) {
    const ok = t.expected === t.given;
    toneAccuracy[t.expected] = {
      correct: toneAccuracy[t.expected].correct + (ok ? 1 : 0),
      total: toneAccuracy[t.expected].total + 1,
    };
    toneConfusion[t.expected] = { ...toneConfusion[t.expected], [t.given]: toneConfusion[t.expected][t.given] + 1 };
  }

  const day = s.daily[today] ?? { reviewed: 0, correct: 0, newCards: 0 };
  const latencyOk = ev.latencyMs > 0 && ev.latencyMs < 120_000; // ignore walked-away cards

  return {
    ...state,
    progress: { ...state.progress, [ev.item.id]: progress },
    stats: {
      ...s,
      currentStreak,
      longestStreak,
      lastActiveDate: today,
      totalReviewed: s.totalReviewed + 1,
      totalCorrect: s.totalCorrect + (isCorrect ? 1 : 0),
      totalLatencyMs: s.totalLatencyMs + (latencyOk ? ev.latencyMs : 0),
      latencySamples: s.latencySamples + (latencyOk ? 1 : 0),
      toneAccuracy,
      toneConfusion,
      modeCounts: { ...s.modeCounts, [ev.prompt]: s.modeCounts[ev.prompt] + 1 },
      daily: {
        ...s.daily,
        [today]: {
          reviewed: day.reviewed + (learning ? 0 : 1),
          correct: day.correct + (isCorrect ? 1 : 0),
          newCards: day.newCards + (isNew ? 1 : 0),
        },
      },
    },
  };
}

/** Streak as it should be displayed today (a missed day breaks it even before the next review). */
export function effectiveStreak(state: UserState, now: Date = new Date()): number {
  const last = state.stats.lastActiveDate;
  if (!last) return 0;
  return daysBetween(last, dayKey(now)) <= 1 ? state.stats.currentStreak : 0;
}

// ---------- Session queue ----------

const MIXED_PROMPTS: PromptKind[] = ['hanzi', 'pinyin', 'english'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function filterPool(vocab: VocabItem[], req: Pick<SessionRequest, 'levels' | 'topics' | 'wordIds'>): VocabItem[] {
  const ids = req.wordIds ? new Set(req.wordIds) : null;
  return vocab.filter(
    (v) =>
      (!ids || ids.has(v.id)) &&
      (req.levels.length === 0 || req.levels.includes(v.hskLevel)) &&
      (req.topics.length === 0 || v.topics.some((t) => req.topics.includes(t))),
  );
}

export interface QueueSummary {
  dueCount: number;
  newAvailable: number;
  reviewedToday: number;
  remainingToday: number;
}

export function queueSummary(vocab: VocabItem[], state: UserState, req: SessionRequest, now = new Date()): QueueSummary {
  const pool = filterPool(vocab, req);
  const today = state.stats.daily[dayKey(now)] ?? { reviewed: 0, correct: 0, newCards: 0 };
  const newLeft = Math.max(0, state.settings.newCardsPerDay - today.newCards);
  return {
    dueCount: pool.filter((v) => isDue(state.progress[v.id], now)).length,
    newAvailable: Math.min(newLeft, pool.filter((v) => !state.progress[v.id]).length),
    reviewedToday: today.reviewed,
    remainingToday: Math.max(0, state.settings.dailyCap - today.reviewed),
  };
}

export function buildSession(vocab: VocabItem[], state: UserState, req: SessionRequest, now = new Date()): SessionCard[] {
  const pool = filterPool(vocab, req);
  const summary = queueSummary(vocab, state, req, now);
  const limit = req.ignoreCap ? (req.limit ?? 20) : Math.min(req.limit ?? Infinity, summary.remainingToday);

  // Most overdue first.
  const due = pool
    .filter((v) => isDue(state.progress[v.id], now))
    .sort((a, b) => state.progress[a.id].dueDate.localeCompare(state.progress[b.id].dueDate));

  // If the learner has an overdue backlog, suppress new cards until reviews are cleared.
  const hasBacklog = due.length >= summary.remainingToday;
  const newAllowed = hasBacklog ? 0 : summary.newAvailable;

  // New words follow curriculum order: HSK level first, then dataset (unit) order.
  const fresh = pool
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !state.progress[v.id])
    .sort((a, b) => a.v.hskLevel - b.v.hskLevel || a.i - b.i)
    .map(({ v }) => v)
    .slice(0, newAllowed);

  // Interleave: two reviews, then one new card.
  const ordered: { item: VocabItem; isNew: boolean }[] = [];
  let di = 0;
  let ni = 0;
  while (di < due.length || ni < fresh.length) {
    for (let k = 0; k < 2 && di < due.length; k++) ordered.push({ item: due[di++], isNew: false });
    if (ni < fresh.length) ordered.push({ item: fresh[ni++], isNew: true });
  }

  if (req.includeNotDue && ordered.length < limit) {
    const taken = new Set(ordered.map((o) => o.item.id));
    const extra = pool
      .filter((v) => !taken.has(v.id) && state.progress[v.id])
      .sort((a, b) => weakness(state.progress[b.id]) - weakness(state.progress[a.id]));
    for (const item of extra) ordered.push({ item, isNew: false });
  }

  const picked = ordered.slice(0, Number.isFinite(limit) ? limit : ordered.length);
  const mixedOrder = shuffle(MIXED_PROMPTS);
  return picked.map((o, i) => ({
    item: o.item,
    isNew: o.isNew,
    prompt: promptFor(req.mode, i, mixedOrder),
  }));
}

export function promptFor(mode: SessionRequest['mode'], i: number, mixedOrder: PromptKind[]): PromptKind {
  switch (mode) {
    case 'hanzi':
      return 'hanzi';
    case 'pinyin':
      return 'pinyin';
    case 'audio':
      return 'audio';
    case 'tone':
      return 'tone';
    case 'english':
      return 'english';
    case 'mixed':
      return mixedOrder[i % mixedOrder.length];
  }
}

/** Higher = weaker. */
export function weakness(p: CardProgress | undefined): number {
  if (!p) return 0;
  return p.failureCount * 2 + (INITIAL_EASE - p.easeFactor) * 4 - p.consecutiveCorrect + (p.isLeech ? 5 : 0);
}

export function itemHasTone(item: VocabItem, tone: ToneKey): boolean {
  return tonesOf(item).includes(tone);
}
