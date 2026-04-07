"use client";

import { Users, Package, HeartPulse, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { KPICard } from "@/components/ui/kpi-card";
import type { IngenieurDashboardMetrics } from "@/lib/queries/ingenieur";

interface DashboardStatsProps {
  metrics: IngenieurDashboardMetrics;
}

export function DashboardStats({ metrics }: DashboardStatsProps) {
  const t = useTranslations("ingenieur");

  const stats = [
    {
      title: t("stats.clientsActives"),
      value: String(metrics.totalClientsActives),
      subtitle: t("stats.clientsActivesSubtitle"),
      icon: Users,
      iconColor: "text-primary",
      iconBgColor: "bg-primary/10",
    },
    {
      title: t("stats.packsActifs"),
      value: String(metrics.packsActifs),
      subtitle: t("stats.packsActifsSubtitle"),
      icon: Package,
      iconColor: "text-accent-blue",
      iconBgColor: "bg-accent-blue-muted",
    },
    {
      title: t("stats.survieMoyenne"),
      value: metrics.survieMoyenne !== null ? `${metrics.survieMoyenne}%` : "—",
      subtitle: t("stats.survieMoyenneSubtitle"),
      icon: HeartPulse,
      iconColor:
        metrics.survieMoyenne === null
          ? "text-muted-foreground"
          : metrics.survieMoyenne >= 90
          ? "text-success"
          : metrics.survieMoyenne >= 80
          ? "text-accent-amber"
          : "text-danger",
      iconBgColor:
        metrics.survieMoyenne === null
          ? "bg-muted"
          : metrics.survieMoyenne >= 90
          ? "bg-success/10"
          : metrics.survieMoyenne >= 80
          ? "bg-accent-amber-muted"
          : "bg-danger/10",
    },
    {
      title: t("stats.fermesEnAlerte"),
      value: String(metrics.fermesNecessitantAttention),
      subtitle: metrics.fermesNecessitantAttention > 0
        ? t("stats.necessitentAttention")
        : t("stats.toutVaBien"),
      icon: AlertTriangle,
      iconColor: metrics.fermesNecessitantAttention > 0 ? "text-danger" : "text-success",
      iconBgColor:
        metrics.fermesNecessitantAttention > 0 ? "bg-danger/10" : "bg-success/10",
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
