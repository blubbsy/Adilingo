/**
 * End-to-end zero-knowledge encryption for Adilingo multi-device sync.
 * Uses native Web Crypto API (SubtleCrypto) with AES-GCM 256-bit.
 * The server never sees the plaintext data or the pairing secret key.
 */

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Generates a human-friendly pairing code like "AD-8B4K-9M2P-4W1Q" */
export function generateSyncKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += chars[bytes[i] % chars.length];
  }
  return `AD-${str.slice(0, 4)}-${str.slice(4, 8)}-${str.slice(8, 12)}`;
}

export function normalizeSyncKey(key: string): string {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Derives the server room_id from the sync key.
 * This is a SHA-256 hash so the server only stores the hash, never the encryption key.
 */
export async function deriveRoomId(syncKey: string): Promise<string> {
  const normalized = normalizeSyncKey(syncKey);
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(`adilingo-room:${normalized}`));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Derives an AES-GCM CryptoKey from the sync key using SHA-256. */
async function deriveAesKey(syncKey: string): Promise<CryptoKey> {
  const normalized = normalizeSyncKey(syncKey);
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.digest('SHA-256', enc.encode(`adilingo-aes:${normalized}`));
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

/** Encrypts any JSON-serializable data using AES-GCM 256-bit. */
export async function encryptData(syncKey: string, data: unknown): Promise<EncryptedPayload> {
  const key = await deriveAesKey(syncKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData,
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
  };
}

/** Decrypts AES-GCM ciphertext using the sync key. */
export async function decryptData<T>(syncKey: string, ciphertext: string, iv: string): Promise<T> {
  const key = await deriveAesKey(syncKey);
  const cipherBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    key,
    cipherBuffer,
  );

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decryptedBuffer);
  return JSON.parse(jsonStr) as T;
}
