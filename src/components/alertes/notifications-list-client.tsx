"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/components/ui/toast";
import { TypeAlerte, StatutAlerte } from "@/types";
import type { Notification } from "@/types";

// Labels par type d'alerte
const typeAlerteLabels: Record<TypeAlerte, string> = {
  [TypeAlerte.MORTALITE_ELEVEE]: "Mortalite elevee",
  [TypeAlerte.QUALITE_EAU]: "Qualite de l'eau",
  [TypeAlerte.STOCK_BAS]: "Stock bas",
  [TypeAlerte.RAPPEL_ALIMENTATION]: "Rappel alimentation",
  [TypeAlerte.RAPPEL_BIOMETRIE]: "Rappel biometrie",
  [TypeAlerte.PERSONNALISEE]: "Personnalisee",
  [TypeAlerte.BESOIN_EN_RETARD]: "Besoin en retard",
  // Sprint 27-28 — Densite
  [TypeAlerte.DENSITE_ELEVEE]: "Densite elevee",
  [TypeAlerte.RENOUVELLEMENT_EAU_INSUFFISANT]: "Renouvellement insuffisant",
  [TypeAlerte.AUCUN_RELEVE_QUALITE_EAU]: "Qualite eau non verifiee",
  [TypeAlerte.DENSITE_CRITIQUE_QUALITE_EAU]: "Densite + qualite eau critiques",
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
};

const statutLabels: Record<StatutAlerte, string> = {
  [StatutAlerte.ACTIVE]: "Active",
  [StatutAlerte.LUE]: "Lue",
  [StatutAlerte.TRAITEE]: "Traitee",
};

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
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications);

  async function markAsRead(notification: Notification) {
    if (notification.statut !== StatutAlerte.ACTIVE) {
      // Already read, just navigate
      if (notification.lien) router.push(notification.lien);
      return;
    }

    try {
      const res = await fetch(`/api/notifications/${notification.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: StatutAlerte.LUE }),
      });

      if (res.ok) {
        setLocalNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, statut: StatutAlerte.LUE } : n
          )
        );
      }
    } catch {
      // Ignore
    }

    if (notification.lien) router.push(notification.lien);
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (res.ok) {
        setLocalNotifications((prev) =>
          prev.map((n) =>
            n.statut === StatutAlerte.ACTIVE ? { ...n, statut: StatutAlerte.LUE } : n
          )
        );
        toast({ title: "Toutes les notifications ont ete marquees comme lues", variant: "success" });
        startTransition(() => router.refresh());
      }
    } catch {
      toast({ title: "Erreur lors de la mise a jour", variant: "error" });
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
                {statutLabels[notification.statut as StatutAlerte] ?? notification.statut}
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
                {typeAlerteLabels[notification.typeAlerte as TypeAlerte] ?? notification.typeAlerte}
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
            {actives.length} notification{actives.length > 1 ? "s" : ""} non lue{actives.length > 1 ? "s" : ""}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={isPending}
            className="min-h-[44px] gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Button>
        </div>
      )}

      <Tabs defaultValue="toutes">
        <TabsList className="w-full">
          <TabsTrigger value="toutes">
            Toutes ({localNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="actives">
            Actives ({actives.length})
          </TabsTrigger>
          <TabsTrigger value="lues">
            Lues ({lues.length})
          </TabsTrigger>
          <TabsTrigger value="traitees">
            Traitees ({traitees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toutes">
          {localNotifications.length === 0 ? (
            <EmptyState message="Aucune notification" />
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
            <EmptyState message="Aucune notification active" />
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
            <EmptyState message="Aucune notification lue" />
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
            <EmptyState message="Aucune notification traitee" />
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
