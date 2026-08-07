/**
 * src/lib/previsions/route-orchestration.ts
 *
 * Orchestration COTE ROUTE (Sprint PR2, story PR2.2 —
 * `GET /api/previsions/scenarios/[id]/calculer`). Ce fichier n'est PAS le
 * moteur teste par la recette (842 tests / 0 ecart, `src/lib/previsions/__tests__/recette`)
 * — il ENCHAINE les fonctions pures deja exportees par le moteur
 * (`aliments.ts`, `charges.ts`, `logistique.ts`, `vague.ts`, `tresorerie.ts`,
 * `budget.ts`) sur l'ensemble d'un scenario complet, pour produire la
 * projection calendaire mensuelle demandee par l'ADR-053 section 4 / §7.2 des
 * exigences. AUCUNE fonction du moteur n'est modifiee ni reimplementee ici —
 * seules des sommes associatives et des conversions d'unite y sont ajoutees.
 *
 * Reference obligatoire avant lecture : docs/analysis/pre-analysis-story-PR2.2.md,
 * section 5 ("La route de calcul — le point le plus delicat").
 *
 * ---------------------------------------------------------------------------
 * GAP 1 — `besoinTotalCycleKg` — CORRIGE (ADR-053, amendement Sprint PR2 §11 ;
 * bug de severite Haute signale par le rapport de tests PR2.2 section 4.1)
 * ---------------------------------------------------------------------------
 * Le schema de production n'a pas de champ "tonnage cible" par `VaguePrevue`
 * (contrairement au jeu d'or, qui le fournit comme une entree litterale,
 * `objectifTonnes`). Deux grandeurs distinctes entrent dans la formule —
 * NE JAMAIS LES CONFONDRE (c'est precisement leur confusion qui a cause le
 * bug d'origine, facteur d'erreur ~8300x) :
 *   - `aliment.sacsParTonneUnitaire` : pur ratio d'unite de poids
 *     (`1000 / poidsSacKg`) — ne DOIT JAMAIS entrer dans ce calcul.
 *   - `aliment.sacsParTonneStandard` : coefficient de besoin en aliment,
 *     sacs de cette granulometrie necessaires par TONNE DE POISSON produit
 *     (8 / 18 / 50 selon la granulometrie dans le jeu d'or) — c'est la
 *     grandeur correcte, `Decimal | null` (nullable = non configure).
 *
 * Formule corrigee (transposition fidele de la recette,
 * `__tests__/recette/orchestration.ts:80`,
 * `objectifTonnes * sacsParTonneStandard * poidsSacKg`) :
 *   tonnageCibleKg   = effectifAlevinsPrevu * poidsObjectifG / 1000
 *                      (biomasse cible en KG, sans facteur de survie explicite
 *                      — ADR-053 decision 4)
 *   tonnageCibleTonnes = tonnageCibleKg / 1000
 *                      (conversion KG -> TONNES : c'est le second defaut,
 *                      compose avec l'homonymie ci-dessus, qui produisait le
 *                      facteur ~1000 residuel)
 *   besoinTotalCycleKg = tonnageCibleTonnes * aliment.sacsParTonneStandard * aliment.poidsSacKg
 *
 * Si `aliment.sacsParTonneStandard` est `null` pour une granulometrie
 * effectivement utilisee par le scenario : rejet EXPLICITE (une
 * `BusinessRuleError(msg, 422)`, `src/lib/errors.ts` — ERR-165, ADR-053
 * §15.4), jamais un defaut silencieux (ADR-053 amendement §11.2, point 2 —
 * meme proscription que le gap historique `dashboard.ts:218`).
 *
 * ---------------------------------------------------------------------------
 * GAP 3 — `margeSecuriteAlevinsPct` jamais lue (ERR-141/ERR-142) — CORRIGE
 * (story PR2bis.3)
 * ---------------------------------------------------------------------------
 * `ParametresPrevision.margeSecuriteAlevinsPct` absorbe la mortalite
 * (ADR-053 decision 4, §4.3 des exigences) : `alevinsACommanderNb =
 * calculerAlevinsACommander(effectifAlevinsPrevu, margeSecuriteAlevinsPct)`
 * (moteur pur, `plan.ts`) — JAMAIS un simple recopiage de l'effectif brut.
 *
 * Distinction D (poissons a vendre) vs E (alevins a commander) — ne jamais
 * confondre, c'est le coeur du fix :
 *   - `tonnageCibleKg()` (besoin en aliment) et `calculerRevenuPrevu` (revenu
 *     previsionnel) restent fondes sur `vague.effectifAlevinsPrevu` (= D,
 *     poissons a vendre a la recolte) — la marge de securite alevins n'a
 *     RIEN a y faire, elle ne concerne QUE l'achat d'alevins au demarrage.
 *   - `coutAlevinsFCFA` et `alevinsNbParMois` (logistique/voyages de
 *     transport des alevins) utilisent `alevinsACommanderNb` (= E) : on
 *     achete et on transporte le nombre d'alevins COMMANDES, marge de
 *     securite incluse, jamais le nombre de poissons vises a la vente.
 *
 * ---------------------------------------------------------------------------
 * GAP 2 — calendrier mensuel de recolte / transport (jamais couvert par les
 * 12 fonctions du moteur, qui operent toutes a l'echelle d'UNE VaguePrevue ou
 * d'un mois de CYCLE, jamais d'un mois CALENDAIRE partage par plusieurs
 * vagues)
 * ---------------------------------------------------------------------------
 * Construit ici :
 *  - date de recolte d'une VaguePrevue = dernier mois de son cycle
 *    (`moisStockageAbsolu + dureeCycleMoisFigee - 1`) ;
 *  - agregation multi-vague par mois calendaire = simple somme (operation
 *    associative, pas une formule metier), suivant exactement le patron de
 *    `__tests__/recette/orchestration.ts` : les KG sont sommes par
 *    (granulometrie, mois calendaire) AVANT d'etre ceiles, puis le ceil est
 *    execute en RAPPELANT `calculerBesoinAlimentMensuel` sur le total deja
 *    agrege (jamais un ceil reimplemente ici, jamais une somme de sacs deja
 *    ceiles individuellement).
 *
 * ---------------------------------------------------------------------------
 * Surcharges manuelles (`AlimentParVaguePrevue.sacsSaisis`) — CORRIGE (bug
 * n2 du rapport de tests PR2.2, docs/tests/rapport-story-PR2.2.md section
 * 4.2)
 * ---------------------------------------------------------------------------
 * ATTENTION HOMONYMIE DE GRAIN, a lire avant de retoucher ce bloc :
 *  - `AlimentParVaguePrevue` est persiste au grain (vaguePrevueId,
 *    alimentPrevisionId, moisCycle) — UNE ligne par mois (ADR-053 section
 *    3.6, `@@unique([vaguePrevueId, alimentPrevisionId, moisCycle])`). Son
 *    `sacsSaisis` est donc une surcharge PAR MOIS.
 *  - `AlimentParVagueMensuelCalcInput.sacsSaisisCycle` (moteur, `aliments.ts`)
 *    attend au contraire un total agrege sur TOUT LE CYCLE (le montant, une
 *    fois remise, est ventile par mois via les pourcentages de
 *    `RepartitionMoisAliment` — voir la JSDoc de
 *    `calculerCoutAlimentGranulometrieParMois`). Il n'existe donc PAS de
 *    correspondance 1:1 entre "une ligne persistee" et "l'entree cycle du
 *    moteur".
 *
 * Regle appliquee ici pour honorer ADR-053 section 3.6
 * (`COALESCE(sacsSaisis, sacsCalcules)` obligatoire dans TOUS les calculs
 * downstream, sans exception pour une route "lecture pure") :
 *  1. Sortie du moteur = `sacsCalcules` (jamais editee directement). Surcharge
 *     humaine = `sacsSaisis`, qui PREVAUT des qu'elle est non-nulle — jamais
 *     un melange entre les deux pour une meme ligne.
 *  2. Par mois de cycle, le sac AFFICHE (`AlimentParVagueEtMoisProjection.sacs`)
 *     est `COALESCE(surchargePersisteeDuMois, besoinBrutCalculeParLeMoteur)`.
 *  3. Le TOTAL DE CYCLE (`sacsEffectifsCycle`, qui pilote le COUT
 *     downstream) est la somme, sur tous les mois du cycle de la vague, de
 *     ce meme `COALESCE` par mois — mais UNIQUEMENT si au moins une
 *     surcharge existe pour cette granulometrie sur cette vague ; si aucune
 *     ligne persistee ne porte de surcharge, `sacsSaisisCycle` reste `null`
 *     (le calcul retombe sur `sacsCalculesCycle`).
 *  3bis. IL NE PILOTE PLUS LA REMISE (story PR2sept.3, ADR-053 §13.3/§13.7,
 *     ERR-143). Le taux de remise est decide UNE SEULE FOIS PAR VAGUE, en
 *     dehors de la boucle sur les granulometries, a partir du seul
 *     `tonnageCibleTonnes` (= `effectifAlevinsPrevu x poidsObjectifG /
 *     1 000 000`, la marge de securite alevins n'y intervient JAMAIS, cf.
 *     GAP 3 ci-dessus), puis applique a tout le cout d'aliment de la vague.
 *     Consequence assumee et voulue (§13.7) : **une surcharge manuelle de
 *     sacs change le MONTANT, jamais le TAUX de remise.** Le §3.6 reste
 *     integralement en vigueur — c'est la liste des calculs dont l'entree
 *     est un nombre de sacs qui s'est reduite, la decision de palier en
 *     etant sortie.
 *  4. `quantiteKg` (par mois) et le calendrier logistique (GAP 2) restent
 *     bases sur le besoin BRUT calcule par le moteur, jamais sur la
 *     surcharge : l'ADR ne demande la surcharge que pour "cout, budget,
 *     tresorerie" (section 3.6), pas pour la quantite physique en kg
 *     projetee.
 *
 * Cette route reste en LECTURE PURE : elle LIT les surcharges deja
 * persistees (`chargerScenarioPourMoteur`, PR2.1, expose deja
 * `VaguePrevuePourCalcul.alimentsParMois[].sacsSaisis` — aucune modification
 * necessaire au loader) mais n'ECRIT jamais dans `AlimentParVaguePrevue` — le
 * seul point d'ecriture de ces lignes reste
 * `PUT /api/previsions/vagues-prevues/[id]/aliments` et
 * `PATCH /api/previsions/aliments-par-vague-prevue/[id]/sacs-saisis`.
 */
import { Decimal } from "./decimal-config";
import { calculerAlevinsACommander } from "./plan";
import {
  calculerBesoinAlimentMensuel,
  determinerPourcentageRemise,
  appliquerTauxRemise,
  apportionnerCoutAlimentMensuel,
  calculerDetailConsommationMensuelle,
} from "./aliments";
import type { AlimentPrevisionCalcInput } from "./types";
import { calculerLogistiqueMensuelle } from "./logistique";
import { calculerBaseRepartition, calculerQuotePartVague } from "./charges";
import type { ChargePourBaseInput, JournalEntryInput } from "./charges";
import { calculerCoutProductionVague, calculerRevenuPrevu } from "./vague";
import { genererSerieTresorerie, calculerPointBasTresorerie, calculerEpargne } from "./tresorerie";
import type { PointBasTresorerieResult } from "./tresorerie";
import { calculerBudgetTotalPlan } from "./budget";
import type { BudgetTotalPlanResult } from "./budget";
import type { ScenarioPourCalcul, VaguePrevuePourCalcul } from "@/lib/queries/previsions-scenario-loader";
import { StatutVaguePrevue, CategorieJournalPrevu } from "@/types";
import { BusinessRuleError } from "@/lib/errors";

/** Index (0-based) du mois calendaire de `date` par rapport a `dateDebutPlan`. */
export function moisAbsoluDepuis(dateDebutPlan: Date, date: Date): number {
  return (
    (date.getFullYear() - dateDebutPlan.getFullYear()) * 12 +
    (date.getMonth() - dateDebutPlan.getMonth())
  );
}

export interface AlimentParVagueEtMoisProjection {
  alimentPrevisionId: string;
  moisCycle: number;
  moisAbsolu: number;
  /** Besoin brut calcule par le moteur (jamais surcharge) — voir `sacs`. */
  quantiteKg: Decimal;
  /**
   * `COALESCE(surchargePersisteeDuMois, besoinBrutCalculeParLeMoteur)` — la
   * surcharge manuelle deja persistee (`AlimentParVaguePrevue.sacsSaisis`
   * pour ce mois de cycle exact) PREVAUT des qu'elle est non-nulle,
   * conformement a ADR-053 section 3.6. `montantFCFA` reflete la meme
   * priorite au niveau agrege du cycle (voir en-tete de fichier).
   */
  sacs: number;
  montantFCFA: Decimal;
}

export interface VagueProjectionResult {
  vaguePrevueId: string;
  code: string;
  statut: StatutVaguePrevue;
  moisStockageAbsolu: number;
  moisRecolteAbsolu: number;
  coutAlimentFCFA: Decimal;
  coutAlevinsFCFA: Decimal;
  /**
   * Sortie calculee (story PR2bis.3, ERR-141/ERR-142) :
   * `calculerAlevinsACommander(effectifAlevinsPrevu, margeSecuriteAlevinsPct)`
   * — nombre d'alevins effectivement a commander/acheter, marge de securite
   * incluse. Distinct de `effectifAlevinsPrevu` (= D, poissons a vendre) qui
   * alimente `revenuPrevuFCFA`/`biomasseKg` — voir GAP 3 en tete de fichier.
   */
  alevinsACommanderNb: number;
  quotePartChargesFCFA: Decimal;
  coutProductionFCFA: Decimal;
  revenuPrevuFCFA: Decimal;
  biomasseKg: Decimal;
  alimentsParMois: AlimentParVagueEtMoisProjection[];
}

export interface MoisProjectionResult {
  moisAbsolu: number;
  revenusFCFA: Decimal;
  coutAlimentsFCFA: Decimal;
  coutAlevinsFCFA: Decimal;
  baseRepartitionFCFA: Decimal;
  investissementsFCFA: Decimal;
  depensesFCFA: Decimal;
  apportsFCFA: Decimal;
  /**
   * `resultatFCFA = revenusFCFA + apportsFCFA - depensesFCFA` (story PR2q.2)
   * — algebriquement identique au delta que `calculerTresorerieMensuelle`
   * ajoute deja a `soldeFCFA` d'un mois sur l'autre (verifie par la recette,
   * `route-orchestration.recette.test.ts`) : aucune donnee d'entree
   * nouvelle, une simple derivation des champs deja presents ci-dessus.
   */
  resultatFCFA: Decimal;
  /**
   * `calculerEpargne(resultatFCFA, tauxEpargnePct)` (moteur pur,
   * `tresorerie.ts`) — story PR2q.2, ERR-141/ERR-142 : contrairement a
   * `ParametresPrevision.margeSecuriteAlevinsPct` avant la story PR2bis.3,
   * `tauxEpargnePct` est bien consomme ici, pas seulement saisi/affiche.
   */
  epargneFCFA: Decimal;
  soldeFCFA: Decimal;
  /**
   * Story PR2q.3 (ADR-053, feuille "Previsions" du classeur, lignes 4-10 et
   * 24) : accumulateurs par mois CALENDAIRE, jamais exposes avant cette
   * story bien que deja calcules en interne (memes patrons associatifs que
   * `coutAlimentsParMois`/`coutAlevinsParMois`/`alevinsNbParMois`
   * ci-dessus). Rapproches du jeu d'or par
   * `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts`
   * (Section D) : `entrees.empoissonneT`, `entrees.ventesT`,
   * `besoinsAliments.totalKg`, `besoinsAliments.sacsTotal`,
   * `besoinsAliments.sacsParGranulometrie`, `depenses.alevinsCommandes`.
   */
  /** Biomasse cible (kg) des vagues STOCKEES ce mois — ligne 4 du classeur ("t" a l'affichage, kg ici). */
  empoissonneKg: Decimal;
  /** Biomasse recoltee ce mois (= somme des `biomasseKg` des vagues dont `moisRecolteAbsolu` tombe ce mois) — ligne 24 du classeur. */
  ventesKg: Decimal;
  /** Alevins a commander (E, marge de securite incluse) des vagues STOCKEES ce mois — ligne 5 du classeur. */
  alevinsACommanderNb: Decimal;
  /** Besoin en aliment BRUT (avant `ceil`), toutes granulometries confondues — ligne 6 du classeur. */
  besoinAlimentsTotalKg: Decimal;
  /** Sacs a acheter (apres `ceil` par granulometrie, agrege) — ligne 7 du classeur. */
  sacsAlimentsTotal: number;
  /** Detail par granulometrie (cle = `TailleGranule`, ex. "G1") — lignes 8-10 du classeur ; seules les granulometries reellement utilisees par le scenario apparaissent. */
  sacsParGranulometrie: Record<string, number>;
  /**
   * Bug de rapprochement (ADR-053 §11, §15 — meme famille que l'homonymie
   * `sacsParTonne` : deux grandeurs distinctes, un seul nom faillible)
   * : `sacsParGranulometrie` ci-dessus compte des SACS (entiers, apres
   * `ceil`), jamais des kg — le comparer au reel (`MouvementStock.quantite`,
   * `Vente.poidsTotalKg`, tous deux en kg) revient a comparer deux unites
   * differentes sous un meme intitule "QUANTITE". `kgParGranulometrie` est
   * le besoin BRUT en kg (avant `ceil`), meme grandeur/meme unite que le
   * reel — c'est CE champ que le rapprochement prevu/reel doit consommer
   * pour la ligne "Aliment <granulometrie>", jamais `sacsParGranulometrie`.
   * Cle = `TailleGranule` (ex. "G1"), memes conventions que ci-dessus.
   */
  kgParGranulometrie: Record<string, number>;
  /**
   * Story PR2sex.2 (ADR-053 §7/§12, jeu d'or `besoinsAliments.detailParVagueSacs`,
   * `Previsions!A11:V23` — « DETAIL PAR VAGUE — sacs consommes dans le mois
   * (indicatif) »). UN ROUND, jamais le CEIL de `sacsAlimentsTotal`/
   * `sacsParGranulometrie` ci-dessus (voir JSDoc de
   * `calculerDetailConsommationMensuelle`, ERR-138/ERR-139 : ne jamais
   * confondre « sacs a acheter » et « sacs consommes »).
   *
   * Cle EXTERIEURE = position dans le cycle (1..dureeCycleMois de la vague
   * concernee), un ENTIER GENERIQUE — jamais une cle `moisCycle1/2/3` figee
   * (ADR-053 §12.5 : le moteur ne doit jamais etre faconne sur la seule
   * richesse structurelle du jeu d'or). Cle INTERIEURE = `TailleGranule`
   * (ex. "G1"), memes conventions que `sacsParGranulometrie`.
   */
  detailParVagueSacs: Record<number, Record<string, number>>;
  logistique: {
    voyagesAliments: number;
    voyagesPoissons: number;
    voyagesAlevins: number;
    sousTotalFCFA: Decimal;
  };
}

export interface ProjectionScenarioResult {
  horizonMois: number;
  mois: MoisProjectionResult[];
  vagues: VagueProjectionResult[];
  pointBas: PointBasTresorerieResult | null;
  budget: BudgetTotalPlanResult;
}

/** GAP 1 — voir en-tete de fichier. */
function tonnageCibleKg(vague: VaguePrevuePourCalcul, poidsObjectifG: Decimal): Decimal {
  return new Decimal(vague.effectifAlevinsPrevu).times(poidsObjectifG).dividedBy(1000);
}

/**
 * Ceil execute par le moteur lui-meme (`calculerBesoinAlimentMensuel`),
 * jamais reimplemente ici — meme patron que la passe 2 de
 * `__tests__/recette/orchestration.ts` (`buildBesoinsAlimentsCalendrier`).
 */
function ceilViaMoteur(alimentId: string, poidsSacKg: Decimal, besoinKg: Decimal): number {
  const [resultat] = calculerBesoinAlimentMensuel(
    [
      {
        id: alimentId,
        poidsSacKg,
        besoinTotalCycleKg: besoinKg,
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
    ],
    1
  );
  return resultat.sacs;
}

/**
 * calculerProjectionScenario — orchestre le moteur pur sur un scenario
 * complet deja charge (`chargerScenarioPourMoteur`, PR2.1) pour produire la
 * projection de l'horizon (ADR-053 §7.2) : series mensuelles, tresorerie
 * cumulee, point bas et le mois ou il survient.
 *
 * Fonction pure elle-meme (aucun I/O) — la frontiere I/O reste
 * `chargerScenarioPourMoteur` (query) en amont, et la conversion
 * `Decimal -> number` (decimal-io.ts) en aval, a la charge de la route.
 */
export function calculerProjectionScenario(scenario: ScenarioPourCalcul): ProjectionScenarioResult {
  const vaguesActives = scenario.vaguesPrevues.filter((v) => v.statut !== StatutVaguePrevue.ANNULEE);

  // ---------------------------------------------------------------------
  // 1. Par vague : besoin aliment (kg + sacs + cout remise) par mois de
  //    cycle, cout alevins, revenu prevu, mois de recolte — et accumulation
  //    calendaire (GAP 2) au passage.
  // ---------------------------------------------------------------------
  const vaguesResult: VagueProjectionResult[] = [];
  const kgParGranulometrieEtMois = new Map<string, Map<number, Decimal>>();
  const coutAlimentsParMois = new Map<number, Decimal>();
  const coutAlevinsParMois = new Map<number, Decimal>();
  const revenusParMois = new Map<number, Decimal>();
  const alevinsNbParMois = new Map<number, Decimal>();
  /** Story PR2q.3 (ligne 4 du classeur) — meme patron associatif que les maps ci-dessus. */
  const tonnageEmpoissonneParMois = new Map<number, Decimal>();
  /**
   * Story PR2sex.2 — Σ (AVANT round, jamais apres) des `sacsEffectifsCycle`
   * (calibre) de toutes les vagues empoissonnees le meme mois calendaire,
   * indexee par (alimentPrevisionId, moisAbsolu, positionCycle). Le round
   * n'est applique qu'une seule fois, en aval (etape 4), en appelant
   * `calculerDetailConsommationMensuelle` sur cette somme deja effectuee —
   * sum-then-round, jamais un round par vague (voir JSDoc de
   * `MoisProjectionResult.detailParVagueSacs`).
   */
  const sacsEffectifsCycleParAlimentMoisPosition = new Map<string, Map<number, Map<number, Decimal>>>();

  const addTo = (map: Map<number, Decimal>, mois: number, valeur: Decimal) => {
    map.set(mois, (map.get(mois) ?? new Decimal(0)).plus(valeur));
  };

  for (const vague of vaguesActives) {
    const moisStockageAbsolu = moisAbsoluDepuis(scenario.dateDebutPlan, vague.dateStockagePrevue);
    const moisRecolteAbsolu = moisStockageAbsolu + vague.dureeCycleMoisFigee - 1;
    const tonnageCible = tonnageCibleKg(vague, scenario.parametres.poidsObjectifG);
    // Story PR2q.3 (ligne 4 du classeur) — biomasse cible accumulee par mois
    // CALENDAIRE de STOCKAGE (jamais accumulee avant cette story).
    addTo(tonnageEmpoissonneParMois, moisStockageAbsolu, tonnageCible);

    // GAP 1 (2/2) : kg -> tonnes. Hisse au niveau de la VAGUE (story
    // PR2sept.3) : ce tonnage ne depend d'aucun aliment, et c'est desormais
    // lui — et lui seul — qui decide le palier de remise.
    const tonnageCibleTonnes = tonnageCible.dividedBy(1000);

    // ADR-053 §13.3 (ERR-143) : la remise se decide UNE SEULE FOIS par
    // VaguePrevue, sur son tonnage vise, et s'applique ensuite a TOUT son
    // cout d'aliment, toutes granulometries et tous articles confondus.
    // Cette ligne est deliberement HORS de la boucle sur les granulometries :
    // c'est ce qui rend structurellement impossible le defaut d'origine (un
    // palier decide sur le volume de sacs d'un seul calibre).
    const pourcentageRemiseApplique = determinerPourcentageRemise(
      tonnageCibleTonnes,
      scenario.paliersRemise
    );

    const alimentsParMoisVague: AlimentParVagueEtMoisProjection[] = [];
    let coutAlimentVagueTotal = new Decimal(0);

    for (const aliment of scenario.aliments) {
      // GAP 1 — CORRIGE (ADR-053, amendement Sprint PR2 §11, voir JSDoc d'en-tete de fichier).
      // `sacsParTonneStandard` nullable = "non configure" : rejet explicite, jamais un defaut
      // silencieux. `BusinessRuleError(msg, 422)` porte son statut lui-meme (ERR-165,
      // ADR-053 §15.4) — plus de couplage par sous-chaine sur le message.
      if (aliment.sacsParTonneStandard === null) {
        throw new BusinessRuleError(
          `Impossible de calculer le besoin en aliment : sacsParTonneStandard non configure pour ` +
            `la granulometrie "${aliment.tailleGranule}".`,
          422
        );
      }
      // ADR-053 §12.2 arbitrage 1 (amendement Sprint PR2-quater) : le nombre
      // total de sacs du CALIBRE ne depend, et n'a jamais depedu, que du
      // tonnage et de sacsParTonneStandard — INDEPENDANT de tout poidsSacKg
      // (l'ADR le demontre algebriquement : poidsSacKg s'annule exactement
      // dans l'ancienne formule kg -> ceil(kg/poidsSacKg)). Calcule
      // directement ici, jamais via un poidsSacKg de calibre invente.
      const sacsCalculesCycle = tonnageCibleTonnes.times(aliment.sacsParTonneStandard).ceil().toNumber();

      const besoinTotalCycleKg = tonnageCibleTonnes.times(aliment.sacsParTonneStandard).times(aliment.poidsSacKg);

      const alimentCalcInput: AlimentPrevisionCalcInput = {
        id: aliment.id,
        poidsSacKg: aliment.poidsSacKg,
        besoinTotalCycleKg,
        repartitions: aliment.repartitions,
      };

      // Surcharges manuelles deja persistees pour CETTE granulometrie sur
      // CETTE vague, indexees par mois de cycle (voir bloc de tete de
      // fichier). Grain natif de `AlimentParVaguePrevue` : une ligne = un
      // mois — jamais un total de cycle.
      const surchargeParMoisCycle = new Map<number, number>();
      for (const persistee of vague.alimentsParMois) {
        if (persistee.alimentPrevisionId === aliment.id && persistee.sacsSaisis !== null) {
          surchargeParMoisCycle.set(persistee.moisCycle, persistee.sacsSaisis);
        }
      }

      // Besoin brut (moteur, avant toute surcharge) calcule UNE FOIS par
      // mois de cycle, reutilise a la fois pour le total agrege ci-dessous
      // et pour la ligne par mois plus bas (jamais recalcule deux fois).
      const besoinBrutParMoisCycle = new Map<number, ReturnType<typeof calculerBesoinAlimentMensuel>[number]>();
      for (let moisCycle = 1; moisCycle <= vague.dureeCycleMoisFigee; moisCycle++) {
        const [besoin] = calculerBesoinAlimentMensuel([alimentCalcInput], moisCycle);
        besoinBrutParMoisCycle.set(moisCycle, besoin);
      }

      // COALESCE(sacsSaisis, sacsCalcules) agrege sur le cycle complet
      // (ADR-053 section 3.6) — seulement si au moins une surcharge existe
      // pour cette granulometrie ; sinon `null` (comportement inchange :
      // le moteur retombe sur `sacsCalculesCycle`).
      let sacsSaisisCycle: number | null = null;
      if (surchargeParMoisCycle.size > 0) {
        let totalCycle = 0;
        for (let moisCycle = 1; moisCycle <= vague.dureeCycleMoisFigee; moisCycle++) {
          const surcharge = surchargeParMoisCycle.get(moisCycle);
          totalCycle += surcharge ?? besoinBrutParMoisCycle.get(moisCycle)!.sacs;
        }
        sacsSaisisCycle = totalCycle;
      }

      // Cout d'un calibre = sacs effectifs x prix du sac de ce calibre
      // (fusion article -> calibre : plus de repartition entre articles,
      // chaque calibre porte directement son propre prix de sac).
      // ADR-053 §13.7 : `COALESCE(sacsSaisis, sacsCalcules)` pilote le
      // MONTANT (ici et en aval), jamais le taux de remise — celui-ci est
      // deja decide au niveau de la vague, sur son tonnage.
      const sacsEffectifsCycle = sacsSaisisCycle ?? sacsCalculesCycle;

      const coutBrutFCFA = aliment.prixSacFCFA.times(sacsEffectifsCycle);
      // Le taux est celui de la VAGUE (identique pour tous les calibres) :
      // remiser chaque calibre puis sommer donne exactement le meme resultat
      // que remiser le cout agrege de la vague (`Σ cᵢ(1−r) = (Σ cᵢ)(1−r)`).
      // La forme par calibre est conservee parce que la ventilation
      // mensuelle qui suit a besoin d'un montant remise PAR granulometrie.
      // `appliquerTauxRemise` (moteur) applique le taux DEJA DECIDE hors de
      // cette boucle : la formule de remise n'existe qu'a un seul endroit du
      // depot (reserve M1). Ne JAMAIS remplacer cet appel par
      // `appliquerPalierRemise` ici — cela redeciderait le palier PAR
      // CALIBRE, exactement le defaut ERR-143.
      const coutCalibreFCFA = appliquerTauxRemise(coutBrutFCFA, pourcentageRemiseApplique);

      const montantsParMois = apportionnerCoutAlimentMensuel(coutCalibreFCFA, aliment.repartitions).map(
        (r) => ({ alimentPrevisionId: aliment.id, moisCycle: r.moisCycle, montantFCFA: r.montantFCFA })
      );

      for (let moisCycle = 1; moisCycle <= vague.dureeCycleMoisFigee; moisCycle++) {
        const besoin = besoinBrutParMoisCycle.get(moisCycle)!;
        const moisAbsolu = moisStockageAbsolu + moisCycle - 1;
        const montant = montantsParMois.find((m) => m.moisCycle === moisCycle)?.montantFCFA ?? new Decimal(0);
        const surcharge = surchargeParMoisCycle.get(moisCycle);
        const sacsAffiches = surcharge ?? besoin.sacs;

        alimentsParMoisVague.push({
          alimentPrevisionId: aliment.id,
          moisCycle,
          moisAbsolu,
          quantiteKg: besoin.quantiteKg,
          sacs: sacsAffiches,
          montantFCFA: montant,
        });

        coutAlimentVagueTotal = coutAlimentVagueTotal.plus(montant);
        addTo(coutAlimentsParMois, moisAbsolu, montant);

        // Story PR2sex.2 — accumulation de la Σ (AVANT round) des
        // sacsEffectifsCycle (calibre, DEJA COALESCE(sacsSaisisCycle,
        // sacsCalculesCycle) ci-dessus, JAMAIS un article) par (aliment,
        // moisAbsolu, positionCycle=moisCycle). Meme sacsEffectifsCycle
        // ajoute a CHAQUE position de cycle de cette vague (c'est le total du
        // CYCLE COMPLET, pas une valeur par mois) — c'est la multiplication
        // par le pourcentage de repartition (etape 4, `calculerDetailConsommationMensuelle`)
        // qui differencie chaque position, jamais une division ici.
        if (!sacsEffectifsCycleParAlimentMoisPosition.has(aliment.id)) {
          sacsEffectifsCycleParAlimentMoisPosition.set(aliment.id, new Map());
        }
        const parMoisPositionMap = sacsEffectifsCycleParAlimentMoisPosition.get(aliment.id)!;
        if (!parMoisPositionMap.has(moisAbsolu)) {
          parMoisPositionMap.set(moisAbsolu, new Map());
        }
        const parPositionMap = parMoisPositionMap.get(moisAbsolu)!;
        parPositionMap.set(
          moisCycle,
          (parPositionMap.get(moisCycle) ?? new Decimal(0)).plus(sacsEffectifsCycle)
        );

        if (!kgParGranulometrieEtMois.has(aliment.id)) {
          kgParGranulometrieEtMois.set(aliment.id, new Map());
        }
        const parMoisMap = kgParGranulometrieEtMois.get(aliment.id)!;
        parMoisMap.set(moisAbsolu, (parMoisMap.get(moisAbsolu) ?? new Decimal(0)).plus(besoin.quantiteKg));
      }
    }

    // GAP 3 — CORRIGE (ADR-053 decision 4, story PR2bis.3, ERR-141/ERR-142).
    // `alevinsACommanderNb` (= E) inclut la marge de securite, contrairement a
    // `vague.effectifAlevinsPrevu` (= D, poissons a vendre) utilise ci-dessus
    // par `tonnageCibleKg` et plus bas par `calculerRevenuPrevu` — voir
    // JSDoc d'en-tete de fichier.
    const alevinsACommanderNb = calculerAlevinsACommander(
      vague.effectifAlevinsPrevu,
      scenario.parametres.margeSecuriteAlevinsPct
    );
    // ERR-170 / ADR-053 §14.2 — cout d'achat gate par vague.alevinsAchetes : une vague en
    // production interne (false) ne facture aucun achat d'alevins. Le §5.3 des exigences cite
    // un facteur (1 - remise), mais aucune remise alevins n'existe dans le modele : le seul
    // mecanisme de remise (PalierRemise, tonnage) est explicitement scope au cout aliment
    // (ADR-053 §13.3). Aucune fixture, aucune cellule du classeur, aucun champ de schema ne
    // porte de remise alevins distincte — inventer une reutilisation du PalierRemise serait une
    // decision d'architecture non validee et invérifiable par la recette (meme piege qu'ERR-160).
    // Le facteur (1 - remise) est donc sans objet ici : ni applique, ni approxime.
    const coutAlevinsFCFA = vague.alevinsAchetes
      ? new Decimal(alevinsACommanderNb).times(scenario.parametres.prixAlevinUnitaireFCFA)
      : new Decimal(0);
    addTo(coutAlevinsParMois, moisStockageAbsolu, coutAlevinsFCFA);
    addTo(alevinsNbParMois, moisStockageAbsolu, new Decimal(alevinsACommanderNb));

    const { revenuFCFA, biomasseKg } = calculerRevenuPrevu(
      vague.effectifAlevinsPrevu,
      scenario.parametres.poidsObjectifG,
      scenario.parametres.prixVenteKgFCFA
    );
    addTo(revenusParMois, moisRecolteAbsolu, revenuFCFA);

    vaguesResult.push({
      vaguePrevueId: vague.id,
      code: vague.code,
      statut: vague.statut,
      moisStockageAbsolu,
      moisRecolteAbsolu,
      coutAlimentFCFA: coutAlimentVagueTotal,
      coutAlevinsFCFA,
      alevinsACommanderNb,
      quotePartChargesFCFA: new Decimal(0), // rempli a l'etape 4
      coutProductionFCFA: new Decimal(0), // idem
      revenuPrevuFCFA: revenuFCFA,
      biomasseKg,
      alimentsParMois: alimentsParMoisVague,
    });
  }

  // ---------------------------------------------------------------------
  // 2. Charges/journal/apports a plat, par mois absolu (entrees brutes).
  // ---------------------------------------------------------------------
  const chargesFlat: (ChargePourBaseInput & { moisAbsolu: number })[] = scenario.postes.flatMap((poste) =>
    poste.chargesMensuelles.map((c) => ({
      moisAbsolu: c.moisAbsolu,
      montantFCFA: c.montantFCFA,
      inclusBaseRepartition: poste.inclusBaseRepartition,
    }))
  );
  const journalFlat: (JournalEntryInput & { moisAbsolu: number })[] = scenario.journal.map((j) => ({
    moisAbsolu: moisAbsoluDepuis(scenario.dateDebutPlan, j.date),
    montantFCFA: j.montantFCFA,
    categorie: j.categorie,
    vaguePrevueId: j.vaguePrevueId,
  }));
  const apportsFlat = scenario.apports.map((a) => ({
    moisAbsolu: moisAbsoluDepuis(scenario.dateDebutPlan, a.date),
    montantFCFA: a.montantFCFA,
  }));

  // ---------------------------------------------------------------------
  // 3. Horizon : de 0 au dernier mois portant une donnee quelconque.
  // ---------------------------------------------------------------------
  const tousLesMois = [
    ...vaguesResult.map((v) => v.moisRecolteAbsolu),
    ...vaguesResult.map((v) => v.moisStockageAbsolu),
    ...chargesFlat.map((c) => c.moisAbsolu),
    ...journalFlat.map((j) => j.moisAbsolu),
    ...apportsFlat.map((a) => a.moisAbsolu),
    0,
  ];
  const horizonMois = Math.max(...tousLesMois) + 1;

  // ---------------------------------------------------------------------
  // 4. Boucle mensuelle : base_repartition, quote-part, logistique,
  //    depenses/revenus/apports du mois.
  // ---------------------------------------------------------------------
  const quotePartCumuleeParVague = new Map<string, Decimal>();
  const moisResults: MoisProjectionResult[] = [];
  const moisOrdonnesPourTresorerie: { moisAbsolu: number; revenus: Decimal; depenses: Decimal; apports: Decimal }[] =
    [];

  for (let m = 0; m < horizonMois; m++) {
    const chargesDuMois = chargesFlat.filter((c) => c.moisAbsolu === m);
    const journalDuMois = journalFlat.filter((j) => j.moisAbsolu === m);

    const investissementsFCFA = journalDuMois
      .filter((j) => j.categorie === CategorieJournalPrevu.INVESTISSEMENT)
      .reduce((sum, j) => sum.plus(j.montantFCFA), new Decimal(0));

    // GAP 2 — agregation multi-vague : sommer les KG par (granulometrie,
    // mois calendaire) AVANT de ceiler, puis ceil execute par le moteur
    // lui-meme (meme patron que __tests__/recette/orchestration.ts, passe 2).
    let sacsAlimentsDuMois = new Decimal(0);
    // Story PR2q.3 (lignes 6-10 du classeur) : besoin BRUT total (avant ceil,
    // toutes granulometries) et detail par granulometrie (`tailleGranule`,
    // resolue depuis `scenario.aliments`) — accumules dans la MEME boucle que
    // `sacsAlimentsDuMois` (GAP 2, deja existant), jamais une seconde passe.
    let besoinAlimentsTotalKgDuMois = new Decimal(0);
    const sacsParGranulometrieDuMois: Record<string, number> = {};
    // Bug de rapprochement (ADR-053 §11/§15) : accumulateur JUMEAU de
    // `sacsParGranulometrieDuMois`, meme boucle, meme cle (`tailleGranule`),
    // mais en kg BRUTS (avant ceil) — c'est cette grandeur, pas les sacs,
    // que le rapprochement prevu/reel doit comparer au reel (kg).
    const kgParGranulometrieDuMois: Record<string, number> = {};
    for (const [alimentId, parMois] of kgParGranulometrieEtMois) {
      const kgDuMois = parMois.get(m);
      if (!kgDuMois || kgDuMois.lte(0)) continue;
      besoinAlimentsTotalKgDuMois = besoinAlimentsTotalKgDuMois.plus(kgDuMois);
      const aliment = scenario.aliments.find((a) => a.id === alimentId)!;
      const sacs = ceilViaMoteur(alimentId, aliment.poidsSacKg, kgDuMois);
      sacsAlimentsDuMois = sacsAlimentsDuMois.plus(sacs);
      sacsParGranulometrieDuMois[aliment.tailleGranule] =
        (sacsParGranulometrieDuMois[aliment.tailleGranule] ?? 0) + sacs;
      kgParGranulometrieDuMois[aliment.tailleGranule] =
        (kgParGranulometrieDuMois[aliment.tailleGranule] ?? 0) + kgDuMois.toNumber();
    }

    // Story PR2sex.2 — `detailParVagueSacs` (sacs CONSOMMES, ROUND, jamais le
    // CEIL ci-dessus). Cle EXTERIEURE = position de cycle (entier generique,
    // jamais moisCycle1/2/3 en dur), cle INTERIEURE = TailleGranule. Pour
    // chaque calibre et chaque position deja accumulee (sum AVANT round, voir
    // etape 1 ci-dessus), un SEUL appel a `calculerDetailConsommationMensuelle`
    // — sum-then-round, jamais un round par vague.
    const detailParVagueSacsDuMois: Record<number, Record<string, number>> = {};
    for (const [alimentId, parMoisPositionMap] of sacsEffectifsCycleParAlimentMoisPosition) {
      const parPositionMap = parMoisPositionMap.get(m);
      if (!parPositionMap) continue;
      const aliment = scenario.aliments.find((a) => a.id === alimentId)!;
      for (const [positionCycle, sommeSacsEffectifsCycle] of parPositionMap) {
        const { sacsConsommes } = calculerDetailConsommationMensuelle({
          alimentPrevisionId: alimentId,
          moisCycle: positionCycle,
          sommeSacsEffectifsCycle,
          repartitions: aliment.repartitions,
        });
        if (!detailParVagueSacsDuMois[positionCycle]) {
          detailParVagueSacsDuMois[positionCycle] = {};
        }
        detailParVagueSacsDuMois[positionCycle][aliment.tailleGranule] =
          (detailParVagueSacsDuMois[positionCycle][aliment.tailleGranule] ?? 0) + sacsConsommes;
      }
    }

    const quantitePoissonsKg = vaguesResult
      .filter((v) => v.moisRecolteAbsolu === m)
      .reduce((sum, v) => sum.plus(v.biomasseKg), new Decimal(0));

    const quantiteAlevinsNb = alevinsNbParMois.get(m) ?? new Decimal(0);

    const logistiqueMois = calculerLogistiqueMensuelle({
      quantiteAlimentsSacs: sacsAlimentsDuMois,
      transportAliments: scenario.parametres.transportAliments,
      quantitePoissonsKg,
      transportPoissons: scenario.parametres.transportPoissons,
      quantiteAlevinsNb,
      transportAlevins: scenario.parametres.transportAlevins,
    });

    // Base de repartition (Etape 6) — DOIT recevoir la logistique du mois deja
    // calculee ci-dessus (ADR-053 §5.5 : `base_repartition = logistique +
    // charges_exploitation + journal_op_general`), en plus des charges
    // "logistique/exploitation" persistees (`chargesDuMois`). Injectee comme
    // une entree supplementaire de `chargesLogistiqueEtExploitation`
    // (`inclusBaseRepartition: true` par construction : la logistique
    // calculee par le moteur est TOUJOURS incluse dans la base, elle n'est
    // pas un poste optionnel que l'utilisateur peut exclure) — c'est le
    // parametre que le moteur pur (`calculerBaseRepartition`, charges.ts)
    // prevoit deja pour cela ; aucune addition apres coup, le moteur reste la
    // seule source de la formule (ERR-142).
    const baseRepartitionFCFA = calculerBaseRepartition(
      [...chargesDuMois, { montantFCFA: logistiqueMois.sousTotalFCFA, inclusBaseRepartition: true }],
      journalDuMois
    );

    const vaguesActivesCeMois = vaguesResult
      .filter((v) => m >= v.moisStockageAbsolu && m <= v.moisRecolteAbsolu)
      .map((v) => v.vaguePrevueId);
    const quotePartParVague = calculerQuotePartVague(baseRepartitionFCFA, vaguesActivesCeMois);
    for (const [vagueId, part] of quotePartParVague) {
      quotePartCumuleeParVague.set(vagueId, (quotePartCumuleeParVague.get(vagueId) ?? new Decimal(0)).plus(part));
    }

    const coutAlimentsFCFA = coutAlimentsParMois.get(m) ?? new Decimal(0);
    const coutAlevinsFCFA = coutAlevinsParMois.get(m) ?? new Decimal(0);
    const revenusFCFA = revenusParMois.get(m) ?? new Decimal(0);
    const apportsFCFA = apportsFlat
      .filter((a) => a.moisAbsolu === m)
      .reduce((sum, a) => sum.plus(a.montantFCFA), new Decimal(0));

    const depensesFCFA = coutAlimentsFCFA.plus(coutAlevinsFCFA).plus(baseRepartitionFCFA).plus(investissementsFCFA);

    // resultatFCFA = revenusFCFA + apportsFCFA - depensesFCFA (story PR2q.2)
    // — meme composition exactement que le delta applique par
    // `calculerTresorerieMensuelle` a `soldeFCFA` (Etape 10 ci-dessous),
    // jamais une formule distincte.
    const resultatFCFA = revenusFCFA.plus(apportsFCFA).minus(depensesFCFA);
    const epargneFCFA = calculerEpargne(resultatFCFA, scenario.parametres.tauxEpargnePct);

    moisResults.push({
      moisAbsolu: m,
      revenusFCFA,
      coutAlimentsFCFA,
      coutAlevinsFCFA,
      baseRepartitionFCFA,
      investissementsFCFA,
      depensesFCFA,
      apportsFCFA,
      resultatFCFA,
      epargneFCFA,
      soldeFCFA: new Decimal(0), // rempli a l'etape 5
      empoissonneKg: tonnageEmpoissonneParMois.get(m) ?? new Decimal(0),
      ventesKg: quantitePoissonsKg,
      alevinsACommanderNb: quantiteAlevinsNb,
      besoinAlimentsTotalKg: besoinAlimentsTotalKgDuMois,
      sacsAlimentsTotal: sacsAlimentsDuMois.toNumber(),
      sacsParGranulometrie: sacsParGranulometrieDuMois,
      kgParGranulometrie: kgParGranulometrieDuMois,
      detailParVagueSacs: detailParVagueSacsDuMois,
      logistique: {
        voyagesAliments: logistiqueMois.voyagesAliments,
        voyagesPoissons: logistiqueMois.voyagesPoissons,
        voyagesAlevins: logistiqueMois.voyagesAlevins,
        sousTotalFCFA: logistiqueMois.sousTotalFCFA,
      },
    });

    moisOrdonnesPourTresorerie.push({
      moisAbsolu: m,
      revenus: revenusFCFA,
      depenses: depensesFCFA,
      apports: apportsFCFA,
    });
  }

  // ---------------------------------------------------------------------
  // 5. Tresorerie cumulee + point bas (Etapes 10-11 du moteur).
  // ---------------------------------------------------------------------
  // Solde d'ouverture (§4.1 des exigences) — LIBRE, peut etre negatif ;
  // dette 3 de la pre-analyse PR3 (ERR-171/ERR-142) : cette ligne figeait
  // `new Decimal(0)` jusqu'a la story PR3.1a, rendant tout scenario a
  // tresorerie initiale non nulle inexprimable malgre le champ existant
  // au schema. EXCEL-V12 porte 0 pour ce champ (voir ParametresPrevision),
  // donc ce changement ne modifie AUCUN resultat du jeu d'or.
  const serieTresorerie = genererSerieTresorerie(
    moisOrdonnesPourTresorerie,
    scenario.parametres.tresorerieInitialeFCFA
  );
  for (let m = 0; m < horizonMois; m++) {
    moisResults[m].soldeFCFA = serieTresorerie[m].soldeFCFA;
  }
  const pointBas = calculerPointBasTresorerie(serieTresorerie);

  // ---------------------------------------------------------------------
  // 6. Cout de production complet par vague (Etape 8) + Budget total (Etape 12).
  // ---------------------------------------------------------------------
  for (const vague of vaguesResult) {
    vague.quotePartChargesFCFA = quotePartCumuleeParVague.get(vague.vaguePrevueId) ?? new Decimal(0);
    vague.coutProductionFCFA = calculerCoutProductionVague(
      vague.coutAlimentFCFA,
      vague.coutAlevinsFCFA,
      vague.quotePartChargesFCFA
    );
  }

  const budget = calculerBudgetTotalPlan({
    coutsProductionVagues: vaguesResult.map((v) => v.coutProductionFCFA),
    chargesHorsProduction: [],
    apports: scenario.apports.map((a) => a.montantFCFA),
  });

  return { horizonMois, mois: moisResults, vagues: vaguesResult, pointBas, budget };
}
