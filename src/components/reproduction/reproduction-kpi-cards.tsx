"use client";

import { Egg, Fish, Users, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReproductionKpis {
  totalPontes: number;
  totalPontesReussies: number;
  totalOeufs: number;
  totalLarvesViables: number;
  totalAlevinsActifs: number;
  totalAlevinsSortis: number;
  /** Can be 0 when no pontes exist — treat 0 with no data as null-like for display */
  tauxFecondation: number;
  tauxEclosion: number;
  tauxSurvieLarvaire: number;
  tauxSurvieGlobal: number;
  totalFemelles: number;
  totalMales: number;
  femellesActives: number;
  lotsEnCours: number;
  lotsTransferes: number;
  lotsPerdus: number;
  productionMensuelle: Array<{ mois: string; pontes: number; alevins: number }>;
}

interface ReproductionKpiCardsProps {
  kpis: ReproductionKpis;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a color class based on a percentage value:
 * >= 80% => green (good), 50–79% => orange (warning), < 50% => red (critical)
 * 0 with no data (totalPontes === 0) stays neutral.
 */
function rateColorClass(rate: number): string {
  if (rate === 0) return "text-muted-foreground";
  if (rate >= 80) return "text-[#16a34a]";
  if (rate >= 50) return "text-[#f97316]";
  return "text-[#dc2626]";
}

/**
 * Formats a number with K suffix for thousands to keep cards compact.
 * e.g. 15000 => "15K", 1500 => "1,5K", 999 => "999"
 */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReproductionKpiCards({ kpis }: ReproductionKpiCardsProps) {
  const t = useTranslations("reproduction.dashboard.kpis");

  const cards = [
    {
      icon: <Egg className="h-5 w-5" aria-hidden />,
      label: t("pontes"),
      value: kpis.totalPontes.toString(),
      sub:
        kpis.totalPontes > 0
          ? `${kpis.tauxFecondation.toFixed(1)}% ${t("tauxFecondation").toLowerCase()}`
          : null,
      subRate: kpis.tauxFecondation,
    },
    {
      icon: <span className="text-base leading-none" aria-hidden>&#129710;</span>,
      label: t("oeufs"),
      value: formatCompact(kpis.totalOeufs),
      sub: null,
      subRate: 0,
    },
    {
      icon: <Fish className="h-5 w-5" aria-hidden />,
      label: t("larvesViables"),
      value: formatCompact(kpis.totalLarvesViables),
      sub:
        kpis.totalOeufs > 0
          ? `${kpis.tauxEclosion.toFixed(1)}% ${t("tauxEclosion").toLowerCase()}`
          : null,
      subRate: kpis.tauxEclosion,
    },
    {
      icon: <Fish className="h-5 w-5 rotate-12" aria-hidden />,
      label: t("alevinsActifs"),
      value: formatCompact(kpis.totalAlevinsActifs),
      sub:
        kpis.totalLarvesViables > 0
          ? `${kpis.tauxSurvieGlobal.toFixed(1)}% ${t("tauxSurvie").toLowerCase()}`
          : null,
      subRate: kpis.tauxSurvieGlobal,
    },
    {
      icon: <Users className="h-5 w-5" aria-hidden />,
      label: t("geniteurs"),
      value: `${kpis.totalFemelles}F / ${kpis.totalMales}M`,
      sub: null,
      subRate: 0,
    },
    {
      icon: <Layers className="h-5 w-5" aria-hidden />,
      label: t("lotsEnCours"),
      value: kpis.lotsEnCours.toString(),
      sub: null,
      subRate: 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className="min-w-0">
          <CardContent className="p-3 pt-3">
            {/* Icon row */}
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
              {card.icon}
              <span className="text-xs font-medium truncate">{card.label}</span>
            </div>

            {/* Value */}
            <p className="text-2xl font-bold leading-none text-foreground tabular-nums">
              {card.value}
            </p>

            {/* Sub-label with color coding */}
            {card.sub && (
              <p
                className={`mt-1 text-xs font-medium ${rateColorClass(card.subRate)}`}
              >
                {card.sub}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
