"use client";

import { useTranslations, useLocale } from "next-intl";
import { Factory } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ResumeParUnite {
  uniteId: string;
  code: string;
  nom: string;
  type: string;
  revenus: number;
  couts: number;
  marge: number;
  revenusTransferts: number;
  coutsTransferts: number;
  nombreVagues: number;
  nombreDepenses: number;
}

interface PerUnitPnlProps {
  unites: ResumeParUnite[];
  nonAffecte: { couts: number; nombreDepenses: number };
}

function formatFCFA(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(amount)) + " FCFA";
}

export function PerUnitPnl({ unites, nonAffecte }: PerUnitPnlProps) {
  const t = useTranslations("ventes");
  const locale = useLocale();

  if (unites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {t("finances.parUnite.aucuneUnite")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Factory className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">{t("finances.parUnite.title")}</h3>
      </div>

      {/* Unit cards */}
      {unites.map((unite) => {
        const badgeVariant =
          unite.type === "GROSSISSEMENT"
            ? "en_cours"
            : unite.type === "REPRODUCTION"
            ? "info"
            : "default";

        return (
          <Card key={unite.uniteId}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">
                    {unite.nom}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{unite.code}</p>
                </div>
                <Badge variant={badgeVariant} shape="pill">
                  {unite.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Metrics grid: 2 cols on mobile, 4 cols on lg */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {/* Revenus */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    {t("finances.parUnite.revenus")}
                  </p>
                  <p className={`text-sm font-bold ${unite.revenus > 0 ? "text-success" : ""}`}>
                    {formatFCFA(unite.revenus, locale)}
                  </p>
                </div>

                {/* Couts */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    {t("finances.parUnite.couts")}
                  </p>
                  <p className="text-sm font-bold text-danger">
                    {formatFCFA(unite.couts, locale)}
                  </p>
                </div>

                {/* Marge */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    {t("finances.parUnite.marge")}
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      unite.marge >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatFCFA(unite.marge, locale)}
                  </p>
                </div>

                {/* Transferts (shown only when non-zero) */}
                {(unite.revenusTransferts !== 0 || unite.coutsTransferts !== 0) && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Transferts
                    </p>
                    {unite.revenusTransferts !== 0 && (
                      <p className="text-xs text-success">
                        {t("finances.parUnite.transfertsIn")}:{" "}
                        {formatFCFA(unite.revenusTransferts, locale)}
                      </p>
                    )}
                    {unite.coutsTransferts !== 0 && (
                      <p className="text-xs text-danger">
                        {t("finances.parUnite.transfertsOut")}:{" "}
                        {formatFCFA(unite.coutsTransferts, locale)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer: vagues + depenses count */}
              <p className="mt-3 text-xs text-muted-foreground border-t pt-2">
                {t("finances.parUnite.vagues", { count: unite.nombreVagues })}
                {" · "}
                {t("finances.parUnite.depenses", { count: unite.nombreDepenses })}
              </p>
            </CardContent>
          </Card>
        );
      })}

      {/* Non-assigned costs */}
      {nonAffecte.couts > 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{t("finances.parUnite.nonAffecte")}</span>
              {" : "}
              {formatFCFA(nonAffecte.couts, locale)}
              {" ("}
              {t("finances.parUnite.depenses", { count: nonAffecte.nombreDepenses })}
              {")"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
