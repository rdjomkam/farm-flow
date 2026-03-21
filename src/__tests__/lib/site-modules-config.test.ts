/**
 * Tests unitaires — site-modules-config.ts (BUG-022 / Story 38.5)
 *
 * Couvre :
 * - isModuleActive : modules platform toujours actifs
 * - isModuleActive : modules site dépendent de enabledModules
 * - isModuleActive : module inconnu retourne false
 * - SITE_TOGGLEABLE_MODULES : contient uniquement des modules site-level
 * - PLATFORM_MODULES : contient exactement ABONNEMENTS, COMMISSIONS, REMISES
 * - SITE_MODULES_CONFIG : contient exactement 12 modules (9 site + 3 platform)
 */

import { describe, it, expect } from "vitest";
import {
  SITE_MODULES_CONFIG,
  SITE_TOGGLEABLE_MODULES,
  PLATFORM_MODULES,
  isModuleActive,
} from "@/lib/site-modules-config";
import { SiteModule } from "@/types";

// ---------------------------------------------------------------------------
// isModuleActive — modules platform
// ---------------------------------------------------------------------------

describe("isModuleActive — modules platform (actifs uniquement sur site plateforme)", () => {
  it("ABONNEMENTS retourne true avec isPlatform=true et enabledModules vide", () => {
    expect(isModuleActive(SiteModule.ABONNEMENTS, [], true)).toBe(true);
  });

  it("COMMISSIONS retourne true avec isPlatform=true et enabledModules vide", () => {
    expect(isModuleActive(SiteModule.COMMISSIONS, [], true)).toBe(true);
  });

  it("REMISES retourne true avec isPlatform=true et enabledModules vide", () => {
    expect(isModuleActive(SiteModule.REMISES, [], true)).toBe(true);
  });

  it("ABONNEMENTS retourne true avec isPlatform=true même si absent de enabledModules", () => {
    const enabledModules = [SiteModule.GROSSISSEMENT, SiteModule.VENTES];
    expect(isModuleActive(SiteModule.ABONNEMENTS, enabledModules, true)).toBe(true);
  });

  it("COMMISSIONS retourne true avec isPlatform=true même si absent de enabledModules", () => {
    const enabledModules = [SiteModule.GROSSISSEMENT];
    expect(isModuleActive(SiteModule.COMMISSIONS, enabledModules, true)).toBe(true);
  });

  it("REMISES retourne true avec isPlatform=true même si absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.REMISES, [SiteModule.VENTES], true)).toBe(true);
  });

  it("ABONNEMENTS retourne false sur un site non-plateforme (isPlatform=false)", () => {
    expect(isModuleActive(SiteModule.ABONNEMENTS, [], false)).toBe(false);
  });

  it("COMMISSIONS retourne false sur un site non-plateforme (isPlatform=false)", () => {
    expect(isModuleActive(SiteModule.COMMISSIONS, [SiteModule.GROSSISSEMENT], false)).toBe(false);
  });

  it("REMISES retourne false quand isPlatform est omis", () => {
    expect(isModuleActive(SiteModule.REMISES, [])).toBe(false);
  });

  it("PACKS_PROVISIONING retourne false sur un site non-plateforme", () => {
    expect(isModuleActive(SiteModule.PACKS_PROVISIONING, [SiteModule.PACKS_PROVISIONING], false)).toBe(false);
  });

  it("PACKS_PROVISIONING retourne true sur le site plateforme", () => {
    expect(isModuleActive(SiteModule.PACKS_PROVISIONING, [], true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isModuleActive — modules site
// ---------------------------------------------------------------------------

describe("isModuleActive — modules site (dépendent de enabledModules)", () => {
  it("GROSSISSEMENT retourne false quand enabledModules est vide", () => {
    expect(isModuleActive(SiteModule.GROSSISSEMENT, [])).toBe(false);
  });

  it("GROSSISSEMENT retourne true quand il est dans enabledModules", () => {
    expect(isModuleActive(SiteModule.GROSSISSEMENT, [SiteModule.GROSSISSEMENT])).toBe(true);
  });

  it("REPRODUCTION retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.REPRODUCTION, [SiteModule.GROSSISSEMENT])).toBe(false);
  });

  it("REPRODUCTION retourne true quand présent dans enabledModules", () => {
    expect(isModuleActive(SiteModule.REPRODUCTION, [SiteModule.REPRODUCTION, SiteModule.GROSSISSEMENT])).toBe(true);
  });

  it("INTRANTS retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.INTRANTS, [])).toBe(false);
  });

  it("VENTES retourne true quand présent dans enabledModules", () => {
    expect(isModuleActive(SiteModule.VENTES, [SiteModule.VENTES])).toBe(true);
  });

  it("ANALYSE_PILOTAGE retourne false quand enabledModules ne le contient pas", () => {
    expect(isModuleActive(SiteModule.ANALYSE_PILOTAGE, [SiteModule.GROSSISSEMENT, SiteModule.VENTES])).toBe(false);
  });

  it("CONFIGURATION retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.CONFIGURATION, [])).toBe(false);
  });

  it("INGENIEUR retourne true quand présent dans enabledModules", () => {
    expect(isModuleActive(SiteModule.INGENIEUR, [SiteModule.INGENIEUR])).toBe(true);
  });

  it("NOTES retourne false quand enabledModules est vide", () => {
    expect(isModuleActive(SiteModule.NOTES, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isModuleActive — module inconnu
// ---------------------------------------------------------------------------

describe("isModuleActive — module inconnu", () => {
  it("retourne false pour un module qui n'existe pas dans SITE_MODULES_CONFIG", () => {
    // Cast to bypass TypeScript — simule un module inconnu envoyé via l'API
    expect(isModuleActive("MODULE_INEXISTANT" as SiteModule, [])).toBe(false);
  });

  it("retourne false pour une string vide", () => {
    expect(isModuleActive("" as SiteModule, [SiteModule.GROSSISSEMENT])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SITE_TOGGLEABLE_MODULES — ne contient que des modules site-level
// ---------------------------------------------------------------------------

describe("SITE_TOGGLEABLE_MODULES — uniquement des modules site-level", () => {
  it("ne contient pas ABONNEMENTS (platform)", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).not.toContain(SiteModule.ABONNEMENTS);
  });

  it("ne contient pas COMMISSIONS (platform)", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).not.toContain(SiteModule.COMMISSIONS);
  });

  it("ne contient pas REMISES (platform)", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).not.toContain(SiteModule.REMISES);
  });

  it("ne contient pas PACKS_PROVISIONING (platform)", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).not.toContain(SiteModule.PACKS_PROVISIONING);
  });

  it("tous les éléments ont level === 'site'", () => {
    expect(SITE_TOGGLEABLE_MODULES.every((m) => m.level === "site")).toBe(true);
  });

  it("contient exactement 8 modules site-level", () => {
    expect(SITE_TOGGLEABLE_MODULES).toHaveLength(8);
  });

  it("contient GROSSISSEMENT", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.GROSSISSEMENT);
  });

  it("contient REPRODUCTION", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.REPRODUCTION);
  });

  it("contient INTRANTS", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.INTRANTS);
  });

  it("contient VENTES", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.VENTES);
  });

  it("contient ANALYSE_PILOTAGE", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.ANALYSE_PILOTAGE);
  });
});

// ---------------------------------------------------------------------------
// PLATFORM_MODULES — contient exactement ABONNEMENTS, COMMISSIONS, REMISES
// ---------------------------------------------------------------------------

describe("PLATFORM_MODULES — modules platform-level", () => {
  it("contient exactement 4 modules", () => {
    expect(PLATFORM_MODULES).toHaveLength(4);
  });

  it("contient ABONNEMENTS", () => {
    const values = PLATFORM_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.ABONNEMENTS);
  });

  it("contient COMMISSIONS", () => {
    const values = PLATFORM_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.COMMISSIONS);
  });

  it("contient REMISES", () => {
    const values = PLATFORM_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.REMISES);
  });

  it("contient PACKS_PROVISIONING", () => {
    const values = PLATFORM_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.PACKS_PROVISIONING);
  });

  it("tous les éléments ont level === 'platform'", () => {
    expect(PLATFORM_MODULES.every((m) => m.level === "platform")).toBe(true);
  });

  it("ne contient aucun module site-level", () => {
    expect(PLATFORM_MODULES.every((m) => m.level !== "site")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SITE_MODULES_CONFIG — contient tous les 12 modules
// ---------------------------------------------------------------------------

describe("SITE_MODULES_CONFIG — configuration complète des modules", () => {
  it("contient exactement 12 modules (8 site + 4 platform)", () => {
    expect(SITE_MODULES_CONFIG).toHaveLength(12);
  });

  it("contient 8 modules site-level", () => {
    const siteModules = SITE_MODULES_CONFIG.filter((m) => m.level === "site");
    expect(siteModules).toHaveLength(8);
  });

  it("contient 4 modules platform-level", () => {
    const platformModules = SITE_MODULES_CONFIG.filter((m) => m.level === "platform");
    expect(platformModules).toHaveLength(4);
  });

  it("chaque entrée possède les propriétés value, labelKey, icon et level", () => {
    for (const config of SITE_MODULES_CONFIG) {
      expect(config).toHaveProperty("value");
      expect(config).toHaveProperty("labelKey");
      expect(config).toHaveProperty("icon");
      expect(config).toHaveProperty("level");
    }
  });

  it("les valeurs value sont uniques (pas de doublon)", () => {
    const values = SITE_MODULES_CONFIG.map((m) => m.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("toutes les valeurs level sont soit 'site' soit 'platform'", () => {
    const validLevels = new Set(["site", "platform"]);
    expect(SITE_MODULES_CONFIG.every((m) => validLevels.has(m.level))).toBe(true);
  });

  it("la somme des toggleable + platform égale la config totale", () => {
    expect(SITE_TOGGLEABLE_MODULES.length + PLATFORM_MODULES.length).toBe(
      SITE_MODULES_CONFIG.length
    );
  });
});
