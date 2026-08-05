"use client";

/**
 * src/components/previsions/rapprochement-vue-top-ecarts.tsx
 *
 * Vue 4/4 de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053
 * §6.4) : les postes expliquant le plus grand ecart (valeur absolue) du
 * mois selectionne — deja tries et limites cote serveur
 * (`topEcartsDuMois`), ce composant ne fait qu'afficher la liste recue,
 * jamais un second tri/filtre.
 *
 * Story C.2 (PR3-ter) : DEUX classements DISJOINTS, jamais un seul
 * classement mélangeant FCFA et kg — trier des lignes de nature
 * differente par `|ecartAbsolu|` produirait un classement sans sens
 * (ex. un ecart de 5 kg d'aliment pourrait sembler "plus petit" qu'un
 * ecart de 5000 FCFA alors que les deux grandeurs ne sont pas
 * comparables). `lignesMonetaires`/`lignesQuantite` sont deux tops 5
 * distincts, deja partitionnes et tries par le serveur
 * (`previsions-vue-rapprochement.ts`), chacun avec son unite affichee
 * explicitement.
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe } from "@/components/previsions/rapprochement-lignes-liste";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import type { LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

interface RapprochementVueTopEcartsProps {
  dateDebutPlan: Date;
  moisAbsolu: number;
  lignesMonetaires: LigneRapprochementDTO[];
  lignesQuantite: LigneRapprochementDTO[];
}

export function RapprochementVueTopEcarts({
  dateDebutPlan,
  moisAbsolu,
  lignesMonetaires,
  lignesQuantite,
}: RapprochementVueTopEcartsProps) {
  const t = useTranslations("previsions");
  const libelleMois = libelleMoisCalendaire(dateDebutPlan, moisAbsolu);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("rapprochementTab.topEcarts.titleMonetaire", { mois: libelleMois })}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.topEcarts.descriptionMonetaire")}</p>
        </CardHeader>
        <CardContent>
          <RapprochementLignesListe lignes={lignesMonetaires} emptyLabel={t("rapprochementTab.topEcarts.empty")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("rapprochementTab.topEcarts.titleQuantite", { mois: libelleMois })}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("rapprochementTab.topEcarts.descriptionQuantite")}</p>
        </CardHeader>
        <CardContent>
          <RapprochementLignesListe lignes={lignesQuantite} emptyLabel={t("rapprochementTab.topEcarts.empty")} />
        </CardContent>
      </Card>
    </div>
  );
}
