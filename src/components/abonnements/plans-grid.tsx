"use client";

/**
 * src/components/abonnements/plans-grid.tsx
 *
 * Grille des plans d'abonnement avec toggle de période.
 * Client Component — toggle mensuel/trimestriel/annuel côté client.
 * Mobile-first : 1 colonne à 360px, 2 tablette, 4 desktop.
 *
 * Story 33.1 — Sprint 33
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème (pas de couleurs hardcodées)
 */
import { useState } from "react";
import Link from "next/link";
import { Check, Star, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TypePlan, PeriodeFacturation } from "@/types";
import type { PlanAbonnement } from "@/types";
import {
  PLAN_LABELS,
  PERIODE_LABELS,
} from "@/lib/abonnements-constants";
import { formatXAF, formatXAFOrFree } from "@/lib/format";

interface PlansGridProps {
  plans: PlanAbonnement[];
  abonnementActifPlanId: string | null;
}

// Plans promoteurs affichés sur la page publique
const PLANS_PROMOTEURS: TypePlan[] = [
  TypePlan.DECOUVERTE,
  TypePlan.ELEVEUR,
  TypePlan.PROFESSIONNEL,
  TypePlan.ENTREPRISE,
];

// Périodes disponibles pour le toggle
const PERIODES: PeriodeFacturation[] = [
  PeriodeFacturation.MENSUEL,
  PeriodeFacturation.TRIMESTRIEL,
  PeriodeFacturation.ANNUEL,
];

// Feature keys per plan — references keys under "plans.features.*"
type FeatureKey = `plans.features.${string}`;

const PLAN_FEATURE_KEYS: Record<TypePlan, FeatureKey[]> = {
  [TypePlan.DECOUVERTE]: [
    "plans.features.decouverte_limits",
    "plans.features.unlimited_records",
    "plans.features.basic_dashboard",
    "plans.features.community_support",
  ],
  [TypePlan.ELEVEUR]: [
    "plans.features.eleveur_limits",
    "plans.features.unlimited_records",
    "plans.features.custom_alerts",
    "plans.features.email_support",
  ],
  [TypePlan.PROFESSIONNEL]: [
    "plans.features.professionnel_limits",
    "plans.features.unlimited_records",
    "plans.features.advanced_analytics",
    "plans.features.stock_management",
    "plans.features.sales_billing",
    "plans.features.priority_support",
  ],
  [TypePlan.ENTREPRISE]: [
    "plans.features.unlimited_tanks_waves",
    "plans.features.unlimited_sites",
    "plans.features.all_features",
    "plans.features.api_access",
    "plans.features.dedicated_support",
    "plans.features.training_included",
  ],
  [TypePlan.INGENIEUR_STARTER]: [
    "plans.features.supervised_5_farms",
    "plans.features.client_dashboard",
  ],
  [TypePlan.INGENIEUR_PRO]: [
    "plans.features.supervised_20_farms",
    "plans.features.client_dashboard",
  ],
  [TypePlan.INGENIEUR_EXPERT]: [
    "plans.features.unlimited_farms",
    "plans.features.client_dashboard",
  ],
  [TypePlan.EXONERATION]: [
    "plans.features.full_access",
    "plans.features.manual_plan",
  ],
};

function formatPrix(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return "N/A";
  return formatXAFOrFree(montant);
}

function getTarifForPeriode(plan: PlanAbonnement, periode: PeriodeFacturation): number | null {
  switch (periode) {
    case PeriodeFacturation.MENSUEL: return plan.prixMensuel != null ? Number(plan.prixMensuel) : null;
    case PeriodeFacturation.TRIMESTRIEL: return plan.prixTrimestriel != null ? Number(plan.prixTrimestriel) : null;
    case PeriodeFacturation.ANNUEL: return plan.prixAnnuel != null ? Number(plan.prixAnnuel) : null;
  }
}

function getEconomieMontant(plan: PlanAbonnement, periode: PeriodeFacturation): number | null {
  if (periode === PeriodeFacturation.MENSUEL) return null;
  const mensuel = getTarifForPeriode(plan, PeriodeFacturation.MENSUEL);
  const tarif = getTarifForPeriode(plan, periode);
  if (!mensuel || !tarif || mensuel === 0) return null;
  const mois = periode === PeriodeFacturation.TRIMESTRIEL ? 3 : 12;
  const economie = mensuel * mois - tarif;
  if (economie <= 0) return null;
  return economie;
}

export function PlansGrid({ plans, abonnementActifPlanId }: PlansGridProps) {
  const t = useTranslations("abonnements");
  const [periode, setPeriode] = useState<PeriodeFacturation>(PeriodeFacturation.MENSUEL);

  // Filtrer et trier les plans promoteurs
  const plansPromoteurs = PLANS_PROMOTEURS.map((typePlan) =>
    plans.find((p) => p.typePlan === typePlan)
  ).filter(Boolean) as PlanAbonnement[];

  // Périodes disponibles (au moins un plan les propose)
  const periodesDisponibles = PERIODES.filter((p) =>
    plansPromoteurs.some((plan) => getTarifForPeriode(plan, p) !== null)
  );

  return (
    <div className="space-y-6">
      {/* Toggle période */}
      {periodesDisponibles.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg bg-muted p-1 gap-1">
            {periodesDisponibles.map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={[
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[44px]",
                  periode === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t(PERIODE_LABELS[p])}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grille des plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plansPromoteurs.map((plan) => {
          const tarif = getTarifForPeriode(plan, periode);
          const economieMontant = getEconomieMontant(plan, periode);
          const limites = { limitesBacs: plan.limitesBacs, limitesVagues: plan.limitesVagues, limitesSites: plan.limitesSites };
          const featureKeys = PLAN_FEATURE_KEYS[plan.typePlan] ?? [];
          const isActif = plan.id === abonnementActifPlanId;
          const isPopulaire = plan.typePlan === TypePlan.PROFESSIONNEL;
          const isGratuit = plan.typePlan === TypePlan.DECOUVERTE;

          return (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-xl border p-5 transition-shadow",
                isPopulaire
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card",
                isActif ? "ring-2 ring-primary" : "",
              ].join(" ")}
            >
              {/* Badges */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {isPopulaire && (
                  <Badge variant="en_cours" className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {t("plans.badges.popular")}
                  </Badge>
                )}
                {isGratuit && (
                  <Badge variant="terminee">{t("plans.badges.free")}</Badge>
                )}
                {isActif && (
                  <Badge variant="info">{t("plans.badges.yourPlan")}</Badge>
                )}
              </div>

              {/* Nom du plan */}
              <h3 className="text-base font-bold text-foreground">
                {t(PLAN_LABELS[plan.typePlan])}
              </h3>

              {/* Prix */}
              <div className="mt-3 mb-1">
                {tarif === null || tarif === undefined ? (
                  <p className="text-sm text-muted-foreground">{t("plans.price.unavailableForPeriod")}</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">
                      {formatPrix(tarif)}
                    </p>
                    {tarif !== 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {periode === PeriodeFacturation.MENSUEL
                          ? t("plans.price.perMonth")
                          : periode === PeriodeFacturation.TRIMESTRIEL
                          ? t("plans.price.perQuarter")
                          : t("plans.price.perYear")}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Économie */}
              {economieMontant !== null && (
                <p className="text-xs text-success font-medium mb-3">
                  {t("plans.price.savings", { amount: formatXAF(economieMontant) })}
                </p>
              )}

              {/* Limites */}
              <div className="text-xs text-muted-foreground mb-4 space-y-0.5">
                <p>
                  {limites.limitesBacs === 999
                    ? t("plans.price.unlimitedTanks")
                    : t("plans.price.tanks", { count: limites.limitesBacs })}
                </p>
                <p>
                  {limites.limitesVagues === 999
                    ? t("plans.price.unlimitedWaves")
                    : t("plans.price.waves", { count: limites.limitesVagues })}
                </p>
                {limites.limitesSites > 1 && (
                  <p>
                    {limites.limitesSites === 999
                      ? t("plans.price.unlimitedSites")
                      : t("plans.price.sites", { count: limites.limitesSites })}
                  </p>
                )}
              </div>

              {/* Fonctionnalités */}
              <ul className="space-y-1.5 mb-5 flex-1">
                {featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-xs text-foreground">
                    <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    {t(key as Parameters<typeof t>[0])}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-auto">
                {isGratuit ? (
                  <Link href="/inscription" className="block w-full">
                    <Button variant="outline" className="w-full min-h-[44px]">
                      {t("plans.buttons.startFree")}
                    </Button>
                  </Link>
                ) : isActif ? (
                  <Button disabled className="w-full min-h-[44px] opacity-60">
                    {t("plans.buttons.currentPlan")}
                  </Button>
                ) : tarif === null || tarif === undefined ? (
                  <Button disabled variant="outline" className="w-full min-h-[44px] opacity-60">
                    {t("plans.buttons.unavailable")}
                  </Button>
                ) : (
                  <Link href={`/checkout?planId=${plan.id}`} className="block w-full">
                    <Button
                      className={[
                        "w-full min-h-[44px]",
                        isPopulaire ? "" : "variant-outline",
                      ].join(" ")}
                    >
                      <Zap className="h-4 w-4 mr-1.5" />
                      {t("plans.buttons.choosePlan")}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Message vide */}
      {plansPromoteurs.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm">{t("plans.emptyMessage")}</p>
        </div>
      )}
    </div>
  );
}
