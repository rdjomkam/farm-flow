/**
 * Tests unitaires — site-modules-config.ts (ADR-022 Sprint B)
 *
 * Couvre :
 * - isModuleActive : modules site dependent de enabledModules
 * - isModuleActive : module inconnu retourne false
 * - SITE_TOGGLEABLE_MODULES : contient tous les modules (= SITE_MODULES_CONFIG)
 * - SITE_MODULES_CONFIG : contient exactement 9 modules site-level
 */

import { describe, it, expect } from "vitest";
import {
  SITE_MODULES_CONFIG,
  SITE_TOGGLEABLE_MODULES,
  isModuleActive,
} from "@/lib/site-modules-config";
import { SiteModule } from "@/types";

// ---------------------------------------------------------------------------
// isModuleActive — modules site
// ---------------------------------------------------------------------------

describe("isModuleActive — modules site (dependent de enabledModules)", () => {
  it("GROSSISSEMENT retourne false quand enabledModules est vide", () => {
    expect(isModuleActive(SiteModule.GROSSISSEMENT, [])).toBe(false);
  });

  it("GROSSISSEMENT retourne true quand il est dans enabledModules", () => {
    expect(isModuleActive(SiteModule.GROSSISSEMENT, [SiteModule.GROSSISSEMENT])).toBe(true);
  });

  it("REPRODUCTION retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.REPRODUCTION, [SiteModule.GROSSISSEMENT])).toBe(false);
  });

  it("REPRODUCTION retourne true quand present dans enabledModules", () => {
    expect(isModuleActive(SiteModule.REPRODUCTION, [SiteModule.REPRODUCTION, SiteModule.GROSSISSEMENT])).toBe(true);
  });

  it("INTRANTS retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.INTRANTS, [])).toBe(false);
  });

  it("VENTES retourne true quand present dans enabledModules", () => {
    expect(isModuleActive(SiteModule.VENTES, [SiteModule.VENTES])).toBe(true);
  });

  it("ANALYSE_PILOTAGE retourne false quand enabledModules ne le contient pas", () => {
    expect(isModuleActive(SiteModule.ANALYSE_PILOTAGE, [SiteModule.GROSSISSEMENT, SiteModule.VENTES])).toBe(false);
  });

  it("CONFIGURATION retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.CONFIGURATION, [])).toBe(false);
  });

  it("INGENIEUR retourne true quand present dans enabledModules", () => {
    expect(isModuleActive(SiteModule.INGENIEUR, [SiteModule.INGENIEUR])).toBe(true);
  });

  it("NOTES retourne false quand enabledModules est vide", () => {
    expect(isModuleActive(SiteModule.NOTES, [])).toBe(false);
  });

  it("PACKS_PROVISIONING retourne true quand present dans enabledModules", () => {
    expect(isModuleActive(SiteModule.PACKS_PROVISIONING, [SiteModule.PACKS_PROVISIONING])).toBe(true);
  });

  it("PACKS_PROVISIONING retourne false quand absent de enabledModules", () => {
    expect(isModuleActive(SiteModule.PACKS_PROVISIONING, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isModuleActive — module inconnu
// ---------------------------------------------------------------------------

describe("isModuleActive — module inconnu", () => {
  it("retourne false pour un module qui n'existe pas dans SITE_MODULES_CONFIG", () => {
    expect(isModuleActive("MODULE_INEXISTANT" as SiteModule, [])).toBe(false);
  });

  it("retourne false pour une string vide", () => {
    expect(isModuleActive("" as SiteModule, [SiteModule.GROSSISSEMENT])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SITE_TOGGLEABLE_MODULES — egal a SITE_MODULES_CONFIG (ADR-022)
// ---------------------------------------------------------------------------

describe("SITE_TOGGLEABLE_MODULES — tous les modules sont site-level", () => {
  it("est identique a SITE_MODULES_CONFIG", () => {
    expect(SITE_TOGGLEABLE_MODULES).toBe(SITE_MODULES_CONFIG);
  });

  it("contient exactement 9 modules", () => {
    expect(SITE_TOGGLEABLE_MODULES).toHaveLength(9);
  });

  it("tous les elements ont level === 'site'", () => {
    expect(SITE_TOGGLEABLE_MODULES.every((m) => m.level === "site")).toBe(true);
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

  it("contient PACKS_PROVISIONING", () => {
    const values = SITE_TOGGLEABLE_MODULES.map((m) => m.value);
    expect(values).toContain(SiteModule.PACKS_PROVISIONING);
  });
});

// ---------------------------------------------------------------------------
// SITE_MODULES_CONFIG — contient tous les 9 modules
// ---------------------------------------------------------------------------

describe("SITE_MODULES_CONFIG — configuration complete des modules", () => {
  it("contient exactement 9 modules site-level", () => {
    expect(SITE_MODULES_CONFIG).toHaveLength(9);
  });

  it("tous les modules ont level === 'site'", () => {
    const siteModules = SITE_MODULES_CONFIG.filter((m) => m.level === "site");
    expect(siteModules).toHaveLength(9);
  });

  it("chaque entree possede les proprietes value, labelKey, icon et level", () => {
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

  it("toutes les valeurs level sont 'site'", () => {
    expect(SITE_MODULES_CONFIG.every((m) => m.level === "site")).toBe(true);
  });
});
