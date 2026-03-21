"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RefStoreName } from "@/lib/offline/ref-cache";

interface UseOfflineDataOptions<T> {
  storeName: RefStoreName;
  userId: string | null;
  siteId: string | null;
  /** Fallback fetch function for online mode */
  onlineFetch?: () => Promise<T[]>;
}

interface UseOfflineDataReturn<T> {
  data: T[];
  isLoading: boolean;
  isStale: boolean;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

/**
 * Stale-while-revalidate hook for offline reference data.
 * Reads from encrypted IndexedDB cache first (instant), then refreshes from API if online.
 */
export function useOfflineData<T>({
  storeName,
  userId,
  siteId,
  onlineFetch,
}: UseOfflineDataOptions<T>): UseOfflineDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Track online status
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!userId || !siteId) return;
    setIsLoading(true);

    try {
      // 1. Read from cache first (instant)
      const { getRefData, isStale: checkStale } = await import("@/lib/offline/ref-cache");
      const cached = await getRefData<T>(storeName, userId, siteId);
      if (cached.length > 0 && mountedRef.current) {
        setData(cached);
        setIsLoading(false);
      }

      // 2. Check staleness
      const stale = await checkStale(storeName, siteId);
      if (mountedRef.current) setIsStale(stale);

      // 3. Refresh from API if online and stale
      if (navigator.onLine && stale) {
        try {
          const { refreshRefData } = await import("@/lib/offline/ref-cache");
          await refreshRefData(storeName, userId, siteId);

          // Re-read refreshed data
          const fresh = await getRefData<T>(storeName, userId, siteId);
          if (mountedRef.current) {
            setData(fresh);
            setIsStale(false);
          }
        } catch (err) {
          console.warn(`[OfflineData] Failed to refresh ${storeName}:`, err);
          // Keep showing cached data
        }
      }
    } catch (err) {
      console.error(`[OfflineData] Failed to load ${storeName}:`, err);

      // Fallback to online fetch if no cache available
      if (navigator.onLine && onlineFetch) {
        try {
          const freshData = await onlineFetch();
          if (mountedRef.current) setData(freshData);
        } catch {
          // Nothing we can do
        }
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [storeName, userId, siteId, onlineFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return { data, isLoading, isStale, isOffline, refresh };
}
