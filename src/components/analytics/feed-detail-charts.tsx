"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { BenchmarkBadge } from "./benchmark-badge";
import { evaluerBenchmark, BENCHMARK_FCR } from "@/lib/benchmarks";
import type { DetailAliment, DetailAlimentVague } from "@/types";
import { useTranslations } from "next-intl";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
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
// Summary card
// ---------------------------------------------------------------------------

interface FeedDetailSummaryProps {
  detail: DetailAliment;
}

export function FeedDetailSummary({ detail }: FeedDetailSummaryProps) {
  const tAnalytics = useTranslations("analytics");
  const fcrLabel = `${tAnalytics("benchmarks.fcr.label")} moyen`;
  const sgrLabel = `${tAnalytics("benchmarks.sgr.label")} moyen`;
  const metrics = [
    { label: fcrLabel, value: detail.fcrMoyen, unit: "" },
    { label: "Cout/kg gain", value: detail.coutParKgGain, unit: "CFA" },
    { label: sgrLabel, value: detail.sgrMoyen, unit: tAnalytics("labels.sgrUnit") },
    { label: "Quantite totale", value: detail.quantiteTotale, unit: "kg" },
    { label: "Cout total", value: detail.coutTotal, unit: "CFA" },
    { label: "Survie associee", value: detail.tauxSurvieAssocie, unit: "%" },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold leading-tight">
                {m.value !== null
                  ? typeof m.value === "number" && m.value >= 1000
                    ? m.value.toLocaleString("fr-FR")
                    : m.value
                  : "—"}
              </span>
              {m.unit && m.value !== null && (
                <span className="text-xs text-muted-foreground">{m.unit}</span>
              )}
            </div>
            {m.label === fcrLabel && (
              <BenchmarkBadge level={evaluerBenchmark(detail.fcrMoyen, BENCHMARK_FCR)} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FCR evolution line chart
// ---------------------------------------------------------------------------

interface FeedFCRChartProps {
  evolutionFCR: { date: string; fcr: number }[];
}

export function FeedFCRChart({ evolutionFCR }: FeedFCRChartProps) {
  if (evolutionFCR.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolution du FCR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Pas assez de donnees pour afficher l'evolution.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = evolutionFCR.map((p) => ({
    date: new Date(p.date).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    fcr: p.fcr,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolution du FCR</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} domain={["auto", "auto"]} />
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(v) => v.toFixed(2)}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="fcr"
                name="FCR"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-vague breakdown bar chart
// ---------------------------------------------------------------------------

interface FeedVagueBreakdownProps {
  parVague: DetailAlimentVague[];
}

export function FeedVagueBreakdown({ parVague }: FeedVagueBreakdownProps) {
  if (parVague.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance par vague</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune donnee par vague disponible.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = parVague.map((v) => ({
    name: v.vagueCode,
    quantite: v.quantite,
    fcr: v.fcr,
    coutKg: v.coutParKgGain,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performance par vague</CardTitle>
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
                      name === "Quantite (kg)" ? `${v} kg` : v.toFixed(2)
                    }
                  />
                }
              />
              <Bar dataKey="quantite" name="Quantite (kg)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fcr" name="FCR" fill="hsl(var(--chart-2, 217 91% 60%))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vague detail cards for mobile */}
        <div className="mt-3 flex flex-col gap-2">
        {parVague.map((v) => (
          <Card key={v.vagueId}>
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{v.vagueCode}</span>
                <span className="text-xs text-muted-foreground">
                  {v.quantite} kg
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>FCR : {v.fcr !== null ? v.fcr : "—"}</span>
                <span>SGR : {v.sgr !== null ? `${v.sgr}%/j` : "—"}</span>
                <span>
                  Cout : {v.coutParKgGain !== null ? `${v.coutParKgGain.toLocaleString("fr-FR")} CFA/kg` : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Metadata row
// ---------------------------------------------------------------------------

interface FeedDetailMetaProps {
  detail: DetailAliment;
}

export function FeedDetailMeta({ detail }: FeedDetailMetaProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-b border-border pb-3">
      <span>Prix : {detail.prixUnitaire.toLocaleString("fr-FR")} CFA/kg</span>
      {detail.fournisseurNom && <span>Fournisseur : {detail.fournisseurNom}</span>}
      <span>{detail.nombreVagues} vague{detail.nombreVagues > 1 ? "s" : ""}</span>
      <span>{detail.quantiteTotale} kg utilises</span>
    </section>
  );
}
