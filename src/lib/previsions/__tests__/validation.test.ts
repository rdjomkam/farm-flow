import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  validerSommeRepartitionMoisAliment,
  validerPaliersRemiseCroissants,
  validerCouvertureMoisRepartition,
} from "../validation";
import { ValidationError } from "@/lib/errors";

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
        { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
        { ordre: 2, seuilTonnes: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 3, seuilTonnes: new Decimal(100), pourcentageRemise: new Decimal(10) },
      ])
    ).not.toThrow();
  });

  it("seuils non croissants -> leve une exception (cas limite ADR-053 section 8)", () => {
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilTonnes: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 2, seuilTonnes: new Decimal(30), pourcentageRemise: new Decimal(10) },
      ])
    ).toThrow();
  });

  it("seuils egaux consecutifs -> leve (strictement croissant exige)", () => {
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilTonnes: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 2, seuilTonnes: new Decimal(50), pourcentageRemise: new Decimal(10) },
      ])
    ).toThrow();
  });

  it("l'evaluation se fait dans l'ordre du champ `ordre`, pas l'ordre du tableau fourni", () => {
    // fourni dans le desordre du tableau, mais `ordre` est bien croissant -> valide
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 2, seuilTonnes: new Decimal(50), pourcentageRemise: new Decimal(5) },
        { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      ])
    ).not.toThrow();
  });

  it("liste vide ou a un seul element -> ne leve pas", () => {
    expect(() => validerPaliersRemiseCroissants([])).not.toThrow();
    expect(() =>
      validerPaliersRemiseCroissants([
        { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      ])
    ).not.toThrow();
  });
});

/**
 * validerCouvertureMoisRepartition — ERR-162 (docs/knowledge/ERRORS-AND-FIXES.md).
 *
 * `validerSommeRepartitionMoisAliment` ci-dessus ne controle que la FORME
 * (somme = 100%) : un tableau de 2 lignes sur un cycle de 3 mois peut deja
 * sommer a 100% tout en omettant un mois (traite comme 0% par le moteur,
 * silencieusement). Cette fonction controle la COMPLETUDE, independamment de
 * la somme des pourcentages.
 */
describe("validerCouvertureMoisRepartition — ERR-162", () => {
  it("cas nominal : couvre exactement 1..dureeCycleMois -> ne leve pas", () => {
    expect(() =>
      validerCouvertureMoisRepartition(
        [{ moisCycle: 1 }, { moisCycle: 2 }, { moisCycle: 3 }],
        3
      )
    ).not.toThrow();
  });

  it("un pourcentage = 0 sur un mois PRESENT est valide (le mois est couvert, sa part est nulle) — ne pas confondre avec un mois absent", () => {
    // Reproduit exactement le jeu d'or EXCEL-V12 (plan de reference,
    // LECTURE SEULE) : G1 80/20/0, G2 20/80/0, G3 0/40/60, chacune sur 3
    // mois — le mois a 0% est present, donc couvert, donc valide.
    expect(() =>
      validerCouvertureMoisRepartition(
        [
          { moisCycle: 1, pourcentage: new Decimal(80) },
          { moisCycle: 2, pourcentage: new Decimal(20) },
          { moisCycle: 3, pourcentage: new Decimal(0) },
        ],
        3
      )
    ).not.toThrow();
    expect(() =>
      validerCouvertureMoisRepartition(
        [
          { moisCycle: 1, pourcentage: new Decimal(20) },
          { moisCycle: 2, pourcentage: new Decimal(80) },
          { moisCycle: 3, pourcentage: new Decimal(0) },
        ],
        3
      )
    ).not.toThrow();
    expect(() =>
      validerCouvertureMoisRepartition(
        [
          { moisCycle: 1, pourcentage: new Decimal(0) },
          { moisCycle: 2, pourcentage: new Decimal(40) },
          { moisCycle: 3, pourcentage: new Decimal(60) },
        ],
        3
      )
    ).not.toThrow();
  });

  it("mois manquant (2 lignes sur un cycle de 3) -> leve une ValidationError (422) nommant le mois manquant", () => {
    expect(() => validerCouvertureMoisRepartition([{ moisCycle: 1 }, { moisCycle: 2 }], 3)).toThrow(
      ValidationError
    );
    try {
      validerCouvertureMoisRepartition([{ moisCycle: 1 }, { moisCycle: 2 }], 3);
      throw new Error("devrait avoir leve");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toContain("3");
      expect((e as ValidationError).message).toMatch(/manquant/);
    }
  });

  it("plusieurs mois manquants -> le message les nomme tous", () => {
    try {
      validerCouvertureMoisRepartition([{ moisCycle: 2 }], 4);
      throw new Error("devrait avoir leve");
    } catch (e) {
      expect((e as ValidationError).message).toContain("1, 3, 4");
    }
  });

  it("mois en double (moisCycle=1 present deux fois) -> leve, meme si la couverture 1..3 est par ailleurs complete", () => {
    try {
      validerCouvertureMoisRepartition(
        [{ moisCycle: 1 }, { moisCycle: 1 }, { moisCycle: 2 }, { moisCycle: 3 }],
        3
      );
      throw new Error("devrait avoir leve");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toMatch(/double/);
      expect((e as ValidationError).message).toContain("1");
    }
  });

  it("mois hors bornes (0, negatif, > dureeCycleMois) -> leve distinctement, nomme les mois fautifs", () => {
    try {
      validerCouvertureMoisRepartition(
        [{ moisCycle: 0 }, { moisCycle: 1 }, { moisCycle: 2 }, { moisCycle: 3 }, { moisCycle: -1 }, { moisCycle: 5 }],
        3
      );
      throw new Error("devrait avoir leve");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toMatch(/hors du cycle/);
      expect((e as ValidationError).message).toContain("-1");
      expect((e as ValidationError).message).toContain("0");
      expect((e as ValidationError).message).toContain("5");
    }
  });

  it("liste vide -> leve, nomme TOUS les mois du cycle comme manquants (equivalent a 'aucune couverture')", () => {
    try {
      validerCouvertureMoisRepartition([], 3);
      throw new Error("devrait avoir leve");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toContain("1, 2, 3");
    }
  });

  it("cycle a 1 mois (dureeCycleMois=1), un seul element -> ne leve pas (cas limite)", () => {
    expect(() => validerCouvertureMoisRepartition([{ moisCycle: 1 }], 1)).not.toThrow();
  });
});
