"use client";

/**
 * admin-analytics-dashboard.tsx
 *
 * Dashboard KPIs analytics plateforme DKFarm.
 * Mobile-first (360px) : 2 colonnes KPIs → 3 → 6.
 * Graphiques Recharts chargés dynamiquement (SSR incompatible).
 *
 * Story E.1 — Sprint E (ADR-021).
 * R2 : enums importes depuis @/types.
 * R6 : couleurs via CSS variables.
 */

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CheckCircle2,
  Users,
  CreditCard,
  TrendingUp,
  Banknote,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import type { AdminAnalyticsResponse } from "@/types";

// Recharts dynamique — SSR incompatible
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((m) => m.Legend),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = "7d" | "30d" | "90d" | "12m";

interface SitesGrowthPoint {
  date: string;
  cumul: number;
  nouveaux: number;
}

interface RevenuePoint {
  date: string;
  montant: number;
}

interface ModuleDistPoint {
  module: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const XAF = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

function formatXAF(val: number): string {
  return XAF.format(val);
}

function formatShortDate(dateStr: string): string {
  // YYYY-MM-DD or YYYY-MM
  const parts = dateStr.split("-");
  if (parts.length === 2) {
    const d = new Date(dateStr + "-01");
    return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Period Selector
// ---------------------------------------------------------------------------

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
}

function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods: { label: string; value: Period }[] = [
    { label: "7j", value: "7d" },
    { label: "30j", value: "30d" },
    { label: "90j", value: "90d" },
    { label: "12m", value: "12m" },
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={[
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
            value === p.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart wrapper with loading state
// ---------------------------------------------------------------------------

interface ChartWrapperProps {
  title: string;
  isLoading: boolean;
  period?: Period;
  onPeriodChange?: (p: Period) => void;
  children: React.ReactNode;
}

function ChartWrapper({ title, isLoading, period, onPeriodChange, children }: ChartWrapperProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {period && onPeriodChange && (
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <PeriodSelector value={period} onChange={onPeriodChange} />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[180px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sites Growth Chart
// ---------------------------------------------------------------------------

interface SitesGrowthChartProps {
  data: SitesGrowthPoint[];
}

function SitesGrowthChart({ data }: SitesGrowthChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        Aucune donnee disponible
      </p>
    );
  }

  const chartData = data.map((p) => ({
    ...p,
    dateLabel: formatShortDate(p.date),
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
          <Line
            type="monotone"
            dataKey="cumul"
            name="Total cumulatif"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="nouveaux"
            name="Nouveaux"
            stroke="hsl(var(--accent-green, 142 76% 36%))"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modules Distribution Chart
// ---------------------------------------------------------------------------

interface ModulesChartProps {
  data: ModuleDistPoint[];
}

function ModulesDistributionChart({ data }: ModulesChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        Aucune donnee disponible
      </p>
    );
  }

  const chartData = data.map((d) => ({
    module: d.module.toLowerCase().replace(/_/g, " "),
    sites: d.count,
  }));

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 60, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="module"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="sites"
            name="Sites"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue Chart
// ---------------------------------------------------------------------------

interface RevenueChartProps {
  data: RevenuePoint[];
  mrr: number;
}

function RevenueChart({ data, mrr }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        Aucune donnee disponible
      </p>
    );
  }

  const chartData = data.map((p) => ({
    date: formatShortDate(p.date),
    revenus: p.montant,
    mrr,
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1000000
                ? `${(v / 1000000).toFixed(1)}M`
                : v >= 1000
                ? `${(v / 1000).toFixed(0)}k`
                : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => [typeof value === "number" ? formatXAF(value) : String(value ?? 0)]}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
          <Bar
            dataKey="revenus"
            name="Revenus"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="mrr"
            name="MRR"
            stroke="hsl(var(--accent-amber, 38 92% 50%))"
            strokeWidth={2}
            dot={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

interface AdminAnalyticsDashboardProps {
  initialKPIs: AdminAnalyticsResponse;
}

export function AdminAnalyticsDashboard({ initialKPIs }: AdminAnalyticsDashboardProps) {
  const kpis = initialKPIs;

  // Sites Growth
  const [sitesPeriod, setSitesPeriod] = useState<Period>("30d");
  const [sitesData, setSitesData] = useState<SitesGrowthPoint[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  // Revenue
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("12m");
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // Modules
  const [modulesData, setModulesData] = useState<ModuleDistPoint[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);

  const fetchSites = useCallback(async (period: Period) => {
    setSitesLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/sites?period=${period}`);
      if (res.ok) {
        const json = await res.json() as { points: SitesGrowthPoint[] };
        setSitesData(json.points ?? []);
      }
    } catch {
      // silently fail — chart shows empty state
    } finally {
      setSitesLoading(false);
    }
  }, []);

  const fetchRevenue = useCallback(async (period: Period) => {
    setRevenueLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/revenus?period=${period}`);
      if (res.ok) {
        const json = await res.json() as { points: RevenuePoint[] };
        setRevenueData(json.points ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const fetchModules = useCallback(async () => {
    setModulesLoading(true);
    try {
      const res = await fetch("/api/admin/analytics/modules");
      if (res.ok) {
        const json = await res.json() as { distribution: ModuleDistPoint[] };
        setModulesData(json.distribution ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setModulesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSites(sitesPeriod);
  }, [sitesPeriod, fetchSites]);

  useEffect(() => {
    void fetchRevenue(revenuePeriod);
  }, [revenuePeriod, fetchRevenue]);

  useEffect(() => {
    void fetchModules();
  }, [fetchModules]);

  const totalSites = kpis.sitesActifs + kpis.sitesSuspendus + kpis.sitesBlockes;

  return (
    <div className="space-y-6">
      {/* KPI Cards — 2 cols mobile, 3 tablet, 6 desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard
          title="Total sites"
          value={String(totalSites)}
          subtitle={`+${kpis.sitesCrees30j} ce mois`}
          icon={Building2}
          iconColor="text-primary"
          iconBgColor="bg-primary/10"
        />
        <KPICard
          title="Sites actifs"
          value={String(kpis.sitesActifs)}
          subtitle={`${kpis.sitesSuspendus} suspendus`}
          icon={CheckCircle2}
          iconColor="text-success"
          iconBgColor="bg-success/10"
        />
        <KPICard
          title="Total membres"
          value="—"
          subtitle="Tous sites confondus"
          icon={Users}
          iconColor="text-accent-blue"
          iconBgColor="bg-accent-blue/10"
        />
        <KPICard
          title="Abonnements actifs"
          value={String(kpis.abonnementsActifs)}
          subtitle={`${kpis.abonnementsGrace} en grace`}
          icon={CreditCard}
          iconColor="text-primary"
          iconBgColor="bg-primary/10"
        />
        <KPICard
          title="MRR"
          value={formatXAF(kpis.mrrEstime)}
          subtitle="Revenu mensuel recurrent"
          icon={TrendingUp}
          iconColor="text-accent-green"
          iconBgColor="bg-accent-green/10"
        />
        <KPICard
          title="Revenu total 12m"
          value={formatXAF(kpis.revenusTotal12m)}
          subtitle={`30j : ${formatXAF(kpis.revenusTotal30j)}`}
          icon={Banknote}
          iconColor="text-accent-amber"
          iconBgColor="bg-accent-amber/10"
        />
      </div>

      {/* Charts row 1 — Sites Growth + Modules Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartWrapper
          title="Croissance des sites"
          isLoading={sitesLoading}
          period={sitesPeriod}
          onPeriodChange={(p) => setSitesPeriod(p)}
        >
          <SitesGrowthChart data={sitesData} />
        </ChartWrapper>

        <ChartWrapper
          title="Distribution des modules"
          isLoading={modulesLoading}
        >
          <ModulesDistributionChart data={modulesData} />
        </ChartWrapper>
      </div>

      {/* Chart row 2 — Revenue */}
      <ChartWrapper
        title="Revenus par periode"
        isLoading={revenueLoading}
        period={revenuePeriod}
        onPeriodChange={(p) => setRevenuePeriod(p)}
      >
        <RevenueChart data={revenueData} mrr={kpis.mrrEstime} />
      </ChartWrapper>

      {/* Abonnements par plan */}
      {kpis.abonnementsParPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abonnements par plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {kpis.abonnementsParPlan.map((item) => (
                <div
                  key={item.typePlan}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.typePlan}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{item.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
