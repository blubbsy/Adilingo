import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserState } from '../types';
import type { LocalizedMessage } from '../i18n/errors';
import { createDefaultState, loadState, onRemoteSave, requestStoragePersistence, saveState, type StorageBackend } from '../utils/storage';

export interface UserStateApi {
  state: UserState;
  ready: boolean;
  backend: StorageBackend;
  /** Set when saved data could not be read; saving stays paused until allowSave(). */
  loadWarning?: LocalizedMessage;
  update: (fn: (s: UserState) => UserState) => void;
  replace: (s: UserState) => void;
  allowSave: () => void;
}

/** Loads persisted state once, then saves (debounced) after every change. */
export function useUserState(): UserStateApi {
  const [state, setState] = useState<UserState>(createDefaultState);
  const [ready, setReady] = useState(false);
  const [backend, setBackend] = useState<StorageBackend>('memory');
  const [loadWarning, setLoadWarning] = useState<LocalizedMessage>();
  const latest = useRef(state);
  const dirty = useRef(false);
  const blocked = useRef(false);
  /** Skip the save triggered by adopting another tab's state. */
  const skipNextSave = useRef(false);
  const timer = useRef<number>();

  useEffect(() => {
    let cancelled = false;
    requestStoragePersistence().catch(() => {});
    loadState().then((res) => {
      if (cancelled) return;
      latest.current = res.state;
      blocked.current = Boolean(res.warning);
      skipNextSave.current = true;
      setState(res.state);
      setBackend(res.backend);
      setLoadWarning(res.warning);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(() => {
    if (!dirty.current || blocked.current) return;
    dirty.current = false;
    window.clearTimeout(timer.current);
    saveState(latest.current).then(setBackend);
  }, []);

  useEffect(() => {
    if (!ready) return;
    latest.current = state;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 400);
  }, [state, ready, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  // Another tab saved: adopt its state rather than later overwriting it with ours.
  useEffect(
    () =>
      onRemoteSave(() => {
        if (dirty.current || blocked.current) return;
        loadState().then((res) => {
          if (res.warning) return;
          skipNextSave.current = true;
          latest.current = res.state;
          setState(res.state);
        });
      }),
    [],
  );

  const update = useCallback((fn: (s: UserState) => UserState) => setState((s) => fn(s)), []);
  const replace = useCallback((s: UserState) => setState(s), []);
  const allowSave = useCallback(() => {
    blocked.current = false;
    setLoadWarning(undefined);
    dirty.current = true;
    flush();
  }, [flush]);

  return { state, ready, backend, loadWarning, update, replace, allowSave };
}
