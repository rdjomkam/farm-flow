/**
 * Tests — evaluator.ts (Sprint 21, Story S15-10)
 *
 * Couvre les 8 types de declencheurs et les regles de skip :
 *   EC-3.1  Deduplication meme jour
 *   EC-3.2  firedOnce pour SEUIL_*
 *   EC-3.3  Priorite plus basse = plus urgent (score calcule)
 *   EC-3.5  phaseMin > phaseMax invalide → skip
 *   EC-3.9  Vague avec 0 vivants skippee
 *   EC-3.12 Conditions null = match toujours
 */

import { evaluateRules } from "@/lib/activity-engine/evaluator";
import { TypeDeclencheur, PhaseElevage, TypeActivite, StatutActivite, LogiqueCondition } from "@/types";
import type { RuleEvaluationContext } from "@/types/activity-engine";
import type { RegleActivite } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegle(overrides: Partial<RegleActivite> = {}): RegleActivite {
  return {
    id: "regle-1",
    nom: "Test Regle",
    description: null,
    typeActivite: TypeActivite.AUTRE,
    typeDeclencheur: TypeDeclencheur.CALENDRIER,
    conditionValeur: null,
    conditionValeur2: null,
    phaseMin: null,
    phaseMax: null,
    intervalleJours: null,
    titreTemplate: "Test {semaine}",
    descriptionTemplate: null,
    instructionsTemplate: null,
    priorite: 5,
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

function makeContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    vague: {
      id: "vague-1",
      code: "V2026-001",
      dateDebut: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 jours ago
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
      siteId: "site-1",
    },
    joursEcoules: 10,
    semaine: 2,
    indicateurs: {
      fcr: null,
      sgr: null,
      tauxSurvie: 98,
      biomasse: null,
      poidsMoyen: 50,
      nombreVivants: 980,
      tauxMortaliteCumule: 2,
    },
    stock: [],
    configElevage: null,
    derniersReleves: [],
    phase: PhaseElevage.CROISSANCE_DEBUT,
    bac: null,
    densiteKgM3: null,
    tauxRenouvellementPctJour: null,
    joursDepuisDernierReleveQualiteEau: null,
    ...overrides,
  };
}

function makeHistorique(overrides: Partial<{
  id: string;
  regleId: string;
  vagueId: string;
  bacId: string | null;
  dateDebut: Date;
  createdAt: Date;
}> = {}) {
  return [];
}

// ---------------------------------------------------------------------------
// CALENDRIER
// ---------------------------------------------------------------------------

describe("CALENDRIER — evalCalendrier", () => {
  it("match quand joursEcoules >= conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 7 });
    const ctx = makeContext({ joursEcoules: 10 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
    expect(result[0].regle.id).toBe("regle-1");
  });

  it("ne match pas quand joursEcoules < conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 30 });
    const ctx = makeContext({ joursEcoules: 10 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match immediatement quand conditionValeur null (J+0) (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: null });
    const ctx = makeContext({ joursEcoules: 0 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("match exactement au jour conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 10 });
    const ctx = makeContext({ joursEcoules: 10 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// RECURRENT
// ---------------------------------------------------------------------------

describe("RECURRENT — evalRecurrent", () => {
  it("match si aucun historique pour cette regle+vague", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.RECURRENT, intervalleJours: 7 });
    const ctx = makeContext();
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("match si derniere activite > intervalleJours", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.RECURRENT, intervalleJours: 7 });
    const ctx = makeContext();
    const historique = [{
      id: "act-1",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: null,
      dateDebut: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    }];
    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si derniere activite < intervalleJours", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.RECURRENT, intervalleJours: 7 });
    const ctx = makeContext();
    const historique = [{
      id: "act-1",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: null,
      dateDebut: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    }];
    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(0);
  });

  it("match toujours si intervalleJours null (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.RECURRENT, intervalleJours: null });
    const ctx = makeContext();
    const historique = [{
      id: "act-1",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: null,
      dateDebut: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }];
    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// SEUIL_POIDS
// ---------------------------------------------------------------------------

describe("SEUIL_POIDS — evalSeuilPoids", () => {
  it("match si poidsMoyen >= conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_POIDS, conditionValeur: 50 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, poidsMoyen: 55 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("match exactement au seuil (>=)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_POIDS, conditionValeur: 50 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, poidsMoyen: 50 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si poidsMoyen < conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_POIDS, conditionValeur: 100 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, poidsMoyen: 50 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ne match pas si poidsMoyen null", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_POIDS, conditionValeur: 50 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, poidsMoyen: null } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match toujours si conditionValeur null (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_POIDS, conditionValeur: null });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, poidsMoyen: 10 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// SEUIL_QUALITE
// ---------------------------------------------------------------------------

describe("SEUIL_QUALITE — evalSeuilQualite", () => {
  it("match si pH inferieur a conditionValeur (min)", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_QUALITE,
      conditionValeur: 6.5,
      conditionValeur2: 8.5,
    });
    const ctx = makeContext({
      derniersReleves: [{
        id: "rel-1",
        typeReleve: "QUALITE_EAU",
        date: new Date(),
        poidsMoyen: null,
        tailleMoyenne: null,
        nombreMorts: null,
        quantiteAliment: null,
        temperature: 28,
        ph: 6.0, // en dessous du min
        oxygene: null,
        ammoniac: null,
      }],
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("match si pH superieur a conditionValeur2 (max)", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_QUALITE,
      conditionValeur: 6.5,
      conditionValeur2: 8.5,
    });
    const ctx = makeContext({
      derniersReleves: [{
        id: "rel-1",
        typeReleve: "QUALITE_EAU",
        date: new Date(),
        poidsMoyen: null,
        tailleMoyenne: null,
        nombreMorts: null,
        quantiteAliment: null,
        temperature: 28,
        ph: 9.2, // au-dessus du max
        oxygene: null,
        ammoniac: null,
      }],
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si toutes les valeurs sont dans la plage normale", () => {
    // Utilise une plage large pour couvrir temperature (28°C) et pH (7.5)
    // conditionValeur=6 (min), conditionValeur2=35 (max) → 28 et 7.5 sont dans la plage
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_QUALITE,
      conditionValeur: 6,
      conditionValeur2: 35,
    });
    const ctx = makeContext({
      derniersReleves: [{
        id: "rel-1",
        typeReleve: "QUALITE_EAU",
        date: new Date(),
        poidsMoyen: null,
        tailleMoyenne: null,
        nombreMorts: null,
        quantiteAliment: null,
        temperature: 28,
        ph: 7.5,
        oxygene: null,
        ammoniac: null,
      }],
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ne match pas si aucun releve qualite eau", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_QUALITE,
      conditionValeur: 6.5,
      conditionValeur2: 8.5,
    });
    const ctx = makeContext({ derniersReleves: [] });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match toujours si conditionValeur et conditionValeur2 null (EC-3.12)", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.SEUIL_QUALITE,
      conditionValeur: null,
      conditionValeur2: null,
    });
    const ctx = makeContext({ derniersReleves: [] });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// SEUIL_MORTALITE
// ---------------------------------------------------------------------------

describe("SEUIL_MORTALITE — evalSeuilMortalite", () => {
  it("match si tauxMortaliteCumule > conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_MORTALITE, conditionValeur: 5 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, tauxMortaliteCumule: 7.5 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si tauxMortaliteCumule <= conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_MORTALITE, conditionValeur: 5 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, tauxMortaliteCumule: 3 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ne match pas si tauxMortaliteCumule null", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_MORTALITE, conditionValeur: 5 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, tauxMortaliteCumule: null } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match toujours si conditionValeur null (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.SEUIL_MORTALITE, conditionValeur: null });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, tauxMortaliteCumule: 0.5 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// STOCK_BAS
// ---------------------------------------------------------------------------

describe("STOCK_BAS — evalStockBas", () => {
  const stockEnAlerte = {
    produit: { id: "prod-1", nom: "Farine", categorie: "ALIMENT" as const, unite: "KG" as const, seuilAlerte: 50 },
    quantiteActuelle: 20,
    estEnAlerte: true,
  };

  const stockOk = {
    produit: { id: "prod-2", nom: "Sel", categorie: "ALIMENT" as const, unite: "KG" as const, seuilAlerte: 5 },
    quantiteActuelle: 100,
    estEnAlerte: false,
  };

  it("match si au moins un produit estEnAlerte (conditionValeur null — EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.STOCK_BAS, conditionValeur: null });
    const ctx = makeContext({ stock: [stockEnAlerte, stockOk] });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si aucun produit estEnAlerte (conditionValeur null)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.STOCK_BAS, conditionValeur: null });
    const ctx = makeContext({ stock: [stockOk] });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match si jours estimes < seuilJours", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.STOCK_BAS, conditionValeur: 10 });
    // stockActuel=20, seuilAlerte=50 → estEnAlerte=true → condition remplie
    const ctx = makeContext({ stock: [stockEnAlerte] });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si stock vide et conditionValeur null", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.STOCK_BAS, conditionValeur: null });
    const ctx = makeContext({ stock: [] });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FCR_ELEVE
// ---------------------------------------------------------------------------

describe("FCR_ELEVE — evalFcrEleve", () => {
  it("match si FCR > conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.FCR_ELEVE, conditionValeur: 1.8 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, fcr: 2.1 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si FCR <= conditionValeur", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.FCR_ELEVE, conditionValeur: 1.8 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, fcr: 1.5 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ne match pas si FCR null", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.FCR_ELEVE, conditionValeur: 1.8 });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, fcr: null } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match si FCR disponible et conditionValeur null (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.FCR_ELEVE, conditionValeur: null });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, fcr: 1.2 } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si FCR null et conditionValeur null (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.FCR_ELEVE, conditionValeur: null });
    const ctx = makeContext({ indicateurs: { ...makeContext().indicateurs, fcr: null } });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// JALON
// ---------------------------------------------------------------------------

describe("JALON — evalJalon", () => {
  it("match si progression >= conditionValeur (duree 180j par defaut)", () => {
    // 90 jours / 180j = 50% → seuil 50 → match
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.JALON, conditionValeur: 50 });
    const ctx = makeContext({ joursEcoules: 90 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("ne match pas si progression < conditionValeur", () => {
    // 20 jours / 180j = 11.1% → seuil 25 → pas de match
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.JALON, conditionValeur: 25 });
    const ctx = makeContext({ joursEcoules: 20 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match toujours si conditionValeur null (EC-3.12)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.JALON, conditionValeur: null });
    const ctx = makeContext({ joursEcoules: 5 });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Regles de skip globales
// ---------------------------------------------------------------------------

describe("Regles de skip — EC-3.9 : vague avec 0 vivants", () => {
  it("skip une vague avec nombreVivants = 0", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: 0 },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("ne skip pas une vague avec nombreVivants null (inconnue)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: null },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("skip une vague avec nombreVivants negatif", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: -5 },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

describe("Regles de skip — Regle inactive", () => {
  it("skip une regle inactive (isActive=false)", () => {
    const regle = makeRegle({ isActive: false, typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext();
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

describe("Regles de skip — EC-3.2 : firedOnce pour SEUIL_*", () => {
  const seuilTypes = [
    TypeDeclencheur.SEUIL_POIDS,
    TypeDeclencheur.SEUIL_QUALITE,
    TypeDeclencheur.SEUIL_MORTALITE,
    TypeDeclencheur.FCR_ELEVE,
    TypeDeclencheur.STOCK_BAS,
  ];

  for (const type of seuilTypes) {
    it(`skip si firedOnce=true pour ${type}`, () => {
      const regle = makeRegle({
        typeDeclencheur: type,
        firedOnce: true,
        conditionValeur: null,
        conditionValeur2: null,
      });
      const ctx = makeContext({
        indicateurs: {
          ...makeContext().indicateurs,
          poidsMoyen: 100,
          fcr: 2.0,
          tauxMortaliteCumule: 10,
        },
        stock: [{
          produit: { id: "p1", nom: "Farine", categorie: "ALIMENT" as const, unite: "KG" as const, seuilAlerte: 10 },
          quantiteActuelle: 5,
          estEnAlerte: true,
        }],
      });
      const result = evaluateRules([ctx], [regle], []);
      expect(result).toHaveLength(0);
    });
  }
});

describe("Regles de skip — EC-3.5 : phaseMin > phaseMax invalide", () => {
  it("skip si phaseMin (GROSSISSEMENT) > phaseMax (ACCLIMATATION)", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.CALENDRIER,
      conditionValeur: 0,
      phaseMin: PhaseElevage.GROSSISSEMENT,
      phaseMax: PhaseElevage.ACCLIMATATION,
    });
    const ctx = makeContext({ phase: PhaseElevage.JUVENILE });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match si phaseMin = phaseMax (meme phase)", () => {
    const regle = makeRegle({
      typeDeclencheur: TypeDeclencheur.CALENDRIER,
      conditionValeur: 0,
      phaseMin: PhaseElevage.JUVENILE,
      phaseMax: PhaseElevage.JUVENILE,
    });
    const ctx = makeContext({ phase: PhaseElevage.JUVENILE });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });
});

describe("Regles de skip — EC-3.1 : deduplication meme jour", () => {
  it("skip si un doublon existe aujourd'hui pour regle+vague", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext();
    const historique = [{
      id: "act-today",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: null,
      dateDebut: new Date(),
      createdAt: new Date(), // aujourd'hui
    }];
    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(0);
  });

  it("ne skip pas si doublon hier mais pas aujourd'hui", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext();
    const historique = [{
      id: "act-yesterday",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: null,
      dateDebut: new Date(Date.now() - 25 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // hier
    }];
    const result = evaluateRules([ctx], [regle], historique);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// EC-3.3 : Priorite score
// ---------------------------------------------------------------------------

describe("EC-3.3 — Priorite : plus basse = plus urgent (score plus eleve)", () => {
  it("score plus eleve pour priorite 1 que priorite 10", () => {
    const regleUrgente = makeRegle({ id: "regle-urgent", priorite: 1, conditionValeur: 0 });
    const regleBasse = makeRegle({ id: "regle-basse", priorite: 10, conditionValeur: 0 });
    const ctx = makeContext();
    const result = evaluateRules([ctx], [regleUrgente, regleBasse], []);
    expect(result).toHaveLength(2);
    // Trie par score decroissant → priorite 1 en premier
    expect(result[0].regle.id).toBe("regle-urgent");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("calcule le score correctement : (11 - priorite) * 10", () => {
    const regle = makeRegle({ priorite: 3, conditionValeur: 0 });
    const ctx = makeContext();
    const result = evaluateRules([ctx], [regle], []);
    expect(result[0].score).toBe((11 - 3) * 10); // 80
  });
});

// ---------------------------------------------------------------------------
// Filtre de phase
// ---------------------------------------------------------------------------

describe("Filtre de phase", () => {
  it("match si phase dans la plage [phaseMin, phaseMax]", () => {
    const regle = makeRegle({
      conditionValeur: 0,
      phaseMin: PhaseElevage.JUVENILE,
      phaseMax: PhaseElevage.GROSSISSEMENT,
    });
    const ctx = makeContext({ phase: PhaseElevage.JUVENILE });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("skip si phase hors de la plage", () => {
    const regle = makeRegle({
      conditionValeur: 0,
      phaseMin: PhaseElevage.GROSSISSEMENT,
      phaseMax: PhaseElevage.FINITION,
    });
    const ctx = makeContext({ phase: PhaseElevage.ACCLIMATATION });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });

  it("match sur toutes les phases si phaseMin et phaseMax null", () => {
    const regle = makeRegle({ conditionValeur: 0, phaseMin: null, phaseMax: null });
    const ctx = makeContext({ phase: PhaseElevage.PRE_RECOLTE });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
  });

  it("skip si phase courante null et filtre de phase defini", () => {
    const regle = makeRegle({
      conditionValeur: 0,
      phaseMin: PhaseElevage.JUVENILE,
      phaseMax: PhaseElevage.GROSSISSEMENT,
    });
    const ctx = makeContext({ phase: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Per-bac iteration
// ---------------------------------------------------------------------------

describe("Per-bac iteration", () => {
  it("2 contextes bacs differents meme vague → 2 matches separes", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctxBacA = makeContext({
      bac: { id: "bac-a", nom: "Bac A", volume: 1000, nombrePoissons: 500, nombreInitial: 500, poidsMoyenInitial: 5 },
    });
    const ctxBacB = makeContext({
      bac: { id: "bac-b", nom: "Bac B", volume: 2000, nombrePoissons: 500, nombreInitial: 500, poidsMoyenInitial: 5 },
    });
    const result = evaluateRules([ctxBacA, ctxBacB], [regle], []);
    expect(result).toHaveLength(2);
    expect(result[0].bacId).toBe("bac-a");
    expect(result[1].bacId).toBe("bac-b");
  });

  it("dedup bac-aware : historique bac-A ne bloque pas bac-B", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctxBacA = makeContext({
      bac: { id: "bac-a", nom: "Bac A", volume: 1000, nombrePoissons: 500, nombreInitial: 500, poidsMoyenInitial: 5 },
    });
    const ctxBacB = makeContext({
      bac: { id: "bac-b", nom: "Bac B", volume: 2000, nombrePoissons: 500, nombreInitial: 500, poidsMoyenInitial: 5 },
    });
    // Historique: bac-A fired today, bac-B not
    const historique = [{
      id: "act-bac-a",
      regleId: "regle-1",
      vagueId: "vague-1",
      bacId: "bac-a",
      dateDebut: new Date(),
      createdAt: new Date(),
    }];
    const result = evaluateRules([ctxBacA, ctxBacB], [regle], historique);
    // bac-A should be deduped (fired today), bac-B should match
    expect(result).toHaveLength(1);
    expect(result[0].bacId).toBe("bac-b");
  });

  it("STOCK_BAS avec bac null → 1 match vague-level (pas duplique par bac)", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.STOCK_BAS, conditionValeur: null });
    const stockEnAlerte = {
      produit: { id: "prod-1", nom: "Farine", categorie: "ALIMENT" as const, unite: "KG" as const, seuilAlerte: 50 },
      quantiteActuelle: 20,
      estEnAlerte: true,
    };
    // vague-level context (bac: null)
    const ctx = makeContext({ stock: [stockEnAlerte], bac: null });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
    expect(result[0].bacId).toBeNull();
  });

  it("bacNom est renseigne dans le match", () => {
    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.CALENDRIER, conditionValeur: 0 });
    const ctx = makeContext({
      bac: { id: "bac-x", nom: "Grand Bac", volume: 5000, nombrePoissons: 1000, nombreInitial: 1000, poidsMoyenInitial: 5 },
    });
    const result = evaluateRules([ctx], [regle], []);
    expect(result).toHaveLength(1);
    expect(result[0].bacNom).toBe("Grand Bac");
  });
});
