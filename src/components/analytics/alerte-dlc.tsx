"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MouvementExpirable, MouvementExpirableSoon } from "@/lib/queries/analytics";

interface AlerteDLCProps {
  expires: MouvementExpirable[];
  expiringSoon: MouvementExpirableSoon[];
}

/**
 * FC.9 — Composant d'alerte DLC pour les lots de stock aliment.
 *
 * Affiche :
 *   - Lots expirés (badge rouge)
 *   - Lots expirant dans les 30 jours (badge amber)
 *   - Message si aucun lot concerné
 */
export function AlerteDLC({ expires, expiringSoon }: AlerteDLCProps) {
  const tAnalytics = useTranslations("analytics");

  const aucunAlerte = expires.length === 0 && expiringSoon.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tAnalytics("dlc.titre")}</CardTitle>
      </CardHeader>
      <CardContent>
        {aucunAlerte ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tAnalytics("dlc.aucune")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {expires.map((m, i) => (
              <div
                key={`exp-${i}`}
                className="flex flex-col gap-0.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{m.produitNom}</span>
                  {m.lotFabrication && (
                    <span className="text-xs text-muted-foreground">
                      Lot : {m.lotFabrication}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {m.quantite} kg
                  </span>
                </div>
                <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                  {tAnalytics("dlc.expire")} — {new Date(m.datePeremption).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}

            {expiringSoon.map((m, i) => (
              <div
                key={`soon-${i}`}
                className="flex flex-col gap-0.5 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{m.produitNom}</span>
                  {m.lotFabrication && (
                    <span className="text-xs text-muted-foreground">
                      Lot : {m.lotFabrication}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {m.quantite} kg
                  </span>
                </div>
                <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {tAnalytics("dlc.bientot", { jours: m.joursRestants })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
