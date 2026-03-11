"use client";

import { useState } from "react";
import { ArrowRightLeft, Calculator, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalytiqueAliment, SimulationResult } from "@/types";

interface FeedSimulatorProps {
  aliments: AnalytiqueAliment[];
}

export function FeedSimulator({ aliments }: FeedSimulatorProps) {
  const [ancienId, setAncienId] = useState("");
  const [nouveauId, setNouveauId] = useState("");
  const [production, setProduction] = useState("1000");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    if (!ancienId || !nouveauId || !production) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analytics/aliments/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ancienProduitId: ancienId,
          nouveauProduitId: nouveauId,
          productionCible: parseFloat(production),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Erreur lors de la simulation.");
        return;
      }

      const data: SimulationResult = await res.json();
      setResult(data);
    } catch {
      setError("Erreur reseau. Verifiez votre connexion.");
    } finally {
      setLoading(false);
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
            <p className="text-sm font-semibold">Simulateur de changement d'aliment</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Aliment actuel</label>
            <select
              value={ancienId}
              onChange={(e) => setAncienId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Selectionner...</option>
              {aliments.map((a) => (
                <option key={a.produitId} value={a.produitId}>
                  {a.produitNom}
                  {a.fournisseurNom ? ` (${a.fournisseurNom})` : ""}
                  {a.fcrMoyen !== null ? ` — FCR ${a.fcrMoyen}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nouvel aliment</label>
            <select
              value={nouveauId}
              onChange={(e) => setNouveauId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Selectionner...</option>
              {aliments
                .filter((a) => a.produitId !== ancienId)
                .map((a) => (
                  <option key={a.produitId} value={a.produitId}>
                    {a.produitNom}
                    {a.fournisseurNom ? ` (${a.fournisseurNom})` : ""}
                    {a.fcrMoyen !== null ? ` — FCR ${a.fcrMoyen}` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Production cible (kg de biomasse)
            </label>
            <input
              type="number"
              min="1"
              step="100"
              value={production}
              onChange={(e) => setProduction(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
              placeholder="1000"
            />
          </div>

          <Button
            onClick={handleSimulate}
            disabled={!canSimulate || loading}
            className="w-full"
          >
            {loading ? "Calcul en cours..." : "Simuler le changement"}
          </Button>

          {error && <p className="text-sm text-accent-red">{error}</p>}
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
              ? "Economie possible"
              : isSurcout
                ? "Surcout estime"
                : "Resultat"}
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
            {Math.abs(result.economie).toLocaleString("fr-FR")} CFA
          </p>
        )}

        <p className="text-sm text-foreground leading-relaxed">{result.message}</p>

        {/* Comparison details */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{result.ancienProduitNom}</p>
            <p className="text-sm">FCR : {result.ancienFCR ?? "—"}</p>
            <p className="text-sm">
              Cout : {result.ancienCout !== null ? `${result.ancienCout.toLocaleString("fr-FR")} CFA` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{result.nouveauProduitNom}</p>
            <p className="text-sm">FCR : {result.nouveauFCR ?? "—"}</p>
            <p className="text-sm">
              Cout : {result.nouveauCout !== null ? `${result.nouveauCout.toLocaleString("fr-FR")} CFA` : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
