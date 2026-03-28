/**
 * Tests FD.7 — getSaison (Sprint FD)
 *
 * Fonction testee : getSaison(date, pays?) dans src/lib/calculs.ts
 *
 * Regles Cameroun (defaut) :
 *   - Saison seche  : novembre (10), decembre (11), janvier (0), fevrier (1)
 *   - Saison pluies : mars (2) a octobre (9)
 */

import { describe, it, expect } from "vitest";
import { getSaison } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit une Date avec uniquement le mois fourni (annee fixe 2026). */
function dateForMonth(month: number): Date {
  return new Date(2026, month, 15);
}

// ---------------------------------------------------------------------------
// Tests par mois — saison seche
// ---------------------------------------------------------------------------

describe("getSaison — saison seche (Cameroun par defaut)", () => {
  it("janvier (mois 0) → SECHE", () => {
    expect(getSaison(dateForMonth(0))).toBe("SECHE");
  });

  it("fevrier (mois 1) → SECHE", () => {
    expect(getSaison(dateForMonth(1))).toBe("SECHE");
  });

  it("novembre (mois 10) → SECHE", () => {
    expect(getSaison(dateForMonth(10))).toBe("SECHE");
  });

  it("decembre (mois 11) → SECHE", () => {
    expect(getSaison(dateForMonth(11))).toBe("SECHE");
  });
});

// ---------------------------------------------------------------------------
// Tests par mois — saison des pluies
// ---------------------------------------------------------------------------

describe("getSaison — saison des pluies (Cameroun par defaut)", () => {
  it("mars (mois 2) → PLUIES", () => {
    expect(getSaison(dateForMonth(2))).toBe("PLUIES");
  });

  it("avril (mois 3) → PLUIES", () => {
    expect(getSaison(dateForMonth(3))).toBe("PLUIES");
  });

  it("mai (mois 4) → PLUIES", () => {
    expect(getSaison(dateForMonth(4))).toBe("PLUIES");
  });

  it("juin (mois 5) → PLUIES", () => {
    expect(getSaison(dateForMonth(5))).toBe("PLUIES");
  });

  it("juillet (mois 6) → PLUIES", () => {
    expect(getSaison(dateForMonth(6))).toBe("PLUIES");
  });

  it("aout (mois 7) → PLUIES", () => {
    expect(getSaison(dateForMonth(7))).toBe("PLUIES");
  });

  it("septembre (mois 8) → PLUIES", () => {
    expect(getSaison(dateForMonth(8))).toBe("PLUIES");
  });

  it("octobre (mois 9) → PLUIES", () => {
    expect(getSaison(dateForMonth(9))).toBe("PLUIES");
  });
});

// ---------------------------------------------------------------------------
// Tests avec pays explicite "CM"
// ---------------------------------------------------------------------------

describe("getSaison — avec pays CM (meme resultat que defaut)", () => {
  it('janvier + pays "CM" → SECHE', () => {
    expect(getSaison(dateForMonth(0), "CM")).toBe("SECHE");
  });

  it('fevrier + pays "CM" → SECHE', () => {
    expect(getSaison(dateForMonth(1), "CM")).toBe("SECHE");
  });

  it('mars + pays "CM" → PLUIES', () => {
    expect(getSaison(dateForMonth(2), "CM")).toBe("PLUIES");
  });

  it('octobre + pays "CM" → PLUIES', () => {
    expect(getSaison(dateForMonth(9), "CM")).toBe("PLUIES");
  });

  it('novembre + pays "CM" → SECHE', () => {
    expect(getSaison(dateForMonth(10), "CM")).toBe("SECHE");
  });

  it('decembre + pays "CM" → SECHE', () => {
    expect(getSaison(dateForMonth(11), "CM")).toBe("SECHE");
  });
});

// ---------------------------------------------------------------------------
// Tests avec pays undefined (equivalent au defaut)
// ---------------------------------------------------------------------------

describe("getSaison — avec pays undefined (meme resultat que CM)", () => {
  it("janvier + pays undefined → SECHE", () => {
    expect(getSaison(dateForMonth(0), undefined)).toBe("SECHE");
  });

  it("mars + pays undefined → PLUIES", () => {
    expect(getSaison(dateForMonth(2), undefined)).toBe("PLUIES");
  });

  it("octobre + pays undefined → PLUIES", () => {
    expect(getSaison(dateForMonth(9), undefined)).toBe("PLUIES");
  });

  it("novembre + pays undefined → SECHE", () => {
    expect(getSaison(dateForMonth(10), undefined)).toBe("SECHE");
  });
});

// ---------------------------------------------------------------------------
// Tests avec pays inconnu (fallback identique Cameroun)
// ---------------------------------------------------------------------------

describe("getSaison — avec pays inconnu (fallback Cameroun)", () => {
  it('janvier + pays "FR" (inconnu) → SECHE (fallback CM)', () => {
    expect(getSaison(dateForMonth(0), "FR")).toBe("SECHE");
  });

  it('mars + pays "US" (inconnu) → PLUIES (fallback CM)', () => {
    expect(getSaison(dateForMonth(2), "US")).toBe("PLUIES");
  });

  it('octobre + pays "NG" (inconnu) → PLUIES (fallback CM)', () => {
    expect(getSaison(dateForMonth(9), "NG")).toBe("PLUIES");
  });

  it('novembre + pays "GH" (inconnu) → SECHE (fallback CM)', () => {
    expect(getSaison(dateForMonth(10), "GH")).toBe("SECHE");
  });

  it('decembre + pays "XX" (inconnu) → SECHE (fallback CM)', () => {
    expect(getSaison(dateForMonth(11), "XX")).toBe("SECHE");
  });
});

// ---------------------------------------------------------------------------
// Verification de coherence — pays CM === undefined === inconnu
// ---------------------------------------------------------------------------

describe("getSaison — coherence : CM == undefined == pays inconnu", () => {
  const moisTests = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  moisTests.forEach((month) => {
    it(`mois ${month} : resultat identique pour CM, undefined et "ZZ"`, () => {
      const date = dateForMonth(month);
      const avecCM = getSaison(date, "CM");
      const sansPayS = getSaison(date, undefined);
      const inconnu = getSaison(date, "ZZ");
      expect(avecCM).toBe(sansPayS);
      expect(avecCM).toBe(inconnu);
    });
  });
});

// ---------------------------------------------------------------------------
// Verification que la valeur de retour est bien l'un des deux litteraux
// ---------------------------------------------------------------------------

describe("getSaison — valeurs de retour valides", () => {
  it("retourne toujours 'SECHE' ou 'PLUIES'", () => {
    for (let month = 0; month < 12; month++) {
      const result = getSaison(dateForMonth(month));
      expect(["SECHE", "PLUIES"]).toContain(result);
    }
  });

  it("exactement 4 mois seche et 8 mois pluies sur une annee complete", () => {
    let seche = 0;
    let pluies = 0;
    for (let month = 0; month < 12; month++) {
      const r = getSaison(dateForMonth(month));
      if (r === "SECHE") seche++;
      else pluies++;
    }
    expect(seche).toBe(4);
    expect(pluies).toBe(8);
  });
});
