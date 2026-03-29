"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatutVague } from "@/types";
import type { IndicateursVagueComplet, ComparaisonVagues } from "@/types";
import { formatNum } from "@/lib/format";
import { useAnalyticsService } from "@/services";

// ---------------------------------------------------------------------------
// Recharts (client-side only)
// ---------------------------------------------------------------------------

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const RadarChart = dynamic(
  () => import("recharts").then((mod) => mod.RadarChart),
  { ssr: false }
);
const PolarGrid = dynamic(
  () => import("recharts").then((mod) => mod.PolarGrid),
  { ssr: false }
);
const PolarAngleAxis = dynamic(
  () => import("recharts").then((mod) => mod.PolarAngleAxis),
  { ssr: false }
);
const Radar = dynamic(
  () => import("recharts").then((mod) => mod.Radar),
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
const Legend = dynamic(
  () => import("recharts").then((mod) => mod.Legend),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Couleurs distinctes pour les vagues
// ---------------------------------------------------------------------------

const VAGUE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 217 91% 60%))",
  "hsl(var(--chart-3, 38 92% 50%))",
  "hsl(var(--chart-4, 262 83% 58%))",
];

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

type VagueSummary = {
  id: string;
  code: string;
  statut: string;
  nombreInitial: number;
  _count: { bacs: number; releves: number };
};

function statutClass(statut: string): string {
  if (statut === StatutVague.EN_COURS)
    return "bg-accent-green-muted text-accent-green";
  if (statut === StatutVague.TERMINEE)
    return "bg-accent-blue-muted text-accent-blue";
  return "bg-muted text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Carte de resultat d'une vague
// ---------------------------------------------------------------------------

interface VagueResultCardProps {
  vague: IndicateursVagueComplet;
  color: string;
  allVagues: IndicateursVagueComplet[];
}

function isBest<K extends keyof IndicateursVagueComplet>(
  vague: IndicateursVagueComplet,
  allVagues: IndicateursVagueComplet[],
  key: K,
  higherIsBetter: boolean
): boolean {
  const val = vague[key] as number | null;
  if (val === null) return false;
  const others = allVagues.map((v) => v[key] as number | null).filter((v) => v !== null) as number[];
  if (others.length === 0) return false;
  return higherIsBetter
    ? val === Math.max(...others)
    : val === Math.min(...others);
}

function MetricRow({
  label,
  value,
  unit,
  best,
  worst,
}: {
  label: string;
  value: string;
  unit?: string;
  best?: boolean;
  worst?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          best && "text-success",
          worst && "text-danger"
        )}
      >
        {value}
        {unit && (
          <span className="text-xs font-normal text-muted-foreground"> {unit}</span>
        )}
      </span>
    </div>
  );
}

function VagueResultCard({ vague, color, allVagues }: VagueResultCardProps) {
  const tAnalytics = useTranslations("analytics");
  const tVagues = useTranslations("vagues");
  const locale = useLocale();
  const formatDate = (d: Date | null | string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <h3 className="text-sm font-bold truncate">{vague.code}</h3>
          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", statutClass(vague.statut))}>
            {tVagues(`statuts.${vague.statut as "EN_COURS" | "TERMINEE" | "ANNULEE"}`)}
          </span>
        </div>

        {/* Meta */}
        <p className="text-xs text-muted-foreground mb-3">
          {formatDate(vague.dateDebut)} — {formatDate(vague.dateFin)} ({vague.dureeJours}j)
        </p>

        {/* Indicateurs zootechniques */}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {tVagues("comparison.sectionZootechnique")}
        </p>
        <div className="mb-3">
          <MetricRow
            label={tAnalytics("benchmarks.fcr.label")}
            value={formatNum(vague.fcrGlobal, 2)}
            best={isBest(vague, allVagues, "fcrGlobal", false)}
            worst={
              vague.fcrGlobal !== null &&
              !isBest(vague, allVagues, "fcrGlobal", false) &&
              allVagues.filter((v) => v.fcrGlobal !== null).length > 1 &&
              vague.fcrGlobal === Math.max(...allVagues.map((v) => v.fcrGlobal ?? -Infinity))
            }
          />
          <MetricRow
            label={tVagues("comparison.metrics.survie")}
            value={vague.tauxSurvie !== null ? `${vague.tauxSurvie}` : "—"}
            unit="%"
            best={isBest(vague, allVagues, "tauxSurvie", true)}
            worst={
              vague.tauxSurvie !== null &&
              !isBest(vague, allVagues, "tauxSurvie", true) &&
              allVagues.filter((v) => v.tauxSurvie !== null).length > 1 &&
              vague.tauxSurvie === Math.min(...allVagues.map((v) => v.tauxSurvie ?? Infinity))
            }
          />
          <MetricRow
            label={tAnalytics("benchmarks.sgr.label")}
            value={formatNum(vague.sgrMoyen, 2)}
            unit={tAnalytics("labels.sgrUnit")}
            best={isBest(vague, allVagues, "sgrMoyen", true)}
          />
          <MetricRow
            label={tVagues("comparison.metrics.biomasse")}
            value={formatNum(vague.biomasseProduite, 2)}
            unit="kg"
            best={isBest(vague, allVagues, "biomasseProduite", true)}
          />
        </div>

        {/* Indicateurs financiers */}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {tVagues("comparison.sectionFinancier")}
        </p>
        <div>
          <MetricRow
            label={tVagues("comparison.metrics.coutAliment")}
            value={vague.coutTotalAliment.toLocaleString("fr-FR")}
            unit="CFA"
          />
          <MetricRow
            label={tVagues("comparison.metrics.revenuVentes")}
            value={vague.revenuVentes.toLocaleString("fr-FR")}
            unit="CFA"
            best={isBest(vague, allVagues, "revenuVentes", true)}
          />
          <MetricRow
            label={tVagues("comparison.metrics.margeBrute")}
            value={vague.margeBrute !== null ? vague.margeBrute.toLocaleString("fr-FR") : "—"}
            unit="CFA"
            best={isBest(vague, allVagues, "margeBrute", true)}
            worst={
              vague.margeBrute !== null &&
              !isBest(vague, allVagues, "margeBrute", true) &&
              allVagues.filter((v) => v.margeBrute !== null).length > 1 &&
              vague.margeBrute === Math.min(...allVagues.map((v) => v.margeBrute ?? Infinity))
            }
          />
          <MetricRow
            label={tVagues("comparison.metrics.roi")}
            value={vague.roi !== null ? `${vague.roi}` : "—"}
            unit="%"
            best={isBest(vague, allVagues, "roi", true)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Graphique radar
// ---------------------------------------------------------------------------

function VaguesRadarChart({ vagues }: { vagues: IndicateursVagueComplet[] }) {
  const tAnalytics = useTranslations("analytics");
  // Normaliser les valeurs entre 0 et 100
  function normalize(value: number | null, min: number, max: number): number {
    if (value === null) return 0;
    if (max === min) return 50;
    return Math.round(((value - min) / (max - min)) * 100);
  }

  const survieValues = vagues.map((v) => v.tauxSurvie ?? 0);
  const sgrValues = vagues.map((v) => v.sgrMoyen ?? 0);
  const roiValues = vagues.map((v) => v.roi ?? 0);
  const margeValues = vagues.map((v) => v.margeBrute ?? 0);
  // FCR: inversé (plus bas = meilleur)
  const fcrValues = vagues.map((v) => v.fcrGlobal ?? 0);

  const data = [
    { axe: tAnalytics("axes.survie") },
    { axe: tAnalytics("axes.sgrPerDay") },
    { axe: tAnalytics("axes.roi") },
    { axe: tAnalytics("axes.marge") },
    { axe: tAnalytics("axes.fcrInverse") },
  ];

  const radarData = data.map((d, i) => {
    const obj: Record<string, unknown> = { axe: d.axe };
    vagues.forEach((v, vi) => {
      let val: number;
      if (i === 0) val = normalize(v.tauxSurvie, Math.min(...survieValues), Math.max(...survieValues));
      else if (i === 1) val = normalize(v.sgrMoyen, Math.min(...sgrValues), Math.max(...sgrValues));
      else if (i === 2) val = normalize(v.roi, Math.min(...roiValues), Math.max(...roiValues));
      else if (i === 3) val = normalize(v.margeBrute, Math.min(...margeValues), Math.max(...margeValues));
      else {
        // FCR inversé
        const maxFCR = Math.max(...fcrValues);
        const minFCR = Math.min(...fcrValues);
        val = normalize(v.fcrGlobal !== null ? maxFCR + minFCR - v.fcrGlobal : null, minFCR, maxFCR);
      }
      void vi; // used implicitly via v
      obj[v.code] = val;
    });
    return obj;
  });

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="axe" tick={{ fontSize: 11 }} />
          {vagues.map((v, i) => (
            <Radar
              key={v.id}
              name={v.code}
              dataKey={v.code}
              stroke={VAGUE_COLORS[i % VAGUE_COLORS.length]}
              fill={VAGUE_COLORS[i % VAGUE_COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Legend />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graphique barres financieres
// ---------------------------------------------------------------------------

function VaguesFinancialChart({ vagues }: { vagues: IndicateursVagueComplet[] }) {
  const tVagues = useTranslations("vagues");
  const data = [
    {
      name: tVagues("comparison.financialChart.coutAliment"),
      ...Object.fromEntries(vagues.map((v) => [v.code, v.coutTotalAliment])),
    },
    {
      name: tVagues("comparison.financialChart.revenuVentes"),
      ...Object.fromEntries(vagues.map((v) => [v.code, v.revenuVentes])),
    },
    {
      name: tVagues("comparison.financialChart.margeBrute"),
      ...Object.fromEntries(vagues.map((v) => [v.code, v.margeBrute ?? 0])),
    },
  ];

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            width={55}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) =>
              typeof value === "number"
                ? `${value.toLocaleString("fr-FR")} CFA`
                : `${value} CFA`
            }
          />
          <Legend />
          {vagues.map((v, i) => (
            <Bar
              key={v.id}
              dataKey={v.code}
              name={v.code}
              fill={VAGUE_COLORS[i % VAGUE_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface VaguesComparisonClientProps {
  vagues: VagueSummary[];
}

export function VaguesComparisonClient({ vagues }: VaguesComparisonClientProps) {
  const analyticsService = useAnalyticsService();
  const tVagues = useTranslations("vagues");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ComparaisonVagues | null>(null);
  const [showSelector, setShowSelector] = useState(true);
  const [isComparing, setIsComparing] = useState(false);

  function toggleVague(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
    // Reset results if selection changes
    setResult(null);
  }

  async function handleComparer() {
    if (selectedIds.size < 2) return;
    setIsComparing(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await analyticsService.getVagues({ vagueIds: ids });
      if (res.ok && res.data) {
        setResult(res.data as unknown as ComparaisonVagues);
        setShowSelector(false);
      }
    } finally {
      setIsComparing(false);
    }
  }

  const canCompare = selectedIds.size >= 2;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Selecteur de vagues */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {tVagues("comparison.selectTitle")}
          </h2>
          {result && (
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {showSelector ? tVagues("comparison.hide") : tVagues("comparison.modify")}
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", showSelector && "rotate-180")}
              />
            </button>
          )}
        </div>

        {showSelector && (
          <>
            {vagues.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {tVagues("comparison.noVagues")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {vagues.map((v) => {
                  const selected = selectedIds.has(v.id);
                  const disabled = !selected && selectedIds.size >= 4;

                  return (
                    <button
                      key={v.id}
                      onClick={() => !disabled && toggleVague(v.id)}
                      disabled={disabled}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 text-left transition-colors min-h-[56px]",
                        selected
                          ? "border-primary bg-primary/5"
                          : disabled
                            ? "border-border/50 opacity-40 cursor-not-allowed"
                            : "border-border hover:bg-muted cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox visuel */}
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                            selected ? "border-primary bg-primary" : "border-border"
                          )}
                        >
                          {selected && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{v.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {tVagues("comparison.alevins", { count: v.nombreInitial })} — {v._count.bacs > 1 ? tVagues("card.bacs", { count: v._count.bacs }) : tVagues("card.bac", { count: v._count.bacs })} — {v._count.releves > 1 ? tVagues("comparison.releves", { count: v._count.releves }) : tVagues("comparison.releve", { count: v._count.releves })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          statutClass(v.statut)
                        )}
                      >
                        {tVagues(`statuts.${v.statut as "EN_COURS" | "TERMINEE" | "ANNULEE"}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">
                {selectedIds.size > 1
                  ? tVagues("comparison.selectedCountPlural", { count: selectedIds.size })
                  : tVagues("comparison.selectedCount", { count: selectedIds.size })}
              </p>
              <Button
                onClick={handleComparer}
                disabled={!canCompare || isComparing}
                className="w-full min-h-[48px]"
              >
                {isComparing ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    {tVagues("comparison.comparing")}
                  </span>
                ) : (
                  tVagues("comparison.compareButton")
                )}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Resultats */}
      {result && result.vagues.length > 0 && (
        <>
          {/* Cartes comparatives */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {tVagues("comparison.resultsTitle", { count: result.vagues.length })}
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {result.vagues.map((v, i) => (
                <VagueResultCard
                  key={v.id}
                  vague={v}
                  color={VAGUE_COLORS[i % VAGUE_COLORS.length]}
                  allVagues={result.vagues}
                />
              ))}
            </div>
          </section>

          {/* Graphique radar */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {tVagues("comparison.sectionRadar")}
            </h2>
            <Card>
              <CardContent className="p-3">
                <VaguesRadarChart vagues={result.vagues} />
              </CardContent>
            </Card>
          </section>

          {/* Graphique barres financieres */}
          {result.vagues.some((v) => v.coutTotalAliment > 0 || v.revenuVentes > 0) && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {tVagues("comparison.sectionComparaisonFinanciere")}
              </h2>
              <Card>
                <CardContent className="p-3">
                  <VaguesFinancialChart vagues={result.vagues} />
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
