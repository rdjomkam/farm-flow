import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  validerSommeRepartitionMoisAliment,
  validerPaliersRemiseCroissants,
  validerSommeApprovisionnementArticles,
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
 * validerSommeApprovisionnementArticles — ADR-053 §12.2, arbitrage 3
 * (amendement Sprint PR2-quater). AUCUNE couverture n'existait pour cette
 * fonction avant ce passage de test (verifie par grep sur le depot avant
 * ecriture) : la fonction n'etait exercee qu'indirectement, en integration,
 * via `createAlimentPrevisionAvecArticle`/`addAlimentArticlePrevision`
 * (src/lib/queries/__tests__/previsions-aliments.test.ts) — jamais en tant
 * que fonction pure isolee, contrairement a sa cousine
 * `validerSommeRepartitionMoisAliment` ci-dessus.
 */
describe("validerSommeApprovisionnementArticles — ADR-053 §12.2 arbitrage 3, amendement Sprint PR2-quater", () => {
  it("somme = 100 (cas nominal, un seul article a 100%) -> ne leve pas", () => {
    expect(() => validerSommeApprovisionnementArticles([new Decimal(100)])).not.toThrow();
  });

  it("somme = 100 sur plusieurs articles (60/40) -> ne leve pas", () => {
    expect(() =>
      validerSommeApprovisionnementArticles([new Decimal(60), new Decimal(40)])
    ).not.toThrow();
  });

  it("somme != 100 (90, un seul article) -> leve une exception (validation bloquante, ADR-053 §12.2 arbitrage 3)", () => {
    expect(() => validerSommeApprovisionnementArticles([new Decimal(90)])).toThrow(/100/);
  });

  it("somme > 100 (60/60) -> leve", () => {
    expect(() =>
      validerSommeApprovisionnementArticles([new Decimal(60), new Decimal(60)])
    ).toThrow(/100/);
  });

  it("liste vide -> somme 0 != 100 -> leve (un calibre sans aucun article n'est jamais valide)", () => {
    expect(() => validerSommeApprovisionnementArticles([])).toThrow();
  });

  it("somme legerement superieure a 100 (100.01, arrondi Decimal exact) -> leve, pas de tolerance implicite", () => {
    expect(() => validerSommeApprovisionnementArticles([new Decimal(100.01)])).toThrow();
  });

  it("trois articles dont la somme des Decimal fractionnaires vaut exactement 100 (33.33 + 33.33 + 33.34) -> ne leve pas (precision Decimal, pas de derive binaire)", () => {
    expect(() =>
      validerSommeApprovisionnementArticles([
        new Decimal(33.33),
        new Decimal(33.33),
        new Decimal(33.34),
      ])
    ).not.toThrow();
  });
});
