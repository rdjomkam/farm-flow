"use client";

/**
 * src/components/previsions/rapprochement-vue-cumulee.tsx
 *
 * Vue 2/4 de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053
 * §6.4) : cumul depuis le debut de l'horizon jusqu'au mois selectionne
 * (inclus) — DEUX totaux globaux DISJOINTS (Sprint PR3-ter, story C.2) :
 * `totalGlobalMonetaire` (DEPENSE/ENTREE, FCFA) et `totalGlobalQuantite`
 * (kg). Jamais un total unique melangeant les deux : additionner un
 * montant FCFA et une quantite kg n'est pas une operation arithmetique
 * valide, meme avant de se poser la question du sens favorable/
 * defavorable. Detail par poste : chaque poste etant de nature homogene,
 * `sens`/`couleur` y restent bien definis — deja calcules cote serveur,
 * `previsions-vue-rapprochement.ts`.
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe } from "@/components/previsions/rapprochement-lignes-liste";
import { formatMontantPrevision, formatTonnagePrevision } from "@/lib/previsions/format-previsions";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import { enrichirLibelleAvecRattachement } from "@/components/previsions/poste-rattachement-badge";
import type { AgregatEcartDTO, AgregatPosteDTO, LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

interface RapprochementVueCumuleeProps {
  dateDebutPlan: Date;
  moisAbsolu: number;
  totalGlobalMonetaire: AgregatEcartDTO | undefined;
  totalGlobalQuantite: AgregatEcartDTO | undefined;
  parPoste: AgregatPosteDTO[];
  /** ADR-053 §16.12, exigence A — cf. `rapprochement-tab.tsx`. */
  posteRattachementParId?: Record<string, { libelle: string; actif: boolean }>;
}

/** Bloc "Total cumulé" pour une seule unité (FCFA ou kg) — jamais les deux mélangées dans le même bloc (story C.2). */
function BlocTotalGlobal({
  titre,
  total,
  formatter,
}: {
  titre: string;
  total: AgregatEcartDTO;
  formatter: (valeur: number) => string;
}) {
  const t = useTranslations("previsions");
  return (
    <div className="mb-4 rounded-lg border-2 border-border bg-muted/40 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titre}</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.columns.prevu")}</p>
          <p className="font-semibold tabular-nums">{formatter(total.totalPrevu)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.columns.reel")}</p>
          <p className="font-semibold tabular-nums">{formatter(total.totalReel)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.columns.ecartAbsolu")}</p>
          <p className="font-semibold tabular-nums">{formatter(total.totalEcartAbsolu)}</p>
        </div>
      </div>
    </div>
  );
}

export function RapprochementVueCumulee({
  dateDebutPlan,
  moisAbsolu,
  totalGlobalMonetaire,
  totalGlobalQuantite,
  parPoste,
  posteRattachementParId,
}: RapprochementVueCumuleeProps) {
  const t = useTranslations("previsions");
  const libelleMois = libelleMoisCalendaire(dateDebutPlan, moisAbsolu);

  // Reutilise le rendu de `RapprochementLignesListe` en projetant chaque
  // AgregatPosteDTO comme une LigneRapprochementDTO — meme forme de
  // donnees deja tranchee (sens/couleur/ecart), aucune recomposition.
  // ADR-053 §16.12, exigence A : `libelle` enrichi d'un suffixe compact de
  // rattachement (presentation uniquement, jamais dans le moteur pur).
  const lignesPourAffichage: LigneRapprochementDTO[] = parPoste.map((p) => ({
    id: p.cle,
    moisAbsolu,
    libelle: enrichirLibelleAvecRattachement(t, p.cle, p.libelle, posteRattachementParId),
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
          {totalGlobalMonetaire && totalGlobalMonetaire.nombreLignes > 0 && (
            <BlocTotalGlobal
              titre={t("rapprochementTab.vueCumulee.totalGlobalMonetaire")}
              total={totalGlobalMonetaire}
              formatter={formatMontantPrevision}
            />
          )}
          {totalGlobalQuantite && totalGlobalQuantite.nombreLignes > 0 && (
            <BlocTotalGlobal
              titre={t("rapprochementTab.vueCumulee.totalGlobalQuantite")}
              total={totalGlobalQuantite}
              formatter={formatTonnagePrevision}
            />
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
