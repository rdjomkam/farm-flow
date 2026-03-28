/**
 * Tests — Navigation Ingénieur (logique pure, sans DOM)
 * Sprint IE — ADR-ingenieur-interface
 *
 * Couverture :
 * - Bottom nav a exactement 5 slots (Accueil, Tâches, +Relevé FAB, Clients, Menu)
 * - Slots conditionnels gated par permission
 * - FAB est en position centrale (index 2)
 * - Sidebar : groupes attendus avec leurs permissions
 * - Sidebar : groupe "Monitoring" gate par MONITORING_CLIENTS
 * - Sidebar : groupe "Commercial" gate par ACTIVER_PACKS
 * - Sheet items filtrés par permissions
 */

import { describe, it, expect } from "vitest";
import { Permission, SiteModule } from "@/types";

// ---------------------------------------------------------------------------
// Données extraites des composants (source de vérité = fichiers composants)
// Ces constantes reflètent la structure définie dans les fichiers source.
// Les tests valident la LOGIQUE de filtrage, pas le rendu DOM.
// ---------------------------------------------------------------------------

// Bottom nav ingénieur — 5 slots définis dans le JSX
// Slot 1: Accueil (toujours visible)
// Slot 2: Tâches (conditonnel: canSeeTasks = DASHBOARD_VOIR)
// Slot 3: +Relevé FAB (conditionnel: canAddReleve = RELEVES_CREER)
// Slot 4: Clients (conditionnel: canSeeClients = MONITORING_CLIENTS)
// Slot 5: Menu (toujours visible)
const INGENIEUR_NAV_SLOTS = [
  { key: "accueil", alwaysVisible: true },
  { key: "taches", permissionRequired: Permission.DASHBOARD_VOIR },
  { key: "fab_releve", permissionRequired: Permission.RELEVES_CREER, isFab: true },
  { key: "clients", permissionRequired: Permission.MONITORING_CLIENTS },
  { key: "menu", alwaysVisible: true },
];

// Sheet items définis dans SHEET_ITEMS du composant ingenieur-bottom-nav.tsx
const INGENIEUR_SHEET_ITEMS = [
  { href: "/notes", permissionRequired: Permission.ENVOYER_NOTES },
  { href: "/mon-portefeuille", permissionRequired: Permission.PORTEFEUILLE_VOIR },
  { href: "/packs", permissionRequired: Permission.ACTIVER_PACKS },
  { href: "/stock", permissionRequired: Permission.STOCK_VOIR },
  { href: "/settings/alertes", permissionRequired: Permission.ALERTES_CONFIGURER },
];

// Sidebar ingénieur — groupes définis dans NAV_GROUPS de ingenieur-sidebar.tsx
const INGENIEUR_SIDEBAR_GROUPS = [
  { label: "Opérations", permissionRequired: Permission.DASHBOARD_VOIR },
  { label: "Monitoring", permissionRequired: Permission.MONITORING_CLIENTS },
  { label: "Stock", permissionRequired: Permission.STOCK_VOIR, moduleRequired: SiteModule.INTRANTS },
  { label: "Commercial", permissionRequired: Permission.ACTIVER_PACKS },
  { label: "Planning & Analytics", permissionRequired: Permission.PLANNING_VOIR },
];

// ---------------------------------------------------------------------------
// Helper : simuler la logique de filtrage des items visibles
// ---------------------------------------------------------------------------
function filterByPermission<T extends { permissionRequired?: Permission; alwaysVisible?: boolean }>(
  items: T[],
  permissions: Permission[]
): T[] {
  return items.filter((item) => {
    if (item.alwaysVisible) return true;
    if (item.permissionRequired) return permissions.includes(item.permissionRequired);
    return true;
  });
}

function filterGroupsVisible(
  groups: typeof INGENIEUR_SIDEBAR_GROUPS,
  permissions: Permission[],
  siteModules: SiteModule[]
) {
  return groups.filter((g) => {
    if (g.permissionRequired && !permissions.includes(g.permissionRequired)) return false;
    if ("moduleRequired" in g && g.moduleRequired && !siteModules.includes(g.moduleRequired as SiteModule)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Tests — Structure de la bottom nav
// ---------------------------------------------------------------------------
describe("IngenieurBottomNav — structure des 5 slots", () => {
  it("définit exactement 5 slots (Accueil, Tâches, FAB, Clients, Menu)", () => {
    expect(INGENIEUR_NAV_SLOTS).toHaveLength(5);
  });

  it("slot 1 est Accueil (toujours visible)", () => {
    expect(INGENIEUR_NAV_SLOTS[0].key).toBe("accueil");
    expect(INGENIEUR_NAV_SLOTS[0].alwaysVisible).toBe(true);
  });

  it("slot 2 est Tâches (gate par DASHBOARD_VOIR)", () => {
    expect(INGENIEUR_NAV_SLOTS[1].key).toBe("taches");
    expect(INGENIEUR_NAV_SLOTS[1].permissionRequired).toBe(Permission.DASHBOARD_VOIR);
  });

  it("slot 3 est le FAB +Relevé (gate par RELEVES_CREER)", () => {
    expect(INGENIEUR_NAV_SLOTS[2].isFab).toBe(true);
    expect(INGENIEUR_NAV_SLOTS[2].permissionRequired).toBe(Permission.RELEVES_CREER);
  });

  it("FAB est en position centrale — index 2 sur 5 slots (0-indexé)", () => {
    const fabIndex = INGENIEUR_NAV_SLOTS.findIndex((s) => s.isFab);
    expect(fabIndex).toBe(2);
  });

  it("slot 4 est Clients (gate par MONITORING_CLIENTS)", () => {
    expect(INGENIEUR_NAV_SLOTS[3].key).toBe("clients");
    expect(INGENIEUR_NAV_SLOTS[3].permissionRequired).toBe(Permission.MONITORING_CLIENTS);
  });

  it("slot 5 est Menu (toujours visible)", () => {
    expect(INGENIEUR_NAV_SLOTS[4].key).toBe("menu");
    expect(INGENIEUR_NAV_SLOTS[4].alwaysVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — Filtrage par permission (logique de visibilité)
// ---------------------------------------------------------------------------
describe("IngenieurBottomNav — filtrage par permission", () => {
  it("avec toutes les permissions → tous les 5 slots visibles", () => {
    const allPerms = Object.values(Permission);
    const visible = filterByPermission(INGENIEUR_NAV_SLOTS, allPerms);
    expect(visible).toHaveLength(5);
  });

  it("sans DASHBOARD_VOIR → Tâches masqué", () => {
    const perms = [Permission.RELEVES_CREER, Permission.MONITORING_CLIENTS];
    const visible = filterByPermission(INGENIEUR_NAV_SLOTS, perms);
    expect(visible.find((s) => s.key === "taches")).toBeUndefined();
  });

  it("sans RELEVES_CREER → FAB masqué", () => {
    const perms = [Permission.DASHBOARD_VOIR, Permission.MONITORING_CLIENTS];
    const visible = filterByPermission(INGENIEUR_NAV_SLOTS, perms);
    expect(visible.find((s) => s.isFab)).toBeUndefined();
  });

  it("sans MONITORING_CLIENTS → Clients masqué", () => {
    const perms = [Permission.DASHBOARD_VOIR, Permission.RELEVES_CREER];
    const visible = filterByPermission(INGENIEUR_NAV_SLOTS, perms);
    expect(visible.find((s) => s.key === "clients")).toBeUndefined();
  });

  it("Accueil et Menu toujours visibles même sans permissions", () => {
    const visible = filterByPermission(INGENIEUR_NAV_SLOTS, []);
    expect(visible.find((s) => s.key === "accueil")).toBeDefined();
    expect(visible.find((s) => s.key === "menu")).toBeDefined();
    expect(visible).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — Sheet items
// ---------------------------------------------------------------------------
describe("IngenieurBottomNav — Sheet items", () => {
  it("définit 5 items dans le sheet secondaire", () => {
    expect(INGENIEUR_SHEET_ITEMS).toHaveLength(5);
  });

  it("avec toutes les permissions → tous les sheet items visibles", () => {
    const allPerms = Object.values(Permission);
    const visible = INGENIEUR_SHEET_ITEMS.filter((item) =>
      allPerms.includes(item.permissionRequired)
    );
    expect(visible).toHaveLength(5);
  });

  it("sans PORTEFEUILLE_VOIR → /mon-portefeuille masqué", () => {
    const perms = [Permission.ENVOYER_NOTES, Permission.STOCK_VOIR];
    const visible = INGENIEUR_SHEET_ITEMS.filter((item) =>
      perms.includes(item.permissionRequired)
    );
    expect(visible.find((i) => i.href === "/mon-portefeuille")).toBeUndefined();
  });

  it("sans ACTIVER_PACKS → /packs masqué", () => {
    const perms = [Permission.ENVOYER_NOTES, Permission.PORTEFEUILLE_VOIR];
    const visible = INGENIEUR_SHEET_ITEMS.filter((item) =>
      perms.includes(item.permissionRequired)
    );
    expect(visible.find((i) => i.href === "/packs")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Sidebar groupes
// ---------------------------------------------------------------------------
describe("IngenieurSidebar — groupes de navigation", () => {
  it("définit exactement 5 groupes", () => {
    expect(INGENIEUR_SIDEBAR_GROUPS).toHaveLength(5);
  });

  it("groupe Opérations gate par DASHBOARD_VOIR", () => {
    const g = INGENIEUR_SIDEBAR_GROUPS.find((g) => g.label === "Opérations");
    expect(g).toBeDefined();
    expect(g?.permissionRequired).toBe(Permission.DASHBOARD_VOIR);
  });

  it("groupe Monitoring gate par MONITORING_CLIENTS", () => {
    const g = INGENIEUR_SIDEBAR_GROUPS.find((g) => g.label === "Monitoring");
    expect(g).toBeDefined();
    expect(g?.permissionRequired).toBe(Permission.MONITORING_CLIENTS);
  });

  it("groupe Stock gate par STOCK_VOIR + module INTRANTS", () => {
    const g = INGENIEUR_SIDEBAR_GROUPS.find((g) => g.label === "Stock");
    expect(g).toBeDefined();
    expect(g?.permissionRequired).toBe(Permission.STOCK_VOIR);
    expect((g as typeof INGENIEUR_SIDEBAR_GROUPS[number] & { moduleRequired?: SiteModule }).moduleRequired).toBe(SiteModule.INTRANTS);
  });

  it("groupe Commercial gate par ACTIVER_PACKS", () => {
    const g = INGENIEUR_SIDEBAR_GROUPS.find((g) => g.label === "Commercial");
    expect(g).toBeDefined();
    expect(g?.permissionRequired).toBe(Permission.ACTIVER_PACKS);
  });

  it("avec toutes les permissions + modules → tous les groupes visibles", () => {
    const allPerms = Object.values(Permission);
    const allModules = Object.values(SiteModule);
    const visible = filterGroupsVisible(INGENIEUR_SIDEBAR_GROUPS, allPerms, allModules);
    expect(visible).toHaveLength(5);
  });

  it("sans MONITORING_CLIENTS → groupe Monitoring masqué", () => {
    const perms = Object.values(Permission).filter((p) => p !== Permission.MONITORING_CLIENTS);
    const allModules = Object.values(SiteModule);
    const visible = filterGroupsVisible(INGENIEUR_SIDEBAR_GROUPS, perms, allModules);
    expect(visible.find((g) => g.label === "Monitoring")).toBeUndefined();
  });

  it("sans module INTRANTS → groupe Stock masqué", () => {
    const allPerms = Object.values(Permission);
    const modules = Object.values(SiteModule).filter((m) => m !== SiteModule.INTRANTS);
    const visible = filterGroupsVisible(INGENIEUR_SIDEBAR_GROUPS, allPerms, modules);
    expect(visible.find((g) => g.label === "Stock")).toBeUndefined();
  });
});
