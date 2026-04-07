"use client";

/**
 * src/components/abonnements/abonnement-actuel-card.tsx
 *
 * Carte affichant l'abonnement actuel du promoteur avec actions.
 * Client Component — dialog d'annulation nécessite "use client".
 *
 * Story 33.3 — Sprint 33
 * R2 : enums importés depuis @/types
 * R5 : DialogTrigger asChild sur le dialog d'annulation
 * R6 : CSS variables du thème
 * Mobile-first : lisible à 360px
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RefreshCw, XCircle, ExternalLink, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatutAbonnement, PeriodeFacturation } from "@/types";
import type { AbonnementWithPlan } from "@/types";
import {
  PLAN_LABELS,
  PERIODE_LABELS,
  STATUT_ABONNEMENT_LABELS,
} from "@/lib/abonnements-constants";

interface AbonnementActuelCardProps {
  abonnement: AbonnementWithPlan | null;
}

function statutVariant(
  statut: StatutAbonnement
): "en_cours" | "terminee" | "annulee" | "warning" | "default" {
  switch (statut) {
    case StatutAbonnement.ACTIF:
      return "terminee"; // vert
    case StatutAbonnement.EN_GRACE:
      return "warning"; // orange
    case StatutAbonnement.SUSPENDU:
      return "annulee"; // rouge
    case StatutAbonnement.EXPIRE:
      return "annulee";
    case StatutAbonnement.ANNULE:
      return "default";
    default:
      return "default";
  }
}

function calcJoursRestants(dateFin: Date): number {
  const now = new Date();
  const diff = new Date(dateFin).getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function calcProgression(dateDebut: Date, dateFin: Date): number {
  const now = new Date();
  const debut = new Date(dateDebut).getTime();
  const fin = new Date(dateFin).getTime();
  const actuel = now.getTime();
  if (actuel <= debut) return 0;
  if (actuel >= fin) return 100;
  return Math.round(((actuel - debut) / (fin - debut)) * 100);
}

function showRenouvelerButton(abonnement: AbonnementWithPlan): boolean {
  const joursRestants = calcJoursRestants(abonnement.dateFin);
  return (
    abonnement.statut === StatutAbonnement.EN_GRACE ||
    abonnement.statut === StatutAbonnement.SUSPENDU ||
    (abonnement.statut === StatutAbonnement.ACTIF && joursRestants < 14)
  );
}

export function AbonnementActuelCard({ abonnement }: AbonnementActuelCardProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("abonnements");
  const [annulationDialogOpen, setAnnulationDialogOpen] = useState(false);
  const [annulationLoading, setAnnulationLoading] = useState(false);
  const [annulationError, setAnnulationError] = useState<string | null>(null);

  if (!abonnement) {
    return null;
  }

  const joursRestants = calcJoursRestants(abonnement.dateFin);
  const progression = calcProgression(abonnement.dateDebut, abonnement.dateFin);
  const showRenouveler = showRenouvelerButton(abonnement);
  const showAnnuler = abonnement.statut === StatutAbonnement.ACTIF;

  async function handleAnnuler() {
    setAnnulationLoading(true);
    setAnnulationError(null);
    try {
      const res = await fetch(`/api/abonnements/${abonnement!.id}/annuler`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setAnnulationError(data.message ?? t("errors.cancelFailed"));
        return;
      }
      setAnnulationDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements.all });
    } catch {
      setAnnulationError(t("errors.networkError"));
    } finally {
      setAnnulationLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* En-tête plan + statut */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {t(PLAN_LABELS[abonnement.plan.typePlan])}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(PERIODE_LABELS[abonnement.periode])}
          </p>
        </div>
        <Badge variant={statutVariant(abonnement.statut)}>
          {t(STATUT_ABONNEMENT_LABELS[abonnement.statut])}
        </Badge>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground">{t("card.startDate")}</p>
            <p>{new Date(abonnement.dateDebut).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground">{t("card.expirationDate")}</p>
            <p>{new Date(abonnement.dateFin).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t("card.progression")}</span>
          <span
            className={
              joursRestants < 14
                ? "text-warning font-medium"
                : "text-foreground"
            }
          >
            {joursRestants === 0
              ? t("card.expired")
              : joursRestants > 1
              ? t("card.daysRemainingPlural", { count: joursRestants })
              : t("card.daysRemaining", { count: joursRestants })}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={[
              "h-full rounded-full transition-all",
              joursRestants < 7
                ? "bg-danger"
                : joursRestants < 14
                ? "bg-warning"
                : "bg-success",
            ].join(" ")}
            style={{ width: `${progression}%` }}
            role="progressbar"
            aria-valuenow={progression}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Période de grâce */}
      {abonnement.statut === StatutAbonnement.EN_GRACE && abonnement.dateFinGrace && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs">
          <p className="font-medium text-warning">{t("card.gracePeriod")}</p>
          <p className="text-muted-foreground mt-0.5">
            {t("card.limitedAccessUntil")}{" "}
            {new Date(abonnement.dateFinGrace).toLocaleDateString("fr-FR")}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        {showRenouveler && (
          <Link href={`/checkout?planId=${abonnement.planId}&renouvellement=true`} className="flex-1">
            <Button className="w-full min-h-[44px] gap-2">
              <RefreshCw className="h-4 w-4" />
              {t("buttons.renew")}
            </Button>
          </Link>
        )}
        <Link href="/tarifs" className="flex-1">
          <Button variant="outline" className="w-full min-h-[44px] gap-2">
            <ExternalLink className="h-4 w-4" />
            {t("buttons.changePlan")}
          </Button>
        </Link>
        {showAnnuler && (
          <Dialog open={annulationDialogOpen} onOpenChange={setAnnulationDialogOpen}>
            {/* R5 : DialogTrigger asChild */}
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 min-h-[44px] gap-2 text-danger border-danger/30 hover:bg-danger/10"
              >
                <XCircle className="h-4 w-4" />
                {t("buttons.cancel")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialogs.cancelTitle")}</DialogTitle>
                <DialogDescription>
                  {t("dialogs.cancelConfirmation")}
                </DialogDescription>
              </DialogHeader>
              {annulationError && (
                <p className="text-sm text-danger">{annulationError}</p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAnnulationDialogOpen(false)}
                  className="min-h-[44px]"
                >
                  {t("buttons.keep")}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[44px] text-danger border-danger/30 hover:bg-danger/10"
                  onClick={handleAnnuler}
                  disabled={annulationLoading}
                >
                  {annulationLoading ? t("buttons.cancelling") : t("buttons.confirmCancel")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
