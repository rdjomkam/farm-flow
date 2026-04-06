"use client";

import { WifiOff, Loader2, CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNetworkStatus } from "@/hooks/use-network-status";

interface OfflineIndicatorProps {
  siteId: string | null;
  session?: {
    userId: string;
    siteId: string;
    role: string;
    permissions: string[];
    userName: string;
  } | null;
}

export function OfflineIndicator({ siteId, session }: OfflineIndicatorProps) {
  const t = useTranslations("pwa");
  const { isOnline, pendingCount, isSyncing } = useNetworkStatus({ siteId, session });

  // Hide when online and nothing pending
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-foreground px-3 py-1.5 text-xs text-background">
      {!isOnline && (
        <>
          <WifiOff className="h-3.5 w-3.5 text-red-400" />
          <span>{t("offlineIndicator.offline")}</span>
        </>
      )}
      {isSyncing && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>{t("offlineIndicator.syncing")}</span>
        </>
      )}
      {pendingCount > 0 && !isSyncing && (
        <>
          {isOnline && <CloudOff className="h-3.5 w-3.5 text-amber-400" />}
          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none">
            {pendingCount}
          </span>
          <span>{t("offlineIndicator.pending")}</span>
        </>
      )}
    </div>
  );
}
