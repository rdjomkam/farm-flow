/**
 * Tests unitaires — Permissions (CR-009 Dynamic Roles)
 *
 * Couvre :
 * - SYSTEM_ROLE_DEFINITIONS : 3 definitions, Administrateur=34, Gerant=32, Pisciculteur=6
 * - canAssignRole() : anti-escalation par sur-ensemble
 * - PERMISSION_GROUPS : 9 groupes, 34 permissions, pas de doublons
 * - ForbiddenError : status 403, name, message, instanceof Error
 * - requirePermission() : auth + membership via siteRole imbriqué + AuthContext CR-009
 */

import { NextRequest } from "next/server";
import { Role, Permission } from "@/types";
import {
  SYSTEM_ROLE_DEFINITIONS,
  canAssignRole,
  PERMISSION_GROUPS,
  ForbiddenError,
  requirePermission,
} from "@/lib/permissions";
import { ITEM_VIEW_PERMISSIONS } from "@/lib/permissions-constants";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.fn();
const mockGetSiteMember = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

vi.mock("@/lib/queries/sites", () => ({
  getSiteMember: (...args: unknown[]) => mockGetSiteMember(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url = "/api/test"): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const ALL_PERMISSIONS = Object.values(Permission);

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    email: "test@example.com",
    phone: null,
    name: "Test User",
    role: Role.PISCICULTEUR,
    activeSiteId: "site-1",
    ...overrides,
  };
}

const PISC_PERMS = [
  Permission.VAGUES_VOIR,
  Permission.RELEVES_VOIR,
  Permission.RELEVES_CREER,
  Permission.BACS_GERER,
  Permission.DASHBOARD_VOIR,
  Permission.ALERTES_VOIR,
];

const GERANT_PERMS = ALL_PERMISSIONS.filter(
  (p) => p !== Permission.SITE_GERER && p !== Permission.MEMBRES_GERER
);

function makeMember(overrides: Record<string, unknown> = {}) {
  const siteRolePerms: Permission[] = (overrides.siteRolePerms as Permission[]) ?? PISC_PERMS;
  const siteRoleId: string = (overrides.siteRoleId as string) ?? "sr-pisc-1";
  const siteRoleName: string = (overrides.siteRoleName as string) ?? "Pisciculteur";

  const base = {
    id: "member-1",
    userId: "user-1",
    siteId: "site-1",
    siteRoleId,
    siteRole: {
      id: siteRoleId,
      name: siteRoleName,
      permissions: siteRolePerms,
      isSystem: true,
      siteId: "site-1",
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Allow overriding isActive directly
  if (overrides.isActive !== undefined) {
    return { ...base, isActive: overrides.isActive };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===== SYSTEM_ROLE_DEFINITIONS =============================================

describe("SYSTEM_ROLE_DEFINITIONS", () => {
  it("contient exactement 3 definitions", () => {
    expect(SYSTEM_ROLE_DEFINITIONS).toHaveLength(3);
  });

  it("les 3 noms sont Administrateur, Gerant, Pisciculteur", () => {
    const names = SYSTEM_ROLE_DEFINITIONS.map((r) => r.name);
    expect(names).toContain("Administrateur");
    expect(names).toContain("Gerant");
    expect(names).toContain("Pisciculteur");
  });

  describe("Administrateur", () => {
    const adminDef = SYSTEM_ROLE_DEFINITIONS.find((r) => r.name === "Administrateur")!;

    it("a toutes les 27 permissions", () => {
      expect(adminDef.permissions).toHaveLength(ALL_PERMISSIONS.length);
      expect(new Set(adminDef.permissions)).toEqual(new Set(ALL_PERMISSIONS));
    });

    it("a une description", () => {
      expect(adminDef.description).toBeTruthy();
    });
  });

  describe("Gerant", () => {
    const gerantDef = SYSTEM_ROLE_DEFINITIONS.find((r) => r.name === "Gerant")!;

    it("a 25 permissions (tout sauf SITE_GERER et MEMBRES_GERER)", () => {
      expect(gerantDef.permissions).toHaveLength(ALL_PERMISSIONS.length - 2);
    });

    it("n'a pas SITE_GERER", () => {
      expect(gerantDef.permissions).not.toContain(Permission.SITE_GERER);
    });

    it("n'a pas MEMBRES_GERER", () => {
      expect(gerantDef.permissions).not.toContain(Permission.MEMBRES_GERER);
    });

    it("a toutes les autres permissions", () => {
      const expected = ALL_PERMISSIONS.filter(
        (p) => p !== Permission.SITE_GERER && p !== Permission.MEMBRES_GERER
      );
      expect(new Set(gerantDef.permissions)).toEqual(new Set(expected));
    });
  });

  describe("Pisciculteur", () => {
    const piscDef = SYSTEM_ROLE_DEFINITIONS.find((r) => r.name === "Pisciculteur")!;

    it("a exactement 6 permissions", () => {
      expect(piscDef.permissions).toHaveLength(6);
    });

    it("a les 6 permissions attendues", () => {
      expect(piscDef.permissions).toContain(Permission.VAGUES_VOIR);
      expect(piscDef.permissions).toContain(Permission.RELEVES_VOIR);
      expect(piscDef.permissions).toContain(Permission.RELEVES_CREER);
      expect(piscDef.permissions).toContain(Permission.BACS_GERER);
      expect(piscDef.permissions).toContain(Permission.DASHBOARD_VOIR);
      expect(piscDef.permissions).toContain(Permission.ALERTES_VOIR);
    });

    it("n'a pas VAGUES_CREER ni SITE_GERER ni MEMBRES_GERER", () => {
      expect(piscDef.permissions).not.toContain(Permission.VAGUES_CREER);
      expect(piscDef.permissions).not.toContain(Permission.VAGUES_MODIFIER);
      expect(piscDef.permissions).not.toContain(Permission.SITE_GERER);
      expect(piscDef.permissions).not.toContain(Permission.MEMBRES_GERER);
    });
  });
});

// ===== canAssignRole =======================================================

describe("canAssignRole (anti-escalation)", () => {
  it("retourne true quand caller a toutes les permissions du role cible", () => {
    expect(canAssignRole(ALL_PERMISSIONS, PISC_PERMS)).toBe(true);
  });

  it("retourne true quand caller a exactement les memes permissions que le role cible", () => {
    expect(canAssignRole(PISC_PERMS, PISC_PERMS)).toBe(true);
  });

  it("retourne false quand le role cible a une permission que le caller n'a pas", () => {
    const callerPerms = PISC_PERMS; // pas SITE_GERER
    const targetPerms = [Permission.SITE_GERER];
    expect(canAssignRole(callerPerms, targetPerms)).toBe(false);
  });

  it("l'Administrateur peut assigner le role Gerant", () => {
    expect(canAssignRole(ALL_PERMISSIONS, GERANT_PERMS)).toBe(true);
  });

  it("l'Administrateur peut assigner le role Pisciculteur", () => {
    expect(canAssignRole(ALL_PERMISSIONS, PISC_PERMS)).toBe(true);
  });

  it("le Gerant peut assigner le role Pisciculteur", () => {
    expect(canAssignRole(GERANT_PERMS, PISC_PERMS)).toBe(true);
  });

  it("le Gerant ne peut pas assigner le role Administrateur", () => {
    expect(canAssignRole(GERANT_PERMS, ALL_PERMISSIONS)).toBe(false);
  });

  it("le Pisciculteur ne peut assigner aucun role non-vide", () => {
    expect(canAssignRole(PISC_PERMS, [Permission.VAGUES_CREER])).toBe(false);
    expect(canAssignRole(PISC_PERMS, [Permission.SITE_GERER])).toBe(false);
  });

  it("retourne true quand le role cible n'a aucune permission", () => {
    expect(canAssignRole(PISC_PERMS, [])).toBe(true);
  });

  it("retourne false quand une seule permission manque parmi plusieurs", () => {
    // caller a tout sauf SITE_GERER, cible veut SITE_GERER + VAGUES_VOIR
    const callerPerms = GERANT_PERMS; // pas SITE_GERER
    const targetPerms = [Permission.VAGUES_VOIR, Permission.SITE_GERER];
    expect(canAssignRole(callerPerms, targetPerms)).toBe(false);
  });

  it("retourne true pour caller = [] et role cible = []", () => {
    expect(canAssignRole([], [])).toBe(true);
  });
});

// ===== PERMISSION_GROUPS ===================================================

describe("PERMISSION_GROUPS", () => {
  it("contient exactement 14 groupes (Sprint 20 : ajout groupes packs/configElevage/ingenieur)", () => {
    expect(Object.keys(PERMISSION_GROUPS)).toHaveLength(14);
  });

  it("les 14 groupes attendus existent", () => {
    const groupNames = Object.keys(PERMISSION_GROUPS);
    expect(groupNames).toContain("administration");
    expect(groupNames).toContain("elevage");
    expect(groupNames).toContain("stock");
    expect(groupNames).toContain("clients");
    expect(groupNames).toContain("ventes");
    expect(groupNames).toContain("alevins");
    expect(groupNames).toContain("planning");
    expect(groupNames).toContain("finances");
    expect(groupNames).toContain("alertes");
    expect(groupNames).toContain("depenses");
    expect(groupNames).toContain("general");
    // Phase 3 — Sprint 20
    expect(groupNames).toContain("packs");
    expect(groupNames).toContain("configElevage");
    expect(groupNames).toContain("ingenieur");
  });

  it("couvre exactement toutes les permissions sans doublon (39 depuis Sprint 20)", () => {
    const allGroupedPerms = Object.values(PERMISSION_GROUPS).flat();
    expect(allGroupedPerms).toHaveLength(ALL_PERMISSIONS.length);
    expect(new Set(allGroupedPerms).size).toBe(ALL_PERMISSIONS.length);
    expect(new Set(allGroupedPerms)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it("administration contient SITE_GERER et MEMBRES_GERER (2 permissions)", () => {
    expect(PERMISSION_GROUPS.administration).toContain(Permission.SITE_GERER);
    expect(PERMISSION_GROUPS.administration).toContain(Permission.MEMBRES_GERER);
    expect(PERMISSION_GROUPS.administration).toHaveLength(2);
  });

  it("elevage contient 8 permissions dont BACS_MODIFIER et RELEVES_MODIFIER", () => {
    expect(PERMISSION_GROUPS.elevage).toHaveLength(8);
    expect(PERMISSION_GROUPS.elevage).toContain(Permission.VAGUES_VOIR);
    expect(PERMISSION_GROUPS.elevage).toContain(Permission.RELEVES_CREER);
    expect(PERMISSION_GROUPS.elevage).toContain(Permission.BACS_MODIFIER);
    expect(PERMISSION_GROUPS.elevage).toContain(Permission.RELEVES_MODIFIER);
  });

  it("alertes contient ALERTES_VOIR et ALERTES_CONFIGURER (2 permissions)", () => {
    expect(PERMISSION_GROUPS.alertes).toContain(Permission.ALERTES_VOIR);
    expect(PERMISSION_GROUPS.alertes).toContain(Permission.ALERTES_CONFIGURER);
    expect(PERMISSION_GROUPS.alertes).toHaveLength(2);
  });

  it("general contient DASHBOARD_VOIR et EXPORT_DONNEES (2 permissions)", () => {
    expect(PERMISSION_GROUPS.general).toContain(Permission.DASHBOARD_VOIR);
    expect(PERMISSION_GROUPS.general).toContain(Permission.EXPORT_DONNEES);
    expect(PERMISSION_GROUPS.general).toHaveLength(2);
  });

  it("stock contient 4 permissions", () => {
    expect(PERMISSION_GROUPS.stock).toHaveLength(4);
    expect(PERMISSION_GROUPS.stock).toContain(Permission.STOCK_VOIR);
    expect(PERMISSION_GROUPS.stock).toContain(Permission.STOCK_GERER);
    expect(PERMISSION_GROUPS.stock).toContain(Permission.APPROVISIONNEMENT_VOIR);
    expect(PERMISSION_GROUPS.stock).toContain(Permission.APPROVISIONNEMENT_GERER);
  });

  it("clients contient 2 permissions", () => {
    expect(PERMISSION_GROUPS.clients).toHaveLength(2);
    expect(PERMISSION_GROUPS.clients).toContain(Permission.CLIENTS_VOIR);
    expect(PERMISSION_GROUPS.clients).toContain(Permission.CLIENTS_GERER);
  });

  it("ventes contient 5 permissions", () => {
    expect(PERMISSION_GROUPS.ventes).toHaveLength(5);
    expect(PERMISSION_GROUPS.ventes).toContain(Permission.VENTES_VOIR);
    expect(PERMISSION_GROUPS.ventes).toContain(Permission.VENTES_CREER);
    expect(PERMISSION_GROUPS.ventes).toContain(Permission.FACTURES_VOIR);
    expect(PERMISSION_GROUPS.ventes).toContain(Permission.FACTURES_GERER);
    expect(PERMISSION_GROUPS.ventes).toContain(Permission.PAIEMENTS_CREER);
  });
});

// ===== ForbiddenError ======================================================

describe("ForbiddenError", () => {
  it("a le status 403", () => {
    const err = new ForbiddenError("test");
    expect(err.status).toBe(403);
  });

  it("a le name ForbiddenError", () => {
    const err = new ForbiddenError("test");
    expect(err.name).toBe("ForbiddenError");
  });

  it("contient le message passe", () => {
    const err = new ForbiddenError("Permission refusee");
    expect(err.message).toBe("Permission refusee");
  });

  it("est une instance de Error", () => {
    const err = new ForbiddenError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("est une instance de ForbiddenError", () => {
    const err = new ForbiddenError("test");
    expect(err).toBeInstanceOf(ForbiddenError);
  });
});

// ===== requirePermission ===================================================

describe("requirePermission", () => {
  // --- Cas d'erreur ---

  it("lance ForbiddenError si pas de site actif", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ activeSiteId: null }));

    await expect(
      requirePermission(makeRequest(), Permission.VAGUES_VOIR)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      requirePermission(makeRequest(), Permission.VAGUES_VOIR)
    ).rejects.toThrow("Aucun site actif selectionne.");
  });

  it("lance ForbiddenError si l'utilisateur n'est pas membre du site", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.GERANT }));
    mockGetSiteMember.mockResolvedValue(null);

    await expect(
      requirePermission(makeRequest(), Permission.VAGUES_VOIR)
    ).rejects.toThrow("Vous n'etes pas membre de ce site.");
  });

  it("lance ForbiddenError si le membre est inactif", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.GERANT }));
    mockGetSiteMember.mockResolvedValue(makeMember({ isActive: false }));

    await expect(
      requirePermission(makeRequest(), Permission.VAGUES_VOIR)
    ).rejects.toThrow("Vous n'etes pas membre de ce site.");
  });

  it("lance ForbiddenError si siteRole est absent du membre", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.GERANT }));
    // membre actif mais sans siteRole (ne devrait pas arriver en prod, mais cas defensif)
    mockGetSiteMember.mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      siteId: "site-1",
      siteRoleId: "sr-1",
      siteRole: null,
      isActive: true,
    });

    await expect(
      requirePermission(makeRequest(), Permission.VAGUES_VOIR)
    ).rejects.toThrow(ForbiddenError);
  });

  it("lance ForbiddenError si une permission requise manque", async () => {
    mockRequireAuth.mockResolvedValue(makeSession());
    mockGetSiteMember.mockResolvedValue(
      makeMember({
        siteRolePerms: [Permission.VAGUES_VOIR],
        siteRoleId: "sr-custom",
        siteRoleName: "Custom",
      })
    );

    await expect(
      requirePermission(makeRequest(), Permission.VAGUES_CREER)
    ).rejects.toThrow("Permission insuffisante.");
  });

  it("lance ForbiddenError si au moins une des permissions requises manque", async () => {
    mockRequireAuth.mockResolvedValue(makeSession());
    mockGetSiteMember.mockResolvedValue(
      makeMember({
        siteRolePerms: [Permission.VAGUES_VOIR, Permission.RELEVES_VOIR],
        siteRoleId: "sr-custom",
        siteRoleName: "Custom",
      })
    );

    // A VAGUES_VOIR mais pas VAGUES_CREER
    await expect(
      requirePermission(
        makeRequest(),
        Permission.VAGUES_VOIR,
        Permission.VAGUES_CREER
      )
    ).rejects.toThrow("Permission insuffisante.");
  });

  // --- Cas de succes ---

  it("retourne AuthContext avec siteRoleId vide et siteRoleName='Super Admin' pour un ADMIN global (bypass membership)", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.ADMIN }));

    const ctx = await requirePermission(
      makeRequest(),
      Permission.SITE_GERER,
      Permission.MEMBRES_GERER
    );

    expect(ctx.globalRole).toBe(Role.ADMIN);
    expect(ctx.siteRoleId).toBe("");
    expect(ctx.siteRoleName).toBe("Super Admin");
    expect(ctx.permissions).toEqual(ALL_PERMISSIONS);
    expect(ctx.activeSiteId).toBe("site-1");
    expect(ctx.userId).toBe("user-1");
    // getSiteMember ne doit PAS etre appele pour un ADMIN global
    expect(mockGetSiteMember).not.toHaveBeenCalled();
  });

  it("retourne AuthContext avec siteRoleId et siteRoleName du membre pour un utilisateur normal", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.GERANT }));
    mockGetSiteMember.mockResolvedValue(
      makeMember({
        siteRoleId: "sr-gerant-1",
        siteRoleName: "Gerant",
        siteRolePerms: GERANT_PERMS,
      })
    );

    const ctx = await requirePermission(
      makeRequest(),
      Permission.VAGUES_VOIR,
      Permission.VAGUES_CREER
    );

    expect(ctx.globalRole).toBe(Role.GERANT);
    expect(ctx.siteRoleId).toBe("sr-gerant-1");
    expect(ctx.siteRoleName).toBe("Gerant");
    expect(ctx.permissions).toEqual(GERANT_PERMS);
    expect(ctx.userId).toBe("user-1");
    expect(ctx.activeSiteId).toBe("site-1");
  });

  it("retourne AuthContext sans permissions requises (membership seule)", async () => {
    mockRequireAuth.mockResolvedValue(makeSession());
    mockGetSiteMember.mockResolvedValue(
      makeMember({
        siteRoleId: "sr-pisc-1",
        siteRoleName: "Pisciculteur",
        siteRolePerms: [Permission.DASHBOARD_VOIR],
      })
    );

    // Aucune permission requise — juste verifier la membership
    const ctx = await requirePermission(makeRequest());
    expect(ctx.userId).toBe("user-1");
    expect(ctx.siteRoleId).toBe("sr-pisc-1");
    expect(ctx.siteRoleName).toBe("Pisciculteur");
  });

  it("passe le request a requireAuth", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.ADMIN }));

    const req = makeRequest("/api/vagues");
    await requirePermission(req, Permission.VAGUES_VOIR);

    expect(mockRequireAuth).toHaveBeenCalledWith(req);
  });

  it("passe siteId et userId a getSiteMember", async () => {
    mockRequireAuth.mockResolvedValue(
      makeSession({
        role: Role.GERANT,
        userId: "user-42",
        activeSiteId: "site-99",
      })
    );
    mockGetSiteMember.mockResolvedValue(
      makeMember({
        userId: "user-42",
        siteRoleId: "sr-gerant-1",
        siteRoleName: "Gerant",
        siteRolePerms: GERANT_PERMS,
      })
    );

    await requirePermission(makeRequest(), Permission.VAGUES_VOIR);

    expect(mockGetSiteMember).toHaveBeenCalledWith("site-99", "user-42");
  });

  it("retourne email, phone et name du session dans le contexte", async () => {
    mockRequireAuth.mockResolvedValue(
      makeSession({
        role: Role.ADMIN,
        email: "admin@ferme.cm",
        phone: "+237691234567",
      })
    );

    const ctx = await requirePermission(makeRequest());
    expect(ctx.email).toBe("admin@ferme.cm");
    expect(ctx.phone).toBe("+237691234567");
    expect(ctx.name).toBe("Test User");
  });

  it("AuthContext n'a pas de propriete siteRole (ancienne API supprimee)", async () => {
    mockRequireAuth.mockResolvedValue(makeSession({ role: Role.ADMIN }));

    const ctx = await requirePermission(makeRequest());
    // Verifier que les nouvelles proprietes existent
    expect(ctx).toHaveProperty("siteRoleId");
    expect(ctx).toHaveProperty("siteRoleName");
    // Verifier que l'ancienne propriete plate n'existe pas
    expect(ctx).not.toHaveProperty("siteRole");
  });
});

// ===== ITEM_VIEW_PERMISSIONS ================================================

describe("ITEM_VIEW_PERMISSIONS", () => {
  it("toutes les cles commencent par /", () => {
    for (const key of Object.keys(ITEM_VIEW_PERMISSIONS)) {
      expect(key).toMatch(/^\//);
    }
  });

  it("toutes les valeurs sont des Permission valides", () => {
    for (const val of Object.values(ITEM_VIEW_PERMISSIONS)) {
      expect(ALL_PERMISSIONS).toContain(val);
    }
  });

  it("contient les mappings Grossissement attendus", () => {
    expect(ITEM_VIEW_PERMISSIONS["/bacs"]).toBe(Permission.BACS_GERER);
    expect(ITEM_VIEW_PERMISSIONS["/releves/nouveau"]).toBe(Permission.RELEVES_CREER);
  });

  it("contient les mappings Intrants attendus", () => {
    expect(ITEM_VIEW_PERMISSIONS["/stock/fournisseurs"]).toBe(Permission.APPROVISIONNEMENT_VOIR);
    expect(ITEM_VIEW_PERMISSIONS["/stock/commandes"]).toBe(Permission.APPROVISIONNEMENT_VOIR);
  });

  it("contient les mappings Ventes attendus", () => {
    expect(ITEM_VIEW_PERMISSIONS["/clients"]).toBe(Permission.CLIENTS_VOIR);
    expect(ITEM_VIEW_PERMISSIONS["/factures"]).toBe(Permission.FACTURES_VOIR);
    expect(ITEM_VIEW_PERMISSIONS["/finances"]).toBe(Permission.FINANCES_VOIR);
  });

  it("contient les mappings Analyse & Pilotage attendus", () => {
    expect(ITEM_VIEW_PERMISSIONS["/planning"]).toBe(Permission.PLANNING_VOIR);
    expect(ITEM_VIEW_PERMISSIONS["/planning/nouvelle"]).toBe(Permission.PLANNING_GERER);
    expect(ITEM_VIEW_PERMISSIONS["/analytics/finances"]).toBe(Permission.FINANCES_VOIR);
  });

  it("ne contient pas les items qui heritent du gate module (ex: /vagues, /stock)", () => {
    expect(ITEM_VIEW_PERMISSIONS["/vagues"]).toBeUndefined();
    expect(ITEM_VIEW_PERMISSIONS["/stock"]).toBeUndefined();
    expect(ITEM_VIEW_PERMISSIONS["/analytics"]).toBeUndefined();
  });
});
