import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { genererPlanEmpoissonnement } from "../plan";

describe("genererPlanEmpoissonnement", () => {
  const parametres = {
    dateDebutPlan: new Date(Date.UTC(2026, 7, 1)), // 2026-08-01
    effectifAlevinsParVague: 15000,
    poidsMoyenInitialG: new Decimal(5),
  };

  it("frequence 1 mois, horizon 3 mois -> 4 vagues (mois 0, 1, 2, 3)", () => {
    const plan = genererPlanEmpoissonnement(parametres, 3, new Decimal(1), 3);
    expect(plan).toHaveLength(4);
    expect(plan.map((v) => v.index)).toEqual([1, 2, 3, 4]);
    expect(plan[0].dateStockagePrevue.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(plan[1].dateStockagePrevue.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(plan[3].dateStockagePrevue.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("chaque VaguePrevue generee fige dureeCycleMois au moment de la generation", () => {
    const plan = genererPlanEmpoissonnement(parametres, 4, new Decimal(1), 1);
    expect(plan.every((v) => v.dureeCycleMoisFigee === 4)).toBe(true);
  });

  it("copie effectifAlevinsPrevu et poidsMoyenInitialG depuis les parametres pour chaque vague", () => {
    const plan = genererPlanEmpoissonnement(parametres, 3, new Decimal(1), 0);
    expect(plan).toHaveLength(1);
    expect(plan[0].effectifAlevinsPrevu).toBe(15000);
    expect(plan[0].poidsMoyenInitialG.equals(new Decimal(5))).toBe(true);
  });

  it("frequenceStockageMois fractionnaire (0.5 mois) espace les vagues de ~15 jours", () => {
    const plan = genererPlanEmpoissonnement(parametres, 3, new Decimal(0.5), 1);
    // index 1 = offset 0, index 2 = offset 0.5 mois (~15/16 jours selon le mois), index 3 = offset 1
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan[0].dateStockagePrevue.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(plan[2].dateStockagePrevue.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("frequenceStockageMois <= 0 -> liste vide (garde-fou)", () => {
    expect(genererPlanEmpoissonnement(parametres, 3, new Decimal(0), 12)).toEqual([]);
    expect(genererPlanEmpoissonnement(parametres, 3, new Decimal(-1), 12)).toEqual([]);
  });

  it("horizonMois = 0 -> une seule vague (mois de depart) ; horizonMois < 0 -> liste vide", () => {
    expect(genererPlanEmpoissonnement(parametres, 3, new Decimal(1), 0)).toHaveLength(1);
    expect(genererPlanEmpoissonnement(parametres, 3, new Decimal(1), -1)).toEqual([]);
  });
});
