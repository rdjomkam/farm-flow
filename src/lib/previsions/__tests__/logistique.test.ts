import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  calculerVoyages,
  calculerCoutTransport,
  calculerLogistiqueMensuelle,
} from "../logistique";
import type { ParametresTransportInput } from "../logistique";

describe("calculerVoyages", () => {
  it("ceil(quantite/capacite) — voyage entame compte pour un voyage entier", () => {
    expect(calculerVoyages(new Decimal(61), new Decimal(60))).toBe(2);
    expect(calculerVoyages(new Decimal(60), new Decimal(60))).toBe(1);
    expect(calculerVoyages(new Decimal(1), new Decimal(60))).toBe(1);
  });

  it("reproduit les valeurs du jeu d'or (entreesModele.transport, story PR1.3-complement)", () => {
    // voyagesAliments : capacite 60 sacs/voyage, exemple mois 2 -> 6 voyages
    expect(calculerVoyages(new Decimal(321), new Decimal(60))).toBe(6); // ceil(321/60)=6
    // voyagesAlevins : capacite 20 000/voyage (et non 15 000, empiriquement errone)
    expect(calculerVoyages(new Decimal(20000), new Decimal(20000))).toBe(1);
    expect(calculerVoyages(new Decimal(20001), new Decimal(20000))).toBe(2);
    // voyagesPoissons : capacite 1 500 kg/voyage
    expect(calculerVoyages(new Decimal(4200), new Decimal(1500))).toBe(3); // ceil(2.8)=3
  });

  it("cas limite : capacite <= 0 -> 0 voyage, pas de division par zero ni de NaN/Infinity", () => {
    const r1 = calculerVoyages(new Decimal(100), new Decimal(0));
    expect(r1).toBe(0);
    expect(Number.isFinite(r1)).toBe(true);

    const r2 = calculerVoyages(new Decimal(100), new Decimal(-5));
    expect(r2).toBe(0);
    expect(Number.isFinite(r2)).toBe(true);
  });

  it("cas limite : quantite = 0 (ou negative) -> 0 voyage", () => {
    expect(calculerVoyages(new Decimal(0), new Decimal(60))).toBe(0);
    expect(calculerVoyages(new Decimal(-10), new Decimal(60))).toBe(0);
  });

  it("cas limite combine : quantite = 0 ET capacite = 0 -> 0 voyage (pas d'exception)", () => {
    expect(calculerVoyages(new Decimal(0), new Decimal(0))).toBe(0);
  });
});

describe("calculerCoutTransport", () => {
  it("voyages * coutUnitaireFCFA", () => {
    expect(calculerCoutTransport(3, new Decimal(15000)).equals(45000)).toBe(true);
  });

  it("0 voyage -> cout = 0", () => {
    expect(calculerCoutTransport(0, new Decimal(30000)).equals(0)).toBe(true);
  });
});

describe("calculerLogistiqueMensuelle", () => {
  const transportAliments: ParametresTransportInput = {
    capacite: new Decimal(60),
    coutUnitaireFCFA: new Decimal(15000),
  };
  const transportPoissons: ParametresTransportInput = {
    capacite: new Decimal(1500),
    coutUnitaireFCFA: new Decimal(25000),
  };
  const transportAlevins: ParametresTransportInput = {
    capacite: new Decimal(20000),
    coutUnitaireFCFA: new Decimal(30000),
  };

  it("reproduit un mois du jeu d'or (plan-v12-corrige, mois 0) : 1 voyage aliments, 0 poisson, 1 alevins, sousTotal 45000", () => {
    const r = calculerLogistiqueMensuelle({
      quantiteAlimentsSacs: new Decimal(1), // < 60 -> 1 voyage
      transportAliments,
      quantitePoissonsKg: new Decimal(0),
      transportPoissons,
      quantiteAlevinsNb: new Decimal(20000),
      transportAlevins,
    });

    expect(r.voyagesAliments).toBe(1);
    expect(r.coutAlimentsFCFA.equals(15000)).toBe(true);
    expect(r.voyagesPoissons).toBe(0);
    expect(r.coutPoissonsFCFA.equals(0)).toBe(true);
    expect(r.voyagesAlevins).toBe(1);
    expect(r.coutAlevinsFCFA.equals(30000)).toBe(true);
    expect(r.sousTotalFCFA.equals(45000)).toBe(true);
  });

  it("reproduit un mois du jeu d'or (plan-v12-corrige, mois 2) : 6 aliments, 3 poissons, 2 alevins, sousTotal 225000", () => {
    const r = calculerLogistiqueMensuelle({
      quantiteAlimentsSacs: new Decimal(321), // ceil(321/60) = 6
      transportAliments,
      quantitePoissonsKg: new Decimal(4200), // ceil(4200/1500) = 3
      transportPoissons,
      quantiteAlevinsNb: new Decimal(40000), // ceil(40000/20000) = 2
      transportAlevins,
    });

    expect(r.voyagesAliments).toBe(6);
    expect(r.voyagesPoissons).toBe(3);
    expect(r.voyagesAlevins).toBe(2);
    expect(r.coutAlevinsFCFA.equals(60000)).toBe(true);
    expect(r.sousTotalFCFA.equals(90000 + 75000 + 60000)).toBe(true);
    expect(r.sousTotalFCFA.equals(225000)).toBe(true);
  });

  it("cas limite : toutes quantites a 0 -> tout a 0, sousTotal = 0, pas d'erreur", () => {
    const r = calculerLogistiqueMensuelle({
      quantiteAlimentsSacs: new Decimal(0),
      transportAliments,
      quantitePoissonsKg: new Decimal(0),
      transportPoissons,
      quantiteAlevinsNb: new Decimal(0),
      transportAlevins,
    });
    expect(r.voyagesAliments).toBe(0);
    expect(r.voyagesPoissons).toBe(0);
    expect(r.voyagesAlevins).toBe(0);
    expect(r.sousTotalFCFA.equals(0)).toBe(true);
  });

  it("cas limite : une categorie a capacite = 0 ne bloque pas le calcul des autres categories", () => {
    const r = calculerLogistiqueMensuelle({
      quantiteAlimentsSacs: new Decimal(120),
      transportAliments: { capacite: new Decimal(0), coutUnitaireFCFA: new Decimal(15000) },
      quantitePoissonsKg: new Decimal(1500),
      transportPoissons,
      quantiteAlevinsNb: new Decimal(20000),
      transportAlevins,
    });
    expect(r.voyagesAliments).toBe(0);
    expect(r.coutAlimentsFCFA.equals(0)).toBe(true);
    expect(r.voyagesPoissons).toBe(1);
    expect(r.voyagesAlevins).toBe(1);
    expect(r.sousTotalFCFA.equals(0 + 25000 + 30000)).toBe(true);
  });
});
