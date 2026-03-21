/**
 * AES-GCM 256-bit encryption primitives using Web Crypto API.
 * Used for encrypting IndexedDB records on shared/stolen-risk devices.
 */

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/**
 * Derive a CryptoKey from a PIN using PBKDF2-SHA256.
 * ~2-4s on mobile devices (intentionally slow for brute-force resistance).
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Generate a random AES-GCM 256-bit data key.
 * This key is used for encrypting all records and is itself encrypted with the unlock key.
 */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_LENGTH },
    true, // extractable so we can export/wrap it
    ["encrypt", "decrypt"]
  );
}

/**
 * Generate a random salt for PBKDF2 key derivation.
 */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16) as Uint8Array<ArrayBuffer>);
}

/**
 * Encrypt a JavaScript object into AES-GCM ciphertext.
 * Returns ciphertext and IV needed for decryption.
 */
export async function encryptRecord(
  data: unknown,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array<ArrayBuffer> }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH) as Uint8Array<ArrayBuffer>);
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return { ciphertext, iv };
}

/**
 * Decrypt AES-GCM ciphertext back to a JavaScript object.
 */
export async function decryptRecord<T = unknown>(
  ciphertext: ArrayBuffer,
  iv: Uint8Array<ArrayBuffer>,
  key: CryptoKey
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext)) as T;
}

/**
 * Export a CryptoKey to raw bytes (for wrapping with unlock key).
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

/**
 * Import raw bytes as an AES-GCM CryptoKey.
 */
export async function importKey(
  raw: ArrayBuffer,
  extractable = false
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: KEY_LENGTH },
    extractable,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt the data key with the unlock key (derived from PIN).
 * Used to store the data key securely in IndexedDB.
 */
export async function wrapDataKey(
  dataKey: CryptoKey,
  unlockKey: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array<ArrayBuffer> }> {
  const raw = await exportKey(dataKey);
  return encryptRecord(Array.from(new Uint8Array(raw)), unlockKey);
}

/**
 * Decrypt the data key using the unlock key (derived from PIN).
 */
export async function unwrapDataKey(
  wrappedKey: ArrayBuffer,
  iv: Uint8Array<ArrayBuffer>,
  unlockKey: CryptoKey
): Promise<CryptoKey> {
  const rawArray = await decryptRecord<number[]>(wrappedKey, iv, unlockKey);
  const raw = new Uint8Array(rawArray).buffer;
  return importKey(raw, true);
}

/**
 * Hash a password for offline credential verification using PBKDF2.
 * Returns the hash and salt as hex strings for storage.
 */
export async function hashPassword(
  password: string,
  salt?: Uint8Array<ArrayBuffer>
): Promise<{ hash: string; salt: string }> {
  const actualSalt: Uint8Array<ArrayBuffer> =
    salt ?? crypto.getRandomValues(new Uint8Array(16) as Uint8Array<ArrayBuffer>);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: actualSalt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return {
    hash: bufferToHex(bits),
    salt: bufferToHex(actualSalt.buffer),
  };
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  saltHex: string
): Promise<boolean> {
  const salt = hexToBuffer(saltHex);
  const { hash } = await hashPassword(password, new Uint8Array(salt));
  return hash === storedHash;
}

// -- Hex helpers --

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}
