import { Waves, Weight, HeartPulse, Container } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardData } from "@/types";

interface StatsCardsProps {
  data: DashboardData;
}

export function StatsCards({ data }: StatsCardsProps) {
  const stats = [
    {
      label: "Vagues actives",
      value: data.vaguesActives,
      icon: Waves,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Biomasse totale",
      value: data.biomasseTotale !== null ? `${data.biomasseTotale} kg` : "—",
      icon: Weight,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Survie moyenne",
      value: data.tauxSurvieMoyen !== null ? `${data.tauxSurvieMoyen}%` : "—",
      icon: HeartPulse,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Bacs",
      value: `${data.bacsOccupes}/${data.bacsTotal}`,
      icon: Container,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-lg font-bold leading-tight">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
