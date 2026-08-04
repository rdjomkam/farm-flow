"use client";

/**
 * src/components/previsions/tableau-bord-tab.tsx
 *
 * Tableau de bord du scenario de prevision (Sprint PR2, story PR2.4,
 * ADR-053 §7.1/§7.2) : un bandeau de 6 indicateurs (priorite visuelle a la
 * tresorerie actuelle et au point bas, cf. consigne explicite du sprint),
 * puis le graphique unique de tresorerie sur l'horizon
 * (`TresorerieChart`). Objectif : l'exploitant comprend sa situation en
 * moins de 10 secondes, sans scroll a 360px pour voir au moins le point
 * bas + son mois et le debut de la courbe.
 *
 * "Tresorerie actuelle" n'est PAS une donnee reelle (aucun solde de caisse
 * n'existe dans le schema farm-flow) — c'est le solde PROJETE du mois
 * calendaire courant, cf. `calculerTresorerieActuelle`
 * (src/lib/previsions/tableau-de-bord-helpers.ts) et le libelle explicite
 * ci-dessous ("Trésorerie projetée au ...", jamais un intitulé qui
 * laisserait croire a une donnee reelle constatee).
 */
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import { TresorerieChart } from "@/components/previsions/tresorerie-chart";
import {
  formatMontantPrevision,
  formatEntierPrevision,
  formatTonnagePrevision,
  classeMontant,
} from "@/lib/previsions/format-previsions";
import {
  calculerTresorerieActuelle,
  libelleMoisCalendaire,
} from "@/lib/previsions/tableau-de-bord-helpers";
import { StatutVaguePrevue } from "@/types";
import type { ProjectionScenarioDTO } from "@/components/previsions/projection-types";
import { cn } from "@/lib/utils";

interface TableauBordTabProps {
  dateDebutPlan: string;
  projection: ProjectionScenarioDTO;
  /**
   * Message d'erreur reel si le calcul de la projection a echoue (ex.
   * configuration manquante) — distinct de l'etat "scenario reellement
   * vide". Cf. finding de review PR2.4.
   */
  erreurProjection: string | null;
}

export function TableauBordTab({ dateDebutPlan, projection, erreurProjection }: TableauBordTabProps) {
  const t = useTranslations("previsions");
  const dateDebut = new Date(dateDebutPlan);
  const { horizonMois, mois, vagues, pointBas, budget } = projection;

  const vaguesActives = vagues.filter((v) => v.statut !== StatutVaguePrevue.ANNULEE);
  const revenuTotalPrevu = mois.reduce((sum, m) => sum + m.revenusFCFA, 0);
  const biomasseTotaleKg = vaguesActives.reduce((sum, v) => sum + v.biomasseKg, 0);

  const tresorerieActuelle = calculerTresorerieActuelle(dateDebut, horizonMois, mois);

  return (
    <div className="space-y-4">
      {erreurProjection && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">
              {t("page.errors.projectionUnavailable")}
            </p>
            <p className="mt-1 text-sm text-danger/90">{erreurProjection}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("tableauBordTab.errorHint")}
            </p>
          </div>
        </div>
      )}

      {/* Bandeau d'indicateurs — priorite visuelle a la tresorerie actuelle et au point bas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 1. Tresorerie actuelle (projection, pas une donnee reelle) */}
        <Card
          className={cn(
            "border-2",
            tresorerieActuelle.statut === "disponible" && tresorerieActuelle.soldeFCFA !== null
              ? tresorerieActuelle.soldeFCFA < 0
                ? "border-danger"
                : "border-success"
              : "border-border"
          )}
        >
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tresorerieActuelle.statut === "disponible"
                ? t("tableauBordTab.tresorerie.titleWithMonth", {
                    month: libelleMoisCalendaire(dateDebut, tresorerieActuelle.moisAbsolu!),
                  })
                : t("tableauBordTab.tresorerie.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tresorerieActuelle.statut === "disponible" ? (
              <ValeurCalculee
                className="text-xl"
                value={
                  <span className={classeMontant(tresorerieActuelle.soldeFCFA)}>
                    {formatMontantPrevision(tresorerieActuelle.soldeFCFA)}
                  </span>
                }
                formule={t("tableauBordTab.tresorerie.formule")}
                explication={[
                  {
                    label: t("tableauBordTab.tresorerie.currentMonthLabel"),
                    valeur: libelleMoisCalendaire(dateDebut, tresorerieActuelle.moisAbsolu!),
                  },
                  { label: t("tableauBordTab.tresorerie.natureLabel"), valeur: t("tableauBordTab.tresorerie.natureValue") },
                ]}
                ariaLabel={t("tableauBordTab.tresorerie.aria")}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {erreurProjection
                  ? t("tableauBordTab.tresorerie.unavailable")
                  : tresorerieActuelle.statut === "avant_horizon"
                  ? t("tableauBordTab.tresorerie.beforeHorizon")
                  : t("tableauBordTab.tresorerie.afterHorizon")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 2. Point bas projete + mois — indicateur le plus important du §7.2 */}
        <Card className={cn("border-2", pointBas && pointBas.pointBasFCFA < 0 ? "border-danger" : "border-border")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("tableauBordTab.pointBas.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pointBas ? (
              <ValeurCalculee
                className="text-xl"
                value={
                  <span className={classeMontant(pointBas.pointBasFCFA)}>
                    {formatMontantPrevision(pointBas.pointBasFCFA)}
                  </span>
                }
                formule={t("tableauBordTab.pointBas.formule")}
                explication={[
                  { label: t("tableauBordTab.pointBas.monthLabel"), valeur: libelleMoisCalendaire(dateDebut, pointBas.moisAbsolu) },
                  { label: t("tableauBordTab.pointBas.horizonLabel"), valeur: t("tableauBordTab.pointBas.horizonValue", { count: horizonMois }) },
                ]}
                ariaLabel={t("tableauBordTab.pointBas.aria")}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {erreurProjection
                  ? t("tableauBordTab.pointBas.unavailable")
                  : t("tableauBordTab.pointBas.noData")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 3. Budget total du plan */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("tableauBordTab.budget.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ValeurCalculee
              value={formatMontantPrevision(budget.budgetTotalFCFA)}
              formule={t("tableauBordTab.budget.formule")}
              explication={[
                { label: t("tableauBordTab.budget.productionLabel"), valeur: formatMontantPrevision(budget.totalCoutsProductionFCFA) },
                { label: t("tableauBordTab.budget.horsProductionLabel"), valeur: formatMontantPrevision(budget.totalChargesHorsProductionFCFA) },
                { label: t("tableauBordTab.budget.apportsLabel"), valeur: formatMontantPrevision(budget.totalApportsFCFA) },
              ]}
              ariaLabel={t("tableauBordTab.budget.aria")}
            />
          </CardContent>
        </Card>

        {/* 4. Revenu total prevu */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("tableauBordTab.revenu.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ValeurCalculee
              value={formatMontantPrevision(revenuTotalPrevu)}
              formule={t("tableauBordTab.revenu.formule")}
              explication={[{ label: t("tableauBordTab.revenu.monthsLabel"), valeur: `${mois.length}` }]}
              ariaLabel={t("tableauBordTab.revenu.aria")}
            />
          </CardContent>
        </Card>

        {/* 5. Nombre de vagues actives */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("tableauBordTab.vagues.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ValeurCalculee
              value={formatEntierPrevision(vaguesActives.length)}
              formule={t("tableauBordTab.vagues.formule")}
              explication={[{ label: t("tableauBordTab.vagues.totalLabel"), valeur: `${vaguesActives.length}` }]}
              ariaLabel={t("tableauBordTab.vagues.aria")}
            />
          </CardContent>
        </Card>

        {/* 6. Biomasse totale prevue */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("tableauBordTab.biomasse.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ValeurCalculee
              value={formatTonnagePrevision(biomasseTotaleKg)}
              formule={t("tableauBordTab.biomasse.formule")}
              explication={[{ label: t("tableauBordTab.biomasse.sumLabel"), valeur: `${vaguesActives.length}` }]}
              ariaLabel={t("tableauBordTab.biomasse.aria")}
            />
          </CardContent>
        </Card>
      </div>

      {/* Graphique unique de tresorerie sur l'horizon */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t("tableauBordTab.chart.title")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <TresorerieChart dateDebutPlan={dateDebutPlan} mois={mois} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {t("tableauBordTab.chart.legend")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
