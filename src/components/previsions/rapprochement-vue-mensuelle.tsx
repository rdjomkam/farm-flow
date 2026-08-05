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
 * `total` (calcule par le moteur sur TOUTES les lignes du mois, y compris
 * `NON_RAPPROCHE`), pour ne jamais les faire disparaitre du total reel.
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe } from "@/components/previsions/rapprochement-lignes-liste";
import { RapprochementNonRapproche } from "@/components/previsions/rapprochement-non-rapproche";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import type { AgregatEcartDTO, LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

interface RapprochementVueMensuelleProps {
  dateDebutPlan: Date;
  moisAbsolu: number;
  lignes: LigneRapprochementDTO[];
  nonRapproche: LigneRapprochementDTO[];
  total: AgregatEcartDTO | undefined;
}

export function RapprochementVueMensuelle({
  dateDebutPlan,
  moisAbsolu,
  lignes,
  nonRapproche,
  total,
}: RapprochementVueMensuelleProps) {
  const t = useTranslations("previsions");
  const libelleMois = libelleMoisCalendaire(dateDebutPlan, moisAbsolu);
  const lignesPrincipales = lignes.filter((l) => l.statutRapprochement !== "NON_RAPPROCHE");

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
            total={total}
            emptyLabel={t("rapprochementTab.noData")}
          />
        </CardContent>
      </Card>

      <RapprochementNonRapproche lignes={nonRapproche} />
    </div>
  );
}
