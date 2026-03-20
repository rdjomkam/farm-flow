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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TypePlan, PeriodeFacturation } from "@/types";
import type { PlanAbonnement } from "@/types";
import {
  PLAN_TARIFS,
  PLAN_LIMITES,
  PLAN_LABELS,
  PERIODE_LABELS,
} from "@/lib/abonnements-constants";

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

// Fonctionnalités clés par plan pour les cartes
const PLAN_FEATURES: Record<TypePlan, string[]> = {
  [TypePlan.DECOUVERTE]: [
    "1 bac, 1 vague",
    "Relevés illimités",
    "Tableau de bord basique",
    "Support communautaire",
  ],
  [TypePlan.ELEVEUR]: [
    "10 bacs, 3 vagues",
    "Relevés illimités",
    "Analyses & graphiques",
    "Alertes personnalisées",
    "Support email",
  ],
  [TypePlan.PROFESSIONNEL]: [
    "30 bacs, 10 vagues, 3 sites",
    "Relevés illimités",
    "Analyses avancées",
    "Gestion des stocks",
    "Ventes & facturation",
    "Support prioritaire",
  ],
  [TypePlan.ENTREPRISE]: [
    "Bacs & vagues illimités",
    "Sites illimités",
    "Toutes les fonctionnalités",
    "API access",
    "Support dédié",
    "Formation incluse",
  ],
  [TypePlan.INGENIEUR_STARTER]: ["5 fermes supervisées", "Dashboard clients"],
  [TypePlan.INGENIEUR_PRO]: ["20 fermes supervisées", "Dashboard clients"],
  [TypePlan.INGENIEUR_EXPERT]: ["Fermes illimitées", "Dashboard clients"],
};

function formatPrix(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return "N/A";
  if (montant === 0) return "Gratuit";
  return `${montant.toLocaleString("fr-FR")} FCFA`;
}

function getEconomie(plan: PlanAbonnement, periode: PeriodeFacturation): string | null {
  if (periode === PeriodeFacturation.MENSUEL) return null;
  const mensuel = PLAN_TARIFS[plan.typePlan]?.[PeriodeFacturation.MENSUEL];
  const tarif = PLAN_TARIFS[plan.typePlan]?.[periode];
  if (!mensuel || !tarif || mensuel === 0) return null;
  const mois = periode === PeriodeFacturation.TRIMESTRIEL ? 3 : 12;
  const economie = mensuel * mois - tarif;
  if (economie <= 0) return null;
  return `Économisez ${economie.toLocaleString("fr-FR")} FCFA`;
}

export function PlansGrid({ plans, abonnementActifPlanId }: PlansGridProps) {
  const [periode, setPeriode] = useState<PeriodeFacturation>(PeriodeFacturation.MENSUEL);

  // Filtrer et trier les plans promoteurs
  const plansPromoteurs = PLANS_PROMOTEURS.map((typePlan) =>
    plans.find((p) => p.typePlan === typePlan)
  ).filter(Boolean) as PlanAbonnement[];

  // Périodes disponibles (au moins un plan les propose)
  const periodesDisponibles = PERIODES.filter((p) =>
    plansPromoteurs.some((plan) => {
      const tarif = PLAN_TARIFS[plan.typePlan]?.[p];
      return tarif !== undefined && tarif !== null;
    })
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
                {PERIODE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grille des plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plansPromoteurs.map((plan) => {
          const tarif = PLAN_TARIFS[plan.typePlan]?.[periode];
          const tarifMensuel = PLAN_TARIFS[plan.typePlan]?.[PeriodeFacturation.MENSUEL];
          const economie = getEconomie(plan, periode);
          const limites = PLAN_LIMITES[plan.typePlan];
          const features = PLAN_FEATURES[plan.typePlan] ?? [];
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
                    Populaire
                  </Badge>
                )}
                {isGratuit && (
                  <Badge variant="terminee">Gratuit</Badge>
                )}
                {isActif && (
                  <Badge variant="info">Votre plan</Badge>
                )}
              </div>

              {/* Nom du plan */}
              <h3 className="text-base font-bold text-foreground">
                {PLAN_LABELS[plan.typePlan]}
              </h3>

              {/* Prix */}
              <div className="mt-3 mb-1">
                {tarif === null || tarif === undefined ? (
                  <p className="text-sm text-muted-foreground">Non disponible pour cette période</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">
                      {formatPrix(tarif)}
                    </p>
                    {tarif !== 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {periode === PeriodeFacturation.MENSUEL
                          ? "par mois"
                          : periode === PeriodeFacturation.TRIMESTRIEL
                          ? "par trimestre"
                          : "par an"}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Économie */}
              {economie && (
                <p className="text-xs text-success font-medium mb-3">{economie}</p>
              )}

              {/* Limites */}
              <div className="text-xs text-muted-foreground mb-4 space-y-0.5">
                <p>{limites.limitesBacs === 999 ? "Bacs illimités" : `${limites.limitesBacs} bacs`}</p>
                <p>{limites.limitesVagues === 999 ? "Vagues illimitées" : `${limites.limitesVagues} vagues`}</p>
                {limites.limitesSites > 1 && (
                  <p>{limites.limitesSites === 999 ? "Sites illimités" : `${limites.limitesSites} sites`}</p>
                )}
              </div>

              {/* Fonctionnalités */}
              <ul className="space-y-1.5 mb-5 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-auto">
                {isGratuit ? (
                  <Link href="/inscription" className="block w-full">
                    <Button variant="outline" className="w-full min-h-[44px]">
                      Commencer gratuitement
                    </Button>
                  </Link>
                ) : isActif ? (
                  <Button disabled className="w-full min-h-[44px] opacity-60">
                    Plan actuel
                  </Button>
                ) : tarif === null || tarif === undefined ? (
                  <Button disabled variant="outline" className="w-full min-h-[44px] opacity-60">
                    Non disponible
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
                      Choisir ce plan
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
          <p className="text-sm">Les plans ne sont pas disponibles pour le moment.</p>
        </div>
      )}
    </div>
  );
}
