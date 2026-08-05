/**
 * src/lib/previsions-presentation/__tests__/gradient-tresorerie.test.ts
 *
 * Tests — `calculerOffsetGradientSousZero` (Sprint PR3-ter, story B.5),
 * extraction PURE de la formule deja verifiee par
 * `tresorerie-chart.test.tsx` (Sprint PR2, story PR2.4). Ce fichier
 * n'introduit AUCUNE fixture nouvelle qui contredirait celle deja
 * existante — memes cas, extraits pour couvrir la fonction isolement
 * (utilisee par `tresorerie-chart.tsx` ET `tresorerie-trois-series-chart.tsx`,
 * ADR-053 §15.6 discipline etendue par analogie : jamais une
 * reimplementation locale de la formule dans un fichier de test).
 *
 * Falsification chiffree (ERR-172/ERR-168) : chaque test ci-dessous est
 * accompagne, dans le corps du fichier `gradient-tresorerie.ts`, d'une
 * formule unique — la preuve par mutation est documentee dans le rapport
 * de livraison de la story (mutation du signe de comparaison `<=`/`>=`,
 * ou de l'operateur `-` en `+` au denominateur, fait tomber au moins un
 * test ci-dessous, verifie manuellement puis restaure).
 */
import { describe, it, expect } from "vitest";
import { calculerOffsetGradientSousZero } from "@/lib/previsions-presentation/gradient-tresorerie";

describe("calculerOffsetGradientSousZero", () => {
  it("serie entierement positive (minSolde >= 0) -> offset = 1", () => {
    expect(calculerOffsetGradientSousZero(500_000, 100_000)).toBe(1);
  });

  it("serie entierement negative (maxSolde <= 0) -> offset = 0", () => {
    expect(calculerOffsetGradientSousZero(-100_000, -500_000)).toBe(0);
  });

  it("serie plate a zero -> offset = 0, jamais NaN (division par zero evitee)", () => {
    const offset = calculerOffsetGradientSousZero(0, 0);
    expect(offset).toBe(0);
    expect(Number.isNaN(offset)).toBe(false);
  });

  it("serie mixte -> formule exacte maxSolde / (maxSolde - minSolde)", () => {
    // Falsifie un inversement max/min : si la formule etait
    // `minSolde / (maxSolde - minSolde)`, ce test attendrait 0.3333...
    // au lieu de 0.6666... — la valeur exacte distingue les deux.
    expect(calculerOffsetGradientSousZero(2_000_000, -1_000_000)).toBeCloseTo(2_000_000 / 3_000_000, 10);
  });

  it("serie mixte symetrique -> offset = 0.5 (falsifie une formule qui ignorerait minSolde)", () => {
    // Si la formule ignorait `minSolde` (ex. `maxSolde / maxSolde` = 1
    // toujours), ce cas symetrique (max=100, min=-100) devrait quand meme
    // distinguer 0.5 de 1 — preuve que `minSolde` participe reellement au
    // calcul.
    expect(calculerOffsetGradientSousZero(100, -100)).toBe(0.5);
  });

  it("toujours fini, jamais NaN ni Infinity, sur un large echantillon de paires", () => {
    const paires: [number, number][] = [
      [0, -1],
      [1, 0],
      [1_000_000, -1_000_000],
      [0.0001, -0.0001],
      [1e9, -1e9],
      [1, -1e-12],
    ];
    for (const [max, min] of paires) {
      const offset = calculerOffsetGradientSousZero(max, min);
      expect(Number.isFinite(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1);
    }
  });
});
