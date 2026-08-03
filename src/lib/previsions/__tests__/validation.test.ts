import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  validerSommeRepartitionMoisAliment,
  validerPaliersRemiseCroissants,
} from "../validation";

describe("validerSommeRepartitionMoisAliment", () => {
  it("somme = 100 -> ne leve pas", () => {
    expect(() =>
      validerSommeRepartitionMoisAliment([
        { moisCycle: 1, pourcentage: new Decimal(60) },
        { moisCycle: 2, pourcentage: new Decimal(40) },
      ])
    ).not.toThrow();
  });

  it("somme != 100 -> leve une exception (validation bloquante, ADR-053 section 3.5)", () => {
    expect(() =>
      validerSommeRepartitionMoisAliment([
        { moisCycle: 1, pourcentage: new Decimal(60) },
        { moisCycle: 2, pourcentage: new Decimal(30) },
      ])
    ).toThrow(/100/);
  });

  it("liste vide -> somme 0 != 100 -> leve", () => {
    expect(() => validerSommeRepartitionMoisAliment([])).toThrow();
  });

  it("somme legerement superieure a 100 (ex. 100.01) -> leve, pas de tolerance implicite", () => {
    expect(() =>
      validerSommeRepartitionMoisAliment([{ moisCycle: 1, pourcentage: new Decimal(100.01) }])
    ).toThrow();
  });
});

describe("validerPaliersRemiseCroissants", () => {
  it("seuils strictement croissants dans l'ordre -> ne leve pas", () => {
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
        { ordre: 2, seuilSacs: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 3, seuilSacs: new Decimal(100), pourcentageRemise: new Decimal(10) },
      ])
    ).not.toThrow();
  });

  it("seuils non croissants -> leve une exception (cas limite ADR-053 section 8)", () => {
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilSacs: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 2, seuilSacs: new Decimal(30), pourcentageRemise: new Decimal(10) },
      ])
    ).toThrow();
  });

  it("seuils egaux consecutifs -> leve (strictement croissant exige)", () => {
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilSacs: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 2, seuilSacs: new Decimal(50), pourcentageRemise: new Decimal(10) },
      ])
    ).toThrow();
  });

  it("l'evaluation se fait dans l'ordre du champ `ordre`, pas l'ordre du tableau fourni", () => {
    // fourni dans le desordre du tableau, mais `ordre` est bien croissant -> valide
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 2, seuilSacs: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
      ])
    ).not.toThrow();
  });

  it("liste vide ou a un seul element -> ne leve pas", () => {
    expect(() => validerPaliersRemiseCroissants([])).not.toThrow();
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
      ])
    ).not.toThrow();
  });
});
