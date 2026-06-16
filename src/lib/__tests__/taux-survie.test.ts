import { describe, it, expect } from "vitest";
import { calculerTauxSurvie } from "@/lib/calculs";

describe("calculerTauxSurvie", () => {
  it("1000 init − 50 morts → 95%", () => {
    expect(calculerTauxSurvie(1000, 50)).toBe(95);
  });

  it("1000 init − 0 mort (avec 500 transferts sortants ignorés) → 100%", () => {
    // Régression : avant le fix Sprint SV, ce cas retournait 50% car nombreVivants=500
    expect(calculerTauxSurvie(1000, 0)).toBe(100);
  });

  it("1000 init − 200 morts (avec 300 ventes ignorées) → 80%", () => {
    expect(calculerTauxSurvie(1000, 200)).toBe(80);
  });

  it("nombreInitial = 0 → null", () => {
    expect(calculerTauxSurvie(0, 5)).toBeNull();
  });

  it("nombreInitial = null → null", () => {
    expect(calculerTauxSurvie(null, 5)).toBeNull();
  });

  it("totalMortalites = null → null", () => {
    expect(calculerTauxSurvie(1000, null)).toBeNull();
  });

  it("totalMortalites > nombreInitial → 0% (pas négatif)", () => {
    expect(calculerTauxSurvie(100, 150)).toBe(0);
  });

  it("Régression Vague-26-03-Prep : 7000 − 565 ≈ 91.93%", () => {
    const result = calculerTauxSurvie(7000, 565);
    expect(result).toBeCloseTo(91.93, 1);
  });
});
