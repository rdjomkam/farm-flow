import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  calculerBesoinAlimentMensuel,
  appliquerPalierRemise,
  calculerCoutAlimentVague,
  apportionnerCoutAlimentMensuel,
  calculerCoutAlimentGranulometrieParMois,
} from "../aliments";
import type {
  AlimentPrevisionCalcInput,
  PalierRemiseInput,
  RepartitionMoisInput,
} from "../types";

describe("calculerBesoinAlimentMensuel", () => {
  it("PIEGE MAJEUR : le ceil s'applique par granulometrie separement, jamais sur un agregat", () => {
    // Preuve verifiee par la pre-analyse : ceil(600/15) = 40 sur un agregat,
    // alors que la somme des ceil individuels donne 41 = 26 + 15 + 0.
    const aliments: AlimentPrevisionCalcInput[] = [
      {
        id: "a1",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(388), // ceil(388/15) = 26
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
      {
        id: "a2",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(212), // ceil(212/15) = 15 (212/15 = 14.13)
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
      {
        id: "a3",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(0),
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
    ];

    const resultats = calculerBesoinAlimentMensuel(aliments, 1);
    expect(resultats.map((r) => r.sacs)).toEqual([26, 15, 0]);

    const totalSacs = resultats.reduce((s, r) => s + r.sacs, 0);
    expect(totalSacs).toBe(41);

    // Contre-preuve explicite : ceil de l'agregat des kg donnerait 40, pas 41.
    const totalKg = resultats.reduce((s, r) => s.plus(r.quantiteKg), new Decimal(0));
    expect(totalKg.dividedBy(15).ceil().toNumber()).toBe(40);
    expect(totalKg.dividedBy(15).ceil().toNumber()).not.toBe(totalSacs);
  });

  it("pourcentage absent pour ce mois -> traite comme 0%, sacs = 0", () => {
    const aliments: AlimentPrevisionCalcInput[] = [
      {
        id: "a1",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(600),
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
    ];
    const resultats = calculerBesoinAlimentMensuel(aliments, 2);
    expect(resultats[0].quantiteKg.equals(0)).toBe(true);
    expect(resultats[0].sacs).toBe(0);
  });

  it("cas limite : poidsSacKg = 0 -> sacs = 0, quantiteKg calculee normalement, pas de division par zero", () => {
    const aliments: AlimentPrevisionCalcInput[] = [
      {
        id: "a1",
        poidsSacKg: new Decimal(0),
        besoinTotalCycleKg: new Decimal(600),
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(50) }],
      },
    ];
    const resultats = calculerBesoinAlimentMensuel(aliments, 1);
    expect(resultats[0].quantiteKg.equals(300)).toBe(true);
    expect(resultats[0].sacs).toBe(0);
    expect(Number.isFinite(resultats[0].sacs)).toBe(true);
  });
});

describe("appliquerPalierRemise", () => {
  const paliers: PalierRemiseInput[] = [
    { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
    { ordre: 2, seuilSacs: new Decimal(50), pourcentageRemise: new Decimal(5) },
    { ordre: 3, seuilSacs: new Decimal(100), pourcentageRemise: new Decimal(10) },
  ];

  it("applique le dernier palier atteint, dans l'ordre explicite", () => {
    const r = appliquerPalierRemise(75, new Decimal(15000), paliers);
    expect(r.pourcentageRemiseApplique.equals(5)).toBe(true);
    // 75 * 15000 = 1 125 000 ; remise 5% -> 1 068 750
    expect(r.coutFCFA.equals(1068750)).toBe(true);
  });

  it("seuil exact -> palier applicable (>=)", () => {
    const r = appliquerPalierRemise(100, new Decimal(15000), paliers);
    expect(r.pourcentageRemiseApplique.equals(10)).toBe(true);
  });

  it("aucun palier applicable -> 0% de remise", () => {
    const r = appliquerPalierRemise(5, new Decimal(15000), [
      { ordre: 1, seuilSacs: new Decimal(10), pourcentageRemise: new Decimal(5) },
    ]);
    expect(r.pourcentageRemiseApplique.equals(0)).toBe(true);
    expect(r.coutFCFA.equals(75000)).toBe(true);
  });

  it("liste de paliers vide -> 0% de remise, cout = prix x sacs", () => {
    const r = appliquerPalierRemise(10, new Decimal(15000), []);
    expect(r.pourcentageRemiseApplique.equals(0)).toBe(true);
    expect(r.coutFCFA.equals(150000)).toBe(true);
  });

  it("l'ordre des paliers passe en parametre n'affecte pas le resultat (re-tri interne par `ordre`)", () => {
    const desordonnes = [...paliers].reverse();
    const r1 = appliquerPalierRemise(75, new Decimal(15000), paliers);
    const r2 = appliquerPalierRemise(75, new Decimal(15000), desordonnes);
    expect(r1.coutFCFA.equals(r2.coutFCFA)).toBe(true);
  });
});

describe("calculerCoutAlimentVague", () => {
  const paliers: PalierRemiseInput[] = [
    { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
    { ordre: 2, seuilSacs: new Decimal(40), pourcentageRemise: new Decimal(10) },
  ];

  it("utilise sacsCalcules quand sacsSaisis est null", () => {
    const total = calculerCoutAlimentVague([
      {
        alimentPrevisionId: "a1",
        sacsCalcules: 26,
        sacsSaisis: null,
        prixSacFCFA: new Decimal(15000),
        paliers,
      },
    ]);
    // 26 sacs, sous le seuil de 40 -> pas de remise -> 26 * 15000 = 390000
    expect(total.equals(390000)).toBe(true);
  });

  it("COALESCE(sacsSaisis, sacsCalcules) : sacsSaisis prime toujours quand renseigne", () => {
    const total = calculerCoutAlimentVague([
      {
        alimentPrevisionId: "a1",
        sacsCalcules: 26,
        sacsSaisis: 50, // surcharge manuelle, franchit le seuil de remise
        prixSacFCFA: new Decimal(15000),
        paliers,
      },
    ]);
    // 50 sacs >= seuil 40 -> remise 10% -> 50*15000*0.9 = 675000
    expect(total.equals(675000)).toBe(true);
  });

  it("agrege plusieurs granulometries", () => {
    const total = calculerCoutAlimentVague([
      { alimentPrevisionId: "a1", sacsCalcules: 26, sacsSaisis: null, prixSacFCFA: new Decimal(15000), paliers },
      { alimentPrevisionId: "a2", sacsCalcules: 15, sacsSaisis: null, prixSacFCFA: new Decimal(12000), paliers },
    ]);
    // a1 : 26*15000 = 390000 (pas de remise) ; a2 : 15*12000 = 180000 (pas de remise)
    expect(total.equals(570000)).toBe(true);
  });

  it("liste vide -> 0", () => {
    expect(calculerCoutAlimentVague([]).equals(0)).toBe(true);
  });
});

describe("apportionnerCoutAlimentMensuel", () => {
  it("ventile un cout de cycle deja remise au prorata des pourcentages mensuels", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(80) },
      { moisCycle: 2, pourcentage: new Decimal(20) },
    ];
    const resultats = apportionnerCoutAlimentMensuel(new Decimal(2030400), repartitions);

    expect(resultats.map((r) => r.moisCycle)).toEqual([1, 2]);
    expect(resultats[0].montantFCFA.equals(1624320)).toBe(true); // 2030400 * 0.8
    expect(resultats[1].montantFCFA.equals(406080)).toBe(true); // 2030400 * 0.2
  });

  it("la somme des montants mensuels reconstitue exactement le total du cycle quand les pourcentages somment a 100", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(33) },
      { moisCycle: 2, pourcentage: new Decimal(33) },
      { moisCycle: 3, pourcentage: new Decimal(34) },
    ];
    const total = new Decimal(999999);
    const resultats = apportionnerCoutAlimentMensuel(total, repartitions);
    const sommeReconstituee = resultats.reduce((s, r) => s.plus(r.montantFCFA), new Decimal(0));
    expect(sommeReconstituee.equals(total)).toBe(true);
  });

  it("cas limite : coutCycleTotalRemiseFCFA = 0 -> chaque mois recoit 0", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(100) },
    ];
    const resultats = apportionnerCoutAlimentMensuel(new Decimal(0), repartitions);
    expect(resultats[0].montantFCFA.equals(0)).toBe(true);
  });

  it("cas limite : repartitions vide -> tableau vide", () => {
    expect(apportionnerCoutAlimentMensuel(new Decimal(500000), [])).toEqual([]);
  });

  it("un moisCycle absent des repartitions n'apparait simplement pas dans le resultat", () => {
    const resultats = apportionnerCoutAlimentMensuel(new Decimal(100000), [
      { moisCycle: 2, pourcentage: new Decimal(100) },
    ]);
    expect(resultats.map((r) => r.moisCycle)).toEqual([2]);
  });
});

describe("calculerCoutAlimentGranulometrieParMois", () => {
  it("V7 verifie par la recette PR1.4 (rapport-story-PR1.4.md section 4.3) : remise decidee sur le total du CYCLE COMPLET (120 sacs), jamais recalculee sur le seul volume mensuel (96 sacs)", () => {
    const paliers: PalierRemiseInput[] = [
      { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilSacs: new Decimal(100), pourcentageRemise: new Decimal(6) },
    ];
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(80) },
      { moisCycle: 2, pourcentage: new Decimal(20) },
    ];

    const resultats = calculerCoutAlimentGranulometrieParMois({
      alimentPrevisionId: "2mm",
      sacsCalculesCycle: 120,
      sacsSaisisCycle: null,
      prixSacFCFA: new Decimal(18000),
      paliers,
      repartitions,
    });

    const mois1 = resultats.find((r) => r.moisCycle === 1)!;
    // (120 * 18000 * 0.94) * 0.8 = 2 030 400 * 0.8 = 1 624 320
    expect(mois1.montantFCFA.equals(1624320)).toBe(true);
    expect(mois1.alimentPrevisionId).toBe("2mm");

    // Contre-preuve : recalculer la remise sur le seul volume mensuel (96 sacs,
    // sous le seuil de 100) donnerait 0% de remise -> un montant errone.
    const remiseSiRecalculeeParMois = appliquerPalierRemise(96, new Decimal(18000), paliers);
    expect(remiseSiRecalculeeParMois.pourcentageRemiseApplique.equals(0)).toBe(true);
    expect(mois1.montantFCFA.equals(remiseSiRecalculeeParMois.coutFCFA)).toBe(false);
  });

  it("COALESCE(sacsSaisisCycle, sacsCalculesCycle) : la surcharge manuelle prime pour la decision de remise du cycle", () => {
    const paliers: PalierRemiseInput[] = [
      { ordre: 1, seuilSacs: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilSacs: new Decimal(40), pourcentageRemise: new Decimal(10) },
    ];
    const repartitions: RepartitionMoisInput[] = [{ moisCycle: 1, pourcentage: new Decimal(100) }];

    const resultats = calculerCoutAlimentGranulometrieParMois({
      alimentPrevisionId: "a1",
      sacsCalculesCycle: 26,
      sacsSaisisCycle: 50, // franchit le seuil de remise
      prixSacFCFA: new Decimal(15000),
      paliers,
      repartitions,
    });
    // 50 sacs >= 40 -> remise 10% -> 50*15000*0.9 = 675000, tout sur le seul mois (100%)
    expect(resultats[0].montantFCFA.equals(675000)).toBe(true);
  });

  it("cas limite : repartitions vide -> tableau vide", () => {
    const paliers: PalierRemiseInput[] = [];
    const resultats = calculerCoutAlimentGranulometrieParMois({
      alimentPrevisionId: "a1",
      sacsCalculesCycle: 10,
      sacsSaisisCycle: null,
      prixSacFCFA: new Decimal(15000),
      paliers,
      repartitions: [],
    });
    expect(resultats).toEqual([]);
  });
});
