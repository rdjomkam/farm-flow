/**
 * src/components/previsions/projection-types.ts
 *
 * Types locaux pour la projection produite par `calculerProjectionScenario`
 * (`src/lib/previsions/route-orchestration.ts`), APRES conversion
 * `Decimal -> number` a la frontiere Server -> Client (Sprint PR2, story
 * PR2.4). Documente la meme forme que celle serialisee par
 * `GET /api/previsions/scenarios/[id]/calculer` (voir
 * docs/analysis/pre-analysis-story-PR2.4.md, section 1.1) — mais cette
 * page NE fait PAS de `fetch` vers cette route : le Server Component
 * (`previsions-scenario-detail-page.tsx`) appelle `calculerProjectionScenario`
 * directement (patron impose par la pre-analyse, section 6) et convertit
 * chaque `Decimal` du moteur en `number` avant de passer les props au
 * Client Component (un `Decimal` ne traverse pas cette frontiere).
 *
 * Distinct de `api-types.ts` (perimetre PR2.3, DTOs des routes CRUD) : ce
 * fichier ne duplique aucun type existant, il documente uniquement la
 * forme de la projection consommee par le tableau de bord et la vue
 * mensuelle.
 */
import type { StatutVaguePrevue } from "@/types";

export interface LogistiqueMoisDTO {
  voyagesAliments: number;
  voyagesPoissons: number;
  voyagesAlevins: number;
  sousTotalFCFA: number;
}

export interface MoisProjectionDTO {
  moisAbsolu: number;
  revenusFCFA: number;
  coutAlimentsFCFA: number;
  coutAlevinsFCFA: number;
  baseRepartitionFCFA: number;
  investissementsFCFA: number;
  depensesFCFA: number;
  apportsFCFA: number;
  /** `revenusFCFA + apportsFCFA - depensesFCFA` (story PR2q.2). */
  resultatFCFA: number;
  /** `calculerEpargne(resultatFCFA, tauxEpargnePct)` (story PR2q.2), toujours >= 0. */
  epargneFCFA: number;
  /** Tresorerie CUMULEE a ce mois — c'est LA courbe a tracer. */
  soldeFCFA: number;
  /** Story PR2q.3 — miroir des accumulateurs ajoutes a `MoisProjectionResult` (route-orchestration.ts), memes lignes 4-10/24 du classeur. */
  empoissonneKg: number;
  ventesKg: number;
  alevinsACommanderNb: number;
  besoinAlimentsTotalKg: number;
  sacsAlimentsTotal: number;
  /** Cle = `TailleGranule` (ex. "G1") — seules les granulometries reellement utilisees par ce scenario apparaissent. */
  sacsParGranulometrie: Record<string, number>;
  /**
   * Story PR2sex.2 — sacs CONSOMMES (ROUND, indicatif), jamais les sacs A
   * ACHETER (CEIL) de `sacsParGranulometrie` ci-dessus. Cle EXTERIEURE =
   * position dans le cycle (entier generique 1..dureeCycleMois, jamais
   * moisCycle1/2/3 fige), cle INTERIEURE = `TailleGranule`. Miroir de
   * `MoisProjectionResult.detailParVagueSacs` (route-orchestration.ts).
   */
  detailParVagueSacs: Record<number, Record<string, number>>;
  logistique: LogistiqueMoisDTO;
}

export interface AlimentParVagueEtMoisDTO {
  alimentPrevisionId: string;
  moisCycle: number;
  moisAbsolu: number;
  quantiteKg: number;
  sacs: number;
  montantFCFA: number;
}

export interface VagueProjectionDTO {
  vaguePrevueId: string;
  code: string;
  statut: StatutVaguePrevue;
  moisStockageAbsolu: number;
  moisRecolteAbsolu: number;
  coutAlimentFCFA: number;
  coutAlevinsFCFA: number;
  quotePartChargesFCFA: number;
  coutProductionFCFA: number;
  revenuPrevuFCFA: number;
  biomasseKg: number;
  alimentsParMois: AlimentParVagueEtMoisDTO[];
}

export interface PointBasDTO {
  pointBasFCFA: number;
  moisAbsolu: number;
}

export interface BudgetTotalPlanDTO {
  totalCoutsProductionFCFA: number;
  totalChargesHorsProductionFCFA: number;
  totalApportsFCFA: number;
  budgetTotalFCFA: number;
}

export interface ProjectionScenarioDTO {
  horizonMois: number;
  mois: MoisProjectionDTO[];
  vagues: VagueProjectionDTO[];
  pointBas: PointBasDTO | null;
  budget: BudgetTotalPlanDTO;
}
