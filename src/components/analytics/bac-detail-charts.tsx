"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { BenchmarkBadge } from "./benchmark-badge";
import {
  evaluerBenchmark,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";
import type { IndicateursBac, HistoriqueBacCycle } from "@/types";
import { formatNum } from "@/lib/format";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((mod) => mod.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Indicateurs summary card
// ---------------------------------------------------------------------------

interface BacDetailSummaryProps {
  indicateurs: IndicateursBac;
}

export function BacDetailSummary({ indicateurs }: BacDetailSummaryProps) {
  const t = useTranslations("analytics.bacs");

  const metrics = [
    {
      key: "biomass",
      label: t("biomass"),
      value: indicateurs.biomasse,
      unit: "kg",
      level: null,
    },
    {
      key: "density",
      label: t("density"),
      value: indicateurs.densite,
      unit: "kg/m³",
      level: evaluerBenchmark(indicateurs.densite, BENCHMARK_DENSITE),
    },
    {
      key: "avgWeight",
      label: t("avgWeight"),
      value: indicateurs.poidsMoyen,
      unit: "g",
      level: null,
    },
    {
      key: "alive",
      label: t("alive"),
      value: indicateurs.nombreVivants,
      unit: "",
      level: null,
    },
    {
      key: "totalFeed",
      label: t("totalFeed"),
      value: indicateurs.totalAliment,
      unit: "kg",
      level: null,
    },
    {
      key: "deaths",
      label: t("deaths"),
      value: indicateurs.totalMortalites,
      unit: "",
      level: null,
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.key} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold leading-tight">
                {m.key === "biomass" || m.key === "totalFeed"
                  ? formatNum(m.value, 2)
                  : m.key === "avgWeight"
                    ? formatNum(m.value, 1)
                    : m.value !== null ? m.value : "—"}
              </span>
              {m.unit && m.value !== null && (
                <span className="text-xs text-muted-foreground">{m.unit}</span>
              )}
            </div>
            <BenchmarkBadge level={m.level} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Historique bar chart
// ---------------------------------------------------------------------------

interface BacHistoriqueChartProps {
  cycles: HistoriqueBacCycle[];
}

export function BacHistoriqueChart({ cycles }: BacHistoriqueChartProps) {
  const t = useTranslations("analytics.bacs");
  const tAnalytics = useTranslations("analytics");

  if (cycles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("historique")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noCycles")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const biomassKgLabel = t("biomassKg");
  const avgWeightGLabel = t("avgWeightG");

  const data = cycles.map((c) => ({
    name: c.vagueCode,
    biomasse: c.biomasse,
    poidsMoyen: c.poidsMoyen,
  }));

  return (
    <ErrorBoundary section={tAnalytics("errorSection.historyChart")}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("historique")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  cursor={<ChartCrosshair />}
                  content={
                    <ChartTooltip
                      valueFormatter={(v, name) =>
                        name === avgWeightGLabel ? `${v} g` : `${v} kg`
                      }
                    />
                  }
                />
                <Bar dataKey="biomasse" name={biomassKgLabel} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="poidsMoyen" name={avgWeightGLabel} fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Detail metadata row
// ---------------------------------------------------------------------------

interface BacDetailMetaProps {
  indicateurs: IndicateursBac;
}

export function BacDetailMeta({ indicateurs }: BacDetailMetaProps) {
  const t = useTranslations("analytics.bacs");

  return (
    <section className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-b border-border pb-3">
      <span>{t("volume")} : {indicateurs.volume !== null ? `${indicateurs.volume}L` : "—"}</span>
      <span>{t("alive")} : {indicateurs.nombreVivants ?? "—"}</span>
      <span>{t("aliment")} : {indicateurs.totalAliment} kg</span>
      <span>{t("deaths")} : {indicateurs.totalMortalites}</span>
      <span>{t("releves", { count: indicateurs.nombreReleves })}</span>
    </section>
  );
}
