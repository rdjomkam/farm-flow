"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BenchmarkBadge } from "./benchmark-badge";
import {
  evaluerBenchmark,
  BENCHMARK_SURVIE,
  BENCHMARK_FCR,
  BENCHMARK_SGR,
  BENCHMARK_MORTALITE,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";
import type { IndicateursBac, AlerteBac } from "@/types";

interface BacComparisonCardsProps {
  bacs: IndicateursBac[];
  alertes: AlerteBac[];
  meilleurFCR: string | null;
  meilleurSurvie: string | null;
}

function MetricRow({
  label,
  value,
  unit,
  level,
}: {
  label: string;
  value: string;
  unit?: string;
  level: ReturnType<typeof evaluerBenchmark>;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold">
          {value}
          {unit && <span className="text-xs font-normal text-muted-foreground"> {unit}</span>}
        </span>
        <BenchmarkBadge level={level} />
      </div>
    </div>
  );
}

export function BacComparisonCards({
  bacs,
  alertes,
  meilleurFCR,
  meilleurSurvie,
}: BacComparisonCardsProps) {
  if (bacs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun bac assigne a cette vague.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Alertes */}
      {alertes.length > 0 && (
        <Card className="border-accent-red/30 bg-accent-red-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-accent-red" />
              <span className="text-sm font-semibold text-accent-red">
                {alertes.length} alerte{alertes.length > 1 ? "s" : ""}
              </span>
            </div>
            <ul className="space-y-1">
              {alertes.map((a, i) => (
                <li key={i} className="text-xs text-accent-red">
                  {a.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Bac cards */}
      {bacs.map((bac) => {
        const isBestFCR = bac.bacId === meilleurFCR;
        const isBestSurvie = bac.bacId === meilleurSurvie;

        return (
          <Card key={bac.bacId}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{bac.bacNom}</h3>
                  {isBestSurvie && (
                    <span className="shrink-0 rounded-full bg-accent-green-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-green">
                      Meilleure survie
                    </span>
                  )}
                  {isBestFCR && (
                    <span className="shrink-0 rounded-full bg-accent-blue-muted px-1.5 py-0.5 text-[10px] font-medium text-accent-blue">
                      Meilleur FCR
                    </span>
                  )}
                </div>
                <Link
                  href={`/analytics/bacs/${bac.bacId}?vagueId=${bac.vagueId}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  Detail
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-1.5">
                <MetricRow
                  label="Survie"
                  value={bac.tauxSurvie !== null ? `${bac.tauxSurvie}` : "—"}
                  unit="%"
                  level={evaluerBenchmark(bac.tauxSurvie, BENCHMARK_SURVIE)}
                />
                <MetricRow
                  label="FCR"
                  value={bac.fcr !== null ? `${bac.fcr}` : "—"}
                  level={evaluerBenchmark(bac.fcr, BENCHMARK_FCR)}
                />
                <MetricRow
                  label="SGR"
                  value={bac.sgr !== null ? `${bac.sgr}` : "—"}
                  unit="%/j"
                  level={evaluerBenchmark(bac.sgr, BENCHMARK_SGR)}
                />
                <MetricRow
                  label="Biomasse"
                  value={bac.biomasse !== null ? `${bac.biomasse}` : "—"}
                  unit="kg"
                  level={null}
                />
                <MetricRow
                  label="Mortalite"
                  value={bac.tauxMortalite !== null ? `${bac.tauxMortalite}` : "—"}
                  unit="%"
                  level={evaluerBenchmark(bac.tauxMortalite, BENCHMARK_MORTALITE)}
                />
                <MetricRow
                  label="Densite"
                  value={bac.densite !== null ? `${bac.densite}` : "—"}
                  unit="kg/m³"
                  level={evaluerBenchmark(bac.densite, BENCHMARK_DENSITE)}
                />
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{bac.volume}L</span>
                <span>{bac.nombreReleves} releve{bac.nombreReleves > 1 ? "s" : ""}</span>
                {bac.poidsMoyen !== null && <span>{bac.poidsMoyen}g moy.</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
