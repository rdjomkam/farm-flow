"use client";

/**
 * src/components/abonnements/changer-plan-client.tsx
 *
 * Composant client pour la page changer-plan.
 * Affiche les plans disponibles avec boutons upgrade/downgrade.
 * Gère la sélection du plan et l'affichage des formulaires.
 *
 * Story 50.6 — Sprint 50
 * R2 : enums importés depuis @/types
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 * Mobile-first (360px)
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, ArrowDown, Calendar, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TypePlan,
  PeriodeFacturation,
  StatutAbonnement,
} from "@/types";
import type { AbonnementWithPlan, PlanAbonnement } from "@/types";
import {
  PLAN_TARIFS,
  PLAN_LABELS,
  PERIODE_LABELS,
} from "@/lib/abonnements-constants";
import { calculerCreditRestant, calculerDeltaUpgrade, calculerPrixPlan } from "@/lib/abonnements/prorata";
import { formatXAF } from "@/lib/format";
import { UpgradeCheckoutForm } from "./upgrade-checkout-form";
import { DowngradeResourceSelector, BacInfo, VagueInfo } from "./downgrade-resource-selector";
import type { DowngradeRessourcesAGarder } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangerPlanClientProps {
  abonnement: AbonnementWithPlan;
  plans: PlanAbonnement[];
  siteId: string;
  soldeCreditActuel: number;
  bacs: BacInfo[];
  vagues: VagueInfo[];
}

// Ordre des plans pour déterminer upgrade vs downgrade
const PLAN_ORDER: TypePlan[] = [
  TypePlan.DECOUVERTE,
  TypePlan.ELEVEUR,
  TypePlan.PROFESSIONNEL,
  TypePlan.ENTREPRISE,
];

function getPlanRank(typePlan: TypePlan): number {
  const idx = PLAN_ORDER.indexOf(typePlan);
  return idx === -1 ? 0 : idx;
}

// ---------------------------------------------------------------------------
// ChangerPlanClient
// ---------------------------------------------------------------------------

export function ChangerPlanClient({
  abonnement,
  plans,
  siteId,
  soldeCreditActuel,
  bacs,
  vagues,
}: ChangerPlanClientProps) {
  const t = useTranslations("abonnements");
  const [selectedPlan, setSelectedPlan] = useState<PlanAbonnement | null>(null);
  const [selectedPeriode, setSelectedPeriode] = useState<PeriodeFacturation>(
    abonnement.periode
  );
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [downgradeStep, setDowngradeStep] = useState<"select" | "confirm">("select");
  const [downgradeSelection, setDowngradeSelection] = useState<DowngradeRessourcesAGarder | null>(null);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [downgradeError, setDowngradeError] = useState<string | null>(null);
  const [downgradeSuccess, setDowngradeSuccess] = useState(false);

  const planActuelRank = getPlanRank(abonnement.plan.typePlan);

  // Filtrer les plans autres que celui actuel
  const autresPlans = plans.filter(
    (p) => p.id !== abonnement.planId && PLAN_ORDER.includes(p.typePlan as TypePlan)
  );

  const plansMontants = autresPlans.map((plan) => {
    const rank = getPlanRank(plan.typePlan as TypePlan);
    const isUpgrade = rank > planActuelRank;
    const prix = calculerPrixPlan(plan.typePlan as TypePlan, abonnement.periode);
    return { plan, isUpgrade, prix };
  });

  const plansUpgrade = plansMontants.filter((p) => p.isUpgrade);
  const plansDowngrade = plansMontants.filter((p) => !p.isUpgrade);

  // Calculer le prorata pour les upgrades
  const aujourdhui = new Date();
  const creditProrata = calculerCreditRestant(
    abonnement.prixPaye,
    abonnement.dateDebut,
    abonnement.dateFin,
    aujourdhui
  );

  const handleSelectPlanUpgrade = (plan: PlanAbonnement) => {
    setSelectedPlan(plan);
    setSelectedPeriode(abonnement.periode);
    setUpgradeDialogOpen(true);
  };

  const handleSelectPlanDowngrade = (plan: PlanAbonnement) => {
    setSelectedPlan(plan);
    setDowngradeStep("select");
    setDowngradeSelection(null);
    setDowngradeError(null);
    setDowngradeSuccess(false);
    setDowngradeDialogOpen(true);
  };

  const handleDowngradeConfirm = async () => {
    if (!selectedPlan || !downgradeSelection) return;

    setDowngradeLoading(true);
    setDowngradeError(null);

    try {
      const res = await fetch(`/api/abonnements/${abonnement.id}/downgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nouveauPlanId: selectedPlan.id,
          periode: selectedPeriode,
          ressourcesAGarder: downgradeSelection,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Erreur lors du downgrade.");

      setDowngradeSuccess(true);
    } catch (err) {
      setDowngradeError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setDowngradeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan actuel */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          {t("changerPlan.currentPlan")}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">
              {PLAN_LABELS[abonnement.plan.typePlan]}
            </p>
            <p className="text-sm text-muted-foreground">
              {PERIODE_LABELS[abonnement.periode]} —{" "}
              {formatXAF(abonnement.prixPaye)} payé
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {t("changerPlan.expiresOn")}{" "}
              {abonnement.dateFin.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        {creditProrata > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              {t("changerPlan.prorataCredit")}{" "}
              <strong>{formatXAF(creditProrata)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Plans supérieurs (Upgrade) */}
      {plansUpgrade.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowUp className="h-4 w-4 text-primary" />
            {t("changerPlan.upgradePlans")}
          </h2>
          <div className="space-y-2">
            {plansUpgrade.map(({ plan, prix }) => {
              const prixUpgrade = calculerPrixPlan(plan.typePlan as TypePlan, abonnement.periode) ?? 0;
              const delta = calculerDeltaUpgrade(creditProrata, prixUpgrade, soldeCreditActuel);
              return (
                <div
                  key={plan.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">
                        {PLAN_LABELS[plan.typePlan as TypePlan]}
                      </p>
                      {prix !== null && (
                        <p className="text-sm text-muted-foreground">
                          {formatXAF(prix)} / {PERIODE_LABELS[abonnement.periode]}
                        </p>
                      )}
                      {delta.montantAPayer === 0 ? (
                        <p className="mt-1 text-xs text-primary font-medium">
                          {t("changerPlan.upgradeGratuit")}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("changerPlan.amountDueToday")}{" "}
                          <span className="font-medium text-foreground">
                            {formatXAF(delta.montantAPayer)}
                          </span>
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 min-h-[40px]"
                      onClick={() => handleSelectPlanUpgrade(plan)}
                    >
                      <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                      {t("changerPlan.upgradeButton")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plans inférieurs (Downgrade) */}
      {plansDowngrade.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
            {t("changerPlan.downgradePlans")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("changerPlan.downgradeNote")}
          </p>
          <div className="space-y-2">
            {plansDowngrade.map(({ plan, prix }) => (
              <div
                key={plan.id}
                className="rounded-lg border border-border bg-card p-4 opacity-80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      {PLAN_LABELS[plan.typePlan as TypePlan]}
                    </p>
                    {prix !== null && (
                      <p className="text-sm text-muted-foreground">
                        {formatXAF(prix)} / {PERIODE_LABELS[abonnement.periode]}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("changerPlan.applicationDate")}{" "}
                      {abonnement.dateProchainRenouvellement.toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {(abonnement.downgradeVersId === plan.id) ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary shrink-0">
                      <Check className="h-3.5 w-3.5" />
                      {t("changerPlan.scheduled")}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 min-h-[40px]"
                      onClick={() => handleSelectPlanDowngrade(plan)}
                    >
                      <ArrowDown className="mr-1.5 h-3.5 w-3.5" />
                      {t("changerPlan.downgradeButton")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aucun plan disponible */}
      {plansUpgrade.length === 0 && plansDowngrade.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("changerPlan.noOtherPlan")}
          </p>
        </div>
      )}

      {/* Dialog Upgrade */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-md w-full mx-4">
          <DialogHeader>
            <DialogTitle>{t("changerPlan.upgradeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {selectedPlan &&
                t("changerPlan.upgradeDialogDesc", { planName: PLAN_LABELS[selectedPlan.typePlan as TypePlan] })}
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-4">
              {/* Sélecteur de période */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  {t("changerPlan.billingPeriod")}
                </label>
                <Select
                  value={selectedPeriode}
                  onValueChange={(v) => setSelectedPeriode(v as PeriodeFacturation)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PeriodeFacturation).map((p) => {
                      const prix = calculerPrixPlan(selectedPlan.typePlan as TypePlan, p);
                      if (prix === null) return null;
                      return (
                        <SelectItem key={p} value={p}>
                          {PERIODE_LABELS[p]} — {formatXAF(prix)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <UpgradeCheckoutForm
                abonnementActuel={abonnement}
                nouveauPlan={selectedPlan}
                periode={selectedPeriode}
                soldeCreditActuel={soldeCreditActuel}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Downgrade */}
      <Dialog open={downgradeDialogOpen} onOpenChange={setDowngradeDialogOpen}>
        <DialogContent className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("changerPlan.downgradeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {selectedPlan && downgradeStep === "select" && (
                t("changerPlan.downgradeDialogSelectDesc", { planName: PLAN_LABELS[selectedPlan.typePlan as TypePlan] })
              )}
              {downgradeStep === "confirm" && t("changerPlan.downgradeDialogConfirmDesc")}
            </DialogDescription>
          </DialogHeader>

          {downgradeSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("changerPlan.downgradeSuccess")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("changerPlan.downgradeSuccessDesc")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setDowngradeDialogOpen(false)}
                className="min-h-[44px]"
              >
                {t("changerPlan.close")}
              </Button>
            </div>
          ) : (
            selectedPlan && (
              <div className="space-y-4">
                <DowngradeResourceSelector
                  nouveauPlanTypePlan={selectedPlan.typePlan as TypePlan}
                  bacs={bacs}
                  vagues={vagues}
                  siteId={siteId}
                  onSelectionChange={(selection) => {
                    setDowngradeSelection(selection);
                    setDowngradeStep("confirm");
                  }}
                  initialSelection={downgradeSelection ?? undefined}
                />

                {downgradeStep === "confirm" && downgradeSelection && (
                  <div className="space-y-3">
                    {downgradeError && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        {downgradeError}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={handleDowngradeConfirm}
                      disabled={downgradeLoading}
                      className="w-full min-h-[44px]"
                    >
                      {downgradeLoading
                        ? t("changerPlan.saving")
                        : t("changerPlan.confirmDowngrade")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDowngradeStep("select")}
                      className="w-full"
                    >
                      {t("changerPlan.editSelection")}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
