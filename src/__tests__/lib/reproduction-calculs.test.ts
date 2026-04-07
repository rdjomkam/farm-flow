/**
 * Tests unitaires — Calculs biologiques du module Reproduction (R3-S14)
 *
 * Fichier source : src/lib/reproduction/calculs.ts
 *
 * Couvre :
 *   - getLatenceTheoriqueH  : interpolation + clamping
 *   - estimerNombreOeufs    : facteur 750 oeufs/g
 *   - getDureeIncubationH   : interpolation + clamping
 */

import { describe, it, expect } from "vitest";
import {
  getLatenceTheoriqueH,
  estimerNombreOeufs,
  getDureeIncubationH,
} from "@/lib/reproduction/calculs";

// ---------------------------------------------------------------------------
// getLatenceTheoriqueH
// Table : 20°C→24h, 22°C→20h, 25°C→14h, 27°C→12h, 30°C→10h
// ---------------------------------------------------------------------------

describe("getLatenceTheoriqueH", () => {
  // --- Points exacts de la table ---

  it("retourne 24h pour 20°C (premier point de la table)", () => {
    expect(getLatenceTheoriqueH(20)).toBe(24);
  });

  it("retourne 20h pour 22°C", () => {
    expect(getLatenceTheoriqueH(22)).toBe(20);
  });

  it("retourne 14h pour 25°C", () => {
    expect(getLatenceTheoriqueH(25)).toBe(14);
  });

  it("retourne 12h pour 27°C", () => {
    expect(getLatenceTheoriqueH(27)).toBe(12);
  });

  it("retourne 10h pour 30°C (dernier point de la table)", () => {
    expect(getLatenceTheoriqueH(30)).toBe(10);
  });

  // --- Clamping en dehors des bornes ---

  it("retourne 24h pour 15°C (en dessous du minimum 20°C)", () => {
    expect(getLatenceTheoriqueH(15)).toBe(24);
  });

  it("retourne 24h pour 0°C (bien en dessous)", () => {
    expect(getLatenceTheoriqueH(0)).toBe(24);
  });

  it("retourne 24h pour 19.9°C (juste en dessous du minimum)", () => {
    expect(getLatenceTheoriqueH(19.9)).toBe(24);
  });

  it("retourne 10h pour 35°C (au dessus du maximum 30°C)", () => {
    expect(getLatenceTheoriqueH(35)).toBe(10);
  });

  it("retourne 10h pour 40°C (bien au dessus du maximum)", () => {
    expect(getLatenceTheoriqueH(40)).toBe(10);
  });

  it("retourne 10h pour 30.1°C (juste au dessus du maximum)", () => {
    expect(getLatenceTheoriqueH(30.1)).toBe(10);
  });

  // --- Interpolation entre les points ---

  // Entre 20°C (24h) et 22°C (20h) :
  // ratio = (21 - 20) / (22 - 20) = 0.5
  // heures = 24 + 0.5 * (20 - 24) = 24 - 2 = 22h
  it("interpole correctement entre 20°C et 22°C (21°C → 22h)", () => {
    expect(getLatenceTheoriqueH(21)).toBe(22);
  });

  // Entre 22°C (20h) et 25°C (14h) :
  // ratio = (23 - 22) / (25 - 22) = 1/3
  // heures = 20 + (1/3) * (14 - 20) = 20 - 2 = 18h
  it("interpole correctement entre 22°C et 25°C (23°C → 18h)", () => {
    expect(getLatenceTheoriqueH(23)).toBe(18);
  });

  // Entre 22°C (20h) et 25°C (14h) :
  // ratio = (24 - 22) / (25 - 22) = 2/3
  // heures = 20 + (2/3) * (14 - 20) = 20 - 4 = 16h
  it("interpole correctement entre 22°C et 25°C (24°C → 16h)", () => {
    expect(getLatenceTheoriqueH(24)).toBe(16);
  });

  // Entre 25°C (14h) et 27°C (12h) :
  // ratio = (26 - 25) / (27 - 25) = 0.5
  // heures = 14 + 0.5 * (12 - 14) = 14 - 1 = 13h
  it("interpole correctement entre 25°C et 27°C (26°C → 13h)", () => {
    expect(getLatenceTheoriqueH(26)).toBe(13);
  });

  // Entre 27°C (12h) et 30°C (10h) :
  // ratio = (28 - 27) / (30 - 27) = 1/3
  // heures = 12 + (1/3) * (10 - 12) = 12 - 0.667 = 11.333 → arrondi à 11h
  it("interpole correctement entre 27°C et 30°C (28°C → 11h)", () => {
    expect(getLatenceTheoriqueH(28)).toBe(11);
  });

  // Entre 27°C (12h) et 30°C (10h) :
  // ratio = (29 - 27) / (30 - 27) = 2/3
  // heures = 12 + (2/3) * (10 - 12) = 12 - 1.333 = 10.667 → arrondi à 11h
  it("interpole correctement entre 27°C et 30°C (29°C → 11h)", () => {
    expect(getLatenceTheoriqueH(29)).toBe(11);
  });

  // --- Retourne toujours un entier ---

  it("retourne toujours un nombre entier", () => {
    const valeurs = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 15, 35];
    for (const temp of valeurs) {
      const result = getLatenceTheoriqueH(temp);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// estimerNombreOeufs
// Facteur : 750 oeufs/gramme
// ---------------------------------------------------------------------------

describe("estimerNombreOeufs", () => {
  // --- Valeurs normales ---

  it("estime correctement pour 100g (100 * 750 = 75 000 oeufs)", () => {
    expect(estimerNombreOeufs(100)).toBe(75000);
  });

  it("estime correctement pour 50g (50 * 750 = 37 500 oeufs)", () => {
    expect(estimerNombreOeufs(50)).toBe(37500);
  });

  it("estime correctement pour 200g (200 * 750 = 150 000 oeufs)", () => {
    expect(estimerNombreOeufs(200)).toBe(150000);
  });

  it("estime correctement pour 10g (10 * 750 = 7 500 oeufs)", () => {
    expect(estimerNombreOeufs(10)).toBe(7500);
  });

  // --- Cas limite : 0g ---

  it("retourne 0 pour 0g (pas d'oeufs)", () => {
    expect(estimerNombreOeufs(0)).toBe(0);
  });

  // --- Valeurs decimales ---

  it("estime correctement pour 1.5g (1.5 * 750 = 1 125 oeufs)", () => {
    expect(estimerNombreOeufs(1.5)).toBe(1125);
  });

  it("estime correctement pour 0.5g (0.5 * 750 = 375 oeufs)", () => {
    expect(estimerNombreOeufs(0.5)).toBe(375);
  });

  // Verifie l'arrondi : 1.3 * 750 = 975 (entier exact, pas d'arrondi necessaire)
  it("estime correctement pour 1.3g (1.3 * 750 = 975 oeufs)", () => {
    expect(estimerNombreOeufs(1.3)).toBe(975);
  });

  // Arrondi necessaire : 1.001 * 750 = 750.75 → arrondi à 751
  it("arrondit le resultat a l'entier le plus proche", () => {
    const result = estimerNombreOeufs(1.001);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(751);
  });

  // --- Grande valeur ---

  it("gere des grandes quantites (500g → 375 000 oeufs)", () => {
    expect(estimerNombreOeufs(500)).toBe(375000);
  });
});

// ---------------------------------------------------------------------------
// getDureeIncubationH
// Table : 20°C→40h, 22°C→36h, 25°C→30h, 27°C→25h, 30°C→22h
// ---------------------------------------------------------------------------

describe("getDureeIncubationH", () => {
  // --- Points exacts de la table ---

  it("retourne 40h pour 20°C (premier point)", () => {
    expect(getDureeIncubationH(20)).toBe(40);
  });

  it("retourne 36h pour 22°C", () => {
    expect(getDureeIncubationH(22)).toBe(36);
  });

  it("retourne 30h pour 25°C", () => {
    expect(getDureeIncubationH(25)).toBe(30);
  });

  it("retourne 25h pour 27°C", () => {
    expect(getDureeIncubationH(27)).toBe(25);
  });

  it("retourne 22h pour 30°C (dernier point)", () => {
    expect(getDureeIncubationH(30)).toBe(22);
  });

  // --- Clamping en dehors des bornes ---

  it("retourne 40h pour 15°C (en dessous du minimum)", () => {
    expect(getDureeIncubationH(15)).toBe(40);
  });

  it("retourne 40h pour 0°C", () => {
    expect(getDureeIncubationH(0)).toBe(40);
  });

  it("retourne 40h pour 19.9°C (juste en dessous du minimum)", () => {
    expect(getDureeIncubationH(19.9)).toBe(40);
  });

  it("retourne 22h pour 35°C (au dessus du maximum)", () => {
    expect(getDureeIncubationH(35)).toBe(22);
  });

  it("retourne 22h pour 50°C (bien au dessus)", () => {
    expect(getDureeIncubationH(50)).toBe(22);
  });

  it("retourne 22h pour 30.1°C (juste au dessus du maximum)", () => {
    expect(getDureeIncubationH(30.1)).toBe(22);
  });

  // --- Interpolation entre les points ---

  // Entre 20°C (40h) et 22°C (36h) :
  // ratio = (21 - 20) / (22 - 20) = 0.5
  // heures = 40 + 0.5 * (36 - 40) = 40 - 2 = 38h
  it("interpole correctement entre 20°C et 22°C (21°C → 38h)", () => {
    expect(getDureeIncubationH(21)).toBe(38);
  });

  // Entre 22°C (36h) et 25°C (30h) :
  // ratio = (23 - 22) / (25 - 22) = 1/3
  // heures = 36 + (1/3) * (30 - 36) = 36 - 2 = 34h
  it("interpole correctement entre 22°C et 25°C (23°C → 34h)", () => {
    expect(getDureeIncubationH(23)).toBe(34);
  });

  // Entre 22°C (36h) et 25°C (30h) :
  // ratio = (24 - 22) / (25 - 22) = 2/3
  // heures = 36 + (2/3) * (30 - 36) = 36 - 4 = 32h
  it("interpole correctement entre 22°C et 25°C (24°C → 32h)", () => {
    expect(getDureeIncubationH(24)).toBe(32);
  });

  // Entre 25°C (30h) et 27°C (25h) :
  // ratio = (26 - 25) / (27 - 25) = 0.5
  // heures = 30 + 0.5 * (25 - 30) = 30 - 2.5 = 27.5 → arrondi à 28h
  it("interpole correctement entre 25°C et 27°C (26°C → 28h)", () => {
    expect(getDureeIncubationH(26)).toBe(28);
  });

  // Entre 27°C (25h) et 30°C (22h) :
  // ratio = (28 - 27) / (30 - 27) = 1/3
  // heures = 25 + (1/3) * (22 - 25) = 25 - 1 = 24h
  it("interpole correctement entre 27°C et 30°C (28°C → 24h)", () => {
    expect(getDureeIncubationH(28)).toBe(24);
  });

  // Entre 27°C (25h) et 30°C (22h) :
  // ratio = (29 - 27) / (30 - 27) = 2/3
  // heures = 25 + (2/3) * (22 - 25) = 25 - 2 = 23h
  it("interpole correctement entre 27°C et 30°C (29°C → 23h)", () => {
    expect(getDureeIncubationH(29)).toBe(23);
  });

  // --- Retourne toujours un entier ---

  it("retourne toujours un nombre entier", () => {
    const valeurs = [15, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 35];
    for (const temp of valeurs) {
      const result = getDureeIncubationH(temp);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  // --- Coherence avec la table de latence : incubation > latence a meme temperature ---

  it("duree d'incubation est toujours superieure a la latence theorique pour la meme temperature", () => {
    // Biologiquement : l'incubation (40h max) dure plus longtemps que la latence (24h max)
    const temperatures = [20, 22, 25, 27, 30];
    for (const temp of temperatures) {
      const latence = getLatenceTheoriqueH(temp);
      const incubation = getDureeIncubationH(temp);
      expect(incubation).toBeGreaterThan(latence);
    }
  });
});
