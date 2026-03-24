/**
 * Tests unitaires — format.ts avec paramètre locale (Sprint 39, Story 39.4)
 *
 * Couvre :
 * - formatXAF avec locale "fr" (défaut) et "en"
 * - formatXAFOrFree : "Gratuit" (fr) et "Free" (en) pour 0
 * - formatDate avec locale parameter
 * - Compatibilité ascendante : les fonctions fonctionnent sans paramètre locale
 */
import { describe, it, expect } from "vitest";
import { formatXAF, formatXAFOrFree, formatDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// formatXAF — locale fr (défaut)
// ---------------------------------------------------------------------------

describe("formatXAF — locale fr (défaut)", () => {
  it("formate 1000 avec séparateur de milliers français", () => {
    const result = formatXAF(1000).replace(/\s/g, " ");
    expect(result).toContain("1 000");
    expect(result).toContain("FCFA");
  });

  it("formate 10000 en français", () => {
    const result = formatXAF(10000).replace(/\s/g, " ");
    expect(result).toContain("10 000");
    expect(result).toContain("FCFA");
  });

  it("formatXAF(0) retourne '0,00 FCFA' en fr", () => {
    const result = formatXAF(0).replace(/\s/g, " ");
    expect(result).toBe("0,00 FCFA");
  });

  it("formatXAF sans paramètre locale utilise fr par défaut", () => {
    const withDefault = formatXAF(5000);
    const withFr = formatXAF(5000, "fr");
    expect(withDefault).toBe(withFr);
  });
});

// ---------------------------------------------------------------------------
// formatXAF — locale en
// ---------------------------------------------------------------------------

describe("formatXAF — locale en", () => {
  it("formate 1000 avec séparateur virgule en anglais", () => {
    const result = formatXAF(1000, "en");
    expect(result).toContain("1,000.00");
    expect(result).toContain("FCFA");
  });

  it("formate 10000 avec séparateur virgule en anglais", () => {
    const result = formatXAF(10000, "en");
    expect(result).toContain("10,000.00");
    expect(result).toContain("FCFA");
  });

  it("formatXAF(0, 'en') retourne '0.00 FCFA'", () => {
    const result = formatXAF(0, "en");
    expect(result).toBe("0.00 FCFA");
  });

  it("le séparateur fr et en sont différents pour 1000", () => {
    const fr = formatXAF(1000, "fr");
    const en = formatXAF(1000, "en");
    // fr uses non-breaking space or space, en uses comma
    expect(fr).not.toBe(en);
  });
});

// ---------------------------------------------------------------------------
// formatXAFOrFree — locale fr (défaut)
// ---------------------------------------------------------------------------

describe("formatXAFOrFree — locale fr (défaut)", () => {
  it("retourne 'Gratuit' pour 0 en fr", () => {
    expect(formatXAFOrFree(0)).toBe("Gratuit");
  });

  it("retourne 'Gratuit' pour 0 avec locale fr explicite", () => {
    expect(formatXAFOrFree(0, "fr")).toBe("Gratuit");
  });

  it("délègue à formatXAF pour les montants non nuls", () => {
    const result = formatXAFOrFree(5000, "fr");
    expect(result).toBe(formatXAF(5000, "fr"));
  });

  it("formatXAFOrFree sans locale utilise fr par défaut", () => {
    expect(formatXAFOrFree(0)).toBe("Gratuit");
    const result = formatXAFOrFree(3000);
    expect(result).toContain("FCFA");
  });
});

// ---------------------------------------------------------------------------
// formatXAFOrFree — locale en
// ---------------------------------------------------------------------------

describe("formatXAFOrFree — locale en", () => {
  it("retourne 'Free' pour 0 en en", () => {
    expect(formatXAFOrFree(0, "en")).toBe("Free");
  });

  it("ne retourne pas 'Gratuit' pour 0 en en", () => {
    expect(formatXAFOrFree(0, "en")).not.toBe("Gratuit");
  });

  it("délègue à formatXAF pour les montants non nuls en en", () => {
    const result = formatXAFOrFree(5000, "en");
    expect(result).toBe(formatXAF(5000, "en"));
  });

  it("formatXAFOrFree(0, 'fr') retourne Gratuit, formatXAFOrFree(0, 'en') retourne Free", () => {
    expect(formatXAFOrFree(0, "fr")).toBe("Gratuit");
    expect(formatXAFOrFree(0, "en")).toBe("Free");
  });
});

// ---------------------------------------------------------------------------
// formatDate — avec locale parameter
// ---------------------------------------------------------------------------

describe("formatDate — avec locale parameter", () => {
  const knownDate = new Date("2026-03-21");

  it("formate en fr-FR (dd/mm/yyyy)", () => {
    const result = formatDate(knownDate, "fr");
    // fr-FR: 21/03/2026
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain("21");
    expect(result).toContain("03");
    expect(result).toContain("2026");
  });

  it("formate en en-US (m/dd/yyyy ou mm/dd/yyyy)", () => {
    const result = formatDate(knownDate, "en");
    // en-US: 3/21/2026
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(result).toContain("21");
    expect(result).toContain("2026");
  });

  it("le résultat fr et en sont différents pour la même date", () => {
    const fr = formatDate(knownDate, "fr");
    const en = formatDate(knownDate, "en");
    // En fr-FR: 21/03/2026, en en-US: 3/21/2026 — ordre différent
    expect(fr).not.toBe(en);
  });

  it("formatDate sans locale utilise fr par défaut", () => {
    const withDefault = formatDate(knownDate);
    const withFr = formatDate(knownDate, "fr");
    expect(withDefault).toBe(withFr);
  });

  it("accepte une string ISO en entrée avec locale", () => {
    const result = formatDate("2026-01-15", "en");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("accepte une string ISO en entrée en fr", () => {
    const result = formatDate("2026-01-15", "fr");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

// ---------------------------------------------------------------------------
// Compatibilité ascendante — les fonctions fonctionnent sans locale
// ---------------------------------------------------------------------------

describe("Compatibilité ascendante (backward compat)", () => {
  it("formatXAF fonctionne sans paramètre locale", () => {
    expect(() => formatXAF(1000)).not.toThrow();
    expect(formatXAF(1000)).toContain("FCFA");
  });

  it("formatXAFOrFree fonctionne sans paramètre locale", () => {
    expect(() => formatXAFOrFree(0)).not.toThrow();
    expect(formatXAFOrFree(0)).toBe("Gratuit");
  });

  it("formatDate fonctionne sans paramètre locale", () => {
    expect(() => formatDate(new Date())).not.toThrow();
    expect(formatDate("2026-03-21")).toContain("2026");
  });

  it("les valeurs par défaut restent en français", () => {
    expect(formatXAFOrFree(0)).toBe("Gratuit");
    const formatted = formatXAF(1000).replace(/\s/g, " ");
    // Format fr-FR uses space separator (not comma)
    expect(formatted).not.toContain(",000");
  });
});
