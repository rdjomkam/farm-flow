/**
 * Tests unitaires — fonctions utilitaires utilisées dans l'UI Sprint 33
 *
 * Couvre :
 * - calculerMontantRemise() — remise fixe, remise pourcentage, minimum 0
 * - calculerProchaineDate() — MENSUEL, TRIMESTRIEL, ANNUEL
 * - PLAN_TARIFS — cohérence des prix
 * - PLAN_LABELS — tous les TypePlan ont un label
 * - Validation du numéro de téléphone camerounais (format +237 6XX)
 *
 * Story 33.5 — Sprint 33
 * R2 : enums TypePlan, PeriodeFacturation importés depuis @/types
 */

import { describe, it, expect } from "vitest";
import {
  calculerMontantRemise,
  calculerProchaineDate,
  PLAN_TARIFS,
  PLAN_LABELS,
  PLAN_LIMITES,
  PERIODE_LABELS,
  STATUT_ABONNEMENT_LABELS,
  FOURNISSEUR_LABELS,
  GRACE_PERIOD_JOURS,
  SUSPENSION_JOURS,
  COMMISSION_TAUX_DEFAULT,
  COMMISSION_TAUX_PREMIUM,
} from "@/lib/abonnements-constants";
import {
  TypePlan,
  PeriodeFacturation,
  StatutAbonnement,
  FournisseurPaiement,
  TypeRemise,
} from "@/types";
import type { Remise } from "@/types";

// ---------------------------------------------------------------------------
// calculerMontantRemise
// ---------------------------------------------------------------------------

describe("calculerMontantRemise", () => {
  const makeRemise = (valeur: number, estPourcentage: boolean): Remise => ({
    id: "r1",
    nom: "Test remise",
    code: "TEST",
    type: TypeRemise.EARLY_ADOPTER,
    valeur,
    estPourcentage,
    dateDebut: new Date(),
    dateFin: null,
    limiteUtilisations: null,
    nombreUtilisations: 0,
    isActif: true,
    siteId: null,
    planId: null,
    userId: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("applique une remise fixe correctement", () => {
    const remise = makeRemise(1000, false);
    expect(calculerMontantRemise(8000, remise)).toBe(7000);
  });

  it("applique une remise pourcentage correctement", () => {
    const remise = makeRemise(10, true); // 10%
    expect(calculerMontantRemise(8000, remise)).toBe(7200);
  });

  it("ne retourne jamais un prix négatif (remise fixe > prix)", () => {
    const remise = makeRemise(10000, false);
    expect(calculerMontantRemise(5000, remise)).toBe(0);
  });

  it("ne retourne jamais un prix négatif (remise 100%)", () => {
    const remise = makeRemise(100, true);
    expect(calculerMontantRemise(8000, remise)).toBe(0);
  });

  it("gère un prix de base à 0 (plan DECOUVERTE)", () => {
    const remise = makeRemise(1000, false);
    expect(calculerMontantRemise(0, remise)).toBe(0);
  });

  it("remise pourcentage à 0% = prix inchangé", () => {
    const remise = makeRemise(0, true);
    expect(calculerMontantRemise(8000, remise)).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// calculerProchaineDate
// ---------------------------------------------------------------------------

describe("calculerProchaineDate", () => {
  const base = new Date("2026-01-15");

  it("calcule correctement la date mensuelle", () => {
    const result = calculerProchaineDate(base, PeriodeFacturation.MENSUEL);
    expect(result.getMonth()).toBe(1); // Février
    expect(result.getDate()).toBe(15);
    expect(result.getFullYear()).toBe(2026);
  });

  it("calcule correctement la date trimestrielle", () => {
    const result = calculerProchaineDate(base, PeriodeFacturation.TRIMESTRIEL);
    expect(result.getMonth()).toBe(3); // Avril
    expect(result.getDate()).toBe(15);
  });

  it("calcule correctement la date annuelle", () => {
    const result = calculerProchaineDate(base, PeriodeFacturation.ANNUEL);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // Janvier
    expect(result.getDate()).toBe(15);
  });

  it("ne modifie pas la date de base", () => {
    const original = new Date("2026-01-15");
    calculerProchaineDate(base, PeriodeFacturation.MENSUEL);
    expect(base.getTime()).toBe(original.getTime());
  });
});

// ---------------------------------------------------------------------------
// PLAN_TARIFS — cohérence
// ---------------------------------------------------------------------------

describe("PLAN_TARIFS", () => {
  it("contient tous les TypePlan", () => {
    const allPlans = Object.values(TypePlan);
    allPlans.forEach((plan) => {
      expect(PLAN_TARIFS[plan]).toBeDefined();
    });
  });

  it("DECOUVERTE est gratuit (MENSUEL = 0)", () => {
    expect(PLAN_TARIFS[TypePlan.DECOUVERTE][PeriodeFacturation.MENSUEL]).toBe(0);
  });

  it("ELEVEUR a des tarifs positifs pour MENSUEL", () => {
    const tarif = PLAN_TARIFS[TypePlan.ELEVEUR][PeriodeFacturation.MENSUEL];
    expect(tarif).toBeGreaterThan(0);
  });

  it("PROFESSIONNEL > ELEVEUR en tarif mensuel", () => {
    const eleveur = PLAN_TARIFS[TypePlan.ELEVEUR][PeriodeFacturation.MENSUEL] ?? 0;
    const pro = PLAN_TARIFS[TypePlan.PROFESSIONNEL][PeriodeFacturation.MENSUEL] ?? 0;
    expect(pro).toBeGreaterThan(eleveur);
  });

  it("tarif annuel < tarif mensuel × 12 pour ELEVEUR (économie)", () => {
    const mensuel = PLAN_TARIFS[TypePlan.ELEVEUR][PeriodeFacturation.MENSUEL] ?? 0;
    const annuel = PLAN_TARIFS[TypePlan.ELEVEUR][PeriodeFacturation.ANNUEL] ?? 0;
    expect(annuel).toBeLessThan(mensuel * 12);
  });
});

// ---------------------------------------------------------------------------
// PLAN_LABELS — tous les plans ont un label FR
// ---------------------------------------------------------------------------

describe("PLAN_LABELS", () => {
  it("tous les TypePlan ont un label non vide", () => {
    const allPlans = Object.values(TypePlan);
    allPlans.forEach((plan) => {
      expect(PLAN_LABELS[plan]).toBeTruthy();
      expect(typeof PLAN_LABELS[plan]).toBe("string");
    });
  });

  it("DECOUVERTE est bien 'Découverte'", () => {
    expect(PLAN_LABELS[TypePlan.DECOUVERTE]).toBe("Découverte");
  });
});

// ---------------------------------------------------------------------------
// PLAN_LIMITES — cohérence
// ---------------------------------------------------------------------------

describe("PLAN_LIMITES", () => {
  it("tous les TypePlan ont des limites définies", () => {
    const allPlans = Object.values(TypePlan);
    allPlans.forEach((plan) => {
      expect(PLAN_LIMITES[plan]).toBeDefined();
    });
  });

  it("ENTREPRISE a des limites très élevées (quasi illimité)", () => {
    expect(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs).toBeGreaterThanOrEqual(999);
    expect(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesVagues).toBeGreaterThanOrEqual(999);
  });

  it("DECOUVERTE a des limites restrictives", () => {
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs).toBeLessThanOrEqual(5);
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesVagues).toBeLessThanOrEqual(2);
  });

  it("plans ingénieur ont limitesIngFermes définies", () => {
    expect(PLAN_LIMITES[TypePlan.INGENIEUR_STARTER].limitesIngFermes).toBeGreaterThan(0);
    expect(PLAN_LIMITES[TypePlan.INGENIEUR_PRO].limitesIngFermes).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Labels et constantes
// ---------------------------------------------------------------------------

describe("Constantes Sprint 33", () => {
  it("PERIODE_LABELS contient les 3 périodes", () => {
    expect(PERIODE_LABELS[PeriodeFacturation.MENSUEL]).toBeTruthy();
    expect(PERIODE_LABELS[PeriodeFacturation.TRIMESTRIEL]).toBeTruthy();
    expect(PERIODE_LABELS[PeriodeFacturation.ANNUEL]).toBeTruthy();
  });

  it("STATUT_ABONNEMENT_LABELS contient tous les statuts", () => {
    const statuts = Object.values(StatutAbonnement);
    statuts.forEach((s) => {
      expect(STATUT_ABONNEMENT_LABELS[s]).toBeTruthy();
    });
  });

  it("FOURNISSEUR_LABELS contient tous les fournisseurs", () => {
    const fournisseurs = Object.values(FournisseurPaiement);
    fournisseurs.forEach((f) => {
      expect(FOURNISSEUR_LABELS[f]).toBeTruthy();
    });
  });

  it("GRACE_PERIOD_JOURS est 7", () => {
    expect(GRACE_PERIOD_JOURS).toBe(7);
  });

  it("SUSPENSION_JOURS est 30", () => {
    expect(SUSPENSION_JOURS).toBe(30);
  });

  it("COMMISSION_TAUX_DEFAULT est 0.10 (10%)", () => {
    expect(COMMISSION_TAUX_DEFAULT).toBe(0.10);
  });

  it("COMMISSION_TAUX_PREMIUM est 0.20 (20%)", () => {
    expect(COMMISSION_TAUX_PREMIUM).toBe(0.20);
  });
});

// ---------------------------------------------------------------------------
// Validation téléphone camerounais (logique extraite du composant)
// ---------------------------------------------------------------------------

describe("Validation téléphone Cameroun", () => {
  // Logique du composant checkout-form.tsx
  function isValidPhone(phone: string): boolean {
    const normalized = phone.replace(/\s/g, "");
    return /^\+2376[5-9]\d{7}$/.test(normalized) || /^6[5-9]\d{7}$/.test(normalized);
  }

  it("accepte un numéro avec +237 6XX", () => {
    expect(isValidPhone("+237677123456")).toBe(true);
    expect(isValidPhone("+237655000000")).toBe(true);
    expect(isValidPhone("+237698765432")).toBe(true);
  });

  it("accepte un numéro sans +237 6XX", () => {
    expect(isValidPhone("677123456")).toBe(true);
    expect(isValidPhone("655000000")).toBe(true);
  });

  it("accepte avec espaces (+237 6XX XX XX XX)", () => {
    expect(isValidPhone("+237 677 123 456")).toBe(true);
  });

  it("rejette un numéro trop court", () => {
    expect(isValidPhone("+237677123")).toBe(false);
    expect(isValidPhone("677123")).toBe(false);
  });

  it("rejette un préfixe incorrect", () => {
    expect(isValidPhone("+237577123456")).toBe(false); // 5XX invalide
    expect(isValidPhone("577123456")).toBe(false);
  });

  it("rejette un numéro vide", () => {
    expect(isValidPhone("")).toBe(false);
  });

  it("rejette un indicatif d'autre pays", () => {
    expect(isValidPhone("+2250789123456")).toBe(false); // Côte d'Ivoire
  });
});
