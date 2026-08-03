import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { calculerBudgetTotalPlan } from "../budget";

describe("calculerBudgetTotalPlan", () => {
  it("agrege couts de production, charges hors production et apports separement", () => {
    const result = calculerBudgetTotalPlan({
      coutsProductionVagues: [new Decimal(1000000), new Decimal(1500000)],
      chargesHorsProduction: [new Decimal(200000)],
      apports: [new Decimal(5000000)],
    });

    expect(result.totalCoutsProductionFCFA.equals(2500000)).toBe(true);
    expect(result.totalChargesHorsProductionFCFA.equals(200000)).toBe(true);
    expect(result.totalApportsFCFA.equals(5000000)).toBe(true);
    // budgetTotalFCFA n'inclut jamais les apports (un apport finance le budget, il n'en fait pas partie)
    expect(result.budgetTotalFCFA.equals(2700000)).toBe(true);
  });

  it("listes vides -> tous les totaux a 0", () => {
    const result = calculerBudgetTotalPlan({
      coutsProductionVagues: [],
      chargesHorsProduction: [],
      apports: [],
    });
    expect(result.budgetTotalFCFA.equals(0)).toBe(true);
  });
});
