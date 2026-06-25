/**
 * Tests régression CS.2 followup — createCalibrage doit passer transfertDestBacIds
 * à computeVivantsByBac pour que les vagues GROSSISSEMENT (destination de transferts)
 * affichent des vivants corrects et non 0.
 *
 * Repro : Vague-26-03 (GROSSISSEMENT, 4 bacs dest de 26-03-Prep)
 *   - Chaque bac a un relevé TRANSFERT miroir avec nombreTransferes = 1744
 *   - Sans transfertDestBacIds → compté comme sortant → vivants = init - 1744 ≤ 0 → 0
 *   - Avec transfertDestBacIds → TRANSFERT ignoré (pré-comptage) → vivants = init - morts ✓
 */

import { describe, it, expect } from "vitest";
import { computeVivantsByBac } from "@/lib/calculs";
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

// ---------------------------------------------------------------------------
// Cas 1 — Régression Vague-26-03 (GROSSISSEMENT, 4 bacs destination)
// ---------------------------------------------------------------------------

describe("computeVivantsByBac — vague GROSSISSEMENT destination de transferts", () => {
  // Données calquées sur Vague-26-03 :
  //   4 bacs, chacun avec nombreInitial = ~1740 (issu du transfert, inclus dans assignation)
  //   1 relevé TRANSFERT miroir par bac (1744 poissons "entrants")
  //   quelques morts après le transfert

  const bac1 = { id: "bac-1", nombreInitial: 1744 };
  const bac2 = { id: "bac-2", nombreInitial: 1744 };
  const bac3 = { id: "bac-3", nombreInitial: 1744 };
  const bac4 = { id: "bac-4", nombreInitial: 1744 };
  const bacs = [bac1, bac2, bac3, bac4];

  const nombreInitialVague = 6976; // 4 × 1744

  const releves = [
    // Relevés TRANSFERT miroirs (entrants) — un par bac
    makeTransfert("bac-1", 1744, new Date("2026-03-10")),
    makeTransfert("bac-2", 1744, new Date("2026-03-10")),
    makeTransfert("bac-3", 1744, new Date("2026-03-10")),
    makeTransfert("bac-4", 1744, new Date("2026-03-10")),
    // Quelques morts après le transfert
    makeMort("bac-1", 18, new Date("2026-03-15")),
    makeMort("bac-2", 0, new Date("2026-03-15")),
    makeMort("bac-3", 0, new Date("2026-03-15")),
    makeMort("bac-4", 0, new Date("2026-03-15")),
  ];

  it("SANS transfertDestBacIds : les TRANSFERT entrants sont comptés comme sortants → vivants clampés à 0", () => {
    const vivants = computeVivantsByBac(bacs, releves, nombreInitialVague);

    // Sans le Set, TRANSFERT soustrait → bac-1 = 1744 - 1744 - 18 = -18 → 0
    // bac-2/3/4 = 1744 - 1744 = 0
    expect(vivants.get("bac-1")).toBe(0);
    expect(vivants.get("bac-2")).toBe(0);
    expect(vivants.get("bac-3")).toBe(0);
    expect(vivants.get("bac-4")).toBe(0);
  });

  it("AVEC transfertDestBacIds : les TRANSFERT entrants sont ignorés (pré-comptage) → vivants = init - morts", () => {
    const transfertDestBacIds = new Set(["bac-1", "bac-2", "bac-3", "bac-4"]);
    const vivants = computeVivantsByBac(bacs, releves, nombreInitialVague, { transfertDestBacIds });

    // Avec le Set, TRANSFERT ignoré (pré-comptage) → bac-1 = 1744 - 18 = 1726
    expect(vivants.get("bac-1")).toBe(1726);
    // bac-2/3/4 = 1744 - 0 = 1744
    expect(vivants.get("bac-2")).toBe(1744);
    expect(vivants.get("bac-3")).toBe(1744);
    expect(vivants.get("bac-4")).toBe(1744);
  });

  it("total vivants avec transfertDestBacIds reflète la réalité (5958)", () => {
    const transfertDestBacIds = new Set(["bac-1", "bac-2", "bac-3", "bac-4"]);
    const vivants = computeVivantsByBac(bacs, releves, nombreInitialVague, { transfertDestBacIds });

    const total = [...vivants.values()].reduce((s, v) => s + v, 0);
    // 1726 + 1744 + 1744 + 1744 = 6958
    expect(total).toBe(6958);
  });
});

// ---------------------------------------------------------------------------
// Cas 2 — Non-régression : vague PG sans transferts entrants (comportement inchangé)
// ---------------------------------------------------------------------------

describe("computeVivantsByBac — vague PRE_GROSSISSEMENT (source, pas de transfertDestBacIds)", () => {
  const bac1 = { id: "bac-src-1", nombreInitial: 2000 };
  const bac2 = { id: "bac-src-2", nombreInitial: 2000 };
  const bacs = [bac1, bac2];

  const nombreInitialVague = 4000;

  const releves = [
    // TRANSFERT sortant : les poissons quittent ce bac vers une vague GROSSISSEMENT
    makeTransfert("bac-src-1", 1744, new Date("2026-03-10")),
    makeTransfert("bac-src-2", 1744, new Date("2026-03-10")),
    // Morts avant le transfert
    makeMort("bac-src-1", 10, new Date("2026-03-05")),
  ];

  it("sans transfertDestBacIds (vague source) : TRANSFERT soustrait normalement", () => {
    // transfertDestBacIds = {} (vide) ou absent → comportement historique
    const vivantsVide = computeVivantsByBac(bacs, releves, nombreInitialVague, {
      transfertDestBacIds: new Set<string>(),
    });
    const vivantsAbsent = computeVivantsByBac(bacs, releves, nombreInitialVague);

    // bac-src-1 : 2000 - 10 (morts) - 1744 (transfert sortant) = 246
    expect(vivantsVide.get("bac-src-1")).toBe(246);
    expect(vivantsAbsent.get("bac-src-1")).toBe(246);

    // bac-src-2 : 2000 - 1744 = 256
    expect(vivantsVide.get("bac-src-2")).toBe(256);
    expect(vivantsAbsent.get("bac-src-2")).toBe(256);
  });
});
