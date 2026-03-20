/**
 * Tests unitaires — abonnements-constants.ts (Sprint 30)
 *
 * Teste les fonctions pures calculerMontantRemise et calculerProchaineDate,
 * ainsi que les constantes tarifaires et limites.
 */
import { describe, it, expect } from "vitest";
import {
  calculerMontantRemise,
  calculerProchaineDate,
  PLAN_TARIFS,
  PLAN_LIMITES,
  GRACE_PERIOD_JOURS,
  SUSPENSION_JOURS,
  COMMISSION_TAUX_DEFAULT,
  COMMISSION_TAUX_PREMIUM,
} from "@/lib/abonnements-constants";
import { PeriodeFacturation, TypePlan } from "@/types";
import type { Remise } from "@/types";

// ---------------------------------------------------------------------------
// calculerMontantRemise — remises fixes
// ---------------------------------------------------------------------------

describe("calculerMontantRemise — remise fixe (montant en FCFA)", () => {
  const remiseFixe: Remise = {
    id: "r1",
    nom: "Test fixe",
    code: "FIXE2000",
    type: "MANUELLE" as Remise["type"],
    valeur: 2000,
    estPourcentage: false,
    dateDebut: new Date(),
    dateFin: null,
    limiteUtilisations: null,
    nombreUtilisations: 0,
    isActif: true,
    siteId: null,
    userId: "u1",
    planId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("retourne prix - valeur pour remise fixe standard", () => {
    expect(calculerMontantRemise(8000, remiseFixe)).toBe(6000);
  });

  it("retourne 0 si la remise fixe dépasse le prix", () => {
    expect(calculerMontantRemise(1500, remiseFixe)).toBe(0);
  });

  it("retourne 0 si la remise fixe est égale au prix", () => {
    expect(calculerMontantRemise(2000, remiseFixe)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculerMontantRemise — remises pourcentage
// ---------------------------------------------------------------------------

describe("calculerMontantRemise — remise pourcentage", () => {
  const remisePourcentage: Remise = {
    id: "r2",
    nom: "Test pourcent",
    code: "PCT10",
    type: "EARLY_ADOPTER" as Remise["type"],
    valeur: 10,
    estPourcentage: true,
    dateDebut: new Date(),
    dateFin: null,
    limiteUtilisations: null,
    nombreUtilisations: 0,
    isActif: true,
    siteId: null,
    userId: "u1",
    planId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("retourne prix × (1 - taux) pour remise 10%", () => {
    expect(calculerMontantRemise(25000, remisePourcentage)).toBe(22500);
  });

  it("retourne prix × (1 - taux) pour remise 50%", () => {
    const remise50 = { ...remisePourcentage, valeur: 50 };
    expect(calculerMontantRemise(8000, remise50)).toBe(4000);
  });

  it("retourne 0 si remise 100%", () => {
    const remise100 = { ...remisePourcentage, valeur: 100 };
    expect(calculerMontantRemise(8000, remise100)).toBe(0);
  });

  it("ne retourne jamais un prix négatif (remise > 100%)", () => {
    const remise120 = { ...remisePourcentage, valeur: 120 };
    expect(calculerMontantRemise(8000, remise120)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculerProchaineDate
// ---------------------------------------------------------------------------

describe("calculerProchaineDate", () => {
  it("MENSUEL ajoute exactement 1 mois", () => {
    const base = new Date("2026-01-15");
    const result = calculerProchaineDate(base, PeriodeFacturation.MENSUEL);
    expect(result.getMonth()).toBe(1); // Février (0-indexed)
    expect(result.getFullYear()).toBe(2026);
    expect(result.getDate()).toBe(15);
  });

  it("TRIMESTRIEL ajoute exactement 3 mois", () => {
    const base = new Date("2026-01-15");
    const result = calculerProchaineDate(base, PeriodeFacturation.TRIMESTRIEL);
    expect(result.getMonth()).toBe(3); // Avril
    expect(result.getFullYear()).toBe(2026);
  });

  it("ANNUEL ajoute exactement 12 mois (1 an)", () => {
    const base = new Date("2026-01-15");
    const result = calculerProchaineDate(base, PeriodeFacturation.ANNUEL);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // Janvier
    expect(result.getDate()).toBe(15);
  });

  it("MENSUEL gère le passage d'année (décembre → janvier)", () => {
    const base = new Date("2026-12-10");
    const result = calculerProchaineDate(base, PeriodeFacturation.MENSUEL);
    expect(result.getMonth()).toBe(0); // Janvier
    expect(result.getFullYear()).toBe(2027);
  });

  it("ne modifie pas l'objet date original", () => {
    const base = new Date("2026-03-15");
    const baseTime = base.getTime();
    calculerProchaineDate(base, PeriodeFacturation.MENSUEL);
    expect(base.getTime()).toBe(baseTime); // date originale inchangée
  });
});

// ---------------------------------------------------------------------------
// PLAN_TARIFS — vérifications des constantes
// ---------------------------------------------------------------------------

describe("PLAN_TARIFS — constantes tarifaires", () => {
  it("DECOUVERTE MENSUEL est 0 (plan gratuit)", () => {
    expect(PLAN_TARIFS[TypePlan.DECOUVERTE][PeriodeFacturation.MENSUEL]).toBe(
      0
    );
  });

  it("DECOUVERTE TRIMESTRIEL est null (non disponible)", () => {
    expect(
      PLAN_TARIFS[TypePlan.DECOUVERTE][PeriodeFacturation.TRIMESTRIEL]
    ).toBeNull();
  });

  it("ELEVEUR MENSUEL est 3000 FCFA", () => {
    expect(PLAN_TARIFS[TypePlan.ELEVEUR][PeriodeFacturation.MENSUEL]).toBe(3000);
  });

  it("PROFESSIONNEL ANNUEL est 70000 FCFA", () => {
    expect(
      PLAN_TARIFS[TypePlan.PROFESSIONNEL][PeriodeFacturation.ANNUEL]
    ).toBe(70000);
  });

  it("INGENIEUR_PRO MENSUEL est 15000 FCFA", () => {
    expect(
      PLAN_TARIFS[TypePlan.INGENIEUR_PRO][PeriodeFacturation.MENSUEL]
    ).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
// PLAN_LIMITES — vérifications des limites
// ---------------------------------------------------------------------------

describe("PLAN_LIMITES — limites de ressources", () => {
  it("DECOUVERTE limitesBacs est 3", () => {
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs).toBe(3);
  });

  it("DECOUVERTE limitesSites est 1", () => {
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesSites).toBe(1);
  });

  it("PROFESSIONNEL limitesBacs est 30", () => {
    expect(PLAN_LIMITES[TypePlan.PROFESSIONNEL].limitesBacs).toBe(30);
  });

  it("INGENIEUR_PRO limitesIngFermes est 20", () => {
    expect(PLAN_LIMITES[TypePlan.INGENIEUR_PRO].limitesIngFermes).toBe(20);
  });

  it("ENTREPRISE limitesBacs est 999 (illimité)", () => {
    expect(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// Constantes métier
// ---------------------------------------------------------------------------

describe("Constantes métier Sprint 30", () => {
  it("GRACE_PERIOD_JOURS est 7", () => {
    expect(GRACE_PERIOD_JOURS).toBe(7);
  });

  it("SUSPENSION_JOURS est 30", () => {
    expect(SUSPENSION_JOURS).toBe(30);
  });

  it("COMMISSION_TAUX_DEFAULT est 0.10 (10%)", () => {
    expect(COMMISSION_TAUX_DEFAULT).toBe(0.1);
  });

  it("COMMISSION_TAUX_PREMIUM est 0.20 (20%)", () => {
    expect(COMMISSION_TAUX_PREMIUM).toBe(0.2);
  });
});
