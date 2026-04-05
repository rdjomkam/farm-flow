"use client";

/**
 * admin-site-audit-log.tsx
 *
 * Timeline verticale des entrées du journal d'audit d'un site.
 * Chaque entrée affiche : action, acteur, date, détails before/after.
 *
 * ADR-021 section 2.3 — SiteAuditLog.
 */

import { formatDateTime } from "@/lib/format";
import { useTranslations } from "next-intl";
import { Clock, User } from "lucide-react";

interface AuditLogEntry {
  id: string;
  actorName: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface AdminSiteAuditLogProps {
  logs: AuditLogEntry[];
}

/** Clés d'action connues pour la traduction */
const KNOWN_ACTION_KEYS = new Set([
  "SITE_SUSPENDED",
  "SITE_BLOCKED",
  "SITE_RESTORED",
  "SITE_ARCHIVED",
  "MODULES_UPDATED",
  "SITE_CREATED",
  "ABONNEMENT_FORCED",
]);

export function AdminSiteAuditLog({ logs }: AdminSiteAuditLogProps) {
  const t = useTranslations("admin.sites");

  function formatAction(action: string): string {
    if (KNOWN_ACTION_KEYS.has(action)) {
      return t(`audit.actions.${action}` as Parameters<typeof t>[0]);
    }
    return action.replace(/_/g, " ").toLowerCase();
  }

  function formatDetails(details: Record<string, unknown> | null): string | null {
    if (!details) return null;
    const { reason } = details as { reason?: string };
    if (reason) return t("audit.reason", { reason });
    return null;
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">{t("audit.empty")}</p>
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6 py-2">
      {logs.map((log) => {
        const detail = formatDetails(log.details);
        return (
          <li key={log.id} className="ml-6">
            {/* Dot */}
            <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 ring-2 ring-background">
              <span className="h-2 w-2 rounded-full bg-primary" />
            </span>

            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{formatAction(log.action)}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {log.actorName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
              {detail && (
                <p className="text-xs text-muted-foreground italic">{detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
