import type { UserState } from '../types';
import { deriveRoomId, encryptData, decryptData, normalizeSyncKey, generateSyncKey } from './syncCrypto';
import { mergeUserStates, mergeGrammar } from './syncMerge';

const SUPABASE_URL = 'https://aidqoevxqwgkmmbfpyqz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZHFvZXZ4cXdna21tYmZweXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzcyNTIsImV4cCI6MjEwNjkxMzI1Mn0.fXEgUUhOUqlTq5VuYe2mum79KAMiUpu80QBtjQY03gw';

const SYNC_KEY_STORAGE = 'adilingo:sync-key';
const LAST_SYNCED_STORAGE = 'adilingo:sync-last-synced';

export interface SyncDevice {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  registeredAt: string;
  lastActiveAt: string;
  revoked?: boolean;
}

export interface RemoteVaultPayload {
  state: UserState;
  grammar?: unknown;
  devices?: Record<string, SyncDevice>;
  version: number;
  updatedAt: string;
}

const DEVICE_ID_STORAGE = 'adilingo:device-id';
const DEVICE_NAME_STORAGE = 'adilingo:device-name';
const DEVICES_CACHE_STORAGE = 'adilingo:devices-cache';

export class DeviceRevokedError extends Error {
  constructor(message = 'This device has been unlinked from cloud sync.') {
    super(message);
    this.name = 'DeviceRevokedError';
  }
}

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_STORAGE, id);
    }
    return id;
  } catch {
    return 'dev_default';
  }
}

export function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|tablet/i.test(ua)) return 'tablet';
  if (/iPhone|Android|Mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function detectDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Current Device';
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return browser ? `${os} (${browser})` : os;
}

export function getDeviceName(): string {
  try {
    const custom = localStorage.getItem(DEVICE_NAME_STORAGE);
    if (custom && custom.trim()) return custom.trim();
  } catch {
    /* ignore */
  }
  return detectDefaultDeviceName();
}

export function setDeviceName(name: string): void {
  try {
    if (name.trim()) {
      localStorage.setItem(DEVICE_NAME_STORAGE, name.trim());
    } else {
      localStorage.removeItem(DEVICE_NAME_STORAGE);
    }
  } catch {
    /* ignore */
  }
}

export function getCachedDevices(): Record<string, SyncDevice> {
  try {
    const raw = localStorage.getItem(DEVICES_CACHE_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setCachedDevices(devices: Record<string, SyncDevice>): void {
  try {
    localStorage.setItem(DEVICES_CACHE_STORAGE, JSON.stringify(devices));
  } catch {
    /* ignore */
  }
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
      localStorage.removeItem(DEVICES_CACHE_STORAGE);
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
export async function pushVault(
  syncKey: string,
  state: UserState,
  grammar?: unknown,
  devicesOverride?: Record<string, SyncDevice>,
): Promise<void> {
  const roomId = await deriveRoomId(syncKey);
  const resolvedGrammar = grammar !== undefined ? grammar : getGrammarFromStorage();

  const myDeviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();
  const cached = getCachedDevices();
  const resolvedDevices: Record<string, SyncDevice> = devicesOverride || {
    ...cached,
    [myDeviceId]: {
      id: myDeviceId,
      name: getDeviceName(),
      type: detectDeviceType(),
      registeredAt: cached[myDeviceId]?.registeredAt || now,
      lastActiveAt: now,
      revoked: false,
    },
  };
  setCachedDevices(resolvedDevices);

  const payload: RemoteVaultPayload = {
    state,
    grammar: resolvedGrammar,
    devices: resolvedDevices,
    version: 1,
    updatedAt: now,
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
 * 2. Checks if the current device was revoked.
 * 3. Merges local + remote without data loss.
 * 4. Saves merged state back to remote and local storage.
 */
export async function syncBidirectional(
  syncKey: string,
  localState: UserState,
  localGrammar?: unknown,
): Promise<{
  mergedState: UserState;
  mergedGrammar?: unknown;
  devices: Record<string, SyncDevice>;
  updated: boolean;
}> {
  const cleanKey = normalizeSyncKey(syncKey);
  const resolvedLocalGrammar = localGrammar !== undefined ? localGrammar : getGrammarFromStorage();
  const myDeviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  const remote = await pullVault(cleanKey);

  if (!remote) {
    // No remote record yet: seed remote with local data and current device
    const initialDevices: Record<string, SyncDevice> = {
      [myDeviceId]: {
        id: myDeviceId,
        name: getDeviceName(),
        type: detectDeviceType(),
        registeredAt: now,
        lastActiveAt: now,
        revoked: false,
      },
    };
    await pushVault(cleanKey, localState, resolvedLocalGrammar, initialDevices);
    setLastSyncedTime(now);
    return {
      mergedState: localState,
      mergedGrammar: resolvedLocalGrammar,
      devices: initialDevices,
      updated: false,
    };
  }

  // Check if current device has been unlinked/revoked
  if (remote.devices && remote.devices[myDeviceId]?.revoked) {
    setStoredSyncKey(null);
    throw new DeviceRevokedError();
  }

  // Merge devices
  const remoteDevices = remote.devices || {};
  const localCached = getCachedDevices();
  const mergedDevices: Record<string, SyncDevice> = {
    ...localCached,
    ...remoteDevices,
    [myDeviceId]: {
      id: myDeviceId,
      name: getDeviceName(),
      type: detectDeviceType(),
      registeredAt: remoteDevices[myDeviceId]?.registeredAt || localCached[myDeviceId]?.registeredAt || now,
      lastActiveAt: now,
      revoked: false,
    },
  };
  setCachedDevices(mergedDevices);

  // Merge UserState
  const mergedState = mergeUserStates(localState, remote.state);

  // Merge Grammar
  const mergedGrammar = mergeGrammar(resolvedLocalGrammar, remote.grammar) || resolvedLocalGrammar;
  saveGrammarToStorage(mergedGrammar);

  // Push merged state back to vault
  await pushVault(cleanKey, mergedState, mergedGrammar, mergedDevices);

  setLastSyncedTime(now);

  return { mergedState, mergedGrammar, devices: mergedDevices, updated: true };
}

/**
 * Revokes / unpairs a specific device by ID.
 * When that device next attempts to sync, it will receive DeviceRevokedError and disconnect.
 */
export async function revokeDevice(
  syncKey: string,
  targetDeviceId: string,
  currentState: UserState,
  currentGrammar?: unknown,
): Promise<Record<string, SyncDevice>> {
  const cleanKey = normalizeSyncKey(syncKey);
  const remote = await pullVault(cleanKey);
  const now = new Date().toISOString();
  const devices = remote?.devices ? { ...remote.devices } : { ...getCachedDevices() };

  if (devices[targetDeviceId]) {
    devices[targetDeviceId] = {
      ...devices[targetDeviceId],
      revoked: true,
      lastActiveAt: now,
    };
  }

  const myDeviceId = getOrCreateDeviceId();
  if (targetDeviceId === myDeviceId) {
    setStoredSyncKey(null);
  }

  const stateToPush = remote?.state ? mergeUserStates(currentState, remote.state) : currentState;
  const grammarToPush = remote?.grammar ? mergeGrammar(currentGrammar, remote.grammar) : currentGrammar;

  await pushVault(cleanKey, stateToPush, grammarToPush, devices);
  setCachedDevices(devices);
  return devices;
}

/**
 * Unlinks all other devices by revoking them in the current vault and rotating
 * the current device to a brand new pairing key.
 */
export async function unlinkAllOtherDevices(
  oldKey: string,
  currentState: UserState,
  currentGrammar?: unknown,
): Promise<{ newKey: string; devices: Record<string, SyncDevice> }> {
  const cleanOldKey = normalizeSyncKey(oldKey);
  let stateToKeep = currentState;
  let grammarToKeep = currentGrammar;

  // Revoke all devices in the old vault so they cleanly disconnect
  try {
    const remote = await pullVault(cleanOldKey);
    if (remote) {
      stateToKeep = mergeUserStates(currentState, remote.state);
      grammarToKeep = mergeGrammar(currentGrammar, remote.grammar);
      if (remote.devices) {
        const revokedOldDevices: Record<string, SyncDevice> = {};
        for (const [id, dev] of Object.entries(remote.devices)) {
          revokedOldDevices[id] = { ...dev, revoked: true };
        }
        await pushVault(cleanOldKey, remote.state, remote.grammar, revokedOldDevices);
      }
    }
  } catch (err) {
    console.warn('Could not revoke old vault devices during key rotation:', err);
  }

  // Generate new key and room for this device
  const newKey = generateSyncKey();
  const myDeviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();
  const freshDevices: Record<string, SyncDevice> = {
    [myDeviceId]: {
      id: myDeviceId,
      name: getDeviceName(),
      type: detectDeviceType(),
      registeredAt: now,
      lastActiveAt: now,
      revoked: false,
    },
  };

  await pushVault(newKey, stateToKeep, grammarToKeep, freshDevices);
  setStoredSyncKey(newKey);
  setCachedDevices(freshDevices);
  setLastSyncedTime(now);

  return { newKey, devices: freshDevices };
}

/** Fetches latest device list from the vault */
export async function fetchVaultDevices(syncKey: string): Promise<Record<string, SyncDevice>> {
  const cleanKey = normalizeSyncKey(syncKey);
  const remote = await pullVault(cleanKey);
  if (remote?.devices) {
    setCachedDevices(remote.devices);
    return remote.devices;
  }
  return getCachedDevices();
}

