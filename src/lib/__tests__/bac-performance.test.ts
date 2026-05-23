/**
 * Tests for src/lib/bac-performance.ts
 *
 * Covers: FCR, GMQ, biomasse, taux survie, feed cost, ranking, edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  computeBacPerformance,
  BacPerformanceInput,
} from "@/lib/bac-performance";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

type ReleveInput = BacPerformanceInput["releves"][number];

function makeInput(overrides?: Partial<BacPerformanceInput>): BacPerformanceInput {
  return {
    bacs: [{ id: "bac1", nom: "Bac 01", nombreInitial: 500 }],
    releves: [],
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
    // Accept both Date instance and string representation
    const iso =
      d instanceof Date
        ? d.toISOString().slice(0, 10)
        : new Date(d as string | Date).toISOString().slice(0, 10);
    expect(iso).toBe("2026-01-21");
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
});

// ---------------------------------------------------------------------------
// 5. GMQ calculation — (current - previous) / daysBetween
// ---------------------------------------------------------------------------

describe("computeBacPerformance — GMQ with 2 biometries", () => {
  it("computes GMQ as (currentPoids - previousPoids) / daysBetween", () => {
    // biometry1 = 2026-01-01 → 10g, biometry2 = 2026-01-11 → 30g (10 days apart)
    // GMQ = (30 - 10) / 10 = 2 g/day
    const releves = [
      makeReleve({ date: new Date("2026-01-01"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-11"), poidsMoyen: 30 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gmq).toBe(2);
  });

  it("rounds GMQ to 2 decimal places", () => {
    // (17 - 10) / 3 = 2.333...
    const releves = [
      makeReleve({ date: new Date("2026-01-01"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-04"), poidsMoyen: 17 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gmq).toBe(2.33);
  });

  it("uses minimum 1 day when biometries fall on the same day", () => {
    // Same date → daysBetween clamped to 1
    const releves = [
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 10 }),
      makeReleve({ date: new Date("2026-01-10"), poidsMoyen: 20 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // (20 - 10) / 1 = 10
    expect(result[0].gmq).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 6. Multiple bacs ranked by FCR — best FCR gets rank 1, null FCR goes last
// ---------------------------------------------------------------------------

describe("computeBacPerformance — ranking by FCR", () => {
  it("assigns rank 1 to the bac with the lowest FCR", () => {
    // bac1: gain=10kg, aliment=15kg → FCR=1.5
    // bac2: gain=10kg, aliment=20kg → FCR=2.0
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: 100 },
      { id: "bac2", nom: "Bac 02", nombreInitial: 100 },
    ];
    const releves: ReleveInput[] = [
      // Biometries to create gain (poidsMoyenInitial=3, so we need poidsMoyenActuel > 3)
      makeReleve({ bacId: "bac1", date: new Date("2026-02-01"), poidsMoyen: 103 }), // gain = (103*100/1000) - (3*100/1000) = 10.3 - 0.3 = 10
      makeReleve({ bacId: "bac2", date: new Date("2026-02-01"), poidsMoyen: 103 }),
      // Alimentation
      makeReleve({ bacId: "bac1", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 15, consommations: [] }),
      makeReleve({ bacId: "bac2", typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 20, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ bacs, releves, nombreInitialVague: 200 }));
    const bac1Entry = result.find((r) => r.bacId === "bac1")!;
    const bac2Entry = result.find((r) => r.bacId === "bac2")!;
    expect(bac1Entry.rank).toBe(1);
    expect(bac2Entry.rank).toBe(2);
  });

  it("gives '#1 Meilleur FCR' label to rank 1 bac with valid FCR", () => {
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
    expect(rank1.rankLabel).toBe("#1 Meilleur FCR");
  });

  it("places bacs with null FCR last in ranking", () => {
    // bac1 has gain → FCR computed; bac2 has no biometry → null FCR
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
    expect(bac2Entry.rank).toBe(2); // last
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
// 7. Feed metrics — totalAlimentKg sums from ALIMENTATION relevés
// ---------------------------------------------------------------------------

describe("computeBacPerformance — feed metrics", () => {
  it("sums totalAlimentKg from all ALIMENTATION relevés for the bac", () => {
    const releves = [
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-10"), poidsMoyen: null, quantiteAliment: 5, consommations: [] }),
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-20"), poidsMoyen: null, quantiteAliment: 7.5, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].totalAlimentKg).toBe(12.5);
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
// 8. Cost metrics — coutAliment sums consommation quantities × product price
// ---------------------------------------------------------------------------

describe("computeBacPerformance — cost metrics", () => {
  it("calculates coutAliment as sum of quantite × prixUnitaire across all consommations", () => {
    // consommation1: 10 × 500 = 5000
    // consommation2: 5 × 200 = 1000
    // total = 6000
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 15,
        consommations: [
          { quantite: 10, produit: { prixUnitaire: 500 } },
          { quantite: 5, produit: { prixUnitaire: 200 } },
        ],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutAliment).toBe(6000);
  });

  it("sums consommations across multiple ALIMENTATION relevés", () => {
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-10"),
        poidsMoyen: null,
        quantiteAliment: 5,
        consommations: [{ quantite: 2, produit: { prixUnitaire: 1000 } }],
      }),
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-20"),
        poidsMoyen: null,
        quantiteAliment: 5,
        consommations: [{ quantite: 3, produit: { prixUnitaire: 1000 } }],
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
// 9. FCR calculation — totalAlimentKg / gainBiomasseKg, null when no gain
// ---------------------------------------------------------------------------

describe("computeBacPerformance — FCR", () => {
  it("computes FCR as totalAlimentKg / gainBiomasseKg", () => {
    // poidsMoyenInitial=3, nombreInitial=500 → biomasseInitiale = 3*500/1000 = 1.5 kg
    // biometry: poidsMoyen=103, vivants=500 → biomasse = 103*500/1000 = 51.5 kg
    // gain = 51.5 - 1.5 = 50 kg
    // aliment = 100 kg → FCR = 100/50 = 2
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({ typeReleve: "ALIMENTATION", date: new Date("2026-01-15"), poidsMoyen: null, quantiteAliment: 100, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].fcr).toBe(2);
  });

  it("returns null FCR when gainBiomasseKg is zero or negative", () => {
    // No biometry → biomasse stays at initial → gain = 0
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
    // gain = 50 kg, aliment = 75 kg → FCR = 1.5
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
    // poidsMoyen=200g, 500 vivants → 200*500/1000 = 100 kg
    const releves = [makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 200 })];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].biomasse).toBe(100);
  });

  it("falls back to poidsMoyenInitial when no biometry", () => {
    // poidsMoyenInitial=3, 500 vivants → 3*500/1000 = 1.5 kg
    const result = computeBacPerformance(makeInput());
    expect(result[0].biomasse).toBe(1.5);
  });

  it("accounts for mortality when computing biomasse", () => {
    // 500 initial, 10 morts → 490 vivants; poidsMoyen=100 → 100*490/1000 = 49
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
    // 500 initial, 50 morts → 450 vivants → 450/500 * 100 = 90%
    const releves = [
      makeReleve({ typeReleve: "MORTALITE", date: new Date("2026-01-15"), poidsMoyen: null, nombreMorts: 50 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].tauxSurvie).toBe(90);
  });

  it("rounds taux survie to 1 decimal place", () => {
    // 500 initial, 1 mort → 499/500 * 100 = 99.8%
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
// 12. Gain biomasse — current - initial biomasse
// ---------------------------------------------------------------------------

describe("computeBacPerformance — gainBiomasseKg", () => {
  it("is 0 when no biometry (falls back to initial weight)", () => {
    const result = computeBacPerformance(makeInput());
    expect(result[0].gainBiomasseKg).toBe(0);
  });

  it("computes gain as current biomasse minus initial biomasse", () => {
    // initial: 3g * 500 / 1000 = 1.5 kg
    // current: 103g * 500 / 1000 = 51.5 kg
    // gain = 50 kg
    const releves = [makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 })];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].gainBiomasseKg).toBe(50);
  });

  it("can be negative when fish weight regresses", () => {
    // poidsMoyen=1 (below initial 3) → biomasse = 1*500/1000 = 0.5 < 1.5 initial
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
    // gain = 50 kg; coutAliment = 25000 → coutParKgProduit = 500
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 103 }),
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-15"),
        poidsMoyen: null,
        quantiteAliment: 100,
        consommations: [{ quantite: 50, produit: { prixUnitaire: 500 } }],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // coutAliment = 50 * 500 = 25000; gain = 50 kg
    expect(result[0].coutParKgProduit).toBe(500);
  });

  it("returns null coutParKgProduit when gain is 0 (no biomasse gain)", () => {
    // No biometry → gain = 0
    const releves = [
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-15"),
        poidsMoyen: null,
        quantiteAliment: 10,
        consommations: [{ quantite: 10, produit: { prixUnitaire: 100 } }],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].coutParKgProduit).toBeNull();
  });

  it("rounds coutParKgProduit to 2 decimal places", () => {
    // Need a gain that doesn't divide evenly
    // poidsMoyenInitial=3, nombreInitial=500 → biomasseInitiale = 1.5
    // poidsMoyen=4, vivants=500 → biomasse = 2, gain = 0.5
    // coutAliment = 1, coutParKgProduit = 1/0.5 = 2.0
    const releves = [
      makeReleve({ date: new Date("2026-02-01"), poidsMoyen: 4 }),
      makeReleve({
        typeReleve: "ALIMENTATION",
        date: new Date("2026-01-15"),
        poidsMoyen: null,
        quantiteAliment: 1,
        consommations: [{ quantite: 1, produit: { prixUnitaire: 1 } }],
      }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    // coutAliment=1, gain = 4*500/1000 - 1.5 = 2-1.5 = 0.5
    expect(result[0].coutParKgProduit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 14. Edge cases
// ---------------------------------------------------------------------------

describe("computeBacPerformance — edge cases", () => {
  it("distributes nombreInitialVague evenly across bacs when nombreInitial is null", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: null },
      { id: "bac2", nom: "Bac 02", nombreInitial: null },
    ];
    // 100 / 2 = 50 each
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
    // 100 / 3 = 33 floor, remainder = 1 → last bac gets 34
    const result = computeBacPerformance(
      makeInput({ bacs, nombreInitialVague: 100 })
    );
    expect(result.find((r) => r.bacId === "bac1")!.nombreInitial).toBe(33);
    // bac2 or bac3 has 34 (the last one alphabetically by index)
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

  it("ignores ALIMENTATION relevés that belong to another bac", () => {
    const bacs = [
      { id: "bac1", nom: "Bac 01", nombreInitial: 100 },
      { id: "bac2", nom: "Bac 02", nombreInitial: 100 },
    ];
    const releves: ReleveInput[] = [
      makeReleve({ bacId: "bac2", typeReleve: "ALIMENTATION", date: new Date("2026-01-10"), poidsMoyen: null, quantiteAliment: 99, consommations: [] }),
    ];
    const result = computeBacPerformance(makeInput({ bacs, releves, nombreInitialVague: 200 }));
    const bac1 = result.find((r) => r.bacId === "bac1")!;
    expect(bac1.totalAlimentKg).toBe(0);
  });

  it("handles string dates in releves (ISO format)", () => {
    const releves = [
      makeReleve({ date: "2026-01-11T00:00:00.000Z", poidsMoyen: 50 }),
    ];
    const result = computeBacPerformance(makeInput({ releves }));
    expect(result[0].poidsMoyenActuel).toBe(50);
    expect(result[0].sparklineData).toHaveLength(1);
  });
});
