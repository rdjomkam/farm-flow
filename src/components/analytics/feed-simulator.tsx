"use client";

import { useState } from "react";
import { ArrowRightLeft, Calculator, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalytiqueAliment, SimulationResult } from "@/types";
import { useAnalyticsService } from "@/services";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";

interface FeedSimulatorProps {
  aliments: AnalytiqueAliment[];
}

export function FeedSimulator({ aliments }: FeedSimulatorProps) {
  const analyticsService = useAnalyticsService();
  const tAnalytics = useTranslations("analytics");
  const [ancienId, setAncienId] = useState("");
  const [nouveauId, setNouveauId] = useState("");
  const [production, setProduction] = useState("1000");
  const [result, setResult] = useState<SimulationResult | null>(null);

  async function handleSimulate() {
    if (!ancienId || !nouveauId || !production) return;

    setResult(null);

    const res = await analyticsService.simulerChangementAliment({
      ancienProduitId: ancienId,
      nouveauProduitId: nouveauId,
      productionCible: parseFloat(production),
    });

    if (res.ok && res.data) {
      setResult(res.data as unknown as SimulationResult);
    }
  }

  const canSimulate = ancienId && nouveauId && ancienId !== nouveauId && parseFloat(production) > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Form */}
      <Card>
        <CardContent className="p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{tAnalytics("simulation.title")}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{tAnalytics("simulation.oldFeed")}</label>
            <select
              value={ancienId}
              onChange={(e) => setAncienId(e.target.value)}
              className="w-full rounded-lg bg-background px-3 py-2.5 text-sm"
            >
              <option value="">{tAnalytics("simulation.selectFeed")}</option>
              {aliments.map((a) => (
                <option key={a.produitId} value={a.produitId}>
                  {a.produitNom}
                  {a.fournisseurNom ? ` (${a.fournisseurNom})` : ""}
                  {a.fcrMoyen !== null ? ` — ${tAnalytics("simulation.fcrLabel")} ${a.fcrMoyen}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{tAnalytics("simulation.newFeed")}</label>
            <select
              value={nouveauId}
              onChange={(e) => setNouveauId(e.target.value)}
              className="w-full rounded-lg bg-background px-3 py-2.5 text-sm"
            >
              <option value="">{tAnalytics("simulation.selectFeed")}</option>
              {aliments
                .filter((a) => a.produitId !== ancienId)
                .map((a) => (
                  <option key={a.produitId} value={a.produitId}>
                    {a.produitNom}
                    {a.fournisseurNom ? ` (${a.fournisseurNom})` : ""}
                    {a.fcrMoyen !== null ? ` — ${tAnalytics("simulation.fcrLabel")} ${a.fcrMoyen}` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {tAnalytics("simulation.targetProduction")}
            </label>
            <input
              type="number"
              min="1"
              step="100"
              value={production}
              onChange={(e) => setProduction(e.target.value)}
              className="w-full rounded-lg bg-background px-3 py-2.5 text-sm"
              placeholder="1000"
            />
          </div>

          <Button
            onClick={handleSimulate}
            disabled={!canSimulate}
            className="w-full"
          >
            {tAnalytics("simulation.simulate")}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && <SimulationResultCard result={result} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulation result display
// ---------------------------------------------------------------------------

function SimulationResultCard({ result }: { result: SimulationResult }) {
  const tAnalytics = useTranslations("analytics");
  const isEconomie = result.economie !== null && result.economie > 0;
  const isSurcout = result.economie !== null && result.economie < 0;

  return (
    <Card
      className={cn(
        isEconomie && "border-accent-green/30 bg-accent-green-muted/50",
        isSurcout && "border-accent-red/30 bg-accent-red-muted/50"
      )}
    >
      <CardContent className="p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {isEconomie ? (
            <TrendingDown className="h-5 w-5 text-accent-green" />
          ) : isSurcout ? (
            <TrendingUp className="h-5 w-5 text-accent-red" />
          ) : (
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-sm font-semibold">
            {isEconomie
              ? tAnalytics("simulation.saving")
              : isSurcout
                ? tAnalytics("simulation.extra_cost")
                : tAnalytics("simulation.result")}
          </p>
        </div>

        {result.economie !== null && (
          <p
            className={cn(
              "text-2xl font-bold",
              isEconomie && "text-accent-green",
              isSurcout && "text-accent-red"
            )}
          >
            {isEconomie ? "-" : "+"}
            {formatNumber(Math.abs(result.economie))} CFA
          </p>
        )}

        <p className="text-sm text-foreground leading-relaxed">{result.message}</p>

        {/* Comparison details */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{result.ancienProduitNom}</p>
            <p className="text-sm">{tAnalytics("simulation.fcrLabel")} : {result.ancienFCR ?? "—"}</p>
            <p className="text-sm">
              {tAnalytics("simulation.cost")} : {result.ancienCout !== null ? `${formatNumber(result.ancienCout)} CFA` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{result.nouveauProduitNom}</p>
            <p className="text-sm">{tAnalytics("simulation.fcrLabel")} : {result.nouveauFCR ?? "—"}</p>
            <p className="text-sm">
              {tAnalytics("simulation.cost")} : {result.nouveauCout !== null ? `${formatNumber(result.nouveauCout)} CFA` : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
