"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import {
  Bell,
  AlertTriangle,
  Droplets,
  Package,
  Clock,
  Activity,
  Star,
  CalendarClock,
  CheckCircle2,
  Eye,
  CheckCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNotificationService } from "@/services";
import { TypeAlerte, StatutAlerte } from "@/types";
import type { Notification } from "@/types";

// Map des clés de traduction par type d'alerte
const typeAlerteTranslationKeys: Record<TypeAlerte, string> = {
  [TypeAlerte.MORTALITE_ELEVEE]: "types.highMortality",
  [TypeAlerte.QUALITE_EAU]: "types.waterQuality",
  [TypeAlerte.STOCK_BAS]: "types.lowStock",
  [TypeAlerte.RAPPEL_ALIMENTATION]: "types.feedingReminder",
  [TypeAlerte.RAPPEL_BIOMETRIE]: "types.biometryReminder",
  [TypeAlerte.PERSONNALISEE]: "types.custom",
  [TypeAlerte.BESOIN_EN_RETARD]: "types.lateNeed",
  // Sprint 27-28 — Densite
  [TypeAlerte.DENSITE_ELEVEE]: "types.highDensity",
  [TypeAlerte.RENOUVELLEMENT_EAU_INSUFFISANT]: "types.insufficientWaterRenewal",
  [TypeAlerte.AUCUN_RELEVE_QUALITE_EAU]: "types.noWaterQualityRecord",
  [TypeAlerte.DENSITE_CRITIQUE_QUALITE_EAU]: "types.criticalDensityAndWaterQuality",
  // Sprint 36 — Rappels abonnement
  [TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT]: "types.subscriptionRenewalReminder",
  // Sprint 49 — Fin d'essai
  [TypeAlerte.ABONNEMENT_ESSAI_EXPIRE]: "types.trialExpired",
  // Sprint R1 — Reproduction
  [TypeAlerte.MALES_STOCK_BAS]: "types.malesLowStock",
  [TypeAlerte.FEMELLE_SUREXPLOITEE]: "types.femaleOverexploited",
  [TypeAlerte.CONSANGUINITE_RISQUE]: "types.inbreedingRisk",
  [TypeAlerte.INCUBATION_ECLOSION]: "types.incubationHatching",
  [TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT]: "types.criticalSurvivalRateLot",
};

const typeAlerteIcons: Record<TypeAlerte, React.ComponentType<{ className?: string }>> = {
  [TypeAlerte.MORTALITE_ELEVEE]: AlertTriangle,
  [TypeAlerte.QUALITE_EAU]: Droplets,
  [TypeAlerte.STOCK_BAS]: Package,
  [TypeAlerte.RAPPEL_ALIMENTATION]: Clock,
  [TypeAlerte.RAPPEL_BIOMETRIE]: Activity,
  [TypeAlerte.PERSONNALISEE]: Star,
  [TypeAlerte.BESOIN_EN_RETARD]: CalendarClock,
  // Sprint 27-28 — Densite
  [TypeAlerte.DENSITE_ELEVEE]: AlertTriangle,
  [TypeAlerte.RENOUVELLEMENT_EAU_INSUFFISANT]: Droplets,
  [TypeAlerte.AUCUN_RELEVE_QUALITE_EAU]: Clock,
  [TypeAlerte.DENSITE_CRITIQUE_QUALITE_EAU]: AlertTriangle,
  // Sprint 36 — Rappels abonnement
  [TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT]: Bell,
  // Sprint 49 — Fin d'essai
  [TypeAlerte.ABONNEMENT_ESSAI_EXPIRE]: Bell,
  // Sprint R1 — Reproduction
  [TypeAlerte.MALES_STOCK_BAS]: AlertTriangle,
  [TypeAlerte.FEMELLE_SUREXPLOITEE]: AlertTriangle,
  [TypeAlerte.CONSANGUINITE_RISQUE]: Activity,
  [TypeAlerte.INCUBATION_ECLOSION]: Clock,
  [TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT]: AlertTriangle,
};

const typeAlerteColors: Record<TypeAlerte, string> = {
  [TypeAlerte.MORTALITE_ELEVEE]: "text-danger bg-danger/10",
  [TypeAlerte.QUALITE_EAU]: "text-accent-blue bg-accent-blue-muted",
  [TypeAlerte.STOCK_BAS]: "text-warning bg-warning/10",
  [TypeAlerte.RAPPEL_ALIMENTATION]: "text-primary bg-primary/10",
  [TypeAlerte.RAPPEL_BIOMETRIE]: "text-accent-purple bg-accent-purple-muted",
  [TypeAlerte.PERSONNALISEE]: "text-muted-foreground bg-muted",
  [TypeAlerte.BESOIN_EN_RETARD]: "text-danger bg-danger/10",
  // Sprint 27-28 — Densite
  [TypeAlerte.DENSITE_ELEVEE]: "text-warning bg-warning/10",
  [TypeAlerte.RENOUVELLEMENT_EAU_INSUFFISANT]: "text-warning bg-warning/10",
  [TypeAlerte.AUCUN_RELEVE_QUALITE_EAU]: "text-warning bg-warning/10",
  [TypeAlerte.DENSITE_CRITIQUE_QUALITE_EAU]: "text-danger bg-danger/10",
  // Sprint 36 — Rappels abonnement
  [TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT]: "text-primary bg-primary/10",
  // Sprint 49 — Fin d'essai
  [TypeAlerte.ABONNEMENT_ESSAI_EXPIRE]: "text-warning bg-warning/10",
  // Sprint R1 — Reproduction
  [TypeAlerte.MALES_STOCK_BAS]: "text-warning bg-warning/10",
  [TypeAlerte.FEMELLE_SUREXPLOITEE]: "text-danger bg-danger/10",
  [TypeAlerte.CONSANGUINITE_RISQUE]: "text-accent-purple bg-accent-purple-muted",
  [TypeAlerte.INCUBATION_ECLOSION]: "text-accent-blue bg-accent-blue-muted",
  [TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT]: "text-danger bg-danger/10",
};

// Les labels de statut sont résolus via t() dans le composant

const statutVariants: Record<StatutAlerte, "en_cours" | "terminee" | "default"> = {
  [StatutAlerte.ACTIVE]: "en_cours",
  [StatutAlerte.LUE]: "default",
  [StatutAlerte.TRAITEE]: "terminee",
};

function formatDateRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "A l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return d.toLocaleDateString("fr-FR");
}

interface NotificationsListClientProps {
  notifications: Notification[];
}

export function NotificationsListClient({ notifications }: NotificationsListClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("alertes");
  const notificationService = useNotificationService();
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications);

  async function markAsRead(notification: Notification) {
    if (notification.statut !== StatutAlerte.ACTIVE) {
      // Already read, just navigate
      if (notification.lien) router.push(notification.lien);
      return;
    }

    const result = await notificationService.markRead(notification.id);
    if (result.ok) {
      setLocalNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, statut: StatutAlerte.LUE } : n
        )
      );
    }

    if (notification.lien) router.push(notification.lien);
  }

  async function markAllRead() {
    const result = await notificationService.markAllRead();
    if (result.ok) {
      setLocalNotifications((prev) =>
        prev.map((n) =>
          n.statut === StatutAlerte.ACTIVE ? { ...n, statut: StatutAlerte.LUE } : n
        )
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
  }

  const actives = localNotifications.filter((n) => n.statut === StatutAlerte.ACTIVE);
  const lues = localNotifications.filter((n) => n.statut === StatutAlerte.LUE);
  const traitees = localNotifications.filter((n) => n.statut === StatutAlerte.TRAITEE);

  function NotificationCard({ notification }: { notification: Notification }) {
    const Icon = typeAlerteIcons[notification.typeAlerte as TypeAlerte] ?? Bell;
    const colorClass = typeAlerteColors[notification.typeAlerte as TypeAlerte] ?? "text-muted-foreground bg-muted";
    const isUnread = notification.statut === StatutAlerte.ACTIVE;

    return (
      <button
        onClick={() => markAsRead(notification)}
        className={`w-full text-left rounded-xl border transition-all hover:shadow-sm ${
          isUnread
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={`text-sm font-medium leading-tight ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                {notification.titre}
              </p>
              <Badge variant={statutVariants[notification.statut as StatutAlerte] ?? "default"}>
                {t(`statuts.${notification.statut}`, { defaultMessage: notification.statut })}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
              {notification.message}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatDateRelative(notification.createdAt)}
              </span>
              <span className="text-xs text-muted-foreground">
                {typeAlerteTranslationKeys[notification.typeAlerte as TypeAlerte]
                  ? t(typeAlerteTranslationKeys[notification.typeAlerte as TypeAlerte] as Parameters<typeof t>[0])
                  : notification.typeAlerte}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  function EmptyState({ message }: { message: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      {actives.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {actives.length > 1
              ? t("notifications.countUnreadPlural", { count: actives.length })
              : t("notifications.countUnread", { count: actives.length })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            className="min-h-[44px] gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            {t("notifications.markAllRead")}
          </Button>
        </div>
      )}

      <Tabs defaultValue="toutes">
        <TabsList className="w-full">
          <TabsTrigger value="toutes">
            {t("notifications.tabs.all")} ({localNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="actives">
            {t("notifications.tabs.active")} ({actives.length})
          </TabsTrigger>
          <TabsTrigger value="lues">
            {t("notifications.tabs.read")} ({lues.length})
          </TabsTrigger>
          <TabsTrigger value="traitees">
            {t("notifications.tabs.processed")} ({traitees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toutes">
          {localNotifications.length === 0 ? (
            <EmptyState message={t("notifications.aucuneNotification")} />
          ) : (
            <div className="flex flex-col gap-2">
              {localNotifications.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actives">
          {actives.length === 0 ? (
            <EmptyState message={t("notifications.aucuneActive")} />
          ) : (
            <div className="flex flex-col gap-2">
              {actives.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lues">
          {lues.length === 0 ? (
            <EmptyState message={t("notifications.aucuneLue")} />
          ) : (
            <div className="flex flex-col gap-2">
              {lues.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="traitees">
          {traitees.length === 0 ? (
            <EmptyState message={t("notifications.aucuneTraitee")} />
          ) : (
            <div className="flex flex-col gap-2">
              {traitees.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
