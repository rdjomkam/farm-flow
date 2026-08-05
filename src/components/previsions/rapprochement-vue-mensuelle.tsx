"use client";

/**
 * src/components/previsions/rapprochement-vue-mensuelle.tsx
 *
 * Vue 1/4 de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053
 * §6.4) : une ligne par poste (prevu/reel/ecart/ecart %) pour le mois
 * selectionne, plus le bac "Non rapproche" TOUJOURS visible (jamais
 * masque, meme vide) et une ligne "Total" agregee par le moteur
 * (`agregerParMois`, jamais resommee ici).
 *
 * Les lignes de statut `NON_RAPPROCHE` sont exclues de la liste
 * principale (deja rendues, separement et explicitement, par
 * `RapprochementNonRapproche`) — elles restent neanmoins comptees dans
 * `totalMonetaire`/`totalQuantite` (calcules par le moteur sur TOUTES les
 * lignes du mois, y compris `NON_RAPPROCHE`), pour ne jamais les faire
 * disparaitre du total reel.
 *
 * Story C.2 (PR3-ter) : le total du mois n'est plus un agregat unique —
 * `totalMonetaire` (DEPENSE/ENTREE, FCFA) et `totalQuantite` (kg) sont
 * DEUX totaux disjoints, jamais sommes ni tries ensemble (une quantite
 * kg n'a pas de sens additionnee a un montant FCFA).
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe, type TotalAffichableDTO } from "@/components/previsions/rapprochement-lignes-liste";
import { RapprochementNonRapproche } from "@/components/previsions/rapprochement-non-rapproche";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import { enrichirLibelleAvecRattachement } from "@/components/previsions/poste-rattachement-badge";
import type { AgregatEcartDTO, LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

interface RapprochementVueMensuelleProps {
  dateDebutPlan: Date;
  moisAbsolu: number;
  lignes: LigneRapprochementDTO[];
  nonRapproche: LigneRapprochementDTO[];
  totalMonetaire: AgregatEcartDTO | undefined;
  totalQuantite: AgregatEcartDTO | undefined;
  /** ADR-053 §16.12, exigence A — cf. `rapprochement-tab.tsx`. */
  posteRattachementParId?: Record<string, { libelle: string; actif: boolean }>;
}

export function RapprochementVueMensuelle({
  dateDebutPlan,
  moisAbsolu,
  lignes,
  nonRapproche,
  totalMonetaire,
  totalQuantite,
  posteRattachementParId,
}: RapprochementVueMensuelleProps) {
  const t = useTranslations("previsions");
  const libelleMois = libelleMoisCalendaire(dateDebutPlan, moisAbsolu);
  // ADR-053 §16.12, exigence A : `libelle` enrichi d'un suffixe compact de
  // rattachement (presentation uniquement) — jamais applique aux lignes
  // NON_RAPPROCHE (aucun PostePrevision associe).
  const lignesPrincipales = lignes
    .filter((l) => l.statutRapprochement !== "NON_RAPPROCHE")
    .map((l) => ({
      ...l,
      libelle: enrichirLibelleAvecRattachement(t, l.id, l.libelle, posteRattachementParId),
    }));

  const totaux: TotalAffichableDTO[] = [];
  if (totalMonetaire) {
    totaux.push({ agregat: totalMonetaire, unite: "MONETAIRE", labelKey: "rapprochementTab.totalRowMonetaire" });
  }
  if (totalQuantite) {
    totaux.push({ agregat: totalQuantite, unite: "QUANTITE", labelKey: "rapprochementTab.totalRowQuantite" });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("rapprochementTab.vueMensuelle.title", { mois: libelleMois })}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.vueMensuelle.description")}</p>
        </CardHeader>
        <CardContent>
          <RapprochementLignesListe
            lignes={lignesPrincipales}
            totaux={totaux}
            emptyLabel={t("rapprochementTab.noData")}
          />
        </CardContent>
      </Card>

      <RapprochementNonRapproche lignes={nonRapproche} />
    </div>
  );
}
