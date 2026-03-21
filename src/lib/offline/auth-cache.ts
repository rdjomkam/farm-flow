/**
 * Offline authentication — credential caching and PIN validation.
 * Stores PBKDF2 password hashes in IndexedDB for offline login.
 */

import { getOfflineDB, deleteOfflineDB, type AuthMetaRecord } from "./db";
import { hashPassword, verifyPassword } from "./crypto";
import { setupKeys, clearKeys, type AuthKeyMeta } from "./key-manager";

const MAX_PIN_ATTEMPTS = 10;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Credential caching (for offline login)
// ---------------------------------------------------------------------------

/**
 * Store offline credentials after a successful online login.
 * Call this right after the user logs in online.
 */
export async function setOfflineCredentials(
  password: string,
  userId: string,
  siteId: string,
  loginIdentifier: string
): Promise<void> {
  const db = await getOfflineDB();
  const id = `${userId}:${siteId}`;
  const existing = await db.get("auth-meta", id);

  const { hash, salt } = await hashPassword(password);

  if (existing) {
    await db.put("auth-meta", {
      ...existing,
      offlineCredentialHash: hash,
      offlineCredentialSalt: salt,
      loginIdentifier,
    });
  } else {
    // Minimal record — PIN setup will fill in the rest
    await db.put("auth-meta", {
      id,
      userId,
      siteId,
      salt: new Uint8Array(16),
      wrappedDataKey: new ArrayBuffer(0),
      wrappedDataKeyIv: new Uint8Array(12),
      offlineCredentialHash: hash,
      offlineCredentialSalt: salt,
      loginIdentifier,
      pinAttempts: 0,
      pinLockoutUntil: null,
      pinRetryAfter: null,
    });
  }
}

/**
 * Validate offline login credentials.
 * Returns the matching (userId, siteId) if valid, null otherwise.
 */
export async function validateOfflineLogin(
  identifier: string,
  password: string
): Promise<{ userId: string; siteId: string } | null> {
  const db = await getOfflineDB();
  const tx = db.transaction("auth-meta", "readonly");
  const store = tx.objectStore("auth-meta");

  let cursor = await store.openCursor();
  while (cursor) {
    const record = cursor.value;
    if (
      record.loginIdentifier === identifier &&
      record.offlineCredentialHash &&
      record.offlineCredentialSalt
    ) {
      const valid = await verifyPassword(
        password,
        record.offlineCredentialHash,
        record.offlineCredentialSalt
      );
      if (valid) {
        return { userId: record.userId, siteId: record.siteId };
      }
    }
    cursor = await cursor.continue();
  }

  return null;
}

// ---------------------------------------------------------------------------
// PIN management
// ---------------------------------------------------------------------------

/**
 * Set up PIN for a user/site pair. Call after first successful online login.
 * Generates encryption keys and stores wrapped data key in IndexedDB.
 */
export async function setupPIN(
  pin: string,
  userId: string,
  siteId: string
): Promise<void> {
  const meta = await setupKeys(pin, userId, siteId);
  if (!meta) return; // Keys already existed

  const db = await getOfflineDB();
  const id = `${userId}:${siteId}`;
  const existing = await db.get("auth-meta", id);

  const record: AuthMetaRecord = {
    ...(existing ?? {
      id,
      userId,
      siteId,
      offlineCredentialHash: undefined,
      offlineCredentialSalt: undefined,
      loginIdentifier: undefined,
      pinAttempts: 0,
      pinLockoutUntil: null,
      pinRetryAfter: null,
    }),
    id,
    userId,
    siteId,
    salt: meta.salt,
    wrappedDataKey: meta.wrappedDataKey,
    wrappedDataKeyIv: meta.wrappedDataKeyIv,
    pinAttempts: 0,
    pinLockoutUntil: null,
    pinRetryAfter: null,
  };

  await db.put("auth-meta", record);
}

/**
 * Validate PIN and unlock the data key.
 * Returns true if PIN is correct and keys are unlocked.
 * Implements brute-force protection with exponential delay after 3 wrong attempts.
 */
export async function validatePIN(
  pin: string,
  userId: string,
  siteId: string
): Promise<{
  success: boolean;
  lockoutUntil?: number;
  wiped?: boolean;
  retryAfter?: number;
}> {
  const db = await getOfflineDB();
  const id = `${userId}:${siteId}`;
  const record = await db.get("auth-meta", id);

  if (!record || !record.wrappedDataKey.byteLength) {
    return { success: false };
  }

  // Check exponential delay (attempts 3-4 before full lockout)
  if (record.pinRetryAfter && Date.now() < record.pinRetryAfter) {
    return { success: false, retryAfter: record.pinRetryAfter };
  }

  // Check lockout
  if (record.pinLockoutUntil && Date.now() < record.pinLockoutUntil) {
    return { success: false, lockoutUntil: record.pinLockoutUntil };
  }

  try {
    // Attempt to unwrap data key with PIN
    const existingMeta: AuthKeyMeta = {
      userId: record.userId,
      siteId: record.siteId,
      salt: record.salt as Uint8Array<ArrayBuffer>,
      wrappedDataKey: record.wrappedDataKey,
      wrappedDataKeyIv: record.wrappedDataKeyIv as Uint8Array<ArrayBuffer>,
    };
    await setupKeys(pin, userId, siteId, existingMeta);

    // Success — reset attempts
    await db.put("auth-meta", {
      ...record,
      pinAttempts: 0,
      pinLockoutUntil: null,
      pinRetryAfter: null,
    });
    return { success: true };
  } catch {
    // Wrong PIN — increment attempts
    const attempts = record.pinAttempts + 1;

    // 10 wrong attempts → full wipe
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await deleteOfflineDB();
      clearKeys();
      return { success: false, wiped: true };
    }

    // 5 wrong attempts → full lockout
    let lockoutUntil: number | null = null;
    if (attempts >= LOCKOUT_THRESHOLD) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    }

    // 3-4 wrong attempts → exponential delay (2^(attempts-3) * 1000 ms: 1s, 2s)
    let pinRetryAfter: number | null = null;
    if (attempts >= 3 && attempts < LOCKOUT_THRESHOLD) {
      pinRetryAfter = Date.now() + 2 ** (attempts - 3) * 1000;
    }

    await db.put("auth-meta", {
      ...record,
      pinAttempts: attempts,
      pinLockoutUntil: lockoutUntil,
      pinRetryAfter,
    });
    return {
      success: false,
      lockoutUntil: lockoutUntil ?? undefined,
      retryAfter: pinRetryAfter ?? undefined,
    };
  }
}

/**
 * Check if a PIN has been set up for a user/site pair.
 */
export async function hasPINSetup(
  userId: string,
  siteId: string
): Promise<boolean> {
  const db = await getOfflineDB();
  const record = await db.get("auth-meta", `${userId}:${siteId}`);
  return !!record && record.wrappedDataKey.byteLength > 0;
}
