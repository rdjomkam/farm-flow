"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fish,
  HeartPulse,
  MessageSquare,
  Package,
  WifiOff,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatutActivation } from "@/types";
import type { ClientIngenieurSummary } from "@/lib/queries/ingenieur";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retourne la couleur de statut selon la survie et les alertes */
function getStatusColor(client: ClientIngenieurSummary): "critique" | "attention" | "ok" {
  if (!client.necessiteAttention) return "ok";
  const survieInsuffisante =
    client.survieMoyenne !== null && client.survieMoyenne < 70;
  return survieInsuffisante ? "critique" : "attention";
}

const statusStyles = {
  critique: {
    border: "",
    icon: "text-danger bg-danger/10",
    badge: "bg-danger/15 text-danger",
  },
  attention: {
    border: "",
    icon: "text-warning bg-warning/10",
    badge: "bg-accent-amber-muted text-accent-amber",
  },
  ok: {
    border: "",
    icon: "text-success bg-success/10",
    badge: "bg-success/15 text-success",
  },
} as const;

const StatusIcon = {
  critique: AlertTriangle,
  attention: AlertTriangle,
  ok: CheckCircle2,
} as const;

/**
 * Un client est inactif si son dernier relevé date de 3 jours ou plus.
 * Si aucun relevé n'a jamais été effectué (dernierReleveDate === null),
 * le client n'est pas considéré inactif (il vient juste de démarrer).
 * S2 : utilise dernierReleveDate, pas dateActivation.
 */
function isInactif(dernierReleveDate: Date | string | null): boolean {
  if (!dernierReleveDate) return false;
  const d = typeof dernierReleveDate === "string" ? new Date(dernierReleveDate) : dernierReleveDate;
  const diffMs = new Date().getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 3;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClientCardProps {
  client: ClientIngenieurSummary;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClientCard({ client }: ClientCardProps) {
  const t = useTranslations("ingenieur.clientCard");
  const locale = useLocale();
  const color = getStatusColor(client);
  const styles = statusStyles[color];
  const Icon = StatusIcon[color];
  const inactif = isInactif(client.dernierReleveDate);

  function formatDateRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t("dates.aujourdhui");
    if (diffDays === 1) return t("dates.hier");
    if (diffDays < 7) return t("dates.ilYAJours", { count: diffDays });
    return d.toLocaleDateString(locale);
  }

  return (
    <Link href={`/monitoring/${client.siteId}`} className="block">
      <Card
        interactive
        className={`transition-all ${styles.border}`}
      >
        <CardContent className="p-4">
          {/* Header : nom + badges */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold truncate">{client.siteName}</h3>
                {inactif && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <WifiOff className="h-3 w-3" />
                    {t("badges.inactif")}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{client.packNom}</p>
            </div>
            {/* Status badge */}
            <div className="flex items-center gap-1 shrink-0">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.icon}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
                {t(`statusLabels.${color}`)}
              </span>
            </div>
          </div>

          {/* Metriques */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Survie */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <HeartPulse className="h-3.5 w-3.5" />
                <span className="text-xs">{t("metriques.survie")}</span>
              </div>
              <p
                className={`text-sm font-bold ${
                  client.survieMoyenne === null
                    ? "text-muted-foreground"
                    : client.survieMoyenne >= 90
                    ? "text-success"
                    : client.survieMoyenne >= 80
                    ? "text-accent-amber"
                    : "text-danger"
                }`}
              >
                {client.survieMoyenne !== null ? `${client.survieMoyenne}%` : "—"}
              </p>
            </div>

            {/* Vagues en cours */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Fish className="h-3.5 w-3.5" />
                <span className="text-xs">{t("metriques.vagues")}</span>
              </div>
              <p className="text-sm font-bold">
                {client.vaguesEnCours}
                <span className="text-xs font-normal text-muted-foreground"> {t("metriques.vaguesEnCours")}</span>
              </p>
            </div>

            {/* Alertes */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs">{t("metriques.alertes")}</span>
              </div>
              <p
                className={`text-sm font-bold ${
                  client.alertesActives > 0 ? "text-danger" : "text-muted-foreground"
                }`}
              >
                {client.alertesActives}
              </p>
            </div>

            {/* Notes non lues */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs">{t("metriques.messages")}</span>
              </div>
              <p
                className={`text-sm font-bold ${
                  client.notesNonLues > 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {client.notesNonLues}
                <span className="text-xs font-normal text-muted-foreground"> {t("metriques.nonLus")}</span>
              </p>
            </div>
          </div>

          {/* Footer : pack + activation */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              <span className="font-mono">{client.activationCode}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {client.activationStatut === StatutActivation.ACTIVE
                  ? t("statuts.ACTIVE")
                  : client.activationStatut === StatutActivation.EXPIREE
                  ? t("statuts.EXPIREE")
                  : t("statuts.SUSPENDUE")}
              </span>
              <span className="mx-1">·</span>
              <span>{formatDateRelative(client.dateActivation)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
