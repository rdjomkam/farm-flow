import { Waves, Weight, HeartPulse, Container } from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import type { DashboardData } from "@/types";

interface StatsCardsProps {
  data: DashboardData;
}

export function StatsCards({ data }: StatsCardsProps) {
  const stats = [
    {
      title: "Vagues actives",
      value: String(data.vaguesActives),
      icon: Waves,
      iconColor: "text-primary",
      iconBgColor: "bg-primary/10",
    },
    {
      title: "Biomasse totale",
      value: data.biomasseTotale !== null ? `${data.biomasseTotale} kg` : "\u2014",
      icon: Weight,
      iconColor: "text-accent-blue",
      iconBgColor: "bg-accent-blue-muted",
    },
    {
      title: "Survie moyenne",
      value: data.tauxSurvieMoyen !== null ? `${data.tauxSurvieMoyen}%` : "\u2014",
      icon: HeartPulse,
      iconColor: "text-success",
      iconBgColor: "bg-success/10",
    },
    {
      title: "Bacs",
      value: `${data.bacsOccupes}/${data.bacsTotal}`,
      icon: Container,
      iconColor: "text-accent-amber",
      iconBgColor: "bg-accent-amber-muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={stat.title}
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <KPICard {...stat} />
        </div>
      ))}
    </div>
  );
}
