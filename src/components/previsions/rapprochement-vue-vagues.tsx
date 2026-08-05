"use client";

/**
 * src/components/previsions/rapprochement-vue-vagues.tsx
 *
 * Vue 3/4 de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053
 * §6.4) : cout complet, marge et cout au kg, prevu vs reel, POUR CHAQUE
 * VaguePrevue du scenario. Solde la dette du "libelle de cohorte" : chaque
 * ligne porte le code de la VaguePrevue (ex. "V7") ET, si rattachee, le
 * code de la Vague reelle correspondante — jamais un agregat anonyme.
 *
 * Une VaguePrevue NON REALISEE (`realisee === false`) est distinguee
 * VISUELLEMENT (badge dedie + absence totale de chiffres "reel", jamais un
 * 0) d'une vague realisee.
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMontantPrevision, formatRatioPrevision } from "@/lib/previsions/format-previsions";
import { classeFondCouleur, classeTexteCouleur } from "@/components/previsions/rapprochement-ui-helpers";
import type { ComparaisonChiffreeDTO, VagueRapprochementRowDTO } from "@/components/previsions/rapprochement-types";
import { cn } from "@/lib/utils";

function CelluleComparaison({
  comparaison,
  format,
}: {
  comparaison: ComparaisonChiffreeDTO;
  format: "montant" | "ratio";
}) {
  const t = useTranslations("previsions");
  const f = (v: number) => (format === "montant" ? formatMontantPrevision(v) : formatRatioPrevision(v));

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
      <span className="text-muted-foreground">{t("rapprochementTab.columns.prevu")}</span>
      <span className="text-right tabular-nums">
        {comparaison.prevu === null ? t("rapprochementTab.vueParVague.indisponible") : f(comparaison.prevu)}
      </span>
      <span className="text-muted-foreground">{t("rapprochementTab.columns.reel")}</span>
      <span className="text-right tabular-nums">
        {comparaison.reel === null ? "–" : f(comparaison.reel)}
      </span>
      {comparaison.ecartAbsolu !== null && (
        <>
          <span className="text-muted-foreground">{t("rapprochementTab.columns.ecartAbsolu")}</span>
          <span className={cn("text-right font-medium tabular-nums", classeTexteCouleur(comparaison.couleur))}>
            {f(comparaison.ecartAbsolu)}
          </span>
        </>
      )}
    </div>
  );
}

function LibelleCohorte({ vague }: { vague: VagueRapprochementRowDTO }) {
  const t = useTranslations("previsions");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-foreground">{vague.codePrevu}</span>
      {vague.realisee && vague.codeReel ? (
        <Badge variant="success">{t("rapprochementTab.vueParVague.codeReelLabel", { code: vague.codeReel })}</Badge>
      ) : (
        <Badge variant="default">{t("rapprochementTab.vueParVague.nonRealisee")}</Badge>
      )}
    </div>
  );
}

interface RapprochementVueVaguesProps {
  vagues: VagueRapprochementRowDTO[];
}

export function RapprochementVueVagues({ vagues }: RapprochementVueVaguesProps) {
  const t = useTranslations("previsions");

  if (vagues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("rapprochementTab.noData")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("rapprochementTab.vueParVague.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("rapprochementTab.vueParVague.description")}</p>
      </CardHeader>
      <CardContent>
        {/* Cartes empilees — mobile */}
        <div className="space-y-3 md:hidden">
          {vagues.map((v) => (
            <div key={v.vaguePrevueId} className="rounded-lg border border-border p-3">
              <LibelleCohorte vague={v} />
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("rapprochementTab.vueParVague.coutComplet")}
                  </p>
                  <CelluleComparaison comparaison={v.coutComplet} format="montant" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("rapprochementTab.vueParVague.marge")}
                  </p>
                  <CelluleComparaison comparaison={v.marge} format="montant" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("rapprochementTab.vueParVague.coutAuKg")}
                  </p>
                  <CelluleComparaison comparaison={v.coutAuKg} format="montant" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tableau — a partir de md: */}
        <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("rapprochementTab.columns.libelle")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.vueParVague.coutComplet")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.vueParVague.marge")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.vueParVague.coutAuKg")}</th>
              </tr>
            </thead>
            <tbody>
              {vagues.map((v) => (
                <tr key={v.vaguePrevueId} className="border-b border-border/60 align-top hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <LibelleCohorte vague={v} />
                  </td>
                  <td className={cn("px-3 py-2", classeFondCouleur(v.coutComplet.couleur))}>
                    <CelluleComparaison comparaison={v.coutComplet} format="montant" />
                  </td>
                  <td className={cn("px-3 py-2", classeFondCouleur(v.marge.couleur))}>
                    <CelluleComparaison comparaison={v.marge} format="montant" />
                  </td>
                  <td className={cn("px-3 py-2", classeFondCouleur(v.coutAuKg.couleur))}>
                    <CelluleComparaison comparaison={v.coutAuKg} format="montant" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
