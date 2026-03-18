"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BenchmarkBadge } from "./benchmark-badge";
import {
  evaluerBenchmark,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";
import type { IndicateursBac, AlerteBac } from "@/types";

interface BacComparisonCardsProps {
  bacs: IndicateursBac[];
  alertes: AlerteBac[];
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
}: BacComparisonCardsProps) {
  if (bacs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun bac assigné à cette vague.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Info banner — performance metrics are at vague level */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            FCR, SGR et survie sont suivis au niveau de la vague.{" "}
            <Link href="/analytics/vagues" className="text-primary hover:underline font-medium">
              Voir les analytiques par vague
            </Link>
          </p>
        </CardContent>
      </Card>

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
      {bacs.map((bac) => (
        <Card key={bac.bacId}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold truncate">{bac.bacNom}</h3>
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
                label="Biomasse"
                value={bac.biomasse !== null ? `${bac.biomasse}` : "—"}
                unit="kg"
                level={null}
              />
              <MetricRow
                label="Densite"
                value={bac.densite !== null ? `${bac.densite}` : "—"}
                unit="kg/m³"
                level={evaluerBenchmark(bac.densite, BENCHMARK_DENSITE)}
              />
              <MetricRow
                label="Poids moyen"
                value={bac.poidsMoyen !== null ? `${bac.poidsMoyen}` : "—"}
                unit="g"
                level={null}
              />
              <MetricRow
                label="Vivants"
                value={bac.nombreVivants !== null ? `${bac.nombreVivants}` : "—"}
                level={null}
              />
              <MetricRow
                label="Aliment"
                value={`${bac.totalAliment}`}
                unit="kg"
                level={null}
              />
              <MetricRow
                label="Morts"
                value={`${bac.totalMortalites}`}
                level={null}
              />
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{bac.volume !== null ? `${bac.volume}L` : "—"}</span>
              <span>{bac.nombreReleves} relevé{bac.nombreReleves > 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
