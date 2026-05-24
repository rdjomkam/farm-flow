/**
 * Tests for src/lib/bac-performance.ts
 *
 * Covers: FCR (with sold fish), GMQ, biomasse, taux survie, feed cost (with unit conversion),
 * ranking, biometry period snapshots, edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  computeBacPerformance,
  BacPerformanceInput,
  ConsommationInput,
} from "@/lib/bac-performance";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

type ReleveInput = BacPerformanceInput["releves"][number];

function makeInput(overrides?: Partial<BacPerformanceInput>): BacPerformanceInput {
  return {
    bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 500 }],
    releves: [],
    ventes: [],
    nombreInitialVague: 500,
    dateDebutVague: new Date("2026-01-01"),
    poidsMoyenInitial: 3,
    ...overrides,
  };
}

function makeReleve(overrides: Partial<ReleveInput>): ReleveInput {
  return {
    bacId: "bac1",
    typeReleve: "BIOMETRIE",
    date: new Date("2026-02-01"),
    poidsMoyen: null,
    nombreMorts: null,
    nombreCompte: null,
    nombreVendus: null,
    quantiteAliment: null,
    consommations: [],
    ...overrides,
  };
}

/** Helper to create a consommation with product unit info */
function makeConso(quantite: number, prixUnitaire: number, unite = "KG"): ConsommationInput {
  return {
    quantite,
    produit: { prixUnitaire, unite, uniteAchat: null, contenance: null },
  };
}

// ---------------------------------------------------------------------------
// 1. Empty input
// ---------------------------------------------------------------------------

describe("computeBacPerformance — empty input", () => {
  it("returns an empty array when bacs is empty", () => {
    const result = computeBacPerformance(makeInput({ bacs: [] }));
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Single bac with no relevés
// ---------------------------------------------------------------------------

describe("computeBacPerformance — single bac, no relevés", () => {
  it("returns one entry with biomasse from initial weight and null FCR/GMQ", () => {
    const result = computeBacPerformance(makeInput());
    expect(result).toHaveLength(1);
    const bac = result[0];
    expect(bac.bacId).toBe("bac1");
    expect(bac.poidsMoyenActuel).toBeNull();
    expect(bac.gmq).toBeNull();
    expect(bac.fcr).toBeNull();
    expect(bac.coutParKgProduit).toBeNull();
    // biomasse = poidsMoyenInitial (3) * vivants (500) / 1000 = 1.5
    expect(bac.biomasse).toBe(1.5);
    // tauxSurvie = 500 / 500 * 100 = 100
    expect(bac.tauxSurvie).toBe(100);
    expect(bac.sparklineData).toEqual([]);
    expect(bac.totalAlimentKg).toBe(0);
    expect(bac.coutAliment).toBe(0);
    expect(bac.derniereBiometrieDate).toBeNull();
    expect(bac.rank).toBe(1);
    expect(bac.periodSnapshots).toEqual([]);
    expect(bac.soldBiomasseKg).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Single bac with biometries — sparkline, poidsMoyen, GMQ from 2 biometries
// ---------------------------------------------------------------------------

describe("computeBacPerformance — single bac with 2 biometries", () => {
  const releves: ReleveInput[] = [
    makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 10 }),
    makeReleve({ date: new Date("2026-01-21"), poidsMoyen: 20 }),
  ];

  it("sets poidsMoyenActuel to the latest biometry", () => {
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].poidsMoyenActuel).toBe(20);
  });

  it("sets poidsMoyenPrecedent to the second-to-last biometry", () => {
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].poidsMoyenPrecedent).toBe(10);
  });

  it("builds sparkline chronologically with correct jour offsets", () => {
    // dateDebutVague = 2026-01-01
    // biometry 1: 2026-01-11 → jour 10
    // biometry 2: 2026-01-21 → jour 20
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].sparklineData).toEqual([
      { jour: 10, poidsMoyen: 10 },
      { jour: 20, poidsMoyen: 20 },
    ]);
  });

  it("sets derniereBiometrieDate to the most recent biometry date", () => {
    const result = computeBacPerformance(makeInput({ releves }));
    const d = result[0].derniereBiometrieDate;
    expect(d).not.toBeNull();
    const iso =
      d instanceof Date
        ? d.toISOString().slice(0, 10)
        : new Date(d as string | Date).toISOString().slice(0, 10);
    expect(iso).toBe("2026-01-21");
  });

  it("generates 1 closed + 1 open period snapshot for 2 biometries", () => {
    const now = new Date("2026-01-31"); // 10 days after last biometry
    const result = computeBacPerformance(makeInput({ releves, now }));
    // 1 closed period (bio1 → bio2) + 1 open period (bio2 → today)
    expect(result[0].periodSnapshots).toHaveLength(2);
    const closed = result[0].periodSnapshots[0];
    expect(closed.periodIndex).toBe(0);
    expect(closed.enCours).toBe(false);
    expect(closed.poidsMoyenDebut).toBe(10);
    expect(closed.poidsMoyenFin).toBe(20);
    expect(closed.dureeJours).toBe(10);
    expect(closed.croissanceG).toBe(10);
    expect(closed.gmq).toBe(1);

    const open = result[0].periodSnapshots[1];
    expect(open.enCours).toBe(true);
    expect(open.poidsMoyenDebut).toBe(20);
    expect(open.poidsMoyenFin).toBeNull();
    expect(open.croissanceG).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Single bac with exactly 1 biometry — GMQ from initial weight
// ---------------------------------------------------------------------------

describe("computeBacPerformance — single bac with 1 biometry", () => {
  it("calculates GMQ relative to poidsMoyenInitial and vague start", () => {
    // dateDebutVague = 2026-01-01, biometry = 2026-01-11 (10 days later)
    // poidsMoyenInitial = 3, poidsMoyenActuel = 13
    // GMQ = (13 - 3) / 10 = 1 g/day
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 13 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gmq).toBe(1);
  });

  it("sets poidsMoyenPrecedent to null when only 1 biometry exists", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 13 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].poidsMoyenPrecedent).toBeNull();
  });

  it("returns 1 open period snapshot with only 1 biometry", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 13 }),
    ];
    const now = new Date("2026-01-21"); // 10 days after biometry
    const result = computeBacPerformance(makeInput({ releves, now }));
    expect(result[0].periodSnapshots).toHaveLength(1);
    const snap = result[0].periodSnapshots[0];
    expect(snap.enCours).toBe(true);
    expect(snap.poidsMoyenDebut).toBe(13);
    expect(snap.poidsMoyenFin).toBeNull();
    expect(snap.croissanceG).toBeNull();
    expect(snap.gmq).toBeNull();
    expect(snap.dureeJours).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 5. GMQ calculation — (current - previous) / daysBetween
// ---------------------------------------------------------------------------

describe("computeBacPerformance — GMQ with 2 biometries", () => {
  it("computes GMQ as (currentPoids - previousPoids) / daysBetween", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-01"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 30 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gmq).toBe(2);
  });

  it("rounds GMQ to 2 decimal places", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-01"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-04"), poidsMoyen: 17 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gmq).toBe(2.33);
  });

  it("uses minimum 1 day when biometries fall on the same day", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 20 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gmq).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 6. Multiple bacs ranked by FCR — best FCR gets rank 1, null FCR goes last
// ---------------------------------------------------------------------------

describe("computeBacPerformance — ranking by FCR", () => {
  it("assigns rank 1 to the bac with the lowest FCR", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: 100 },
      { id: "bac2", nom: "Bac 02", nombreInitial: 100 },
    ];
    const releves: ReleveInput[] = [
      makeReleve({ bacId: "bac1", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac2", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac1", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 15, consommations: [] }),
      makeReleve({ bacId: "bac2", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 20, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ bacs, releves, nombreInitialVague: 200 }));
    const bac1Entry = result.find((r) => r.bacId === "bac1")!;
    const bac2Entry = result.find((r) => r.bacId === "bac2")!;
    expect(bac1Entry.rank).toBe(1);
    expect(bac2Entry.rank).toBe(2);
  });

  it("gives '#1' label to rank 1 bac (i18n handled by component)", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: 100 },
      { id: "bac2", nom: "Bac 02", nombreInitial: 100 },
    ];
    const releves: ReleveInput[] = [
      makeReleve({ bacId: "bac1", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac2", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac1", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 15, consommations: [] }),
      makeReleve({ bacId: "bac2", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 20, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ bacs, releves, nombreInitialVague: 200 }));
    const rank1 = result.find((r) => r.rank === 1)!;
    expect(rank1.rankLabel).toBe("#1");
  });

  it("places bacs with null FCR last in ranking", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: 100 },
      { id: "bac2", nom: "Bac 02", nombreInitial: 100 },
    ];
    const releves: ReleveInput[] = [
      makeReleve({ bacId: "bac1", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac1", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 10, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ bacs, releves, nombreInitialVague: 200 }));
    const bac2Entry = result.find((r) => r.bacId === "bac2")!;
    expect(bac2Entry.fcr).toBeNull();
    expect(bac2Entry.rank).toBe(2);
  });

  it("uses '#N' label for non-rank-1 bacs", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: 100 },
      { id: "bac2", nom: "Bac 02", nombreInitial: 100 },
    ];
    const releves: ReleveInput[] = [
      makeReleve({ bacId: "bac1", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac2", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ bacId: "bac1", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 15, consommations: [] }),
      makeReleve({ bacId: "bac2", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 20, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ bacs, releves, nombreInitialVague: 200 }));
    const rank2 = result.find((r) => r.rank === 2)!;
    expect(rank2.rankLabel).toBe("#2");
  });
});

// ---------------------------------------------------------------------------
// 7. Feed metrics — totalAlimentKg from consommations or fallback to quantiteAliment
// ---------------------------------------------------------------------------

describe("computeBacPerformance — feed metrics", () => {
  it("sums totalAlimentKg from quantiteAliment fallback when no consommations", () => {
    const releves = [
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-10"), poidsMoyen: null, quantiteAliment: 5, consommations: [] }),
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-20"), poidsMoyen: null, quantiteAliment: 7.5, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].totalAlimentKg).toBe(12.5);
  });

  it("uses consommation quantities (converted to KG) when available", () => {
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 10, // fallback ignored when consommations present
        consommations: [makeConso(5, 500, "KG"), makeConso(3000, 200, "GRAMME")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // 5 KG + 3000 GRAMME (= 3 KG) = 8 KG
    expect(result[0].totalAlimentKg).toBe(8);
  });

  it("ignores ALIMENTATION relevés from other bacs", () => {
    const releves = [
      makeReleve({ bacId: "bac1", typeReleve: "ALIMENTATION", date: new Date("2026-01-10"), poidsMoyen: null, quantiteAliment: 10, consommations: [] }),
      makeReleve({ bacId: "bac2", typeReleve: "ALIMENTATION", date: new Date("2026-01-10"), poidsMoyen: null, quantiteAliment: 99, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].totalAlimentKg).toBe(10);
  });

  it("returns 0 totalAlimentKg when no ALIMENTATION relevés exist", () => {
    const result = computeBacPerformance(makeInput());
    expect(result[0].totalAlimentKg).toBe(0);
  });

  it("treats null quantiteAliment as 0 in sum", () => {
    const releves = [
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-10"), poidsMoyen: null, quantiteAliment: null, consommations: [] }),
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-20"), poidsMoyen: null, quantiteAliment: 8, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].totalAlimentKg).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 8. Cost metrics — uses getPrixParUniteBase + convertirUniteStock
// ---------------------------------------------------------------------------

describe("computeBacPerformance — cost metrics", () => {
  it("calculates coutAliment using product base price (KG unit)", () => {
    // Product priced at 500/KG, consumed 10 KG → cost = 10 * 500 = 5000
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 10,
        consommations: [makeConso(10, 500, "KG")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutAliment).toBe(5000);
  });

  it("handles GRAMME unit correctly for cost", () => {
    // Product priced at 0.5/GRAMME, consumed 1000 GRAMME → cost = 1000 * 0.5 = 500
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 1,
        consommations: [makeConso(1000, 0.5, "GRAMME")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutAliment).toBe(500);
    // quantity in KG: 1000 GRAMME = 1 KG
    expect(result[0].totalAlimentKg).toBe(1);
  });

  it("handles bulk pricing (uniteAchat + contenance)", () => {
    // Product: prixUnitaire=12500 per sac, uniteAchat=SACS, contenance=25 (kg)
    // → prix par KG = 12500/25 = 500/KG
    // Consumed 50 KG → cost = 50 * 500 = 25000
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 50,
        consommations: [{
          quantite: 50,
          produit: { prixUnitaire: 12500, unite: "KG", uniteAchat: "SACS", contenance: 25 },
        }],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutAliment).toBe(25000);
  });

  it("sums costs across multiple ALIMENTATION relevés", () => {
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 2,
        consommations: [makeConso(2, 1000, "KG")],
      }),
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-20"),
        poidsMoyen: null,
        quantiteAliment: 3,
        consommations: [makeConso(3, 1000, "KG")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // 2×1000 + 3×1000 = 5000
    expect(result[0].coutAliment).toBe(5000);
  });

  it("returns 0 coutAliment when consommations are empty", () => {
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 10,
        consommations: [],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutAliment).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. FCR calculation — totalAlimentKg / totalGainBiomasse (including sold fish)
// ---------------------------------------------------------------------------

describe("computeBacPerformance — FCR", () => {
  it("computes FCR as totalAlimentKg / gainBiomasseKg", () => {
    // poidsMoyenInitial=3, nombreInitial=500 → biomasseInitiale = 1.5 kg
    // biometry: poidsMoyen=103, vivants=500 → biomasse = 51.5 kg
    // gain = 51.5 - 1.5 = 50 kg
    // aliment = 100 kg → FCR = 100/50 = 2
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 100, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].fcr).toBe(2);
  });

  it("accounts for sold fish in FCR calculation", () => {
    // 500 initial fish, 50 sold at 100g each → soldBiomasse = 50*100/1000 = 5 kg
    // Remaining: 450 fish at 100g → biomasse = 45 kg
    // Initial biomasse = 3*500/1000 = 1.5 kg
    // Total gain = (45 + 5 - 1.5) = 48.5 kg
    // Feed = 100 kg → FCR = 100/48.5 ≈ 2.06
    const releves = [
      makeReleve({ date: new Date("2026-01-15"), poidsMoyen: 100 }), // biometry before sale
      makeReleve({ typeReleve: "VENTE", date: new Date("2026-01-20"), poidsMoyen: null, nombreVendus: 50 }),
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 100 }), // biometry after sale
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 100, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].soldBiomasseKg).toBe(5); // 50 fish × 100g / 1000
    expect(result[0].fcr).not.toBeNull();
    // gainBiomasse = biomasse(45) + soldBiomasse(5) - initial(1.5) = 48.5
    expect(result[0].gainBiomasseKg).toBe(48.5);
  });

  it("returns null FCR when gainBiomasseKg is zero or negative", () => {
    const releves = [
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 10, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].fcr).toBeNull();
  });

  it("returns null FCR when there is no aliment and no gain", () => {
    const result = computeBacPerformance(makeInput());
    expect(result[0].fcr).toBeNull();
  });

  it("rounds FCR to 2 decimal places", () => {
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 75, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].fcr).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// 10. Biomasse calculation — poidsMoyen × vivants / 1000
// ---------------------------------------------------------------------------

describe("computeBacPerformance — biomasse", () => {
  it("uses poidsMoyenActuel when a biometry exists", () => {
    const releves = [makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 200 })];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].biomasse).toBe(100);
  });

  it("falls back to poidsMoyenInitial when no biometry", () => {
    const result = computeBacPerformance(makeInput());
    expect(result[0].biomasse).toBe(1.5);
  });

  it("accounts for mortality when computing biomasse", () => {
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 100 }),
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-15"), poidsMoyen: null, nombreMorts: 10 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].nombreVivants).toBe(490);
    expect(result[0].biomasse).toBe(49);
  });
});

// ---------------------------------------------------------------------------
// 11. Taux survie — vivants / nombreInitial * 100, accounting for mortality
// ---------------------------------------------------------------------------

describe("computeBacPerformance — taux survie", () => {
  it("is 100% when no mortality", () => {
    const result = computeBacPerformance(makeInput());
    expect(result[0].tauxSurvie).toBe(100);
  });

  it("accounts for mortality in taux survie", () => {
    const releves = [
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-15"), poidsMoyen: null, nombreMorts: 50 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].tauxSurvie).toBe(90);
  });

  it("rounds taux survie to 1 decimal place", () => {
    const releves = [
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-15"), poidsMoyen: null, nombreMorts: 1 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].tauxSurvie).toBe(99.8);
  });

  it("returns 0 when nombreInitial is 0", () => {
    const input = makeInput({
      bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 0 }],
      nombreInitialVague: 0,
    });
    const result = computeBacPerformance(input);
    expect(result[0].tauxSurvie).toBe(0);
  });

  it("never goes below 0 taux survie even with excessive mortality", () => {
    const releves = [
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-15"), poidsMoyen: null, nombreMorts: 9999 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].nombreVivants).toBe(0);
    expect(result[0].tauxSurvie).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Gain biomasse — (biomasse + soldBiomasse) - initial biomasse
// ---------------------------------------------------------------------------

describe("computeBacPerformance — gainBiomasseKg", () => {
  it("is 0 when no biometry (falls back to initial weight)", () => {
    const result = computeBacPerformance(makeInput());
    expect(result[0].gainBiomasseKg).toBe(0);
  });

  it("computes gain as current biomasse minus initial biomasse (no sales)", () => {
    const releves = [makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 })];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gainBiomasseKg).toBe(50);
  });

  it("includes sold fish in gain calculation", () => {
    // 500 initial at 3g → initial biomasse = 1.5 kg
    // Biometry at 100g, then sell 100 fish, then biometry at 100g
    // Remaining: 400 fish at 100g → biomasse = 40 kg
    // Sold: 100 fish × 100g / 1000 = 10 kg
    // Gain = 40 + 10 - 1.5 = 48.5 kg
    const releves = [
      makeReleve({ date: new Date("2026-01-15"), poidsMoyen: 100 }),
      makeReleve({ typeReleve: "VENTE", date: new Date("2026-01-20"), poidsMoyen: null, nombreVendus: 100 }),
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 100 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].soldBiomasseKg).toBe(10);
    expect(result[0].gainBiomasseKg).toBe(48.5);
  });

  it("can be negative when fish weight regresses", () => {
    const releves = [makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 1 })];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gainBiomasseKg).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 13. coutParKgProduit — coutAliment / gainBiomasseKg
// ---------------------------------------------------------------------------

describe("computeBacPerformance — coutParKgProduit", () => {
  it("computes coutParKgProduit as coutAliment / gainBiomasseKg", () => {
    // gain = 50 kg; coutAliment = 50*500 = 25000 → coutParKgProduit = 500
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-15"),
        poidsMoyen: null,
        quantiteAliment: 100,
        consommations: [makeConso(50, 500, "KG")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // coutAliment = 50 * 500 = 25000; gain = 50 kg → 25000/50 = 500
    expect(result[0].coutParKgProduit).toBe(500);
  });

  it("returns null coutParKgProduit when gain is 0 (no biomasse gain)", () => {
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-15"),
        poidsMoyen: null,
        quantiteAliment: 10,
        consommations: [makeConso(10, 100, "KG")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutParKgProduit).toBeNull();
  });

  it("rounds coutParKgProduit to 2 decimal places", () => {
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 4 }),
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-15"),
        poidsMoyen: null,
        quantiteAliment: 1,
        consommations: [makeConso(1, 1, "KG")],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // coutAliment=1, gain = 4*500/1000 - 1.5 = 0.5
    expect(result[0].coutParKgProduit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 14. Biometry period snapshots
// ---------------------------------------------------------------------------

describe("computeBacPerformance — period snapshots", () => {
  it("generates N-1 closed snapshots + 1 open for N biometries", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-21"), poidsMoyen: 20 }),
      makeReleve({ date: new Date("2026-01-31"), poidsMoyen: 35 }),
    ];
    const now = new Date("2026-02-10");
    const result = computeBacPerformance(makeInput({ releves, now }));
    // 2 closed + 1 open = 3
    expect(result[0].periodSnapshots).toHaveLength(3);
    expect(result[0].periodSnapshots[0].enCours).toBe(false);
    expect(result[0].periodSnapshots[1].enCours).toBe(false);
    expect(result[0].periodSnapshots[2].enCours).toBe(true);
  });

  it("captures correct period metrics", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-21"), poidsMoyen: 30 }),
      // Feeding between two biometries
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-15"),
        poidsMoyen: null, quantiteAliment: 5, consommations: [makeConso(5, 200, "KG")],
      }),
      // Mortality between two biometries
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-16"), poidsMoyen: null, nombreMorts: 3 }),
    ];
    const now = new Date("2026-01-21"); // same as last biometry — no open period added
    const result = computeBacPerformance(makeInput({ releves, now }));
    const snap = result[0].periodSnapshots[0];

    expect(snap.periodIndex).toBe(0);
    expect(snap.poidsMoyenDebut).toBe(10);
    expect(snap.poidsMoyenFin).toBe(30);
    expect(snap.dureeJours).toBe(10);
    expect(snap.croissanceG).toBe(20);
    expect(snap.gmq).toBe(2);
    expect(snap.alimentKg).toBe(5);
    expect(snap.coutAlimentPeriode).toBe(1000);
    expect(snap.mortalites).toBe(3);
  });

  it("does not count feeding on the period start date (exclusive start)", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-21"), poidsMoyen: 20 }),
      // Feeding ON the start date (should NOT be included)
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-11"),
        poidsMoyen: null, quantiteAliment: 99, consommations: [makeConso(99, 100, "KG")],
      }),
      // Feeding between (should be included)
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-15"),
        poidsMoyen: null, quantiteAliment: 3, consommations: [makeConso(3, 100, "KG")],
      }),
    ];
    const now = new Date("2026-01-21");
    const result = computeBacPerformance(makeInput({ releves, now }));
    expect(result[0].periodSnapshots[0].alimentKg).toBe(3);
  });

  it("calculates period FCR correctly", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-21"), poidsMoyen: 20 }),
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-15"),
        poidsMoyen: null, quantiteAliment: 5, consommations: [makeConso(5, 100, "KG")],
      }),
    ];
    const now = new Date("2026-01-21");
    const result = computeBacPerformance(makeInput({ releves, now }));
    const snap = result[0].periodSnapshots[0];
    // biomasse debut = 10*500/1000 = 5, biomasse fin = 20*500/1000 = 10
    // gain = 10 - 5 = 5 kg
    // feed = 5 kg → FCR = 5/5 = 1
    expect(snap.fcrPeriode).toBe(1);
  });

  it("open period captures feed and mortality since last biometry", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 50 }),
      // Feed after last biometry
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-15"),
        poidsMoyen: null, quantiteAliment: 8, consommations: [makeConso(8, 300, "KG")],
      }),
      // Mortality after last biometry
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-18"), poidsMoyen: null, nombreMorts: 5 }),
    ];
    const now = new Date("2026-01-21"); // 10 days after biometry
    const result = computeBacPerformance(makeInput({ releves, now }));
    const openSnap = result[0].periodSnapshots.find((s) => s.enCours);
    expect(openSnap).toBeDefined();
    expect(openSnap!.alimentKg).toBe(8);
    expect(openSnap!.coutAlimentPeriode).toBe(2400); // 8 * 300
    expect(openSnap!.mortalites).toBe(5);
    expect(openSnap!.vivantsFin).toBe(495); // 500 - 5
  });

  it("open period has null growth metrics", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 50 }),
    ];
    const now = new Date("2026-01-21");
    const result = computeBacPerformance(makeInput({ releves, now }));
    const openSnap = result[0].periodSnapshots[0];
    expect(openSnap.enCours).toBe(true);
    expect(openSnap.poidsMoyenFin).toBeNull();
    expect(openSnap.croissanceG).toBeNull();
    expect(openSnap.gmq).toBeNull();
    expect(openSnap.biomasseFin).toBeNull();
    expect(openSnap.fcrPeriode).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 15. Edge cases
// ---------------------------------------------------------------------------

describe("computeBacPerformance — edge cases", () => {
  it("distributes nombreInitialVague evenly across bacs when nombreInitial is null", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: null },
      { id: "bac2", nom: "Bac 02", nombreInitial: null },
    ];
    const result = computeBacPerformance(
      makeInput({ bacs, nombreInitialVague: 100 })
    );
    expect(result.find((r) => r.bacId === "bac1")!.nombreInitial).toBe(50);
    expect(result.find((r) => r.bacId === "bac2")!.nombreInitial).toBe(50);
  });

  it("assigns remainder fish to the last bac when nombreInitial is null", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: null },
      { id: "bac2", nom: "Bac 02", nombreInitial: null },
      { id: "bac3", nom: "Bac 03", nombreInitial: null },
    ];
    const result = computeBacPerformance(
      makeInput({ bacs, nombreInitialVague: 100 })
    );
    expect(result.find((r) => r.bacId === "bac1")!.nombreInitial).toBe(33);
    const bac3 = result.find((r) => r.bacId === "bac3")!;
    expect(bac3.nombreInitial).toBe(34);
  });

  it("ignores biometries with null poidsMoyen", () => {
    const releves = [
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: null }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].poidsMoyenActuel).toBeNull();
    expect(result[0].sparklineData).toEqual([]);
  });

  it("handles date strings in releves (not just Date objects)", () => {
    const releves = [
      makeReleve({ date: "2026-01-11T00:00:00.000Z" as unknown as Date, poidsMoyen: 15 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].poidsMoyenActuel).toBe(15);
    expect(result[0].sparklineData.length).toBe(1);
  });

  it("soldBiomasseKg is 0 when no sales exist", () => {
    const releves = [makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 100 })];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].soldBiomasseKg).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 16. Calibrage / COMPTAGE resets in period snapshots
// ---------------------------------------------------------------------------

describe("computeBacPerformance — calibrage resets", () => {
  it("resets vivants at calibrage COMPTAGE and marks period with hasCalibrage", () => {
    // Bac starts with 1000 fish. Calibrage on 01/15 resets to 300.
    const releves: ReleveInput[] = [
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 50 }),
      makeReleve({ date: new Date("2026-01-15"), poidsMoyen: 120 }),
      // COMPTAGE at same date as second biometry (calibrage)
      makeReleve({ typeReleve: "COMPTAGE", date: new Date("2026-01-15"), poidsMoyen: null, nombreCompte: 300 }),
      // Mortality between bio1 and bio2
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-12"), poidsMoyen: null, nombreMorts: 10 }),
      makeReleve({ date: new Date("2026-01-25"), poidsMoyen: 180 }),
      // Mortality after calibrage
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-20"), poidsMoyen: null, nombreMorts: 5 }),
    ];
    const now = new Date("2026-01-30");
    const result = computeBacPerformance(makeInput({ releves, now, bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 1000 }], nombreInitialVague: 1000 }));
    const snaps = result[0].periodSnapshots;

    // Period 0: bio1(01/10) → bio2(01/15) — calibrage at end resets vivants to 300
    expect(snaps[0].hasCalibrage).toBe(true);
    expect(snaps[0].vivantsFin).toBe(300); // reset by COMPTAGE, not 1000-10=990
    expect(snaps[0].vivantsDebut).toBe(1000); // no morts before or on bio1 date (mort on 01/12 is AFTER bio1)

    // Period 1: bio2(01/15) → bio3(01/25) — starts from 300 (post-calibrage)
    expect(snaps[1].hasCalibrage).toBe(false);
    expect(snaps[1].vivantsDebut).toBe(300);
    expect(snaps[1].vivantsFin).toBe(295); // 300 - 5 morts
    expect(snaps[1].poidsMoyenDebut).toBe(120);
    expect(snaps[1].poidsMoyenFin).toBe(180);

    // Open period starts from 295
    expect(snaps[2].enCours).toBe(true);
    expect(snaps[2].vivantsDebut).toBe(295);
  });

  it("handles bac that starts at 0 and receives fish via calibrage", () => {
    // Bac 08 scenario: starts at 0, gets 2250 fish via calibrage on 01/15
    const releves: ReleveInput[] = [
      makeReleve({ date: new Date("2026-01-15"), poidsMoyen: 100 }),
      // COMPTAGE sets fish count to 2250
      makeReleve({ typeReleve: "COMPTAGE", date: new Date("2026-01-15"), poidsMoyen: null, nombreCompte: 2250 }),
      makeReleve({ date: new Date("2026-01-25"), poidsMoyen: 145 }),
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-20"), poidsMoyen: null, nombreMorts: 64 }),
    ];
    const now = new Date("2026-01-30");
    const result = computeBacPerformance(makeInput({
      releves, now,
      bacs: [{ id: "bac1", nom: "Bac 08", nombreInitial: 0 }],
      nombreInitialVague: 5500,
    }));
    const snaps = result[0].periodSnapshots;

    // Period 0: bio1(01/15) → bio2(01/25)
    // Bio1 coincides with calibrage → vivantsDebut = 2250 (from COMPTAGE)
    expect(snaps[0].vivantsDebut).toBe(2250);
    expect(snaps[0].vivantsFin).toBe(2186); // 2250 - 64
    expect(snaps[0].poidsMoyenDebut).toBe(100);
    expect(snaps[0].poidsMoyenFin).toBe(145);
    // hasCalibrage = false because the calibrage is at the START (sets initial state)
    // not at the END (which would distort biomass gain)
    expect(snaps[0].hasCalibrage).toBe(false);

    // Biomass should be positive
    expect(snaps[0].biomasseDebut).toBe(225); // 2250 * 100 / 1000
    expect(snaps[0].biomasseFin).toBeCloseTo(316.97, 1); // 2186 * 145 / 1000
  });

  it("FCR is null for calibrage periods (distorted by transfers)", () => {
    // Fish move OUT: 1000→200 via calibrage
    const releves: ReleveInput[] = [
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 50 }),
      makeReleve({ date: new Date("2026-01-20"), poidsMoyen: 100 }),
      makeReleve({ typeReleve: "COMPTAGE", date: new Date("2026-01-20"), poidsMoyen: null, nombreCompte: 200 }),
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-15"),
        poidsMoyen: null, quantiteAliment: 50, consommations: [makeConso(50, 100, "KG")],
      }),
    ];
    const now = new Date("2026-01-20");
    const result = computeBacPerformance(makeInput({ releves, now, bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 1000 }], nombreInitialVague: 1000 }));
    const snap = result[0].periodSnapshots[0];

    // Has calibrage → FCR should be null (biomass gain distorted by fish leaving)
    expect(snap.hasCalibrage).toBe(true);
    expect(snap.fcrPeriode).toBeNull();
  });

  it("non-calibrage periods still compute FCR normally", () => {
    const releves: ReleveInput[] = [
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 10 }),
      // Calibrage at bio2 (end of period 0)
      makeReleve({ date: new Date("2026-01-15"), poidsMoyen: 50 }),
      makeReleve({ typeReleve: "COMPTAGE", date: new Date("2026-01-15"), poidsMoyen: null, nombreCompte: 400 }),
      // bio3: post-calibrage growth period
      makeReleve({ date: new Date("2026-01-25"), poidsMoyen: 80 }),
      // Feed between bio2 and bio3
      makeReleve({
        typeReleve: "ALIMENTATION", date: new Date("2026-01-20"),
        poidsMoyen: null, quantiteAliment: 10, consommations: [makeConso(10, 100, "KG")],
      }),
    ];
    const now = new Date("2026-01-25");
    const result = computeBacPerformance(makeInput({ releves, now, bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 500 }], nombreInitialVague: 500 }));
    const snaps = result[0].periodSnapshots;

    // Period 0 (bio1→bio2) has calibrage at END → hasCalibrage true, null FCR
    expect(snaps[0].hasCalibrage).toBe(true);
    expect(snaps[0].fcrPeriode).toBeNull();

    // Period 1 (bio2→bio3) — starts from calibrage count but no calibrage at END
    expect(snaps[1].hasCalibrage).toBe(false);
    expect(snaps[1].vivantsDebut).toBe(400); // from COMPTAGE reset at start
    // biomasse debut = 400*50/1000 = 20 kg
    // biomasse fin = 400*80/1000 = 32 kg
    // gain = 12 kg, feed = 10 kg → FCR = 10/12 = 0.83
    expect(snaps[1].fcrPeriode).toBeCloseTo(0.83, 2);
  });

  it("multiple comptages — uses last comptage on same day", () => {
    // Edge case: two COMPTAGE on same day
    const releves: ReleveInput[] = [
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 20 }),
      makeReleve({ date: new Date("2026-01-20"), poidsMoyen: 40 }),
      makeReleve({ typeReleve: "COMPTAGE", date: new Date("2026-01-20"), poidsMoyen: null, nombreCompte: 500 }),
      makeReleve({ typeReleve: "COMPTAGE", date: new Date("2026-01-20"), poidsMoyen: null, nombreCompte: 600 }),
    ];
    const now = new Date("2026-01-25");
    const result = computeBacPerformance(makeInput({ releves, now, bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 1000 }], nombreInitialVague: 1000 }));
    const snaps = result[0].periodSnapshots;

    // The last COMPTAGE (600) should be used
    expect(snaps[0].vivantsFin).toBe(600);
  });
});
