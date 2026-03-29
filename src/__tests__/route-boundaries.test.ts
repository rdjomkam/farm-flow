/**
 * Tests — Frontières de routes (farm) vs (ingenieur)
 * Sprint IE — ADR-ingenieur-interface
 *
 * Couverture (filesystem checks) :
 * - Routes farm-exclusives dans (farm)/ et ABSENTES de (ingenieur)/
 * - Routes ingenieur-exclusives dans (ingenieur)/ et ABSENTES de (farm)/
 * - Routes partagées présentes dans les deux groupes (via stubs ou pages)
 *
 * Approche : on vérifie l'existence des répertoires dans le filesystem.
 * Ces tests détectent toute mauvaise migration de pages entre les deux espaces.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "../app");
const FARM = join(ROOT, "(farm)");
const INGENIEUR = join(ROOT, "(ingenieur)");

// Vérification du setup : les deux groupes existent
function farmPath(...segments: string[]) {
  return join(FARM, ...segments);
}
function ingenieurPath(...segments: string[]) {
  return join(INGENIEUR, ...segments);
}

// ---------------------------------------------------------------------------
// 1. Routes farm-exclusives
// Attendues dans (farm)/, absentes de (ingenieur)/
// ---------------------------------------------------------------------------
const FARM_EXCLUSIVE_ROUTES = [
  "finances",
  "ventes",
  "factures",
  "clients",
  "mon-abonnement",
  "users",
];

describe("Routes farm-exclusives — présentes dans (farm)/", () => {
  for (const route of FARM_EXCLUSIVE_ROUTES) {
    it(`(farm)/${route}/ existe`, () => {
      expect(existsSync(farmPath(route))).toBe(true);
    });
  }
});

describe("Routes farm-exclusives — absentes de (ingenieur)/", () => {
  for (const route of FARM_EXCLUSIVE_ROUTES) {
    it(`(ingenieur)/${route}/ n'existe PAS`, () => {
      expect(existsSync(ingenieurPath(route))).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Routes ingénieur-exclusives
// Attendues dans (ingenieur)/, absentes de (farm)/
// ---------------------------------------------------------------------------
const INGENIEUR_EXCLUSIVE_ROUTES = [
  "monitoring",
  "mon-portefeuille",
];

describe("Routes ingénieur-exclusives — présentes dans (ingenieur)/", () => {
  for (const route of INGENIEUR_EXCLUSIVE_ROUTES) {
    it(`(ingenieur)/${route}/ existe`, () => {
      expect(existsSync(ingenieurPath(route))).toBe(true);
    });
  }
});

describe("Routes ingénieur-exclusives — absentes de (farm)/", () => {
  for (const route of INGENIEUR_EXCLUSIVE_ROUTES) {
    it(`(farm)/${route}/ n'existe PAS`, () => {
      expect(existsSync(farmPath(route))).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Routes déplacées à la racine de l'app (Sprint NA — NA.4)
// /packs, /activations, /mes-taches sont à la racine (app root), pas dans (ingenieur)/
// L'accès est contrôlé par checkPagePermission, pas par le middleware.
// ---------------------------------------------------------------------------
describe("Routes app-root — packs, activations, mes-taches (déplacées par NA.4)", () => {
  const APP_ROOT = join(ROOT);

  it("app/packs/ existe (racine)", () => {
    expect(existsSync(join(APP_ROOT, "packs"))).toBe(true);
  });

  it("app/activations/ existe (racine)", () => {
    expect(existsSync(join(APP_ROOT, "activations"))).toBe(true);
  });

  it("app/mes-taches/ existe (racine)", () => {
    expect(existsSync(join(APP_ROOT, "mes-taches"))).toBe(true);
  });

  it("(ingenieur)/packs/ n'existe PAS (déplacé à la racine)", () => {
    expect(existsSync(ingenieurPath("packs"))).toBe(false);
  });

  it("(ingenieur)/activations/ n'existe PAS (déplacé à la racine)", () => {
    expect(existsSync(ingenieurPath("activations"))).toBe(false);
  });

  it("(ingenieur)/mes-taches/ n'existe PAS (déplacé à la racine)", () => {
    expect(existsSync(ingenieurPath("mes-taches"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Settings — sous-routes correctement séparées
// (ingenieur)/settings/ : regles-activites, config-elevage
// (farm)/settings/ : alertes, sites
// ---------------------------------------------------------------------------
describe("Settings — sous-routes par espace", () => {
  it("(ingenieur)/settings/regles-activites/ existe", () => {
    expect(existsSync(ingenieurPath("settings", "regles-activites"))).toBe(true);
  });

  it("(ingenieur)/settings/config-elevage/ existe", () => {
    expect(existsSync(ingenieurPath("settings", "config-elevage"))).toBe(true);
  });

  it("(farm)/settings/alertes/ existe", () => {
    expect(existsSync(farmPath("settings", "alertes"))).toBe(true);
  });

  it("(farm)/settings/sites/ existe", () => {
    expect(existsSync(farmPath("settings", "sites"))).toBe(true);
  });

  it("(farm)/settings/regles-activites/ n'existe PAS (réservé ingénieur)", () => {
    expect(existsSync(farmPath("settings", "regles-activites"))).toBe(false);
  });

  it("(farm)/settings/config-elevage/ n'existe PAS (réservé ingénieur)", () => {
    expect(existsSync(farmPath("settings", "config-elevage"))).toBe(false);
  });

  it("(ingenieur)/settings/sites/ n'existe PAS (réservé farm)", () => {
    expect(existsSync(ingenieurPath("settings", "sites"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Route groups eux-mêmes ont un layout.tsx
// ---------------------------------------------------------------------------
describe("Route groups — layout.tsx présent", () => {
  it("(farm)/layout.tsx existe", () => {
    expect(existsSync(farmPath("layout.tsx"))).toBe(true);
  });

  it("(ingenieur)/layout.tsx existe", () => {
    expect(existsSync(ingenieurPath("layout.tsx"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Routes partagées dans (farm)/ — vagues, stock, bacs, notes, planning, analytics
// (Les routes partagées sont sous (farm)/ — l'espace ingénieur y accède via
//  la navigation sans ses propres copies de pages)
// ---------------------------------------------------------------------------
const SHARED_IN_FARM = [
  "vagues",
  "stock",
  "bacs",
  "notes",
  "planning",
  "analytics",
];

describe("Routes partagées — présentes dans (farm)/", () => {
  for (const route of SHARED_IN_FARM) {
    it(`(farm)/${route}/ existe`, () => {
      expect(existsSync(farmPath(route))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Cohérence du middleware — INGENIEUR_ONLY_PREFIXES alignés avec le FS
// Le middleware bloque /monitoring et /mon-portefeuille pour les non-ingénieurs.
// Ces routes doivent exister dans (ingenieur)/.
// ---------------------------------------------------------------------------
const MIDDLEWARE_INGENIEUR_ONLY = ["monitoring", "mon-portefeuille"];

describe("Cohérence middleware/FS — INGENIEUR_ONLY_PREFIXES", () => {
  for (const route of MIDDLEWARE_INGENIEUR_ONLY) {
    it(`Route middleware-protégée (ingenieur)/${route}/ existe dans le FS`, () => {
      expect(existsSync(ingenieurPath(route))).toBe(true);
    });
  }
});
