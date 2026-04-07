"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { BenchmarkBadge } from "./benchmark-badge";
import { evaluerBenchmark, BENCHMARK_FCR } from "@/lib/benchmarks";
import type { DetailAliment, DetailAlimentVague, FCRHebdomadairePoint, ChangementGranule } from "@/types";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";

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
const ComposedChart = dynamic(
  () => import("recharts").then((mod) => mod.ComposedChart),
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
const ReferenceLine = dynamic(
  () => import("recharts").then((mod) => mod.ReferenceLine),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((mod) => mod.Legend),
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
  const fcrLabel = tAnalytics("aliments.fcrMoyen");
  const sgrLabel = tAnalytics("aliments.sgrMoyen");
  const metrics = [
    { label: fcrLabel, value: detail.fcrMoyen, unit: "" },
    { label: tAnalytics("aliments.coutKgLabel"), value: detail.coutParKgGain, unit: "CFA" },
    { label: sgrLabel, value: detail.sgrMoyen, unit: tAnalytics("labels.sgrUnit") },
    { label: tAnalytics("aliments.quantiteTotale"), value: detail.quantiteTotale, unit: "kg" },
    { label: tAnalytics("aliments.coutTotal"), value: detail.coutTotal, unit: "CFA" },
    { label: tAnalytics("aliments.survieAssociee"), value: detail.tauxSurvieAssocie, unit: "%" },
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
                    ? formatNumber(m.value)
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
  const tAnalytics = useTranslations("analytics");

  if (evolutionFCR.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tAnalytics("aliments.evolutionFCR")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {tAnalytics("aliments.pasAssezDonnees")}
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
    <ErrorBoundary section="le graphique FCR">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tAnalytics("aliments.evolutionFCR")}</CardTitle>
        </CardHeader>
        <CardContent>
          <figure>
            <figcaption className="sr-only">{tAnalytics("aliments.evolutionFCR")}</figcaption>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} domain={["auto", "auto"]} />
                  <Tooltip
                    cursor={<ChartCrosshair />}
                    content={<ChartTooltip valueFormatter={(v) => v.toFixed(2)} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="fcr"
                    name="FCR"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6, stroke: "var(--primary)", strokeWidth: 2, fill: "white" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Per-vague breakdown bar chart
// ---------------------------------------------------------------------------

interface FeedVagueBreakdownProps {
  parVague: DetailAlimentVague[];
}

export function FeedVagueBreakdown({ parVague }: FeedVagueBreakdownProps) {
  const tAnalytics = useTranslations("analytics");

  if (parVague.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tAnalytics("aliments.performanceParVague")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {tAnalytics("aliments.aucuneDonneeVague")}
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
    <ErrorBoundary section="le graphique par vague">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tAnalytics("aliments.performanceParVague")}</CardTitle>
        </CardHeader>
        <CardContent>
          <figure>
            <figcaption className="sr-only">{tAnalytics("aliments.performanceParVague")}</figcaption>
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
                          name === "Quantite (kg)" ? `${v} kg` : v.toFixed(2)
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="quantite"
                    name="Quantite (kg)"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="fcr"
                    name="FCR"
                    fill="hsl(var(--chart-2, 217 91% 60%))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>

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
                <span>{tAnalytics("benchmarks.fcr.label")} : {v.fcr !== null ? v.fcr : "—"}</span>
                <span>{tAnalytics("benchmarks.sgr.label")} : {v.sgr !== null ? `${v.sgr}%/j` : "—"}</span>
                <span>
                  {tAnalytics("aliments.cout")} : {v.coutParKgGain !== null ? `${formatNumber(v.coutParKgGain)} CFA/kg` : "—"}
                </span>
              </div>
              {/* ADR-036: per-bac period breakdown */}
              {v.periodesBac && v.periodesBac.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
                    {v.periodesBac.length} periode{v.periodesBac.length !== 1 ? "s" : ""} par bac
                  </summary>
                  <div className="mt-1 flex flex-col gap-1 pl-2 border-l border-border">
                    {v.periodesBac.map((p, idx) => (
                      <div key={`${p.bacId}-${idx}`} className="text-xs">
                        <span className="font-medium">{p.bacNom}</span>
                        {" · "}
                        {new Date(p.dateDebut).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                        {" → "}
                        {new Date(p.dateFin).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                        {" · "}
                        {p.qtyAlimentKg.toFixed(1)} kg
                        {p.fcr !== null && (
                          <span className="ml-1 text-primary font-semibold">ICA {p.fcr.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      </CardContent>
    </Card>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Metadata row
// ---------------------------------------------------------------------------

interface FeedDetailMetaProps {
  detail: DetailAliment;
}

export function FeedDetailMeta({ detail }: FeedDetailMetaProps) {
  const tAnalytics = useTranslations("analytics");

  return (
    <section className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-b border-border pb-3">
      <span>{tAnalytics("aliments.prix")} : {formatNumber(detail.prixUnitaire)} CFA/kg</span>
      {detail.fournisseurNom && <span>{tAnalytics("aliments.fournisseur")} : {detail.fournisseurNom}</span>}
      <span>{tAnalytics("aliments.vagues", { count: detail.nombreVagues })}</span>
      <span>{tAnalytics("aliments.kgUtilisesMeta", { qty: detail.quantiteTotale })}</span>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FC.7 — FCR hebdomadaire (ComposedChart bar + line + reference lines)
// ---------------------------------------------------------------------------

interface FeedFCRHebdoChartProps {
  points: FCRHebdomadairePoint[];
  changements?: ChangementGranule[];
}

export function FeedFCRHebdoChart({ points, changements = [] }: FeedFCRHebdoChartProps) {
  const tAnalytics = useTranslations("analytics");

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tAnalytics("aliments.fcrHebdoTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {tAnalytics("aliments.pasAssezDonnees")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Format semaine ISO "YYYY-WNN" → "S12 2026"
  const formatSemaine = (s: string) => {
    const [year, week] = s.split("-W");
    return `S${week} ${year}`;
  };

  const data = points.map((p) => ({
    semaine: formatSemaine(p.semaine),
    semaineRaw: p.semaine,
    quantiteAlimentKg: p.quantiteAlimentKg,
    fcr: p.fcr,
    benchmarkFCR: p.benchmarkFCR,
  }));

  // Benchmark value for ReferenceLine (from first point with benchmarkFCR)
  const benchmarkValue = points.find((p) => p.benchmarkFCR !== null)?.benchmarkFCR ?? null;

  // Changements de granulé : map semaine ISO → label
  const changementsMap = new Set(
    changements.map((c) => {
      const d = new Date(c.date);
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const weekNum = Math.ceil(
        ((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7
      );
      return formatSemaine(`${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`);
    })
  );

  return (
    <Card>
        <CardHeader>
          <CardTitle className="text-base">{tAnalytics("aliments.fcrHebdoTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary section="le graphique FCR hebdomadaire">
            <figure>
              <figcaption className="sr-only">{tAnalytics("aliments.fcrHebdoTitle")}</figcaption>
              <div className="h-[300px] w-full sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="semaine"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              {/* Left Y-axis for kg aliment */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                width={40}
                label={{
                  value: "kg",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10 },
                }}
              />
              {/* Right Y-axis for FCR */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                width={40}
                domain={[0, "auto"]}
                label={{
                  value: tAnalytics("benchmarks.fcr.label"),
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 10 },
                }}
              />
              <Tooltip
                cursor={<ChartCrosshair />}
                content={
                  <ChartTooltip
                    valueFormatter={(v, name) => {
                      if (name === tAnalytics("benchmarks.fcr.label")) return v.toFixed(2);
                      return `${v.toFixed(1)} kg`;
                    }}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                yAxisId="left"
                dataKey="quantiteAlimentKg"
                name={tAnalytics("aliments.quantiteTotale")}
                fill="var(--primary)"
                opacity={0.7}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="fcr"
                name={tAnalytics("benchmarks.fcr.label")}
                stroke="var(--destructive)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
              {/* Benchmark FCR reference line */}
              {benchmarkValue !== null && (
                <ReferenceLine
                  yAxisId="right"
                  y={benchmarkValue}
                  stroke="var(--warning, orange)"
                  strokeDasharray="6 3"
                  label={{
                    value: `${tAnalytics("benchmarks.fcr.label")} ref: ${benchmarkValue}`,
                    position: "insideTopRight",
                    style: { fontSize: 10, fill: "var(--muted-foreground)" },
                  }}
                />
              )}
              {/* Changements de granulé — vertical reference lines */}
              {[...changementsMap].map((semaine) => (
                <ReferenceLine
                  key={semaine}
                  yAxisId="left"
                  x={semaine}
                  stroke="var(--secondary-foreground, #888)"
                  strokeDasharray="4 2"
                  label={{
                    value: tAnalytics("aliments.changementGranule"),
                    position: "insideTopLeft",
                    style: { fontSize: 9, fill: "var(--muted-foreground)" },
                  }}
                />
              ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </figure>
          </ErrorBoundary>
        </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FC.8 — Corrélation mortalité / aliment
// ---------------------------------------------------------------------------

interface FeedMortaliteCorrelationProps {
  parVague: DetailAlimentVague[];
}

export function FeedMortaliteCorrelation({ parVague }: FeedMortaliteCorrelationProps) {
  const tAnalytics = useTranslations("analytics");

  const vaguesAvecMortalite = parVague.filter(
    (v) => v.tauxMortaliteAssocie !== null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tAnalytics("aliments.correlationMortalite")}</CardTitle>
      </CardHeader>
      <CardContent>
        {vaguesAvecMortalite.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tAnalytics("aliments.aucuneDonneeMortalite")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {vaguesAvecMortalite.map((v) => {
              const mortalite = v.tauxMortaliteAssocie!;
              const isHigh = mortalite > 10;
              return (
                <div
                  key={v.vagueId}
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <span className="text-sm font-medium">{v.vagueCode}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      isHigh
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {mortalite.toFixed(1)} %
                    {isHigh && (
                      <span className="ml-1">{tAnalytics("aliments.mortaliteElevee")}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
