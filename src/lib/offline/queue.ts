/**
 * Encrypted offline mutation queue.
 * Queues API mutations when offline, encrypts the request body in IndexedDB.
 */

import { getOfflineDB, type QueuePriority, type QueueMeta } from "./db";
import { encryptRecord, decryptRecord } from "./crypto";
import { getKey } from "./key-manager";

const MAX_QUEUE_SIZE = 500;

export interface EnqueueOptions {
  url: string;
  method: string;
  body: unknown;
  headers?: Record<string, string>;
  entityType: string;
  entityLabel: string;
  priority?: QueuePriority;
  userId: string;
  siteId: string;
}

export interface DequeuedItem {
  id: string;
  meta: QueueMeta;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * Add a mutation to the offline queue (encrypted).
 * @throws Error if queue is at capacity (500 items)
 */
export async function enqueue(options: EnqueueOptions): Promise<string> {
  const {
    url,
    method,
    body,
    headers,
    entityType,
    entityLabel,
    priority = 2,
    userId,
    siteId,
  } = options;

  const db = await getOfflineDB();

  // Check capacity
  const count = await db.count("offline-queue");
  if (count >= MAX_QUEUE_SIZE) {
    throw new Error("QUEUE_FULL");
  }

  // Get encryption key
  const key = getKey(userId, siteId);
  if (!key) {
    throw new Error("NO_ENCRYPTION_KEY");
  }

  // Encrypt the payload
  const { ciphertext, iv } = await encryptRecord({ body, headers }, key);

  const id = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();

  const meta: QueueMeta = {
    url,
    method,
    status: "pending",
    priority,
    entityType,
    entityLabel,
    siteId,
    createdAt: Date.now(),
    retryCount: 0,
    idempotencyKey,
  };

  await db.put("offline-queue", {
    id,
    meta,
    payload: ciphertext,
    iv,
  });

  return id;
}

/**
 * Dequeue all pending items, sorted by priority (asc) then createdAt (asc).
 * Decrypts payloads using the current session key.
 */
export async function dequeueAll(
  userId: string,
  siteId: string
): Promise<DequeuedItem[]> {
  const db = await getOfflineDB();
  const key = getKey(userId, siteId);
  if (!key) throw new Error("NO_ENCRYPTION_KEY");

  const allRecords = await db.getAll("offline-queue");

  // Filter by site and pending/failed status
  const pending = allRecords.filter(
    (r) =>
      r.meta.siteId === siteId &&
      (r.meta.status === "pending" || r.meta.status === "failed")
  );

  // Sort: priority ASC, then createdAt ASC
  pending.sort((a, b) => {
    if (a.meta.priority !== b.meta.priority) {
      return a.meta.priority - b.meta.priority;
    }
    return a.meta.createdAt - b.meta.createdAt;
  });

  const items: DequeuedItem[] = [];
  for (const record of pending) {
    try {
      const decrypted = await decryptRecord<{
        body: unknown;
        headers?: Record<string, string>;
      }>(record.payload, record.iv as Uint8Array<ArrayBuffer>, key);
      items.push({
        id: record.id,
        meta: record.meta,
        body: decrypted.body,
        headers: decrypted.headers,
      });
    } catch (err) {
      console.error(`[Queue] Failed to decrypt item ${record.id}:`, err);
    }
  }

  return items;
}

/**
 * Mark a queue item as currently syncing.
 */
export async function markSyncing(id: string): Promise<void> {
  const db = await getOfflineDB();
  const record = await db.get("offline-queue", id);
  if (!record) return;
  record.meta.status = "syncing";
  await db.put("offline-queue", record);
}

/**
 * Mark a queue item as successfully synced (removes it).
 */
export async function markSynced(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("offline-queue", id);
}

/**
 * Mark a queue item as failed with an error message.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getOfflineDB();
  const record = await db.get("offline-queue", id);
  if (!record) return;
  record.meta.status = "failed";
  record.meta.retryCount += 1;
  record.meta.lastError = error;
  await db.put("offline-queue", record);
}

/**
 * Get count of pending items for a site.
 */
export async function getPendingCount(siteId: string): Promise<number> {
  const db = await getOfflineDB();
  const all = await db.getAll("offline-queue");
  return all.filter(
    (r) => r.meta.siteId === siteId && r.meta.status !== "syncing"
  ).length;
}

/**
 * Get all queue items (metadata only) for UI display.
 * Does NOT decrypt — just returns metadata for listing.
 */
export async function getQueueItems(siteId: string): Promise<QueueMeta[]> {
  const db = await getOfflineDB();
  const all = await db.getAll("offline-queue");
  return all
    .filter((r) => r.meta.siteId === siteId)
    .sort(
      (a, b) =>
        a.meta.priority - b.meta.priority ||
        a.meta.createdAt - b.meta.createdAt
    )
    .map((r) => r.meta);
}

/**
 * Clear all queue items for a site.
 */
export async function clearQueue(siteId: string): Promise<void> {
  const db = await getOfflineDB();
  const all = await db.getAll("offline-queue");
  const tx = db.transaction("offline-queue", "readwrite");
  for (const record of all) {
    if (record.meta.siteId === siteId) {
      await tx.store.delete(record.id);
    }
  }
  await tx.done;
}

/**
 * Reset all "syncing" items back to "pending".
 * Called on app startup for crash recovery.
 */
export async function resetSyncingItems(): Promise<void> {
  const db = await getOfflineDB();
  const all = await db.getAll("offline-queue");
  const tx = db.transaction("offline-queue", "readwrite");
  for (const record of all) {
    if (record.meta.status === "syncing") {
      record.meta.status = "pending";
      await tx.store.put(record);
    }
  }
  await tx.done;
}
