"use client";

/**
 * src/components/previsions/rapprochement-tab.tsx
 *
 * Onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053 section 15,
 * amendement §15.7 : c'est un ONGLET de plus sous
 * `/previsions/scenarios/[id]`, jamais une route separee
 * `/previsions/rapprochement` — le `MODULE_NAV` §6 de l'ADR ne reflete pas
 * l'implementation reelle sur ce point).
 *
 * Les 4 vues (§6.4 des exigences) : mensuelle, cumulee, par vague, top
 * ecarts. Hors perimetre de cette story (ADR-053 §15.8.f) : la vue
 * tresorerie a 3 series (BUDGET INITIAL / PREVISION ACTUALISEE / REEL) et
 * la reprevision glissante — non construites ici.
 *
 * TOUTES les donnees (`rapprochement`, prop) sont pre-calculees cote
 * serveur pour l'INTEGRALITE de l'horizon (meme patron que `projection`,
 * story PR2.4) — le selecteur de mois ci-dessous n'index QUE dans des
 * structures deja pretes (`Record<number, ...>`), aucune recomposition
 * d'ecart/sens/couleur cote client (ADR-053 section 15.5/15.6, ERR-171).
 *
 * Fraicheur (ADR-053 §5.1(b)) : le bandeau ci-dessous affiche
 * explicitement l'instant ou le "reel" a ete lu (`rapprochement.calculeLe`,
 * fixe au moment du rendu de la page Server Component) — l'utilisateur ne
 * doit jamais croire a une photo figee d'un import passe. Une nouvelle
 * consultation de l'onglet (navigation, `router.refresh()` d'un autre
 * onglet) recharge la page et rafraichit cet instant.
 *
 * 5e sous-onglet "Mapping" (Sprint PR3-bis, pre-analyse section 2) :
 * `RapprochementMappingTab` NE DEPEND D'AUCUN mois selectionne
 * (`MappingRapprochement` est site-scope, pas mensuel) — c'est une vue
 * autonome au-dessus du selecteur de mois, qui charge ses propres donnees
 * cote client (jamais via `rapprochement`, pre-calcule pour les 4 autres
 * vues).
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { moisAbsoluDepuis, libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import { RapprochementVueMensuelle } from "@/components/previsions/rapprochement-vue-mensuelle";
import { RapprochementVueCumulee } from "@/components/previsions/rapprochement-vue-cumulee";
import { RapprochementVueVagues } from "@/components/previsions/rapprochement-vue-vagues";
import { RapprochementVueTopEcarts } from "@/components/previsions/rapprochement-vue-top-ecarts";
import { RapprochementMappingTab } from "@/components/previsions/rapprochement-mapping-tab";
import type { RapprochementScenarioDTO } from "@/components/previsions/rapprochement-types";
import type { Permission } from "@/types";

interface RapprochementTabProps {
  rapprochement: RapprochementScenarioDTO;
  scenarioId: string;
  scenarioNom: string;
  permissions: Permission[];
}

/** Mois par defaut du selecteur : le mois calendaire courant, borne a l'horizon du plan — jamais un acces hors bornes. */
function moisParDefaut(dateDebutPlan: Date, moisDisponibles: number[]): number {
  if (moisDisponibles.length === 0) return 0;
  const moisCourant = moisAbsoluDepuis(dateDebutPlan, new Date());
  if (moisCourant < moisDisponibles[0]) return moisDisponibles[0];
  if (moisCourant > moisDisponibles[moisDisponibles.length - 1]) return moisDisponibles[moisDisponibles.length - 1];
  return moisCourant;
}

export function RapprochementTab({ rapprochement, scenarioId, scenarioNom, permissions }: RapprochementTabProps) {
  const t = useTranslations("previsions");
  const dateDebutPlan = useMemo(() => new Date(rapprochement.dateDebutPlan), [rapprochement.dateDebutPlan]);
  const [moisSelectionne, setMoisSelectionne] = useState(() =>
    moisParDefaut(dateDebutPlan, rapprochement.moisDisponibles)
  );

  // `MappingRapprochement` est site-scope, pas mensuel (cf. en-tete) : un
  // scenario sans mois disponible (aucun horizon calcule) ne doit PAS
  // rendre le sous-onglet Mapping inaccessible — seules les 4 vues
  // mois-dependantes affichent le message vide ci-dessous.
  const sansHorizon = rapprochement.moisDisponibles.length === 0;

  return (
    <div className="space-y-4">
      {!sansHorizon && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("rapprochementTab.freshnessNote", { date: formatDateTime(rapprochement.calculeLe) })}</p>
        </div>
      )}

      {!sansHorizon && (
        <Select value={String(moisSelectionne)} onValueChange={(v) => setMoisSelectionne(Number(v))}>
          <SelectTrigger label={t("rapprochementTab.monthSelectorLabel")} className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rapprochement.moisDisponibles.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {libelleMoisCalendaire(dateDebutPlan, m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue="mensuelle">
        <TabsList className="flex-nowrap justify-start overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide [-webkit-overflow-scrolling:touch]">
          <TabsTrigger value="mensuelle">{t("rapprochementTab.views.mensuelle")}</TabsTrigger>
          <TabsTrigger value="cumulee">{t("rapprochementTab.views.cumulee")}</TabsTrigger>
          <TabsTrigger value="parVague">{t("rapprochementTab.views.parVague")}</TabsTrigger>
          <TabsTrigger value="topEcarts">{t("rapprochementTab.views.topEcarts")}</TabsTrigger>
          <TabsTrigger value="mapping">{t("rapprochementTab.views.mapping")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mensuelle">
          {sansHorizon ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("rapprochementTab.noData")}</p>
          ) : (
            <RapprochementVueMensuelle
              dateDebutPlan={dateDebutPlan}
              moisAbsolu={moisSelectionne}
              lignes={rapprochement.lignesParMois[moisSelectionne] ?? []}
              nonRapproche={rapprochement.nonRapprocheParMois[moisSelectionne] ?? []}
              totalMonetaire={rapprochement.totalMoisMonetaireParMois[moisSelectionne]}
              totalQuantite={rapprochement.totalMoisQuantiteParMois[moisSelectionne]}
            />
          )}
        </TabsContent>

        <TabsContent value="cumulee">
          {sansHorizon ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("rapprochementTab.noData")}</p>
          ) : (
            <RapprochementVueCumulee
              dateDebutPlan={dateDebutPlan}
              moisAbsolu={moisSelectionne}
              totalGlobalMonetaire={rapprochement.cumuleGlobalMonetaireParMois[moisSelectionne]}
              totalGlobalQuantite={rapprochement.cumuleGlobalQuantiteParMois[moisSelectionne]}
              parPoste={rapprochement.cumuleParPosteParMois[moisSelectionne] ?? []}
            />
          )}
        </TabsContent>

        <TabsContent value="parVague">
          {sansHorizon ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("rapprochementTab.noData")}</p>
          ) : (
            <RapprochementVueVagues vagues={rapprochement.vagues} />
          )}
        </TabsContent>

        <TabsContent value="topEcarts">
          {sansHorizon ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("rapprochementTab.noData")}</p>
          ) : (
            <RapprochementVueTopEcarts
              dateDebutPlan={dateDebutPlan}
              moisAbsolu={moisSelectionne}
              lignesMonetaires={rapprochement.topEcartsMonetaireParMois[moisSelectionne] ?? []}
              lignesQuantite={rapprochement.topEcartsQuantiteParMois[moisSelectionne] ?? []}
            />
          )}
        </TabsContent>

        <TabsContent value="mapping">
          <RapprochementMappingTab scenarioId={scenarioId} scenarioNom={scenarioNom} permissions={permissions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
