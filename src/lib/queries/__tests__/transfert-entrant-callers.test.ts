/**
 * Tests régression CS.2 second followup / GV.1-GV.2 — callers résiduels de
 * computeVivantsByBac sans transfertGroupesById.
 *
 * Ces tests vérifient que :
 * 1. calculerDensiteBac() accepte et propage options.transfertGroupesById
 * 2. calculerDensiteVague() accepte et propage options.transfertGroupesById
 * 3. Les TRANSFERT entrants (relevés miroirs) ne sont PAS soustraits sur une
 *    vague GROSSISSEMENT quand la Map est fournie, discrimination PAR RELEVÉ.
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

function makeTransfert(
  bacId: string,
  nombreTransferes: number,
  date = new Date("2026-03-10"),
  transfertGroupeId: string | null = null
) {
  return {
    typeReleve: TypeReleve.TRANSFERT,
    bacId,
    date,
    nombreMorts: null,
    nombreCompte: null,
    nombreVendus: null,
    nombreTransferes,
    transfertGroupeId,
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
    transfertGroupeId: null,
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
    transfertGroupeId: null,
  };
}

// ---------------------------------------------------------------------------
// Scénario Vague-26-03 (GROSSISSEMENT, 4 bacs destination de PRE_GROSSISSEMENT)
// ---------------------------------------------------------------------------
// Chaque bac reçoit 1744 poissons via un transfert (son propre TransfertGroupe).
// Le relevé TRANSFERT miroir existe sur chaque bac avec nombreTransferes = 1744.
// Sans transfertGroupesById, computeVivantsByBac compte ce relevé COMME un
// sortant → vivants = 0. Avec la Map, le relevé est ignoré (pré-comptage dans
// nombreInitial) car bacId === bacDestId du groupe.

const BAC_SOURCE_PG = "bac-src-prep";
const TG_1 = "tg-bac-1";
const TG_2 = "tg-bac-2";
const TG_3 = "tg-bac-3";
const TG_4 = "tg-bac-4";

const bac1 = { id: "bac-1", volume: 25000, nombreInitial: 1744 };
const bac2 = { id: "bac-2", volume: 25000, nombreInitial: 1744 };
const bac3 = { id: "bac-3", volume: 25000, nombreInitial: 1744 };
const bac4 = { id: "bac-4", volume: 25000, nombreInitial: 1744 };
const bacsGrossissement = [bac1, bac2, bac3, bac4];
const bacsSimple = bacsGrossissement.map((b) => ({ id: b.id, nombreInitial: b.nombreInitial }));
const nombreInitialVague = 6976; // 4 × 1744

const relevesGrossissement = [
  // Relevés TRANSFERT miroirs (entrants) — un par bac, chacun avec son propre TransfertGroupe
  makeTransfert("bac-1", 1744, new Date("2026-03-10"), TG_1),
  makeTransfert("bac-2", 1744, new Date("2026-03-10"), TG_2),
  makeTransfert("bac-3", 1744, new Date("2026-03-10"), TG_3),
  makeTransfert("bac-4", 1744, new Date("2026-03-10"), TG_4),
  // Quelques morts après le transfert
  makeMort("bac-1", 18, new Date("2026-03-15")),
  // Biométrie globale pour le calcul de densité
  makeBiometrie(null, 120, new Date("2026-03-20")), // 120g par poisson
];

const transfertGroupesById = new Map([
  [TG_1, { bacSourceId: BAC_SOURCE_PG, bacDestId: "bac-1" }],
  [TG_2, { bacSourceId: BAC_SOURCE_PG, bacDestId: "bac-2" }],
  [TG_3, { bacSourceId: BAC_SOURCE_PG, bacDestId: "bac-3" }],
  [TG_4, { bacSourceId: BAC_SOURCE_PG, bacDestId: "bac-4" }],
]);

// ---------------------------------------------------------------------------
// calculerDensiteBac — régression
// ---------------------------------------------------------------------------

describe("calculerDensiteBac — vague GROSSISSEMENT destination de transferts", () => {
  it("SANS transfertGroupesById : TRANSFERT entrant soustrait → vivants = 0 → densité = null", () => {
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

  it("AVEC transfertGroupesById : TRANSFERT ignoré → vivants = 1726 → densité calculée", () => {
    const densite = calculerDensiteBac(
      bac1,
      bacsSimple,
      relevesGrossissement,
      nombreInitialVague,
      { transfertGroupesById }
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
      makeTransfert("bac-src", 1744, new Date("2026-03-10")), // sortant (pas de transfertGroupeId)
      makeBiometrie("bac-src", 100),
    ];
    // Sans Map : TRANSFERT soustrait → 2000 - 10 - 1744 = 246 vivants
    const densiteSans = calculerDensiteBac(bacSrc, bacsSrc, releves, 2000);
    // Avec Map vide : comportement identique
    const densiteVide = calculerDensiteBac(bacSrc, bacsSrc, releves, 2000, {
      transfertGroupesById: new Map(),
    });
    expect(densiteSans).toEqual(densiteVide);
    expect(densiteSans).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerDensiteVague — régression
// ---------------------------------------------------------------------------

describe("calculerDensiteVague — vague GROSSISSEMENT destination de transferts", () => {
  it("SANS transfertGroupesById : tous les bacs à 0 vivants → densité = null", () => {
    const densite = calculerDensiteVague(
      bacsGrossissement,
      relevesGrossissement,
      nombreInitialVague
    );
    // vivants de tous les bacs = 0 → totalVolumeM3 = 0 → null
    expect(densite).toBeNull();
  });

  it("AVEC transfertGroupesById : vivants corrects → densité agrégée > 0", () => {
    const densite = calculerDensiteVague(
      bacsGrossissement,
      relevesGrossissement,
      nombreInitialVague,
      { transfertGroupesById }
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
      transfertGroupesById: new Map(),
    });
    expect(densiteSans).toEqual(densiteVide);
  });
});
