"use client";

import { Fish } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function IngenieurHeader() {
  const { isOnline } = useNetworkStatus();

  return (
    <header className="sticky top-0 z-50 flex flex-col border-b border-border bg-card md:hidden">
      <div className="h-[env(safe-area-inset-top)] shrink-0" aria-hidden="true" />
      <div className="flex h-12 items-center justify-between px-3">
        {/* Logo + Ingénieur badge */}
        <div className="flex items-center gap-1.5">
          <Fish className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">FarmFlow</span>
          <span className="ml-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Ingénieur
          </span>
          {/* Network indicator */}
          <div
            className={cn(
              "ml-1 h-2 w-2 rounded-full",
              isOnline ? "bg-success" : "bg-destructive"
            )}
            aria-label={isOnline ? "En ligne" : "Hors ligne"}
            role="status"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
