"use client";

import { HeartPulse, TrendingUp, Weight, Activity, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { IndicateursVague } from "@/types";
import { useTranslations } from "next-intl";

interface IndicateursCardsProps {
  indicateurs: IndicateursVague;
}

export function IndicateursCards({ indicateurs }: IndicateursCardsProps) {
  const tAnalytics = useTranslations("analytics");
  const t = useTranslations("vagues");

  const items = [
    {
      label: t("indicateurs.tauxSurvie"),
      value: indicateurs.tauxSurvie !== null ? `${indicateurs.tauxSurvie}%` : "—",
      icon: HeartPulse,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: t("indicateurs.biomasse"),
      value: indicateurs.biomasse !== null ? `${indicateurs.biomasse} kg` : "—",
      icon: Weight,
      color: "text-accent-blue",
      bgColor: "bg-accent-blue-muted",
    },
    {
      label: t("indicateurs.poidsMoyen"),
      value: indicateurs.poidsMoyen !== null ? `${indicateurs.poidsMoyen} g` : "—",
      icon: Scale,
      color: "text-accent-purple",
      bgColor: "bg-accent-purple-muted",
    },
    {
      label: tAnalytics("benchmarks.sgr.label"),
      value: indicateurs.sgr !== null ? `${indicateurs.sgr}${tAnalytics("labels.sgrUnit")}` : "—",
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: tAnalytics("benchmarks.fcr.label"),
      value: indicateurs.fcr !== null ? `${indicateurs.fcr}` : "—",
      icon: Activity,
      color: "text-accent-amber",
      bgColor: "bg-accent-amber-muted",
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-5">
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
    </Card>
  );
}
