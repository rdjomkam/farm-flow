import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  calculerTresorerieMensuelle,
  genererSerieTresorerie,
  calculerPointBasTresorerie,
} from "../tresorerie";

describe("calculerTresorerieMensuelle", () => {
  it("solde = precedent + revenus - depenses + apports", () => {
    const solde = calculerTresorerieMensuelle(
      new Decimal(500000),
      new Decimal(300000),
      new Decimal(100000),
      new Decimal(1000000)
    );
    expect(solde.equals(1300000)).toBe(true);
  });

  it("premier mois, solde precedent = 0", () => {
    const solde = calculerTresorerieMensuelle(
      new Decimal(500000),
      new Decimal(300000),
      new Decimal(0),
      new Decimal(0)
    );
    expect(solde.equals(200000)).toBe(true);
  });
});

describe("genererSerieTresorerie", () => {
  it("cumul simple sur plusieurs mois, solde initial 0", () => {
    const serie = genererSerieTresorerie([
      { moisAbsolu: 0, revenus: new Decimal(0), depenses: new Decimal(500000), apports: new Decimal(2000000) },
      { moisAbsolu: 1, revenus: new Decimal(300000), depenses: new Decimal(400000), apports: new Decimal(0) },
      { moisAbsolu: 2, revenus: new Decimal(1000000), depenses: new Decimal(200000), apports: new Decimal(0) },
    ]);

    expect(serie).toHaveLength(3);
    expect(serie[0].soldeFCFA.equals(1500000)).toBe(true);
    expect(serie[1].soldeFCFA.equals(1400000)).toBe(true);
    expect(serie[2].soldeFCFA.equals(2200000)).toBe(true);
  });

  it("serie vide -> resultat vide", () => {
    expect(genererSerieTresorerie([])).toEqual([]);
  });
});

describe("calculerPointBasTresorerie", () => {
  it("retourne le minimum et le mois ou il survient", () => {
    const serie = genererSerieTresorerie([
      { moisAbsolu: 0, revenus: new Decimal(0), depenses: new Decimal(1000000), apports: new Decimal(500000) },
      { moisAbsolu: 1, revenus: new Decimal(200000), depenses: new Decimal(300000), apports: new Decimal(0) },
      { moisAbsolu: 2, revenus: new Decimal(2000000), depenses: new Decimal(100000), apports: new Decimal(0) },
    ]);
    // soldes cumules : -500000, -600000, 1300000 -> point bas au mois 1
    const pointBas = calculerPointBasTresorerie(serie);
    expect(pointBas).not.toBeNull();
    expect(pointBas!.pointBasFCFA.equals(-600000)).toBe(true);
    expect(pointBas!.moisAbsolu).toBe(1);
  });

  it("nominal : point bas negatif (cas exercant reellement le besoin de financement, §7.2)", () => {
    const serie = genererSerieTresorerie([
      { moisAbsolu: 0, revenus: new Decimal(0), depenses: new Decimal(3000000), apports: new Decimal(0) },
    ]);
    const pointBas = calculerPointBasTresorerie(serie);
    expect(pointBas!.pointBasFCFA.lt(0)).toBe(true);
  });

  it("serie vide -> null", () => {
    expect(calculerPointBasTresorerie([])).toBeNull();
  });

  it("egalite entre plusieurs mois -> retient le premier", () => {
    const serie = [
      { moisAbsolu: 0, soldeFCFA: new Decimal(-100) },
      { moisAbsolu: 1, soldeFCFA: new Decimal(-100) },
    ];
    const pointBas = calculerPointBasTresorerie(serie);
    expect(pointBas!.moisAbsolu).toBe(0);
  });
});
