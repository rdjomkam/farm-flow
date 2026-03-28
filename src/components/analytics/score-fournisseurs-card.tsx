"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScoreFournisseur {
  fournisseurId: string;
  fournisseurNom: string;
  nombreProduits: number;
  scoreMoyen: number | null;
  fcrMoyen: number | null;
}

interface ScoreFournisseursCardProps {
  fournisseurs: ScoreFournisseur[];
}

/**
 * FD.2 — Badge de score colore /10.
 */
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
      {score.toFixed(1)}
      {tAnalytics("score.sur10")} {label}
    </span>
  );
}

/**
 * FD.2 — Section "Performance par fournisseur".
 *
 * Affiche une carte par fournisseur avec :
 * - Nom du fournisseur
 * - Nombre de produits ALIMENT utilises
 * - Score moyen (ScoreBadge colore)
 * - FCR moyen
 *
 * Mobile-first : cartes empilees.
 */
export function ScoreFournisseursCard({ fournisseurs }: ScoreFournisseursCardProps) {
  const tAnalytics = useTranslations("analytics");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tAnalytics("fournisseurs.titre")}</CardTitle>
      </CardHeader>
      <CardContent>
        {fournisseurs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tAnalytics("fournisseurs.aucun")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {fournisseurs.map((f) => (
              <div
                key={f.fournisseurId}
                className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Nom + nombre produits */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{f.fournisseurNom}</span>
                  <span className="text-xs text-muted-foreground">
                    {tAnalytics("fournisseurs.nombreProduits", { count: f.nombreProduits })}
                  </span>
                </div>

                {/* Metriques */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Score moyen */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {tAnalytics("fournisseurs.scoreMoyen")}
                    </span>
                    {f.scoreMoyen !== null ? (
                      <ScoreBadge score={f.scoreMoyen} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {tAnalytics("fournisseurs.nonDisponible")}
                      </span>
                    )}
                  </div>

                  {/* FCR moyen */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {tAnalytics("fournisseurs.fcrMoyen")}
                    </span>
                    <span className="text-sm font-semibold">
                      {f.fcrMoyen !== null
                        ? f.fcrMoyen.toFixed(2)
                        : tAnalytics("fournisseurs.nonDisponible")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
