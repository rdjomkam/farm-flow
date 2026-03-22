/**
 * Tests unitaires — PLATFORM_PERMISSIONS (Story A.3)
 *
 * Couvre :
 * - PLATFORM_PERMISSIONS contient SITES_VOIR, SITES_GERER, ANALYTICS_PLATEFORME (ADR-021)
 * - PLATFORM_PERMISSIONS contient les permissions Sprint 30 precedentes
 *   (PLANS_GERER, ABONNEMENTS_VOIR, ABONNEMENTS_GERER, REMISES_GERER,
 *    COMMISSIONS_VOIR, COMMISSIONS_GERER, COMMISSION_PREMIUM,
 *    PORTEFEUILLE_VOIR, PORTEFEUILLE_GERER)
 * - Toutes les valeurs sont des Permission enum valides
 * - Compte total : 12 permissions (9 Sprint 30 + 3 ADR-021)
 *
 * Importe depuis @/lib/permissions-constants et @/types.
 */

import { describe, it, expect } from "vitest";
import { PLATFORM_PERMISSIONS } from "@/lib/permissions-constants";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Contenu attendu — permissions ADR-021 (Admin Plateforme)
// ---------------------------------------------------------------------------

describe("PLATFORM_PERMISSIONS — permissions ADR-021 Admin Plateforme", () => {
  it("contient SITES_VOIR", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.SITES_VOIR);
  });

  it("contient SITES_GERER", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.SITES_GERER);
  });

  it("contient ANALYTICS_PLATEFORME", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.ANALYTICS_PLATEFORME);
  });
});

// ---------------------------------------------------------------------------
// Contenu attendu — permissions Sprint 30 (Abonnements & Commissions)
// ---------------------------------------------------------------------------

describe("PLATFORM_PERMISSIONS — permissions Sprint 30 precedentes", () => {
  it("contient PLANS_GERER", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.PLANS_GERER);
  });

  it("contient ABONNEMENTS_VOIR", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.ABONNEMENTS_VOIR);
  });

  it("contient ABONNEMENTS_GERER", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.ABONNEMENTS_GERER);
  });

  it("contient REMISES_GERER", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.REMISES_GERER);
  });

  it("contient COMMISSIONS_VOIR", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.COMMISSIONS_VOIR);
  });

  it("contient COMMISSIONS_GERER", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.COMMISSIONS_GERER);
  });

  it("contient COMMISSION_PREMIUM", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.COMMISSION_PREMIUM);
  });

  it("contient PORTEFEUILLE_VOIR", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.PORTEFEUILLE_VOIR);
  });

  it("contient PORTEFEUILLE_GERER", () => {
    expect(PLATFORM_PERMISSIONS).toContain(Permission.PORTEFEUILLE_GERER);
  });
});

// ---------------------------------------------------------------------------
// Validite des valeurs
// ---------------------------------------------------------------------------

describe("PLATFORM_PERMISSIONS — validite des valeurs", () => {
  const ALL_PERMISSIONS = Object.values(Permission);

  it("toutes les valeurs sont des Permission enum valides", () => {
    for (const perm of PLATFORM_PERMISSIONS) {
      expect(ALL_PERMISSIONS).toContain(perm);
    }
  });

  it("ne contient pas de doublons", () => {
    const unique = new Set(PLATFORM_PERMISSIONS);
    expect(unique.size).toBe(PLATFORM_PERMISSIONS.length);
  });

  it("est un tableau (Array)", () => {
    expect(Array.isArray(PLATFORM_PERMISSIONS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compte total
// ---------------------------------------------------------------------------

describe("PLATFORM_PERMISSIONS — compte total", () => {
  it("contient exactement 12 permissions (9 Sprint-30 + 3 ADR-021)", () => {
    expect(PLATFORM_PERMISSIONS).toHaveLength(12);
  });

  it("les 3 permissions ADR-021 sont les dernieres ajoutees", () => {
    const adr021Perms = [
      Permission.SITES_VOIR,
      Permission.SITES_GERER,
      Permission.ANALYTICS_PLATEFORME,
    ];
    for (const perm of adr021Perms) {
      expect(PLATFORM_PERMISSIONS).toContain(perm);
    }
    // elles n'existaient pas dans les 9 premieres permissions Sprint-30
    const sprint30Perms = PLATFORM_PERMISSIONS.slice(0, 9);
    for (const perm of adr021Perms) {
      expect(sprint30Perms).not.toContain(perm);
    }
  });
});
