import type { UserState, VocabItem } from '../types';
import type { GrammarProgress } from './grammarStorage';
import type { LearningPath, PathStep, PathUnit } from './types';

/** A word counts as learned once it has been recalled successfully at least twice in a row (SM-2 repetitions). */
export const LEARNED_REPETITIONS = 2;

export interface PathContext {
  vocabById: ReadonlyMap<string, VocabItem>;
  vocabProgress: UserState['progress'];
  grammar: GrammarProgress;
}

export function isWordLearned(id: string, vocabProgress: UserState['progress']): boolean {
  return (vocabProgress[id]?.repetitions ?? 0) >= LEARNED_REPETITIONS;
}

export function wordRepetitions(id: string, vocabProgress: UserState['progress']): number {
  return vocabProgress[id]?.repetitions ?? 0;
}

export interface StepRepetitionStats {
  total: number;
  learned: number;
  partiallyLearned: number;
}

export function stepRepetitionStats(step: PathStep, ctx: PathContext): StepRepetitionStats {
  const ids = stepWordIds(step, ctx);
  let learned = 0;
  let partiallyLearned = 0;
  for (const id of ids) {
    const reps = wordRepetitions(id, ctx.vocabProgress);
    if (reps >= LEARNED_REPETITIONS) {
      learned++;
    } else if (reps > 0) {
      partiallyLearned++;
    }
  }
  return { total: ids.length, learned, partiallyLearned };
}

/** Word ids of a vocab step that exist in the loaded vocabulary. */
export function stepWordIds(step: PathStep, ctx: PathContext): string[] {
  return step.type === 'vocab' ? step.wordIds.filter((id) => ctx.vocabById.has(id)) : [];
}

/** Done purely from current learning state (not from stored completion). */
export function isStepDerivedDone(step: PathStep, ctx: PathContext): boolean {
  if (step.type === 'grammar') return ctx.grammar.points[step.grammarId]?.completed === true;
  const ids = stepWordIds(step, ctx);
  return ids.length > 0 && ids.every((id) => isWordLearned(id, ctx.vocabProgress));
}

/** Done = recorded as completed once (sticky, so lapses don't re-lock units) or currently derived as done. */
export function isStepDone(path: LearningPath, step: PathStep, ctx: PathContext): boolean {
  return (ctx.grammar.paths[path.id]?.completedSteps.includes(step.id) ?? false) || isStepDerivedDone(step, ctx);
}

export function unitDoneCount(path: LearningPath, unit: PathUnit, ctx: PathContext): number {
  return unit.steps.filter((s) => isStepDone(path, s, ctx)).length;
}

export function isUnitDone(path: LearningPath, unit: PathUnit, ctx: PathContext): boolean {
  return unitDoneCount(path, unit, ctx) === unit.steps.length;
}

/** A unit unlocks when the previous unit is complete; the first unit is always open. */
export function isUnitUnlocked(path: LearningPath, index: number, ctx: PathContext): boolean {
  return index === 0 || isUnitDone(path, path.units[index - 1], ctx);
}

/**
 * True when a unit is locked because a vocab step in the previous unit
 * has words reviewed at least once but still pending review 2 to reach LEARNED_REPETITIONS.
 */
export function isUnitPendingVocabReview(path: LearningPath, index: number, ctx: PathContext): boolean {
  if (index === 0) return false;
  const prevUnit = path.units[index - 1];
  if (!prevUnit || isUnitDone(path, prevUnit, ctx)) return false;
  return prevUnit.steps.some((step) => {
    if (step.type !== 'vocab') return false;
    if (isStepDone(path, step, ctx)) return false;
    const { total, learned, partiallyLearned } = stepRepetitionStats(step, ctx);
    return total > 0 && learned < total && partiallyLearned > 0;
  });
}

export function pathStats(path: LearningPath, ctx: PathContext): { done: number; total: number; ratio: number } {
  let done = 0;
  let total = 0;
  for (const u of path.units) {
    total += u.steps.length;
    done += unitDoneCount(path, u, ctx);
  }
  return { done, total, ratio: total ? done / total : 0 };
}

/** Steps that are derived-done but not yet recorded, grouped by path (used to persist sticky completion). */
export function unrecordedDoneSteps(paths: LearningPath[], ctx: PathContext): { pathId: string; stepIds: string[] }[] {
  const out: { pathId: string; stepIds: string[] }[] = [];
  for (const p of paths) {
    const recorded = ctx.grammar.paths[p.id]?.completedSteps ?? [];
    const ids = p.units.flatMap((u) => u.steps).filter((s) => !recorded.includes(s.id) && isStepDerivedDone(s, ctx)).map((s) => s.id);
    if (ids.length) out.push({ pathId: p.id, stepIds: ids });
  }
  return out;
}
