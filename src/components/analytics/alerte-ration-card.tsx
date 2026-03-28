"use client";

import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlerteRation } from "@/types";

interface AlerteRationCardProps {
  alertes: AlerteRation[];
}

/**
 * FD.1 — Affiche les alertes sous/sur-alimentation pour les vagues actives.
 *
 * Pour chaque alerte :
 * - Icone TrendingDown (sous-alimentation) ou TrendingUp (sur-alimentation)
 * - Nom de la vague + ecart moyen + nombre de releves consecutifs
 * - Lien vers la page releves de la vague
 *
 * Affiche "Aucune alerte" si le tableau est vide.
 */
export function AlerteRationCard({ alertes }: AlerteRationCardProps) {
  const tAnalytics = useTranslations("analytics");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tAnalytics("alertesRation.titre")}</CardTitle>
      </CardHeader>
      <CardContent>
        {alertes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tAnalytics("alertesRation.aucune")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {alertes.map((alerte) => {
              const isSous = alerte.type === "SOUS_ALIMENTATION";
              const borderClass = isSous
                ? "border-amber-400/40 bg-amber-50"
                : "border-destructive/40 bg-destructive/10";
              const iconClass = isSous ? "text-amber-600" : "text-destructive";
              const badgeClass = isSous
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700";
              const label = isSous
                ? tAnalytics("alertesRation.sousAlimentation")
                : tAnalytics("alertesRation.surAlimentation");

              return (
                <Link
                  key={alerte.vagueId}
                  href={`/vagues/${alerte.vagueId}/releves`}
                  className={`flex flex-col gap-1.5 rounded-md border p-3 transition-colors hover:opacity-80 sm:flex-row sm:items-start sm:justify-between ${borderClass}`}
                >
                  {/* Left — icone + infos */}
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 shrink-0 ${iconClass}`}>
                      {isSous ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{alerte.vagueNom}</span>
                      <span className="text-xs text-muted-foreground">
                        {tAnalytics("alertesRation.ecart", {
                          pct: Math.abs(alerte.ecartMoyenPct).toFixed(1),
                          nb: alerte.relevesConsecutifs,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Right — badge type */}
                  <span
                    className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold sm:self-auto ${badgeClass}`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
