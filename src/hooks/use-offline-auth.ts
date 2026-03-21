"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { hasKey, clearKeys } from "@/lib/offline/key-manager";
import { hasPINSetup, setupPIN, validatePIN } from "@/lib/offline/auth-cache";
import { deleteOfflineDB } from "@/lib/offline/db";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface UseOfflineAuthOptions {
  userId: string | null;
  siteId: string | null;
}

interface UseOfflineAuthReturn {
  /** Whether PIN setup dialog should be shown */
  showPinSetup: boolean;
  /** Whether PIN unlock dialog should be shown */
  showPinUnlock: boolean;
  /** Handle PIN setup completion */
  handlePinSetup: (pin: string) => Promise<void>;
  /** Handle PIN unlock attempt */
  handlePinUnlock: (
    pin: string
  ) => Promise<{ success: boolean; lockoutUntil?: number; wiped?: boolean }>;
  /** Handle forgotten PIN — wipes local data */
  handleForgotPin: () => Promise<void>;
}

export function useOfflineAuth({
  userId,
  siteId,
}: UseOfflineAuthOptions): UseOfflineAuthReturn {
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinUnlock, setShowPinUnlock] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if PIN needs setup on mount
  useEffect(() => {
    if (!userId || !siteId) return;

    const check = async () => {
      const hasPIN = await hasPINSetup(userId, siteId);
      if (!hasPIN) {
        setShowPinSetup(true);
      } else if (!hasKey(userId, siteId)) {
        // PIN exists but key not in memory (new tab, app restart)
        setShowPinUnlock(true);
      }
    };

    check();
  }, [userId, siteId]);

  // Inactivity timeout
  useEffect(() => {
    if (!userId || !siteId) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = () => {
      if (!hasKey(userId, siteId)) return; // Already locked
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
        setShowPinUnlock(true);
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    if (typeof window !== "undefined") {
      events.forEach((e) =>
        window.addEventListener(e, resetTimer, { passive: true })
      );
    }

    timerRef.current = setInterval(checkInactivity, 60_000); // Check every minute

    return () => {
      if (typeof window !== "undefined") {
        events.forEach((e) => window.removeEventListener(e, resetTimer));
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, siteId]);

  const handlePinSetup = useCallback(
    async (pin: string) => {
      if (!userId || !siteId) return;
      await setupPIN(pin, userId, siteId);
      setShowPinSetup(false);
      lastActivityRef.current = Date.now();
    },
    [userId, siteId]
  );

  const handlePinUnlock = useCallback(
    async (pin: string) => {
      if (!userId || !siteId) return { success: false };
      const result = await validatePIN(pin, userId, siteId);
      if (result.success) {
        setShowPinUnlock(false);
        lastActivityRef.current = Date.now();
      }
      return result;
    },
    [userId, siteId]
  );

  const handleForgotPin = useCallback(async () => {
    await deleteOfflineDB();
    clearKeys();
    setShowPinUnlock(false);
    // Redirect to online login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  return {
    showPinSetup,
    showPinUnlock,
    handlePinSetup,
    handlePinUnlock,
    handleForgotPin,
  };
}
