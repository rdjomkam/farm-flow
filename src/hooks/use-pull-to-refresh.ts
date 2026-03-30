"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const startY = useRef<number | null>(null);
  const currentDelta = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (window.scrollY > 0 || disabled || isRefreshing) return;
      startY.current = e.touches[0].clientY;
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startY.current === null || disabled || isRefreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setIsPulling(false);
        setPullProgress(0);
        currentDelta.current = 0;
        return;
      }
      if (window.scrollY === 0 && delta > 0) {
        e.preventDefault();
      }
      currentDelta.current = delta;
      setIsPulling(true);
      setPullProgress(Math.min((delta * 0.5) / threshold, 1));
    },
    [disabled, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) {
      startY.current = null;
      return;
    }
    if (currentDelta.current * 0.5 >= threshold) {
      setIsRefreshing(true);
      setPullProgress(1);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    startY.current = null;
    currentDelta.current = 0;
    setIsPulling(false);
    setPullProgress(0);
  }, [isPulling, disabled, threshold, onRefresh]);

  useEffect(() => {
    if (disabled) return;
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isPulling, isRefreshing, pullProgress };
}
