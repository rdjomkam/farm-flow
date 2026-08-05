"use client";

/**
 * src/components/previsions/rapprochement-vue-top-ecarts.tsx
 *
 * Vue 4/4 de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053
 * §6.4) : les 5 postes expliquant le plus grand ecart (valeur absolue) du
 * mois selectionne — deja tries et limites a 5 par le moteur
 * (`topEcartsDuMois`, cote serveur), ce composant ne fait qu'afficher la
 * liste recue, jamais un second tri/filtre.
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe } from "@/components/previsions/rapprochement-lignes-liste";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import type { LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

interface RapprochementVueTopEcartsProps {
  dateDebutPlan: Date;
  moisAbsolu: number;
  lignes: LigneRapprochementDTO[];
}

export function RapprochementVueTopEcarts({ dateDebutPlan, moisAbsolu, lignes }: RapprochementVueTopEcartsProps) {
  const t = useTranslations("previsions");
  const libelleMois = libelleMoisCalendaire(dateDebutPlan, moisAbsolu);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("rapprochementTab.topEcarts.title", { mois: libelleMois })}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("rapprochementTab.topEcarts.description")}</p>
      </CardHeader>
      <CardContent>
        <RapprochementLignesListe lignes={lignes} emptyLabel={t("rapprochementTab.topEcarts.empty")} />
      </CardContent>
    </Card>
  );
}
