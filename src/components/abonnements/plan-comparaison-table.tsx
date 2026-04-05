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
import { getTranslations } from "next-intl/server";
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

function FeatureCell({ value, included, notIncluded, notApplicable }: {
  value: FeatureValue;
  included: string;
  notIncluded: string;
  notApplicable: string;
}) {
  if (value === true) {
    return <Check className="h-5 w-5 text-success mx-auto" aria-label={included} />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/40 mx-auto" aria-label={notIncluded} />;
  }
  if (value === null) {
    return <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" aria-label={notApplicable} />;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export async function PlanComparaisonTable({ plans }: PlanComparaisonTableProps) {
  const t = await getTranslations("abonnements");
  const plansOrdered = PLANS_ORDER.map((typePlan) =>
    plans.find((p) => p.typePlan === typePlan)
  ).filter(Boolean) as PlanAbonnement[];

  if (plansOrdered.length === 0) return null;

  const FEATURES: FeatureRow[] = [
    {
      label: t("comparaison.features.tanks"),
      getValue: (p) => (p.limitesBacs >= 999 ? t("admin.unlimited") : `${p.limitesBacs}`),
    },
    {
      label: t("comparaison.features.concurrentWaves"),
      getValue: (p) => (p.limitesVagues >= 999 ? t("admin.unlimited") : `${p.limitesVagues}`),
    },
    {
      label: t("comparaison.features.sites"),
      getValue: (p) => (p.limitesSites >= 999 ? t("admin.unlimited") : `${p.limitesSites}`),
    },
    {
      label: t("comparaison.features.records"),
      getValue: () => true,
    },
    {
      label: t("comparaison.features.dashboard"),
      getValue: () => true,
    },
    {
      label: t("comparaison.features.customAlerts"),
      getValue: (p) => p.typePlan !== TypePlan.DECOUVERTE,
    },
    {
      label: t("comparaison.features.stockManagement"),
      getValue: (p) =>
        p.typePlan === TypePlan.PROFESSIONNEL || p.typePlan === TypePlan.ENTREPRISE,
    },
    {
      label: t("comparaison.features.salesBilling"),
      getValue: (p) =>
        p.typePlan === TypePlan.PROFESSIONNEL || p.typePlan === TypePlan.ENTREPRISE,
    },
    {
      label: t("comparaison.features.advancedAnalytics"),
      getValue: (p) =>
        p.typePlan === TypePlan.PROFESSIONNEL || p.typePlan === TypePlan.ENTREPRISE,
    },
    {
      label: t("comparaison.features.apiAccess"),
      getValue: (p) => p.typePlan === TypePlan.ENTREPRISE,
    },
    {
      label: t("comparaison.features.support"),
      getValue: (p) => {
        switch (p.typePlan) {
          case TypePlan.DECOUVERTE:
            return t("comparaison.support.community");
          case TypePlan.ELEVEUR:
            return t("comparaison.support.email");
          case TypePlan.PROFESSIONNEL:
            return t("comparaison.support.priority");
          case TypePlan.ENTREPRISE:
            return t("comparaison.support.dedicated");
          default:
            return null;
        }
      },
    },
  ];

  const featureIncluded = t("comparaison.featureIncluded");
  const featureNotIncluded = t("comparaison.featureNotIncluded");
  const featureNotApplicable = t("comparaison.featureNotApplicable");

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-1/3">
              {t("comparaison.featureColumn")}
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
                {t(PLAN_LABELS[plan.typePlan])}
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
                  <FeatureCell
                    value={feature.getValue(plan)}
                    included={featureIncluded}
                    notIncluded={featureNotIncluded}
                    notApplicable={featureNotApplicable}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
