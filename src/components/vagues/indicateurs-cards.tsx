"use client";

import { memo } from "react";
import { HeartPulse, TrendingUp, Weight, Activity, Scale, Fish, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { IndicateursVague } from "@/types";
import { formatNum } from "@/lib/format";
import { useTranslations } from "next-intl";

interface IndicateursCardsProps {
  indicateurs: IndicateursVague;
}

function IndicateursCardsBase({ indicateurs }: IndicateursCardsProps) {
  const tAnalytics = useTranslations("analytics");
  const t = useTranslations("vagues");

  // AV.5 : detail mortalites elevage vs avarie transport — visible uniquement
  // si des avaries ou pertes de poids transport ont ete enregistrees.
  const showMortalitesDetail =
    indicateurs.mortalitesAvarie > 0 || (indicateurs.pertePoidsTransportKg ?? 0) > 0;

  const items = [
    {
      label: t("indicateurs.vivants"),
      value: indicateurs.nombreVivants != null ? indicateurs.nombreVivants.toLocaleString() : "—",
      icon: Fish,
      color: "text-accent-green",
      bgColor: "bg-accent-green-muted",
    },
    {
      label: t("indicateurs.tauxSurvie"),
      value: formatNum(indicateurs.tauxSurvie, 1, "%"),
      icon: HeartPulse,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: t("indicateurs.biomasse"),
      value: formatNum(indicateurs.biomasse, 2, "kg"),
      icon: Weight,
      color: "text-accent-blue",
      bgColor: "bg-accent-blue-muted",
    },
    {
      label: t("indicateurs.poidsMoyen"),
      value: formatNum(indicateurs.poidsMoyen, 1, "g"),
      icon: Scale,
      color: "text-accent-purple",
      bgColor: "bg-accent-purple-muted",
    },
    {
      label: tAnalytics("benchmarks.sgr.label"),
      value: indicateurs.sgr !== null ? `${indicateurs.sgr.toFixed(2)}${tAnalytics("labels.sgrUnit")}` : "—",
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: tAnalytics("benchmarks.fcr.label"),
      value: formatNum(indicateurs.fcr, 2),
      icon: Activity,
      color: "text-accent-amber",
      bgColor: "bg-accent-amber-muted",
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex flex-col items-center gap-1 text-center min-w-0">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bgColor}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className="text-sm font-bold leading-tight truncate w-full text-center">{item.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
            </div>
          );
        })}
      </CardContent>
      {showMortalitesDetail && (
        <CardContent className="border-t p-3 pt-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            {t("indicateurs.detailMortalitesTitle")}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
              <span className="text-muted-foreground">{t("indicateurs.mortalitesElevage")}</span>
              <span className="font-semibold">{indicateurs.mortalitesElevage.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
              <span className="text-muted-foreground">{t("indicateurs.mortalitesAvarie")}</span>
              <span className="font-semibold">{indicateurs.mortalitesAvarie.toLocaleString()}</span>
            </div>
            {(indicateurs.pertePoidsTransportKg ?? 0) > 0 && (
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
                <span className="text-muted-foreground">{t("indicateurs.pertePoidsTransport")}</span>
                <span className="font-semibold">{formatNum(indicateurs.pertePoidsTransportKg, 2, "kg")}</span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export const IndicateursCards = memo(IndicateursCardsBase);
