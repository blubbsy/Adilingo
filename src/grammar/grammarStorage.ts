import { useCallback, useEffect, useRef, useState } from 'react';
import { createStore, get, set, type UseStore } from 'idb-keyval';

/*
 * Grammar + learning-path progress, stored separately from the main vocab state.
 * IndexedDB (idb-keyval) is primary; localStorage mirrors every save as a fallback.
 */

export interface GrammarPointProgress {
  /** Exercises answered (all sessions). */
  attempts: number;
  /** Exercises answered correctly (all sessions). */
  correct: number;
  /** Reached >= 80 % in a practice session at least once. */
  completed: boolean;
  /** ISO timestamp of the last finished practice session. */
  lastStudied?: string;
  /** Best session score, 0..1. */
  bestScore?: number;
}

export interface PathProgress {
  completedSteps: string[];
}

export interface GrammarProgress {
  version: 1;
  points: Record<string, GrammarPointProgress>;
  paths: Record<string, PathProgress>;
}

export const GRAMMAR_PROGRESS_VERSION = 1 as const;
/** Pass mark for a practice session. */
export const PASS_RATIO = 0.8;

const IDB_KEY = 'progress';
const LS_KEY = 'hanzi-flow:grammar-progress';

export function createEmptyGrammarProgress(): GrammarProgress {
  return { version: GRAMMAR_PROGRESS_VERSION, points: {}, paths: {} };
}

// ---------- Sanitising ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const SAFE_KEY = /^[\w.:-]{1,100}$/;

function sanitizePoint(v: unknown): GrammarPointProgress | null {
  if (!isObj(v)) return null;
  const attempts = count(v.attempts);
  const correct = Math.min(count(v.correct), attempts);
  const out: GrammarPointProgress = { attempts, correct, completed: v.completed === true };
  if (typeof v.lastStudied === 'string' && !Number.isNaN(Date.parse(v.lastStudied))) out.lastStudied = v.lastStudied;
  if (typeof v.bestScore === 'number' && Number.isFinite(v.bestScore)) out.bestScore = Math.min(1, Math.max(0, v.bestScore));
  return out;
}

/** Validate and sanitise unknown input (e.g. from a backup file). Returns null when it isn't grammar progress at all. */
export function sanitizeGrammarProgress(raw: unknown): GrammarProgress | null {
  if (!isObj(raw)) return null;
  // v0 / unversioned data is accepted as long as the shape matches; future versions are rejected.
  if (raw.version !== undefined && raw.version !== GRAMMAR_PROGRESS_VERSION) return null;
  if (!isObj(raw.points) && !isObj(raw.paths)) return null;
  const out = createEmptyGrammarProgress();
  if (isObj(raw.points)) {
    for (const [id, p] of Object.entries(raw.points)) {
      if (!SAFE_KEY.test(id)) continue;
      const s = sanitizePoint(p);
      if (s) out.points[id] = s;
    }
  }
  if (isObj(raw.paths)) {
    for (const [id, p] of Object.entries(raw.paths)) {
      if (!SAFE_KEY.test(id) || !isObj(p) || !Array.isArray(p.completedSteps)) continue;
      const steps = p.completedSteps.filter((s): s is string => typeof s === 'string' && SAFE_KEY.test(s));
      out.paths[id] = { completedSteps: [...new Set(steps)] };
    }
  }
  return out;
}

// ---------- Backends ----------

let store: UseStore | null | undefined;
function getStore(): UseStore | null {
  if (store !== undefined) return store;
  try {
    store = typeof indexedDB !== 'undefined' ? createStore('hanzi-flow-grammar', 'kv') : null;
  } catch {
    store = null;
  }
  return store;
}

function readLocal(): unknown {
  try {
    if (typeof localStorage === 'undefined') return null;
    const s = localStorage.getItem(LS_KEY);
    return s ? (JSON.parse(s) as unknown) : null;
  } catch {
    return null;
  }
}

function writeLocal(p: GrammarProgress): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode: ignore */
  }
}

// ---------- Cross-tab sync & Notifications ----------

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hanzi-flow-grammar') : null;
export const TAB_ID = Math.random().toString(36).slice(2);

const listeners = new Set<(p: GrammarProgress) => void>();
function notify(p: GrammarProgress) {
  listeners.forEach((l) => l(p));
}

/** Notifies when another tab saves or resets grammar progress. */
export function onRemoteGrammarSave(cb: () => void): () => void {
  if (!channel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'saved' && e.data.from !== TAB_ID) cb();
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

if (channel) {
  channel.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'saved' && e.data.from !== TAB_ID) {
      void loadGrammarProgress()
        .then((loaded) => {
          notify(loaded);
        })
        .catch(() => {});
    }
  });
}

export async function loadGrammarProgress(): Promise<GrammarProgress> {
  const s = getStore();
  if (s) {
    try {
      const fromIdb = sanitizeGrammarProgress(await get<unknown>(IDB_KEY, s));
      if (fromIdb) return fromIdb;
    } catch {
      /* fall through to localStorage */
    }
  }
  return sanitizeGrammarProgress(readLocal()) ?? createEmptyGrammarProgress();
}

export async function saveGrammarProgress(progress: GrammarProgress): Promise<void> {
  writeLocal(progress);
  notify(progress);
  const s = getStore();
  if (s) {
    try {
      await set(IDB_KEY, progress, s);
    } catch {
      /* localStorage copy already written */
    }
  }
  channel?.postMessage({ type: 'saved', from: TAB_ID });
}

// ---------- Backup integration ----------

/** Deep copy that can be embedded in the main JSON backup, e.g. `{ ...backup, grammar: await exportableGrammarProgress() }`. */
export async function exportableGrammarProgress(): Promise<GrammarProgress> {
  const p = await loadGrammarProgress();
  return JSON.parse(JSON.stringify(p)) as GrammarProgress;
}

/**
 * Validate, sanitise and persist grammar progress from a backup. Replaces the current grammar progress.
 * Returns the imported progress, or null if `raw` is not valid grammar progress (nothing is written then).
 * Mounted `useGrammarProgress()` hooks pick up the change automatically.
 */
export async function importGrammarProgress(raw: unknown): Promise<GrammarProgress | null> {
  const clean = sanitizeGrammarProgress(raw);
  if (!clean) return null;
  await saveGrammarProgress(clean);
  return clean;
}

// ---------- Hook ----------

type Updater = (p: GrammarProgress) => GrammarProgress | null;

export interface GrammarProgressApi {
  progress: GrammarProgress;
  /** False until the stored progress has been loaded. */
  ready: boolean;
  /** Record a finished practice session. */
  recordSession: (pointId: string, correct: number, total: number) => void;
  /** Mark path steps as done (idempotent). */
  completeSteps: (pathId: string, stepIds: string[]) => void;
  reset: () => void;
}

export function useGrammarProgress(): GrammarProgressApi {
  const [progress, setProgress] = useState<GrammarProgress>(createEmptyGrammarProgress);
  const [ready, setReady] = useState(false);
  const latest = useRef(progress);
  const loadedRef = useRef(false);
  const pending = useRef<Updater[]>([]);

  useEffect(() => {
    let alive = true;
    loadGrammarProgress().then((loaded) => {
      if (!alive) return;
      // Apply any updates requested before loading finished on top of the stored state.
      let p = loaded;
      for (const fn of pending.current) p = fn(p) ?? p;
      const changed = pending.current.length > 0;
      pending.current = [];
      loadedRef.current = true;
      latest.current = p;
      setProgress(p);
      setReady(true);
      if (changed) void saveGrammarProgress(p);
    });
    const onExternal = (p: GrammarProgress) => {
      latest.current = p;
      setProgress(p);
      setReady(true);
      loadedRef.current = true;
    };
    listeners.add(onExternal);
    return () => {
      alive = false;
      listeners.delete(onExternal);
    };
  }, []);

  const update = useCallback((fn: Updater) => {
    if (!loadedRef.current) {
      pending.current.push(fn);
      return;
    }
    const next = fn(latest.current);
    if (!next) return;
    latest.current = next;
    void saveGrammarProgress(next);
    notify(next); // updates this and every other mounted instance
  }, []);

  const recordSession = useCallback(
    (pointId: string, correct: number, total: number) =>
      update((p) => {
        if (total <= 0) return null;
        const prev = p.points[pointId] ?? { attempts: 0, correct: 0, completed: false };
        const score = correct / total;
        return {
          ...p,
          points: {
            ...p.points,
            [pointId]: {
              attempts: prev.attempts + total,
              correct: prev.correct + correct,
              completed: prev.completed || score >= PASS_RATIO,
              lastStudied: new Date().toISOString(),
              bestScore: Math.max(prev.bestScore ?? 0, score),
            },
          },
        };
      }),
    [update],
  );

  const completeSteps = useCallback(
    (pathId: string, stepIds: string[]) =>
      update((p) => {
        const done = p.paths[pathId]?.completedSteps ?? [];
        const add = stepIds.filter((s) => !done.includes(s));
        if (!add.length) return null;
        return { ...p, paths: { ...p.paths, [pathId]: { completedSteps: [...done, ...add] } } };
      }),
    [update],
  );

  const reset = useCallback(() => update(() => createEmptyGrammarProgress()), [update]);

  return { progress, ready, recordSession, completeSteps, reset };
}
