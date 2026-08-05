"use client";

/**
 * src/components/previsions/rapprochement-vue-cumulee.tsx
 *
 * Vue 2/4 de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053
 * §6.4) : cumul depuis le debut de l'horizon jusqu'au mois selectionne
 * (inclus) — un total global (montants bruts, sans sens : un total qui
 * mélange DEPENSE/ENTREE/QUANTITE n'a pas de sens favorable/defavorable
 * coherent) et un detail par poste (chaque poste etant de nature
 * homogene, `sens`/`couleur` y restent bien definis — deja calcules cote
 * serveur, `previsions-vue-rapprochement.ts`).
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe } from "@/components/previsions/rapprochement-lignes-liste";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import type { AgregatEcartDTO, AgregatPosteDTO, LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

interface RapprochementVueCumuleeProps {
  dateDebutPlan: Date;
  moisAbsolu: number;
  totalGlobal: AgregatEcartDTO | undefined;
  parPoste: AgregatPosteDTO[];
}

export function RapprochementVueCumulee({
  dateDebutPlan,
  moisAbsolu,
  totalGlobal,
  parPoste,
}: RapprochementVueCumuleeProps) {
  const t = useTranslations("previsions");
  const libelleMois = libelleMoisCalendaire(dateDebutPlan, moisAbsolu);

  // Reutilise le rendu de `RapprochementLignesListe` en projetant chaque
  // AgregatPosteDTO comme une LigneRapprochementDTO — meme forme de
  // donnees deja tranchee (sens/couleur/ecart), aucune recomposition.
  const lignesPourAffichage: LigneRapprochementDTO[] = parPoste.map((p) => ({
    id: p.cle,
    moisAbsolu,
    libelle: p.libelle,
    natureGrandeur: p.natureGrandeur,
    prevu: p.totalPrevu,
    reel: p.nombreLignesSansSourceReelle === p.nombreLignes ? null : p.totalReel,
    statutRapprochement: p.nombreLignesNonRapprochees > 0 ? "NON_RAPPROCHE" : "RAPPROCHE",
    ecartAbsolu: p.totalEcartAbsolu,
    ecartPct: p.ecartPct,
    sens: p.sens,
    couleur: p.couleur,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("rapprochementTab.vueCumulee.title", { mois: libelleMois })}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.vueCumulee.description")}</p>
        </CardHeader>
        <CardContent>
          {totalGlobal && (
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border-2 border-border bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("rapprochementTab.columns.prevu")}</p>
                <p className="font-semibold tabular-nums">{formatMontantPrevision(totalGlobal.totalPrevu)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("rapprochementTab.columns.reel")}</p>
                <p className="font-semibold tabular-nums">{formatMontantPrevision(totalGlobal.totalReel)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("rapprochementTab.columns.ecartAbsolu")}</p>
                <p className="font-semibold tabular-nums">{formatMontantPrevision(totalGlobal.totalEcartAbsolu)}</p>
              </div>
            </div>
          )}

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("rapprochementTab.vueCumulee.parPoste")}
          </p>
          <RapprochementLignesListe lignes={lignesPourAffichage} emptyLabel={t("rapprochementTab.noData")} />
        </CardContent>
      </Card>
    </div>
  );
}

