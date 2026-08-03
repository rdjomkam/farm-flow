import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { calculerCoutProductionVague, calculerRevenuPrevu } from "../vague";

describe("calculerCoutProductionVague", () => {
  it("somme cout aliment + cout alevins + quote-part charges", () => {
    const cout = calculerCoutProductionVague(
      new Decimal(500000),
      new Decimal(750000),
      new Decimal(200000)
    );
    expect(cout.equals(1450000)).toBe(true);
  });

  it("toutes valeurs nulles -> 0", () => {
    const cout = calculerCoutProductionVague(new Decimal(0), new Decimal(0), new Decimal(0));
    expect(cout.equals(0)).toBe(true);
  });
});

describe("calculerRevenuPrevu", () => {
  it("effectif x poidsObjectifG (converti en kg) x prix -> revenu", () => {
    // 5000 poissons, 800g chacun, 2500 FCFA/kg -> biomasse 4000 kg -> revenu 10 000 000
    const r = calculerRevenuPrevu(5000, new Decimal(800), new Decimal(2500));
    expect(r.biomasseKg.equals(4000)).toBe(true);
    expect(r.revenuFCFA.equals(10000000)).toBe(true);
    expect(r.alerte).toBe(false);
  });

  it("cas limite ADR-053 section 8 : poidsObjectifG = 0 -> revenu 0, biomasse 0, alerte true", () => {
    const r = calculerRevenuPrevu(5000, new Decimal(0), new Decimal(2500));
    expect(r.revenuFCFA.equals(0)).toBe(true);
    expect(r.biomasseKg.equals(0)).toBe(true);
    expect(r.alerte).toBe(true);
  });

  it("poidsObjectifG negatif (donnee corrompue) -> meme garde que 0, pas de NaN", () => {
    const r = calculerRevenuPrevu(5000, new Decimal(-10), new Decimal(2500));
    expect(r.alerte).toBe(true);
    expect(r.revenuFCFA.isFinite()).toBe(true);
  });

  it("effectifFinal = 0 -> revenu 0, sans alerte (poids positif)", () => {
    const r = calculerRevenuPrevu(0, new Decimal(800), new Decimal(2500));
    expect(r.revenuFCFA.equals(0)).toBe(true);
    expect(r.alerte).toBe(false);
  });
});
