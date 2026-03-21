/**
 * Encrypted reference data cache.
 * Caches API responses (vagues, bacs, produits, clients) in IndexedDB for offline form dropdowns.
 */

import { getOfflineDB } from "./db";
import { encryptRecord, decryptRecord } from "./crypto";
import { getKey } from "./key-manager";

/** Reference store names that can be cached */
export type RefStoreName =
  | "ref-vagues"
  | "ref-bacs"
  | "ref-produits"
  | "ref-clients";

/** Map from store name to API URL */
const REF_API_MAP: Record<RefStoreName, string> = {
  "ref-vagues": "/api/vagues",
  "ref-bacs": "/api/bacs",
  "ref-produits": "/api/produits",
  "ref-clients": "/api/clients",
};

const DEFAULT_STALE_MINUTES = 15;

/**
 * Refresh reference data from API, encrypt, and store in IndexedDB.
 * Call when online and data is stale.
 */
export async function refreshRefData(
  storeName: RefStoreName,
  userId: string,
  siteId: string
): Promise<void> {
  const key = getKey(userId, siteId);
  if (!key) throw new Error("NO_ENCRYPTION_KEY");

  const apiUrl = REF_API_MAP[storeName];
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();

  // Extract the array from the response (APIs return { vagues: [...] } etc.)
  const items = Array.isArray(data) ? data : Object.values(data)[0];
  if (!Array.isArray(items)) throw new Error("Unexpected API response format");

  const db = await getOfflineDB();

  // Clear existing data for this store
  const clearTx = db.transaction(storeName, "readwrite");
  await clearTx.store.clear();
  await clearTx.done;

  // Encrypt and store each item
  const tx = db.transaction(storeName, "readwrite");
  for (const item of items) {
    const { ciphertext, iv } = await encryptRecord(item, key);
    await tx.store.put({
      id: item.id ?? crypto.randomUUID(),
      payload: ciphertext,
      iv,
    });
  }
  await tx.done;

  // Update sync metadata
  const syncDb = await getOfflineDB();
  await syncDb.put("sync-meta", {
    key: `${storeName}:${siteId}`,
    timestamp: Date.now(),
    siteId,
  });
}

/**
 * Get cached reference data from IndexedDB (decrypted).
 */
export async function getRefData<T>(
  storeName: RefStoreName,
  userId: string,
  siteId: string
): Promise<T[]> {
  const key = getKey(userId, siteId);
  if (!key) return [];

  const db = await getOfflineDB();
  const records = await db.getAll(storeName);

  const items: T[] = [];
  for (const record of records) {
    try {
      const decrypted = await decryptRecord<T>(record.payload, record.iv as Uint8Array<ArrayBuffer>, key);
      items.push(decrypted);
    } catch (err) {
      console.error(`[RefCache] Failed to decrypt ${storeName} record:`, err);
    }
  }

  return items;
}

/**
 * Check if cached data is stale (older than maxAgeMinutes).
 */
export async function isStale(
  storeName: RefStoreName,
  siteId: string,
  maxAgeMinutes = DEFAULT_STALE_MINUTES
): Promise<boolean> {
  const db = await getOfflineDB();
  const syncKey = `${storeName}:${siteId}`;
  const meta = await db.get("sync-meta", syncKey);

  if (!meta) return true; // Never synced
  const ageMs = Date.now() - meta.timestamp;
  return ageMs > maxAgeMinutes * 60 * 1000;
}

/**
 * Clear all cached reference data for a site.
 * Used when switching sites.
 */
export async function clearSiteRefData(siteId: string): Promise<void> {
  const db = await getOfflineDB();
  const stores: RefStoreName[] = [
    "ref-vagues",
    "ref-bacs",
    "ref-produits",
    "ref-clients",
  ];

  for (const storeName of stores) {
    const clearTx = db.transaction(storeName, "readwrite");
    await clearTx.store.clear();
    await clearTx.done;
  }

  // Clear sync metadata for this site
  const syncMeta = await db.getAllFromIndex("sync-meta", "by-site", siteId);
  const syncTx = db.transaction("sync-meta", "readwrite");
  for (const meta of syncMeta) {
    await syncTx.store.delete(meta.key);
  }
  await syncTx.done;
}

/**
 * Refresh all stale reference data for a site.
 * Call periodically when online.
 */
export async function refreshAllStaleData(
  userId: string,
  siteId: string
): Promise<void> {
  const stores: RefStoreName[] = [
    "ref-vagues",
    "ref-bacs",
    "ref-produits",
    "ref-clients",
  ];

  for (const storeName of stores) {
    const stale = await isStale(storeName, siteId);
    if (stale) {
      try {
        await refreshRefData(storeName, userId, siteId);
      } catch (err) {
        console.warn(`[RefCache] Failed to refresh ${storeName}:`, err);
      }
    }
  }
}
