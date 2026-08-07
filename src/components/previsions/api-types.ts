/**
 * src/components/previsions/api-types.ts
 *
 * Types locaux pour les reponses des routes API `/api/previsions/*`
 * consommees par les ecrans de la story PR2.3. Ne duplique PAS
 * `src/types/models.ts` (miroir Prisma, proprietaire @architect) : ce
 * fichier documente la forme REELLE qui traverse le fil JSON, telle que
 * produite par les routes de PR2.2 (`NextResponse.json(scenario)` sur
 * l'objet Prisma brut pour la plupart des routes).
 *
 * Champs `Decimal` Prisma : serialises via `Prisma.Decimal.toJSON()` =
 * `.toString()` (decimal.js), donc une STRING cote JSON, pas un `number` —
 * malgre la convention `Decimal -> number` documentee dans
 * `src/types/models.ts` (qui decrit la forme TS souhaitee, pas
 * necessairement ce qui traverse le fil aujourd'hui pour CE module, cf.
 * `decimal-io.ts` qui reserve la conversion explicite aux queries qui
 * "alimentent une route API" — non generalise a toutes les routes de
 * PR2.2). Tous les champs Decimal sont donc types `number | string` ici, et
 * TOUJOURS lus via les formatteurs de `format-previsions.ts` (qui coercent),
 * jamais par arithmetique directe sur la valeur brute.
 */
import type {
  StatutScenarioPrevision,
  StatutVaguePrevue,
  TypePostePrevision,
  CategorieJournalPrevu,
  TypeApportCapital,
  TailleGranule,
} from "@/types";

/** Decimal Prisma serialise (string sur le fil) ou deja converti (number). */
export type Dec = number | string;

export interface ParametresPrevisionDTO {
  id: string;
  scenarioId: string;
  effectifAlevinsParVague: number;
  margeSecuriteAlevinsPct: Dec;
  poidsMoyenInitialG: Dec;
  poidsObjectifG: Dec;
  prixAlevinUnitaireFCFA: Dec;
  prixVenteKgFCFA: Dec;
  nombreBacsSimultanesCible: number;
  frequenceStockageMois: Dec;
  capaciteTransportAlimentsSacs: number | null;
  coutTransportAlimentsFCFA: Dec | null;
  capaciteTransportPoissonsKg: number | null;
  coutTransportPoissonsFCFA: Dec | null;
  capaciteTransportAlevinsNb: number | null;
  coutTransportAlevinsFCFA: Dec | null;
  /** Story PR2q.2 — echelle 0..100, cf. src/types/models.ts. */
  tauxEpargnePct: Dec;
  /** ADR-053 §14 / ERR-170 — defaut applique a la creation des VaguePrevue */
  alevinsAchetesParDefaut: boolean;
  tresorerieInitialeFCFA: Dec;
}

export interface PalierRemiseDTO {
  id: string;
  scenarioId: string;
  seuilTonnes: Dec;
  pourcentageRemise: Dec;
  ordre: number;
  siteId: string;
}

export interface ScenarioParentInfoDTO {
  id: string;
  nom: string;
  code: string;
}

export interface ScenarioPrevisionSummaryDTO {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  dureeCycleMois: number;
  dateDebutPlan: string;
  statut: StatutScenarioPrevision;
  userId: string;
  siteId: string;
  createdAt: string;
  updatedAt: string;
  scenarioParentId: string | null;
  scenarioParent: ScenarioParentInfoDTO | null;
}

export interface ScenarioPrevisionDetailDTO extends ScenarioPrevisionSummaryDTO {
  parametres: ParametresPrevisionDTO | null;
  paliersRemise: PalierRemiseDTO[];
  /**
   * ADR-053 §18 — signal explicite du nombre de calibres d'aliment copies a
   * la creation du scenario (`AlimentPrevision` cree dans la transaction de
   * `createScenario`). Toujours present sur une reponse de creation reussie
   * (jamais `undefined`) : `0` est une valeur legitime distincte d'une
   * absence de champ, exactement la distinction qu'ERR-173/ERR-185 exigent
   * — ne PAS confondre "0 calibre cree, information connue" avec "champ pas
   * encore charge". Deux cas legitimes produisent `0` : `produitIds: []`
   * fourni explicitement (arbitrage c), OU aucun produit ALIMENT actif sur
   * le site quand `produitIds` est absent (§18, troisieme cas invisible
   * corrige). L'UI DOIT afficher un message explicite quand cette valeur
   * est `0` ("scenario cree sans calibre d'aliment — a saisir manuellement
   * ensuite"), jamais un silence. Alimente par `_count.aliments`
   * sur le `findUniqueOrThrow` de `createScenario`
   * (`src/lib/queries/previsions-scenarios.ts`).
   */
  nombreCalibresAlimentsCrees: number;
}

export interface RepartitionMoisAlimentDTO {
  id: string;
  alimentPrevisionId: string;
  moisCycle: number;
  pourcentage: Dec;
  siteId: string;
}

/**
 * Le CALIBRE d'aliment previsionnel — porte desormais directement les champs
 * d'article (fusion `AlimentArticlePrevision` -> `AlimentPrevision`, ADR-053
 * §12.1/§12.3 amendement post-PR2-quater) : chaque calibre correspond a
 * exactement UN article/produit, plus de sous-liste `articles[]` ni de
 * `partApprovisionnementPct` (toujours 100% implicite, plus jamais un champ).
 */
export interface AlimentPrevisionDTO {
  id: string;
  scenarioId: string;
  tailleGranule: TailleGranule;
  sacsParTonneStandard: Dec | null;
  produitId: string | null;
  libelle: string;
  poidsSacKg: Dec;
  prixSacFCFA: Dec;
  sacsParTonneUnitaire: Dec;
  ordre: number;
  siteId: string;
  repartitions: RepartitionMoisAlimentDTO[];
}

export interface AlimentParVaguePrevueDTO {
  id: string;
  vaguePrevueId: string;
  alimentPrevisionId: string;
  moisCycle: number;
  sacsCalcules: number;
  sacsSaisis: number | null;
  quantiteKgCalculee: Dec;
  coutCalculeFCFA: Dec;
  siteId: string;
}

export interface JournalDepensePrevueDTO {
  id: string;
  scenarioId: string;
  date: string;
  libelle: string;
  categorie: CategorieJournalPrevu;
  montantFCFA: Dec;
  vaguePrevueId: string | null;
  siteId: string;
}

export interface VaguePrevueListItemDTO {
  id: string;
  scenarioId: string;
  code: string;
  dateStockagePrevue: string;
  effectifAlevinsPrevu: number;
  poidsMoyenInitialG: Dec;
  dureeCycleMoisFigee: number;
  statut: StatutVaguePrevue;
  vaguePrevueParentId: string | null;
  siteId: string;
  /** false = production interne (cout d'achat gate a 0), true = alevins achetes (ADR-053 §14 / ERR-170) */
  alevinsAchetes: boolean;
  alimentsParMois?: AlimentParVaguePrevueDTO[];
}

export interface VagueReelleLieeDTO {
  id: string;
  code: string;
  statut: string;
}

/**
 * Vague reelle candidate au rattachement (selecteur du plan des vagues).
 * `vaguePrevueId` (gap mineur signale par la pre-analyse PR2.3 §4, comble
 * dans cette story — `src/types/api.ts` `VagueSummaryResponse` et
 * `src/lib/queries/vagues.ts` `getVagues`) permet de griser/exclure cote
 * client les vagues deja rattachees a une AUTRE VaguePrevue, sans attendre
 * un rejet tardif a la soumission.
 */
export interface VagueCandidateDTO {
  id: string;
  code: string;
  statut: string;
  vaguePrevueId: string | null;
}

export interface VaguePrevueDetailDTO extends VaguePrevueListItemDTO {
  alimentsParMois: AlimentParVaguePrevueDTO[];
  journal: JournalDepensePrevueDTO[];
  vague: VagueReelleLieeDTO | null;
  enfantsScission: VaguePrevueListItemDTO[];
}

/**
 * PostePrevisionDTO — poste de charge SCENARIO-scope (ADR-053 §3.8).
 *
 * `posteReferentielId`/`posteReferentiel` (ADR-053 §16, story A.5) : le
 * rattachement au referentiel SITE-scope doit etre visible PARTOUT ou ce
 * DTO est affiche (exigence A de la story A.5 — contrepartie du libelle
 * scenario-local pre-rempli mais editable independamment). `libelle`
 * ci-dessous reste le texte propre au scenario (peut diverger de
 * `posteReferentiel.libelle`) ; ne JAMAIS fusionner silencieusement les
 * deux textes — cf. `libelleDivergeDuReferentiel` (`src/lib/previsions/
 * poste-rattachement.ts`) et la regle de signalisation ADR-053 §16.12.
 *
 * `posteReferentielId` est NOT NULL en base depuis la migration
 * `20260805120000_add_poste_referentiel` : ce sous-objet n'est jamais
 * optionnel ici — un `PostePrevisionDTO` sans `posteReferentiel` est un bug
 * de mapping SSR/API, pas un etat metier legitime (charge via `include`
 * cible dans la meme requete Prisma, jamais un second aller-retour reseau).
 */
export interface PostePrevisionDTO {
  id: string;
  scenarioId: string;
  libelle: string;
  type: TypePostePrevision;
  inclusBaseRepartition: boolean;
  ordre: number;
  actif: boolean;
  siteId: string;
  posteReferentielId: string;
  posteReferentiel: {
    libelle: string;
    actif: boolean;
  };
}

/**
 * PosteReferentielDTO — entree site-scopee du referentiel des postes
 * (ADR-053 §16, story A.4). Consommee par `mapping-form-dialog.tsx` et
 * `rapprochement-mapping-tab.tsx` pour la cible `POSTE_PREVISION` — remplace
 * la liste scenario-scopee `PostePrevisionDTO`, source du defaut ERR-179
 * (une cible qui devient orpheline des qu'un nouveau scenario est cree ou
 * l'ancien supprime). Depuis la story A.5 (§16.12), egalement consommee par
 * l'ecran d'administration `/previsions/postes-referentiel`
 * (`PATCH`/renommage, `POST .../desactiver`/`.../reactiver`).
 */
export interface PosteReferentielDTO {
  id: string;
  siteId: string;
  code: string;
  libelle: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Nombre de `PostePrevision` rattaches a cette entree (tous scenarios du
   * site confondus) — decompte relationnel natif (`_count`), FK reelle
   * `PostePrevision.posteReferentielId`. Non optionnel : voir ERR-188 (un
   * champ de decompte optionnel n'est qu'un silence organise). Renvoye par
   * `listerPostesReferentielAdmin` ET par les trois mutations (renommer/
   * desactiver/reactiver, via le helper prive `getPosteReferentielAdmin`,
   * y compris leurs retours idempotents) — ADR-053 §16, reserve PR2non.3/R3.
   * Jamais renvoye par `listerPostesReferentielActifs` (route "actifs seuls",
   * consommee par `poste-form-dialog.tsx`/`rapprochement-mapping-tab.tsx` —
   * ces deux ecrans ne lisent pas ces deux champs aujourd'hui).
   */
  nbPostesRattaches: number;
  /**
   * Nombre de `MappingRapprochement` ACTIFS ciblant cette entree
   * (`cibleType = POSTE_PREVISION`) — decompte par agregation (`groupBy`),
   * `cibleId` n'etant pas une FK Prisma (ADR-053 §16.3). Non optionnel,
   * meme justification que `nbPostesRattaches`.
   */
  nbMappingsRattaches: number;
}

/**
 * Forme reellement produite par `GET /api/previsions/postes-referentiel`
 * (route "actifs seuls", `listerPostesReferentielActifs`) — PR2non.3/R3,
 * resorption de la reserve R3 signalee en review.
 *
 * Ce n'est PAS un oubli : ADR-053 §16.12 pose la distinction actifs/admin
 * comme VOLONTAIRE, et `listerPostesReferentielActifs` ne calcule pas les
 * decomptes `nbPostesRattaches`/`nbMappingsRattaches` (cout de 2 requetes
 * supplementaires sur un chemin de simple SELECTION, sans usage d'affichage
 * pour ces decomptes). `PosteReferentielDTO` restait pourtant non optionnel
 * sur ces deux champs pour CE producteur — un mensonge de contrat (ERR-188,
 * la meme famille de defaut qui s'est deja materialisee une fois dans ce
 * module) que `tsc` ne pouvait pas detecter puisque les deux champs
 * n'etaient jamais lus par les consommateurs de cette route.
 *
 * Utilise par les DEUX consommateurs de la route "actifs seuls" :
 * `poste-form-dialog.tsx` et `rapprochement-mapping-tab.tsx`. NE PAS
 * utiliser pour `listerPostesReferentielAdmin` ni pour les trois routes de
 * mutation (renommer/desactiver/reactiver) : celles-ci produisent bien les
 * deux decomptes et restent typees `PosteReferentielDTO`.
 */
export type PosteReferentielOptionDTO = Omit<
  PosteReferentielDTO,
  "nbPostesRattaches" | "nbMappingsRattaches"
>;

/**
 * Payload de `PATCH /api/previsions/postes-referentiel/[id]` (ADR-053
 * §16.12, story A.5). `libelle` uniquement — `code` reste FIGE a sa valeur
 * d'origine, jamais expose en ecriture par cette route (voir justification
 * ADR-053 §16.12 "Arbitrage 1").
 */
export interface RenommerPosteReferentielDTO {
  libelle: string;
}

/**
 * Payload de `POST /api/previsions/scenarios/[id]/postes` (ADR-053 §16.6/
 * §16.10 ACTIVES par la story A.5, "Contrat des routes" §16.12). Remplace le
 * contrat historique `{ libelle, type, inclusBaseRepartition, ordre }` —
 * `posteReferentielId` XOR `nouveauPosteReferentielLibelle` est desormais
 * OBLIGATOIRE (exactement l'un des deux, jamais les deux, jamais aucun des
 * deux, 400 sinon). `libelle` reste requis, JAMAIS derive silencieusement
 * cote serveur (voir ADR-053 §16.12 "libelle : requis, jamais derive") — le
 * client le pre-remplit depuis le referentiel (branche a) ou depuis le texte
 * de creation (branche b), et l'utilisateur peut l'editer avant envoi.
 */
export type CreatePostePrevisionRequestDTO = {
  libelle: string;
  type: TypePostePrevision;
  inclusBaseRepartition?: boolean;
  ordre: number;
} & (
  | { posteReferentielId: string; nouveauPosteReferentielLibelle?: never }
  | { nouveauPosteReferentielLibelle: string; posteReferentielId?: never }
);

/**
 * Reponse 201 de `POST /api/previsions/scenarios/[id]/postes` (ADR-053
 * §16.12). `reutilise` reflete la branche empruntee (`true` = branche (a),
 * selection explicite d'une entree existante ; `false` = branche (b), une
 * nouvelle entree a ete creee) — PLUS un signal de reutilisation SILENCIEUSE
 * (ce comportement disparait avec le contrat XOR, voir ADR-053 §16.12 "Ce
 * que devient le get-or-create silencieux de §16.11"), seulement un reflet
 * du choix deja fait explicitement par l'utilisateur, utile pour un message
 * de confirmation coherent.
 */
export interface CreatePostePrevisionResponseDTO extends PostePrevisionDTO {
  reutilise: boolean;
}

/**
 * Codes machine stables (`ApiErrorResponse.code`) pour le contrat XOR de
 * `POST /api/previsions/scenarios/[id]/postes` (ADR-053 §16.12). Le client
 * DOIT mapper ces codes vers des cles i18n locales (`posteForm.errors.*`,
 * namespace `previsions`) et ne JAMAIS rendre `ApiErrorResponse.message` brut
 * pour ces cas precis — c'est la premiere fois que ce contrat exige un texte
 * bilingue fr/en, alors que les messages serveur historiques de ce module
 * restent en francais uniquement (ecart documente et assume, ADR-053 §16.12
 * "i18n").
 */
export const POSTE_REFERENTIEL_ERROR_CODES = {
  CHAMPS_EXCLUSIFS: "POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS", // 400 — les deux champs XOR fournis
  CHAMP_REQUIS: "POSTE_REFERENTIEL_CHAMP_REQUIS", // 400 — aucun des deux champs XOR fourni
  INTROUVABLE: "POSTE_REFERENTIEL_INTROUVABLE", // 404 — posteReferentielId absent/autre site
  INACTIF: "POSTE_REFERENTIEL_INACTIF", // 409 — entree cible desactivee (branche a OU b)
  CODE_COLLISION: "POSTE_REFERENTIEL_CODE_COLLISION", // 409 — slug de nouveauPosteReferentielLibelle
  // deja pris par une entree active du site (branche b) — synchrone OU issu d'une course
  // concurrente (P2002), jamais une reutilisation silencieuse (ADR-053 §16.12 "Concurrence").
} as const;

/**
 * Payload enrichi porte par `ApiErrorResponse.details` pour les 409
 * `POSTE_REFERENTIEL_CODE_COLLISION`/`POSTE_REFERENTIEL_INACTIF` (branche
 * "creer") — permet a l'UI de proposer directement "Lier celle-ci" sans
 * round-trip reseau supplementaire (ADR-053 §16.12, "Payload du 409 de
 * collision"). Extension GENERIQUE de `ApiErrorResponse` (`src/types/api.ts`),
 * pas un champ reserve a ce seul cas d'usage.
 */
export interface PosteReferentielExistantDetailsDTO {
  posteReferentielExistant: {
    id: string;
    libelle: string;
  };
}

export interface ChargeMensuellePrevueDTO {
  id: string;
  scenarioId: string;
  posteId: string;
  moisAbsolu: number;
  montantFCFA: Dec;
  siteId: string;
}

export interface ApportCapitalDTO {
  id: string;
  scenarioId: string;
  date: string;
  libelle: string;
  montantFCFA: Dec;
  type: TypeApportCapital;
  actif: boolean;
  siteId: string;
}

/** Modes de generation en masse du plan d'empoissonnement (story PR2bis.2). */
export type ModeGenerationPlanDTO = "ajouter" | "remplacer";

/**
 * Reponse de `GET .../vagues/generer` (dry-run, lecture pure) — decompte
 * chiffre affiche AVANT toute confirmation (arbitrage PM, story PR2bis.2) :
 * jamais un ajout/remplacement silencieux.
 */
export interface ApercuGenerationPlanDTO {
  horizonMois: number;
  mode: ModeGenerationPlanDTO;
  nombreVaguesRattacheesConservees: number;
  nombreVaguesAnnuleesEtRemplacees: number;
  nombreNouvellesVagues: number;
  premiereDateStockagePrevue: string | null;
  derniereDateStockagePrevue: string | null;
  codesGeneres: string[];
}

/** Reponse d'erreur 409 specifique au flux de scission (ADR-053 decision 2). */
export interface VaguePrevueDejaRattacheeError {
  status: 409;
  message: string;
  code: "VAGUE_PREVUE_DEJA_RATTACHEE";
  vaguePrevueId: string;
}

export function estErreurVaguePrevueDejaRattachee(
  data: unknown
): data is VaguePrevueDejaRattacheeError {
  return (
    data !== null &&
    typeof data === "object" &&
    (data as { code?: unknown }).code === "VAGUE_PREVUE_DEJA_RATTACHEE"
  );
}
