/**
 * src/components/abonnements/plan-comparaison-table.tsx
 *
 * Tableau de comparaison des fonctionnalités par plan.
 * Server Component — visible uniquement desktop (géré par le parent avec hidden lg:block).
 * Mobile-first : ce composant n'est pas rendu sur mobile (le parent cache avec CSS).
 *
 * Story 33.1 — Sprint 33
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 */
import { Check, X, Minus } from "lucide-react";
import { TypePlan } from "@/types";
import type { PlanAbonnement } from "@/types";
import { PLAN_LABELS } from "@/lib/abonnements-constants";

interface PlanComparaisonTableProps {
  plans: PlanAbonnement[];
}

type FeatureValue = boolean | string | null;

interface FeatureRow {
  label: string;
  getValue: (plan: PlanAbonnement) => FeatureValue;
}

const PLANS_ORDER: TypePlan[] = [
  TypePlan.DECOUVERTE,
  TypePlan.ELEVEUR,
  TypePlan.PROFESSIONNEL,
  TypePlan.ENTREPRISE,
];

const FEATURES: FeatureRow[] = [
  {
    label: "Bacs",
    getValue: (p) => (p.limitesBacs >= 999 ? "Illimité" : `${p.limitesBacs}`),
  },
  {
    label: "Vagues simultanées",
    getValue: (p) => (p.limitesVagues >= 999 ? "Illimité" : `${p.limitesVagues}`),
  },
  {
    label: "Sites",
    getValue: (p) => (p.limitesSites >= 999 ? "Illimité" : `${p.limitesSites}`),
  },
  {
    label: "Relevés (biométrie, mortalité...)",
    getValue: () => true,
  },
  {
    label: "Tableau de bord",
    getValue: () => true,
  },
  {
    label: "Alertes personnalisées",
    getValue: (p) => p.typePlan !== TypePlan.DECOUVERTE,
  },
  {
    label: "Gestion des stocks",
    getValue: (p) =>
      p.typePlan === TypePlan.PROFESSIONNEL || p.typePlan === TypePlan.ENTREPRISE,
  },
  {
    label: "Ventes & Facturation",
    getValue: (p) =>
      p.typePlan === TypePlan.PROFESSIONNEL || p.typePlan === TypePlan.ENTREPRISE,
  },
  {
    label: "Analyses avancées",
    getValue: (p) =>
      p.typePlan === TypePlan.PROFESSIONNEL || p.typePlan === TypePlan.ENTREPRISE,
  },
  {
    label: "API Access",
    getValue: (p) => p.typePlan === TypePlan.ENTREPRISE,
  },
  {
    label: "Support",
    getValue: (p) => {
      switch (p.typePlan) {
        case TypePlan.DECOUVERTE:
          return "Communauté";
        case TypePlan.ELEVEUR:
          return "Email";
        case TypePlan.PROFESSIONNEL:
          return "Prioritaire";
        case TypePlan.ENTREPRISE:
          return "Dédié";
        default:
          return null;
      }
    },
  },
];

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-success mx-auto" aria-label="Inclus" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/40 mx-auto" aria-label="Non inclus" />;
  }
  if (value === null) {
    return <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" aria-label="Non applicable" />;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export function PlanComparaisonTable({ plans }: PlanComparaisonTableProps) {
  const plansOrdered = PLANS_ORDER.map((t) =>
    plans.find((p) => p.typePlan === t)
  ).filter(Boolean) as PlanAbonnement[];

  if (plansOrdered.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-1/3">
              Fonctionnalité
            </th>
            {plansOrdered.map((plan) => (
              <th
                key={plan.id}
                className={[
                  "px-4 py-3 text-center font-semibold",
                  plan.typePlan === TypePlan.PROFESSIONNEL
                    ? "text-primary"
                    : "text-foreground",
                ].join(" ")}
              >
                {PLAN_LABELS[plan.typePlan]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((feature, i) => (
            <tr
              key={feature.label}
              className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}
            >
              <td className="px-4 py-3 text-foreground font-medium">
                {feature.label}
              </td>
              {plansOrdered.map((plan) => (
                <td key={plan.id} className="px-4 py-3 text-center">
                  <FeatureCell value={feature.getValue(plan)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
