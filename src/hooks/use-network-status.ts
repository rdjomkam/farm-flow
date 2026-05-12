"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { requestSync, initSync, mirrorSession } from "@/lib/offline/sync";
import { getPendingCount } from "@/lib/offline/queue";

const PING_URL = "/api/ping";
const PING_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 30000;

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(PING_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

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
  const [isOnline, setIsOnline] = useState(true);
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

  // Active connectivity check + browser online/offline events
  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const verifyAndSet = async () => {
      const reachable = await checkConnectivity();
      setIsOnline(reachable);
      if (reachable) requestSync();
    };

    const handleOnline = () => {
      verifyAndSet();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifyAndSet();
      }
    };

    // Listen for SW sync messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        requestSync();
      }
    };

    // Initial check
    verifyAndSet();

    // Periodic ping
    pingInterval = setInterval(verifyAndSet, PING_INTERVAL_MS);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      if (pingInterval) clearInterval(pingInterval);
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
