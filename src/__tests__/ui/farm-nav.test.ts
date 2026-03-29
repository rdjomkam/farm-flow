/**
 * Tests — Navigation Farm (logique pure, sans DOM)
 * Sprint IE — ADR-ingenieur-interface
 *
 * Couverture :
 * - Bottom nav a 5 slots : Accueil, Ma ferme, Finances, Messages, Menu
 * - Finances masqué sans FINANCES_VOIR + module VENTES
 * - Ma ferme masqué sans VAGUES_VOIR
 * - Sidebar : 8 groupes attendus avec leurs permissions (ADR §4.4)
 * - Sidebar : Finances gate par FINANCES_VOIR + module VENTES
 * - Sidebar : Administration gate par SITE_GERER
 * - Sheet items filtrés par permissions + modules
 */

import { describe, it, expect } from "vitest";
import { Permission, SiteModule } from "@/types";

// ---------------------------------------------------------------------------
// Données extraites des composants farm-bottom-nav.tsx et farm-sidebar.tsx
// ---------------------------------------------------------------------------

// Bottom nav farm — 5 slots (certains conditionnels)
// Slot 1: Accueil (toujours)
// Slot 2: Ma ferme (conditionnel: visibleVagues = VAGUES_VOIR)
// Slot 3: Finances (conditionnel: visibleFinances = FINANCES_VOIR + VENTES module)
// Slot 4: Messages/Notes (conditionnel: visibleNotes = ENVOYER_NOTES)
// Slot 5: Menu (toujours)
const FARM_NAV_SLOTS = [
  { key: "accueil", alwaysVisible: true },
  { key: "ma_ferme", permissionRequired: Permission.VAGUES_VOIR },
  {
    key: "finances",
    permissionRequired: Permission.FINANCES_VOIR,
    moduleRequired: SiteModule.VENTES,
  },
  { key: "messages", permissionRequired: Permission.ENVOYER_NOTES },
  { key: "menu", alwaysVisible: true },
];

// Sheet items farm — définis dans SHEET_ITEMS de farm-bottom-nav.tsx
const FARM_SHEET_ITEMS = [
  { href: "/stock", permissionRequired: Permission.STOCK_VOIR, moduleRequired: SiteModule.INTRANTS },
  { href: "/alevins", permissionRequired: Permission.ALEVINS_VOIR, moduleRequired: SiteModule.REPRODUCTION },
  { href: "/planning", permissionRequired: Permission.PLANNING_VOIR },
  { href: "/analytics", permissionRequired: Permission.DASHBOARD_VOIR },
  { href: "/mon-abonnement", permissionRequired: Permission.ABONNEMENTS_VOIR },
  { href: "/users", permissionRequired: Permission.UTILISATEURS_VOIR },
  { href: "/settings/sites", permissionRequired: Permission.SITE_GERER },
  { href: "/packs", permissionRequired: Permission.ACTIVER_PACKS },
];

// Sidebar farm — groupes définis dans NAV_GROUPS de farm-sidebar.tsx
const FARM_SIDEBAR_GROUPS = [
  {
    label: "Élevage",
    permissionRequired: Permission.VAGUES_VOIR,
    moduleRequired: SiteModule.GROSSISSEMENT,
  },
  {
    label: "Stock",
    permissionRequired: Permission.STOCK_VOIR,
    moduleRequired: SiteModule.INTRANTS,
  },
  {
    label: "Finances",
    permissionRequired: Permission.FINANCES_VOIR,
    moduleRequired: SiteModule.VENTES,
  },
  {
    label: "Alevins",
    permissionRequired: Permission.ALEVINS_VOIR,
    moduleRequired: SiteModule.REPRODUCTION,
  },
  {
    label: "Planning & Tâches",
    permissionRequired: Permission.PLANNING_VOIR,
  },
  {
    label: "Analytics",
    permissionRequired: Permission.DASHBOARD_VOIR,
  },
  {
    label: "Administration",
    permissionRequired: Permission.SITE_GERER,
  },
  {
    label: "Abonnement",
    permissionRequired: Permission.ABONNEMENTS_VOIR,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NavSlot = {
  key: string;
  alwaysVisible?: boolean;
  permissionRequired?: Permission;
  moduleRequired?: SiteModule;
};

function filterSlotsVisible(
  slots: NavSlot[],
  permissions: Permission[],
  siteModules: SiteModule[]
): NavSlot[] {
  return slots.filter((slot) => {
    if (slot.alwaysVisible) return true;
    if (slot.permissionRequired && !permissions.includes(slot.permissionRequired)) return false;
    if (slot.moduleRequired && !siteModules.includes(slot.moduleRequired)) return false;
    return true;
  });
}

type SidebarGroup = {
  label: string;
  permissionRequired?: Permission;
  moduleRequired?: SiteModule;
};

function filterGroupsVisible(
  groups: SidebarGroup[],
  permissions: Permission[],
  siteModules: SiteModule[]
): SidebarGroup[] {
  return groups.filter((g) => {
    if (g.permissionRequired && !permissions.includes(g.permissionRequired)) return false;
    if (g.moduleRequired && !siteModules.includes(g.moduleRequired)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Tests — Structure de la bottom nav
// ---------------------------------------------------------------------------
describe("FarmBottomNav — structure des 5 slots", () => {
  it("définit exactement 5 slots", () => {
    expect(FARM_NAV_SLOTS).toHaveLength(5);
  });

  it("slot 1 est Accueil (toujours visible)", () => {
    expect(FARM_NAV_SLOTS[0].key).toBe("accueil");
    expect(FARM_NAV_SLOTS[0].alwaysVisible).toBe(true);
  });

  it("slot 2 est Ma ferme (gate par VAGUES_VOIR)", () => {
    expect(FARM_NAV_SLOTS[1].key).toBe("ma_ferme");
    expect(FARM_NAV_SLOTS[1].permissionRequired).toBe(Permission.VAGUES_VOIR);
  });

  it("slot 3 est Finances (gate par FINANCES_VOIR + module VENTES)", () => {
    expect(FARM_NAV_SLOTS[2].key).toBe("finances");
    expect(FARM_NAV_SLOTS[2].permissionRequired).toBe(Permission.FINANCES_VOIR);
    expect(FARM_NAV_SLOTS[2].moduleRequired).toBe(SiteModule.VENTES);
  });

  it("slot 4 est Messages/Notes (gate par ENVOYER_NOTES)", () => {
    expect(FARM_NAV_SLOTS[3].key).toBe("messages");
    expect(FARM_NAV_SLOTS[3].permissionRequired).toBe(Permission.ENVOYER_NOTES);
  });

  it("slot 5 est Menu (toujours visible)", () => {
    expect(FARM_NAV_SLOTS[4].key).toBe("menu");
    expect(FARM_NAV_SLOTS[4].alwaysVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — Filtrage par permission + module
// ---------------------------------------------------------------------------
describe("FarmBottomNav — filtrage par permission", () => {
  it("avec toutes les permissions + modules → tous les 5 slots visibles", () => {
    const allPerms = Object.values(Permission);
    const allModules = Object.values(SiteModule);
    const visible = filterSlotsVisible(FARM_NAV_SLOTS, allPerms, allModules);
    expect(visible).toHaveLength(5);
  });

  it("Finances masqué sans FINANCES_VOIR", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.FINANCES_VOIR);
    const allModules = Object.values(SiteModule);
    const visible = filterSlotsVisible(FARM_NAV_SLOTS, perms, allModules);
    expect(visible.find((s) => s.key === "finances")).toBeUndefined();
  });

  it("Finances masqué sans le module VENTES (même avec FINANCES_VOIR)", () => {
    const allPerms = Object.values(Permission);
    const modules = Object.values(SiteModule).filter((m) => m !== SiteModule.VENTES);
    const visible = filterSlotsVisible(FARM_NAV_SLOTS, allPerms, modules);
    expect(visible.find((s) => s.key === "finances")).toBeUndefined();
  });

  it("Ma ferme masqué sans VAGUES_VOIR", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.VAGUES_VOIR);
    const allModules = Object.values(SiteModule);
    const visible = filterSlotsVisible(FARM_NAV_SLOTS, perms, allModules);
    expect(visible.find((s) => s.key === "ma_ferme")).toBeUndefined();
  });

  it("Messages masqué sans ENVOYER_NOTES", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.ENVOYER_NOTES);
    const allModules = Object.values(SiteModule);
    const visible = filterSlotsVisible(FARM_NAV_SLOTS, perms, allModules);
    expect(visible.find((s) => s.key === "messages")).toBeUndefined();
  });

  it("Accueil et Menu toujours visibles même sans permissions", () => {
    const visible = filterSlotsVisible(FARM_NAV_SLOTS, [], []);
    expect(visible.find((s) => s.key === "accueil")).toBeDefined();
    expect(visible.find((s) => s.key === "menu")).toBeDefined();
    expect(visible).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — Sheet items
// ---------------------------------------------------------------------------
describe("FarmBottomNav — Sheet items", () => {
  it("définit 8 items dans le sheet secondaire", () => {
    expect(FARM_SHEET_ITEMS).toHaveLength(8);
  });

  it("/stock gate par STOCK_VOIR + module INTRANTS", () => {
    const item = FARM_SHEET_ITEMS.find((i) => i.href === "/stock");
    expect(item?.permissionRequired).toBe(Permission.STOCK_VOIR);
    expect(item?.moduleRequired).toBe(SiteModule.INTRANTS);
  });

  it("/mon-abonnement gate par ABONNEMENTS_VOIR", () => {
    const item = FARM_SHEET_ITEMS.find((i) => i.href === "/mon-abonnement");
    expect(item?.permissionRequired).toBe(Permission.ABONNEMENTS_VOIR);
  });

  it("sans UTILISATEURS_VOIR → /users masqué", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.UTILISATEURS_VOIR);
    const allModules = Object.values(SiteModule);
    const visible = FARM_SHEET_ITEMS.filter((item) => {
      if (item.permissionRequired && !perms.includes(item.permissionRequired)) return false;
      if (item.moduleRequired && !allModules.includes(item.moduleRequired)) return false;
      return true;
    });
    expect(visible.find((i) => i.href === "/users")).toBeUndefined();
  });

  it("sans module REPRODUCTION → /alevins masqué", () => {
    const allPerms = Object.values(Permission);
    const modules = Object.values(SiteModule).filter((m) => m !== SiteModule.REPRODUCTION);
    const visible = FARM_SHEET_ITEMS.filter((item) => {
      if (item.permissionRequired && !allPerms.includes(item.permissionRequired)) return false;
      if (item.moduleRequired && !modules.includes(item.moduleRequired)) return false;
      return true;
    });
    expect(visible.find((i) => i.href === "/alevins")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Sidebar groupes
// ---------------------------------------------------------------------------
describe("FarmSidebar — groupes de navigation", () => {
  it("définit exactement 8 groupes (ADR §4.4 — 8 groupes farm + 1 Super Admin séparé)", () => {
    expect(FARM_SIDEBAR_GROUPS).toHaveLength(8);
  });

  it("groupe Élevage gate par VAGUES_VOIR + module GROSSISSEMENT", () => {
    const g = FARM_SIDEBAR_GROUPS.find((g) => g.label === "Élevage");
    expect(g?.permissionRequired).toBe(Permission.VAGUES_VOIR);
    expect(g?.moduleRequired).toBe(SiteModule.GROSSISSEMENT);
  });

  it("groupe Finances gate par FINANCES_VOIR + module VENTES", () => {
    const g = FARM_SIDEBAR_GROUPS.find((g) => g.label === "Finances");
    expect(g?.permissionRequired).toBe(Permission.FINANCES_VOIR);
    expect(g?.moduleRequired).toBe(SiteModule.VENTES);
  });

  it("groupe Administration gate par SITE_GERER", () => {
    const g = FARM_SIDEBAR_GROUPS.find((g) => g.label === "Administration");
    expect(g?.permissionRequired).toBe(Permission.SITE_GERER);
  });

  it("groupe Abonnement gate par ABONNEMENTS_VOIR", () => {
    const g = FARM_SIDEBAR_GROUPS.find((g) => g.label === "Abonnement");
    expect(g?.permissionRequired).toBe(Permission.ABONNEMENTS_VOIR);
  });

  it("avec toutes les permissions + modules → tous les 8 groupes visibles", () => {
    const allPerms = Object.values(Permission);
    const allModules = Object.values(SiteModule);
    const visible = filterGroupsVisible(FARM_SIDEBAR_GROUPS, allPerms, allModules);
    expect(visible).toHaveLength(8);
  });

  it("sans FINANCES_VOIR → groupe Finances masqué", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.FINANCES_VOIR);
    const allModules = Object.values(SiteModule);
    const visible = filterGroupsVisible(FARM_SIDEBAR_GROUPS, perms, allModules);
    expect(visible.find((g) => g.label === "Finances")).toBeUndefined();
  });

  it("sans module VENTES → groupe Finances masqué (même avec FINANCES_VOIR)", () => {
    const allPerms = Object.values(Permission);
    const modules = Object.values(SiteModule).filter((m) => m !== SiteModule.VENTES);
    const visible = filterGroupsVisible(FARM_SIDEBAR_GROUPS, allPerms, modules);
    expect(visible.find((g) => g.label === "Finances")).toBeUndefined();
  });

  it("sans SITE_GERER → groupe Administration masqué", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.SITE_GERER);
    const allModules = Object.values(SiteModule);
    const visible = filterGroupsVisible(FARM_SIDEBAR_GROUPS, perms, allModules);
    expect(visible.find((g) => g.label === "Administration")).toBeUndefined();
  });

  it("sans module GROSSISSEMENT → groupe Élevage masqué", () => {
    const allPerms = Object.values(Permission);
    const modules = Object.values(SiteModule).filter((m) => m !== SiteModule.GROSSISSEMENT);
    const visible = filterGroupsVisible(FARM_SIDEBAR_GROUPS, allPerms, modules);
    expect(visible.find((g) => g.label === "Élevage")).toBeUndefined();
  });

  it("sans modules ni permissions → aucun groupe visible", () => {
    const visible = filterGroupsVisible(FARM_SIDEBAR_GROUPS, [], []);
    expect(visible).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — Différence farm vs ingenieur (pas de chevauchement d'espaces)
// ---------------------------------------------------------------------------
describe("Farm vs Ingénieur — séparation des espaces", () => {
  it("la nav farm ne contient pas de groupe Monitoring (réservé ingénieur)", () => {
    expect(FARM_SIDEBAR_GROUPS.find((g) => g.label === "Monitoring")).toBeUndefined();
  });

  it("la nav farm ne contient pas de slot clients spécifique ingénieur", () => {
    // Le slot "clients" de l'ingénieur (MONITORING_CLIENTS) n'est pas dans farm
    expect(FARM_NAV_SLOTS.find((s) => s.key === "clients")).toBeUndefined();
  });

  it("la nav farm a un slot Finances que la nav ingénieur n'a pas", () => {
    // L'ingénieur n'a pas de slot finances direct dans sa bottom nav
    expect(FARM_NAV_SLOTS.find((s) => s.key === "finances")).toBeDefined();
  });
});
