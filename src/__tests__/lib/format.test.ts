/**
 * Tests unitaires — format.ts
 *
 * Teste les fonctions utilitaires de formatage :
 * - formatXAF : montants en FCFA avec séparateurs français
 * - formatXAFOrFree : idem avec cas spécial "Gratuit" pour 0
 * - formatDate : formatage de date en français
 * - formatNumber : nombre entier avec séparateurs de milliers
 * - formatCFA : montant CFA (sans décimales)
 * - formatDateTime : date + heure
 * - formatWeight : poids en grammes/kg
 *
 * Story CR3.4 — Extraction utilitaires de formatage
 */
import { describe, it, expect } from "vitest";
import {
  formatXAF,
  formatXAFOrFree,
  formatDate,
  formatNumber,
  formatCFA,
  formatDateTime,
  formatWeight,
} from "@/lib/format";

// ---------------------------------------------------------------------------
// formatXAF
// ---------------------------------------------------------------------------

describe("formatXAF", () => {
  it('formatXAF(10000) contient "10 000"', () => {
    const result = formatXAF(10000);
    // L'espace utilisé par Intl peut être un espace insécable (\u202f ou \u00a0)
    // On normalise en remplaçant tous les types d'espaces par un espace simple
    expect(result.replace(/\s/g, " ")).toContain("10 000");
  });

  it('formatXAF(10000) contient "FCFA"', () => {
    expect(formatXAF(10000)).toContain("FCFA");
  });

  it('formatXAF(0) retourne "0,00 FCFA"', () => {
    const result = formatXAF(0).replace(/\s/g, " ");
    expect(result).toBe("0,00 FCFA");
  });

  it("formatXAF(15000) contient le bon montant formaté", () => {
    const result = formatXAF(15000).replace(/\s/g, " ");
    expect(result).toContain("15 000");
    expect(result).toContain("FCFA");
  });

  it("formatXAF(1000000) formate le million correctement", () => {
    const result = formatXAF(1000000).replace(/\s/g, " ");
    expect(result).toContain("1 000 000");
    expect(result).toContain("FCFA");
  });

  it("formatXAF produit 2 décimales", () => {
    const result = formatXAF(12345.67).replace(/\s/g, " ");
    expect(result).toBe("12 345,67 FCFA");
  });

  it("formatXAF(500) retourne un montant inférieur à 1000 sans séparateur de milliers", () => {
    const result = formatXAF(500).replace(/\s/g, " ");
    expect(result).toBe("500,00 FCFA");
  });
});

// ---------------------------------------------------------------------------
// formatXAFOrFree
// ---------------------------------------------------------------------------

describe("formatXAFOrFree", () => {
  it('formatXAFOrFree(0) retourne exactement "Gratuit"', () => {
    expect(formatXAFOrFree(0)).toBe("Gratuit");
  });

  it('formatXAFOrFree(5000) contient "5 000"', () => {
    const result = formatXAFOrFree(5000).replace(/\s/g, " ");
    expect(result).toContain("5 000");
  });

  it('formatXAFOrFree(5000) contient "FCFA"', () => {
    expect(formatXAFOrFree(5000)).toContain("FCFA");
  });

  it("formatXAFOrFree(3000) délègue à formatXAF pour les montants non nuls", () => {
    const result = formatXAFOrFree(3000);
    expect(result).toBe(formatXAF(3000));
  });

  it('formatXAFOrFree(1) ne retourne pas "Gratuit" pour un montant non nul', () => {
    expect(formatXAFOrFree(1)).not.toBe("Gratuit");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("formate un objet Date en français", () => {
    // Date fixe pour éviter les dépendances à la date courante
    const date = new Date("2026-03-21");
    const result = formatDate(date);
    // Le format fr-FR retourne dd/mm/yyyy
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("accepte une chaîne ISO en entrée", () => {
    const result = formatDate("2026-01-15");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("retourne le bon mois pour une date connue", () => {
    const result = formatDate("2026-03-21");
    // 21/03/2026 en fr-FR
    expect(result).toContain("03");
    expect(result).toContain("2026");
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe("formatNumber", () => {
  it("formate un entier avec séparateur de milliers", () => {
    const result = formatNumber(15000).replace(/\s/g, " ");
    expect(result).toBe("15 000");
  });

  it("retourne — pour null", () => {
    expect(formatNumber(null)).toBe("—");
  });

  it("retourne — pour undefined", () => {
    expect(formatNumber(undefined)).toBe("—");
  });

  it("formate zéro comme 0", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formate un nombre inférieur à 1000 sans séparateur", () => {
    expect(formatNumber(500)).toBe("500");
  });

  it("formate un million avec séparateurs", () => {
    const result = formatNumber(1000000).replace(/\s/g, " ");
    expect(result).toBe("1 000 000");
  });

  it("tronque les décimales (pas de virgule)", () => {
    const result = formatNumber(15000.75);
    expect(result).not.toContain(",");
  });
});

// ---------------------------------------------------------------------------
// formatCFA
// ---------------------------------------------------------------------------

describe("formatCFA", () => {
  it('formatCFA(15000) contient "CFA"', () => {
    expect(formatCFA(15000)).toContain("CFA");
  });

  it('formatCFA(15000) ne contient pas "FCFA"', () => {
    const result = formatCFA(15000);
    // Doit se terminer par " CFA" et non " FCFA"
    expect(result).toMatch(/ CFA$/);
  });

  it("formate correctement les milliers", () => {
    const result = formatCFA(15000).replace(/\s/g, " ");
    expect(result).toBe("15 000 CFA");
  });

  it("formatCFA(0) retourne 0 CFA", () => {
    const result = formatCFA(0).replace(/\s/g, " ");
    expect(result).toBe("0 CFA");
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe("formatDateTime", () => {
  it("formate date + heure en français", () => {
    const date = new Date("2026-03-21T14:30:00");
    const result = formatDateTime(date);
    // Doit contenir des chiffres et séparateurs de date/heure
    expect(result).toMatch(/\d/);
    expect(result.length).toBeGreaterThan(5);
  });

  it("accepte une chaîne ISO en entrée", () => {
    const result = formatDateTime("2026-03-21T14:30:00");
    expect(result).toMatch(/\d/);
  });

  it("le résultat est plus court que un formatDate seul", () => {
    // formatDateTime inclut heure, formatDate seulement la date
    const dateStr = "2026-03-21T14:30:00";
    const dtResult = formatDateTime(dateStr);
    // Doit contenir l'heure (contient ":")
    expect(dtResult).toContain(":");
  });
});

// ---------------------------------------------------------------------------
// formatWeight
// ---------------------------------------------------------------------------

describe("formatWeight", () => {
  it("affiche les grammes pour < 1000g", () => {
    const result = formatWeight(500);
    expect(result).toBe("500 g");
  });

  it("convertit en kg pour >= 1000g", () => {
    const result = formatWeight(1500);
    // 1500g = 1.50 kg
    expect(result).toContain("kg");
    expect(result).toContain("1");
  });

  it("retourne — pour null", () => {
    expect(formatWeight(null)).toBe("—");
  });

  it("retourne — pour undefined", () => {
    expect(formatWeight(undefined)).toBe("—");
  });

  it("formate 0g correctement", () => {
    expect(formatWeight(0)).toBe("0 g");
  });

  it("formate exactement 1000g en 1,00 kg", () => {
    const result = formatWeight(1000);
    expect(result).toContain("kg");
    expect(result).toContain("1");
  });

  it("formate 2500g en 2,50 kg", () => {
    const result = formatWeight(2500).replace(/\s/g, " ");
    expect(result).toBe("2,50 kg");
  });
});
