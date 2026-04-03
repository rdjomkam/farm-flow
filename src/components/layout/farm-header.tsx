"use client";

import { Fish } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("navigation");

  const showSiteSelector = userSites.length > 1;

  return (
    <header className="sticky top-0 z-50 flex flex-col border-b border-border bg-card md:hidden">
      <div className="h-[env(safe-area-inset-top)] shrink-0" aria-hidden="true" />
      <div className="flex h-12 items-center justify-between px-3">
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
            aria-label={isOnline ? t("items.enLigne") : t("items.horsLigne")}
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
              aria-label={t("items.selectionnerSite")}
            >
              {userSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
}
