"use client";

/**
 * admin-site-status-badge.tsx
 *
 * Badge coloré pour le statut d'un site (SiteStatus).
 * Utilise CSS variables du thème (R6) — pas de couleurs codées en dur.
 *
 * ADR-021 section 2.5 — SiteStatus calculé depuis isActive/suspendedAt/deletedAt.
 */

import { cn } from "@/lib/utils";
import { SiteStatus } from "@/types";
import { useTranslations } from "next-intl";

interface AdminSiteStatusBadgeProps {
  status: SiteStatus;
  className?: string;
}

const STATUS_CLASS: Record<SiteStatus, string> = {
  [SiteStatus.ACTIVE]: "bg-success/15 text-success",
  [SiteStatus.SUSPENDED]: "bg-accent-amber-muted text-accent-amber",
  [SiteStatus.BLOCKED]: "bg-danger/15 text-danger",
  [SiteStatus.ARCHIVED]: "bg-muted text-muted-foreground",
};

export function AdminSiteStatusBadge({ status, className }: AdminSiteStatusBadgeProps) {
  const t = useTranslations("admin.sites");
  const colorClass = STATUS_CLASS[status] ?? STATUS_CLASS[SiteStatus.ACTIVE];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      {t(`status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}
