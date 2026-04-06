"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { BenchmarkBadge } from "./benchmark-badge";
import { FCRTransparencyDialog } from "./fcr-transparency-dialog";
import { evaluerBenchmark, BENCHMARK_FCR } from "@/lib/benchmarks";
import { cn } from "@/lib/utils";
import type { AnalytiqueAliment } from "@/types";
import { formatNumber } from "@/lib/format";

// FC.3 — Score badge
function ScoreBadge({ score }: { score: number }) {
  const tAnalytics = useTranslations("analytics");
  let colorClass: string;
  let label: string;
  if (score >= 7) {
    colorClass = "bg-green-100 text-green-700";
    label = tAnalytics("score.excellent");
  } else if (score >= 5) {
    colorClass = "bg-amber-100 text-amber-700";
    label = tAnalytics("score.bon");
  } else {
    colorClass = "bg-red-100 text-red-700";
    label = tAnalytics("score.insuffisant");
  }
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", colorClass)}>
      {score.toFixed(1)}{tAnalytics("score.sur10")} {label}
    </span>
  );
}

interface FeedComparisonCardsProps {
  aliments: AnalytiqueAliment[];
  meilleurFCR: string | null;
  meilleurCoutKg: string | null;
  meilleurSGR: string | null;
  meilleurK?: string | null;
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

// Helper: badge color and label for Gompertz K level
function kNiveauBadge(niveau: string, label: string) {
  const colorClass =
    niveau === "EXCELLENT"
      ? "bg-emerald-100 text-emerald-700"
      : niveau === "BON"
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", colorClass)}>
      {label}
    </span>
  );
}

export function FeedComparisonCards({
  aliments,
  meilleurFCR,
  meilleurCoutKg,
  meilleurSGR,
  meilleurK,
}: FeedComparisonCardsProps) {
  const tAnalytics = useTranslations("analytics");
  const tVagues = useTranslations("vagues");


  if (aliments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tAnalytics("aliments.noAliments")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {aliments.map((aliment, index) => {
        const isBestCout = aliment.produitId === meilleurCoutKg;
        const isBestFCR = aliment.produitId === meilleurFCR;
        const isBestSGR = aliment.produitId === meilleurSGR;
        const isBestK = meilleurK != null && aliment.produitId === meilleurK;
        const hasGompertzK =
          aliment.kMoyenGompertz != null && aliment.kNiveauGompertz != null;

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
                  {tAnalytics("aliments.detail")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1 mb-2">
                {isBestCout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-green-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-green">
                    <Trophy className="h-2.5 w-2.5" />
                    {tAnalytics("aliments.meilleurCoutKg")}
                  </span>
                )}
                {isBestFCR && (
                  <span className="rounded-full bg-accent-blue-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-blue">
                    {tAnalytics("aliments.meilleurFCR")}
                  </span>
                )}
                {isBestSGR && (
                  <span className="rounded-full bg-accent-purple-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-purple">
                    {tAnalytics("aliments.meilleurSGR")}
                  </span>
                )}
                {/* FC.3 — Taille granule badge */}
                {aliment.tailleGranule !== null && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {tAnalytics(`tailleGranule.${aliment.tailleGranule}`)}
                  </span>
                )}
                {/* FC.3 — Forme aliment badge */}
                {aliment.formeAliment !== null && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {tAnalytics(`formeAliment.${aliment.formeAliment}`)}
                  </span>
                )}
                {/* FC.3 — Score qualite badge */}
                {aliment.scoreQualite !== null && (
                  <ScoreBadge score={aliment.scoreQualite} />
                )}
                {/* G3.3 — Meilleur K Gompertz badge */}
                {isBestK && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    <Trophy className="h-2.5 w-2.5" />
                    {tAnalytics("gompertz.meilleurK")}
                  </span>
                )}
              </div>

              {/* Metrics grid */}
              <div className={cn("grid gap-2", hasGompertzK ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
                <MetricItem
                  label={tAnalytics("benchmarks.fcr.label")}
                  value={aliment.fcrMoyen !== null ? `${aliment.fcrMoyen}` : "—"}
                />
                <MetricItem
                  label={tAnalytics("aliments.coutKgLabel")}
                  value={aliment.coutParKgGain !== null ? formatNumber(aliment.coutParKgGain) : "—"}
                  unit="CFA"
                />
                <MetricItem
                  label={tAnalytics("benchmarks.sgr.label")}
                  value={aliment.sgrMoyen !== null ? `${aliment.sgrMoyen}` : "—"}
                  unit={tAnalytics("labels.sgrUnit")}
                />
                {/* G3.3 — Vitesse Gompertz metric */}
                {hasGompertzK && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {tAnalytics("gompertz.vitesseLabel")}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {kNiveauBadge(
                        aliment.kNiveauGompertz!,
                        tAnalytics(`gompertz.${aliment.kNiveauGompertz}`)
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      K={aliment.kMoyenGompertz!.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{formatNumber(aliment.prixUnitaire)} CFA/kg</span>
                <span>{aliment.quantiteTotale} {tAnalytics("aliments.kgUtilises")}</span>
                <span>{aliment.nombreVagues > 1 ? tVagues("list.countPlural", { count: aliment.nombreVagues }) : tVagues("list.count", { count: aliment.nombreVagues })}</span>
                {aliment.tauxSurvieAssocie !== null && (
                  <span>{tVagues("comparison.metrics.survie")} : {aliment.tauxSurvieAssocie}%</span>
                )}
              </div>

              {/* FCR benchmark badge + transparency trigger */}
              {aliment.fcrMoyen !== null && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <BenchmarkBadge level={evaluerBenchmark(aliment.fcrMoyen, BENCHMARK_FCR)} />
                  <FCRTransparencyDialog
                    produitId={aliment.produitId}
                    produitNom={aliment.produitNom}
                    fcrMoyen={aliment.fcrMoyen}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
