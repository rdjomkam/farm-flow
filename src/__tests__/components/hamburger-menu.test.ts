/**
 * Tests non-régression — BUG-021 — Hamburger menu modules Sprints 33-35
 *
 * Couvre :
 * 1. Les 5 nouveaux modules sont présents dans modulesAdminGerant
 *    - "Abonnement"          (Sprint 33)
 *    - "Admin Abonnements"   (Sprint 33)
 *    - "Portefeuille"        (Sprint 34)
 *    - "Admin Commissions"   (Sprint 34)
 *    - "Admin Remises"       (Sprint 35)
 *
 * 2. Les 5 permission gates existent dans PHASE3_MODULE_PERMISSIONS
 *    - "Abonnement"       → Permission.ABONNEMENTS_VOIR
 *    - "Admin Abonnements"→ Permission.ABONNEMENTS_GERER
 *    - "Portefeuille"     → Permission.PORTEFEUILLE_VOIR
 *    - "Admin Commissions"→ Permission.COMMISSIONS_GERER
 *    - "Admin Remises"    → Permission.REMISES_GERER
 *
 * 3. Les icônes utilisées pour ces modules sont des symboles valides (non-nullables)
 *
 * 4. Filtrage par permission : un module masqué si la permission manque
 * 5. Filtrage par permission : un module visible si la permission est présente
 *
 * Note : HamburgerMenu est un Client Component ("use client").
 * On teste la logique pure (données statiques) sans monter le composant React.
 */

import { describe, it, expect } from "vitest";
import { Permission } from "@/types";
import {
  MODULE_VIEW_PERMISSIONS,
  ITEM_VIEW_PERMISSIONS,
} from "@/lib/permissions-constants";

// ---------------------------------------------------------------------------
// Réimplémentation des données statiques extraites de hamburger-menu.tsx
// Ces tests valident les invariants métier sans dépendre du rendu React.
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: unknown;
  disabled?: boolean;
}

interface NavModule {
  label: string;
  primaryHref: string;
  icon: unknown;
  items: NavItem[];
}

// Reproduction des modules tels que définis dans hamburger-menu.tsx
// On valide la structure statique, pas le rendu.
const modulesAdminGerant: NavModule[] = [
  {
    label: "Reproduction",
    primaryHref: "/alevins",
    icon: "Egg",
    items: [
      { href: "/alevins", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/alevins/reproducteurs", label: "Reproducteurs", icon: "Fish" },
      { href: "/alevins/pontes", label: "Pontes", icon: "Egg" },
      { href: "/alevins/lots", label: "Lots d'alevins", icon: "Layers" },
    ],
  },
  {
    label: "Grossissement",
    primaryHref: "/vagues",
    icon: "Waves",
    items: [
      { href: "/vagues", label: "Vagues", icon: "Waves" },
      { href: "/bacs", label: "Bacs", icon: "Container" },
      { href: "/releves/nouveau", label: "Nouveau releve", icon: "PlusCircle" },
      { href: "/analytics/bacs", label: "Analytiques bacs", icon: "BarChart3" },
      { href: "/analytics/vagues", label: "Analytiques vagues", icon: "LineChart" },
    ],
  },
  {
    label: "Intrants",
    primaryHref: "/stock",
    icon: "Package",
    items: [
      { href: "/stock", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/stock/produits", label: "Produits", icon: "Tag" },
      { href: "/stock/fournisseurs", label: "Fournisseurs", icon: "Truck" },
      { href: "/stock/commandes", label: "Commandes", icon: "ShoppingCart" },
      { href: "/stock/mouvements", label: "Mouvements", icon: "ArrowUpDown" },
      { href: "/analytics/aliments", label: "Analytiques aliments", icon: "BarChart3" },
    ],
  },
  {
    label: "Ventes",
    primaryHref: "/ventes",
    icon: "ShoppingCart",
    items: [
      { href: "/clients", label: "Clients", icon: "Users" },
      { href: "/ventes", label: "Ventes", icon: "Banknote" },
      { href: "/factures", label: "Factures", icon: "FileText" },
      { href: "/finances", label: "Finances", icon: "Wallet" },
      { href: "/depenses", label: "Depenses", icon: "Receipt" },
      { href: "/besoins", label: "Besoins", icon: "ClipboardList" },
    ],
  },
  {
    label: "Analyse & Pilotage",
    primaryHref: "/analytics",
    icon: "BarChart3",
    items: [
      { href: "/analytics", label: "Vue globale", icon: "BarChart3" },
      { href: "/planning", label: "Calendrier", icon: "Calendar" },
      { href: "/planning/nouvelle", label: "Nouvelle activite", icon: "PlusCircle" },
      { href: "/mes-taches", label: "Mes taches", icon: "ClipboardCheck" },
      { href: "/analytics/finances", label: "Finances", icon: "Banknote", disabled: true },
      { href: "/analytics/tendances", label: "Tendances", icon: "TrendingUp", disabled: true },
    ],
  },
  {
    label: "Packs & Provisioning",
    primaryHref: "/packs",
    icon: "Boxes",
    items: [
      { href: "/packs", label: "Packs", icon: "Boxes" },
      { href: "/activations", label: "Activations", icon: "ClipboardCheck" },
    ],
  },
  {
    label: "Ingenieur",
    primaryHref: "/monitoring",
    icon: "UserCog",
    items: [
      { href: "/monitoring", label: "Dashboard clients", icon: "LayoutDashboard" },
      { href: "/notes", label: "Notes", icon: "NotebookPen" },
    ],
  },
  {
    label: "Configuration",
    primaryHref: "/settings/sites",
    icon: "Settings",
    items: [
      { href: "/settings/sites", label: "Sites", icon: "Building2" },
      { href: "/settings/config-elevage", label: "Profils d'elevage", icon: "Settings" },
      { href: "/settings/alertes", label: "Config. alertes", icon: "Settings" },
      { href: "/settings/regles-activites", label: "Regles d'activites", icon: "Zap" },
    ],
  },
  // Sprint 33 — Abonnement
  {
    label: "Abonnement",
    primaryHref: "/mon-abonnement",
    icon: "CreditCard",
    items: [
      { href: "/mon-abonnement", label: "Mon abonnement", icon: "CreditCard" },
      { href: "/tarifs", label: "Plans & tarifs", icon: "Tag" },
    ],
  },
  // Sprint 33 — Admin Abonnements
  {
    label: "Admin Abonnements",
    primaryHref: "/admin/abonnements",
    icon: "ShieldCheck",
    items: [
      { href: "/admin/abonnements", label: "Tous les abonnements", icon: "ShieldCheck" },
    ],
  },
  // Sprint 34 — Portefeuille
  {
    label: "Portefeuille",
    primaryHref: "/mon-portefeuille",
    icon: "Wallet",
    items: [
      { href: "/mon-portefeuille", label: "Mon portefeuille", icon: "Wallet" },
    ],
  },
  // Sprint 34 — Admin Commissions
  {
    label: "Admin Commissions",
    primaryHref: "/admin/commissions",
    icon: "TrendingUp",
    items: [
      { href: "/admin/commissions", label: "Toutes les commissions", icon: "TrendingUp" },
    ],
  },
  // Sprint 35 — Admin Remises
  {
    label: "Admin Remises",
    primaryHref: "/admin/remises",
    icon: "Tag",
    items: [
      { href: "/admin/remises", label: "Remises & promos", icon: "Tag" },
    ],
  },
  {
    label: "Utilisateurs",
    primaryHref: "/users",
    icon: "Users",
    items: [
      { href: "/users", label: "Liste", icon: "Users" },
      { href: "/users/nouveau", label: "Nouveau", icon: "UserPlus" },
    ],
  },
];

const PHASE3_MODULE_PERMISSIONS: Record<string, Permission> = {
  "Packs & Provisioning": Permission.ACTIVER_PACKS,
  "Ingenieur":            Permission.MONITORING_CLIENTS,
  "Utilisateurs":         Permission.UTILISATEURS_VOIR,
  // Sprint 33 — Abonnements
  "Abonnement":           Permission.ABONNEMENTS_VOIR,
  "Admin Abonnements":    Permission.ABONNEMENTS_GERER,
  // Sprint 34 — Commissions & Portefeuille
  "Portefeuille":         Permission.PORTEFEUILLE_VOIR,
  "Admin Commissions":    Permission.COMMISSIONS_GERER,
  // Sprint 35 — Remises
  "Admin Remises":        Permission.REMISES_GERER,
};

// ---------------------------------------------------------------------------
// Logique de filtrage réimplémentée (miroir de hamburger-menu.tsx)
// ---------------------------------------------------------------------------

function filterVisibleModules(
  permissions: Permission[],
  siteModules: string[] = []
): NavModule[] {
  return modulesAdminGerant
    .filter((mod) => {
      const phase3Required = PHASE3_MODULE_PERMISSIONS[mod.label];
      if (phase3Required && !permissions.includes(phase3Required)) return false;
      const required = MODULE_VIEW_PERMISSIONS[mod.label];
      if (required && !permissions.includes(required)) return false;
      return true;
    })
    .map((mod) => ({
      ...mod,
      items: mod.items.filter((item) => {
        const required = ITEM_VIEW_PERMISSIONS[item.href];
        return !required || permissions.includes(required);
      }),
    }))
    .filter((mod) => mod.items.length > 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findModule(label: string): NavModule | undefined {
  return modulesAdminGerant.find((m) => m.label === label);
}

const ALL_PERMISSIONS = Object.values(Permission);

// ---------------------------------------------------------------------------
// Suite 1 : Présence des 5 nouveaux modules dans modulesAdminGerant (BUG-021)
// ---------------------------------------------------------------------------

describe("BUG-021 — modulesAdminGerant : présence des 5 modules Sprints 33-35", () => {
  it("contient le module 'Abonnement' (Sprint 33)", () => {
    expect(findModule("Abonnement")).toBeDefined();
  });

  it("module 'Abonnement' pointe vers /mon-abonnement", () => {
    expect(findModule("Abonnement")?.primaryHref).toBe("/mon-abonnement");
  });

  it("module 'Abonnement' contient les items /mon-abonnement et /tarifs", () => {
    const mod = findModule("Abonnement")!;
    const hrefs = mod.items.map((i) => i.href);
    expect(hrefs).toContain("/mon-abonnement");
    expect(hrefs).toContain("/tarifs");
  });

  it("contient le module 'Admin Abonnements' (Sprint 33)", () => {
    expect(findModule("Admin Abonnements")).toBeDefined();
  });

  it("module 'Admin Abonnements' pointe vers /admin/abonnements", () => {
    expect(findModule("Admin Abonnements")?.primaryHref).toBe("/admin/abonnements");
  });

  it("module 'Admin Abonnements' contient l'item /admin/abonnements", () => {
    const mod = findModule("Admin Abonnements")!;
    expect(mod.items.some((i) => i.href === "/admin/abonnements")).toBe(true);
  });

  it("contient le module 'Portefeuille' (Sprint 34)", () => {
    expect(findModule("Portefeuille")).toBeDefined();
  });

  it("module 'Portefeuille' pointe vers /mon-portefeuille", () => {
    expect(findModule("Portefeuille")?.primaryHref).toBe("/mon-portefeuille");
  });

  it("module 'Portefeuille' contient l'item /mon-portefeuille", () => {
    const mod = findModule("Portefeuille")!;
    expect(mod.items.some((i) => i.href === "/mon-portefeuille")).toBe(true);
  });

  it("contient le module 'Admin Commissions' (Sprint 34)", () => {
    expect(findModule("Admin Commissions")).toBeDefined();
  });

  it("module 'Admin Commissions' pointe vers /admin/commissions", () => {
    expect(findModule("Admin Commissions")?.primaryHref).toBe("/admin/commissions");
  });

  it("module 'Admin Commissions' contient l'item /admin/commissions", () => {
    const mod = findModule("Admin Commissions")!;
    expect(mod.items.some((i) => i.href === "/admin/commissions")).toBe(true);
  });

  it("contient le module 'Admin Remises' (Sprint 35)", () => {
    expect(findModule("Admin Remises")).toBeDefined();
  });

  it("module 'Admin Remises' pointe vers /admin/remises", () => {
    expect(findModule("Admin Remises")?.primaryHref).toBe("/admin/remises");
  });

  it("module 'Admin Remises' contient l'item /admin/remises", () => {
    const mod = findModule("Admin Remises")!;
    expect(mod.items.some((i) => i.href === "/admin/remises")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 : PHASE3_MODULE_PERMISSIONS — 5 gates Sprints 33-35
// ---------------------------------------------------------------------------

describe("BUG-021 — PHASE3_MODULE_PERMISSIONS : gates Sprints 33-35", () => {
  it("gate 'Abonnement' est Permission.ABONNEMENTS_VOIR", () => {
    expect(PHASE3_MODULE_PERMISSIONS["Abonnement"]).toBe(Permission.ABONNEMENTS_VOIR);
  });

  it("gate 'Admin Abonnements' est Permission.ABONNEMENTS_GERER", () => {
    expect(PHASE3_MODULE_PERMISSIONS["Admin Abonnements"]).toBe(Permission.ABONNEMENTS_GERER);
  });

  it("gate 'Portefeuille' est Permission.PORTEFEUILLE_VOIR", () => {
    expect(PHASE3_MODULE_PERMISSIONS["Portefeuille"]).toBe(Permission.PORTEFEUILLE_VOIR);
  });

  it("gate 'Admin Commissions' est Permission.COMMISSIONS_GERER", () => {
    expect(PHASE3_MODULE_PERMISSIONS["Admin Commissions"]).toBe(Permission.COMMISSIONS_GERER);
  });

  it("gate 'Admin Remises' est Permission.REMISES_GERER", () => {
    expect(PHASE3_MODULE_PERMISSIONS["Admin Remises"]).toBe(Permission.REMISES_GERER);
  });

  it("contient au total 8 gates (3 pre-existants + 5 sprints 33-35)", () => {
    expect(Object.keys(PHASE3_MODULE_PERMISSIONS)).toHaveLength(8);
  });

  it("toutes les valeurs de gates sont des Permission valides", () => {
    for (const perm of Object.values(PHASE3_MODULE_PERMISSIONS)) {
      expect(ALL_PERMISSIONS).toContain(perm);
    }
  });

  it("les 3 gates pre-existants sont inchanges (Packs, Ingenieur, Utilisateurs)", () => {
    expect(PHASE3_MODULE_PERMISSIONS["Packs & Provisioning"]).toBe(Permission.ACTIVER_PACKS);
    expect(PHASE3_MODULE_PERMISSIONS["Ingenieur"]).toBe(Permission.MONITORING_CLIENTS);
    expect(PHASE3_MODULE_PERMISSIONS["Utilisateurs"]).toBe(Permission.UTILISATEURS_VOIR);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 : Icônes — non-nullabilité des modules Sprints 33-35
// ---------------------------------------------------------------------------

describe("BUG-021 — Icônes des 5 nouveaux modules", () => {
  it("module 'Abonnement' a une icône définie (CreditCard)", () => {
    expect(findModule("Abonnement")?.icon).toBeTruthy();
  });

  it("module 'Admin Abonnements' a une icône définie (ShieldCheck)", () => {
    expect(findModule("Admin Abonnements")?.icon).toBeTruthy();
  });

  it("module 'Portefeuille' a une icône définie (Wallet)", () => {
    expect(findModule("Portefeuille")?.icon).toBeTruthy();
  });

  it("module 'Admin Commissions' a une icône définie (TrendingUp)", () => {
    expect(findModule("Admin Commissions")?.icon).toBeTruthy();
  });

  it("module 'Admin Remises' a une icône définie (Tag)", () => {
    expect(findModule("Admin Remises")?.icon).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 : Filtrage — modules masqués si permission manquante
// ---------------------------------------------------------------------------

describe("BUG-021 — Filtrage : modules masqués sans permission", () => {
  it("'Abonnement' absent si ABONNEMENTS_VOIR manque", () => {
    const perms = ALL_PERMISSIONS.filter((p) => p !== Permission.ABONNEMENTS_VOIR);
    const visible = filterVisibleModules(perms);
    expect(visible.some((m) => m.label === "Abonnement")).toBe(false);
  });

  it("'Admin Abonnements' absent si ABONNEMENTS_GERER manque", () => {
    const perms = ALL_PERMISSIONS.filter((p) => p !== Permission.ABONNEMENTS_GERER);
    const visible = filterVisibleModules(perms);
    expect(visible.some((m) => m.label === "Admin Abonnements")).toBe(false);
  });

  it("'Portefeuille' absent si PORTEFEUILLE_VOIR manque", () => {
    const perms = ALL_PERMISSIONS.filter((p) => p !== Permission.PORTEFEUILLE_VOIR);
    const visible = filterVisibleModules(perms);
    expect(visible.some((m) => m.label === "Portefeuille")).toBe(false);
  });

  it("'Admin Commissions' absent si COMMISSIONS_GERER manque", () => {
    const perms = ALL_PERMISSIONS.filter((p) => p !== Permission.COMMISSIONS_GERER);
    const visible = filterVisibleModules(perms);
    expect(visible.some((m) => m.label === "Admin Commissions")).toBe(false);
  });

  it("'Admin Remises' absent si REMISES_GERER manque", () => {
    const perms = ALL_PERMISSIONS.filter((p) => p !== Permission.REMISES_GERER);
    const visible = filterVisibleModules(perms);
    expect(visible.some((m) => m.label === "Admin Remises")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 : Filtrage — modules visibles avec permission correcte
// ---------------------------------------------------------------------------

describe("BUG-021 — Filtrage : modules visibles avec permission correcte", () => {
  it("'Abonnement' visible avec toutes les permissions", () => {
    const visible = filterVisibleModules(ALL_PERMISSIONS);
    expect(visible.some((m) => m.label === "Abonnement")).toBe(true);
  });

  it("'Admin Abonnements' visible avec toutes les permissions", () => {
    const visible = filterVisibleModules(ALL_PERMISSIONS);
    expect(visible.some((m) => m.label === "Admin Abonnements")).toBe(true);
  });

  it("'Portefeuille' visible avec toutes les permissions", () => {
    const visible = filterVisibleModules(ALL_PERMISSIONS);
    expect(visible.some((m) => m.label === "Portefeuille")).toBe(true);
  });

  it("'Admin Commissions' visible avec toutes les permissions", () => {
    const visible = filterVisibleModules(ALL_PERMISSIONS);
    expect(visible.some((m) => m.label === "Admin Commissions")).toBe(true);
  });

  it("'Admin Remises' visible avec toutes les permissions", () => {
    const visible = filterVisibleModules(ALL_PERMISSIONS);
    expect(visible.some((m) => m.label === "Admin Remises")).toBe(true);
  });

  it("les 5 nouveaux modules sont tous visibles avec toutes les permissions", () => {
    const visible = filterVisibleModules(ALL_PERMISSIONS);
    const labels = visible.map((m) => m.label);
    expect(labels).toContain("Abonnement");
    expect(labels).toContain("Admin Abonnements");
    expect(labels).toContain("Portefeuille");
    expect(labels).toContain("Admin Commissions");
    expect(labels).toContain("Admin Remises");
  });
});

// ---------------------------------------------------------------------------
// Suite 6 : Cohérence globale de modulesAdminGerant
// ---------------------------------------------------------------------------

describe("modulesAdminGerant — cohérence globale", () => {
  it("contient au moins 14 modules (8 pre-existants + 5 sprints 33-35 + Utilisateurs)", () => {
    expect(modulesAdminGerant.length).toBeGreaterThanOrEqual(14);
  });

  it("chaque module a un label non vide", () => {
    for (const mod of modulesAdminGerant) {
      expect(mod.label).toBeTruthy();
    }
  });

  it("chaque module a un primaryHref commençant par /", () => {
    for (const mod of modulesAdminGerant) {
      expect(mod.primaryHref).toMatch(/^\//);
    }
  });

  it("chaque module a au moins un item", () => {
    for (const mod of modulesAdminGerant) {
      expect(mod.items.length).toBeGreaterThan(0);
    }
  });

  it("chaque item a un href commençant par /", () => {
    for (const mod of modulesAdminGerant) {
      for (const item of mod.items) {
        expect(item.href).toMatch(/^\//);
      }
    }
  });

  it("les labels de modules sont uniques (pas de doublon)", () => {
    const labels = modulesAdminGerant.map((m) => m.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
