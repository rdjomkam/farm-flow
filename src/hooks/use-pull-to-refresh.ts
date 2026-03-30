"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 80;
const DAMPING = 0.4;

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari standalone
  if ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) return true;
  // Standard display-mode: standalone
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

export function usePullToRefresh() {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startY = useRef(0);
  const startX = useRef(0);
  const isTracking = useRef(false);
  const directionLocked = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isRefreshing) return;
      if (window.scrollY > 0) return;
      // Don't activate when a Radix dialog is open
      if (document.querySelector("[data-radix-dialog-overlay]")) return;

      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      isTracking.current = true;
      directionLocked.current = false;
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isTracking.current || isRefreshing) return;

      const deltaY = e.touches[0].clientY - startY.current;
      const deltaX = e.touches[0].clientX - startX.current;

      // Lock direction on first significant movement
      if (!directionLocked.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        directionLocked.current = true;
        // If horizontal swipe, abort
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          isTracking.current = false;
          return;
        }
      }

      if (deltaY > 0 && window.scrollY <= 0) {
        e.preventDefault();
        const distance = deltaY * DAMPING;
        setPullDistance(distance);
        setIsPulling(true);
      }
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isTracking.current) return;
    isTracking.current = false;

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD);
      router.refresh();
      // Allow time for refresh to take effect
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
      }, 1000);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [pullDistance, router]);

  useEffect(() => {
    if (!isStandaloneMode()) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullDistance, isRefreshing, isPulling };
}
