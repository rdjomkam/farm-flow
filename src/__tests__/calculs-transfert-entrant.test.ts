/**
 * Tests CS.2 / GV.1-GV.2 — computeVivantsByBac symétrique entrants/sortants
 *
 * Vérifie que :
 * 1. TRANSFERT sortant soustrait quand bacId === bacSourceId du TransfertGroupe
 * 2. TRANSFERT entrant ajoute quand bacId === bacDestId du TransfertGroupe (post-comptage)
 * 3. TRANSFERT entrant pré-comptage : ignoré (inclus dans AssignationBac.nombreInitial)
 * 4. TRANSFERT entrant post-comptage : incrémente arrivagesPostComptageParBac
 * 5. Sans transfertGroupesById : comportement identique à avant (non-régression, fallback sortant)
 * 6. GV.3 — un bac source d'un TransfertGroupe ET destination d'un autre TransfertGroupe
 *    dans la même vague : discrimination correcte PAR RELEVÉ (pas par bac) — BUG-049.
 */

import { describe, it, expect } from "vitest";
import { computeVivantsByBac } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Fixtures communes
// ---------------------------------------------------------------------------

const BAC_SOURCE = "bac-source";
const BAC_DEST = "bac-dest";
const TG_1 = "tg-1";
const TG_2 = "tg-2";

// Date helpers
const d = (dateStr: string) => new Date(dateStr);

// ---------------------------------------------------------------------------
// 1. TRANSFERT source soustrait quand bacId === bacSourceId du groupe
// ---------------------------------------------------------------------------

describe("CS.2/GV.1-GV.2 — TRANSFERT sortant soustrait sans entrée dans la Map", () => {
  it("soustrait le TRANSFERT si bacId N'EST PAS bacDestId du groupe (bacId = bacSourceId)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 200,
        date: d("2026-03-01"),
        transfertGroupeId: TG_1,
      },
    ];

    // Le groupe TG_1 a bacSourceId=BAC_SOURCE, bacDestId=BAC_DEST → sortant → soustraction
    const result = computeVivantsByBac(bacs, releves, 1000, {
      transfertGroupesById: new Map([[TG_1, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }]]),
    });

    expect(result.get(BAC_SOURCE)).toBe(800); // 1000 - 200
  });

  it("soustrait le TRANSFERT si transfertGroupesById est absent (non-régression)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-01"),
        transfertGroupeId: null,
      },
    ];

    // Aucune Map fournie → comportement historique : soustraction
    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(700); // 1000 - 300
  });
});

// ---------------------------------------------------------------------------
// 2. TRANSFERT entrant ajoute quand bacId === bacDestId du groupe (post-comptage)
// ---------------------------------------------------------------------------

describe("CS.2/GV.1-GV.2 — TRANSFERT entrant ajoute quand bacId = bacDestId (post-comptage)", () => {
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
        transfertGroupeId: null,
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-02"),
        transfertGroupeId: TG_1,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 500, {
      transfertGroupesById: new Map([[TG_1, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }]]),
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
        transfertGroupeId: null,
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-02"),
        transfertGroupeId: TG_1,
      },
      {
        bacId: BAC_DEST,
        typeReleve: "MORTALITE",
        nombreMorts: 50,
        nombreCompte: null,
        nombreTransferes: null,
        date: d("2026-03-03"),
        transfertGroupeId: null,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 500, {
      transfertGroupesById: new Map([[TG_1, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }]]),
    });

    expect(result.get(BAC_DEST)).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// 3. TRANSFERT entrant pré-comptage : ignoré
// ---------------------------------------------------------------------------

describe("CS.2/GV.1-GV.2 — TRANSFERT entrant pré-comptage ignoré", () => {
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
        transfertGroupeId: TG_1,
      },
      {
        bacId: BAC_DEST,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 750,
        nombreTransferes: null,
        date: d("2026-03-02"),
        transfertGroupeId: null,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 800, {
      transfertGroupesById: new Map([[TG_1, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }]]),
    });

    // Le TRANSFERT est avant le COMPTAGE → ignoré (pré-comptage)
    // Vivants = dernierComptage (750) - mortalités post-comptage (0) = 750
    expect(result.get(BAC_DEST)).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// 4. Post-comptage entrant : arrivagesPostComptageParBac incrémenté
// ---------------------------------------------------------------------------

describe("CS.2/GV.1-GV.2 — arrivagesPostComptageParBac incrémenté", () => {
  it("deux TRANSFERT entrants post-comptage s'accumulent", () => {
    const bacs = [{ id: BAC_DEST, nombreInitial: 0 }];

    // COMPTAGE 400 (01/03)
    // TRANSFERT entrant 100 (02/03) — groupe TG_1
    // TRANSFERT entrant 150 (03/03) — groupe TG_2
    // Vivants : 400 + 100 + 150 = 650
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 400,
        nombreTransferes: null,
        date: d("2026-03-01"),
        transfertGroupeId: null,
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 100,
        date: d("2026-03-02"),
        transfertGroupeId: TG_1,
      },
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 150,
        date: d("2026-03-03"),
        transfertGroupeId: TG_2,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 0, {
      transfertGroupesById: new Map([
        [TG_1, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }],
        [TG_2, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }],
      ]),
    });

    expect(result.get(BAC_DEST)).toBe(650);
  });
});

// ---------------------------------------------------------------------------
// 5. Sans transfertGroupesById : comportement identique à avant (non-régression)
// ---------------------------------------------------------------------------

describe("CS.2/GV.1-GV.2 — Non-régression sans transfertGroupesById", () => {
  it("Sans Map : MORTALITE et VENTE déduites normalement (non-régression)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "MORTALITE",
        nombreMorts: 50,
        nombreCompte: null,
        nombreTransferes: null,
        date: d("2026-03-01"),
        transfertGroupeId: null,
      },
      {
        bacId: BAC_SOURCE,
        typeReleve: "VENTE",
        nombreMorts: null,
        nombreCompte: null,
        nombreVendus: 100,
        nombreTransferes: null,
        date: d("2026-03-02"),
        transfertGroupeId: null,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(850); // 1000 - 50 - 100
  });

  it("Sans Map : TRANSFERT soustrait (comportement pré-CS.2)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 400,
        date: d("2026-03-01"),
        transfertGroupeId: null,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(600); // 1000 - 400
  });

  it("Sans Map : COMPTAGE + mortalités post-comptage (non-régression PRE_GROSSISSEMENT)", () => {
    const bacs = [{ id: BAC_SOURCE, nombreInitial: 1000 }];
    const releves = [
      {
        bacId: BAC_SOURCE,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 900,
        nombreTransferes: null,
        date: d("2026-03-05"),
        transfertGroupeId: null,
      },
      {
        bacId: BAC_SOURCE,
        typeReleve: "MORTALITE",
        nombreMorts: 30,
        nombreCompte: null,
        nombreTransferes: null,
        date: d("2026-03-10"),
        transfertGroupeId: null,
      },
    ];

    const result = computeVivantsByBac(bacs, releves, 1000);

    expect(result.get(BAC_SOURCE)).toBe(870); // 900 (comptage) - 30 (mortalité post-comptage)
  });

  it("Vague GROSSISSEMENT réelle : bac dest sans Map → TRANSFERT soustrait → risque négatif évité par Math.max(0)", () => {
    // Ce test documente le comportement incorrect SANS la Map.
    // Avec 500 vivants initiaux et un TRANSFERT entrant de 300, sans la Map,
    // le résultat serait 500 - 300 = 200 (incorrect mais non-négatif par Math.max).
    // Avec la Map : 500 + 300 = 800 (correct).
    const bacs = [{ id: BAC_DEST, nombreInitial: 500 }];
    const releves = [
      {
        bacId: BAC_DEST,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-01"),
        transfertGroupeId: TG_1,
      },
    ];

    // Sans Map : soustraction (comportement avant CS.2)
    const resultSansMap = computeVivantsByBac(bacs, releves, 500);
    expect(resultSansMap.get(BAC_DEST)).toBe(200); // 500 - 300 (incorrect)

    // Avec Map : addition (comportement après CS.2 / GV.1-GV.2)
    const resultAvecMap = computeVivantsByBac(bacs, releves, 500, {
      transfertGroupesById: new Map([[TG_1, { bacSourceId: BAC_SOURCE, bacDestId: BAC_DEST }]]),
    });
    expect(resultAvecMap.get(BAC_DEST)).toBe(500); // 500 + 0 arrivage pré-comptage (inclus dans nombreInitial)
  });
});

// ---------------------------------------------------------------------------
// 6. GV.3 — Régression BUG-049 : un bac source d'un TransfertGroupe ET
//    destination d'un autre TransfertGroupe dans la même vague.
//    La discrimination DOIT se faire PAR RELEVÉ (via transfertGroupeId),
//    pas par bac : sinon un des deux relevés reçoit un signe faux.
// ---------------------------------------------------------------------------

describe("GV.3 — discrimination PAR RELEVÉ (bac source d'un TG ET destination d'un autre TG)", () => {
  it("le relevé sortant est soustrait et le relevé entrant est ajouté sur le MÊME bac", () => {
    const BAC_PIVOT = "bac-pivot";
    const BAC_AMONT = "bac-amont";
    const BAC_AVAL = "bac-aval";
    const TG_ENTRANT = "tg-entrant"; // bacSourceId=BAC_AMONT, bacDestId=BAC_PIVOT
    const TG_SORTANT = "tg-sortant"; // bacSourceId=BAC_PIVOT, bacDestId=BAC_AVAL

    const bacs = [{ id: BAC_PIVOT, nombreInitial: 200 }];

    // COMPTAGE 200 (01/03)
    // TRANSFERT entrant 300 (02/03) — BAC_PIVOT est bacDestId de TG_ENTRANT
    // TRANSFERT sortant 100 (03/03) — BAC_PIVOT est bacSourceId de TG_SORTANT
    // Vivants attendus : 200 + 300 - 100 = 400
    const releves = [
      {
        bacId: BAC_PIVOT,
        typeReleve: "COMPTAGE",
        nombreMorts: null,
        nombreCompte: 200,
        nombreTransferes: null,
        date: d("2026-03-01"),
        transfertGroupeId: null,
      },
      {
        bacId: BAC_PIVOT,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 300,
        date: d("2026-03-02"),
        transfertGroupeId: TG_ENTRANT,
      },
      {
        bacId: BAC_PIVOT,
        typeReleve: "TRANSFERT",
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 100,
        date: d("2026-03-03"),
        transfertGroupeId: TG_SORTANT,
      },
    ];

    const transfertGroupesById = new Map([
      [TG_ENTRANT, { bacSourceId: BAC_AMONT, bacDestId: BAC_PIVOT }],
      [TG_SORTANT, { bacSourceId: BAC_PIVOT, bacDestId: BAC_AVAL }],
    ]);

    const result = computeVivantsByBac(bacs, releves, 200, { transfertGroupesById });

    expect(result.get(BAC_PIVOT)).toBe(400); // 200 + 300 - 100

    // Non-régression : si on discriminait PAR BAC (ancien anti-pattern BUG-049),
    // BAC_PIVOT ne serait présent ni dans un "Set de bacDest" unique ni permettrait
    // de distinguer les deux relevés — l'un des deux aurait le signe faux
    // (ex: les deux traités comme sortants → 200 - 300 - 100 = -200 → Math.max(0) = 0,
    // ou les deux traités comme entrants → 200 + 300 + 100 = 600). Le résultat 400
    // prouve que la discrimination est bien faite par relevé.
    expect(result.get(BAC_PIVOT)).not.toBe(0);
    expect(result.get(BAC_PIVOT)).not.toBe(600);
  });
});
