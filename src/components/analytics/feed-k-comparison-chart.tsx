"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import type { AnalytiqueAliment } from "@/types";
import type { GompertzKLevel } from "@/lib/benchmarks";

// ---------------------------------------------------------------------------
// Recharts lazy imports (SSR incompatible)
// ---------------------------------------------------------------------------

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
const Cell = dynamic(
  () => import("recharts").then((mod) => mod.Cell),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kNiveauColor(niveau: GompertzKLevel): string {
  switch (niveau) {
    case "EXCELLENT":
      return "#059669"; // emerald-600
    case "BON":
      return "#d97706"; // amber-600
    case "FAIBLE":
    default:
      return "#dc2626"; // red-600
  }
}

// ---------------------------------------------------------------------------
// Tooltip personnalise
// ---------------------------------------------------------------------------

interface KTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: ChartEntry }[];
  moyenne: number;
  tAnalytics: ReturnType<typeof useTranslations>;
}

function KTooltip({ active, payload, moyenne, tAnalytics }: KTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  const pct = moyenne > 0 ? Math.abs(((entry.k - moyenne) / moyenne) * 100).toFixed(1) : "0.0";
  const direction =
    entry.k >= moyenne
      ? tAnalytics("gompertz.tooltipAbove")
      : tAnalytics("gompertz.tooltipBelow");
  const message = tAnalytics("gompertz.tooltipTemplate", { pct, direction });

  return (
    <div className="rounded-md border border-border bg-background p-2 shadow text-xs max-w-[200px]">
      <p className="font-semibold mb-1 truncate">{entry.nom}</p>
      <p className="text-muted-foreground">K = {entry.k.toFixed(4)}</p>
      <p className="mt-1 text-muted-foreground leading-snug">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface ChartEntry {
  nom: string;
  k: number;
  niveau: GompertzKLevel;
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface FeedKComparisonChartProps {
  aliments: AnalytiqueAliment[];
}

/**
 * Graphique horizontal comparant le parametre K Gompertz par aliment.
 * Affiche uniquement si au moins 2 aliments ont des donnees Gompertz.
 * Mobile first : lisible a 360px.
 */
export function FeedKComparisonChart({ aliments }: FeedKComparisonChartProps) {
  const tAnalytics = useTranslations("analytics");

  // Filtrer les aliments qui ont des donnees Gompertz
  const alimentsAvecK: ChartEntry[] = aliments
    .filter(
      (a): a is AnalytiqueAliment & { kMoyenGompertz: number; kNiveauGompertz: GompertzKLevel } =>
        a.kMoyenGompertz != null && a.kNiveauGompertz != null
    )
    .map((a) => ({
      nom: a.produitNom,
      k: a.kMoyenGompertz,
      niveau: a.kNiveauGompertz,
    }))
    // Trie du meilleur (K le plus haut) au moins bon
    .sort((a, b) => b.k - a.k);

  // Cacher le composant si pas assez de donnees
  if (alimentsAvecK.length < 2) return null;

  // Moyenne pour le tooltip
  const moyenne =
    alimentsAvecK.reduce((sum, e) => sum + e.k, 0) / alimentsAvecK.length;

  // Hauteur dynamique : 48px par barre + header
  const chartHeight = Math.max(120, alimentsAvecK.length * 48);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-semibold">
          {tAnalytics("gompertz.chartTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={alimentsAvecK}
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                dataKey="k"
                domain={[0, "dataMax"]}
                tickFormatter={(v: number) => v.toFixed(3)}
                tick={{ fontSize: 10 }}
                label={{
                  value: tAnalytics("gompertz.chartXAxisLabel"),
                  position: "insideBottomRight",
                  offset: -4,
                  style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                }}
              />
              <YAxis
                type="category"
                dataKey="nom"
                width={90}
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <Tooltip
                content={
                  <KTooltip moyenne={moyenne} tAnalytics={tAnalytics} />
                }
              />
              <Bar dataKey="k" radius={[0, 4, 4, 0]}>
                {alimentsAvecK.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={kNiveauColor(entry.niveau)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
