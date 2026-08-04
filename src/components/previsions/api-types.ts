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
}

export interface PalierRemiseDTO {
  id: string;
  scenarioId: string;
  seuilTonnes: Dec;
  pourcentageRemise: Dec;
  ordre: number;
  siteId: string;
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
}

export interface ScenarioPrevisionDetailDTO extends ScenarioPrevisionSummaryDTO {
  parametres: ParametresPrevisionDTO | null;
  paliersRemise: PalierRemiseDTO[];
}

export interface RepartitionMoisAlimentDTO {
  id: string;
  alimentPrevisionId: string;
  moisCycle: number;
  pourcentage: Dec;
  siteId: string;
}

/**
 * Un ARTICLE d'un calibre d'aliment previsionnel (ADR-053 §12.3, amendement
 * Sprint PR2-quater).
 */
export interface AlimentArticlePrevisionDTO {
  id: string;
  alimentCalibrePrevisionId: string;
  produitId: string | null;
  libelle: string;
  poidsSacKg: Dec;
  prixSacFCFA: Dec;
  sacsParTonneUnitaire: Dec;
  partApprovisionnementPct: Dec;
  ordre: number;
  siteId: string;
}

/**
 * Le CALIBRE d'aliment previsionnel — ne porte plus `produitId`/`libelle`/
 * `poidsSacKg`/`prixSacFCFA`/`sacsParTonneUnitaire` (deplaces vers
 * `articles`, ADR-053 §12.1/§12.3, amendement Sprint PR2-quater).
 */
export interface AlimentPrevisionDTO {
  id: string;
  scenarioId: string;
  tailleGranule: TailleGranule;
  sacsParTonneStandard: Dec | null;
  ordre: number;
  siteId: string;
  repartitions: RepartitionMoisAlimentDTO[];
  /** un ou plusieurs articles (marques/conditionnements) — cas nominal : un seul, a 100% (ADR-053 §12.6) */
  articles: AlimentArticlePrevisionDTO[];
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

export interface PostePrevisionDTO {
  id: string;
  scenarioId: string;
  libelle: string;
  type: TypePostePrevision;
  inclusBaseRepartition: boolean;
  ordre: number;
  siteId: string;
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
