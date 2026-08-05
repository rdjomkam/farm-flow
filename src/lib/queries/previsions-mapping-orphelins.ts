/**
 * src/lib/queries/previsions-mapping-orphelins.ts
 *
 * Filet de securite NON NEGOCIABLE (Sprint PR3-ter, story A.1). Detecte et
 * signale toute CIBLE ORPHELINE de `MappingRapprochement` : un `cibleCle`
 * de mapping actif, non-`null`, qui n'existe pas parmi les `cle` des
 * entreesPrevues du scenario COURANT.
 *
 * Defaut prouve par la pre-analyse (voir ADR-053 §3.9) :
 * `MappingRapprochement.cibleId` est SITE-scope alors que `PostePrevision`/
 * `AlimentPrevision` sont SCENARIO-scopes. Un mapping cree contre le
 * scenario A puis lu depuis le scenario B accumule le montant reel sous une
 * cle morte : le montant N'APPARAIT NULLE PART (ni RAPPROCHE, ni
 * NON_RAPPROCHE, ni SANS_SOURCE_REELLE). Chemin exact :
 * `src/lib/previsions/rapprochement.ts:310-322` accumule sous `cibleId` du
 * scenario A, puis ligne 343-344 `reelParCibleEtMois.get(cle) ??
 * new Decimal(0)` retombe silencieusement sur 0 quand aucune entree prevue
 * du scenario B ne porte cette cle.
 *
 * PERIMETRE STRICT DE CE FICHIER : detection PURE LECTURE, aucune ecriture
 * d'aucune sorte. `src/lib/previsions/` (moteur pur protege, recette
 * >= 2709/0 ecart) n'est NI modifie NI appele par ce fichier — la detection
 * est faite entierement a partir de `ScenarioPourCalcul` (deja charge par
 * `chargerScenarioPourMoteur`) et des lignes `MappingRapprochement` brutes.
 *
 * ETAT A PART ENTIERE — ne jamais confondre :
 * - `cibleOrpheline: true` : la cible resolue de ce mapping n'existe PAS
 *   dans le referentiel du scenario COURANT. DISTINCT de `NON_RAPPROCHE`
 *   (ADR-053 section 5 : une source reelle sans AUCUN mapping actif — ici,
 *   au contraire, un mapping existe bel et bien, mais sa cible est morte)
 *   et distinct de `cibleIntrouvable`/`cibleNonChargee` du formulaire
 *   d'edition (ERR-177/ERR-178 : ces deux etats distinguent "la cible
 *   n'existe pas" de "la liste des cibles n'a pas pu etre chargee depuis le
 *   reseau" — un probleme de couche UI/reseau. Ce module ne lit QUE la base
 *   directement (aucun risque d'echec reseau), il ne produit donc jamais
 *   l'equivalent de `cibleNonChargee` ; son `cibleOrpheline` correspond
 *   structurellement au meme FAIT que `cibleIntrouvable` (la cible n'existe
 *   pas), mais calcule cote serveur, contre le scenario COURANT, pour
 *   TOUTES les lignes du mapping actif — pas seulement la ligne en cours
 *   d'edition dans un formulaire).
 *
 * R8 : `siteId` filtre sur la lecture du mapping ET sur le chargement du
 * scenario (`chargerScenarioPourMoteur` filtre deja `siteId`).
 */
import { prisma } from "@/lib/db";
import { CibleRapprochement } from "@/types";
import {
  chargerScenarioPourMoteur,
  type ScenarioPourCalcul,
} from "@/lib/queries/previsions-scenario-loader";
import {
  CLE_VENTE_PREVUE_MONTANT,
  CLE_VENTE_PREVUE_TONNAGE,
  CLE_APPORT_CAPITAL,
  parseCibleAlimentPrevision,
} from "@/lib/queries/previsions-rapprochement";

/** Une ligne `MappingRapprochement` deja chargee (forme minimale requise par ce module). */
export interface LigneMappingPourDetectionOrpheline {
  id: string;
  sourceType: string;
  sourceCle: string;
  cibleType: CibleRapprochement | string;
  cibleId: string | null;
}

/**
 * Une ligne de mapping augmentee de son etat orphelin, calcule contre le
 * scenario COURANT (jamais contre le scenario d'origine du mapping, qui
 * n'est de toute facon pas trace — `MappingRapprochement` est SITE-scope).
 */
export interface LigneMappingAvecOrphelinite extends LigneMappingPourDetectionOrpheline {
  /**
   * Cle-cible resolue dans le referentiel du scenario COURANT. `null` si
   * `cibleType` ne porte structurellement aucune cible (`VENTE_PREVUE`,
   * `NON_RAPPROCHE`) OU si la resolution echoue (ex. ALIMENT_PREVISION dont
   * la tailleGranule n'existe pas dans le scenario courant).
   */
  cibleCleResolue: string | null;
  /**
   * true SSI `cibleType` exige structurellement une cible
   * (`POSTE_PREVISION`/`ALIMENT_PREVISION`) ET que la cle resolue
   * n'appartient PAS a l'ensemble des cles valides du scenario courant
   * (`construireClesCiblesValidesDuScenario`). JAMAIS `true` pour
   * `VENTE_PREVUE`/`NON_RAPPROCHE` (aucune cible a evaluer).
   */
  cibleOrpheline: boolean;
}

/** Les deux `CibleRapprochement` qui exigent structurellement une cible resolvable. */
const TYPES_CIBLE_AVEC_RESOLUTION: ReadonlySet<CibleRapprochement | string> = new Set([
  CibleRapprochement.POSTE_PREVISION,
  CibleRapprochement.ALIMENT_PREVISION,
]);

/**
 * Construit l'ensemble des `cle` d'entreesPrevues valides pour un scenario
 * COURANT deja charge (`ScenarioPourCalcul`) — miroir EXACT des `cle`
 * produites par `construireEntreesPrevuesDepuisScenario`
 * (`src/lib/queries/previsions-rapprochement.ts`), sans jamais appeler cette
 * fonction ni le moteur (elle exige une `ProjectionScenarioResult` deja
 * calculee, hors de portee et hors de besoin ici : seule l'EXISTENCE d'une
 * cle est necessaire, pas sa valeur prevue).
 */
export function construireClesCiblesValidesDuScenario(scenario: ScenarioPourCalcul): Set<string> {
  const cles = new Set<string>();
  for (const poste of scenario.postes) {
    cles.add(poste.id);
  }
  for (const aliment of scenario.aliments) {
    cles.add(aliment.id);
  }
  cles.add(CLE_VENTE_PREVUE_MONTANT);
  cles.add(CLE_VENTE_PREVUE_TONNAGE);
  cles.add(CLE_APPORT_CAPITAL);
  return cles;
}

/**
 * Resout la cle-cible d'UNE ligne de mapping dans le referentiel du
 * scenario COURANT — fonction PURE, aucune I/O (le scenario est deja
 * charge par l'appelant).
 *
 * - `POSTE_PREVISION` : `cibleId` litteral. `MappingRapprochement` reste
 *   SITE-scope pour les postes (correction structurelle reportee, story
 *   A.4 hors perimetre de ce sprint — `PostePrevision.libelle` est un texte
 *   libre sans cle metier stable) : aucune resolution dynamique possible,
 *   la cle resolue EST le `cibleId` stocke, verifiee telle quelle contre le
 *   scenario courant.
 * - `ALIMENT_PREVISION` : `cibleId` compose `tailleGranule::id` (story A.3,
 *   `src/lib/queries/previsions-rapprochement.ts`). Resolution DYNAMIQUE
 *   via la tailleGranule (cle metier stable, `@@unique([scenarioId,
 *   tailleGranule])`) vers l'`AlimentPrevision` du scenario COURANT —
 *   jamais via l'id d'origine, qui appartient potentiellement a un autre
 *   scenario.
 * - `VENTE_PREVUE` / `NON_RAPPROCHE` : aucune cible a resoudre, `null`.
 */
export function resoudreCibleCleDuScenarioCourant(
  ligne: LigneMappingPourDetectionOrpheline,
  scenario: ScenarioPourCalcul
): string | null {
  switch (ligne.cibleType) {
    case CibleRapprochement.POSTE_PREVISION:
      return ligne.cibleId;
    case CibleRapprochement.ALIMENT_PREVISION: {
      const { tailleGranule } = parseCibleAlimentPrevision(ligne.cibleId);
      if (tailleGranule === null) return null;
      const aliment = scenario.aliments.find((a) => a.tailleGranule === tailleGranule);
      return aliment?.id ?? null;
    }
    default:
      return null;
  }
}

/**
 * Filet de securite (story A.1) : augmente une liste de lignes de mapping
 * DEJA CHARGEE avec l'etat `cibleOrpheline`, calcule contre le scenario
 * COURANT deja charge. Fonction PURE (aucune I/O ici — les deux arguments
 * sont deja charges par l'appelant), reutilisable independamment de la
 * source du mapping (actif, ou une version precise via
 * `getMappingParVersion`).
 */
export function detecterCiblesOrphelines(
  lignes: LigneMappingPourDetectionOrpheline[],
  scenario: ScenarioPourCalcul
): LigneMappingAvecOrphelinite[] {
  const clesValides = construireClesCiblesValidesDuScenario(scenario);

  return lignes.map((ligne) => {
    const exigeUneCible = TYPES_CIBLE_AVEC_RESOLUTION.has(ligne.cibleType);
    const cibleCleResolue = exigeUneCible ? resoudreCibleCleDuScenarioCourant(ligne, scenario) : null;
    const cibleOrpheline = exigeUneCible && (cibleCleResolue === null || !clesValides.has(cibleCleResolue));
    return { ...ligne, cibleCleResolue, cibleOrpheline };
  });
}

/**
 * Point d'entree pratique (route API d'administration du mapping) : charge
 * le mapping ACTIF du site et le scenario COURANT (par id), puis applique
 * `detecterCiblesOrphelines`. R8 : `siteId` filtre sur la lecture du mapping
 * ET sur le chargement du scenario.
 *
 * @throws si le scenario est introuvable pour ce site (meme comportement
 *   que `chargerScenarioPourMoteur`, propage tel quel).
 */
export async function detecterCiblesOrphelinesDuMappingActif(
  scenarioId: string,
  siteId: string
): Promise<LigneMappingAvecOrphelinite[]> {
  const [scenario, mapping] = await Promise.all([
    chargerScenarioPourMoteur(scenarioId, siteId),
    prisma.mappingRapprochement.findMany({
      where: { siteId, actif: true },
      orderBy: [{ sourceType: "asc" }, { sourceCle: "asc" }],
    }),
  ]);
  return detecterCiblesOrphelines(mapping, scenario);
}
