import { fsrs, generatorParameters, createEmptyCard, type Card as FSRSCard } from 'ts-fsrs';
import type {
  CardDirection,
  CardProgress,
  DirectionProgress,
  Grade,
  HistoryEntry,
  HskLevel,
  PromptKind,
  SessionCard,
  SessionRequest,
  ToneKey,
  UserState,
  VocabItem,
  WordProgress,
} from '../types';
import { addDays, dayKey, daysBetween } from './dates';
import { tonesOf } from './pinyinHelper';

export const fsrsEngine = fsrs(generatorParameters({ request_retention: 0.9 }));

export const LEECH_THRESHOLD = 4;
export const MAX_HISTORY = 50;
export const MATURE_STABILITY_DAYS = 21;

export const GRADE_LABELS: Record<Grade, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export function toFSRSCard(p: DirectionProgress): FSRSCard {
  return {
    due: new Date(p.due),
    stability: p.stability,
    difficulty: p.difficulty,
    elapsed_days: p.elapsed_days,
    scheduled_days: p.scheduled_days,
    reps: p.reps,
    lapses: p.lapses,
    state: p.state,
    last_review: p.last_review ? new Date(p.last_review) : undefined,
    learning_steps: 0,
  };
}

export function newDirectionProgress(now: Date = new Date()): DirectionProgress {
  const empty = createEmptyCard(now);
  return {
    due: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    state: empty.state,
    last_review: undefined,
    history: [],
    failureCount: 0,
    consecutiveCorrect: 0,
    isLeech: false,
  };
}

export function newProgress(now: Date = new Date()): CardProgress {
  return {
    recognition: newDirectionProgress(now),
  };
}

/** Next interval in days for a grade using FSRS without mutating anything. */
export function nextInterval(p: DirectionProgress | undefined, grade: Grade, now = new Date()): number {
  const card = p ? toFSRSCard(p) : createEmptyCard(now);
  const scheduling = fsrsEngine.repeat(card, now) as unknown as Record<number, { card: FSRSCard }>;
  const resultCard = scheduling[grade]?.card;
  return resultCard ? Math.max(1, Math.round(resultCard.scheduled_days)) : 1;
}

export function applyGrade(
  prev: DirectionProgress | undefined,
  grade: Grade,
  meta: { now?: Date; correct: boolean; mode: PromptKind; latencyMs?: number },
): DirectionProgress {
  const now = meta.now ?? new Date();
  const base = prev ? { ...prev, history: [...prev.history] } : newDirectionProgress(now);
  const fsrsCard = toFSRSCard(base);
  const scheduling = fsrsEngine.repeat(fsrsCard, now) as unknown as Record<number, { card: FSRSCard }>;
  const updatedCard = scheduling[grade].card;

  const isAgain = grade === 1;
  const failureCount = isAgain ? base.failureCount + 1 : base.failureCount;
  const consecutiveCorrect = isAgain ? 0 : base.consecutiveCorrect + 1;
  let isLeech = base.isLeech || failureCount > LEECH_THRESHOLD;
  let curedLeech = base.curedLeech;

  if (isLeech && consecutiveCorrect >= 3) {
    isLeech = false;
    curedLeech = true;
  }

  const historyEntry: HistoryEntry = {
    date: now.toISOString(),
    grade,
    correct: grade >= 2,
    mode: meta.mode,
    latencyMs: meta.latencyMs,
    stability: base.stability,
  };

  const history = [...base.history, historyEntry].slice(-MAX_HISTORY);

  return {
    due: updatedCard.due.toISOString(),
    stability: updatedCard.stability,
    difficulty: updatedCard.difficulty,
    elapsed_days: updatedCard.elapsed_days,
    scheduled_days: updatedCard.scheduled_days,
    reps: updatedCard.reps,
    lapses: updatedCard.lapses,
    state: updatedCard.state,
    last_review: now.toISOString(),
    history,
    failureCount,
    consecutiveCorrect,
    isLeech,
    curedLeech,
  };
}

export function isDirectionDue(p: DirectionProgress | undefined, now: Date = new Date()): boolean {
  if (!p) return false;
  // Anything due on or before today
  return new Date(p.due) <= addDays(new Date(now.toDateString()), 1);
}

export function isWordDue(p: CardProgress | undefined, now: Date = new Date()): boolean {
  if (!p || p.manuallyMarkedKnown) return false;
  return isDirectionDue(p.recognition, now) || isDirectionDue(p.recall, now);
}

export function isDue(p: CardProgress | undefined, now: Date = new Date()): boolean {
  return isWordDue(p, now);
}

export function isWordStudied(p: CardProgress | undefined): boolean {
  if (!p) return false;
  return Boolean(p.manuallyMarkedKnown || p.recognition || p.recall);
}

export function isWordLearned(p: CardProgress | undefined): boolean {
  if (!p) return false;
  if (p.manuallyMarkedKnown) return true;
  return (p.recognition?.reps ?? 0) >= 2 || (p.recall?.reps ?? 0) >= 2;
}

export interface ReviewEvent {
  item: VocabItem;
  direction?: CardDirection;
  grade: Grade;
  correct: boolean;
  prompt: PromptKind;
  latencyMs: number;
  tones?: { expected: ToneKey; given: ToneKey }[];
}

export function recordReview(
  state: UserState,
  ev: ReviewEvent,
  now: Date = new Date(),
  opts: { learningStep?: boolean } = {},
): UserState {
  const today = dayKey(now);
  const isCorrect = ev.grade >= 2;
  const dir: CardDirection = ev.direction ?? 'recognition';
  const wordProg: WordProgress = state.progress[ev.item.id] ?? {};
  const prevDir = wordProg[dir];
  const isNew = !prevDir;
  const learning = Boolean(opts.learningStep && prevDir);

  const updatedDir: DirectionProgress = (learning && prevDir)
    ? {
        ...prevDir,
        history: [
          ...prevDir.history,
          {
            date: now.toISOString(),
            grade: ev.grade,
            correct: isCorrect,
            mode: ev.prompt,
            latencyMs: ev.latencyMs,
            learningStep: true,
            stability: prevDir.stability,
          },
        ].slice(-MAX_HISTORY),
      }
    : applyGrade(prevDir, ev.grade, { now, correct: isCorrect, mode: ev.prompt, latencyMs: ev.latencyMs });

  const updatedWord: WordProgress = {
    ...wordProg,
    [dir]: updatedDir,
  };

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
  const latencyOk = ev.latencyMs > 0 && ev.latencyMs < 120_000;

  return {
    ...state,
    progress: { ...state.progress, [ev.item.id]: updatedWord },
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
      modeCounts: { ...s.modeCounts, [ev.prompt]: (s.modeCounts[ev.prompt] ?? 0) + 1 },
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

export function effectiveStreak(state: UserState, now: Date = new Date()): number {
  const last = state.stats.lastActiveDate;
  if (!last) return 0;
  return daysBetween(last, dayKey(now)) <= 1 ? state.stats.currentStreak : 0;
}

/**
 * Headline stat: True Retention.
 * The percentage of reviews on mature cards (stability >= 21 days) answered correctly.
 */
export function calculateTrueRetention(state: UserState): {
  rate: number | null;
  matureCorrect: number;
  matureTotal: number;
} {
  let matureCorrect = 0;
  let matureTotal = 0;

  for (const wp of Object.values(state.progress)) {
    if (!wp) continue;
    for (const dp of [wp.recognition, wp.recall]) {
      if (!dp) continue;
      for (const h of dp.history) {
        if ((h.stability ?? 0) >= MATURE_STABILITY_DAYS) {
          matureTotal++;
          if (h.correct || h.grade >= 2) matureCorrect++;
        }
      }
    }
  }

  return {
    rate: matureTotal > 0 ? Math.round((matureCorrect / matureTotal) * 100) : null,
    matureCorrect,
    matureTotal,
  };
}

/**
 * Automatically chooses the prompt type based on card direction and learning stability:
 * Recognition: MC recognition -> Pinyin typing drill -> Listening drill
 * Recall: English -> choose Hanzi / recall
 */
export function promptForDirection(
  direction: CardDirection,
  p: DirectionProgress | undefined,
  overrideMode?: PromptKind,
  item?: VocabItem,
): PromptKind {
  if (overrideMode && overrideMode !== 'english' && overrideMode !== 'hanzi') {
    return overrideMode;
  }
  const stability = p?.stability ?? 0;
  if (direction === 'recognition') {
    if (stability < 3) return 'hanzi';
    if (item?.exampleSentence && stability >= 3 && stability < 7) return 'cloze';
    if (stability < 14) return 'pinyin';
    return 'audio';
  } else {
    return 'english';
  }
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
  estimatedMinutes: number;
}

export function queueSummary(vocab: VocabItem[], state: UserState, req?: Partial<SessionRequest>, now = new Date()): QueueSummary {
  const levels = req?.levels ?? [];
  const topics = req?.topics ?? [];
  const wordIds = req?.wordIds;
  const pool = filterPool(vocab, { levels, topics, wordIds });
  const today = state.stats.daily[dayKey(now)] ?? { reviewed: 0, correct: 0, newCards: 0 };
  const newLeft = Math.max(0, state.settings.newCardsPerDay - today.newCards);

  let dueCount = 0;
  let unstartedWords = 0;

  for (const v of pool) {
    const wp = state.progress[v.id];
    if (wp?.manuallyMarkedKnown) continue;
    if (!wp || (!wp.recognition && !wp.recall)) {
      unstartedWords++;
    } else {
      if (isDirectionDue(wp.recognition, now)) dueCount++;
      if (isDirectionDue(wp.recall, now)) dueCount++;
    }
  }

  const newAvailable = Math.min(newLeft, unstartedWords);
  const remainingToday = Math.max(0, state.settings.dailyCap - today.reviewed);
  const sessionCount = Math.min(dueCount + newAvailable, remainingToday);
  const estimatedMinutes = Math.max(1, Math.round(sessionCount * 0.4));

  return {
    dueCount,
    newAvailable,
    reviewedToday: today.reviewed,
    remainingToday,
    estimatedMinutes,
  };
}

export function buildSession(vocab: VocabItem[], state: UserState, req: SessionRequest, now = new Date()): SessionCard[] {
  const pool = filterPool(vocab, req);
  const summary = queueSummary(vocab, state, req, now);
  const limit = req.ignoreCap ? (req.limit ?? 20) : Math.min(req.limit ?? Infinity, summary.remainingToday);

  const dueCards: { item: VocabItem; direction: CardDirection; dueTime: string; p?: DirectionProgress }[] = [];

  for (const item of pool) {
    const wp = state.progress[item.id];
    if (wp?.manuallyMarkedKnown) continue;
    if (wp?.recognition && isDirectionDue(wp.recognition, now)) {
      dueCards.push({ item, direction: 'recognition', dueTime: wp.recognition.due, p: wp.recognition });
    }
    if (wp?.recall && isDirectionDue(wp.recall, now)) {
      dueCards.push({ item, direction: 'recall', dueTime: wp.recall.due, p: wp.recall });
    }
  }

  dueCards.sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const hasBacklog = dueCards.length >= summary.remainingToday;
  const newAllowed = hasBacklog ? 0 : summary.newAvailable;

  const fresh = pool
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !isWordStudied(state.progress[v.id]))
    .sort((a, b) => a.v.hskLevel - b.v.hskLevel || a.i - b.i)
    .map(({ v }) => v)
    .slice(0, newAllowed);

  const ordered: { item: VocabItem; direction: CardDirection; isNew: boolean; p?: DirectionProgress }[] = [];
  let di = 0;
  let ni = 0;
  while (di < dueCards.length || ni < fresh.length) {
    for (let k = 0; k < 2 && di < dueCards.length; k++) {
      ordered.push({ ...dueCards[di++], isNew: false });
    }
    if (ni < fresh.length) {
      ordered.push({ item: fresh[ni++], direction: 'recognition', isNew: true });
    }
  }

  if (req.includeNotDue && ordered.length < limit) {
    const taken = new Set(ordered.map((o) => `${o.item.id}:${o.direction}`));
    for (const v of pool) {
      const wp = state.progress[v.id];
      if (!wp) continue;
      if (wp.recognition && !taken.has(`${v.id}:recognition`)) {
        ordered.push({ item: v, direction: 'recognition', isNew: false, p: wp.recognition });
      }
      if (ordered.length >= limit) break;
    }
  }

  const picked = ordered.slice(0, Number.isFinite(limit) ? limit : ordered.length);

  return picked.map((o) => {
    const prompt = req.mode !== 'mixed'
      ? (req.mode as PromptKind)
      : promptForDirection(o.direction, o.p, undefined, o.item);

    return {
      item: o.item,
      direction: o.direction,
      isNew: o.isNew,
      prompt,
    };
  });
}

/** Bulk mark or unmark an entire level as known. */
export function bulkMarkLevelKnown(
  state: UserState,
  vocab: VocabItem[],
  level: HskLevel,
  known: boolean,
): UserState {
  const levelWords = vocab.filter((v) => v.hskLevel === level);
  const updatedProgress = { ...state.progress };

  for (const w of levelWords) {
    const cur = updatedProgress[w.id] ?? {};
    if (known) {
      updatedProgress[w.id] = {
        ...cur,
        manuallyMarkedKnown: true,
      };
    } else {
      const next = { ...cur };
      delete next.manuallyMarkedKnown;
      if (!next.recognition && !next.recall) {
        delete updatedProgress[w.id];
      } else {
        updatedProgress[w.id] = next;
      }
    }
  }

  const knownLevels = new Set(state.knownLevels ?? []);
  if (known) knownLevels.add(level);
  else knownLevels.delete(level);

  return {
    ...state,
    progress: updatedProgress,
    knownLevels: [...knownLevels].sort((a, b) => a - b),
  };
}

export function weakness(p: CardProgress | undefined): number {
  if (!p) return 0;
  const recog = p.recognition;
  if (!recog) return 0;
  return recog.failureCount * 2 - recog.consecutiveCorrect + (recog.isLeech ? 5 : 0);
}

export function itemHasTone(item: VocabItem, tone: ToneKey): boolean {
  return tonesOf(item).includes(tone);
}

export function promptFor(mode: string, i: number, mixedOrder: PromptKind[]): PromptKind {
  if (mode === 'hanzi') return 'hanzi';
  if (mode === 'pinyin') return 'pinyin';
  if (mode === 'audio') return 'audio';
  if (mode === 'english') return 'english';
  if (mode === 'tone') return 'tone';
  return mixedOrder[i % mixedOrder.length];
}

