/**
 * src/lib/queries/previsions-tresorerie-trois-series.ts
 *
 * Query d'orchestration — vue tresorerie a TROIS SERIES (ADR-053 §6.5 des
 * exigences fonctionnelles, amendement §15.1(b)/§15.2/§15.7/§15.8, Sprint
 * PR3-ter, story B.3).
 *
 * ROLE STRICT : assemble trois series DEJA calculees ailleurs, alignees par
 * `moisAbsolu` sur l'horizon COMPLET du scenario — ce fichier NE RECALCULE
 * AUCUN montant, il lit/combine :
 * - **BUDGET INITIAL** — LU depuis `SnapshotBudgetInitial`
 *   (`src/lib/queries/previsions-snapshot-budget.ts`, `getSnapshotBudgetInitial`),
 *   la ligne `categorie = CATEGORIE_TRESORERIE_SOLDE`, `posteId = null` —
 *   JAMAIS RECALCULE A LA VOLEE. Un scenario jamais active n'a aucune ligne
 *   de ce type : `budgetInitialFCFA` vaut alors `null` sur TOUS les mois
 *   (distinct d'un budget fige a 0 — meme discipline null-vs-0 qu'ERR-173,
 *   appliquee ici a l'echelle de la serie plutot que de la ligne).
 * - **PRÉVISION ACTUALISÉE** — `calculerProjectionScenario` (le moteur de
 *   production, sans filtre de date), `MoisProjectionResult.soldeFCFA`
 *   (deja cumule par le moteur). Recalculee A CHAQUE APPEL — ADR-053 §15.2 :
 *   "l'etat courant du scenario, recalcule a la demande". DISTINCTE de la
 *   Reprevision (voir ci-dessous, ADR-053 §15.2 dernier paragraphe).
 * - **RÉEL** — `calculerRapprochementScenario` (queries reel + moteur pur
 *   `reconcilierPrevuEtReel`), nette et cumule via
 *   `netterTresorerieReelleCumulee`/`netterTresorerieReelleParMois`
 *   (`src/lib/previsions-presentation/tresorerie-reelle-nette.ts`, story
 *   B.1). Les mois SANS aucune ligne reelle nettable recoivent un DELTA 0
 *   (JAMAIS omis de la serie) — directive explicite du JSDoc de
 *   `netterTresorerieReelleParMois` : "a l'appelant d'inserer les mois
 *   absents a 0 si l'horizon complet doit etre affiche". Le cumul REEL est
 *   donc TOUJOURS defini sur tout l'horizon (jamais `null`), a la difference
 *   du BUDGET INITIAL (dont l'absence signifie "jamais fige", une notion
 *   distincte de "fige a zero").
 *
 * Plus la serie **Reprevision glissante**
 * (`src/lib/previsions-presentation/reprevision-glissante.ts`, story B.2) :
 * REEL nette sur les mois CLOS (`ClotureMois`), PRÉVISION ACTUALISEE sur les
 * mois non clos — PRÉVISION ACTUALISÉE != Reprevision, deux notions
 * distinctes (ADR-053 §15.2 dernier paragraphe) : NE JAMAIS les confondre
 * dans le nommage ici ni cote UI (B.5).
 *
 * CAVEAT PROPAGE, JAMAIS AVALE (ADR-053 §15.1(b), §15.8(a)) : le domaine
 * reel n'a AUCUN modele pour les apports/subventions/prets reellement
 * encaisses (reporte sine die) — la serie REEL (et donc la Reprevision sur
 * ses mois REEL) est STRUCTURELLEMENT BIAISEE A LA BAISSE des qu'un apport a
 * ete reellement encaisse. `caveatApportsReelsNonModelises`/
 * `caveatSerieReelleIncomplete` sont des litteraux `true` NON FILTRABLES,
 * portes jusqu'au contrat de sortie de cette fonction — a la charge de la
 * route API (B.3) puis de l'UI (B.5) de les afficher, jamais de les avaler
 * en route.
 *
 * ROLE STRICT bis : ce module N'ECRIT JAMAIS dans une table du domaine reel
 * (`Depense`, `Vente`, `MouvementStock`) ni dans `SnapshotBudgetInitial`/
 * `ClotureMois` — uniquement des lectures (ADR-053 §5.1(a)/§15.6).
 */
import { Decimal } from "@/lib/previsions/decimal-config";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import {
  getSnapshotBudgetInitial,
  CATEGORIE_TRESORERIE_SOLDE,
} from "@/lib/queries/previsions-snapshot-budget";
import { getCloturesMois } from "@/lib/queries/previsions-cloture";
import { calculerRapprochementScenario } from "@/lib/queries/previsions-rapprochement";
import {
  netterTresorerieReelleParMois,
  netterTresorerieReelleCumulee,
} from "@/lib/previsions-presentation/tresorerie-reelle-nette";
import {
  construireReprevisionGlissante,
  type MoisReprevisionGlissante,
  type MoisPrevisionActualiseePourFusion,
} from "@/lib/previsions-presentation/reprevision-glissante";

/** Une ligne mensuelle de la vue tresorerie a 3 series, pour un `moisAbsolu` donne. */
export interface MoisTresorerieTroisSeries {
  moisAbsolu: number;
  /**
   * BUDGET INITIAL fige a l'activation — `null` ssi le scenario n'a JAMAIS
   * ete active (`SnapshotBudgetInitial` totalement absent), jamais un 0 qui
   * masquerait cette absence.
   */
  budgetInitialFCFA: Decimal | null;
  /** PRÉVISION ACTUALISÉE — recalculee a la demande, toujours definie. */
  previsionActualiseeFCFA: Decimal;
  /** RÉEL nette, cumule sur tout l'horizon (delta 0 les mois sans ligne reelle) — toujours definie. */
  reelFCFA: Decimal;
  /** Caveat non filtrable (ADR-053 §15.1(b)) — voir JSDoc de module. */
  caveatApportsReelsNonModelises: true;
}

/** Sortie complete de `getTresorerieTroisSeries` pour un scenario. */
export interface TresorerieTroisSeriesResult {
  scenarioId: string;
  /** Meme horizon que `calculerProjectionScenario` — les 3 series et la reprevision couvrent [0, horizonMois). */
  horizonMois: number;
  /**
   * `true` ssi `SnapshotBudgetInitial` porte au moins une ligne pour ce
   * scenario (le scenario a ete active au moins une fois) — permet a l'UI de
   * distinguer "budget initial absent sur ce mois precis" (cas impossible
   * hors extension d'horizon post-activation) de "aucun budget initial
   * n'existe du tout pour ce scenario" (jamais active).
   */
  budgetInitialDisponible: boolean;
  /** Serie triee par `moisAbsolu` croissant, un element par mois de [0, horizonMois). */
  series: MoisTresorerieTroisSeries[];
  /** Reprevision glissante (story B.2) — DISTINCTE de PRÉVISION ACTUALISÉE, voir JSDoc de module. */
  reprevisionGlissante: MoisReprevisionGlissante[];
  /** Caveat non filtrable, propage depuis la Reprevision (meme information que sur chaque `MoisTresorerieTroisSeries`, redondant par construction — jamais a lire comme une nuance supplementaire). */
  caveatSerieReelleIncomplete: true;
  /** Instant du calcul serveur — jamais une photo figee (coherent avec `RapprochementScenarioVue.calculeLe`). */
  calculeLe: Date;
}

/**
 * Assemble la vue tresorerie a 3 series d'un scenario, sur tout son
 * horizon. Orchestration PURE-IO (aucun calcul de fond ici, uniquement
 * lecture + assemblage) — voir JSDoc de module pour le detail de chaque
 * serie et la justification de chaque choix null/0.
 *
 * @throws {Error} "Scenario introuvable" (propage par `chargerScenarioPourMoteur`, R8) — mappe en 404 par `handleApiError` (pattern "introuvable" -> 404).
 */
export async function getTresorerieTroisSeries(
  scenarioId: string,
  siteId: string
): Promise<TresorerieTroisSeriesResult> {
  const calculeLe = new Date();

  const scenario = await chargerScenarioPourMoteur(scenarioId, siteId);
  const projection = calculerProjectionScenario(scenario);
  const horizonMois = projection.horizonMois;

  const [snapshotBudgetInitial, cloturesMois, lignesRapprochement] = await Promise.all([
    getSnapshotBudgetInitial(scenarioId, siteId),
    getCloturesMois(scenarioId, siteId),
    horizonMois > 0
      ? calculerRapprochementScenario(scenarioId, siteId, 0, horizonMois - 1)
      : Promise.resolve([]),
  ]);

  // --- BUDGET INITIAL : lecture stricte, jamais recalculee (voir en-tete). ---
  const budgetInitialParMois = new Map<number, Decimal>();
  for (const ligne of snapshotBudgetInitial) {
    if (ligne.categorie === CATEGORIE_TRESORERIE_SOLDE && ligne.posteId === null) {
      budgetInitialParMois.set(ligne.moisAbsolu, new Decimal(ligne.montantFCFA.toString()));
    }
  }
  const budgetInitialDisponible = budgetInitialParMois.size > 0;

  // --- RÉEL : nette et cumulee via `netterTresorerieReelleCumulee` (story
  // B.1, jamais recalculee ici) — les mois QU'ELLE couvre sont repris tels
  // quels ; les mois qu'elle omet (aucune ligne nettable ce mois-la) sont
  // combles par report du DERNIER cumul connu (directive explicite de son
  // JSDoc : "a l'appelant d'inserer les mois absents a 0" — un cumul qui n'a
  // pas bouge depuis le dernier point connu EST ce 0 de delta, reporte). ---
  const moisReelNetMensuel = netterTresorerieReelleParMois(lignesRapprochement);
  const reelCumuleRefParMois = new Map(
    netterTresorerieReelleCumulee(lignesRapprochement).map((m) => [m.moisAbsolu, m.soldeNetFCFA])
  );
  const reelCumuleParMois = new Map<number, Decimal>();
  let dernierCumulConnu = new Decimal(0);
  for (let m = 0; m < horizonMois; m++) {
    if (reelCumuleRefParMois.has(m)) {
      dernierCumulConnu = reelCumuleRefParMois.get(m) as Decimal;
    }
    reelCumuleParMois.set(m, dernierCumulConnu);
  }

  // --- PRÉVISION ACTUALISÉE : moteur de production, deja cumulee. ---
  const previsionActualiseeParMois = new Map(projection.mois.map((m) => [m.moisAbsolu, m.soldeFCFA]));

  const series: MoisTresorerieTroisSeries[] = [];
  for (let m = 0; m < horizonMois; m++) {
    series.push({
      moisAbsolu: m,
      budgetInitialFCFA: budgetInitialParMois.get(m) ?? null,
      previsionActualiseeFCFA: previsionActualiseeParMois.get(m) ?? new Decimal(0),
      reelFCFA: reelCumuleParMois.get(m) ?? new Decimal(0),
      caveatApportsReelsNonModelises: true,
    });
  }

  // --- Reprevision glissante (story B.2) : DISTINCTE de PRÉVISION ACTUALISÉE. ---
  const moisPrevisionActualiseePourFusion: MoisPrevisionActualiseePourFusion[] = projection.mois.map(
    (m) => ({ moisAbsolu: m.moisAbsolu, resultatFCFA: m.resultatFCFA })
  );
  const moisClotures = new Set(cloturesMois.map((c) => c.moisAbsolu));
  const reprevisionGlissante = construireReprevisionGlissante(
    moisPrevisionActualiseePourFusion,
    moisReelNetMensuel,
    moisClotures
  );

  return {
    scenarioId,
    horizonMois,
    budgetInitialDisponible,
    series,
    reprevisionGlissante,
    caveatSerieReelleIncomplete: true,
    calculeLe,
  };
}
