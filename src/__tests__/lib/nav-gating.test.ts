/**
 * Tests — nav-gating.ts
 * Sprint NB — Navigation Phase 2: Restructuration
 *
 * Couverture :
 * - isNavItemVisible : bypass superAdmin, superAdminOnly, alwaysVisible, module gate,
 *   permissions ANY (OR), permissions ALL (AND), null/undefined guards
 * - isGroupVisible : groupe vide, gatePermission, gatePermissionsAny, gateModule,
 *   bypass superAdmin, groupe dont tous les items sont masqués
 * - getVisibleGroups : filtrage des groupes et items, ordre préservé
 * - getVisibleBottomNavItems : délégation à isNavItemVisible
 * - formatBadgeCount : 0, 1, 99, 100, NaN, Infinity, négatif
 */

import { describe, it, expect } from "vitest";
import { Permission, SiteModule } from "@/types";
import {
  isNavItemVisible,
  isGroupVisible,
  getVisibleGroups,
  getVisibleBottomNavItems,
  formatBadgeCount,
  NavItem,
  NavGroup,
} from "@/lib/nav-gating";

// ---------------------------------------------------------------------------
// Helpers — constructeurs de fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<NavItem> = {}): NavItem {
  return {
    id: "test-item",
    labelKey: "nav.test",
    href: "/test",
    icon: "Home",
    ...overrides,
  };
}

function makeGroup(overrides: Partial<NavGroup> = {}): NavGroup {
  return {
    id: "test-group",
    labelKey: "nav.group",
    items: [makeItem()],
    ...overrides,
  };
}

// Utilisateur standard sans permissions ni modules
const NO_PERMS: Permission[] = [];
const NO_MODULES: SiteModule[] = [];

// ---------------------------------------------------------------------------
// isNavItemVisible
// ---------------------------------------------------------------------------

describe("isNavItemVisible", () => {
  describe("superAdmin bypass", () => {
    it("retourne true pour superAdmin quelle que soit la config de l'item", () => {
      const item = makeItem({
        superAdminOnly: false,
        requiredModule: SiteModule.VENTES,
        requiredPermissions: [Permission.FINANCES_VOIR],
        requiredPermissionsAll: [Permission.FINANCES_GERER],
      });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, true)).toBe(true);
    });

    it("superAdmin voit les items superAdminOnly", () => {
      const item = makeItem({ superAdminOnly: true });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, true)).toBe(true);
    });

    it("superAdmin voit les items avec module non activé", () => {
      const item = makeItem({ requiredModule: SiteModule.VENTES });
      expect(isNavItemVisible(item, NO_PERMS, [], true)).toBe(true);
    });
  });

  describe("superAdminOnly", () => {
    it("masque l'item pour un utilisateur non superAdmin", () => {
      const item = makeItem({ superAdminOnly: true });
      expect(
        isNavItemVisible(item, [Permission.SITE_GERER], NO_MODULES, false)
      ).toBe(false);
    });

    it("masque l'item même si l'utilisateur a toutes les permissions", () => {
      const allPerms = Object.values(Permission);
      const item = makeItem({ superAdminOnly: true });
      expect(isNavItemVisible(item, allPerms, NO_MODULES, false)).toBe(false);
    });
  });

  describe("alwaysVisible", () => {
    it("affiche l'item même sans permissions ni modules", () => {
      const item = makeItem({ alwaysVisible: true });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(true);
    });

    it("alwaysVisible prend le dessus sur requiredModule absent", () => {
      const item = makeItem({
        alwaysVisible: true,
        requiredModule: SiteModule.VENTES,
      });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(true);
    });

    it("alwaysVisible prend le dessus sur requiredPermissions manquantes", () => {
      const item = makeItem({
        alwaysVisible: true,
        requiredPermissions: [Permission.FINANCES_VOIR],
      });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(true);
    });
  });

  describe("requiredModule gate", () => {
    it("masque l'item si le module requis n'est pas dans userModules", () => {
      const item = makeItem({ requiredModule: SiteModule.VENTES });
      expect(
        isNavItemVisible(item, [Permission.VENTES_VOIR], NO_MODULES, false)
      ).toBe(false);
    });

    it("affiche l'item si le module requis est activé", () => {
      const item = makeItem({ requiredModule: SiteModule.VENTES });
      expect(
        isNavItemVisible(
          item,
          [Permission.VENTES_VOIR],
          [SiteModule.VENTES],
          false
        )
      ).toBe(true);
    });

    it("affiche l'item si requiredModule est absent", () => {
      const item = makeItem();
      expect(
        isNavItemVisible(item, [Permission.VAGUES_VOIR], NO_MODULES, false)
      ).toBe(true);
    });
  });

  describe("requiredPermissions (ANY / OR)", () => {
    it("masque l'item si aucune des permissions ANY n'est présente", () => {
      const item = makeItem({
        requiredPermissions: [Permission.VENTES_VOIR, Permission.FINANCES_VOIR],
      });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(false);
    });

    it("affiche l'item si au moins une permission ANY est présente", () => {
      const item = makeItem({
        requiredPermissions: [Permission.VENTES_VOIR, Permission.FINANCES_VOIR],
      });
      expect(
        isNavItemVisible(item, [Permission.VENTES_VOIR], NO_MODULES, false)
      ).toBe(true);
    });

    it("affiche l'item si toutes les permissions ANY sont présentes", () => {
      const item = makeItem({
        requiredPermissions: [Permission.VENTES_VOIR, Permission.FINANCES_VOIR],
      });
      expect(
        isNavItemVisible(
          item,
          [Permission.VENTES_VOIR, Permission.FINANCES_VOIR],
          NO_MODULES,
          false
        )
      ).toBe(true);
    });

    it("liste ANY vide n'empêche pas l'affichage", () => {
      const item = makeItem({ requiredPermissions: [] });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(true);
    });
  });

  describe("requiredPermissionsAll (ALL / AND)", () => {
    it("masque l'item si une des permissions ALL est manquante", () => {
      const item = makeItem({
        requiredPermissionsAll: [
          Permission.FINANCES_VOIR,
          Permission.FINANCES_GERER,
        ],
      });
      expect(
        isNavItemVisible(item, [Permission.FINANCES_VOIR], NO_MODULES, false)
      ).toBe(false);
    });

    it("affiche l'item si toutes les permissions ALL sont présentes", () => {
      const item = makeItem({
        requiredPermissionsAll: [
          Permission.FINANCES_VOIR,
          Permission.FINANCES_GERER,
        ],
      });
      expect(
        isNavItemVisible(
          item,
          [Permission.FINANCES_VOIR, Permission.FINANCES_GERER],
          NO_MODULES,
          false
        )
      ).toBe(true);
    });

    it("liste ALL vide n'empêche pas l'affichage", () => {
      const item = makeItem({ requiredPermissionsAll: [] });
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(true);
    });
  });

  describe("combinaison ANY + ALL", () => {
    it("masque si ANY satisfait mais ALL pas satisfait", () => {
      const item = makeItem({
        requiredPermissions: [Permission.STOCK_VOIR],
        requiredPermissionsAll: [Permission.STOCK_VOIR, Permission.STOCK_GERER],
      });
      expect(
        isNavItemVisible(item, [Permission.STOCK_VOIR], NO_MODULES, false)
      ).toBe(false);
    });

    it("affiche si ANY et ALL sont tous deux satisfaits", () => {
      const item = makeItem({
        requiredPermissions: [Permission.STOCK_VOIR],
        requiredPermissionsAll: [Permission.STOCK_VOIR, Permission.STOCK_GERER],
      });
      expect(
        isNavItemVisible(
          item,
          [Permission.STOCK_VOIR, Permission.STOCK_GERER],
          NO_MODULES,
          false
        )
      ).toBe(true);
    });
  });

  describe("null / undefined guards", () => {
    it("accepte userPermissions null sans crash", () => {
      const item = makeItem({
        requiredPermissions: [Permission.VAGUES_VOIR],
      });
      expect(isNavItemVisible(item, null, NO_MODULES, false)).toBe(false);
    });

    it("accepte userPermissions undefined sans crash", () => {
      const item = makeItem({
        requiredPermissions: [Permission.VAGUES_VOIR],
      });
      expect(isNavItemVisible(item, undefined, NO_MODULES, false)).toBe(false);
    });

    it("accepte userModules null sans crash", () => {
      const item = makeItem({ requiredModule: SiteModule.VENTES });
      expect(isNavItemVisible(item, NO_PERMS, null, false)).toBe(false);
    });

    it("accepte userModules undefined sans crash", () => {
      const item = makeItem({ requiredModule: SiteModule.VENTES });
      expect(isNavItemVisible(item, NO_PERMS, undefined, false)).toBe(false);
    });

    it("item sans aucune contrainte est visible par défaut", () => {
      const item = makeItem();
      expect(isNavItemVisible(item, NO_PERMS, NO_MODULES, false)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// isGroupVisible
// ---------------------------------------------------------------------------

describe("isGroupVisible", () => {
  describe("groupe vide", () => {
    it("masque un groupe sans items", () => {
      const group = makeGroup({ items: [] });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, false)).toBe(false);
    });

    it("masque un groupe vide même pour superAdmin", () => {
      const group = makeGroup({ items: [] });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, true)).toBe(false);
    });
  });

  describe("tous les items masqués", () => {
    it("masque le groupe si tous ses items sont masqués", () => {
      const group = makeGroup({
        items: [
          makeItem({ requiredPermissions: [Permission.SITE_GERER] }),
          makeItem({ requiredPermissions: [Permission.MEMBRES_GERER] }),
        ],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, false)).toBe(false);
    });
  });

  describe("gatePermission (portail unique)", () => {
    it("masque le groupe si la permission de portail est absente", () => {
      const group = makeGroup({
        gatePermission: Permission.SITE_GERER,
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, false)).toBe(false);
    });

    it("affiche le groupe si la permission de portail est présente", () => {
      const group = makeGroup({
        gatePermission: Permission.SITE_GERER,
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(
        isGroupVisible(group, [Permission.SITE_GERER], NO_MODULES, false)
      ).toBe(true);
    });

    it("superAdmin bypass le gatePermission", () => {
      const group = makeGroup({
        gatePermission: Permission.SITE_GERER,
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, true)).toBe(true);
    });
  });

  describe("gatePermissionsAny (portail ANY)", () => {
    it("masque le groupe si aucune permission ANY n'est présente", () => {
      const group = makeGroup({
        gatePermissionsAny: [Permission.VENTES_VOIR, Permission.FINANCES_VOIR],
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, false)).toBe(false);
    });

    it("affiche le groupe si au moins une permission ANY est présente", () => {
      const group = makeGroup({
        gatePermissionsAny: [Permission.VENTES_VOIR, Permission.FINANCES_VOIR],
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(
        isGroupVisible(group, [Permission.VENTES_VOIR], NO_MODULES, false)
      ).toBe(true);
    });

    it("superAdmin bypass le gatePermissionsAny", () => {
      const group = makeGroup({
        gatePermissionsAny: [Permission.VENTES_VOIR],
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, true)).toBe(true);
    });
  });

  describe("gateModule (portail module)", () => {
    it("masque le groupe si le module de portail est absent", () => {
      const group = makeGroup({
        gateModule: SiteModule.VENTES,
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, false)).toBe(false);
    });

    it("affiche le groupe si le module de portail est activé", () => {
      const group = makeGroup({
        gateModule: SiteModule.VENTES,
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(
        isGroupVisible(group, NO_PERMS, [SiteModule.VENTES], false)
      ).toBe(true);
    });

    it("superAdmin bypass le gateModule", () => {
      const group = makeGroup({
        gateModule: SiteModule.VENTES,
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, true)).toBe(true);
    });
  });

  describe("cas nominal", () => {
    it("affiche un groupe sans portail si au moins un item est visible", () => {
      const group = makeGroup({
        items: [makeItem({ alwaysVisible: true })],
      });
      expect(isGroupVisible(group, NO_PERMS, NO_MODULES, false)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// getVisibleGroups
// ---------------------------------------------------------------------------

describe("getVisibleGroups", () => {
  it("retourne un tableau vide si aucun groupe n'est visible", () => {
    const groups: NavGroup[] = [
      makeGroup({
        id: "g1",
        gatePermission: Permission.SITE_GERER,
        items: [makeItem({ alwaysVisible: true })],
      }),
    ];
    expect(getVisibleGroups(groups, NO_PERMS, NO_MODULES, false)).toHaveLength(
      0
    );
  });

  it("retourne uniquement les groupes visibles", () => {
    const groups: NavGroup[] = [
      makeGroup({
        id: "g1",
        items: [makeItem({ id: "i1", alwaysVisible: true })],
      }),
      makeGroup({
        id: "g2",
        gatePermission: Permission.SITE_GERER,
        items: [makeItem({ id: "i2", alwaysVisible: true })],
      }),
    ];
    const result = getVisibleGroups(groups, NO_PERMS, NO_MODULES, false);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("g1");
  });

  it("filtre les items non visibles dans chaque groupe", () => {
    const groups: NavGroup[] = [
      makeGroup({
        id: "g1",
        items: [
          makeItem({ id: "visible", alwaysVisible: true }),
          makeItem({
            id: "hidden",
            requiredPermissions: [Permission.SITE_GERER],
          }),
        ],
      }),
    ];
    const result = getVisibleGroups(groups, NO_PERMS, NO_MODULES, false);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].id).toBe("visible");
  });

  it("préserve l'ordre des groupes visibles", () => {
    const groups: NavGroup[] = [
      makeGroup({ id: "g1", items: [makeItem({ id: "i1", alwaysVisible: true })] }),
      makeGroup({ id: "g2", items: [makeItem({ id: "i2", alwaysVisible: true })] }),
      makeGroup({ id: "g3", items: [makeItem({ id: "i3", alwaysVisible: true })] }),
    ];
    const result = getVisibleGroups(groups, NO_PERMS, NO_MODULES, false);
    expect(result.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
  });

  it("superAdmin voit tous les groupes et items", () => {
    const groups: NavGroup[] = [
      makeGroup({
        id: "g1",
        gatePermission: Permission.SITE_GERER,
        items: [
          makeItem({ id: "i1", superAdminOnly: true }),
          makeItem({ id: "i2", requiredPermissions: [Permission.MEMBRES_GERER] }),
        ],
      }),
    ];
    const result = getVisibleGroups(groups, NO_PERMS, NO_MODULES, true);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getVisibleBottomNavItems
// ---------------------------------------------------------------------------

describe("getVisibleBottomNavItems", () => {
  it("retourne uniquement les items visibles", () => {
    const items = [
      makeItem({ id: "accueil", alwaysVisible: true }),
      makeItem({
        id: "finances",
        requiredPermissions: [Permission.FINANCES_VOIR],
        requiredModule: SiteModule.VENTES,
      }),
      makeItem({ id: "menu", alwaysVisible: true }),
    ];
    const result = getVisibleBottomNavItems(items, NO_PERMS, NO_MODULES, false);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["accueil", "menu"]);
  });

  it("retourne tous les items pour superAdmin", () => {
    const items = [
      makeItem({ id: "accueil", alwaysVisible: true }),
      makeItem({
        id: "finances",
        requiredPermissions: [Permission.FINANCES_VOIR],
        requiredModule: SiteModule.VENTES,
      }),
    ];
    const result = getVisibleBottomNavItems(items, NO_PERMS, NO_MODULES, true);
    expect(result).toHaveLength(2);
  });

  it("retourne tableau vide si aucun item visible", () => {
    const items = [
      makeItem({
        id: "admin",
        requiredPermissions: [Permission.SITE_GERER],
      }),
    ];
    const result = getVisibleBottomNavItems(items, NO_PERMS, NO_MODULES, false);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatBadgeCount
// ---------------------------------------------------------------------------

describe("formatBadgeCount", () => {
  it("retourne '' pour count = 0", () => {
    expect(formatBadgeCount(0)).toBe("");
  });

  it("retourne '' pour count négatif", () => {
    expect(formatBadgeCount(-1)).toBe("");
    expect(formatBadgeCount(-100)).toBe("");
  });

  it("retourne '' pour NaN", () => {
    expect(formatBadgeCount(NaN)).toBe("");
  });

  it("retourne '' pour Infinity", () => {
    expect(formatBadgeCount(Infinity)).toBe("");
    expect(formatBadgeCount(-Infinity)).toBe("");
  });

  it("retourne '1' pour count = 1", () => {
    expect(formatBadgeCount(1)).toBe("1");
  });

  it("retourne la valeur string pour les petits comptes", () => {
    expect(formatBadgeCount(5)).toBe("5");
    expect(formatBadgeCount(42)).toBe("42");
  });

  it("retourne '99' pour count = 99", () => {
    expect(formatBadgeCount(99)).toBe("99");
  });

  it("retourne '99+' pour count = 100", () => {
    expect(formatBadgeCount(100)).toBe("99+");
  });

  it("retourne '99+' pour count > 100", () => {
    expect(formatBadgeCount(999)).toBe("99+");
    expect(formatBadgeCount(10000)).toBe("99+");
  });
});
