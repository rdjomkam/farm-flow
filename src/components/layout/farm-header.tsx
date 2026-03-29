"use client";

import { Fish } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/use-network-status";

interface FarmHeaderProps {
  userSites?: { id: string; name: string }[];
  activeSiteId?: string | null;
  onSiteChange?: (siteId: string) => void;
}

export function FarmHeader({
  userSites = [],
  activeSiteId,
  onSiteChange,
}: FarmHeaderProps) {
  const { isOnline } = useNetworkStatus();

  const showSiteSelector = userSites.length > 1;

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-card px-3 md:hidden">
      {/* Logo */}
      <div className="flex items-center gap-1.5">
        <Fish className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">FarmFlow</span>
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
      <div className="flex items-center gap-1">
        <NotificationBell />
        {showSiteSelector && (
          <select
            value={activeSiteId ?? ""}
            onChange={(e) => onSiteChange?.(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
            aria-label="Sélectionner un site"
          >
            {userSites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </header>
  );
}
