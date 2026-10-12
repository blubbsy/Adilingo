import { useSyncExternalStore } from 'react';
import { ALL_MODULES, CORE_MODULES, type FoundationModule } from './questions';

/*
 * Foundations progress: one Leitner-style box per module. Passing a round (>= 80 %) moves the module up a box and
 * pushes the next check further away; failing one (< 60 %) moves it down. Modules fall "due" again when the
 * interval of their box has passed, so basics are re-tested instead of silently forgotten.
 */

export interface ModuleProgress {
  /** 0 = needs a pass, 1..4 = passed, longer interval each. */
  box: number;
  /** Times the module was passed (0 = never). */
  passes: number;
  rounds: number;
  lastScore?: number;
  bestScore?: number;
  lastPassed?: string;
  lastPracticed?: string;
}

export interface FoundationsProgress {
  version: 1;
  modules: Partial<Record<FoundationModule, ModuleProgress>>;
}

export const PASS_RATIO = 0.8;
export const FAIL_RATIO = 0.6;
/** Days until a module is due again, by box. */
export const INTERVAL_DAYS = [0, 3, 7, 21, 60] as const;
export const MAX_BOX = INTERVAL_DAYS.length - 1;

const DAY_MS = 86_400_000;
const LS_KEY = 'adilingo:foundations';

export const emptyFoundations = (): FoundationsProgress => ({ version: 1, modules: {} });

export type ModuleStatus = 'new' | 'due' | 'ok';

export function moduleStatus(p: ModuleProgress | undefined, now = Date.now()): ModuleStatus {
  if (!p || p.passes === 0) return 'new';
  if (p.box === 0 || !p.lastPassed) return 'due';
  const dueAt = Date.parse(p.lastPassed) + INTERVAL_DAYS[Math.min(p.box, MAX_BOX)] * DAY_MS;
  return now >= dueAt ? 'due' : 'ok';
}

/** Date the module falls due (for modules that are currently ok). */
export function dueDate(p: ModuleProgress | undefined): Date | null {
  if (!p || !p.lastPassed || p.box === 0) return null;
  return new Date(Date.parse(p.lastPassed) + INTERVAL_DAYS[Math.min(p.box, MAX_BOX)] * DAY_MS);
}

export function recordRound(
  progress: FoundationsProgress,
  module: FoundationModule,
  correct: number,
  total: number,
  now = Date.now(),
): FoundationsProgress {
  if (total <= 0) return progress;
  const prev = progress.modules[module] ?? { box: 0, passes: 0, rounds: 0 };
  const ratio = correct / total;
  const next: ModuleProgress = {
    ...prev,
    rounds: prev.rounds + 1,
    lastScore: ratio,
    bestScore: Math.max(prev.bestScore ?? 0, ratio),
    lastPracticed: new Date(now).toISOString(),
  };
  if (ratio >= PASS_RATIO) {
    next.box = Math.min(prev.box + 1, MAX_BOX);
    next.passes = prev.passes + 1;
    next.lastPassed = new Date(now).toISOString();
  } else if (ratio < FAIL_RATIO && prev.passes > 0) {
    next.box = Math.max(prev.box - 1, 0);
    // A box-0 module is due straight away; keep lastPassed so the history stays visible.
  }
  return { ...progress, modules: { ...progress.modules, [module]: next } };
}

export interface GateSummary {
  /** Core modules never passed. */
  missing: FoundationModule[];
  /** Modules passed before but due for a re-check. */
  due: FoundationModule[];
  /** Everything that needs attention, core first. */
  attention: FoundationModule[];
}

export function gateSummary(progress: FoundationsProgress, now = Date.now()): GateSummary {
  const missing = CORE_MODULES.filter((m) => moduleStatus(progress.modules[m], now) === 'new');
  const due = ALL_MODULES.filter((m) => moduleStatus(progress.modules[m], now) === 'due');
  const attention = [...missing, ...due.filter((m) => CORE_MODULES.includes(m)), ...due.filter((m) => !CORE_MODULES.includes(m))];
  return { missing, due, attention };
}

// ---------- sanitising & storage ----------

const num = (v: unknown, max = 1e6): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0);
const ratio = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined);
const iso = (v: unknown): string | undefined => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined);

export function sanitizeFoundations(raw: unknown): FoundationsProgress {
  const out = emptyFoundations();
  if (typeof raw !== 'object' || raw === null) return out;
  const mods = (raw as { modules?: unknown }).modules;
  if (typeof mods !== 'object' || mods === null) return out;
  for (const id of ALL_MODULES) {
    const m = (mods as Record<string, unknown>)[id];
    if (typeof m !== 'object' || m === null) continue;
    const o = m as Record<string, unknown>;
    out.modules[id] = {
      box: Math.min(num(o.box), MAX_BOX),
      passes: num(o.passes),
      rounds: num(o.rounds),
      lastScore: ratio(o.lastScore),
      bestScore: ratio(o.bestScore),
      lastPassed: iso(o.lastPassed),
      lastPracticed: iso(o.lastPracticed),
    };
  }
  return out;
}

let current: FoundationsProgress | null = null;
const listeners = new Set<() => void>();

function read(): FoundationsProgress {
  try {
    return sanitizeFoundations(JSON.parse(window.localStorage.getItem(LS_KEY) ?? 'null'));
  } catch {
    return emptyFoundations();
  }
}

function snapshot(): FoundationsProgress {
  current ??= read();
  return current;
}

function commit(next: FoundationsProgress) {
  current = next;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota: progress then lasts for this session only */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY) {
      current = read();
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useFoundations(): { progress: FoundationsProgress; record: (m: FoundationModule, correct: number, total: number) => void; reset: () => void } {
  const progress = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    progress,
    record: (m, correct, total) => commit(recordRound(snapshot(), m, correct, total)),
    reset: () => commit(emptyFoundations()),
  };
}

/** For tests. */
export function __setFoundationsForTest(p: FoundationsProgress | null) {
  current = p;
}
