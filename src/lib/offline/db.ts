/**
 * Typed IndexedDB schema for FarmFlow offline data.
 * All sensitive data is stored as AES-GCM ciphertext.
 */

import { openDB, type IDBPDatabase, type DBSchema } from "idb";

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

/** Queue item priority: 1=Critical, 2=Standard, 3=Low */
export type QueuePriority = 1 | 2 | 3;

/** Queue item sync status */
export type QueueStatus = "pending" | "syncing" | "failed";

/** Metadata for a queued mutation (stored in plaintext for indexing) */
export interface QueueMeta {
  url: string;
  method: string;
  status: QueueStatus;
  priority: QueuePriority;
  entityType: string;
  entityLabel: string;
  siteId: string;
  createdAt: number; // timestamp ms
  retryCount: number;
  lastAttemptAt?: number; // timestamp ms of the last sync attempt
  lastError?: string;
  idempotencyKey: string;
}

/** Encrypted queue record */
export interface QueueRecord {
  id: string;
  meta: QueueMeta;
  /** AES-GCM encrypted request body */
  payload: ArrayBuffer;
  /** 96-bit IV for decryption */
  iv: Uint8Array;
}

/** Auth key metadata (stored unencrypted — contains wrapped keys) */
export interface AuthMetaRecord {
  /** Composite key: `${userId}:${siteId}` */
  id: string;
  userId: string;
  siteId: string;
  salt: Uint8Array;
  wrappedDataKey: ArrayBuffer;
  wrappedDataKeyIv: Uint8Array;
  /** PBKDF2 hash of password for offline login */
  offlineCredentialHash?: string;
  offlineCredentialSalt?: string;
  /** Email/phone for offline login matching */
  loginIdentifier?: string;
  /** PIN brute-force protection */
  pinAttempts: number;
  pinLockoutUntil: number | null;
  /** Exponential delay after 3+ wrong attempts (timestamp ms — must wait until this passes) */
  pinRetryAfter: number | null;
}

/** Encrypted reference data record */
export interface RefRecord {
  id: string;
  siteId: string;
  /** AES-GCM encrypted JSON array */
  payload: ArrayBuffer;
  iv: Uint8Array;
}

/** Sync metadata for cache staleness tracking */
export interface SyncMetaRecord {
  /** Store name (e.g. "ref-vagues") */
  key: string;
  /** Last successful sync timestamp */
  timestamp: number;
  siteId: string;
}

/** Mirrored session data for offline use */
export interface SessionMirrorRecord {
  /** Always "current" — only one active session */
  id: string;
  userId: string;
  siteId: string;
  role: string;
  permissions: string[];
  userName: string;
  mirroredAt: number;
}

// ---------------------------------------------------------------------------
// DB Schema
// ---------------------------------------------------------------------------

export interface FarmFlowDB extends DBSchema {
  "auth-meta": {
    key: string;
    value: AuthMetaRecord;
  };
  "offline-queue": {
    key: string;
    value: QueueRecord;
    indexes: {
      "by-status": QueueStatus;
      "by-site": string;
      "by-priority": QueuePriority;
    };
  };
  "ref-vagues": {
    key: string;
    value: RefRecord;
  };
  "ref-bacs": {
    key: string;
    value: RefRecord;
  };
  "ref-produits": {
    key: string;
    value: RefRecord;
  };
  "ref-clients": {
    key: string;
    value: RefRecord;
  };
  "sync-meta": {
    key: string;
    value: SyncMetaRecord;
    indexes: {
      "by-site": string;
    };
  };
  "session-mirror": {
    key: string;
    value: SessionMirrorRecord;
  };
}

// ---------------------------------------------------------------------------
// DB Version
// ---------------------------------------------------------------------------

const DB_NAME = "farmflow-offline";
const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<FarmFlowDB>> | null = null;

/**
 * Get the singleton IndexedDB instance.
 * Handles Safari private browsing gracefully.
 */
export function getOfflineDB(): Promise<IDBPDatabase<FarmFlowDB>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<FarmFlowDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Auth metadata (unencrypted keys/salts)
      if (!db.objectStoreNames.contains("auth-meta")) {
        db.createObjectStore("auth-meta", { keyPath: "id" });
      }

      // Offline mutation queue
      if (!db.objectStoreNames.contains("offline-queue")) {
        const queueStore = db.createObjectStore("offline-queue", {
          keyPath: "id",
        });
        queueStore.createIndex("by-status", "meta.status");
        queueStore.createIndex("by-site", "meta.siteId");
        queueStore.createIndex("by-priority", "meta.priority");
      }

      // Reference data caches (all encrypted)
      const refStores = [
        "ref-vagues",
        "ref-bacs",
        "ref-produits",
        "ref-clients",
      ] as const;
      for (const name of refStores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }

      // Sync metadata
      if (!db.objectStoreNames.contains("sync-meta")) {
        const syncStore = db.createObjectStore("sync-meta", {
          keyPath: "key",
        });
        syncStore.createIndex("by-site", "siteId");
      }

      // Session mirror
      if (!db.objectStoreNames.contains("session-mirror")) {
        db.createObjectStore("session-mirror", { keyPath: "id" });
      }
    },
    blocked() {
      console.warn("[FarmFlow] IndexedDB blocked by older version");
    },
    blocking() {
      console.warn("[FarmFlow] IndexedDB blocking newer version");
    },
    terminated() {
      console.warn("[FarmFlow] IndexedDB connection terminated");
      dbPromise = null; // Allow reconnection
    },
  }).catch((err) => {
    // Safari private browsing or quota exceeded
    console.error("[FarmFlow] IndexedDB open failed:", err);
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

/**
 * Close the database and reset the singleton.
 * Used in tests or when wiping all data.
 */
export async function closeOfflineDB(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

/**
 * Delete the entire database. Used for "Wipe device" logout.
 */
export async function deleteOfflineDB(): Promise<void> {
  await closeOfflineDB();
  const { deleteDB } = await import("idb");
  await deleteDB(DB_NAME);
}
