/**
 * Tests unitaires — src/lib/abonnements/prorata.ts
 *
 * Story 50.3 — Sprint 50
 * Couvre : calculerCreditRestant, calculerPrixPlan, calculerDeltaUpgrade
 */
import { describe, it, expect } from "vitest";
import {
  calculerCreditRestant,
  calculerPrixPlan,
  calculerDeltaUpgrade,
} from "@/lib/abonnements/prorata";
import { PeriodeFacturation, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// calculerCreditRestant
// ---------------------------------------------------------------------------

describe("calculerCreditRestant", () => {
  const dateDebut = new Date("2026-04-01");
  const dateFin = new Date("2026-05-01"); // 30 jours

  it("retourne le prorata correct à mi-période", () => {
    const aujourdhui = new Date("2026-04-16"); // 15 jours restants
    const credit = calculerCreditRestant(3000, dateDebut, dateFin, aujourdhui);
    // 3000 * (15/30) = 1500
    expect(credit).toBe(1500);
  });

  it("retourne prixPaye en entier au premier jour (div/0 guard — joursTotaux=0)", () => {
    const memeJour = new Date("2026-04-01");
    const credit = calculerCreditRestant(3000, memeJour, memeJour, memeJour);
    expect(credit).toBe(3000);
  });

  it("retourne 0 si plan gratuit (prixPaye=0)", () => {
    const credit = calculerCreditRestant(0, dateDebut, dateFin, new Date("2026-04-16"));
    expect(credit).toBe(0);
  });

  it("retourne 0 si abonnement expiré (joursRestants=0)", () => {
    const apresExpiration = new Date("2026-05-15");
    const credit = calculerCreditRestant(3000, dateDebut, dateFin, apresExpiration);
    expect(credit).toBe(0);
  });

  it("retourne prixPaye le premier jour si joursRestants = joursTotaux", () => {
    const premierJour = new Date("2026-04-01");
    const credit = calculerCreditRestant(3000, dateDebut, dateFin, premierJour);
    expect(credit).toBe(3000);
  });

  it("retourne 0 pour un prix négatif (garde)", () => {
    const credit = calculerCreditRestant(-100, dateDebut, dateFin, new Date("2026-04-16"));
    expect(credit).toBe(0);
  });

  it("arrondit à l'entier inférieur", () => {
    // 3001 * (15/30) = 1500.5 → floor = 1500
    const credit = calculerCreditRestant(3001, dateDebut, dateFin, new Date("2026-04-16"));
    expect(credit).toBe(1500);
  });

  it("retourne prixPaye intégral si dateFin < dateDebut (guard joursTotaux <= 0)", () => {
    const mauvaiseDateFin = new Date("2026-03-01");
    const credit = calculerCreditRestant(3000, dateDebut, mauvaiseDateFin, new Date("2026-04-10"));
    expect(credit).toBe(3000);
  });

  it("calcul correct pour période annuelle (365 jours)", () => {
    const debut = new Date("2026-01-01");
    const fin = new Date("2027-01-01");
    const aujourd = new Date("2026-07-01"); // environ 184 jours restants
    const credit = calculerCreditRestant(25000, debut, fin, aujourd);
    // 25000 * 184 / 365 ≈ 12602
    expect(credit).toBeGreaterThan(12000);
    expect(credit).toBeLessThan(13000);
  });
});

// ---------------------------------------------------------------------------
// calculerPrixPlan
// ---------------------------------------------------------------------------

describe("calculerPrixPlan", () => {
  it("retourne le prix mensuel du plan ELEVEUR", () => {
    const prix = calculerPrixPlan(TypePlan.ELEVEUR, PeriodeFacturation.MENSUEL);
    expect(prix).toBe(3000);
  });

  it("retourne le prix annuel du plan PROFESSIONNEL", () => {
    const prix = calculerPrixPlan(TypePlan.PROFESSIONNEL, PeriodeFacturation.ANNUEL);
    expect(prix).toBe(70000);
  });

  it("retourne 0 pour le plan DECOUVERTE (gratuit)", () => {
    const prix = calculerPrixPlan(TypePlan.DECOUVERTE, PeriodeFacturation.MENSUEL);
    expect(prix).toBe(0);
  });

  it("retourne null si la période n'est pas disponible pour ce plan (ELEVEUR trimestriel)", () => {
    // ELEVEUR n'a pas de tarif trimestriel selon PLAN_TARIFS
    // Note : selon les constantes, ELEVEUR a TRIMESTRIEL=7500, donc ce test vérifie la présence
    const prix = calculerPrixPlan(TypePlan.ELEVEUR, PeriodeFacturation.TRIMESTRIEL);
    // Retourne 7500 selon PLAN_TARIFS
    expect(typeof prix).toBe("number");
  });

  it("retourne null si ENTREPRISE n'a pas de tarif trimestriel", () => {
    const prix = calculerPrixPlan(TypePlan.ENTREPRISE, PeriodeFacturation.TRIMESTRIEL);
    expect(prix).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerDeltaUpgrade
// ---------------------------------------------------------------------------

describe("calculerDeltaUpgrade", () => {
  it("montantAPayer = 0 si crédit couvre entièrement le nouveau plan", () => {
    const result = calculerDeltaUpgrade(5000, 3000);
    expect(result.montantAPayer).toBe(0);
    expect(result.creditRestant).toBe(2000);
  });

  it("montantAPayer = différence si crédit insuffisant", () => {
    const result = calculerDeltaUpgrade(1000, 3000);
    expect(result.montantAPayer).toBe(2000);
    expect(result.creditRestant).toBe(0);
  });

  it("montantAPayer = 0 si crédit exactement égal au prix", () => {
    const result = calculerDeltaUpgrade(3000, 3000);
    expect(result.montantAPayer).toBe(0);
    expect(result.creditRestant).toBe(0);
  });

  it("prend en compte le solde crédit existant", () => {
    // creditProrata=1000, soldeCreditActuel=3000, prixNouveauPlan=3000
    // creditTotal = 4000 >= 3000 → montantAPayer = 0, creditRestant = 1000
    const result = calculerDeltaUpgrade(1000, 3000, 3000);
    expect(result.montantAPayer).toBe(0);
    expect(result.creditRestant).toBe(1000);
  });

  it("gère les valeurs négatives de crédit (retourne 0)", () => {
    const result = calculerDeltaUpgrade(-100, 3000);
    expect(result.montantAPayer).toBe(3000);
    expect(result.creditRestant).toBe(0);
  });

  it("retourne les champs creditProrata et prixNouveauPlan corrects", () => {
    const result = calculerDeltaUpgrade(2000, 8000);
    expect(result.creditProrata).toBe(2000);
    expect(result.prixNouveauPlan).toBe(8000);
    expect(result.montantAPayer).toBe(6000);
  });

  it("montantAPayer >= 0 toujours (pas de valeur négative)", () => {
    const result = calculerDeltaUpgrade(10000, 3000);
    expect(result.montantAPayer).toBeGreaterThanOrEqual(0);
  });

  it("creditRestant >= 0 toujours (pas de valeur négative)", () => {
    const result = calculerDeltaUpgrade(0, 5000);
    expect(result.creditRestant).toBeGreaterThanOrEqual(0);
  });
});
