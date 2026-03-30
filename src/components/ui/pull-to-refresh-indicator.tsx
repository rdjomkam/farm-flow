"use client";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  isPulling: boolean;
  isRefreshing: boolean;
  progress: number;
}

export function PullToRefreshIndicator({ isPulling, isRefreshing, progress }: Props) {
  if (!isPulling && !isRefreshing) return null;
  const translateY = isRefreshing ? 48 : Math.round(progress * 48);
  return (
    <div
      aria-live="polite"
      aria-label={isRefreshing ? "Actualisation en cours" : "Tirer pour actualiser"}
      className="pointer-events-none fixed left-0 right-0 z-[60] flex justify-center"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) - 40px)",
        transform: `translateY(${translateY}px)`,
        transition: isRefreshing ? "transform 0.2s ease-out" : "none",
      }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-md border border-border">
        <RefreshCw
          className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")}
          style={!isRefreshing ? { transform: `rotate(${progress * 360}deg)` } : undefined}
        />
      </div>
    </div>
  );
}
