import { useEffect, useState } from 'react';

export type EnglishGrammar = typeof import('./englishGrammarData');

let pending: Promise<EnglishGrammar> | null = null;

/** Fetches the English lessons once (separate chunk); the same module instance is shared afterwards. */
export function loadEnglishGrammar(): Promise<EnglishGrammar> {
  pending ??= import('./englishGrammarData').catch((err) => {
    pending = null; // allow a retry after a network failure
    throw err;
  });
  return pending;
}

/** The English lessons once loaded, `null` while loading (or when not needed), and an error flag if the chunk failed. */
export function useEnglishGrammar(enabled: boolean): { data: EnglishGrammar | null; failed: boolean } {
  const [data, setData] = useState<EnglishGrammar | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    setFailed(false);
    loadEnglishGrammar()
      .then((m) => !cancelled && setData(m))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [enabled, data]);
  return { data, failed };
}
