/**
 * Tests unitaires — format.ts (Sprint 37, Story 37.2)
 *
 * Teste les fonctions utilitaires de formatage :
 * - formatXAF : montants en FCFA avec séparateurs français
 * - formatXAFOrFree : idem avec cas spécial "Gratuit" pour 0
 * - formatDate : formatage de date en français
 */
import { describe, it, expect } from "vitest";
import { formatXAF, formatXAFOrFree, formatDate } from "@/lib/format";

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

  it('formatXAF(0) retourne "0 FCFA"', () => {
    const result = formatXAF(0).replace(/\s/g, " ");
    expect(result).toBe("0 FCFA");
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

  it("formatXAF ne produit pas de décimales", () => {
    const result = formatXAF(12345.67);
    expect(result).not.toContain(",");
    expect(result).not.toContain(".");
  });

  it("formatXAF(500) retourne un montant inférieur à 1000 sans séparateur de milliers", () => {
    const result = formatXAF(500).replace(/\s/g, " ");
    expect(result).toBe("500 FCFA");
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
