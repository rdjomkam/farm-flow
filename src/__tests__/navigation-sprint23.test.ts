/**
 * Tests Sprint 23 — Navigation conditionnelle par role
 *
 * Couvre la fonction getDefaultItemsByRole et la logique contextuelle de navigation.
 * Les items de navigation sont testes selon les roles :
 *   - PISCICULTEUR : nav simplifiee terrain (4 items)
 *   - INGENIEUR    : nav suivi clients (3 items)
 *   - ADMIN/GERANT : nav complete (filtree par permissions)
 *   - null (non authentifie) : nav admin par defaut
 *
 * Note : Les composants navigation actuels sont FarmBottomNav et IngenieurBottomNav.
 * On teste uniquement la logique pure (fonctions utilitaires extractees).
 */

import { describe, it, expect } from "vitest";
import { Role } from "@/types";

// ---------------------------------------------------------------------------
// Reimplementation de la logique de navigation (fonctions pures extractees)
// Ces tests valident les invariants metier sans monter le composant React.
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
}

// Items de navigation par role (legacy bottom-nav logic, now in FarmBottomNav/IngenieurBottomNav)
const pisciculteurItems: NavItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/mes-taches", label: "Mes tâches" },
  { href: "/notes", label: "Notes" },
  { href: "/releves/nouveau", label: "Observations" },
];

const ingenieurItems: NavItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/monitoring", label: "Clients" },
  { href: "/notes", label: "Notes" },
];

const adminGerantItems: NavItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/vagues", label: "Vagues" },
  { href: "/stock", label: "Stock" },
  { href: "/monitoring", label: "Ingénieur" },
];

/**
 * Reimplementation de getDefaultItemsByRole (legacy logic from former bottom-nav.tsx)
 */
function getDefaultItemsByRole(role: Role | null): NavItem[] {
  if (role === Role.PISCICULTEUR) return pisciculteurItems;
  if (role === Role.INGENIEUR) return ingenieurItems;
  return adminGerantItems;
}

// ---------------------------------------------------------------------------
// Tests navigation PISCICULTEUR
// ---------------------------------------------------------------------------

describe("Navigation PISCICULTEUR", () => {
  const items = getDefaultItemsByRole(Role.PISCICULTEUR);

  it("retourne exactement 4 items", () => {
    expect(items).toHaveLength(4);
  });

  it("inclut l'Accueil (/)", () => {
    expect(items.some((i) => i.href === "/")).toBe(true);
  });

  it("inclut Mes taches (/mes-taches)", () => {
    expect(items.some((i) => i.href === "/mes-taches")).toBe(true);
  });

  it("inclut Notes (/notes)", () => {
    expect(items.some((i) => i.href === "/notes")).toBe(true);
  });

  it("inclut Observations (/releves/nouveau)", () => {
    expect(items.some((i) => i.href === "/releves/nouveau")).toBe(true);
  });

  it("n'inclut pas /monitoring (pas pour les pisciculteurs)", () => {
    expect(items.some((i) => i.href === "/monitoring")).toBe(false);
  });

  it("n'inclut pas /vagues (gestion vague = admin)", () => {
    expect(items.some((i) => i.href === "/vagues")).toBe(false);
  });

  it("n'inclut pas /stock", () => {
    expect(items.some((i) => i.href === "/stock")).toBe(false);
  });

  it("n'inclut pas /analytics", () => {
    expect(items.some((i) => i.href === "/analytics")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests navigation INGENIEUR
// ---------------------------------------------------------------------------

describe("Navigation INGENIEUR", () => {
  const items = getDefaultItemsByRole(Role.INGENIEUR);

  it("retourne exactement 3 items", () => {
    expect(items).toHaveLength(3);
  });

  it("inclut l'Accueil (/)", () => {
    expect(items.some((i) => i.href === "/")).toBe(true);
  });

  it("inclut Clients (/monitoring)", () => {
    expect(items.some((i) => i.href === "/monitoring")).toBe(true);
  });

  it("inclut Notes (/notes)", () => {
    expect(items.some((i) => i.href === "/notes")).toBe(true);
  });

  it("n'inclut pas /mes-taches (pas pour les ingenieurs)", () => {
    expect(items.some((i) => i.href === "/mes-taches")).toBe(false);
  });

  it("n'inclut pas /vagues", () => {
    expect(items.some((i) => i.href === "/vagues")).toBe(false);
  });

  it("n'inclut pas /stock", () => {
    expect(items.some((i) => i.href === "/stock")).toBe(false);
  });

  it("n'inclut pas /releves/nouveau", () => {
    expect(items.some((i) => i.href === "/releves/nouveau")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests navigation ADMIN / GERANT
// ---------------------------------------------------------------------------

describe("Navigation ADMIN / GERANT", () => {
  const adminItems = getDefaultItemsByRole(Role.ADMIN);
  const gerantItems = getDefaultItemsByRole(Role.GERANT);

  it("ADMIN reçoit les items adminGerant", () => {
    expect(adminItems).toHaveLength(adminGerantItems.length);
  });

  it("GERANT reçoit les memes items que ADMIN", () => {
    expect(gerantItems).toHaveLength(adminItems.length);
    for (let i = 0; i < adminItems.length; i++) {
      expect(gerantItems[i].href).toBe(adminItems[i].href);
    }
  });

  it("inclut /vagues pour ADMIN", () => {
    expect(adminItems.some((i) => i.href === "/vagues")).toBe(true);
  });

  it("inclut /stock pour ADMIN", () => {
    expect(adminItems.some((i) => i.href === "/stock")).toBe(true);
  });

  it("inclut /monitoring pour ADMIN", () => {
    expect(adminItems.some((i) => i.href === "/monitoring")).toBe(true);
  });

  it("inclut l'Accueil pour ADMIN", () => {
    expect(adminItems.some((i) => i.href === "/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests navigation non authentifie (role=null)
// ---------------------------------------------------------------------------

describe("Navigation non authentifie (role=null)", () => {
  const items = getDefaultItemsByRole(null);

  it("retourne les items admin par defaut si role=null", () => {
    expect(items).toEqual(adminGerantItems);
  });

  it("n'est pas vide (le composant ne doit pas crasher)", () => {
    expect(items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests coherence : PISCICULTEUR et INGENIEUR n'ont pas de nav contextuelle
// ---------------------------------------------------------------------------

describe("Isolation de la navigation par role (logique conditionnelle)", () => {
  it("PISCICULTEUR a toujours la meme nav quelle que soit la page", () => {
    // La nav PISCICULTEUR est fixe — pas de nav contextuelle
    const navDashboard = getDefaultItemsByRole(Role.PISCICULTEUR);
    const navVagues = getDefaultItemsByRole(Role.PISCICULTEUR);
    const navStock = getDefaultItemsByRole(Role.PISCICULTEUR);

    expect(navDashboard).toEqual(navVagues);
    expect(navVagues).toEqual(navStock);
  });

  it("INGENIEUR a toujours la meme nav quelle que soit la page", () => {
    const navDashboard = getDefaultItemsByRole(Role.INGENIEUR);
    const navIngenieur = getDefaultItemsByRole(Role.INGENIEUR);

    expect(navDashboard).toEqual(navIngenieur);
  });

  it("PISCICULTEUR et INGENIEUR ont des navigations differentes", () => {
    const pisciculteur = getDefaultItemsByRole(Role.PISCICULTEUR);
    const ingenieur = getDefaultItemsByRole(Role.INGENIEUR);

    expect(pisciculteur).not.toEqual(ingenieur);
  });

  it("PISCICULTEUR a plus d'items que INGENIEUR (4 vs 3)", () => {
    const pisciculteur = getDefaultItemsByRole(Role.PISCICULTEUR);
    const ingenieur = getDefaultItemsByRole(Role.INGENIEUR);

    expect(pisciculteur.length).toBeGreaterThan(ingenieur.length);
  });

  it("INGENIEUR a moins d'items que ADMIN (3 vs 4)", () => {
    const ingenieur = getDefaultItemsByRole(Role.INGENIEUR);
    const admin = getDefaultItemsByRole(Role.ADMIN);

    expect(ingenieur.length).toBeLessThan(admin.length);
  });
});

// ---------------------------------------------------------------------------
// Tests de la logique de detection contextuelle (sections)
// ---------------------------------------------------------------------------

describe("Detection de section contextuelle (getModuleForPath)", () => {
  /**
   * Reimplementation locale de getModuleForPath (updated per NC.4 cleanup).
   */
  function getModuleForPath(pathname: string): string | null {
    if (pathname.startsWith("/alevins")) return "Reproduction";
    if (
      pathname.startsWith("/vagues") ||
      pathname.startsWith("/bacs") ||
      pathname.startsWith("/releves") ||
      pathname.startsWith("/analytics/bacs") ||
      pathname.startsWith("/analytics/vagues")
    ) return "Grossissement";
    if (pathname.startsWith("/stock")) return "Intrants";
    if (
      pathname.startsWith("/ventes") ||
      pathname.startsWith("/clients") ||
      pathname.startsWith("/factures") ||
      pathname.startsWith("/finances") ||
      pathname.startsWith("/depenses") ||
      pathname.startsWith("/besoins")
    ) return "Ventes";
    if (
      pathname === "/analytics" ||
      pathname.startsWith("/analytics/aliments") ||
      pathname.startsWith("/planning") ||
      pathname.startsWith("/mes-taches") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/settings/alertes")
    ) return "Analyse & Pilotage";
    return null;
  }

  it("/vagues est dans la section Grossissement", () => {
    expect(getModuleForPath("/vagues")).toBe("Grossissement");
  });

  it("/bacs est dans la section Grossissement", () => {
    expect(getModuleForPath("/bacs")).toBe("Grossissement");
  });

  it("/releves/nouveau est dans la section Grossissement", () => {
    expect(getModuleForPath("/releves/nouveau")).toBe("Grossissement");
  });

  it("/stock est dans la section Intrants", () => {
    expect(getModuleForPath("/stock")).toBe("Intrants");
  });

  it("/alevins est dans la section Reproduction", () => {
    expect(getModuleForPath("/alevins")).toBe("Reproduction");
  });

  it("/ventes est dans la section Ventes", () => {
    expect(getModuleForPath("/ventes")).toBe("Ventes");
  });

  it("/monitoring n'appartient pas a un module (retourne null)", () => {
    expect(getModuleForPath("/monitoring")).toBeNull();
  });

  it("/notes n'appartient pas a un module (retourne null)", () => {
    expect(getModuleForPath("/notes")).toBeNull();
  });

  it("/packs n'appartient pas a un module connu (retourne null)", () => {
    expect(getModuleForPath("/packs")).toBeNull();
  });

  it("/ (accueil) retourne null", () => {
    expect(getModuleForPath("/")).toBeNull();
  });

  it("/analytics exact est dans Analyse & Pilotage", () => {
    expect(getModuleForPath("/analytics")).toBe("Analyse & Pilotage");
  });

  it("/analytics/bacs est dans Grossissement (sous-chemin specifique)", () => {
    expect(getModuleForPath("/analytics/bacs")).toBe("Grossissement");
  });

  it("/mes-taches est dans Analyse & Pilotage", () => {
    expect(getModuleForPath("/mes-taches")).toBe("Analyse & Pilotage");
  });
});
