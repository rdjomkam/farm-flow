/**
 * Sync orchestrator — processes the offline queue when connectivity returns.
 * Handles retry strategy, idempotency headers, and error classification.
 */

import {
  dequeueAll,
  markSyncing,
  markSynced,
  markFailed,
  resetSyncingItems,
  type DequeuedItem,
} from "./queue";

/** Max retry attempts before marking as permanently failed */
const MAX_RETRIES = 5;

/** Retry delays in ms: 30s, 2min, 10min, 30min */
const RETRY_DELAYS = [30_000, 120_000, 600_000, 1_800_000];

let syncInProgress = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Request a sync — debounced to prevent network flapping.
 * Uses Background Sync API on Android, fallback on iOS.
 */
export async function requestSync(): Promise<void> {
  // Debounce: 3 seconds
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

  syncDebounceTimer = setTimeout(async () => {
    syncDebounceTimer = null;

    // Try Background Sync API first (Android Chrome)
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (
          reg as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }
        ).sync.register("farmflow-offline-sync");
        return;
      } catch {
        // Fallback to immediate sync
      }
    }

    // Fallback: sync immediately
    await syncNow();
  }, 3000);
}

/**
 * Process the sync queue immediately.
 * Called by Background Sync handler or fallback mechanisms.
 */
export async function syncNow(userId?: string, siteId?: string): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    // Get session from mirror if not provided
    let uid = userId;
    let sid = siteId;
    if (!uid || !sid) {
      const session = await getSessionFromMirror();
      if (!session) {
        console.warn("[Sync] No session available, skipping sync");
        return;
      }
      uid = session.userId;
      sid = session.siteId;
    }

    // Dequeue all pending items
    const items = await dequeueAll(uid, sid);
    if (items.length === 0) return;

    // Process one by one
    for (const item of items) {
      await processItem(item);
    }
  } finally {
    syncInProgress = false;
  }
}

/**
 * Process a single queue item.
 */
async function processItem(item: DequeuedItem): Promise<void> {
  // Check retry count
  if (item.meta.retryCount >= MAX_RETRIES) {
    return; // Already at max retries, skip
  }

  // Check if enough time has passed since last retry
  if (item.meta.retryCount > 0) {
    const delayIndex = Math.min(
      item.meta.retryCount - 1,
      RETRY_DELAYS.length - 1
    );
    const requiredDelay = RETRY_DELAYS[delayIndex];
    const lastAttempt = item.meta.lastAttemptAt ?? item.meta.createdAt;
    const elapsed = Date.now() - lastAttempt;
    if (elapsed < requiredDelay) {
      return; // Not time to retry yet
    }
  }

  await markSyncing(item.id);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Idempotency-Key": item.meta.idempotencyKey,
      ...(item.headers ?? {}),
    };

    const res = await fetch(item.meta.url, {
      method: item.meta.method,
      headers,
      body: item.body ? JSON.stringify(item.body) : undefined,
    });

    if (res.ok) {
      await markSynced(item.id);
    } else if (res.status === 401) {
      // Session expired — preserve queue, user needs to re-auth
      await markFailed(item.id, "Session expirée. Reconnectez-vous.");
    } else if (res.status === 409) {
      // Conflict — resource was modified/deleted
      const error = await res.text().catch(() => "Conflit serveur");
      await markFailed(item.id, error);
    } else {
      const error = await res.text().catch(() => `Erreur ${res.status}`);
      await markFailed(item.id, error);
    }
  } catch {
    // Network error — mark failed for retry
    await markFailed(item.id, "Erreur réseau");
  }
}

/**
 * Initialize sync on app startup.
 * Resets any items stuck in "syncing" state (crash recovery).
 */
export async function initSync(): Promise<void> {
  await resetSyncingItems();

  // If online, trigger sync
  if (navigator.onLine) {
    await requestSync();
  }
}

/**
 * Get session data from IndexedDB mirror.
 */
async function getSessionFromMirror(): Promise<{
  userId: string;
  siteId: string;
} | null> {
  try {
    const { getOfflineDB } = await import("./db");
    const db = await getOfflineDB();
    const session = await db.get("session-mirror", "current");
    if (session) {
      return { userId: session.userId, siteId: session.siteId };
    }
  } catch {
    // DB not available
  }
  return null;
}

/**
 * Mirror the current session to IndexedDB.
 * Call on login and on each page load.
 */
export async function mirrorSession(data: {
  userId: string;
  siteId: string;
  role: string;
  permissions: string[];
  userName: string;
}): Promise<void> {
  try {
    const { getOfflineDB } = await import("./db");
    const db = await getOfflineDB();
    await db.put("session-mirror", {
      id: "current",
      ...data,
      mirroredAt: Date.now(),
    });
  } catch {
    // Silently fail — not critical
  }
}
