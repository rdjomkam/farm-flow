/**
 * Recette PR1.4 — helpers partages entre les deux fichiers de recette
 * (plan-v12-corrige, annexe-b-corrigee).
 *
 * REGLE SACREE (story PR1.4) : les valeurs attendues viennent EXCLUSIVEMENT
 * des blocs de sortie deja presents dans les fixtures (extraits des
 * cellules calculees du classeur par extract-golden.py) — ce fichier ne
 * recalcule JAMAIS une valeur attendue, il ne fait que charger le JSON et
 * fournir des helpers d'assertion generiques (tolerance) et de conversion
 * d'unite (ex. pourcentage 0..1 du JSON -> 0..100 attendu par le moteur).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Decimal } from "../../decimal-config";

export interface GoldenPalierRemise {
  ordre: number;
  seuilTonnes: number;
  remisePct: number;
}

export interface GoldenAliment {
  granulometrie: string;
  poidsSacKg: number;
  prixSacFCFA: number;
  repartitionPctMois1: number;
  repartitionPctMois2: number;
  repartitionPctMois3: number;
  sacsParTonneStandard: number;
}

export interface GoldenVague {
  vague: string;
  moisEmpoissonnement: string;
  objectifTonnes: number;
  remisePct: number;
  coutAlimentsFCFA: number;
  /** cout aliment (toutes granulometries), APRES remise, du 1er/2e/3e mois de cycle de cette vague — grain teste par PR1.4 (extension logistique+aliment mensuel) */
  coutAlimentsMois1FCFA: number;
  coutAlimentsMois2FCFA: number;
  coutAlimentsMois3FCFA: number;
  /**
   * Nombre de poissons vises a la vente en fin de cycle pour cette vague —
   * ENTREE (entreesModele.planVagues), = D dans le vocabulaire de la story
   * PR2bis.3. Alimente `tonnageCibleKg`/`calculerRevenuPrevu` cote moteur,
   * jamais la logistique alevins (voir `alevinsACommanderNb` ci-dessous).
   */
  poissonsAVendreNb: number;
  /**
   * Nombre d'alevins a commander au demarrage de cette vague — SORTIE CALCULEE
   * du moteur (`calculerAlevinsACommander(poissonsAVendreNb, margeSecuriteAlevinsPct)`,
   * `plan.ts`), = E dans le vocabulaire de la story PR2bis.3. Ce champ a
   * longtemps ete traite a tort comme une entree brute du jeu d'or (ERR-141/
   * ERR-142) : `margeSecuriteAlevinsPct` etait saisi et affiche mais jamais
   * consomme par le calcul. Depuis la correction, ce nombre est reconstruit
   * par le moteur reel et compare a cette valeur du jeu d'or, tolerance 0
   * (entier) — jamais recopie directement dans un test.
   */
  alevinsACommanderNb: number;
  /** cout d'achat des alevins (0 si produits en interne, "NON" — toujours 0 dans les deux fixtures du jeu d'or) — ENTREE (entreesModele.planVagues) */
  coutAlevinsFCFA: number;
  alevinsAchetes: "OUI" | "NON";
}

export interface GoldenChargePoste {
  libelle: string;
  valeursParMoisFCFA: number[];
}

export interface GoldenFixture {
  $description: string;
  mois: string[];
  entreesModele: {
    parametresScenario: {
      prixVenteKgFCFA: number;
      poidsMoyenVenteKg: number;
      margeSecuriteAlevinsPct: number;
      prixAlevinUnitaireFCFA: number;
      tauxEpargnePct: number;
      tresorerieInitialeFCFA: number;
    };
    paliersRemise: GoldenPalierRemise[];
    transport: {
      voyageAlimentsCapaciteSacs: number;
      voyageAlimentsCoutFCFA: number;
      voyagePoissonsCapaciteKg: number;
      voyagePoissonsCoutFCFA: number;
      voyageAlevinsCapaciteNb: number;
      voyageAlevinsCoutFCFA: number;
    };
    aliments: GoldenAliment[];
    planVagues: GoldenVague[];
    chargesExploitation: GoldenChargePoste[];
  };
  entrees: {
    empoissonneT: number[];
    ventesT: number[];
    chiffreAffaires: number[];
  };
  besoinsAliments: {
    totalKg: number[];
    kgParGranulometrie: Record<string, number[]>;
    sacsTotal: number[];
    sacsParGranulometrie: Record<string, number[]>;
    /**
     * Story PR2sex.2 (ADR-053 §7/§12) — « DETAIL PAR VAGUE — sacs consommes
     * dans le mois (indicatif) », `Previsions!A11:V23`. Cle = `moisCycleN`
     * (N = 1..3 dans le jeu d'or), sous-cle = granulometrie ("2mm"/"3mm"/"4mm"),
     * valeur = serie de 21 sacs (un ROUND, jamais le CEIL de `sacsTotal`/
     * `sacsParGranulometrie` ci-dessus). Le nommage `moisCycleN` est une
     * particularite DU JEU D'OR uniquement (fixture JSON) — jamais reproduit
     * dans la signature du moteur (`detailParVagueSacs: Record<number, ...>`,
     * indexation par ENTIER generique, ADR-053 §12.5).
     */
    detailParVagueSacs: Record<string, Record<string, number[]>>;
  };
  logistique: {
    voyagesAliments: number[];
    voyagesPoissons: number[];
    voyagesAlevins: number[];
    transportAlevins: number[];
    sousTotal: number[];
  };
  depenses: {
    aliments: number[];
    alevins: number[];
    alevinsCommandes: number[];
    chargesExploitation: number[];
    baseRepartition: number[];
    chargesOperationnelles: number[];
  };
  resultats: {
    apportsCapital: number[];
    totalEntrees: number[];
    investissements: number[];
    autresDepenses: number[];
    depensesTotales: number[];
    resultat: number[];
    epargne: number[];
    tresorerie: number[];
  };
  cumuls: {
    tonnageVendu: number;
    chiffreAffaires: number;
    apportsCapital: number;
    depensesTotales: number;
    dontAliments: number;
    dontInvestissements: number;
    resultatCumule: number;
    tresorerieFinale: number;
    pointBasTresorerie: number;
    moisPointBas: string;
    besoinMensuelMaxKg: number;
  };
}

export function loadGoldenFixture(filename: string): GoldenFixture {
  const filePath = join(process.cwd(), "prisma/fixtures/previsions", filename);
  return JSON.parse(readFileSync(filePath, "utf-8")) as GoldenFixture;
}

/**
 * Assertion stricte sur un entier (sacs, voyages, poissons, alevins) —
 * tolerance ZERO (ADR-053 section 7 / README recette).
 *
 * @param contexte - identifie la serie + le mois (ou la vague) pour un
 *   message d'echec diagnosticable sans relancer de debug.
 */
export function expectEntierExact(actual: number, expected: number, contexte: string): void {
  if (actual !== expected) {
    throw new Error(
      `[recette] ${contexte} — entier attendu ${expected}, obtenu ${actual} (ecart ${actual - expected}, tolerance = 0).`
    );
  }
}

/**
 * Assertion sur un montant FCFA (Decimal ou number) — tolerance <= 1 FCFA
 * (ADR-053 section 7 / README recette).
 */
export function expectMontantFCFA(
  actual: Decimal | number,
  expected: number,
  contexte: string
): void {
  const actualDecimal = actual instanceof Decimal ? actual : new Decimal(actual);
  const ecart = actualDecimal.minus(expected).abs();
  if (ecart.gt(1)) {
    throw new Error(
      `[recette] ${contexte} — montant attendu ${expected} FCFA, obtenu ${actualDecimal.toString()} FCFA (ecart ${ecart.toString()} FCFA, tolerance <= 1 FCFA).`
    );
  }
}

/**
 * Assertion sur un poids en kg (grandeur continue, pas un montant FCFA, pas
 * un entier). Le jeu d'or n'a pas de tolerance dediee au kg dans l'ADR — un
 * epsilon serre (1e-6) absorbe uniquement le bruit flottant residuel de
 * l'extraction Python (ex. `1392.0000000000002` au lieu de `1392`, constate
 * dans `besoinsAliments.kgParGranulometrie`), jamais un veritable ecart
 * metier. La grandeur qui compte reellement pour la tolerance de recette
 * (sacs, apres `ceil`) reste verifiee avec `expectEntierExact` (tolerance
 * ZERO).
 */
export function expectKgApprox(actual: Decimal | number, expected: number, contexte: string): void {
  const actualDecimal = actual instanceof Decimal ? actual : new Decimal(actual);
  const ecart = actualDecimal.minus(expected).abs();
  if (ecart.gt(1e-6)) {
    throw new Error(
      `[recette] ${contexte} — kg attendu ${expected}, obtenu ${actualDecimal.toString()} (ecart ${ecart.toString()}, epsilon flottant = 1e-6).`
    );
  }
}

/** Convertit un pourcentage fixture (0..1, ex. 0.8 = 80%) vers l'echelle 0..100 attendue par le moteur. */
export function pctFixtureVersMoteur(pctFraction: number): Decimal {
  return new Decimal(pctFraction).times(100);
}

/** Index (0-based) du mois calendaire `moisEmpoissonnement` (ex. "2026-08") dans `mois`. */
export function indexMoisCalendaire(mois: string[], moisEmpoissonnement: string): number {
  const idx = mois.indexOf(moisEmpoissonnement);
  if (idx === -1) {
    throw new Error(`[recette] mois calendaire "${moisEmpoissonnement}" introuvable dans la serie "mois".`);
  }
  return idx;
}
