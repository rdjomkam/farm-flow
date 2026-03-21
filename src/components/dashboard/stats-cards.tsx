import { Waves, Weight, HeartPulse, Container } from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import type { DashboardData } from "@/types";
import { getTranslations } from "next-intl/server";

interface StatsCardsProps {
  data: DashboardData;
}

export async function StatsCards({ data }: StatsCardsProps) {
  const tAnalytics = await getTranslations("analytics");

  const stats = [
    {
      title: tAnalytics("kpi.vaguesActives"),
      value: String(data.vaguesActives),
      icon: Waves,
      iconColor: "text-primary",
      iconBgColor: "bg-primary/10",
    },
    {
      title: tAnalytics("kpi.biomasseTotale"),
      value: data.biomasseTotale !== null ? `${data.biomasseTotale} kg` : "\u2014",
      icon: Weight,
      iconColor: "text-accent-blue",
      iconBgColor: "bg-accent-blue-muted",
    },
    {
      title: tAnalytics("kpi.survieMoyenne"),
      value: data.tauxSurvieMoyen !== null ? `${data.tauxSurvieMoyen}%` : "\u2014",
      icon: HeartPulse,
      iconColor: "text-success",
      iconBgColor: "bg-success/10",
    },
    {
      title: tAnalytics("kpi.bacs"),
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
