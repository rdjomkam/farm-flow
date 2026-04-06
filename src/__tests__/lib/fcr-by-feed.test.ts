/**
 * Tests unitaires pour src/lib/queries/fcr-by-feed.ts
 *
 * Couverture de l'algorithme ADR-036 — FCR par aliment :
 *   - buildDailyGainTable     : Step 4 — table journaliere (poids, gain)
 *   - segmenterPeriodesParBac : Step 5 — periodes de consommation par bac
 *   - estimerPopulationBac    : Step 6 — estimation population par bac/periode
 *   - calculerFCRPeriodeBac   : Step 7 — FCR pour une periode dans un bac
 *   - aggregerFCRVague        : Step 8 — agregation FCR vague
 *
 * Reference : docs/analysis/fcr-by-feed-algorithm.md
 */

import { describe, it, expect } from "vitest";
import {
  buildDailyGainTable,
  segmenterPeriodesParBac,
  estimerPopulationBac,
  calculerFCRPeriodeBac,
  aggregerFCRVague,
} from "@/lib/queries/fcr-by-feed";
import type {
  PeriodeBacFCR,
  FCRBacPeriode,
  EstimationPopulationBac,
} from "@/types/fcr-by-feed";
import type { GompertzParams } from "@/lib/gompertz";

// ---------------------------------------------------------------------------
// Fixtures — Gompertz params calibrated from Vague 26-01 (W∞=1500, R²=0.989)
// ---------------------------------------------------------------------------

const GOMPERTZ_PARAMS: GompertzParams = {
  wInfinity: 1500,
  k: 0.018668,
  ti: 73.5,
};

// Vague start date: 2026-03-11
const VAGUE_DEBUT = new Date("2026-03-11");

function dayIndex(dateStr: string): number {
  return Math.round(
    (new Date(dateStr).getTime() - VAGUE_DEBUT.getTime()) / 86400000
  );
}

// ---------------------------------------------------------------------------
// Step 4 — buildDailyGainTable
// ---------------------------------------------------------------------------

describe("buildDailyGainTable", () => {
  it("retourne le gain correct pour des parametres Gompertz synthetiques", () => {
    const table = buildDailyGainTable(GOMPERTZ_PARAMS, 10, 12);

    expect(table.size).toBe(3); // days 10, 11, 12
    expect(table.has(10)).toBe(true);
    expect(table.has(11)).toBe(true);
    expect(table.has(12)).toBe(true);

    // Weight should be increasing (pre-inflection exponential phase)
    const w10 = table.get(10)!.poids;
    const w11 = table.get(11)!.poids;
    const w12 = table.get(12)!.poids;
    expect(w11).toBeGreaterThan(w10);
    expect(w12).toBeGreaterThan(w11);

    // Verify weight is in reasonable range for day 10 (~57g)
    expect(w10).toBeGreaterThan(50);
    expect(w10).toBeLessThan(65);
  });

  it("gain(t) = weight(t) - weight(t-1)", () => {
    const table = buildDailyGainTable(GOMPERTZ_PARAMS, 10, 14);

    for (let t = 11; t <= 14; t++) {
      const prevWeight = table.get(t - 1)!.poids;
      const curWeight = table.get(t)!.poids;
      const gain = table.get(t)!.gain;
      expect(gain).toBeCloseTo(curWeight - prevWeight, 6);
    }
  });

  it("gere dayFrom == dayTo (une seule entree)", () => {
    const table = buildDailyGainTable(GOMPERTZ_PARAMS, 15, 15);
    expect(table.size).toBe(1);
    expect(table.has(15)).toBe(true);
    // gain for the single day should still be defined (weight(15) - weight(14))
    expect(table.get(15)!.gain).toBeGreaterThan(0);
  });

  it("gain quotidien augmente en phase pre-inflexion", () => {
    const table = buildDailyGainTable(GOMPERTZ_PARAMS, 10, 24);
    const gains: number[] = [];
    for (let t = 10; t <= 24; t++) {
      gains.push(table.get(t)!.gain);
    }
    // Pre-inflection (t << ti=73.5), daily gain should be increasing
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeGreaterThan(gains[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Step 5 — segmenterPeriodesParBac
// ---------------------------------------------------------------------------

describe("segmenterPeriodesParBac", () => {
  it("cree une seule periode pour des jours exclusifs consecutifs", () => {
    const consoByDay = new Map<
      string,
      {
        qtyTargetKg: number;
        autresProduits: { produitId: string; quantiteKg: number }[];
      }
    >();
    consoByDay.set("2026-03-23", { qtyTargetKg: 5.3, autresProduits: [] });
    consoByDay.set("2026-03-24", { qtyTargetKg: 5.7, autresProduits: [] });
    consoByDay.set("2026-03-25", { qtyTargetKg: 5.65, autresProduits: [] });

    const periodes = segmenterPeriodesParBac(consoByDay, "bac-02", "Bac 02");

    expect(periodes).toHaveLength(1);
    expect(periodes[0].dateDebut).toEqual(new Date("2026-03-23"));
    expect(periodes[0].dateFin).toEqual(new Date("2026-03-25"));
    expect(periodes[0].dureeJours).toBe(3);
    expect(periodes[0].qtyTargetKg).toBeCloseTo(16.65);
    expect(periodes[0].joursExclusifs).toBe(3);
    expect(periodes[0].joursMixtes).toBe(0);
  });

  it("cree deux periodes si gap >= 1 jour sans consommation", () => {
    const consoByDay = new Map<
      string,
      {
        qtyTargetKg: number;
        autresProduits: { produitId: string; quantiteKg: number }[];
      }
    >();
    consoByDay.set("2026-03-21", { qtyTargetKg: 1.6, autresProduits: [] });
    consoByDay.set("2026-03-22", { qtyTargetKg: 1.7, autresProduits: [] });
    // gap on March 23
    consoByDay.set("2026-03-24", { qtyTargetKg: 3.6, autresProduits: [] });
    consoByDay.set("2026-03-25", { qtyTargetKg: 1.7, autresProduits: [] });

    const periodes = segmenterPeriodesParBac(consoByDay, "bac-01", "Bac 01");

    expect(periodes).toHaveLength(2);
    expect(periodes[0].dateDebut).toEqual(new Date("2026-03-21"));
    expect(periodes[0].dateFin).toEqual(new Date("2026-03-22"));
    expect(periodes[0].qtyTargetKg).toBeCloseTo(3.3);

    expect(periodes[1].dateDebut).toEqual(new Date("2026-03-24"));
    expect(periodes[1].dateFin).toEqual(new Date("2026-03-25"));
    expect(periodes[1].qtyTargetKg).toBeCloseTo(5.3);
  });

  it("rattache un jour mixte a la periode exclusive adjacente", () => {
    const consoByDay = new Map<
      string,
      {
        qtyTargetKg: number;
        autresProduits: { produitId: string; quantiteKg: number }[];
      }
    >();
    // Exclusive days
    consoByDay.set("2026-03-23", { qtyTargetKg: 5.3, autresProduits: [] });
    consoByDay.set("2026-03-24", { qtyTargetKg: 5.7, autresProduits: [] });
    consoByDay.set("2026-03-25", { qtyTargetKg: 5.65, autresProduits: [] });
    // Mixed day adjacent before the exclusive period
    consoByDay.set("2026-03-22", {
      qtyTargetKg: 1.35,
      autresProduits: [{ produitId: "prod-2mm", quantiteKg: 4.05 }],
    });

    const periodes = segmenterPeriodesParBac(consoByDay, "bac-02", "Bac 02");

    expect(periodes).toHaveLength(1);
    expect(periodes[0].dateDebut).toEqual(new Date("2026-03-22"));
    expect(periodes[0].dateFin).toEqual(new Date("2026-03-25"));
    expect(periodes[0].dureeJours).toBe(4);
    expect(periodes[0].qtyTargetKg).toBeCloseTo(18.0);
    expect(periodes[0].joursExclusifs).toBe(3);
    expect(periodes[0].joursMixtes).toBe(1);
  });

  it("jour mixte isole → micro-periode autonome", () => {
    const consoByDay = new Map<
      string,
      {
        qtyTargetKg: number;
        autresProduits: { produitId: string; quantiteKg: number }[];
      }
    >();
    // Only a mixed day, no adjacent exclusive period
    consoByDay.set("2026-03-22", {
      qtyTargetKg: 1.35,
      autresProduits: [{ produitId: "prod-2mm", quantiteKg: 4.05 }],
    });

    const periodes = segmenterPeriodesParBac(consoByDay, "bac-03", "Bac 03");

    expect(periodes).toHaveLength(1);
    expect(periodes[0].dateDebut).toEqual(new Date("2026-03-22"));
    expect(periodes[0].dateFin).toEqual(new Date("2026-03-22"));
    expect(periodes[0].dureeJours).toBe(1);
    expect(periodes[0].qtyTargetKg).toBeCloseTo(1.35);
    expect(periodes[0].joursExclusifs).toBe(0);
    expect(periodes[0].joursMixtes).toBe(1);
  });

  it("conservation : sum(qtyTargetKg) == total consommation bac", () => {
    // Full Bac 01 data from prod DB
    const consoByDay = new Map<
      string,
      {
        qtyTargetKg: number;
        autresProduits: { produitId: string; quantiteKg: number }[];
      }
    >();
    consoByDay.set("2026-03-21", { qtyTargetKg: 1.6, autresProduits: [] });
    consoByDay.set("2026-03-22", { qtyTargetKg: 1.7, autresProduits: [] });
    consoByDay.set("2026-03-24", { qtyTargetKg: 3.6, autresProduits: [] });
    consoByDay.set("2026-03-25", { qtyTargetKg: 1.7, autresProduits: [] });
    consoByDay.set("2026-03-26", { qtyTargetKg: 3.8, autresProduits: [] });
    consoByDay.set("2026-03-27", { qtyTargetKg: 7.45, autresProduits: [] });
    consoByDay.set("2026-03-28", { qtyTargetKg: 8.2, autresProduits: [] });
    consoByDay.set("2026-03-29", { qtyTargetKg: 6.4, autresProduits: [] });
    consoByDay.set("2026-04-01", {
      qtyTargetKg: 7.85,
      autresProduits: [{ produitId: "prod-2mm", quantiteKg: 0.7 }],
    });
    consoByDay.set("2026-04-02", { qtyTargetKg: 10.8, autresProduits: [] });
    consoByDay.set("2026-04-03", { qtyTargetKg: 10, autresProduits: [] });
    consoByDay.set("2026-04-04", { qtyTargetKg: 11.95, autresProduits: [] });

    const periodes = segmenterPeriodesParBac(consoByDay, "bac-01", "Bac 01");

    const totalPeriodes = periodes.reduce((s, p) => s + p.qtyTargetKg, 0);
    const totalConsoMap = Array.from(consoByDay.values()).reduce(
      (s, d) => s + d.qtyTargetKg,
      0
    );
    expect(totalPeriodes).toBeCloseTo(totalConsoMap, 2);
    expect(totalPeriodes).toBeCloseTo(75.05, 2);
  });

  it("map vide → tableau vide", () => {
    const consoByDay = new Map();
    const periodes = segmenterPeriodesParBac(consoByDay, "bac-x", "Bac X");
    expect(periodes).toHaveLength(0);
  });

  it("jours mixtes entre deux periodes exclusives sont rattaches a la plus proche", () => {
    const consoByDay = new Map<
      string,
      {
        qtyTargetKg: number;
        autresProduits: { produitId: string; quantiteKg: number }[];
      }
    >();
    // Period 1: exclusive
    consoByDay.set("2026-03-21", { qtyTargetKg: 1.0, autresProduits: [] });
    consoByDay.set("2026-03-22", { qtyTargetKg: 1.0, autresProduits: [] });
    // Mixed day (closer to period 1)
    consoByDay.set("2026-03-23", {
      qtyTargetKg: 0.5,
      autresProduits: [{ produitId: "other", quantiteKg: 1.0 }],
    });
    // Gap on March 24, 25
    // Period 2: exclusive
    consoByDay.set("2026-03-26", { qtyTargetKg: 2.0, autresProduits: [] });
    consoByDay.set("2026-03-27", { qtyTargetKg: 2.0, autresProduits: [] });

    const periodes = segmenterPeriodesParBac(consoByDay, "bac-x", "Bac X");

    expect(periodes).toHaveLength(2);
    // Mixed day Mar 23 should be attached to Period 1 (adjacent)
    expect(periodes[0].dateFin).toEqual(new Date("2026-03-23"));
    expect(periodes[0].qtyTargetKg).toBeCloseTo(2.5);
    expect(periodes[0].joursMixtes).toBe(1);

    expect(periodes[1].dateDebut).toEqual(new Date("2026-03-26"));
    expect(periodes[1].qtyTargetKg).toBeCloseTo(4.0);
  });
});

// ---------------------------------------------------------------------------
// Step 6 — estimerPopulationBac
// ---------------------------------------------------------------------------

describe("estimerPopulationBac", () => {
  it("ancrage sur COMPTAGE recent + soustraction mortalite post-comptage", () => {
    const result = estimerPopulationBac(
      "bac-01",
      new Date("2026-03-26"),
      new Date("2026-03-29"),
      // Comptage on March 26: 2301
      [{ date: new Date("2026-03-26"), nombreCompte: 2301 }],
      // Mortality after March 26
      [
        { date: new Date("2026-03-27"), nombreMorts: 5 },
        { date: new Date("2026-03-28"), nombreMorts: 3 },
        { date: new Date("2026-03-29"), nombreMorts: 0 },
      ],
      [], // no calibrages
      5500,
      3
    );

    expect(result.methode).toBe("COMPTAGE_ANCRAGE");
    expect(result.countDebut).toBe(2301);
    expect(result.countFin).toBe(2301 - 5 - 3); // 2293
    expect(result.avgCount).toBe((2301 + 2293) / 2); // 2297
  });

  it("ajout mortalite avant COMPTAGE si dateDebut < dateComptage", () => {
    const result = estimerPopulationBac(
      "bac-01",
      new Date("2026-03-21"),
      new Date("2026-03-22"),
      // Comptage on March 26: 2301
      [{ date: new Date("2026-03-26"), nombreCompte: 2301 }],
      // Mortality between dateDebut and comptage
      [
        { date: new Date("2026-03-26"), nombreMorts: 3 },
      ],
      [],
      5500,
      3
    );

    expect(result.methode).toBe("COMPTAGE_ANCRAGE");
    // At March 21, add back mortality between 21 and 26: 3 deaths
    expect(result.countDebut).toBe(2301 + 3); // 2304
    expect(result.countFin).toBe(2301 + 3); // 2304 (no mortality between 21-22)
  });

  it("bac vide (comptage = 0) → reconstitution depuis calibrage", () => {
    const result = estimerPopulationBac(
      "bac-03",
      new Date("2026-03-23"),
      new Date("2026-03-25"),
      // Bac 03 counted at 0 on March 26
      [{ date: new Date("2026-03-26"), nombreCompte: 0 }],
      // Mortality in the period
      [
        { date: new Date("2026-03-23"), nombreMorts: 1 },
        { date: new Date("2026-03-24"), nombreMorts: 2 },
        { date: new Date("2026-03-25"), nombreMorts: 2 },
      ],
      // Calibrage: 335 fish transferred to Bac 04 (from bac-03)
      [
        {
          date: new Date("2026-03-26"),
          nombreMorts: 0,
          groupes: [{ destinationBacId: "bac-04", nombrePoissons: 335, poidsMoyen: 0 }],
          sourceBacIds: ["bac-03"],
          nombreTransfere: 335,
        },
      ],
      5500,
      3
    );

    // Bac 03 at March 23 start: 335 (transferred) + 5 (deaths 23-25) + deaths before = 340
    // At March 25 end: 340 - 1 - 2 = 337
    expect(result.countDebut).toBeGreaterThan(330);
    expect(result.countFin).toBeGreaterThan(330);
    expect(result.countDebut).toBeLessThan(400);
  });

  it("fallback proportionnel si aucun COMPTAGE", () => {
    const result = estimerPopulationBac(
      "bac-01",
      new Date("2026-03-21"),
      new Date("2026-03-25"),
      [], // no comptage
      [{ date: new Date("2026-03-23"), nombreMorts: 2 }],
      [],
      5500,
      3
    );

    expect(result.methode).toBe("PROPORTIONNEL_INITIAL");
    // 5500 / 3 bacs = ~1833 initial, minus mortality
    const expectedInitial = Math.round(5500 / 3);
    expect(result.countDebut).toBeCloseTo(expectedInitial, 0);
  });

  it("avgCount = (countDebut + countFin) / 2", () => {
    const result = estimerPopulationBac(
      "bac-02",
      new Date("2026-03-23"),
      new Date("2026-03-28"),
      [{ date: new Date("2026-03-26"), nombreCompte: 2800 }],
      [
        { date: new Date("2026-03-27"), nombreMorts: 2 },
        { date: new Date("2026-03-28"), nombreMorts: 4 },
      ],
      [],
      5500,
      3
    );

    expect(result.avgCount).toBeCloseTo(
      (result.countDebut + result.countFin) / 2,
      0
    );
  });
});

// ---------------------------------------------------------------------------
// Step 7 — calculerFCRPeriodeBac
// ---------------------------------------------------------------------------

describe("calculerFCRPeriodeBac", () => {
  const dailyGain = buildDailyGainTable(GOMPERTZ_PARAMS, 10, 24);

  it("FCR = qtyAlimentKg / gainBiomasseKg", () => {
    const periode: PeriodeBacFCR = {
      bacId: "bac-02",
      bacNom: "Bac 02",
      dateDebut: new Date("2026-03-23"),
      dateFin: new Date("2026-04-04"),
      dureeJours: 13,
      qtyTargetKg: 97.88,
      joursExclusifs: 13,
      joursMixtes: 0,
    };

    const population: EstimationPopulationBac = {
      bacId: "bac-02",
      countDebut: 2806,
      countFin: 2791,
      avgCount: 2798,
      methode: "COMPTAGE_ANCRAGE",
    };

    const result = calculerFCRPeriodeBac(
      periode,
      dailyGain,
      population,
      VAGUE_DEBUT
    );

    expect(result.fcr).not.toBeNull();
    expect(result.fcr!).toBeGreaterThan(0);
    expect(result.fcr!).toBeLessThan(2);
    expect(result.gainBiomasseKg).toBeGreaterThan(0);
    // Verify formula: FCR = qty / biomass gain
    expect(result.fcr!).toBeCloseTo(
      result.qtyAlimentKg / result.gainBiomasseKg,
      4
    );
  });

  it("FCR null si gainBiomasseKg <= 0", () => {
    const periode: PeriodeBacFCR = {
      bacId: "bac-x",
      bacNom: "Bac X",
      dateDebut: new Date("2026-03-23"),
      dateFin: new Date("2026-03-23"),
      dureeJours: 1,
      qtyTargetKg: 5.0,
      joursExclusifs: 1,
      joursMixtes: 0,
    };

    const population: EstimationPopulationBac = {
      bacId: "bac-x",
      countDebut: 0,
      countFin: 0,
      avgCount: 0,
      methode: "PROPORTIONNEL_INITIAL",
    };

    const result = calculerFCRPeriodeBac(
      periode,
      dailyGain,
      population,
      VAGUE_DEBUT
    );

    expect(result.gainBiomasseKg).toBe(0);
    expect(result.fcr).toBeNull();
  });

  it("flagHighFCR = true si FCR > 3.0", () => {
    // Bac 03: 338 fish, 16.65 kg → very high FCR
    const periode: PeriodeBacFCR = {
      bacId: "bac-03",
      bacNom: "Bac 03",
      dateDebut: new Date("2026-03-23"),
      dateFin: new Date("2026-03-25"),
      dureeJours: 3,
      qtyTargetKg: 16.65,
      joursExclusifs: 3,
      joursMixtes: 0,
    };

    const population: EstimationPopulationBac = {
      bacId: "bac-03",
      countDebut: 340,
      countFin: 337,
      avgCount: 338,
      methode: "COMPTAGE_ANCRAGE",
    };

    const result = calculerFCRPeriodeBac(
      periode,
      dailyGain,
      population,
      VAGUE_DEBUT
    );

    expect(result.fcr).not.toBeNull();
    expect(result.fcr!).toBeGreaterThan(3.0);
    expect(result.flagHighFCR).toBe(true);
  });

  it("gainBiomasseKg = gainParPoissonG * avgFishCount / 1000", () => {
    const periode: PeriodeBacFCR = {
      bacId: "bac-04",
      bacNom: "Bac 04",
      dateDebut: new Date("2026-03-26"),
      dateFin: new Date("2026-04-01"),
      dureeJours: 7,
      qtyTargetKg: 11.2,
      joursExclusifs: 7,
      joursMixtes: 0,
    };

    const population: EstimationPopulationBac = {
      bacId: "bac-04",
      countDebut: 335,
      countFin: 334,
      avgCount: 335,
      methode: "COMPTAGE_ANCRAGE",
    };

    const result = calculerFCRPeriodeBac(
      periode,
      dailyGain,
      population,
      VAGUE_DEBUT
    );

    expect(result.gainBiomasseKg).toBeCloseTo(
      (result.gainParPoissonG * result.avgFishCount) / 1000,
      4
    );
  });
});

// ---------------------------------------------------------------------------
// Step 8 — aggregerFCRVague
// ---------------------------------------------------------------------------

describe("aggregerFCRVague", () => {
  it("FCR_vague = sum(aliment valide) / sum(gain valide)", () => {
    const periodes: FCRBacPeriode[] = [
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-03-21"),
        dateFin: new Date("2026-03-22"),
        dureeJours: 2,
        qtyAlimentKg: 3.3,
        gainParPoissonG: 6.95,
        avgFishCount: 2304,
        gainBiomasseKg: 16.01,
        fcr: 0.21,
        flagHighFCR: false,
      },
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-03-24"),
        dateFin: new Date("2026-03-29"),
        dureeJours: 6,
        qtyAlimentKg: 31.15,
        gainParPoissonG: 25.41,
        avgFishCount: 2299,
        gainBiomasseKg: 58.42,
        fcr: 0.53,
        flagHighFCR: false,
      },
      {
        bacId: "b2",
        bacNom: "Bac 02",
        dateDebut: new Date("2026-03-23"),
        dateFin: new Date("2026-04-04"),
        dureeJours: 13,
        qtyAlimentKg: 97.88,
        gainParPoissonG: 57.14,
        avgFishCount: 2798,
        gainBiomasseKg: 159.88,
        fcr: 0.61,
        flagHighFCR: false,
      },
    ];

    const result = aggregerFCRVague(periodes);

    expect(result.totalAlimentKg).toBeCloseTo(3.3 + 31.15 + 97.88, 2);
    expect(result.totalGainBiomasseKg).toBeCloseTo(
      16.01 + 58.42 + 159.88,
      2
    );
    expect(result.fcrVague).not.toBeNull();
    expect(result.fcrVague!).toBeCloseTo(
      result.totalAlimentKg / result.totalGainBiomasseKg,
      4
    );
  });

  it("exclut les periodes avec gainBiomasseKg null ou <= 0", () => {
    const periodes: FCRBacPeriode[] = [
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-03-21"),
        dateFin: new Date("2026-03-22"),
        dureeJours: 2,
        qtyAlimentKg: 3.3,
        gainParPoissonG: 6.95,
        avgFishCount: 2304,
        gainBiomasseKg: 16.01,
        fcr: 0.21,
        flagHighFCR: false,
      },
      {
        bacId: "b2",
        bacNom: "Bac Bad",
        dateDebut: new Date("2026-03-23"),
        dateFin: new Date("2026-03-23"),
        dureeJours: 1,
        qtyAlimentKg: 5.0,
        gainParPoissonG: 0,
        avgFishCount: 0,
        gainBiomasseKg: 0,
        fcr: null,
        flagHighFCR: null,
      },
    ];

    const result = aggregerFCRVague(periodes);

    // Should only include the valid period
    expect(result.totalAlimentKg).toBeCloseTo(3.3, 2);
    expect(result.totalGainBiomasseKg).toBeCloseTo(16.01, 2);
    expect(result.fcrVague).toBeCloseTo(3.3 / 16.01, 4);
  });

  it("fcrVague null si aucune periode valide", () => {
    const periodes: FCRBacPeriode[] = [
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-03-21"),
        dateFin: new Date("2026-03-22"),
        dureeJours: 2,
        qtyAlimentKg: 5.0,
        gainParPoissonG: 0,
        avgFishCount: 0,
        gainBiomasseKg: 0,
        fcr: null,
        flagHighFCR: null,
      },
    ];

    const result = aggregerFCRVague(periodes);

    expect(result.fcrVague).toBeNull();
    expect(result.totalGainBiomasseKg).toBe(0);
  });

  it("tableau vide → fcrVague null, totaux 0", () => {
    const result = aggregerFCRVague([]);

    expect(result.fcrVague).toBeNull();
    expect(result.totalAlimentKg).toBe(0);
    expect(result.totalGainBiomasseKg).toBe(0);
  });

  it("full Vague 26-01 scenario → FCR ~0.66", () => {
    // All 6 periods from the real analysis
    const periodes: FCRBacPeriode[] = [
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-03-21"),
        dateFin: new Date("2026-03-22"),
        dureeJours: 2,
        qtyAlimentKg: 3.3,
        gainParPoissonG: 6.95,
        avgFishCount: 2304,
        gainBiomasseKg: 16.01,
        fcr: 0.21,
        flagHighFCR: false,
      },
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-03-24"),
        dateFin: new Date("2026-03-29"),
        dureeJours: 6,
        qtyAlimentKg: 31.15,
        gainParPoissonG: 25.41,
        avgFishCount: 2299,
        gainBiomasseKg: 58.42,
        fcr: 0.53,
        flagHighFCR: false,
      },
      {
        bacId: "b1",
        bacNom: "Bac 01",
        dateDebut: new Date("2026-04-01"),
        dateFin: new Date("2026-04-04"),
        dureeJours: 4,
        qtyAlimentKg: 40.6,
        gainParPoissonG: 21.4,
        avgFishCount: 2284,
        gainBiomasseKg: 48.88,
        fcr: 0.83,
        flagHighFCR: false,
      },
      {
        bacId: "b2",
        bacNom: "Bac 02",
        dateDebut: new Date("2026-03-22"),
        dateFin: new Date("2026-04-04"),
        dureeJours: 14,
        qtyAlimentKg: 99.23,
        gainParPoissonG: 60.83,
        avgFishCount: 2798,
        gainBiomasseKg: 170.24,
        fcr: 0.58,
        flagHighFCR: false,
      },
      {
        bacId: "b3",
        bacNom: "Bac 03",
        dateDebut: new Date("2026-03-22"),
        dateFin: new Date("2026-03-25"),
        dureeJours: 4,
        qtyAlimentKg: 18.0,
        gainParPoissonG: 15.09,
        avgFishCount: 338,
        gainBiomasseKg: 5.1,
        fcr: 3.53,
        flagHighFCR: true,
      },
      {
        bacId: "b4",
        bacNom: "Bac 04",
        dateDebut: new Date("2026-03-26"),
        dateFin: new Date("2026-04-01"),
        dureeJours: 7,
        qtyAlimentKg: 11.2,
        gainParPoissonG: 32.41,
        avgFishCount: 335,
        gainBiomasseKg: 10.86,
        fcr: 1.03,
        flagHighFCR: false,
      },
    ];

    const result = aggregerFCRVague(periodes);

    expect(result.totalAlimentKg).toBeCloseTo(203.48, 1);
    expect(result.totalGainBiomasseKg).toBeCloseTo(309.51, 0);
    expect(result.fcrVague).not.toBeNull();
    expect(result.fcrVague!).toBeCloseTo(0.66, 1);
  });
});
