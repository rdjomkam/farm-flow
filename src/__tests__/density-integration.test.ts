/**
 * Tests — density-integration.test.ts (Sprint 27-28, ADR-density-alerts)
 *
 * Scenarios d'integration combinant :
 *   - Le calcul de densite per-bac (computeVivantsByBac + calculerDensite existante)
 *   - L'evaluateur de regles (evaluateRules existant + extension conditions composees)
 *   - Les regles seedees R1-R6 de la matrice densite x qualite eau (ADR section 6.5)
 *   - Le TypeReleve RENOUVELLEMENT et le contexte etendu
 *
 * NOTE : Les scenarios R1-R6 avec conditions composees sont marques .todo
 * (implementation en attente). Les scenarios utilisant les fonctions existantes
 * sont implementes et passent immediatement.
 *
 * Scenarios :
 *   S1 — Alerte escalation densite (R2 : densite > 100 + renouvellement < 75)
 *   S2 — Detection croisee (R4 : densite elevee + absence releve qualite eau)
 *   S3 — Qualite eau degradee avec ammoniac (R6)
 *   S4 — TypeReleve RENOUVELLEMENT : stockage et calcul
 *   S5 — Pas d'alerte si conditions non remplies
 */

import { describe, it, expect } from "vitest";
import { evaluateRules } from "@/lib/activity-engine/evaluator";
import { computeVivantsByBac } from "@/lib/calculs";
import {
  TypeDeclencheur,
  PhaseElevage,
  TypeActivite,
  LogiqueCondition,
  OperateurCondition,
  TypeReleve,
} from "@/types";
import type { RuleEvaluationContext } from "@/types/activity-engine";
import type { RegleActivite, ConditionRegle } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBacContext(overrides: {
  id?: string;
  nom?: string;
  volume?: number | null;
  nombrePoissons?: number | null;
  nombreInitial?: number | null;
} = {}) {
  return {
    id: overrides.id ?? "bac-1",
    nom: overrides.nom ?? "Bac Beton A",
    volume: overrides.volume !== undefined ? overrides.volume : 3900, // 3.9 m3
    nombrePoissons: overrides.nombrePoissons ?? 950,
    nombreInitial: overrides.nombreInitial ?? 1000,
    poidsMoyenInitial: 5,
  };
}

function makeContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    vague: {
      id: "vague-1",
      code: "V2026-001",
      dateDebut: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60j
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
      siteId: "site-1",
    },
    joursEcoules: 60,
    semaine: 9,
    indicateurs: {
      fcr: 1.5,
      sgr: 2.0,
      tauxSurvie: 95,
      biomasse: 190,
      poidsMoyen: 200,
      nombreVivants: 950,
      tauxMortaliteCumule: 5,
    },
    stock: [],
    configElevage: null,
    derniersReleves: [],
    phase: PhaseElevage.GROSSISSEMENT,
    bac: makeBacContext(),
    densiteKgM3: null,
    tauxRenouvellementPctJour: null,
    joursDepuisDernierReleveQualiteEau: null,
    ...overrides,
  };
}

function makeRegle(overrides: Partial<RegleActivite> = {}): RegleActivite {
  return {
    id: "regle-1",
    nom: "Test Regle",
    description: null,
    typeActivite: TypeActivite.QUALITE_EAU,
    typeDeclencheur: TypeDeclencheur.SEUIL_DENSITE,
    conditionValeur: 100,
    conditionValeur2: null,
    phaseMin: null,
    phaseMax: null,
    intervalleJours: null,
    titreTemplate: "Alerte densite Bac {{bac}}",
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
// Scenario 1 — Calcul de densite correct et evaluation du contexte
// ---------------------------------------------------------------------------

describe("S1 — Calcul de densite per-bac : integration computeVivantsByBac", () => {
  it("bac beton commercial Nigeria : 400 poissons x 375g dans 3.9m3 → ~38.5 kg/m3", () => {
    // Scenario de reference (litterature nigeriane)
    // En-dessous du seuil alerte bac beton (150 kg/m3)
    const bacs = [{ id: "bac-1", nombreInitial: 400 }];
    const releves: Array<{
      bacId: string | null;
      typeReleve: string;
      nombreMorts: number | null;
      nombreCompte: number | null;
    }> = [];

    const vivants = computeVivantsByBac(bacs, releves, 400);
    const vivantsBac1 = vivants.get("bac-1") ?? 0;
    const biomasse = (375 * vivantsBac1) / 1000; // kg
    const volumeM3 = 3900 / 1000;
    const densite = biomasse / volumeM3;

    expect(vivantsBac1).toBe(400);
    expect(biomasse).toBe(150);
    expect(densite).toBeCloseTo(38.46, 1);

    // En-dessous du seuil alerte bac beton (150 kg/m3) → pas d'alerte R2
    expect(densite).toBeLessThan(100);
  });

  it("bac en surcharge : 500 poissons x 400g dans 1m3 → 200 kg/m3 (critique bac beton)", () => {
    const bacs = [{ id: "bac-surcharge", nombreInitial: 500 }];
    const releves: Array<{
      bacId: string | null;
      typeReleve: string;
      nombreMorts: number | null;
      nombreCompte: number | null;
    }> = [];

    const vivants = computeVivantsByBac(bacs, releves, 500);
    const biomasse = (400 * (vivants.get("bac-surcharge") ?? 0)) / 1000;
    const volumeM3 = 1000 / 1000;
    const densite = biomasse / volumeM3;

    expect(densite).toBe(200);
    // Au seuil critique bac beton (200 kg/m3)
    expect(densite).toBeGreaterThanOrEqual(200);
  });

  it("apres mortalites : vivants reduits → densite reduite", () => {
    const bacs = [{ id: "bac-1", nombreInitial: 1000 }];
    const releves = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 200, nombreCompte: null },
    ];

    const vivants = computeVivantsByBac(bacs, releves, 1000);
    const vivantsBac = vivants.get("bac-1") ?? 0;

    expect(vivantsBac).toBe(800); // 1000 - 200

    const biomasse = (300 * vivantsBac) / 1000;
    const volumeM3 = 2000 / 1000; // 2m3
    const densiteApres = biomasse / volumeM3;
    // 300g * 800 / 1000 = 240kg / 2m3 = 120 kg/m3
    expect(densiteApres).toBe(120);
  });

  it("contexte avec densiteKgM3 pre-calcule : accessible dans RuleEvaluationContext", () => {
    // Verifie que le champ densiteKgM3 est bien disponible dans le contexte
    const ctx = makeContext({ densiteKgM3: 160 });
    expect(ctx.densiteKgM3).toBe(160);
    expect(ctx.tauxRenouvellementPctJour).toBeNull();
    expect(ctx.joursDepuisDernierReleveQualiteEau).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Regle R2 (conditions composees, a implementer)
// ADR : logique ET, C1=SEUIL_DENSITE>100, C2=SEUIL_RENOUVELLEMENT<75
// ---------------------------------------------------------------------------

describe("S2 — Regle R2 : densite haute + renouvellement insuffisant", () => {
  function makeRegleR2() {
    return makeRegle({
      id: "regle-R2",
      priorite: 3,
      logique: LogiqueCondition.ET,
      conditions: [
        makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0),
        makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1),
      ],
    });
  }

  it("R2 se declenche : densite=150 kg/m3 + renouvellement=60%/j", () => {
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 60 });
    const result = evaluateRules([ctx], [makeRegleR2()], []);
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-R2");
  });

  it("R2 ne se declenche pas si renouvellement suffisant (80%/j)", () => {
    const ctx = makeContext({ densiteKgM3: 150, tauxRenouvellementPctJour: 80 });
    const result = evaluateRules([ctx], [makeRegleR2()], []);
    expect(result).toHaveLength(0);
  });

  it("R2 ne se declenche pas si densite insuffisante (80 kg/m3)", () => {
    const ctx = makeContext({ densiteKgM3: 80, tauxRenouvellementPctJour: 30 });
    const result = evaluateRules([ctx], [makeRegleR2()], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Detection croisee R4 : densite + absence releve QE
// ADR : logique ET, C1=SEUIL_DENSITE>100, C2=ABSENCE_RELEVE>3
// ---------------------------------------------------------------------------

describe("S3 — Regle R4 : densite elevee + absence releve qualite eau", () => {
  function makeRegleR4() {
    return makeRegle({
      id: "regle-R4",
      priorite: 2,
      logique: LogiqueCondition.ET,
      conditions: [
        makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0),
        makeCondition(TypeDeclencheur.ABSENCE_RELEVE, OperateurCondition.SUPERIEUR, 3, undefined, 1),
      ],
    });
  }

  it("R4 se declenche : densite=120 > 100 ET 5 jours sans releve qualite eau", () => {
    const ctx = makeContext({ densiteKgM3: 120, joursDepuisDernierReleveQualiteEau: 5 });
    const result = evaluateRules([ctx], [makeRegleR4()], []);
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-R4");
  });

  it("R4 ne se declenche pas : densite=120 ET releve qualite eau hier (1 jour)", () => {
    const ctx = makeContext({ densiteKgM3: 120, joursDepuisDernierReleveQualiteEau: 1 });
    const result = evaluateRules([ctx], [makeRegleR4()], []);
    expect(result).toHaveLength(0);
  });

  it("R4 ne se declenche pas : densite=80 (< 100) meme avec 10 jours sans releve", () => {
    const ctx = makeContext({ densiteKgM3: 80, joursDepuisDernierReleveQualiteEau: 10 });
    const result = evaluateRules([ctx], [makeRegleR4()], []);
    expect(result).toHaveLength(0);
  });

  it("contexte avec joursDepuisDernierReleveQualiteEau renseigne", () => {
    const ctx = makeContext({ joursDepuisDernierReleveQualiteEau: 5 });
    expect(ctx.joursDepuisDernierReleveQualiteEau).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — Qualite eau degradee avec ammoniac (R6)
// ADR : logique ET, C1=SEUIL_DENSITE>200, C2=SEUIL_QUALITE(ammoniac)>0.05
// ---------------------------------------------------------------------------

describe("S4 — Regle R6 : densite critique + NH3 eleve", () => {
  it.todo(
    "R6 se declenche : densite=220 kg/m3 ET ammoniac=0.1 mg/L"
    // ctx: densiteKgM3=220
    // derniersReleves: [{ typeReleve: QUALITE_EAU, ammoniac: 0.1 }]
    // C1: 220 > 200 → true
    // C2: ammoniac 0.1 > 0.05 → true
    // ET → triggered = true, typeActivite=RENOUVELLEMENT, priorite=1
  );

  it.todo(
    "R6 ne se declenche pas : densite=220 ET ammoniac normal (0.02 mg/L)"
    // C2: 0.02 > 0.05 → false → 0 match
  );

  it.todo(
    "R6 ne se declenche pas : densite=180 (< 200) ET ammoniac=0.1"
    // C1: 180 > 200 → false → 0 match
  );
});

// ---------------------------------------------------------------------------
// Scenario 5 — TypeReleve RENOUVELLEMENT : structure et contenu
// ADR section 5.3-5.4
// ---------------------------------------------------------------------------

describe("S5 — TypeReleve.RENOUVELLEMENT : structure du releve", () => {
  it("TypeReleve.RENOUVELLEMENT existe dans l'enum", () => {
    expect(TypeReleve.RENOUVELLEMENT).toBe("RENOUVELLEMENT");
  });

  it("TypeReleve.RENOUVELLEMENT est different des autres types", () => {
    expect(TypeReleve.RENOUVELLEMENT).not.toBe(TypeReleve.BIOMETRIE);
    expect(TypeReleve.RENOUVELLEMENT).not.toBe(TypeReleve.QUALITE_EAU);
    expect(TypeReleve.RENOUVELLEMENT).not.toBe(TypeReleve.MORTALITE);
  });

  it("simule un releve RENOUVELLEMENT avec pourcentageRenouvellement", () => {
    // Releve representant un renouvellement de 50% du volume
    const releveRenouvellement = {
      id: "rel-renouv-1",
      typeReleve: TypeReleve.RENOUVELLEMENT,
      date: new Date(),
      bacId: "bac-1",
      vagueId: "vague-1",
      pourcentageRenouvellement: 50, // 50% du volume renouvelee
      volumeRenouvele: 1950,          // 50% de 3900L
    };

    expect(releveRenouvellement.typeReleve).toBe("RENOUVELLEMENT");
    expect(releveRenouvellement.pourcentageRenouvellement).toBe(50);
    expect(releveRenouvellement.volumeRenouvele).toBe(1950);
    // Verification coherence : 1950L / 3900L * 100 = 50%
    expect((releveRenouvellement.volumeRenouvele / 3900) * 100).toBe(50);
  });

  it("simule un releve RENOUVELLEMENT avec seulement volumeRenouvele", () => {
    const releveVolumeOnly = {
      typeReleve: TypeReleve.RENOUVELLEMENT,
      date: new Date(),
      pourcentageRenouvellement: null, // Non renseigne
      volumeRenouvele: 2000,           // Renseigne en litres
    };

    expect(releveVolumeOnly.pourcentageRenouvellement).toBeNull();
    expect(releveVolumeOnly.volumeRenouvele).toBe(2000);
  });

  it.todo(
    "calcul du taux depuis un releve RENOUVELLEMENT avec pourcentageRenouvellement → via computeTauxRenouvellement"
    // releveRenouvellement = { pourcentageRenouvellement: 50, volumeRenouvele: null }
    // computeTauxRenouvellement([releve], 3900, 7) = 50/7 ≈ 7.14%/jour
  );

  it.todo(
    "calcul du taux depuis un releve RENOUVELLEMENT avec volumeRenouvele → conversion automatique"
    // releveRenouvellement = { pourcentageRenouvellement: null, volumeRenouvele: 1950 }
    // bacVolume=3900L → conversion: (1950/3900)*100 = 50%
    // computeTauxRenouvellement([releve], 3900, 7) = 50/7 ≈ 7.14%/jour
  );
});

// ---------------------------------------------------------------------------
// Scenario 6 — Pas d'alerte si conditions non remplies (zero false positives)
// ---------------------------------------------------------------------------

describe("S6 — Zero false positives : pas d'alerte sans conditions remplies", () => {
  it("regle legacy non declenchee si poids insuffisant reste non declenchee", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_POIDS,
      conditionValeur: 500,
      conditions: [],
    });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: 200 },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("densiteKgM3=null → regle de densite non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ densiteKgM3: null });
    const result = evaluateRules([ctx], [regle], []);
    // val=null → evalCondition retourne false → pas de faux positif
    expect(result).toHaveLength(0);
  });

  it("tauxRenouvellementPctJour=null → regle de renouvellement non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ tauxRenouvellementPctJour: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("joursDepuisDernierReleveQualiteEau=null → regle ABSENCE_RELEVE non declenchee", () => {
    const condC1 = makeCondition(TypeDeclencheur.ABSENCE_RELEVE, OperateurCondition.SUPERIEUR, 3);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({ joursDepuisDernierReleveQualiteEau: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("vague avec 0 vivants n'est pas evaluee (EC-3.9)", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 50);
    const regle = makeRegle({ conditions: [condC1], logique: LogiqueCondition.ET });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: 0 },
      densiteKgM3: 150,
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0); // EC-3.9 : skip
  });
});

// ---------------------------------------------------------------------------
// Scenario 7 — Contexte RuleEvaluationContext : nouveaux champs
// ADR section 6.3
// ---------------------------------------------------------------------------

describe("S7 — Nouveaux champs RuleEvaluationContext (Sprint 27-28)", () => {
  it("densiteKgM3 est disponible dans le contexte (champ existant)", () => {
    const ctx = makeContext({ densiteKgM3: 125.5 });
    expect(ctx).toHaveProperty("densiteKgM3");
    expect(ctx.densiteKgM3).toBe(125.5);
  });

  it("tauxRenouvellementPctJour est disponible dans le contexte", () => {
    const ctx = makeContext({ tauxRenouvellementPctJour: 42.8 });
    expect(ctx).toHaveProperty("tauxRenouvellementPctJour");
    expect(ctx.tauxRenouvellementPctJour).toBe(42.8);
  });

  it("joursDepuisDernierReleveQualiteEau est disponible dans le contexte", () => {
    const ctx = makeContext({ joursDepuisDernierReleveQualiteEau: 4 });
    expect(ctx).toHaveProperty("joursDepuisDernierReleveQualiteEau");
    expect(ctx.joursDepuisDernierReleveQualiteEau).toBe(4);
  });

  it("tous les nouveaux champs sont nullable par defaut", () => {
    const ctx = makeContext(); // pas d'overrides sur les nouveaux champs
    // Un bac avec volume null → densiteKgM3 null
    const ctxNoBac = makeContext({
      bac: null,
      densiteKgM3: null,
      tauxRenouvellementPctJour: null,
      joursDepuisDernierReleveQualiteEau: null,
    });
    expect(ctxNoBac.densiteKgM3).toBeNull();
    expect(ctxNoBac.tauxRenouvellementPctJour).toBeNull();
    expect(ctxNoBac.joursDepuisDernierReleveQualiteEau).toBeNull();
  });

  it("bac null → evaluation vague-level → tous les champs densite null", () => {
    // Semantique ADR : si bac=null, evaluation vague-level
    // densiteKgM3, tauxRenouvellementPctJour, joursDepuisDernierReleveQualiteEau = null
    const ctx = makeContext({ bac: null, densiteKgM3: null });
    expect(ctx.bac).toBeNull();
    expect(ctx.densiteKgM3).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 8 — OperateurCondition et LogiqueCondition : enums disponibles
// ---------------------------------------------------------------------------

describe("S8 — Enums OperateurCondition et LogiqueCondition", () => {
  it("OperateurCondition contient les 4 valeurs attendues", () => {
    expect(OperateurCondition.SUPERIEUR).toBe("SUPERIEUR");
    expect(OperateurCondition.INFERIEUR).toBe("INFERIEUR");
    expect(OperateurCondition.ENTRE).toBe("ENTRE");
    expect(OperateurCondition.EGAL).toBe("EGAL");
  });

  it("LogiqueCondition contient ET et OU", () => {
    expect(LogiqueCondition.ET).toBe("ET");
    expect(LogiqueCondition.OU).toBe("OU");
  });

  it("TypeDeclencheur contient les 3 nouveaux types densite", () => {
    expect(TypeDeclencheur.SEUIL_DENSITE).toBe("SEUIL_DENSITE");
    expect(TypeDeclencheur.SEUIL_RENOUVELLEMENT).toBe("SEUIL_RENOUVELLEMENT");
    expect(TypeDeclencheur.ABSENCE_RELEVE).toBe("ABSENCE_RELEVE");
  });

  it("makeCondition cree une ConditionRegle valide", () => {
    const cond = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100);
    expect(cond.typeDeclencheur).toBe(TypeDeclencheur.SEUIL_DENSITE);
    expect(cond.operateur).toBe(OperateurCondition.SUPERIEUR);
    expect(cond.conditionValeur).toBe(100);
    expect(cond.conditionValeur2).toBeNull();
    expect(cond.ordre).toBe(0);
  });

  it("makeCondition avec ENTRE stocke conditionValeur2", () => {
    const cond = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.ENTRE, 50, 200);
    expect(cond.conditionValeur).toBe(50);
    expect(cond.conditionValeur2).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Scenario 9 — Regles avec conditions composees : structure valide
// ---------------------------------------------------------------------------

describe("S9 — Structure des regles avec conditions composees", () => {
  it("regle avec conditions non vides a la bonne structure", () => {
    const condC1 = makeCondition(TypeDeclencheur.SEUIL_DENSITE, OperateurCondition.SUPERIEUR, 100, undefined, 0);
    const condC2 = makeCondition(TypeDeclencheur.SEUIL_RENOUVELLEMENT, OperateurCondition.INFERIEUR, 75, undefined, 1);

    const regle = makeRegle({
      id: "regle-R2",
      logique: LogiqueCondition.ET,
      conditions: [condC1, condC2],
    });

    expect(regle.conditions).toHaveLength(2);
    expect(regle.logique).toBe(LogiqueCondition.ET);
    expect(regle.conditions[0].typeDeclencheur).toBe(TypeDeclencheur.SEUIL_DENSITE);
    expect(regle.conditions[1].typeDeclencheur).toBe(TypeDeclencheur.SEUIL_RENOUVELLEMENT);
  });

  it("regle avec logique OU pour R5 (ammoniac OU oxygene bas)", () => {
    const condAmmoniac = makeCondition(TypeDeclencheur.SEUIL_QUALITE, OperateurCondition.SUPERIEUR, 1.0, undefined, 0);
    const condOxygene = makeCondition(TypeDeclencheur.SEUIL_QUALITE, OperateurCondition.INFERIEUR, 4.0, undefined, 1);

    const regle = makeRegle({
      id: "regle-R5",
      logique: LogiqueCondition.OU,
      conditions: [condAmmoniac, condOxygene],
    });

    expect(regle.logique).toBe(LogiqueCondition.OU);
    expect(regle.conditions).toHaveLength(2);
    // Les deux conditions evaluent SEUIL_QUALITE mais avec des operateurs differents
    expect(regle.conditions[0].operateur).toBe(OperateurCondition.SUPERIEUR);
    expect(regle.conditions[1].operateur).toBe(OperateurCondition.INFERIEUR);
  });

  it("regle avec conditions=[] garde la structure legacy", () => {
    const regle = makeRegle({ conditions: [] });
    expect(regle.conditions).toHaveLength(0);
    expect(regle.logique).toBe(LogiqueCondition.ET); // defaut
  });
});
