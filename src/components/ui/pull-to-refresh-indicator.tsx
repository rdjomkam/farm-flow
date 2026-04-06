"use client";

import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  isRefreshing: boolean;
  progress: number;
}

export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  progress,
}: PullToRefreshIndicatorProps) {
  if (!isPulling && !isRefreshing) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center transition-transform duration-200",
        "pt-[env(safe-area-inset-top)]"
      )}
      style={{
        transform: `translateY(${Math.min(progress * 80, 80)}px)`,
      }}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full border-2 border-primary border-t-transparent",
          isRefreshing && "animate-spin"
        )}
        style={{
          opacity: Math.min(progress, 1),
          transform: `rotate(${progress * 360}deg)`,
        }}
      />
    </div>
  );
}
