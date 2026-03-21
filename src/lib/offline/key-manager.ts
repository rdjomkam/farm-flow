/**
 * Key manager — holds decrypted data keys in memory during a session.
 * Keys are scoped to (userId, siteId) for multi-tenant isolation.
 */

import {
  deriveKeyFromPIN,
  generateDataKey,
  generateSalt,
  wrapDataKey,
  unwrapDataKey,
  exportKey,
  importKey,
} from "./crypto";

// In-memory key store — cleared on logout or tab close
const keyStore = new Map<string, CryptoKey>();

function keyId(userId: string, siteId: string): string {
  return `${userId}:${siteId}`;
}

/**
 * Auth meta record stored in IndexedDB (unencrypted store).
 */
export interface AuthKeyMeta {
  userId: string;
  siteId: string;
  salt: Uint8Array<ArrayBuffer>;
  wrappedDataKey: ArrayBuffer;
  wrappedDataKeyIv: Uint8Array<ArrayBuffer>;
}

/**
 * Set up encryption keys for a (userId, siteId) pair.
 * - If no keys exist yet (first time): generate new data key, wrap it with PIN-derived key, return meta to store.
 * - If keys exist (returning user): unwrap existing data key using PIN.
 *
 * @returns The auth meta to store in IndexedDB (only on first setup)
 */
export async function setupKeys(
  pin: string,
  userId: string,
  siteId: string,
  existingMeta?: AuthKeyMeta
): Promise<AuthKeyMeta | null> {
  const id = keyId(userId, siteId);

  if (existingMeta) {
    // Returning user — derive unlock key from PIN, unwrap data key
    const unlockKey = await deriveKeyFromPIN(pin, existingMeta.salt);
    const dataKey = await unwrapDataKey(
      existingMeta.wrappedDataKey,
      existingMeta.wrappedDataKeyIv,
      unlockKey
    );
    keyStore.set(id, dataKey);
    return null; // no new meta to store
  }

  // First-time setup — generate everything
  const salt = generateSalt();
  const unlockKey = await deriveKeyFromPIN(pin, salt);
  const dataKey = await generateDataKey();
  const { ciphertext: wrappedDataKey, iv: wrappedDataKeyIv } = await wrapDataKey(
    dataKey,
    unlockKey
  );

  // Store the non-extractable version in memory
  const raw = await exportKey(dataKey);
  const memoryKey = await importKey(raw, false);
  keyStore.set(id, memoryKey);

  return {
    userId,
    siteId,
    salt,
    wrappedDataKey,
    wrappedDataKeyIv,
  };
}

/**
 * Get the data key for a (userId, siteId) pair.
 * Returns null if session has expired (key was cleared).
 */
export function getKey(userId: string, siteId: string): CryptoKey | null {
  return keyStore.get(keyId(userId, siteId)) ?? null;
}

/**
 * Check if a key exists for a (userId, siteId) pair.
 */
export function hasKey(userId: string, siteId: string): boolean {
  return keyStore.has(keyId(userId, siteId));
}

/**
 * Clear keys for a specific (userId, siteId) — used on site switch.
 */
export function clearSiteKey(userId: string, siteId: string): void {
  keyStore.delete(keyId(userId, siteId));
}

/**
 * Clear ALL keys — used on logout.
 */
export function clearKeys(): void {
  keyStore.clear();
}
