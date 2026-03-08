import { HeartPulse, TrendingUp, Weight, Activity, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { IndicateursVague } from "@/types";

interface IndicateursCardsProps {
  indicateurs: IndicateursVague;
}

export function IndicateursCards({ indicateurs }: IndicateursCardsProps) {
  const items = [
    {
      label: "Taux de survie",
      value: indicateurs.tauxSurvie !== null ? `${indicateurs.tauxSurvie}%` : "—",
      icon: HeartPulse,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Biomasse",
      value: indicateurs.biomasse !== null ? `${indicateurs.biomasse} kg` : "—",
      icon: Weight,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Poids moyen",
      value: indicateurs.poidsMoyen !== null ? `${indicateurs.poidsMoyen} g` : "—",
      icon: Scale,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "SGR",
      value: indicateurs.sgr !== null ? `${indicateurs.sgr}%/j` : "—",
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "FCR",
      value: indicateurs.fcr !== null ? `${indicateurs.fcr}` : "—",
      icon: Activity,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.bgColor}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className="text-lg font-bold leading-tight">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
