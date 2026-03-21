"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { BenchmarkBadge } from "./benchmark-badge";
import { evaluerBenchmark, BENCHMARK_FCR } from "@/lib/benchmarks";
import { cn } from "@/lib/utils";
import type { AnalytiqueAliment } from "@/types";

interface FeedComparisonCardsProps {
  aliments: AnalytiqueAliment[];
  meilleurFCR: string | null;
  meilleurCoutKg: string | null;
  meilleurSGR: string | null;
}

function rankColor(index: number): string {
  if (index === 0) return "bg-accent-green-muted text-accent-green border-accent-green/30";
  if (index === 1) return "bg-accent-amber-muted text-accent-amber border-accent-amber/30";
  if (index === 2) return "bg-accent-orange-muted text-accent-orange border-accent-orange/30";
  return "bg-muted text-muted-foreground border-border";
}

function MetricItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold">
        {value}
        {unit && <span className="text-xs font-normal text-muted-foreground"> {unit}</span>}
      </span>
    </div>
  );
}

export function FeedComparisonCards({
  aliments,
  meilleurFCR,
  meilleurCoutKg,
  meilleurSGR,
}: FeedComparisonCardsProps) {
  const tAnalytics = useTranslations("analytics");
  const tVagues = useTranslations("vagues");

  if (aliments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tVagues("comparison.noVagues")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {aliments.map((aliment, index) => {
        const isBestCout = aliment.produitId === meilleurCoutKg;
        const isBestFCR = aliment.produitId === meilleurFCR;
        const isBestSGR = aliment.produitId === meilleurSGR;

        return (
          <Card key={aliment.produitId} className={cn(isBestCout && "border-accent-green/30")}>
            <CardContent className="p-3">
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border",
                      rankColor(index)
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{aliment.produitNom}</h3>
                    {aliment.fournisseurNom && (
                      <p className="text-xs text-muted-foreground truncate">
                        {aliment.fournisseurNom}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/analytics/aliments/${aliment.produitId}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  {tAnalytics("bacs.detail")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1 mb-2">
                {isBestCout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-green-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-green">
                    <Trophy className="h-2.5 w-2.5" />
                    {tVagues("comparison.metrics.coutAliment")}
                  </span>
                )}
                {isBestFCR && (
                  <span className="rounded-full bg-accent-blue-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-blue">
                    {tAnalytics("benchmarks.fcr.label")}
                  </span>
                )}
                {isBestSGR && (
                  <span className="rounded-full bg-accent-purple-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-purple">
                    {tAnalytics("benchmarks.sgr.label")}
                  </span>
                )}
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-2">
                <MetricItem
                  label={tAnalytics("benchmarks.fcr.label")}
                  value={aliment.fcrMoyen !== null ? `${aliment.fcrMoyen}` : "—"}
                />
                <MetricItem
                  label={tVagues("comparison.metrics.coutAliment")}
                  value={aliment.coutParKgGain !== null ? `${aliment.coutParKgGain.toLocaleString("fr-FR")}` : "—"}
                  unit="CFA"
                />
                <MetricItem
                  label={tAnalytics("benchmarks.sgr.label")}
                  value={aliment.sgrMoyen !== null ? `${aliment.sgrMoyen}` : "—"}
                  unit={tAnalytics("labels.sgrUnit")}
                />
              </div>

              {/* Footer metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{aliment.prixUnitaire.toLocaleString("fr-FR")} CFA/kg</span>
                <span>{aliment.quantiteTotale} {tAnalytics("aliments.kgUtilises")}</span>
                <span>{aliment.nombreVagues > 1 ? tVagues("list.countPlural", { count: aliment.nombreVagues }) : tVagues("list.count", { count: aliment.nombreVagues })}</span>
                {aliment.tauxSurvieAssocie !== null && (
                  <span>{tVagues("comparison.metrics.survie")} : {aliment.tauxSurvieAssocie}%</span>
                )}
              </div>

              {/* FCR benchmark badge */}
              {aliment.fcrMoyen !== null && (
                <div className="mt-1.5">
                  <BenchmarkBadge level={evaluerBenchmark(aliment.fcrMoyen, BENCHMARK_FCR)} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
