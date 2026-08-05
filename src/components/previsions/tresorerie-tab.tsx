"use client";

/**
 * src/components/previsions/tresorerie-tab.tsx
 *
 * Onglet Tresorerie a TROIS SERIES (ADR-053 §6.5 des exigences
 * fonctionnelles, amendement §15.2, Sprint PR3-ter, story B.5) : BUDGET
 * INITIAL (fige, consultable) / PRÉVISION ACTUALISÉE (recalculee a la
 * demande) / RÉEL, plus la bascule "Reprevision" (§15.2, DISTINCTE de
 * PRÉVISION ACTUALISÉE — jamais confondues dans le libelle ni le code).
 *
 * Toutes les donnees sont pre-calculees cote serveur pour l'INTEGRALITE de
 * l'horizon (meme patron que `projection`/`rapprochement`, stories PR2.4 et
 * PR3.7) — ce composant n'appelle jamais `fetch` lui-meme, il ne fait que
 * choisir quelle courbe est primaire (bascule locale, `useState`).
 *
 * FRANCHISE NON NEGOCIABLE (ADR-053 §15.1(b)/§15.8(a), instruction
 * explicite du sprint) : la serie RÉEL est structurellement incomplete
 * (aucun modele domaine reel pour les apports/subventions/prets reellement
 * encaisses) — biaisee a la baisse des qu'un apport a ete reellement
 * encaisse. Ce caveat est affiche ICI, lisiblement, au-dessus du
 * graphique, jamais omis ni relegue a une infobulle. De meme,
 * `budgetInitialDisponible === false` (scenario jamais active) est dit
 * explicitement — jamais une courbe BUDGET INITIAL a zero qui laisserait
 * croire a un budget initial reellement nul.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { TresorerieTroisSeriesChart } from "@/components/previsions/tresorerie-trois-series-chart";
import type { TresorerieTroisSeriesDTO } from "@/components/previsions/tresorerie-types";
import { cn } from "@/lib/utils";

interface TresorerieTabProps {
  dateDebutPlan: string;
  tresorerie: TresorerieTroisSeriesDTO;
  /**
   * Message d'erreur reel si le calcul de la tresorerie a 3 series a echoue
   * (reserve R4, PR2non.4, ADR-053 §15.6) — `null` si `tresorerie` est vide
   * parce que le scenario n'a reellement aucun mois dans l'horizon. Un echec
   * de CE calcul ne remet JAMAIS en cause la projection deja calculee avec
   * succes (bandeau distinct ci-dessous, jamais confondu avec l'etat
   * "aucune donnee de tresorerie" legitime).
   */
  erreurTresorerie: string | null;
}

export function TresorerieTab({ dateDebutPlan, tresorerie, erreurTresorerie }: TresorerieTabProps) {
  const t = useTranslations("previsions");
  const [reprevisionActive, setReprevisionActive] = useState(false);

  const { series, reprevisionGlissante, budgetInitialDisponible, calculeLe } = tresorerie;
  const sansHorizon = series.length === 0;

  return (
    <div className="space-y-4">
      {erreurTresorerie && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-danger">{t("tresorerieTab.errors.title")}</p>
            <p className="mt-1 text-sm text-danger/90">{erreurTresorerie}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("tresorerieTab.errors.hint")}</p>
          </div>
        </div>
      )}

      {!sansHorizon && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("tresorerieTab.freshnessNote", { date: formatDateTime(calculeLe) })}</p>
        </div>
      )}

      {/* Caveat NON FILTRABLE (ADR-053 §15.1(b)) : la serie RÉEL est structurellement incomplete.
          Non pertinent quand le calcul lui-meme a echoue (erreurTresorerie) — le bandeau d'erreur
          ci-dessus suffit, un second bandeau parlant de "serie incomplete" serait trompeur. */}
      {!erreurTresorerie && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-warning">{t("tresorerieTab.caveatReel.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("tresorerieTab.caveatReel.description")}</p>
          </div>
        </div>
      )}

      {/* Budget initial jamais fige -> le dire explicitement, jamais une courbe a zero. */}
      {!erreurTresorerie && !budgetInitialDisponible && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("tresorerieTab.budgetInitialIndisponible.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("tresorerieTab.budgetInitialIndisponible.description")}</p>
          </div>
        </div>
      )}

      {sansHorizon ? (
        erreurTresorerie ? null : (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("tresorerieTab.noData")}</p>
        )
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 pb-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">{t("tresorerieTab.chart.title")}</CardTitle>
            <button
              type="button"
              onClick={() => setReprevisionActive((v) => !v)}
              aria-pressed={reprevisionActive}
              className={cn(
                "flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                reprevisionActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {t("tresorerieTab.reprevisionToggle")}
            </button>
          </CardHeader>
          <CardContent className="pt-4">
            <TresorerieTroisSeriesChart
              dateDebutPlan={dateDebutPlan}
              series={series}
              reprevisionGlissante={reprevisionGlissante}
              budgetInitialDisponible={budgetInitialDisponible}
              reprevisionActive={reprevisionActive}
            />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {reprevisionActive
                ? t("tresorerieTab.chart.legendReprevision")
                : t("tresorerieTab.chart.legend")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
