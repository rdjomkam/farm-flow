/**
 * Test d'INTEGRATION synthetique (story PR3.1a — SCHEMA/moteur,
 * `ParametresPrevision.tresorerieInitialeFCFA`) de la branche solde
 * d'ouverture non nul de `calculerProjectionScenario`
 * (`route-orchestration.ts`).
 *
 * RAISON D'ETRE — dette 3, pre-analyse PR3 §B.3 : les DEUX fixtures du jeu
 * d'or (`plan-v12-corrige.json`, `annexe-b-corrigee.json`) portent
 * `tresorerieInitialeFCFA: 0` sans exception. Aucune recette ne peut donc
 * exercer un solde d'ouverture non nul — meme patron qu'ERR-160 (un jeu
 * d'or qui ne varie jamais sur un axe ne peut pas prouver le comportement
 * sur cet axe) — ce fichier construit un `ScenarioPourCalcul` synthetique a
 * la main, sans passer par les fixtures ni les builders de recette,
 * exactement le patron deja etabli par
 * `route-orchestration-alevins-achetes.test.ts`.
 *
 * REGLE SACREE (identique a la recette) : chaque montant attendu ci-dessous
 * est calcule A LA MAIN et ecrit EN DUR — jamais recalcule par une
 * reimplementation independante de la formule sous test. Ce test appelle
 * EXCLUSIVEMENT `calculerProjectionScenario` (le code de PRODUCTION), jamais
 * une recomposition locale (ERR-171/ERR-142).
 *
 * Scenario synthetique choisi (aucune vague, pour isoler le solde
 * d'ouverture de toute logique de vague/aliment, hors sujet ici) :
 *   - Mois absolu 0 : un apport de 200 000 FCFA (CAPITAL), aucune depense.
 *     resultatFCFA[0] = 200 000
 *   - Mois absolu 1 : une ligne de journal INVESTISSEMENT de 700 000 FCFA
 *     (hors base_repartition par construction, ADR-053 decision 6),
 *     aucun revenu/apport.
 *     resultatFCFA[1] = -700 000
 *
 * soldeFCFA[m] = soldeInitial + Sigma(resultatFCFA[0..m]) :
 *   - soldeInitial = 0        -> solde[0] = 200 000,   solde[1] = -500 000
 *   - soldeInitial = -500 000 -> solde[0] = -300 000,  solde[1] = -1 000 000
 *
 * Point bas (minimum de la serie) : mois 1 dans les deux cas — le solde
 * initial negatif ne change PAS le mois du point bas ici (il ne fait que
 * translater toute la serie), mais deplace sa VALEUR exactement du meme
 * montant (-500 000) : c'est la propriete que ce test verifie explicitement
 * (§4.1 des exigences, ERR-160 : verifier le signe et le montant exact, pas
 * seulement "un point bas existe").
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { calculerProjectionScenario } from "../route-orchestration";
import {
  StatutScenarioPrevision,
  CategorieJournalPrevu,
  TypeApportCapital,
} from "@/types";
import type { ScenarioPourCalcul } from "@/lib/queries/previsions-scenario-loader";

function transportNul() {
  return { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) };
}

const APPORT_MOIS0_FCFA = 200_000;
const INVESTISSEMENT_MOIS1_FCFA = 700_000;

function buildScenario(tresorerieInitialeFCFA: number): ScenarioPourCalcul {
  return {
    id: "scenario-synthetique-tresorerie-initiale",
    code: "SCN-TRESORERIE-INITIALE",
    nom: "Scenario synthetique — story PR3.1a, tresorerieInitialeFCFA",
    dureeCycleMois: 3,
    dateDebutPlan: new Date(2026, 0, 1),
    statut: StatutScenarioPrevision.ACTIF,
    parametres: {
      effectifAlevinsParVague: 0,
      margeSecuriteAlevinsPct: new Decimal(0),
      tauxEpargnePct: new Decimal(0),
      poidsMoyenInitialG: new Decimal(1),
      poidsObjectifG: new Decimal(0),
      prixAlevinUnitaireFCFA: new Decimal(0),
      prixVenteKgFCFA: new Decimal(0),
      nombreBacsSimultanesCible: 1,
      frequenceStockageMois: new Decimal(1),
      transportAliments: transportNul(),
      transportPoissons: transportNul(),
      transportAlevins: transportNul(),
      tresorerieInitialeFCFA: new Decimal(tresorerieInitialeFCFA),
    },
    paliersRemise: [],
    aliments: [],
    vaguesPrevues: [], // aucune vague : isole le solde d'ouverture de toute logique de vague
    postes: [],
    journal: [
      {
        id: "jn-investissement-mois1",
        date: new Date(2026, 1, 15), // moisAbsolu 1 depuis dateDebutPlan (2026-01-01)
        libelle: "Investissement synthetique",
        categorie: CategorieJournalPrevu.INVESTISSEMENT,
        montantFCFA: new Decimal(INVESTISSEMENT_MOIS1_FCFA),
        vaguePrevueId: null,
      },
    ],
    apports: [
      {
        id: "ap-capital-mois0",
        date: new Date(2026, 0, 5), // moisAbsolu 0
        libelle: "Apport synthetique",
        montantFCFA: new Decimal(APPORT_MOIS0_FCFA),
        type: TypeApportCapital.CAPITAL,
        actif: true,
      },
    ],
  };
}

describe("calculerProjectionScenario — tresorerieInitialeFCFA (story PR3.1a, dette 3 pre-analyse PR3)", () => {
  it("Cas A — soldeInitial = 0 (non-regression, comportement historique) : solde[0]=200000, solde[1]=-500000, pointBas=-500000 au mois 1", () => {
    const resultat = calculerProjectionScenario(buildScenario(0));

    expect(resultat.mois[0].soldeFCFA.toNumber()).toBe(200_000);
    expect(resultat.mois[1].soldeFCFA.toNumber()).toBe(-500_000);
    expect(resultat.pointBas?.pointBasFCFA.toNumber()).toBe(-500_000);
    expect(resultat.pointBas?.moisAbsolu).toBe(1);
  });

  it("Cas B — soldeInitial = -500000 (NEGATIF) : toute la serie est translatee EXACTEMENT du solde initial, jamais recalculee autrement", () => {
    const resultat = calculerProjectionScenario(buildScenario(-500_000));

    // solde[m] = soldeInitial + solde[m] du Cas A (translation exacte, pas
    // une nouvelle formule) — verifie mois par mois, montant EN DUR.
    // solde[0] = -500000 + 200000 = -300000
    // solde[1] = -500000 + solde[1](Cas A, = -500000) = -1000000
    expect(resultat.mois[0].soldeFCFA.toNumber()).toBe(-300_000);
    expect(resultat.mois[1].soldeFCFA.toNumber()).toBe(-1_000_000);

    // Le point bas se deplace du MEME montant exact, au MEME mois (translation
    // pure d'une serie dont le minimum ne change pas de position) — preuve
    // que le solde initial entre bien dans calculerPointBasTresorerie via la
    // serie completes, pas seulement dans un des deux mois.
    expect(resultat.pointBas?.pointBasFCFA.toNumber()).toBe(-1_000_000);
    expect(resultat.pointBas?.moisAbsolu).toBe(1);
  });

  it("Cas C — signe : un soldeInitial POSITIF releve la serie entiere (pas de confusion de signe, ERR-160)", () => {
    const resultat = calculerProjectionScenario(buildScenario(1_000_000));

    expect(resultat.mois[0].soldeFCFA.toNumber()).toBe(1_200_000); // 1000000 + 200000
    expect(resultat.mois[1].soldeFCFA.toNumber()).toBe(500_000); // 1000000 + (-700000)
    expect(resultat.pointBas?.pointBasFCFA.toNumber()).toBe(500_000);
    expect(resultat.pointBas?.moisAbsolu).toBe(1);
  });
});
