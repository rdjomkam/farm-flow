/**
 * Tests — feeding.ts (Sprint 21, Story S15-10)
 *
 * Couvre :
 *   EC-4.1  nombreVivants depuis le contexte (non nul et > 0)
 *   EC-4.2  Projection poidsMoyen via SGR si biometrie > 7 jours
 *   Formule : quantiteGrammes = nombreVivants * poidsMoyen * taux / 100
 *   Fallback  : poidsMoyenInitial si poidsMoyen null
 *   Frequences par phase
 */

import { calculerQuantiteAliment } from "@/lib/activity-engine/feeding";
import { TypeReleve } from "@/types";
import type { RuleEvaluationContext } from "@/types/activity-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    vague: {
      id: "vague-1",
      code: "V2026-001",
      dateDebut: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      nombreInitial: 500,
      poidsMoyenInitial: 10,
      siteId: "site-1",
    },
    joursEcoules: 20,
    semaine: 3,
    indicateurs: {
      fcr: null,
      sgr: 2.5,
      tauxSurvie: 97,
      biomasse: null,
      poidsMoyen: 100,
      nombreVivants: 485,
      tauxMortaliteCumule: 3,
    },
    stock: [],
    configElevage: null,
    derniersReleves: [
      {
        id: "rel-1",
        typeReleve: TypeReleve.BIOMETRIE,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // il y a 3 jours (< 7j)
        poidsMoyen: 100,
        tailleMoyenne: 15,
        nombreMorts: null,
        quantiteAliment: null,
        temperature: null,
        ph: null,
        oxygene: null,
        ammoniac: null,
      },
    ],
    phase: "JUVENILE",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests principaux
// ---------------------------------------------------------------------------

describe("calculerQuantiteAliment — formule de base", () => {
  it("retourne null si nombreVivants null (EC-4.1)", () => {
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: null },
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).toBeNull();
  });

  it("retourne null si nombreVivants = 0 (EC-4.1)", () => {
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: 0 },
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).toBeNull();
  });

  it("retourne null si nombreVivants negatif", () => {
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, nombreVivants: -10 },
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).toBeNull();
  });

  it("calcule correctement quantiteGrammes = nombreVivants * poidsMoyen * taux / 100", () => {
    // poidsMoyen=100g → phase JUVENILE (seuil 50-150) → taux default = (3+5)/2 = 4%
    // nombreVivants=485
    // quantite = 485 * 100 * 4 / 100 = 1940g
    const ctx = makeContext();
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    expect(result!.quantiteGrammes).toBe(Math.round(485 * 100 * 4 / 100));
    expect(result!.nombreVivantsUtilise).toBe(485);
    expect(result!.poidsMoyenUtilise).toBe(100);
    expect(result!.tauxUtilise).toBe(4);
  });

  it("utilise poidsMoyenInitial si poidsMoyen null", () => {
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: null, sgr: null },
      derniersReleves: [],
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    // poidsMoyenInitial=10 → phase ACCLIMATATION → taux = (8+10)/2 = 9%
    expect(result!.poidsMoyenUtilise).toBe(10);
    expect(result!.estProjete).toBe(false);
  });

  it("retourne null si poidsMoyenInitial = 0", () => {
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: null, sgr: null },
      vague: { ...makeContext().vague, poidsMoyenInitial: 0 },
      derniersReleves: [],
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).toBeNull();
  });
});

describe("calculerQuantiteAliment — EC-4.2 : projection SGR si biometrie > 7 jours", () => {
  it("ne projette pas si biometrie recente (< 7j)", () => {
    // biometrie il y a 3 jours → pas de projection
    const ctx = makeContext();
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    expect(result!.estProjete).toBe(false);
  });

  it("projette le poids si biometrie > 7 jours (EC-4.2)", () => {
    const ctx = makeContext({
      derniersReleves: [
        {
          id: "rel-1",
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // il y a 10 jours
          poidsMoyen: 100,
          tailleMoyenne: 15,
          nombreMorts: null,
          quantiteAliment: null,
          temperature: null,
          ph: null,
          oxygene: null,
          ammoniac: null,
        },
      ],
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    expect(result!.estProjete).toBe(true);
    // Poids projete > 100g (croissance positive via SGR)
    expect(result!.poidsMoyenUtilise).toBeGreaterThan(100);
  });

  it("ne projette pas si SGR null", () => {
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, sgr: null },
      derniersReleves: [
        {
          id: "rel-1",
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          poidsMoyen: 100,
          tailleMoyenne: 15,
          nombreMorts: null,
          quantiteAliment: null,
          temperature: null,
          ph: null,
          oxygene: null,
          ammoniac: null,
        },
      ],
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    expect(result!.estProjete).toBe(false);
  });
});

describe("calculerQuantiteAliment — frequences par phase", () => {
  const phaseFrequences: Array<{ poidsMoyen: number; frequenceAttendue: number; phase: string }> = [
    { poidsMoyen: 10, frequenceAttendue: 4, phase: "ACCLIMATATION" },
    { poidsMoyen: 30, frequenceAttendue: 3, phase: "CROISSANCE_DEBUT" },
    { poidsMoyen: 100, frequenceAttendue: 3, phase: "JUVENILE" },
    { poidsMoyen: 200, frequenceAttendue: 2, phase: "GROSSISSEMENT" },
    { poidsMoyen: 500, frequenceAttendue: 2, phase: "FINITION" },
  ];

  for (const { poidsMoyen, frequenceAttendue, phase } of phaseFrequences) {
    it(`frequence ${frequenceAttendue}x/jour pour phase ${phase} (poids ${poidsMoyen}g)`, () => {
      const ctx = makeContext({
        indicateurs: { ...makeContext().indicateurs, poidsMoyen, sgr: null },
        derniersReleves: [
          {
            id: "rel-1",
            typeReleve: TypeReleve.BIOMETRIE,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            poidsMoyen,
            tailleMoyenne: null,
            nombreMorts: null,
            quantiteAliment: null,
            temperature: null,
            ph: null,
            oxygene: null,
            ammoniac: null,
          },
        ],
      });
      const result = calculerQuantiteAliment(ctx, null);
      expect(result).not.toBeNull();
      expect(result!.frequence).toBe(frequenceAttendue);
    });
  }
});

describe("calculerQuantiteAliment — taille de granule", () => {
  it("retourne la bonne taille de granule pour un poids de 100g (default: 3-4mm)", () => {
    // poidsMoyen=100g → 80-150 → "3-4mm"
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: 100, sgr: null },
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    expect(result!.tailleGranule).toBe("3-4mm");
  });

  it("retourne la bonne taille de granule pour un poids de 10g (default: 1.2mm)", () => {
    // poidsMoyen=10g → 0-15 → "1.2mm"
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: 10, sgr: null },
      derniersReleves: [
        {
          id: "rel-1",
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          poidsMoyen: 10,
          tailleMoyenne: null,
          nombreMorts: null,
          quantiteAliment: null,
          temperature: null,
          ph: null,
          oxygene: null,
          ammoniac: null,
        },
      ],
    });
    const result = calculerQuantiteAliment(ctx, null);
    expect(result).not.toBeNull();
    expect(result!.tailleGranule).toBe("1.2mm");
  });
});

describe("calculerQuantiteAliment — avec configElevage personnalisee", () => {
  it("utilise les seuils personnalises de ConfigElevage si fourni", () => {
    const configPersonnalisee = {
      id: "config-1",
      siteId: "site-1",
      nom: "Config test",
      poidsObjectif: 1000,
      fcrAlerteMax: 2.0,
      seuilAcclimatation: 20,
      seuilCroissanceDebut: 80,
      seuilJuvenile: 200,
      seuilGrossissement: 500,
      seuilFinition: 900,
      alimentTauxConfig: null,
      alimentTailleConfig: null,
      dureeEstimeeCycle: 180,
      densiteMaxKgM3: null,
      mortaliteAlertePct: null,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // poidsMoyen=100g avec config : seuil juvenile=200 → CROISSANCE_DEBUT
    const ctx = makeContext({
      indicateurs: { ...makeContext().indicateurs, poidsMoyen: 100, sgr: null },
    });
    const result = calculerQuantiteAliment(ctx, configPersonnalisee);
    expect(result).not.toBeNull();
    // La phase sera CROISSANCE_DEBUT avec ce config
    expect(result!.poidsMoyenUtilise).toBe(100);
  });
});
