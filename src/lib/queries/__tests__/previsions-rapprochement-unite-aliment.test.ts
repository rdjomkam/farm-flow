/**
 * Test PUR (aucune I/O, aucune DB) — `construireEntreesPrevuesDepuisScenario`
 * (`src/lib/queries/previsions-rapprochement.ts`), story de bugfix
 * "rapprochement, vue mensuelle : l'unite affichee ne correspond pas a la
 * grandeur reellement portee" (2026-08-05).
 *
 * Diagnostic (voir commentaires de production pour la reference complete,
 * ADR-053 §11/§15) : la ligne "Aliment <granulometrie>" du rapprochement
 * prevu/reel lisait `MoisProjectionResult.sacsParGranulometrie` (un compte
 * de SACS, entier, apres `ceil`) sous l'intitule `natureGrandeur ===
 * "QUANTITE"`, alors que le REEL de cette meme ligne
 * (`MouvementStock.quantite`, cf. `getSortiesAlimentReellesParGranulometrie`)
 * est en KG. Comparer un compte de sacs a des kg sous un meme intitule
 * "QUANTITE" produit un ecart faux d'un facteur ~`poidsSacKg` (~15 sur le
 * plan de reference EXCEL-V12) — pas seulement un probleme d'affichage.
 *
 * Ancrage chiffre (golden, cote PREVU uniquement — ADR-053 : "pas de jeu
 * d'or sur le rapprochement" en general, mais le besoin aliment d'aout du
 * plan EXCEL-V12 EST deja assert a 0 ecart par la recette du moteur,
 * `route-orchestration.recette.test.ts`) : G1 = 384 kg, G2 = 216 kg, total
 * = 600 kg. Ce test construit un mois de projection portant CES valeurs en
 * kg (`kgParGranulometrie`) et des valeurs VOLONTAIREMENT DIFFERENTES en
 * sacs (`sacsParGranulometrie`) pour prouver, par construction, que la
 * fonction de production lit bien le premier champ, jamais le second.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/previsions/decimal-config";
import { TailleGranule, StatutScenarioPrevision } from "@/types";
import type { ScenarioPourCalcul } from "@/lib/queries/previsions-scenario-loader";
import type {
  MoisProjectionResult,
  ProjectionScenarioResult,
} from "@/lib/previsions/route-orchestration";
import { construireEntreesPrevuesDepuisScenario } from "@/lib/queries/previsions-rapprochement";

const transportZero = { capacite: new Decimal(1), coutUnitaireFCFA: new Decimal(0) };

function alimentFactice(id: string, tailleGranule: TailleGranule): ScenarioPourCalcul["aliments"][number] {
  return {
    id,
    tailleGranule,
    sacsParTonneStandard: new Decimal(8),
    ordre: 0,
    repartitions: [],
    articles: [
      {
        id: `${id}-article`,
        libelle: "Article",
        poidsSacKg: new Decimal(15),
        prixSacFCFA: new Decimal(20000),
        partApprovisionnementPct: new Decimal(100),
      },
    ],
  };
}

function scenarioFactice(overrides: Partial<ScenarioPourCalcul> = {}): ScenarioPourCalcul {
  return {
    id: "scenario-x",
    code: "SCN-X",
    nom: "Scenario factice",
    dureeCycleMois: 3,
    dateDebutPlan: new Date("2026-01-01"),
    statut: StatutScenarioPrevision.BROUILLON,
    parametres: {
      effectifAlevinsParVague: 1000,
      margeSecuriteAlevinsPct: new Decimal(5),
      tauxEpargnePct: new Decimal(0),
      poidsMoyenInitialG: new Decimal(5),
      poidsObjectifG: new Decimal(800),
      prixAlevinUnitaireFCFA: new Decimal(50),
      prixVenteKgFCFA: new Decimal(2000),
      nombreBacsSimultanesCible: 2,
      frequenceStockageMois: new Decimal(1),
      transportAliments: transportZero,
      transportPoissons: transportZero,
      transportAlevins: transportZero,
      tresorerieInitialeFCFA: new Decimal(0),
    },
    paliersRemise: [],
    aliments: [
      alimentFactice("aliment-g1", TailleGranule.G1),
      alimentFactice("aliment-g2", TailleGranule.G2),
      alimentFactice("aliment-g3", TailleGranule.G3),
    ],
    vaguesPrevues: [],
    postes: [],
    journal: [],
    apports: [],
    ...overrides,
  };
}

const MOIS_AOUT = 7;

function moisAoutFactice(): MoisProjectionResult {
  return {
    moisAbsolu: MOIS_AOUT,
    revenusFCFA: new Decimal(0),
    coutAlimentsFCFA: new Decimal(0),
    coutAlevinsFCFA: new Decimal(0),
    baseRepartitionFCFA: new Decimal(0),
    investissementsFCFA: new Decimal(0),
    depensesFCFA: new Decimal(0),
    apportsFCFA: new Decimal(0),
    resultatFCFA: new Decimal(0),
    epargneFCFA: new Decimal(0),
    soldeFCFA: new Decimal(0),
    empoissonneKg: new Decimal(0),
    ventesKg: new Decimal(0),
    alevinsACommanderNb: new Decimal(0),
    besoinAlimentsTotalKg: new Decimal(600),
    sacsAlimentsTotal: 41,
    // Compte de SACS — DELIBEREMENT different des kg ci-dessous, pour que
    // le test echoue si la production lit encore ce champ par erreur.
    sacsParGranulometrie: { G1: 26, G2: 15, G3: 0 },
    // Besoin BRUT en kg, meme unite que le reel (MouvementStock.quantite) —
    // le champ que la production DOIT lire pour la ligne "Aliment <G>".
    kgParGranulometrie: { G1: 384, G2: 216 },
    detailParVagueSacs: {},
    logistique: {
      voyagesAliments: 0,
      voyagesPoissons: 0,
      voyagesAlevins: 0,
      sousTotalFCFA: new Decimal(0),
    },
  };
}

function projectionFactice(mois: MoisProjectionResult[]): ProjectionScenarioResult {
  return {
    horizonMois: MOIS_AOUT + 1,
    mois,
    vagues: [],
    pointBas: null,
    budget: {
      totalCoutsProductionFCFA: new Decimal(0),
      totalChargesHorsProductionFCFA: new Decimal(0),
      totalApportsFCFA: new Decimal(0),
      budgetTotalFCFA: new Decimal(0),
    },
  };
}

describe("Bugfix rapprochement — unite reelle de la ligne Aliment <granulometrie> (kg, pas sacs)", () => {
  it("lit kgParGranulometrie (kg), jamais sacsParGranulometrie (sacs), pour construire le prevu de la ligne QUANTITE", () => {
    const scenario = scenarioFactice();
    const projection = projectionFactice([moisAoutFactice()]);

    const entrees = construireEntreesPrevuesDepuisScenario(scenario, projection, MOIS_AOUT, MOIS_AOUT);

    const ligneG1 = entrees.find((e) => e.cle === "aliment-g1");
    const ligneG2 = entrees.find((e) => e.cle === "aliment-g2");
    const ligneG3 = entrees.find((e) => e.cle === "aliment-g3");

    expect(ligneG1).toBeDefined();
    expect(ligneG2).toBeDefined();
    expect(ligneG3).toBeDefined();

    // Ancrage golden EXCEL-V12 (aout) : 384 kg / 216 kg / 600 kg au total —
    // PAS 26 / 15 (les valeurs en sacs, qui prouveraient une regression si
    // elles apparaissaient ici).
    expect(ligneG1?.natureGrandeur).toBe("QUANTITE");
    expect(ligneG1?.montantPrevu.toNumber()).toBe(384);
    expect(ligneG2?.natureGrandeur).toBe("QUANTITE");
    expect(ligneG2?.montantPrevu.toNumber()).toBe(216);
    // G3 : repartition 0% au mois 1 du cycle (golden) — absent de
    // `kgParGranulometrie`, doit retomber sur 0 (etat "zero reel", pas une
    // valeur en sacs residuelle).
    expect(ligneG3?.montantPrevu.toNumber()).toBe(0);

    const totalKg = (ligneG1?.montantPrevu.toNumber() ?? 0) + (ligneG2?.montantPrevu.toNumber() ?? 0);
    expect(totalKg).toBe(600);
  });
});
