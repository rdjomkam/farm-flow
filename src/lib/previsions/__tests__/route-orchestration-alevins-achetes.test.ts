/**
 * Tests d'INTEGRATION synthetiques (@tester, story PR2oct.3 — MOTEUR) de la
 * branche `alevinsAchetes = true` de `calculerProjectionScenario`
 * (`route-orchestration.ts`), ERR-170 / ADR-053 §14.
 *
 * RAISON D'ETRE — pre-analyse §7 / ADR-053 §14.6 : les DEUX fixtures du jeu
 * d'or (`plan-v12-corrige.json`, `annexe-b-corrigee.json`) portent
 * `alevinsAchetes: "NON"` sur leurs 19 vagues, sans exception. Aucune recette
 * ne peut donc exercer la branche `true` de `cout_alevins(vague) =
 * alevins_achetes ? nb_alevins x prix_alevin : 0` (§5.3 des exigences) — ce
 * fichier construit un `ScenarioPourCalcul` synthetique a la main, sans
 * passer par les fixtures ni les builders de recette, exactement le patron
 * deja etabli par `route-orchestration-detail-consommation.test.ts` (ERR-160,
 * meme famille de piege : un jeu d'or qui ne varie jamais sur un axe ne peut
 * pas prouver le comportement sur cet axe).
 *
 * REGLE SACREE (identique a la recette) : chaque montant attendu ci-dessous
 * est calcule A LA MAIN et ecrit EN DUR — jamais recalcule par une
 * reimplementation independante de la formule sous test.
 *
 * Aucune remise n'est appliquee au cout d'achat des alevins (reserve
 * documentee, pre-analyse §2 / ADR-053 §14.2) : `paliersRemise` est laisse
 * vide, sans consequence sur ce terme.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { calculerProjectionScenario } from "../route-orchestration";
import { StatutScenarioPrevision, StatutVaguePrevue } from "@/types";
import type { ScenarioPourCalcul, VaguePrevuePourCalcul } from "@/lib/queries/previsions-scenario-loader";

/** Poissons vises a la vente en fin de cycle (= D, ADR-053 vocabulaire PR2bis.3). */
const EFFECTIF_ALEVINS_PREVU = 10_000;
/** Marge de securite (%, echelle 0..100) — absorbe la mortalite au demarrage. */
const MARGE_SECURITE_PCT = 10;
/** Prix unitaire d'un alevin achete. */
const PRIX_ALEVIN_UNITAIRE_FCFA = 70;

/**
 * alevinsACommanderNb = calculerAlevinsACommander(10000, 10%)
 *                     = ceil(10000 * (1 + 10/100)) = ceil(11000) = 11000
 * (moteur pur `plan.ts`, deja recette isolement — non revalide ici, cf.
 * pre-analyse §7).
 */
const ALEVINS_A_COMMANDER_NB = 11_000;

/**
 * Cas A / pre-analyse §7 : coutAlevinsFCFA attendu = 11000 x 70 = 770 000
 * FCFA exactement (aucune remise, §2 de la pre-analyse).
 */
const COUT_ALEVINS_ACHETES_FCFA = 770_000;

const CAPACITE_TRANSPORT_ALEVINS = 20_000;
const COUT_UNITAIRE_TRANSPORT_ALEVINS_FCFA = 45_000;

function transportNul() {
  return { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) };
}

/** Construit une VaguePrevuePourCalcul minimale, stockee au mois absolu 0. */
function buildVague(overrides: Partial<VaguePrevuePourCalcul> = {}): VaguePrevuePourCalcul {
  return {
    id: overrides.id ?? "vp-1",
    code: overrides.code ?? "V1",
    dateStockagePrevue: new Date(2026, 0, 1),
    effectifAlevinsPrevu: EFFECTIF_ALEVINS_PREVU,
    poidsMoyenInitialG: new Decimal(1),
    dureeCycleMoisFigee: 3,
    statut: StatutVaguePrevue.PLANIFIEE,
    vaguePrevueParentId: null,
    vagueReelleId: null,
    alimentsParMois: [],
    alevinsAchetes: false,
    ...overrides,
  };
}

function buildScenario(vaguesPrevues: VaguePrevuePourCalcul[]): ScenarioPourCalcul {
  return {
    id: "scenario-synthetique-alevins-achetes",
    code: "SCN-ALEVINS-ACHETES",
    nom: "Scenario synthetique — ERR-170 / ADR-053 §14, alevinsAchetes",
    dureeCycleMois: 3,
    dateDebutPlan: new Date(2026, 0, 1),
    statut: StatutScenarioPrevision.ACTIF,
    parametres: {
      effectifAlevinsParVague: 0, // non consomme par calculerProjectionScenario
      margeSecuriteAlevinsPct: new Decimal(MARGE_SECURITE_PCT),
      tauxEpargnePct: new Decimal(0),
      poidsMoyenInitialG: new Decimal(1),
      poidsObjectifG: new Decimal(0), // 0 -> revenuPrevuFCFA/biomasseKg neutres, hors sujet ici
      prixAlevinUnitaireFCFA: new Decimal(PRIX_ALEVIN_UNITAIRE_FCFA),
      prixVenteKgFCFA: new Decimal(0),
      nombreBacsSimultanesCible: 1,
      frequenceStockageMois: new Decimal(1),
      transportAliments: transportNul(),
      transportPoissons: transportNul(),
      transportAlevins: {
        capacite: new Decimal(CAPACITE_TRANSPORT_ALEVINS),
        coutUnitaireFCFA: new Decimal(COUT_UNITAIRE_TRANSPORT_ALEVINS_FCFA),
      },
    },
    paliersRemise: [],
    aliments: [], // aucun aliment : coutAlimentFCFA neutre, hors sujet de ce fichier
    vaguesPrevues,
    postes: [],
    journal: [],
    apports: [],
  };
}

describe("calculerProjectionScenario — alevinsAchetes (ERR-170 / ADR-053 §14, pre-analyse §7)", () => {
  it("Cas A — alevinsAchetes = true : coutAlevinsFCFA == 11000 x 70 = 770 000 FCFA exactement", () => {
    const scenario = buildScenario([buildVague({ alevinsAchetes: true })]);
    const resultat = calculerProjectionScenario(scenario);
    const vague = resultat.vagues[0];

    expect(vague.alevinsACommanderNb).toBe(ALEVINS_A_COMMANDER_NB);
    expect(vague.coutAlevinsFCFA.toNumber()).toBe(COUT_ALEVINS_ACHETES_FCFA);
  });

  it("Cas B — alevinsAchetes = false : coutAlevinsFCFA == 0 (non-regression, meme entrees que le cas A par ailleurs)", () => {
    const scenario = buildScenario([buildVague({ alevinsAchetes: false })]);
    const resultat = calculerProjectionScenario(scenario);
    const vague = resultat.vagues[0];

    // Le COMPTE (alevinsACommanderNb) reste calcule inconditionnellement
    // (pre-analyse §2/§3) — seul le COUT d'achat est gate.
    expect(vague.alevinsACommanderNb).toBe(ALEVINS_A_COMMANDER_NB);
    expect(vague.coutAlevinsFCFA.toNumber()).toBe(0);
  });

  it("Cas C — deux vagues du meme mois de stockage, l'une alevinsAchetes=true l'autre false : le mois calendaire ne porte que le cout de la vague TRUE (ni la somme des deux, ni zero)", () => {
    const scenario = buildScenario([
      buildVague({ id: "vp-true", code: "V-TRUE", alevinsAchetes: true }),
      buildVague({ id: "vp-false", code: "V-FALSE", alevinsAchetes: false }),
    ]);
    const resultat = calculerProjectionScenario(scenario);

    // Les deux vagues sont stockees au mois absolu 0 (meme dateStockagePrevue
    // que dateDebutPlan) — le mois 0 agrege donc bien les deux.
    const moisStockage = resultat.mois[0];

    // Chaque vague individuellement se comporte comme les cas A/B ci-dessus...
    const vagueTrue = resultat.vagues.find((v) => v.code === "V-TRUE")!;
    const vagueFalse = resultat.vagues.find((v) => v.code === "V-FALSE")!;
    expect(vagueTrue.coutAlevinsFCFA.toNumber()).toBe(COUT_ALEVINS_ACHETES_FCFA);
    expect(vagueFalse.coutAlevinsFCFA.toNumber()).toBe(0);

    // ...et l'agregat calendaire du mois n'est ni 0 (round-then-... gate en
    // silence les deux) ni 2 x 770 000 (la vague false contribuerait a tort) :
    // exactement le cout de la seule vague TRUE.
    expect(moisStockage.coutAlevinsFCFA.toNumber()).toBe(COUT_ALEVINS_ACHETES_FCFA);
  });

  it("Cas D — alevinsAchetes = false : le TRANSPORT des alevins reste non nul (ADR-053 §14.5/§3 — le gate ne s'applique JAMAIS a la logistique)", () => {
    const scenario = buildScenario([buildVague({ alevinsAchetes: false })]);
    const resultat = calculerProjectionScenario(scenario);
    const moisStockage = resultat.mois[0];

    // voyagesAlevins = calculerVoyages(11000, capacite=20000) = ceil(11000/20000) = 1
    expect(moisStockage.logistique.voyagesAlevins).toBe(1);
    // coutTransportAlevins = 1 x 45000 = 45000 FCFA, entre dans sousTotalFCFA
    // (aucun autre poste de logistique n'est actif : aliments/poissons a 0).
    expect(moisStockage.logistique.sousTotalFCFA.toNumber()).toBe(45_000);

    // Preuve directe, au meme grain que le Cas B, que ce non-zero n'est PAS
    // un residu du cout d'ACHAT (qui, lui, est bien gate a 0 sur ce meme cas) :
    // les deux notions homonymes "coutAlevinsFCFA" (achat, route-orchestration.ts
    // vs transport, logistique.ts) restent bien distinctes.
    expect(moisStockage.coutAlevinsFCFA.toNumber()).toBe(0);
  });
});
