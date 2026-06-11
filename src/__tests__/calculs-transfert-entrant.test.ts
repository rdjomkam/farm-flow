/**
 * Tests CS.2 — computeVivantsByBac symétrique entrants/sortants
 *
 * Vérifie que :
 * 1. TRANSFERT sortant soustrait quand bacId absent du Set transfertDestBacIds
 * 2. TRANSFERT entrant ajoute quand bacId présent dans transfertDestBacIds (post-comptage)
 * 3. TRANSFERT entrant pré-comptage : ignoré (inclus dans AssignationBac.nombreInitial)
 * 4. TRANSFERT entrant post-comptage : incrémente arrivagesPostComptageParBac
 * 5. Sans transfertDestBacIds : comportement identique à avant (non-régression)
 */

import { describe, it, expect } from "vitest";
import { computeVivantsByBac } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Fixtures communes
// ---------------------------------------------------------------------------

const BAC_SOURCE = "bac-source";
const BAC_DEST = "bac-dest";

const bacSource = { id: BAC_SOURCE, nombreInitial: 1000 };
const bacDest = { id: BAC_DEST, nombreInitial: 500 };

// Date helpers
const d = (dateStr: string) => new Date(dateStr);

// ---------------------------------------------------------------------------
// 1. TRANSFERT source soustrait quand bacId absent du Set
// ---------------------------------------------------------------------------

describe("CS.2 — TRANSFERT sortant soustrait sans Set", () => {
  it("soustrait le TRANSFERT si bacId N'EST PAS dans transfertDestBacIds", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 200,
        date: d("2026-03-01"),
      },
    ];

    // transfertDestBacIds ne contient PAS bac-source → sortant → soustraction
    const result = computeVivantsByBac(bacs, releves, 1000, {
      transfertDestBacIds: new Set([BAC_DEST]),
    });

    expect(result.get(BAC_SOURCE)).toBe(800); // 1000 - 200
  });

  it("soustrait le TRANSFERT si transfertDestBacIds est absent (non-régression)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-01"),
      },
    ];

    // Aucun Set fourni → comportement historique : soustraction
    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(700); // 1000 - 300
  });
});

// ---------------------------------------------------------------------------
// 2. TRANSFERT entrant ajoute quand bacId présent dans Set (post-comptage)
// ---------------------------------------------------------------------------

describe("CS.2 — TRANSFERT entrant ajoute quand bacId dans Set (post-comptage)", () => {
  it("post-comptage : ajoute le TRANSFERT entrant au baseline comptage", () => {
    const bacs = [{ id: BAC_DEST, nombreInitial: 500 }];

    // Scénario :
    //   COMPTAGE à 500 en date 01/03
    //   TRANSFERT entrant de 300 en date 02/03 (post-comptage)
    //   Vivants attendus : 500 + 300 = 800
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 500,
        nombreTransferes: null,
        date: d("2026-03-01"),
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-02"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 500, {
      transfertDestBacIds: new Set([BAC_DEST]),
    });

    expect(result.get(BAC_DEST)).toBe(800); // 500 (comptage) + 300 (arrivage post-comptage)
  });

  it("post-comptage avec mortalités après transfert entrant", () => {
    const bacs = [{ id: BAC_DEST, nombreInitial: 500 }];

    // COMPTAGE 500 (01/03) → TRANSFERT entrant 300 (02/03) → MORTALITE 50 (03/03)
    // Vivants : 500 + 300 - 50 = 750
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 500,
        nombreTransferes: null,
        date: d("2026-03-01"),
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-02"),
      },
      {
        bacId: BAC_DEST,
        typeReleve: "MORTALITE",
        nombreMorts: 50,
        nombreCompte: null,
        nombreTransferes: null,
        date: d("2026-03-03"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 500, {
      transfertDestBacIds: new Set([BAC_DEST]),
    });

    expect(result.get(BAC_DEST)).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// 3. TRANSFERT entrant pré-comptage : ignoré
// ---------------------------------------------------------------------------

describe("CS.2 — TRANSFERT entrant pré-comptage ignoré", () => {
  it("pré-comptage : TRANSFERT entrant N'EST PAS ajouté (déjà dans AssignationBac.nombreInitial)", () => {
    const bacs = [{ id: BAC_DEST, nombreInitial: 800 }]; // 500 initial + 300 transférés → nombreInitial=800

    // TRANSFERT entrant 300 (01/03) → COMPTAGE 750 (02/03)
    // Post-comptage : rien → vivants = 750
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-01"),
      },
      {
        bacId: BAC_DEST,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 750,
        nombreTransferes: null,
        date: d("2026-03-02"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 800, {
      transfertDestBacIds: new Set([BAC_DEST]),
    });

    // Le TRANSFERT est avant le COMPTAGE → ignoré (pré-comptage)
    // Vivants = dernierComptage (750) - mortalités post-comptage (0) = 750
    expect(result.get(BAC_DEST)).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// 4. Post-comptage entrant : arrivagesPostComptageParBac incrémenté
// ---------------------------------------------------------------------------

describe("CS.2 — arrivagesPostComptageParBac incrémenté", () => {
  it("deux TRANSFERT entrants post-comptage s'accumulent", () => {
    const bacs = [{ id: BAC_DEST, nombreInitial: 0 }];

    // COMPTAGE 400 (01/03)
    // TRANSFERT entrant 100 (02/03)
    // TRANSFERT entrant 150 (03/03)
    // Vivants : 400 + 100 + 150 = 650
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 400,
        nombreTransferes: null,
        date: d("2026-03-01"),
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 100,
        date: d("2026-03-02"),
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 150,
        date: d("2026-03-03"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 0, {
      transfertDestBacIds: new Set([BAC_DEST]),
    });

    expect(result.get(BAC_DEST)).toBe(650);
  });
});

// ---------------------------------------------------------------------------
// 5. Sans transfertDestBacIds : comportement identique à avant (non-régression)
// ---------------------------------------------------------------------------

describe("CS.2 — Non-régression sans transfertDestBacIds", () => {
  it("Sans Set : MORTALITE et VENTE déduites normalement (non-régression)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "MORTALITE",
        nombreMorts: 50,
        nombreCompte: null,
        nombreTransferes: null,
        date: d("2026-03-01"),
      },
      {
        bacId: BAC_SOURCE,
        typeReleve: "VENTE",
        nombreMorts: null,
        nombreCompte: null,
        nombreVendus: 100,
        nombreTransferes: null,
        date: d("2026-03-02"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(850); // 1000 - 50 - 100
  });

  it("Sans Set : TRANSFERT soustrait (comportement pré-CS.2)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 400,
        date: d("2026-03-01"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(600); // 1000 - 400
  });

  it("Sans Set : COMPTAGE + mortalités post-comptage (non-régression PRE_GROSSISSEMENT)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 900,
        nombreTransferes: null,
        date: d("2026-03-05"),
      },
      {
        bacId: BAC_SOURCE,
        typeReleve: "MORTALITE",
        nombreMorts: 30,
        nombreCompte: null,
        nombreTransferes: null,
        date: d("2026-03-10"),
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(870); // 900 (comptage) - 30 (mortalité post-comptage)
  });

  it("Vague GROSSISSEMENT réelle : bac dest sans Set → TRANSFERT soustrait → risque négatif évité par Math.max(0)", () => {
    // Ce test documente le comportement incorrect SANS le Set.
    // Avec 500 vivants initiaux et un TRANSFERT entrant de 300, sans le Set,
    // le résultat serait 500 - 300 = 200 (incorrect mais non-négatif par Math.max).
    // Avec le Set : 500 + 300 = 800 (correct).
    const bacs = [{ id: BAC_DEST, nombreInitial: 500 }];
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-01"),
      },
    ];

    // Sans Set : soustraction (comportement avant CS.2)
    const resultSansSet = computeVivantsByBac(bacs, releves, 500);
    expect(resultSansSet.get(BAC_DEST)).toBe(200); // 500 - 300 (incorrect)

    // Avec Set : addition (comportement après CS.2)
    const resultAvecSet = computeVivantsByBac(bacs, releves, 500, {
      transfertDestBacIds: new Set([BAC_DEST]),
    });
    expect(resultAvecSet.get(BAC_DEST)).toBe(500); // 500 + 0 arrivage pré-comptage (inclus dans nombreInitial)
  });
});
