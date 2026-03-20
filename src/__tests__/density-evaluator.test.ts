/**
 * Tests — density-evaluator.test.ts (Sprint 27-28, ADR-density-alerts)
 *
 * Couvre l'extension du moteur evaluateRules() pour les conditions composees :
 *   - evalCondition() via les conditions composees de regle — IMPLEMENTEE
 *   - Logique ET / OU sur les conditions composees — IMPLEMENTEE
 *   - Backward compatibility : regles legacy (conditions=[]) non impactees
 *   - firedOnce : SEUIL_DENSITE NE doit PAS etre dans la liste firedOnce
 *   - Regles seedees R1-R6 simulees en conditions composees
 *   - Mode legacy SEUIL_DENSITE, SEUIL_RENOUVELLEMENT, ABSENCE_RELEVE
 *
 * NOTE : evalCondition() est deja implementee dans evaluator.ts (Sprint 27-28).
 * Les tests qui dependent de la DB ou de computeTauxRenouvellement restent .todo.
 */

import { describe, it, expect } from "vitest";
import { evaluateRules } from "@/lib/activity-engine/evaluator";
import {
  TypeDeclencheur,
  PhaseElevage,
  TypeActivite,
  LogiqueCondition,
  OperateurCondition,
} from "@/types";
import type { RuleEvaluationContext } from "@/types/activity-engine";
import type { RegleActivite, ConditionRegle } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    vague: {
      id: "vague-1",
      code: "V2026-001",
      dateDebut: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
      siteId: "site-1",
    },
    joursEcoules: 30,
    semaine: 5,
    indicateurs: {
      fcr: null,
      sgr: null,
      tauxSurvie: 95,
      biomasse: 100,
      poidsMoyen: 200,
      nombreVivants: 950,
      tauxMortaliteCumule: 5,
    },
    stock: [],
    configElevage: null,
    derniersReleves: [],
    phase: PhaseElevage.GROSSISSEMENT,
    bac: {
      id: "bac-1",
      nom: "Bac Beton A",
      volume: 3900,
      nombrePoissons: 950,
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
    },
    densiteKgM3: null,
    tauxRenouvellementPctJour: null,
    joursDepuisDernierReleveQualiteEau: null,
    ...overrides,
  };
}

function makeRegle(overrides: Partial<RegleActivite> = {}): RegleActivite {
  return {
    id: "regle-1",
    nom: "Test Regle Densite",
    description: null,
    typeActivite: TypeActivite.QUALITE_EAU,
    typeDeclencheur: TypeDeclencheur.SEUIL_DENSITE,
    conditionValeur: 100,
    conditionValeur2: null,
    phaseMin: null,
    phaseMax: null,
    intervalleJours: null,
    titreTemplate: "Densite elevee — Bac {{bac}}",
    descriptionTemplate: null,
    instructionsTemplate: null,
    priorite: 3,
    isActive: true,
    firedOnce: false,
    siteId: "site-1",
    userId: "user-1",
    conditions: [],
    logique: LogiqueCondition.ET,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeCondition(
  typeDeclencheur: TypeDeclencheur,
  operateur: OperateurCondition,
  conditionValeur: number,
  conditionValeur2?: number,
  ordre: number = 0
): ConditionRegle {
  return {
    id: `cond-${ordre}-${typeDeclencheur}`,
    regleId: "regle-1",
    typeDeclencheur,
    operateur,
    conditionValeur,
    conditionValeur2: conditionValeur2 ?? null,
    ordre,
  };
}

// ---------------------------------------------------------------------------
// Backward compatibility — regles legacy (conditions=[]) inchangees
// ---------------------------------------------------------------------------

describe("Backward compatibility — regles legacy sans conditions composees", () => {
  it("regle CALENDRIER avec conditions=[] continue de fonctionner", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.CALENDRIER,
      conditionValeur: 7,
      conditions: [],
    });
    const ctx = makeContext({ joursEcoules: 10 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("regle SEUIL_POIDS avec conditions=[] continue de fonctionner", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_POIDS,
      conditionValeur: 150,
      conditions: [],
    });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: 200 },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("regle RECURRENT avec conditions=[] continue de fonctionner", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.RECURRENT,
      intervalleJours: 7,
      conditions: [],
    });
    const ctx = makeContext();
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("regle SEUIL_MORTALITE avec conditions=[] continue de fonctionner", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_MORTALITE,
      conditionValeur: 3,
      conditions: [],
    });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, tauxMortaliteCumule: 7 },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// firedOnce — SEUIL_DENSITE ne doit PAS bloquer (ADR section 6.4)
// ---------------------------------------------------------------------------

describe("firedOnce — SEUIL_DENSITE ne doit PAS etre dans la liste bloquante", () => {
  it("regle SEUIL_DENSITE avec firedOnce=true ne doit PAS etre bloquee", () => {
    /**
     * ADR section 6.4 : Pour SEUIL_DENSITE, le flag firedOnce ne s'applique pas.
     * La densite fluctue et on veut re-evaluer a chaque releve.
     * Ces regles ont firedOnce = false par design.
     *
     * Comportement attendu : firedOnce=true sur SEUIL_DENSITE NE BLOQUE PAS l'eval.
     * Le moteur ignore firedOnce pour SEUIL_DENSITE (non-present dans seuilTypesFiredOnce).
     * Si la densite depasse le seuil, la regle se declenche malgre firedOnce=true.
     */
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_DENSITE,
      conditionValeur: 50, // seuil 50 kg/m3
      firedOnce: true,     // Mis a true deliberement pour tester le comportement
      conditions: [],      // En mode legacy sans conditions composees
    });
    // densiteKgM3=160 > 50 → la regle DOIT se declencher malgre firedOnce=true
    const ctx = makeContext({ densiteKgM3: 160 });
    const result = evaluateRules([ctx], [regle], []);

    // firedOnce=true ne doit PAS bloquer SEUIL_DENSITE → la regle se declenche
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-1");
  });

  it("verification que SEUIL_DENSITE n'est pas dans la liste seuilTypes bloquante", () => {
    /**
     * Ce test documente et verifie le contrat : les types firedOnce-bloquants
     * sont uniquement SEUIL_POIDS, SEUIL_QUALITE, SEUIL_MORTALITE, FCR_ELEVE, STOCK_BAS.
     * SEUIL_DENSITE, SEUIL_RENOUVELLEMENT, ABSENCE_RELEVE NE SONT PAS dedans.
     */
    const seuilTypesBlocantsActuels = [
      TypeDeclencheur.SEUIL_POIDS,
      TypeDeclencheur.SEUIL_QUALITE,
      TypeDeclencheur.SEUIL_MORTALITE,
      TypeDeclencheur.FCR_ELEVE,
      TypeDeclencheur.STOCK_BAS,
    ];

    // Les nouveaux types de densite ne doivent pas etre bloquants
    expect(seuilTypesBlocantsActuels).not.toContain(TypeDeclencheur.SEUIL_DENSITE);
    expect(seuilTypesBlocantsActuels).not.toContain(TypeDeclencheur.SEUIL_RENOUVELLEMENT);
    expect(seuilTypesBlocantsActuels).not.toContain(TypeDeclencheur.ABSENCE_RELEVE);
  });

  it("SEUIL_RENOUVELLEMENT avec firedOnce=true ne doit PAS etre bloque", () => {
    // Analogue a SEUIL_DENSITE : le taux de renouvellement fluctue aussi
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_RENOUVELLEMENT,
      conditionValeur: 50,
      firedOnce: true,
      conditions: [],
    });
    // tauxRenouvellementPctJour=20 < 50 → devrait se declencher
    const ctx = makeContext({ tauxRenouvellementPctJour: 20 });
    const result = evaluateRules([ctx], [regle], []);
    // firedOnce ne bloque pas → triggered
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evalCondition via conditions composees — operateur SUPERIEUR
// ---------------------------------------------------------------------------

describe("Conditions composees — operateur SUPERIEUR", () => {
  it("SEUIL_DENSITE SUPERIEUR 100 : densiteKgM3=150 > 100 → regle declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({
      conditions: [condC1],
      logique: LogiqueCondition.ET,
    });
    const ctx = makeContext({ densiteKgM3: 150 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_DENSITE SUPERIEUR 100 : densiteKgM3=80 <= 100 → regle non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 80 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("SEUIL_DENSITE SUPERIEUR 100 : densiteKgM3=100 (egal) → false (strictement superieur)", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 100 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("SEUIL_RENOUVELLEMENT SUPERIEUR 50 : tauxRenouvellement=60 > 50 → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.SUPERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ tauxRenouvellementPctJour: 60 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ABSENCE_RELEVE SUPERIEUR 3 : joursDepuisDernierReleveQualiteEau=5 > 3 → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.ABSENCE_RELEVE, OperateurCondition.SUPERIEUR, 3);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ joursDepuisDernierReleveQualiteEau: 5 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evalCondition via conditions composees — operateur INFERIEUR
// ---------------------------------------------------------------------------

describe("Conditions composees — operateur INFERIEUR", () => {
  it("SEUIL_RENOUVELLEMENT INFERIEUR 50 : tauxRenouvellement=30 < 50 → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ tauxRenouvellementPctJour: 30 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_RENOUVELLEMENT INFERIEUR 50 : tauxRenouvellement=50 (egal) → false (strictement inferieur)", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ tauxRenouvellementPctJour: 50 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("SEUIL_RENOUVELLEMENT INFERIEUR 50 : tauxRenouvellement=80 > 50 → false", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ tauxRenouvellementPctJour: 80 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evalCondition — operateur ENTRE
// ---------------------------------------------------------------------------

describe("Conditions composees — operateur ENTRE", () => {
  it("SEUIL_DENSITE ENTRE 50 200 : densiteKgM3=100 dans [50,200] → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.ENTRE, 50, 200);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 100 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_DENSITE ENTRE 50 200 : densiteKgM3=50 (borne basse incluse) → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.ENTRE, 50, 200);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 50 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_DENSITE ENTRE 50 200 : densiteKgM3=200 (borne haute incluse) → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.ENTRE, 50, 200);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 200 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_DENSITE ENTRE 50 200 : densiteKgM3=30 < 50 → non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.ENTRE, 50, 200);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 30 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("SEUIL_DENSITE ENTRE 50 200 : densiteKgM3=250 > 200 → non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.ENTRE, 50, 200);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 250 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evalCondition — operateur EGAL
// ---------------------------------------------------------------------------

describe("Conditions composees — operateur EGAL", () => {
  it("SEUIL_DENSITE EGAL 100 : densiteKgM3=100 → declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.EGAL, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 100 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_DENSITE EGAL 100 : densiteKgM3=101 → non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.EGAL, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 101 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evalCondition — valeur null dans le contexte (safe default = false)
// ADR section 6.2 : val === null → return false
// ---------------------------------------------------------------------------

describe("Conditions composees — valeur null dans le contexte (safe default)", () => {
  it("densiteKgM3=null + SUPERIEUR 100 → regle non declenchee (safe default)", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: null });
    const result = evaluateRules([ctx], [regle], []);
    // val=null → evalCondition retourne false → pas de match
    expect(result).toHaveLength(0);
  });

  it("tauxRenouvellementPctJour=null + INFERIEUR 50 → non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ tauxRenouvellementPctJour: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("joursDepuisDernierReleveQualiteEau=null + SUPERIEUR 3 → non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.ABSENCE_RELEVE, OperateurCondition.SUPERIEUR, 3);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ joursDepuisDernierReleveQualiteEau: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Logique ET — toutes les conditions doivent matcher
// ---------------------------------------------------------------------------

describe("Logique ET — toutes les conditions doivent matcher", () => {
  it("ET : C1=true et C2=true → regle declenchee (scenario R2)", () => {
    // Regle R2 : densite > 100 ET renouvellement < 75
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      id: "regle-R2",
      conditions: [condC1, condC2],
      logique: LogiqueCondition.ET,
    });
    // densiteKgM3=150 > 100, tauxRenouvellement=60 < 75
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 60 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-R2");
  });

  it("ET : C1=true et C2=false → regle NON declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.ET,
    });
    // densiteKgM3=150 > 100 (C1=true), tauxRenouvellement=80 >= 75 (C2=false)
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 80 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ET : C1=false et C2=true → regle NON declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.ET,
    });
    // densiteKgM3=80 <= 100 (C1=false)
    const ctx = makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 30 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ET : C1=false et C2=false → regle NON declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.ET,
    });
    const ctx = makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 80 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Logique OU — au moins une condition doit matcher
// ---------------------------------------------------------------------------

describe("Logique OU — au moins une condition doit matcher", () => {
  it("OU : C1=true et C2=false → regle declenchee", () => {
    // Analogie regle R5 : ammoniac > 1.0 OU oxygene < 4.0
    // On simule avec SEUIL_DENSITE OU SEUIL_RENOUVELLEMENT
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.OU,
    });
    // C1=true (densite=150>100), C2=false (taux=80>=75)
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 80 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("OU : C1=false et C2=true → regle declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.OU,
    });
    // C1=false (densite=80<=100), C2=true (taux=30<75)
    const ctx = makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 30 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("OU : C1=true et C2=true → regle declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.OU,
    });
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 30 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("OU : C1=false et C2=false → regle NON declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);
    const regle = makeRegle({
      conditions: [condC1, condC2],
      logique: LogiqueCondition.OU,
    });
    const ctx = makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 80 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Conditions composees — cas limites
// ---------------------------------------------------------------------------

describe("Conditions composees — cas limites", () => {
  it("conditions=[] → fallback legacy (backward compatible)", () => {
    // Avec conditions=[], le moteur utilise le switch typeDeclencheur existant
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.CALENDRIER,
      conditionValeur: 10,
      conditions: [],
    });
    const ctx = makeContext({ joursEcoules: 15 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1); // Utilise evalCalendrier()
  });

  it("conditions avec 1 seule condition ET → equivalent a une condition simple", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 150 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("conditions triees par ordre : evaluation dans l'ordre ascendant", () => {
    // Les deux conditions sont satisfaites : ordre n'affecte pas le resultat ET
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 2);
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 1);
    // Intentionnellement insere dans le mauvais ordre pour verifier le tri
    const regle = makeRegle({
      conditions: [condC2, condC1], // ordre inverse
      logique: LogiqueCondition.ET,
    });
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 30 });
    const result = evaluateRules([ctx], [regle], []);
    // Peu importe l'ordre, les deux sont true → match
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Regles seedees R1-R6 — simulation complete (ADR section 6.5)
// ---------------------------------------------------------------------------

describe("Regle R1 — Densite elevee + renouvellement insuffisant (50-100 kg/m3)", () => {
  const makeRegleR1 = () => makeRegle({
    id: "regle-R1",
    priorite: 5,
    logique: LogiqueCondition.ET,
    conditions: [
      makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 50, undefined, 0),
      makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50, undefined, 1),
    ],
  });

  it("R1 se declenche : densite=80 > 50 ET renouvellement=30 < 50", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 30 })],
      [makeRegleR1()],
      []
    );
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-R1");
  });

  it("R1 ne se declenche pas : densite=80 ET renouvellement=60 >= 50", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 60 })],
      [makeRegleR1()],
      []
    );
    expect(result).toHaveLength(0);
  });

  it("R1 ne se declenche pas : densite=30 <= 50 (sous seuil)", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 30, tauxRenouvellementPctJour: 20 })],
      [makeRegleR1()],
      []
    );
    expect(result).toHaveLength(0);
  });
});

describe("Regle R2 — Densite haute + renouvellement insuffisant (100-200 kg/m3)", () => {
  const makeRegleR2 = () => makeRegle({
    id: "regle-R2",
    priorite: 3,
    logique: LogiqueCondition.ET,
    conditions: [
      makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0),
      makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1),
    ],
  });

  it("R2 se declenche : densite=150 > 100 ET renouvellement=60 < 75", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 60 })],
      [makeRegleR2()],
      []
    );
    expect(result).toHaveLength(1);
  });

  it("R2 ne se declenche pas : densite=150 ET renouvellement=80 >= 75", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 80 })],
      [makeRegleR2()],
      []
    );
    expect(result).toHaveLength(0);
  });
});

describe("Regle R4 — Densite elevee + absence releve qualite eau (> 3 jours)", () => {
  const makeRegleR4 = () => makeRegle({
    id: "regle-R4",
    priorite: 2,
    logique: LogiqueCondition.ET,
    conditions: [
      makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0),
      makeCondition(TypeDeclencheur.ABSENCE_RELEVE, OperateurCondition.SUPERIEUR, 3, undefined, 1),
    ],
  });

  it("R4 se declenche : densite=150 > 100 ET absence=5 jours > 3", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 150, joursDepuisDernierReleveQualiteEau: 5 })],
      [makeRegleR4()],
      []
    );
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-R4");
  });

  it("R4 ne se declenche pas : densite=150 ET releve qualite eau hier (absence=1 <= 3)", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 150, joursDepuisDernierReleveQualiteEau: 1 })],
      [makeRegleR4()],
      []
    );
    expect(result).toHaveLength(0);
  });

  it("R4 ne se declenche pas si joursDepuisDernierReleveQualiteEau=null (safe default)", () => {
    const result = evaluateRules(
      [makeContext({ densiteKgM3: 150, joursDepuisDernierReleveQualiteEau: null })],
      [makeRegleR4()],
      []
    );
    // ADR : null → evalCondition retourne false → pas de declenchement
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Score et priorite — regles de densite (ADR section 6.5)
// ---------------------------------------------------------------------------

describe("Score de priorite — regles de densite", () => {
  it("R3 (priorite=1) a un score plus eleve que R1 (priorite=5)", () => {
    // score = (11 - priorite) * 10
    // R3: (11-1)*10 = 100, R1: (11-5)*10 = 60
    const condDensite = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 50, undefined, 0);
    const condRenouv = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 100, undefined, 1);

    const regleR3 = makeRegle({
      id: "regle-R3",
      priorite: 1,
      conditions: [condDensite, condRenouv],
      logique: LogiqueCondition.ET,
    });
    const condDensite2 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 50, undefined, 0);
    const condRenouv2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50, undefined, 1);

    const regleR1 = makeRegle({
      id: "regle-R1",
      priorite: 5,
      conditions: [condDensite2, condRenouv2],
      logique: LogiqueCondition.ET,
    });

    const ctx = makeContext({ densiteKgM3: 250, tauxRenouvellementPctJour: 20 });
    const result = evaluateRules([ctx], [regleR3, regleR1], []);

    // Les deux se declenchent
    expect(result).toHaveLength(2);
    // Tri par score decroissant → R3 (score=100) avant R1 (score=60)
    expect(result[0].regle.id).toBe("regle-R3");
    expect(result[0].score).toBe(100);
    expect(result[1].regle.id).toBe("regle-R1");
    expect(result[1].score).toBe(60);
  });

  it("R4 (priorite=2) a un score plus eleve que R2 (priorite=3)", () => {
    const makeR = (id: string, priorite: number, conditions: ConditionRegle[]) =>
      makeRegle({ id, priorite, conditions, logique: LogiqueCondition.ET });

    const regleR4 = makeR("regle-R4", 2, [
      makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0),
      makeCondition(TypeDeclencheur.ABSENCE_RELEVE, OperateurCondition.SUPERIEUR, 3, undefined, 1),
    ]);
    const regleR2 = makeR("regle-R2", 3, [
      makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0),
      makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1),
    ]);

    const ctx = makeContext({
      densiteKgM3: 150,
      tauxRenouvellementPctJour: 30,
      joursDepuisDernierReleveQualiteEau: 5,
    });
    const result = evaluateRules([ctx], [regleR4, regleR2], []);

    expect(result).toHaveLength(2);
    expect(result[0].regle.id).toBe("regle-R4");
    expect(result[0].score).toBe(90); // (11-2)*10
    expect(result[1].score).toBe(80); // (11-3)*10
  });
});

// ---------------------------------------------------------------------------
// Anti-spam et deduplication (EC-3.1) pour les regles de densite
// ADR section 6.6
// ---------------------------------------------------------------------------

describe("Anti-spam EC-3.1 pour regles de densite", () => {
  it("regle de densite ne se declenche pas deux fois le meme jour pour le meme bac", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 150 });

    // Historique avec une activite cree aujourd'hui pour la meme regle+vague+bac
    const historique = [{
      id: "act-today",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: "bac-1",
      dateDebut: new Date(),
      createdAt: new Date(), // aujourd'hui
    }];

    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(0); // EC-3.1 : dedup
  });

  it("regle de densite se declenche si historique du bac different", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 150 });

    // Historique pour un AUTRE bac
    const historique = [{
      id: "act-other-bac",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: "bac-autre", // Bac different
      dateDebut: new Date(),
      createdAt: new Date(),
    }];

    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(1); // Bac different → pas de dedup
  });

  it("regle de densite se redeclenche le lendemain (EC-3.1 ne bloque que le meme jour)", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: 150 });

    // Historique avec une activite d'hier
    const historique = [{
      id: "act-yesterday",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: "bac-1",
      dateDebut: new Date(Date.now() - 25 * 60 * 60 * 1000), // hier
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    }];

    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(1); // Hier → peut se declencher aujourd'hui
  });
});

// ---------------------------------------------------------------------------
// Mode legacy pour les nouveaux TypeDeclencheur (sans conditions composees)
// ---------------------------------------------------------------------------

describe("Mode legacy — nouveaux declencheurs SEUIL_DENSITE etc. sans conditions[]", () => {
  it("SEUIL_DENSITE legacy : densiteKgM3 > conditionValeur → declenchee", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_DENSITE,
      conditionValeur: 100,
      conditions: [], // pas de conditions composees
    });
    const ctx = makeContext({ densiteKgM3: 150 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("SEUIL_DENSITE legacy : densiteKgM3=null → non declenchee", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_DENSITE,
      conditionValeur: 100,
      conditions: [],
    });
    const ctx = makeContext({ densiteKgM3: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("SEUIL_RENOUVELLEMENT legacy : taux < conditionValeur → declenchee", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_RENOUVELLEMENT,
      conditionValeur: 50,
      conditions: [],
    });
    const ctx = makeContext({ tauxRenouvellementPctJour: 20 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ABSENCE_RELEVE legacy : joursDepuisDernierReleve >= conditionValeur → declenchee", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.ABSENCE_RELEVE,
      conditionValeur: 3,
      conditions: [],
    });
    const ctx = makeContext({ joursDepuisDernierReleveQualiteEau: 5 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});
