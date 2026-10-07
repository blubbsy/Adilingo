import type { UserState } from '../types';
import { deriveRoomId, encryptData, decryptData, normalizeSyncKey } from './syncCrypto';
import { mergeUserStates, mergeGrammar } from './syncMerge';

const SUPABASE_URL = 'https://aidqoevxqwgkmmbfpyqz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZHFvZXZ4cXdna21tYmZweXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzcyNTIsImV4cCI6MjEwNjkxMzI1Mn0.fXEgUUhOUqlTq5VuYe2mum79KAMiUpu80QBtjQY03gw';

const SYNC_KEY_STORAGE = 'adilingo:sync-key';
const LAST_SYNCED_STORAGE = 'adilingo:sync-last-synced';

export interface RemoteVaultPayload {
  state: UserState;
  grammar?: unknown;
  version: number;
  updatedAt: string;
}

export function getStoredSyncKey(): string | null {
  try {
    return localStorage.getItem(SYNC_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredSyncKey(key: string | null): void {
  try {
    if (key) {
      localStorage.setItem(SYNC_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(SYNC_KEY_STORAGE);
      localStorage.removeItem(LAST_SYNCED_STORAGE);
    }
  } catch {
    /* ignore */
  }
}

export function getLastSyncedTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_STORAGE);
  } catch {
    return null;
  }
}

export function setLastSyncedTime(time: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_STORAGE, time);
  } catch {
    /* ignore */
  }
}

function getGrammarFromStorage(): unknown {
  try {
    const raw = localStorage.getItem('hanzi-flow:grammar-progress') || localStorage.getItem('adilingo:grammar-progress');
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function saveGrammarToStorage(grammar: unknown): void {
  try {
    if (grammar) {
      const json = JSON.stringify(grammar);
      localStorage.setItem('hanzi-flow:grammar-progress', json);
      localStorage.setItem('adilingo:grammar-progress', json);
    }
  } catch {
    /* ignore */
  }
}

/** Uploads encrypted state to Supabase sync_vault */
export async function pushVault(syncKey: string, state: UserState, grammar?: unknown): Promise<void> {
  const roomId = await deriveRoomId(syncKey);
  const resolvedGrammar = grammar !== undefined ? grammar : getGrammarFromStorage();
  const payload: RemoteVaultPayload = {
    state,
    grammar: resolvedGrammar,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const { ciphertext, iv } = await encryptData(syncKey, payload);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_vault`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates, return=minimal',
    },
    body: JSON.stringify({
      room_id: roomId,
      encrypted_data: ciphertext,
      iv,
      client_updated_at: payload.updatedAt,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload sync vault (${res.status}): ${errText}`);
  }
}

/** Pulls and decrypts state from Supabase sync_vault */
export async function pullVault(syncKey: string): Promise<RemoteVaultPayload | null> {
  const roomId = await deriveRoomId(syncKey);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_vault?room_id=eq.${roomId}&select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sync vault (${res.status})`);
  }

  const rows = (await res.json()) as Array<{
    encrypted_data: string;
    iv: string;
    client_updated_at: string;
  }>;

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return await decryptData<RemoteVaultPayload>(syncKey, row.encrypted_data, row.iv);
}

/**
 * Performs a bidirectional sync:
 * 1. Pulls remote state if present.
 * 2. Merges local + remote without data loss.
 * 3. Saves merged state back to remote and local storage.
 */
export async function syncBidirectional(
  syncKey: string,
  localState: UserState,
  localGrammar?: unknown,
): Promise<{ mergedState: UserState; mergedGrammar?: unknown; updated: boolean }> {
  const cleanKey = normalizeSyncKey(syncKey);
  const resolvedLocalGrammar = localGrammar !== undefined ? localGrammar : getGrammarFromStorage();

  const remote = await pullVault(cleanKey);

  if (!remote) {
    // No remote record yet: seed remote with local data
    await pushVault(cleanKey, localState, resolvedLocalGrammar);
    const now = new Date().toISOString();
    setLastSyncedTime(now);
    return { mergedState: localState, mergedGrammar: resolvedLocalGrammar, updated: false };
  }

  // Merge UserState
  const mergedState = mergeUserStates(localState, remote.state);

  // Merge Grammar
  const mergedGrammar = mergeGrammar(resolvedLocalGrammar, remote.grammar) || resolvedLocalGrammar;
  saveGrammarToStorage(mergedGrammar);

  // Push merged state back to vault
  await pushVault(cleanKey, mergedState, mergedGrammar);

  const now = new Date().toISOString();
  setLastSyncedTime(now);

  return { mergedState, mergedGrammar, updated: true };
}
