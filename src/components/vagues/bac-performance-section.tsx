"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, TrendingUp, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatNum } from "@/lib/format";
import type { BacPerformanceData } from "@/lib/bac-performance";

interface BacPerformanceSectionProps {
  data: BacPerformanceData[];
  vagueId: string;
}

// ── Sparkline inline SVG ──────────────────────────────────────────────────────

function Sparkline({
  data,
  rank,
  totalBacs,
  fullWidth,
}: {
  data: { jour: number; poidsMoyen: number }[];
  rank: number;
  totalBacs: number;
  fullWidth?: boolean;
}) {
  if (data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center ${fullWidth ? "h-9 w-full" : "h-7 w-16"} rounded bg-muted/40`}
      >
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  const strokeColor =
    rank === 1
      ? "var(--accent-green)"
      : rank <= Math.ceil(totalBacs / 2)
        ? "var(--accent-blue)"
        : "var(--accent-amber)";

  const W = fullWidth ? 200 : 64;
  const H = fullWidth ? 36 : 28;
  const minP = Math.min(...data.map((d) => d.poidsMoyen));
  const maxP = Math.max(...data.map((d) => d.poidsMoyen));
  const rangeP = maxP - minP || 1;
  const minJ = Math.min(...data.map((d) => d.jour));
  const maxJ = Math.max(...data.map((d) => d.jour));
  const rangeJ = maxJ - minJ || 1;
  const pad = 2;

  const points = data
    .map((d) => {
      const x = pad + ((d.jour - minJ) / rangeJ) * (W - pad * 2);
      const y = H - pad - ((d.poidsMoyen - minP) / rangeP) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={fullWidth ? "100%" : 64}
      height={H}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function rankBadgeClass(rank: number, total: number): string {
  if (rank === 1) return "bg-accent-green-muted text-accent-green";
  if (rank === total) return "bg-accent-red-muted text-accent-red";
  if (rank <= Math.ceil(total / 2)) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-amber-muted text-accent-amber";
}

function gmqBadgeClass(gmq: number | null): string {
  if (gmq === null) return "bg-muted text-muted-foreground";
  if (gmq > 4) return "bg-accent-green-muted text-accent-green";
  if (gmq >= 2) return "bg-muted text-muted-foreground";
  return "bg-accent-red-muted text-accent-red";
}

function fcrTextClass(fcr: number | null): string {
  if (fcr === null) return "text-muted-foreground";
  if (fcr > 2.0) return "text-accent-red";
  return "text-accent-amber";
}

function benchmarkLabel(fcr: number | null, t: ReturnType<typeof useTranslations>): string {
  if (fcr === null) return "—";
  if (fcr < 1.5) return t("bacPerf.benchmarkExcellent");
  if (fcr <= 2.0) return t("bacPerf.benchmarkBon");
  return t("bacPerf.benchmarkMauvais");
}

function benchmarkClass(fcr: number | null): string {
  if (fcr === null) return "bg-muted text-muted-foreground";
  if (fcr < 1.5) return "bg-accent-green-muted text-accent-green";
  if (fcr <= 2.0) return "bg-muted text-muted-foreground";
  return "bg-accent-red-muted text-accent-red";
}

// ── Last biometry date helper ─────────────────────────────────────────────────

function LastBioDate({
  date,
  t,
}: {
  date: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!date) return null;
  const jours = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  const label =
    jours === 0
      ? t("bacPerf.dernieresBioAujourdhui")
      : t("bacPerf.dernieresBio", { jours });
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

// ── Growth tab card ───────────────────────────────────────────────────────────

function GrowthCard({
  item,
  total,
  t,
}: {
  item: BacPerformanceData;
  total: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Link href={`/bacs/${item.bacId}`} className="block">
      <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
        <CardContent className="p-3 flex flex-col gap-2">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="font-medium truncate text-sm">{item.bacNom}</p>
            <span
              className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${rankBadgeClass(item.rank, total)}`}
            >
              {item.rankLabel}
            </span>
          </div>

          {/* Desktop: sparkline full-width above metrics */}
          {item.sparklineData.length >= 2 && (
            <div className="hidden md:block w-full">
              <Sparkline data={item.sparklineData} rank={item.rank} totalBacs={total} fullWidth />
            </div>
          )}

          {/* Mobile: sparkline left, metrics right */}
          <div className="flex gap-3 items-start">
            {/* Sparkline (mobile only) */}
            <div className="md:hidden shrink-0">
              <Sparkline data={item.sparklineData} rank={item.rank} totalBacs={total} />
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 flex-1 min-w-0">
              {/* Poids moyen */}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.poidsMoyen")}</p>
                <p className="text-sm font-medium leading-tight truncate">
                  {formatNum(item.poidsMoyenActuel, 0)} g
                </p>
              </div>
              {/* Biomasse */}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.biomasse")}</p>
                <p className="text-sm font-medium leading-tight truncate">
                  {formatNum(item.biomasse, 1)} kg
                </p>
              </div>
              {/* FCR */}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.fcr")}</p>
                <p className={`text-sm font-medium leading-tight truncate ${fcrTextClass(item.fcr)}`}>
                  {formatNum(item.fcr, 2)}
                </p>
              </div>
              {/* Survie */}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.survie")}</p>
                <p className="text-sm font-medium leading-tight truncate">
                  {formatNum(item.tauxSurvie, 1)}%
                </p>
              </div>
              {/* Vivants */}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.vivants")}</p>
                <p className="text-sm font-medium leading-tight truncate">
                  {item.nombreVivants}
                </p>
              </div>
              {/* Aliment */}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.aliment")}</p>
                <p className="text-sm font-medium leading-tight truncate">
                  {formatNum(item.totalAlimentKg, 1)} kg
                </p>
              </div>
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <LastBioDate date={item.derniereBiometrieDate} t={t} />
            {item.gmq !== null && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gmqBadgeClass(item.gmq)}`}
              >
                {item.gmq > 0 ? "+" : ""}{formatNum(item.gmq, 1)} {t("bacPerf.gmqUnit")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Cost tab card ─────────────────────────────────────────────────────────────

function CostCard({
  item,
  total,
  t,
}: {
  item: BacPerformanceData;
  total: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Link href={`/bacs/${item.bacId}`} className="block">
      <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
        <CardContent className="p-3 flex flex-col gap-2">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="font-medium truncate text-sm">{item.bacNom}</p>
            <span
              className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${rankBadgeClass(item.rank, total)}`}
            >
              {item.rankLabel}
            </span>
          </div>

          {/* Metrics grid 2x2 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {/* Cout/kg */}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.coutParKg")}</p>
              <p className="text-sm font-medium leading-tight">
                {item.coutParKgProduit != null
                  ? `${Math.round(item.coutParKgProduit).toLocaleString("fr-FR")} FCFA`
                  : "—"}
              </p>
            </div>
            {/* Cout aliment total */}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.coutAlimentTotal")}</p>
              <p className="text-sm font-medium leading-tight">
                {Math.round(item.coutAliment).toLocaleString("fr-FR")} FCFA
              </p>
            </div>
            {/* Aliment consomme */}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.alimentConsomme")}</p>
              <p className="text-sm font-medium leading-tight">
                {formatNum(item.totalAlimentKg, 1)} kg
              </p>
            </div>
            {/* Gain biomasse */}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-tight truncate">{t("bacPerf.gainBiomasse")}</p>
              <p className="text-sm font-medium leading-tight">
                {formatNum(item.gainBiomasseKg, 1)} kg
              </p>
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs text-muted-foreground">
              {t("bacPerf.fcr")}: <span className={fcrTextClass(item.fcr)}>{formatNum(item.fcr, 2)}</span>
              {" · "}
              {t("bacPerf.biomasse")}: {formatNum(item.biomasse, 1)} kg
            </span>
            <span
              className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${benchmarkClass(item.fcr)}`}
            >
              {benchmarkLabel(item.fcr, t)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BacPerformanceSection({ data, vagueId: _vagueId }: BacPerformanceSectionProps) {
  const t = useTranslations("vagues");
  const [activeTab, setActiveTab] = useState<"croissance" | "couts">("croissance");

  if (data.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("bacPerf.title")}</h2>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium text-sm">{t("bacPerf.emptyTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {t("bacPerf.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      {/* Section header with tabs */}
      <div className="flex items-center gap-3 mb-3">
        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-base font-semibold">{t("bacPerf.title")}</h2>
        <div className="ml-auto flex items-center bg-muted rounded-md p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("croissance")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "croissance"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {t("bacPerf.tabCroissance")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("couts")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "couts"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1">
              <Scale className="h-3 w-3" />
              {t("bacPerf.tabCouts")}
            </span>
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeTab === "croissance"
          ? data.map((item) => (
              <GrowthCard key={item.bacId} item={item} total={data.length} t={t} />
            ))
          : data.map((item) => (
              <CostCard key={item.bacId} item={item} total={data.length} t={t} />
            ))}
      </div>
    </section>
  );
}
