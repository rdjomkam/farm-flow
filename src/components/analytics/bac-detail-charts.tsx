"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { BenchmarkBadge } from "./benchmark-badge";
import {
  evaluerBenchmark,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";
import type { IndicateursBac, HistoriqueBacCycle } from "@/types";

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
  const metrics = [
    {
      label: "Biomasse",
      value: indicateurs.biomasse,
      unit: "kg",
      level: null,
    },
    {
      label: "Densite",
      value: indicateurs.densite,
      unit: "kg/m³",
      level: evaluerBenchmark(indicateurs.densite, BENCHMARK_DENSITE),
    },
    {
      label: "Poids moyen",
      value: indicateurs.poidsMoyen,
      unit: "g",
      level: null,
    },
    {
      label: "Vivants",
      value: indicateurs.nombreVivants,
      unit: "",
      level: null,
    },
    {
      label: "Aliment total",
      value: indicateurs.totalAliment,
      unit: "kg",
      level: null,
    },
    {
      label: "Morts",
      value: indicateurs.totalMortalites,
      unit: "",
      level: null,
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold leading-tight">
                {m.value !== null ? m.value : "—"}
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
  if (cycles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des cycles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun cycle enregistré pour ce bac.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = cycles.map((c) => ({
    name: c.vagueCode,
    biomasse: c.biomasse,
    poidsMoyen: c.poidsMoyen,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historique des cycles</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(v, name) =>
                      name === "Poids moyen g" ? `${v} g` : `${v} kg`
                    }
                  />
                }
              />
              <Bar dataKey="biomasse" name="Biomasse kg" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="poidsMoyen" name="Poids moyen g" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Detail metadata row
// ---------------------------------------------------------------------------

interface BacDetailMetaProps {
  indicateurs: IndicateursBac;
}

export function BacDetailMeta({ indicateurs }: BacDetailMetaProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-b border-border pb-3">
      <span>Volume : {indicateurs.volume !== null ? `${indicateurs.volume}L` : "—"}</span>
      <span>Vivants : {indicateurs.nombreVivants ?? "—"}</span>
      <span>Aliment : {indicateurs.totalAliment} kg</span>
      <span>Morts : {indicateurs.totalMortalites}</span>
      <span>{indicateurs.nombreReleves} relevé{indicateurs.nombreReleves > 1 ? "s" : ""}</span>
    </section>
  );
}
