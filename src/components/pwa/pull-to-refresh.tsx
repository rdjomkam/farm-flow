"use client";

import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const THRESHOLD = 80;

export function PullToRefresh() {
  const t = useTranslations("pwa.pullToRefresh");
  const { pullDistance, isRefreshing, isPulling } = usePullToRefresh();

  if (!isPulling && !isRefreshing) return null;

  const reachedThreshold = pullDistance >= THRESHOLD;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
      style={{ height: pullDistance }}
    >
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--primary)" }}>
        {isRefreshing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("rafraichissement")}</span>
          </>
        ) : reachedThreshold ? (
          <>
            <ArrowUp className="h-5 w-5" />
            <span>{t("relacher")}</span>
          </>
        ) : (
          <>
            <ArrowDown className="h-5 w-5" />
            <span>{t("tirer")}</span>
          </>
        )}
      </div>
    </div>
  );
}
