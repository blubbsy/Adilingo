import type { CardProgress, DirectionProgress, HistoryEntry, UserState } from '../types';
import type { GrammarProgress, GrammarPointProgress, PathProgress } from '../grammar/grammarStorage';

function mergeDirection(local?: DirectionProgress, remote?: DirectionProgress): DirectionProgress | undefined {
  if (!local) return remote;
  if (!remote) return local;

  // Compare last_review timestamp
  const localTime = local.last_review ? new Date(local.last_review).getTime() : 0;
  const remoteTime = remote.last_review ? new Date(remote.last_review).getTime() : 0;

  // Use base from whichever was reviewed more recently, or has higher reps
  const base = localTime >= remoteTime ? (local.reps >= remote.reps ? local : remote) : remote;

  // Merge histories without duplicate dates
  const historyMap = new Map<string, HistoryEntry>();
  for (const h of [...(local.history || []), ...(remote.history || [])]) {
    historyMap.set(`${h.date}-${h.grade}`, h);
  }
  const mergedHistory = Array.from(historyMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return {
    ...base,
    history: mergedHistory,
    reps: Math.max(local.reps, remote.reps),
    consecutiveCorrect: Math.max(local.consecutiveCorrect, remote.consecutiveCorrect),
    isLeech: (local.isLeech || remote.isLeech) && !(local.curedLeech || remote.curedLeech),
    curedLeech: Boolean(local.curedLeech || remote.curedLeech),
  };
}

function mergeCardProgress(local?: CardProgress, remote?: CardProgress): CardProgress | undefined {
  if (!local) return remote;
  if (!remote) return local;

  return {
    recognition: mergeDirection(local.recognition, remote.recognition),
    recall: mergeDirection(local.recall, remote.recall),
    manuallyMarkedKnown: Boolean(local.manuallyMarkedKnown || remote.manuallyMarkedKnown),
  };
}

/** Merges two UserState trees without data loss. */
export function mergeUserStates(local: UserState, remote: UserState): UserState {
  // 1. Merge progress cards
  const allWordIds = new Set([...Object.keys(local.progress || {}), ...Object.keys(remote.progress || {})]);
  const mergedProgress: Record<string, CardProgress> = {};
  for (const id of allWordIds) {
    const card = mergeCardProgress(local.progress?.[id], remote.progress?.[id]);
    if (card) mergedProgress[id] = card;
  }

  // 2. Merge daily logs
  const allDates = new Set([...Object.keys(local.stats.daily || {}), ...Object.keys(remote.stats.daily || {})]);
  const mergedDaily: UserState['stats']['daily'] = {};
  for (const d of allDates) {
    const l = local.stats.daily?.[d];
    const r = remote.stats.daily?.[d];
    mergedDaily[d] = {
      reviewed: Math.max(l?.reviewed ?? 0, r?.reviewed ?? 0),
      correct: Math.max(l?.correct ?? 0, r?.correct ?? 0),
      newCards: Math.max(l?.newCards ?? 0, r?.newCards ?? 0),
    };
  }

  // 3. Union unlocked badges & stars
  const unlockedBadges = Array.from(new Set([...(local.unlockedBadges || []), ...(remote.unlockedBadges || [])]));
  const starredWords = Array.from(new Set([...(local.starredWords || []), ...(remote.starredWords || [])]));
  const knownLevels = Array.from(new Set([...(local.knownLevels || []), ...(remote.knownLevels || [])]));

  // 4. Tone accuracy
  const toneAccuracy = { ...local.stats.toneAccuracy };
  for (const t of ['1', '2', '3', '4', '0'] as const) {
    const l = local.stats.toneAccuracy?.[t];
    const r = remote.stats.toneAccuracy?.[t];
    toneAccuracy[t] = {
      correct: Math.max(l?.correct ?? 0, r?.correct ?? 0),
      total: Math.max(l?.total ?? 0, r?.total ?? 0),
    };
  }

  // 5. Mode counts
  const modeCounts = { ...local.stats.modeCounts };
  for (const m of ['hanzi', 'pinyin', 'english', 'audio', 'tone'] as const) {
    modeCounts[m] = Math.max(local.stats.modeCounts?.[m] ?? 0, remote.stats.modeCounts?.[m] ?? 0);
  }

  const lastActiveDate = [local.stats.lastActiveDate, remote.stats.lastActiveDate].filter(Boolean).sort().pop() || '';

  return {
    ...local,
    progress: mergedProgress,
    stats: {
      ...local.stats,
      currentStreak: Math.max(local.stats.currentStreak, remote.stats.currentStreak),
      longestStreak: Math.max(local.stats.longestStreak, remote.stats.longestStreak),
      lastActiveDate,
      totalReviewed: Math.max(local.stats.totalReviewed, remote.stats.totalReviewed),
      totalCorrect: Math.max(local.stats.totalCorrect, remote.stats.totalCorrect),
      totalLatencyMs: Math.max(local.stats.totalLatencyMs, remote.stats.totalLatencyMs),
      latencySamples: Math.max(local.stats.latencySamples, remote.stats.latencySamples),
      daily: mergedDaily,
      toneAccuracy,
      modeCounts,
    },
    unlockedBadges,
    starredWords,
    knownLevels,
  };
}

/** Merges GrammarProgress objects */
export function mergeGrammar(localRaw: unknown, remoteRaw: unknown): GrammarProgress | null {
  const local = (localRaw && typeof localRaw === 'object' ? localRaw : null) as GrammarProgress | null;
  const remote = (remoteRaw && typeof remoteRaw === 'object' ? remoteRaw : null) as GrammarProgress | null;

  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;

  const allPointIds = new Set([...Object.keys(local.points || {}), ...Object.keys(remote.points || {})]);
  const mergedPoints: Record<string, GrammarPointProgress> = {};
  for (const id of allPointIds) {
    const lp = local.points?.[id];
    const rp = remote.points?.[id];
    if (!lp) {
      if (rp) mergedPoints[id] = rp;
      continue;
    }
    if (!rp) {
      mergedPoints[id] = lp;
      continue;
    }
    mergedPoints[id] = {
      attempts: Math.max(lp.attempts, rp.attempts),
      correct: Math.max(lp.correct, rp.correct),
      completed: Boolean(lp.completed || rp.completed),
      bestScore: Math.max(lp.bestScore ?? 0, rp.bestScore ?? 0),
      lastStudied: [lp.lastStudied, rp.lastStudied].filter(Boolean).sort().pop(),
    };
  }

  const allPathIds = new Set([...Object.keys(local.paths || {}), ...Object.keys(remote.paths || {})]);
  const mergedPaths: Record<string, PathProgress> = {};
  for (const id of allPathIds) {
    const lSteps = local.paths?.[id]?.completedSteps || [];
    const rSteps = remote.paths?.[id]?.completedSteps || [];
    mergedPaths[id] = {
      completedSteps: Array.from(new Set([...lSteps, ...rSteps])),
    };
  }

  return {
    version: 1,
    points: mergedPoints,
    paths: mergedPaths,
  };
}
