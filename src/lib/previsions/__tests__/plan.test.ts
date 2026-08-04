import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { genererPlanEmpoissonnement, calculerAlevinsACommander } from "../plan";

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

/**
 * calculerAlevinsACommander — tests unitaires de non-regression ecrits
 * pendant la verification de la story PR2bis.3 (ERR-141/ERR-142).
 *
 * Ces tests completent la couverture recette (`__tests__/recette/`, qui
 * verifie les 19 vagues x 2 fixtures via `buildAlevinsACommanderParVague`)
 * en isolant explicitement le piege Decimal d'ERR-139
 * (`Math.ceil(25000 * 1.1)` renvoie `27501` en flottant JS binaire, alors
 * que le resultat exact est `27500`) et les cas limites d'unite (marge 0 %,
 * marge non entiere) qui ne sont pas necessairement couverts par les
 * fixtures du jeu d'or.
 */
describe("calculerAlevinsACommander", () => {
  it("piege Decimal ERR-139 : 25000 poissons, marge 10% -> 27500 exactement (pas 27501)", () => {
    // Math.ceil(25000 * 1.1) === 27501 en arithmetique flottante IEEE 754 —
    // ce test echoue si une seule etape du calcul retombe en `number` avant
    // le `.ceil()` final.
    expect(Math.ceil(25000 * 1.1)).toBe(27501); // documente le piege lui-meme
    expect(calculerAlevinsACommander(25000, new Decimal(10))).toBe(27500);
  });

  it("marge 0% -> retourne exactement poissonsAVendreNb, sans arrondi superflu", () => {
    expect(calculerAlevinsACommander(15000, new Decimal(0))).toBe(15000);
    expect(calculerAlevinsACommander(1, new Decimal(0))).toBe(1);
  });

  it("marge non entiere (schema Decimal(65,30) — le pourcentage n'est pas contraint a un entier)", () => {
    // 10000 * 1.075 = 10750 exactement -> pas d'arrondi necessaire
    expect(calculerAlevinsACommander(10000, new Decimal(7.5))).toBe(10750);
    // 10000 * 1.001 = 10010 exactement
    expect(calculerAlevinsACommander(10000, new Decimal(0.1))).toBe(10010);
    // Cas non exact : doit arrondir par exces (ceil), jamais tronquer.
    expect(calculerAlevinsACommander(3, new Decimal(10))).toBe(4); // 3.3 -> 4
  });

  it("unite : un seul site de conversion 0..100 -> fraction (pas de double division par 100)", () => {
    // Si la marge etait divisee par 100 deux fois, 10 deviendrait 0.001,
    // et 25000 * 1.001 = 25025 (arrondi) au lieu de 27500.
    const resultat = calculerAlevinsACommander(25000, new Decimal(10));
    expect(resultat).not.toBe(25025);
    expect(resultat).toBe(27500);
  });

  it("arrondi toujours par exces (ceil), jamais par defaut ni au plus proche", () => {
    // 1000 * 1.001 = 1001 exact ; 999 * 1.001 = 999.999 -> doit ceiler a 1000, pas tronquer a 999
    expect(calculerAlevinsACommander(999, new Decimal(0.1))).toBe(1000);
  });
});
