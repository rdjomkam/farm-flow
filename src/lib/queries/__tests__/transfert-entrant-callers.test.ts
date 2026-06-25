/**
 * Tests régression CS.2 second followup — 4 callers résiduels de computeVivantsByBac
 * sans transfertDestBacIds.
 *
 * Ces tests vérifient que :
 * 1. calculerDensiteBac() accepte et propage options.transfertDestBacIds
 * 2. calculerDensiteVague() accepte et propage options.transfertDestBacIds
 * 3. Les TRANSFERT entrants (relevés miroirs) ne sont PAS soustraits sur une
 *    vague GROSSISSEMENT quand le Set est fourni.
 *
 * Les callers query (getPoidsMoyenActuelVague, getCoutProductionVague) font des
 * appels Prisma et sont couverts indirectement par les tests d'intégration ;
 * ici on couvre uniquement les fonctions pures calculerDensiteBac / calculerDensiteVague.
 */

import { describe, it, expect } from "vitest";
import { calculerDensiteBac, calculerDensiteVague } from "@/lib/calculs";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransfert(bacId: string, nombreTransferes: number, date = new Date("2026-03-10")) {
  return {
    typeReleve: TypeReleve.TRANSFERT,
    bacId,
    date,
    nombreMorts: null,
    nombreCompte: null,
    nombreVendus: null,
    nombreTransferes,
  };
}

function makeMort(bacId: string, nombreMorts: number, date = new Date("2026-03-15")) {
  return {
    typeReleve: TypeReleve.MORTALITE,
    bacId,
    date,
    nombreMorts,
    nombreCompte: null,
    nombreVendus: null,
    nombreTransferes: null,
  };
}

function makeBiometrie(bacId: string | null, poidsMoyen: number, date = new Date("2026-03-20")) {
  return {
    typeReleve: TypeReleve.BIOMETRIE,
    bacId,
    date,
    poidsMoyen,
    nombreMorts: null,
    nombreCompte: null,
    nombreVendus: null,
    nombreTransferes: null,
  };
}

// ---------------------------------------------------------------------------
// Scénario Vague-26-03 (GROSSISSEMENT, 4 bacs destination de PRE_GROSSISSEMENT)
// ---------------------------------------------------------------------------
// Chaque bac reçoit 1744 poissons via un transfert. Le relevé TRANSFERT miroir
// existe sur chaque bac avec nombreTransferes = 1744. Sans transfertDestBacIds,
// computeVivantsByBac compte ce relevé COMME un sortant → vivants = 0.
// Avec le Set, le relevé est ignoré (pré-comptage dans nombreInitial).

const bac1 = { id: "bac-1", volume: 25000, nombreInitial: 1744 };
const bac2 = { id: "bac-2", volume: 25000, nombreInitial: 1744 };
const bac3 = { id: "bac-3", volume: 25000, nombreInitial: 1744 };
const bac4 = { id: "bac-4", volume: 25000, nombreInitial: 1744 };
const bacsGrossissement = [bac1, bac2, bac3, bac4];
const bacsSimple = bacsGrossissement.map((b) => ({ id: b.id, nombreInitial: b.nombreInitial }));
const nombreInitialVague = 6976; // 4 × 1744

const relevesGrossissement = [
  // Relevés TRANSFERT miroirs (entrants) — un par bac
  makeTransfert("bac-1", 1744, new Date("2026-03-10")),
  makeTransfert("bac-2", 1744, new Date("2026-03-10")),
  makeTransfert("bac-3", 1744, new Date("2026-03-10")),
  makeTransfert("bac-4", 1744, new Date("2026-03-10")),
  // Quelques morts après le transfert
  makeMort("bac-1", 18, new Date("2026-03-15")),
  // Biométrie globale pour le calcul de densité
  makeBiometrie(null, 120, new Date("2026-03-20")), // 120g par poisson
];

const allDestBacIds = new Set(["bac-1", "bac-2", "bac-3", "bac-4"]);

// ---------------------------------------------------------------------------
// calculerDensiteBac — régression
// ---------------------------------------------------------------------------

describe("calculerDensiteBac — vague GROSSISSEMENT destination de transferts", () => {
  it("SANS transfertDestBacIds : TRANSFERT entrant soustrait → vivants = 0 → densité = null", () => {
    // bac-1 : 1744 - 1744 (transfert soustrait) - 18 (morts) = -18 → clampé à 0
    const densite = calculerDensiteBac(
      bac1,
      bacsSimple,
      relevesGrossissement,
      nombreInitialVague
    );
    // vivantsBac = 0 → densité = null (guard: vivantsBac <= 0)
    expect(densite).toBeNull();
  });

  it("AVEC transfertDestBacIds : TRANSFERT ignoré → vivants = 1726 → densité calculée", () => {
    const densite = calculerDensiteBac(
      bac1,
      bacsSimple,
      relevesGrossissement,
      nombreInitialVague,
      { transfertDestBacIds: allDestBacIds }
    );
    // vivantsBac = 1744 - 18 = 1726
    // biomasse = (120g × 1726) / 1000 = 207.12 kg
    // volume = 25000 / 1000 = 25 m3
    // densité = 207.12 / 25 = 8.2848 kg/m3
    expect(densite).not.toBeNull();
    expect(densite!).toBeGreaterThan(0);
    // Valeur exacte : round((120 * 1726 / 1000) / (25000 / 1000) * 100) / 100 = 8.28
    expect(densite!).toBeCloseTo(8.28, 1);
  });

  it("bac sans TRANSFERT entrant : options sans effet (non-régression)", () => {
    // Un bac d'une vague PRE_GROSSISSEMENT normale : TRANSFERT sortant
    const bacSrc = { id: "bac-src", volume: 20000, nombreInitial: 2000 };
    const bacsSrc = [{ id: "bac-src", nombreInitial: 2000 }];
    const releves = [
      makeMort("bac-src", 10, new Date("2026-03-05")),
      makeTransfert("bac-src", 1744, new Date("2026-03-10")), // sortant
      makeBiometrie("bac-src", 100),
    ];
    // Sans Set : TRANSFERT soustrait → 2000 - 10 - 1744 = 246 vivants
    const densiteSans = calculerDensiteBac(bacSrc, bacsSrc, releves, 2000);
    // Avec Set vide : comportement identique
    const densiteVide = calculerDensiteBac(bacSrc, bacsSrc, releves, 2000, {
      transfertDestBacIds: new Set<string>(),
    });
    expect(densiteSans).toEqual(densiteVide);
    expect(densiteSans).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerDensiteVague — régression
// ---------------------------------------------------------------------------

describe("calculerDensiteVague — vague GROSSISSEMENT destination de transferts", () => {
  it("SANS transfertDestBacIds : tous les bacs à 0 vivants → densité = null", () => {
    const densite = calculerDensiteVague(
      bacsGrossissement,
      relevesGrossissement,
      nombreInitialVague
    );
    // vivants de tous les bacs = 0 → totalVolumeM3 = 0 → null
    expect(densite).toBeNull();
  });

  it("AVEC transfertDestBacIds : vivants corrects → densité agrégée > 0", () => {
    const densite = calculerDensiteVague(
      bacsGrossissement,
      relevesGrossissement,
      nombreInitialVague,
      { transfertDestBacIds: allDestBacIds }
    );
    // vivants : bac-1 = 1726, bac-2/3/4 = 1744 chacun
    // biometrie globale = 120g
    // biomasse totale = (120 × (1726 + 1744 + 1744 + 1744)) / 1000
    //                 = (120 × 6958) / 1000 = 834.96 kg
    // volume total = 4 × 25 m3 = 100 m3
    // densité = 834.96 / 100 ≈ 8.35 kg/m3
    expect(densite).not.toBeNull();
    expect(densite!).toBeGreaterThan(0);
    expect(densite!).toBeCloseTo(8.35, 0);
  });

  it("vague sans transferts entrants : options sans effet (non-régression)", () => {
    const bacSrc1 = { id: "src-1", volume: 20000, nombreInitial: 2000 };
    const bacSrc2 = { id: "src-2", volume: 20000, nombreInitial: 2000 };
    const releves = [
      makeMort("src-1", 10),
      makeBiometrie(null, 100),
    ];
    const densiteSans = calculerDensiteVague([bacSrc1, bacSrc2], releves, 4000);
    const densiteVide = calculerDensiteVague([bacSrc1, bacSrc2], releves, 4000, {
      transfertDestBacIds: new Set<string>(),
    });
    expect(densiteSans).toEqual(densiteVide);
  });
});
