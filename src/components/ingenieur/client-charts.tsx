"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip, ChartCrosshair } from "@/components/ui/chart-tooltip";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Recharts — chargement dynamique SSR:false
// ---------------------------------------------------------------------------

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
// Types
// ---------------------------------------------------------------------------

interface ReleveMinimal {
  id: string;
  date: string;
  typeReleve: string;
  poidsMoyen: number | null;
  tailleMoyenne: number | null;
  nombreMorts: number | null;
  nombreCompte: number | null;
}

interface VagueAvecReleves {
  id: string;
  code: string;
  dateDebut: string;
  nombreInitial: number;
  poidsMoyenInitial: number;
  releves: ReleveMinimal[];
}

interface IngenieurClientChartsProps {
  vagues: VagueAvecReleves[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCroissanceData(vague: VagueAvecReleves) {
  const biometries = vague.releves
    .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Point initial
  const points: { jour: number; poidsMoyen: number; label: string; date: string }[] = [
    {
      jour: 0,
      poidsMoyen: vague.poidsMoyenInitial,
      label: "J0",
      date: vague.dateDebut,
    },
  ];

  for (const r of biometries) {
    const jour = Math.floor(
      (new Date(r.date).getTime() - new Date(vague.dateDebut).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    points.push({
      jour,
      poidsMoyen: r.poidsMoyen!,
      label: `J${jour}`,
      date: r.date,
    });
  }

  return points;
}

function buildMortaliteData(vague: VagueAvecReleves) {
  const mortalites = vague.releves
    .filter((r) => r.typeReleve === TypeReleve.MORTALITE && r.nombreMorts !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return mortalites.map((r) => {
    const jour = Math.floor(
      (new Date(r.date).getTime() - new Date(vague.dateDebut).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return {
      jour,
      nombreMorts: r.nombreMorts!,
      label: `J${jour}`,
      date: r.date,
    };
  });
}

function buildSurvieData(vague: VagueAvecReleves) {
  const mortalites = vague.releves
    .filter((r) => r.typeReleve === TypeReleve.MORTALITE)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalMorts = 0;
  const points: { jour: number; survie: number; label: string; date: string }[] = [];

  // Point initial
  points.push({ jour: 0, survie: 100, label: "J0", date: vague.dateDebut });

  for (const r of mortalites) {
    totalMorts += r.nombreMorts ?? 0;
    const survie =
      vague.nombreInitial > 0
        ? Math.round(((vague.nombreInitial - totalMorts) / vague.nombreInitial) * 10000) / 100
        : 0;
    const jour = Math.floor(
      (new Date(r.date).getTime() - new Date(vague.dateDebut).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    points.push({ jour, survie, label: `J${jour}`, date: r.date });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Tooltip helpers — use date from payload for label
// ---------------------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function formatTooltipLabel(label: string, payload?: Array<{ payload?: Record<string, unknown> }>) {
  const dateStr = payload?.[0]?.payload?.date
    ? dateFormat.format(new Date(payload[0].payload.date as string))
    : "";
  return dateStr ? `${label} — ${dateStr}` : String(label);
}

const tooltipCroissance = (
  <ChartTooltip
    labelFormatter={formatTooltipLabel}
    valueFormatter={(v) => `${v} g`}
  />
);

const tooltipSurvie = (
  <ChartTooltip
    labelFormatter={formatTooltipLabel}
    valueFormatter={(v) => `${v}%`}
  />
);

const tooltipMortalite = (
  <ChartTooltip
    labelFormatter={formatTooltipLabel}
    valueFormatter={(v) => `${v} morts`}
  />
);

// ---------------------------------------------------------------------------
// Composant charts par vague
// ---------------------------------------------------------------------------

const VagueCharts = memo(function VagueCharts({ vague }: { vague: VagueAvecReleves }) {
  const t = useTranslations("ingenieur.emptyStates");
  const croissanceData = buildCroissanceData(vague);
  const mortaliteData = buildMortaliteData(vague);
  const survieData = buildSurvieData(vague);

  const hasCroissance = croissanceData.length > 1;
  const hasMortalite = mortaliteData.length > 0;
  const hasSurvie = survieData.length > 1;

  if (!hasCroissance && !hasMortalite && !hasSurvie) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-center p-4">
          <p className="text-sm text-muted-foreground">
            {t("noBiometrieData")}{" "}
            <span className="font-medium">{vague.code}</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Croissance */}
      {hasCroissance && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {vague.code} — Croissance (poids moyen)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="h-[200px] w-full max-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={croissanceData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}g`}
                    width={44}
                  />
                  <Tooltip content={tooltipCroissance} cursor={<ChartCrosshair />} />
                  <Line
                    type="monotone"
                    dataKey="poidsMoyen"
                    name="Poids moyen"
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
      )}

      {/* Survie */}
      {hasSurvie && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {vague.code} — Taux de survie (%)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="h-[200px] w-full max-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={survieData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                    width={40}
                  />
                  <Tooltip content={tooltipSurvie} cursor={<ChartCrosshair />} />
                  <Line
                    type="monotone"
                    dataKey="survie"
                    name="Survie"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mortalite */}
      {hasMortalite && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {vague.code} — Mortalites par evenement
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="h-[200px] w-full max-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mortaliteData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={36}
                  />
                  <Tooltip content={tooltipMortalite} cursor={<ChartCrosshair />} />
                  <Bar
                    dataKey="nombreMorts"
                    name="Morts"
                    fill="var(--danger)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function IngenieurClientCharts({ vagues }: IngenieurClientChartsProps) {
  return (
    <div className="flex flex-col gap-6">
      {vagues.map((vague) => (
        <VagueCharts key={vague.id} vague={vague} />
      ))}
    </div>
  );
}
