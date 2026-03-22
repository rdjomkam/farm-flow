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

interface AdminSiteStatusBadgeProps {
  status: SiteStatus;
  className?: string;
}

const STATUS_CONFIG: Record<SiteStatus, { label: string; className: string }> = {
  [SiteStatus.ACTIVE]: {
    label: "Actif",
    className: "bg-success/15 text-success",
  },
  [SiteStatus.SUSPENDED]: {
    label: "Suspendu",
    className: "bg-accent-amber-muted text-accent-amber",
  },
  [SiteStatus.BLOCKED]: {
    label: "Bloqué",
    className: "bg-danger/15 text-danger",
  },
  [SiteStatus.ARCHIVED]: {
    label: "Archivé",
    className: "bg-muted text-muted-foreground",
  },
};

export function AdminSiteStatusBadge({ status, className }: AdminSiteStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[SiteStatus.ACTIVE];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
