/**
 * Tests — format-previsions.ts (Sprint PR2, story PR2.3, ADR-053 §7.4)
 *
 * Couverture des règles §7.4 :
 * 1. formatMontantPrevision — 0 décimale, séparateur de milliers, zéro => "–"
 * 2. formatEntierPrevision — idem sur les entiers (sacs, alevins, poissons)
 * 3. formatPourcentagePrevision — 1 décimale, zéro reste "0,0 %" (pas "–")
 * 4. formatTonnagePrevision — 1 décimale, conversion kg -> t, zéro => "–"
 * 5. classeMontant — jamais de couleur en dur (R6), uniquement la classe
 *    thème `text-danger`
 * 6. Entrées limites : null, undefined, string (Decimal.toJSON()), NaN,
 *    négatif, très grand nombre
 */
import { describe, it, expect } from "vitest";
import {
  formatMontantPrevision,
  formatEntierPrevision,
  formatPourcentagePrevision,
  formatTonnagePrevision,
  classeMontant,
} from "@/lib/previsions/format-previsions";

// Intl.NumberFormat("fr-FR") utilise l'espace fine insécable U+202F comme
// séparateur de milliers (pas l'espace ASCII 0x20) — constante pour ne pas
// répéter le caractère invisible dans chaque assertion.
const NBSP = " ";

// ---------------------------------------------------------------------------
// formatMontantPrevision
// ---------------------------------------------------------------------------

describe("formatMontantPrevision", () => {
  it("formate un montant positif avec séparateur de milliers et sans décimale", () => {
    expect(formatMontantPrevision(15000)).toBe(`15 000 FCFA`);
  });

  it("formate un très grand montant avec séparateurs de milliers", () => {
    expect(formatMontantPrevision(123456789)).toBe(`123 456 789 FCFA`);
  });

  it("affiche zéro comme un tiret, pas '0 FCFA'", () => {
    expect(formatMontantPrevision(0)).toBe("–");
  });

  it("affiche null comme un tiret", () => {
    expect(formatMontantPrevision(null)).toBe("–");
  });

  it("affiche undefined comme un tiret", () => {
    expect(formatMontantPrevision(undefined)).toBe("–");
  });

  it("accepte une valeur négative et l'affiche avec un signe moins, sans décimale", () => {
    expect(formatMontantPrevision(-6334704)).toBe(`-6 334 704 FCFA`);
  });

  it("accepte une string numérique (Decimal.toJSON() serialisé)", () => {
    expect(formatMontantPrevision("15000")).toBe(`15 000 FCFA`);
  });

  it("accepte une string négative", () => {
    expect(formatMontantPrevision("-500")).toBe("-500 FCFA");
  });

  it("accepte une string décimale et l'arrondit à 0 décimale", () => {
    // Intl.NumberFormat arrondit (banker's/half-up selon l'implémentation V8 : half-away-from-zero)
    expect(formatMontantPrevision("15000.6")).toBe(`15 001 FCFA`);
  });

  it("n'affiche jamais de décimale même sur une valeur fractionnaire", () => {
    const result = formatMontantPrevision(1234.56);
    expect(result).not.toMatch(/[,.]\d/);
  });

  it("retourne un tiret si la string n'est pas numérique", () => {
    expect(formatMontantPrevision("abc")).toBe("–");
  });

  it("retourne un tiret pour une string vide", () => {
    expect(formatMontantPrevision("")).toBe("–");
  });

  it("omet le suffixe FCFA quand avecUnite=false (unite portee ailleurs, ex. en-tete de ligne)", () => {
    expect(formatMontantPrevision(15000, "fr", false)).toBe(`15${NBSP}000`);
  });

  it("omet le suffixe FCFA sur un montant negatif quand avecUnite=false", () => {
    expect(formatMontantPrevision(-6334704, "fr", false)).toBe(`-6${NBSP}334${NBSP}704`);
  });

  it("continue d'afficher un tiret pour zero meme avec avecUnite=false", () => {
    expect(formatMontantPrevision(0, "fr", false)).toBe("–");
  });
});

// ---------------------------------------------------------------------------
// formatEntierPrevision
// ---------------------------------------------------------------------------

describe("formatEntierPrevision", () => {
  it("formate un entier avec séparateur de milliers", () => {
    expect(formatEntierPrevision(15000)).toBe(`15 000`);
  });

  it("affiche zéro comme un tiret", () => {
    expect(formatEntierPrevision(0)).toBe("–");
  });

  it("affiche null comme un tiret", () => {
    expect(formatEntierPrevision(null)).toBe("–");
  });

  it("affiche undefined comme un tiret", () => {
    expect(formatEntierPrevision(undefined)).toBe("–");
  });

  it("arrondit une valeur fractionnaire à l'entier le plus proche", () => {
    expect(formatEntierPrevision(285.4)).toBe("285");
  });

  it("accepte une string numérique", () => {
    expect(formatEntierPrevision("3500")).toBe(`3 500`);
  });

  it("gère un très grand nombre (alevins)", () => {
    expect(formatEntierPrevision(1000000)).toBe(`1 000 000`);
  });

  it("gère un nombre négatif", () => {
    expect(formatEntierPrevision(-50)).toBe("-50");
  });
});

// ---------------------------------------------------------------------------
// formatPourcentagePrevision
// ---------------------------------------------------------------------------

describe("formatPourcentagePrevision", () => {
  it("formate un pourcentage à 1 décimale", () => {
    expect(formatPourcentagePrevision(33.333)).toBe("33,3 %");
  });

  it("zéro reste affiché '0,0 %', pas un tiret (taux significatif)", () => {
    expect(formatPourcentagePrevision(0)).toBe("0,0 %");
  });

  it("affiche null comme un tiret", () => {
    expect(formatPourcentagePrevision(null)).toBe("–");
  });

  it("affiche undefined comme un tiret", () => {
    expect(formatPourcentagePrevision(undefined)).toBe("–");
  });

  it("accepte une string numérique (Decimal serialisé)", () => {
    expect(formatPourcentagePrevision("12.5")).toBe("12,5 %");
  });

  it("accepte un pourcentage négatif", () => {
    expect(formatPourcentagePrevision(-4.2)).toBe("-4,2 %");
  });

  it("arrondit à 1 décimale même avec plus de précision en entrée", () => {
    expect(formatPourcentagePrevision(100.049)).toBe("100,0 %");
  });

  it("n'affiche jamais 2 décimales", () => {
    const result = formatPourcentagePrevision(66.666);
    const decimalPart = result.split(",")[1];
    expect(decimalPart.replace(/[^\d]/g, "").length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// formatTonnagePrevision
// ---------------------------------------------------------------------------

describe("formatTonnagePrevision", () => {
  it("convertit des kg en tonnes à 1 décimale", () => {
    expect(formatTonnagePrevision(17100)).toBe("17,1 t");
  });

  it("affiche zéro comme un tiret", () => {
    expect(formatTonnagePrevision(0)).toBe("–");
  });

  it("affiche null comme un tiret", () => {
    expect(formatTonnagePrevision(null)).toBe("–");
  });

  it("affiche undefined comme un tiret", () => {
    expect(formatTonnagePrevision(undefined)).toBe("–");
  });

  it("accepte une string numérique", () => {
    expect(formatTonnagePrevision("5000")).toBe("5,0 t");
  });

  it("gère une très grosse biomasse", () => {
    expect(formatTonnagePrevision(1000000)).toBe(`1 000,0 t`);
  });

  it("gère un tonnage négatif (théorique, ex. ajustement)", () => {
    expect(formatTonnagePrevision(-2500)).toBe("-2,5 t");
  });
});

// ---------------------------------------------------------------------------
// classeMontant — R6, jamais de couleur en dur
// ---------------------------------------------------------------------------

describe("classeMontant", () => {
  it("retourne la classe thème 'text-danger' pour un montant négatif", () => {
    expect(classeMontant(-100)).toBe("text-danger");
  });

  it("ne retourne jamais une couleur en dur (hex/rgb)", () => {
    const result = classeMontant(-100);
    expect(result).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(result).not.toMatch(/rgb\(/);
  });

  it("retourne undefined pour un montant positif (pas de classe imposée)", () => {
    expect(classeMontant(100)).toBeUndefined();
  });

  it("retourne undefined pour zéro (zéro n'est pas négatif)", () => {
    expect(classeMontant(0)).toBeUndefined();
  });

  it("retourne undefined pour null/undefined (rien à colorer)", () => {
    expect(classeMontant(null)).toBeUndefined();
    expect(classeMontant(undefined)).toBeUndefined();
  });

  it("fonctionne avec une string négative sérialisée", () => {
    expect(classeMontant("-500")).toBe("text-danger");
  });
});
