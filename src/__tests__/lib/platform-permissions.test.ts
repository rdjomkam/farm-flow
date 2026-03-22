/**
 * Tests unitaires — permissions-constants.ts (ADR-022 Sprint B)
 *
 * PLATFORM_PERMISSIONS a ete supprime (ADR-022).
 * Ce fichier verifie que les fonctions utilitaires restantes fonctionnent.
 *
 * Couvre :
 * - hasPermission : retourne true si la permission est presente
 * - hasAnyPermission : retourne true si au moins une permission correspond
 * - PERMISSION_GROUPS : structure correcte sans adminPlateforme
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  PERMISSION_GROUPS,
} from "@/lib/permissions-constants";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------

describe("hasPermission", () => {
  it("retourne true si la permission est presente", () => {
    expect(hasPermission([Permission.SITES_VOIR, Permission.SITES_GERER], Permission.SITES_VOIR)).toBe(true);
  });

  it("retourne false si la permission est absente", () => {
    expect(hasPermission([Permission.VAGUES_VOIR], Permission.SITES_GERER)).toBe(false);
  });

  it("retourne false pour un tableau vide", () => {
    expect(hasPermission([], Permission.DASHBOARD_VOIR)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAnyPermission
// ---------------------------------------------------------------------------

describe("hasAnyPermission", () => {
  it("retourne true si au moins une permission correspond", () => {
    expect(
      hasAnyPermission(
        [Permission.VAGUES_VOIR, Permission.SITES_GERER],
        [Permission.SITES_GERER, Permission.ANALYTICS_PLATEFORME]
      )
    ).toBe(true);
  });

  it("retourne false si aucune permission ne correspond", () => {
    expect(
      hasAnyPermission(
        [Permission.VAGUES_VOIR],
        [Permission.SITES_GERER, Permission.ANALYTICS_PLATEFORME]
      )
    ).toBe(false);
  });

  it("retourne false pour des tableaux vides", () => {
    expect(hasAnyPermission([], [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PERMISSION_GROUPS — structure sans adminPlateforme
// ---------------------------------------------------------------------------

describe("PERMISSION_GROUPS — structure", () => {
  it("ne contient pas de groupe adminPlateforme", () => {
    expect(Object.keys(PERMISSION_GROUPS)).not.toContain("adminPlateforme");
  });

  it("contient le groupe administration", () => {
    expect(Object.keys(PERMISSION_GROUPS)).toContain("administration");
  });

  it("contient le groupe abonnements", () => {
    expect(Object.keys(PERMISSION_GROUPS)).toContain("abonnements");
  });

  it("le groupe abonnements contient ABONNEMENTS_VOIR", () => {
    expect(PERMISSION_GROUPS.abonnements).toContain(Permission.ABONNEMENTS_VOIR);
  });

  it("le groupe administration contient SITE_GERER", () => {
    expect(PERMISSION_GROUPS.administration).toContain(Permission.SITE_GERER);
  });
});
