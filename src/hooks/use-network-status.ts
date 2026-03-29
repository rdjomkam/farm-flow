"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { requestSync, initSync, mirrorSession } from "@/lib/offline/sync";
import { getPendingCount } from "@/lib/offline/queue";

interface UseNetworkStatusOptions {
  siteId?: string | null;
  /** Session data to mirror to IndexedDB */
  session?: {
    userId: string;
    siteId: string;
    role: string;
    permissions: string[];
    userName: string;
  } | null;
}

interface UseNetworkStatusReturn {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): UseNetworkStatusReturn {
  const { siteId = null, session } = options;
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const initializedRef = useRef(false);

  // Mirror session to IndexedDB
  useEffect(() => {
    if (session) {
      mirrorSession(session);
    }
  }, [session]);

  // Initialize sync on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initSync();
  }, []);

  // Online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      requestSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        requestSync();
      }
    };

    // Listen for SW sync messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        requestSync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  // Poll pending count
  useEffect(() => {
    if (!siteId) return;

    const updateCount = async () => {
      try {
        const count = await getPendingCount(siteId);
        setPendingCount(count);
      } catch {
        // DB not ready yet
      }
    };

    updateCount();
    const interval = setInterval(updateCount, 5000); // Every 5s
    return () => clearInterval(interval);
  }, [siteId]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { syncNow: doSync } = await import("@/lib/offline/sync");
      await doSync();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { isOnline, pendingCount, isSyncing, syncNow };
}
