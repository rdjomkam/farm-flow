"use client";

/**
 * src/components/previsions/scenario-detail-client.tsx
 *
 * Shell Tabs du detail d'un scenario de prevision (Sprint PR2, story
 * PR2.3) : Parametres, Granulometries, Plan des vagues, Charges, Journal,
 * Apports. Chaque onglet est un composant dedie — fichier deja volumineux
 * sans cela.
 *
 * Story PR2.4 (Sprint PR2) ajoute 2 onglets a ce shell existant : "Tableau
 * de bord" et "Previsions" (vue mensuelle) — la projection complete de
 * l'horizon (`calculerProjectionScenario`) est chargee par le Server
 * Component (`previsions-scenario-detail-page.tsx`) et transmise ici en
 * props deja converties en `number` (jamais un `Decimal` a travers la
 * frontiere Server->Client).
 *
 * Bugfix (post-PR2ter, signale en conditions reelles) : `projection` est
 * calculee UNE SEULE FOIS par le Server Component au chargement de la page,
 * puis lue directement (jamais copiee dans un `useState`, cf. `tableau-bord-tab.tsx`
 * et `previsions-mensuelles-tab.tsx`) — c'est deliberement ainsi que
 * `router.refresh()` (App Router : refait tourner le Server Component parent,
 * renvoie des props fraiches, ne remonte PAS ce Client Component ni son etat
 * d'onglet actif, cf. `Tabs` non controle plus bas) suffit a rafraichir le
 * tableau de bord et la vue mensuelle. Avant ce fix, aucune mutation d'aucun
 * onglet (vagues, granulometries, charges, journal, apports, parametres) ne
 * declenchait ce refresh : l'utilisateur modifiait une donnee, bascule sur le
 * tableau de bord sans recharger la page, et voyait des chiffres perimes.
 * `handleDataChanged` est le point d'appel UNIQUE de `router.refresh()`,
 * transmis a tous les onglets qui mutent une donnee entrant dans le calcul
 * de la projection — jamais un `router.refresh()` disperse dans chaque
 * gestionnaire de mutation individuel, pour garder un seul endroit a
 * auditer si un onglet manque a l'appel. `useCallback` avec dependance
 * stable (`router`) evite de recreer la reference a chaque rendu (pas de
 * risque de boucle : `router.refresh()` ne remonte pas ce composant, donc ne
 * recree jamais `handleDataChanged`).
 *
 * Story PR2q.4 : `initialApports`/`initialCharges`/`initialPostes`/
 * `initialJournal` (deja charges ci-dessus, deja transmis a leurs onglets
 * respectifs) sont AUSSI transmis a `PrevisionsMensuellesTab`, qui les
 * ventile par type d'apport / par poste — aucune nouvelle requete, aucune
 * duplication de donnees.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Permission } from "@/types";
import type {
  ScenarioPrevisionDetailDTO,
  AlimentPrevisionDTO,
  VaguePrevueListItemDTO,
  PostePrevisionDTO,
  ChargeMensuellePrevueDTO,
  JournalDepensePrevueDTO,
  ApportCapitalDTO,
  VagueCandidateDTO,
} from "@/components/previsions/api-types";
import type { ProjectionScenarioDTO } from "@/components/previsions/projection-types";
import { ParametresTab } from "@/components/previsions/parametres-tab";
import { AlimentsTab } from "@/components/previsions/aliments-tab";
import { PlanVaguesTab } from "@/components/previsions/plan-vagues-tab";
import { ChargesTab } from "@/components/previsions/charges-tab";
import { JournalTab } from "@/components/previsions/journal-tab";
import { ApportsTab } from "@/components/previsions/apports-tab";
import { TableauBordTab } from "@/components/previsions/tableau-bord-tab";
import { PrevisionsMensuellesTab } from "@/components/previsions/previsions-mensuelles-tab";

interface ScenarioDetailClientProps {
  scenario: ScenarioPrevisionDetailDTO;
  initialAliments: AlimentPrevisionDTO[];
  initialVaguesPrevues: VaguePrevueListItemDTO[];
  initialPostes: PostePrevisionDTO[];
  initialCharges: ChargeMensuellePrevueDTO[];
  initialJournal: JournalDepensePrevueDTO[];
  initialApports: ApportCapitalDTO[];
  vaguesCandidates: VagueCandidateDTO[];
  permissions: Permission[];
  /** Projection complete de l'horizon (story PR2.4) — deja convertie en `number`. */
  projection: ProjectionScenarioDTO;
  /**
   * Message d'erreur reel si `calculerProjectionScenario` a leve une
   * exception (ex. configuration manquante) — `null` si la projection
   * vide provient d'un scenario reellement sans donnees. Distingue les
   * deux causes pour les onglets Tableau de bord / Previsions (finding de
   * review PR2.4 : un repli silencieux qui ressemble a "tout est a zero"
   * est trompeur quant a la cause reelle).
   */
  erreurProjection: string | null;
}

export function ScenarioDetailClient({
  scenario,
  initialAliments,
  initialVaguesPrevues,
  initialPostes,
  initialCharges,
  initialJournal,
  initialApports,
  vaguesCandidates,
  permissions,
  projection,
  erreurProjection,
}: ScenarioDetailClientProps) {
  const t = useTranslations("previsions");
  const router = useRouter();
  const [vaguesPrevues, setVaguesPrevues] = useState(initialVaguesPrevues);
  const tabsListRef = useRef<HTMLDivElement>(null);

  /**
   * Point d'appel unique de `router.refresh()` — cf. commentaire d'entete.
   * Ne vide ni ne fait clignoter l'ecran : App Router remplace les props des
   * Server Components en place une fois la nouvelle donnee prete, sans
   * demonter ce Client Component (l'onglet actif, porte par `Tabs` non
   * controle plus bas, n'est jamais reinitialise).
   */
  const handleDataChanged = useCallback(() => {
    router.refresh();
  }, [router]);

  /**
   * 8 onglets sur une seule ligne defilante en mobile (cf. TabsList
   * ci-dessous, `overflow-x-auto` + `scrollbar-hide`) : si l'onglet actif
   * est hors du cadre visible (ex. "Apports", le dernier), rien ne l'indique
   * a l'utilisateur sans ce recentrage explicite. Appele au montage et a
   * chaque changement d'onglet — jamais en pilotant `value`/`onValueChange`
   * de `Tabs` de façon controlee (cf. commentaire d'entete : `Tabs` reste
   * non controle, l'etat d'onglet actif est gere par Radix lui-meme).
   * `requestAnimationFrame` : `onValueChange` de Radix se declenche avant
   * que React n'ait commite le nouvel attribut `data-state="active"` sur le
   * `TabsTrigger` cible — sans ce differe, `scrollIntoView` viserait encore
   * l'ancien onglet actif.
   */
  const scrollActiveTabIntoView = useCallback(() => {
    const activeTrigger = tabsListRef.current?.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]'
    );
    activeTrigger?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  useEffect(() => {
    scrollActiveTabIntoView();
  }, [scrollActiveTabIntoView]);

  return (
    <Tabs
      defaultValue="tableau-de-bord"
      onValueChange={() => requestAnimationFrame(scrollActiveTabIntoView)}
    >
      <TabsList
        ref={tabsListRef}
        className="flex-nowrap justify-start overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide [-webkit-overflow-scrolling:touch]"
      >
        <TabsTrigger value="tableau-de-bord">{t("tabs.tableauBord")}</TabsTrigger>
        <TabsTrigger value="previsions">{t("tabs.previsions")}</TabsTrigger>
        <TabsTrigger value="parametres">{t("tabs.parametres")}</TabsTrigger>
        <TabsTrigger value="aliments">{t("tabs.aliments")}</TabsTrigger>
        <TabsTrigger value="vagues">{t("tabs.vagues")}</TabsTrigger>
        <TabsTrigger value="charges">{t("tabs.charges")}</TabsTrigger>
        <TabsTrigger value="journal">{t("tabs.journal")}</TabsTrigger>
        <TabsTrigger value="apports">{t("tabs.apports")}</TabsTrigger>
      </TabsList>

      <TabsContent value="tableau-de-bord">
        <TableauBordTab
          dateDebutPlan={scenario.dateDebutPlan}
          projection={projection}
          erreurProjection={erreurProjection}
        />
      </TabsContent>

      <TabsContent value="previsions">
        <PrevisionsMensuellesTab
          dateDebutPlan={scenario.dateDebutPlan}
          mois={projection.mois}
          erreurProjection={erreurProjection}
          apports={initialApports}
          charges={initialCharges}
          postes={initialPostes}
          journal={initialJournal}
        />
      </TabsContent>

      <TabsContent value="parametres">
        <ParametresTab scenario={scenario} permissions={permissions} onDataChanged={handleDataChanged} />
      </TabsContent>

      <TabsContent value="aliments">
        <AlimentsTab
          scenarioId={scenario.id}
          dureeCycleMois={scenario.dureeCycleMois}
          initialAliments={initialAliments}
          permissions={permissions}
          onDataChanged={handleDataChanged}
        />
      </TabsContent>

      <TabsContent value="vagues">
        <PlanVaguesTab
          scenarioId={scenario.id}
          vaguesPrevues={vaguesPrevues}
          onVaguesPrevuesChange={setVaguesPrevues}
          vaguesCandidates={vaguesCandidates}
          permissions={permissions}
          parametres={scenario.parametres}
          dateDebutPlan={scenario.dateDebutPlan}
          dureeCycleMois={scenario.dureeCycleMois}
          onDataChanged={handleDataChanged}
        />
      </TabsContent>

      <TabsContent value="charges">
        <ChargesTab
          scenarioId={scenario.id}
          dateDebutPlan={scenario.dateDebutPlan}
          initialPostes={initialPostes}
          initialCharges={initialCharges}
          permissions={permissions}
          horizonMois={projection.horizonMois}
          erreurProjection={erreurProjection}
          onDataChanged={handleDataChanged}
        />
      </TabsContent>

      <TabsContent value="journal">
        <JournalTab
          scenarioId={scenario.id}
          initialJournal={initialJournal}
          vaguesPrevues={vaguesPrevues}
          permissions={permissions}
          onDataChanged={handleDataChanged}
        />
      </TabsContent>

      <TabsContent value="apports">
        <ApportsTab
          scenarioId={scenario.id}
          initialApports={initialApports}
          permissions={permissions}
          onDataChanged={handleDataChanged}
        />
      </TabsContent>
    </Tabs>
  );
}
