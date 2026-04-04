/**
 * Tests API — Sites, Membres et Roles (CR-009 Dynamic Roles)
 *
 * Couvre :
 * - GET/POST /api/sites — lister et creer des sites
 * - GET/PUT /api/sites/[id] — detail et modification de site
 * - GET/POST /api/sites/[id]/members — lister et ajouter des membres (siteRoleId)
 * - PUT/DELETE /api/sites/[id]/members/[userId] — modifier role / retirer (siteRoleId)
 * - PUT /api/auth/site — changer le site actif (retourne siteRole object)
 * - GET/POST /api/sites/[id]/roles — CRUD des roles de site
 * - GET/PUT/DELETE /api/sites/[id]/roles/[roleId] — CRUD d'un role individuel
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Role, Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted to avoid TDZ issues with vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  mockRequireAuth,
  mockRequirePermission,
  mockGetUserSites,
  mockCreateSite,
  mockGetSiteById,
  mockUpdateSite,
  mockGetSiteMember,
  mockAddMember,
  mockUpdateMemberSiteRole,
  mockRemoveMember,
  mockGetUserByIdentifier,
  mockSessionUpdateMany,
  mockGetSiteRoles,
  mockGetSiteRoleById,
  mockCreateSiteRole,
  mockUpdateSiteRole,
  mockDeleteSiteRole,
  mockCanAssignRole,
  mockGetQuotaSites,
  mockGetSubscriptionStatus,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetUserSites: vi.fn(),
  mockCreateSite: vi.fn(),
  mockGetSiteById: vi.fn(),
  mockUpdateSite: vi.fn(),
  mockGetSiteMember: vi.fn(),
  mockAddMember: vi.fn(),
  mockUpdateMemberSiteRole: vi.fn(),
  mockRemoveMember: vi.fn(),
  mockGetUserByIdentifier: vi.fn(),
  mockSessionUpdateMany: vi.fn(),
  mockGetSiteRoles: vi.fn(),
  mockGetSiteRoleById: vi.fn(),
  mockCreateSiteRole: vi.fn(),
  mockUpdateSiteRole: vi.fn(),
  mockDeleteSiteRole: vi.fn(),
  mockCanAssignRole: vi.fn(),
  mockGetQuotaSites: vi.fn(),
  mockGetSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
  SESSION_COOKIE_NAME: "session_token",
}));

vi.mock("@/lib/permissions", () => {
  class MockForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  }
  return {
    requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
    ForbiddenError: MockForbiddenError,
    canAssignRole: (...args: unknown[]) => mockCanAssignRole(...args),
  };
});

vi.mock("@/lib/queries/sites", () => ({
  getUserSites: (...args: unknown[]) => mockGetUserSites(...args),
  createSite: (...args: unknown[]) => mockCreateSite(...args),
  getSiteById: (...args: unknown[]) => mockGetSiteById(...args),
  updateSite: (...args: unknown[]) => mockUpdateSite(...args),
  getSiteMember: (...args: unknown[]) => mockGetSiteMember(...args),
  addMember: (...args: unknown[]) => mockAddMember(...args),
  updateMemberSiteRole: (...args: unknown[]) => mockUpdateMemberSiteRole(...args),
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
}));

vi.mock("@/lib/queries/roles", () => ({
  getSiteRoles: (...args: unknown[]) => mockGetSiteRoles(...args),
  getSiteRoleById: (...args: unknown[]) => mockGetSiteRoleById(...args),
  createSiteRole: (...args: unknown[]) => mockCreateSiteRole(...args),
  updateSiteRole: (...args: unknown[]) => mockUpdateSiteRole(...args),
  deleteSiteRole: (...args: unknown[]) => mockDeleteSiteRole(...args),
}));

vi.mock("@/lib/queries/users", () => ({
  getUserByIdentifier: (...args: unknown[]) => mockGetUserByIdentifier(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/lib/abonnements/check-quotas", () => ({
  getQuotaSites: (...args: unknown[]) => mockGetQuotaSites(...args),
}));

vi.mock("@/lib/abonnements/check-subscription", () => ({
  getSubscriptionStatus: (...args: unknown[]) => mockGetSubscriptionStatus(...args),
}));

import { GET as getSites, POST as postSite } from "@/app/api/sites/route";
import {
  GET as getSiteDetail,
  PUT as putSite,
} from "@/app/api/sites/[id]/route";
import {
  GET as getMembers,
  POST as postMember,
} from "@/app/api/sites/[id]/members/route";
import {
  PUT as putMemberRole,
  DELETE as deleteMember,
} from "@/app/api/sites/[id]/members/[userId]/route";
import { PUT as putAuthSite } from "@/app/api/auth/site/route";
import {
  GET as getSiteRolesList,
  POST as postSiteRole,
} from "@/app/api/sites/[id]/roles/route";
import {
  GET as getSiteRoleDetail,
  PUT as putSiteRole,
  DELETE as deleteSiteRole,
} from "@/app/api/sites/[id]/roles/[roleId]/route";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const ALL_PERMISSIONS = Object.values(Permission);

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

const SESSION = {
  userId: "user-admin",
  email: "admin@ferme.cm",
  phone: null,
  name: "Admin Ferme",
  role: Role.ADMIN,
  activeSiteId: "site-1",
};

const now = new Date();

/** Cree un objet membre avec siteRole imbrique (forme CR-009) */
function makeCallerMember(perms: Permission[], isActive = true) {
  return {
    id: "member-caller",
    userId: SESSION.userId,
    siteId: "site-1",
    siteRoleId: "sr-admin-1",
    siteRole: {
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: perms,
      isSystem: true,
      siteId: "site-1",
    },
    isActive,
    createdAt: now,
    updatedAt: now,
  };
}

/** Cree un objet membre cible avec siteRole imbrique */
function makeTargetMember(perms: Permission[], isActive = true) {
  return {
    id: "member-target",
    userId: "user-target",
    siteId: "site-1",
    siteRoleId: "sr-pisc-1",
    siteRole: {
      id: "sr-pisc-1",
      name: "Pisciculteur",
      permissions: perms,
      isSystem: true,
      siteId: "site-1",
    },
    isActive,
    createdAt: now,
    updatedAt: now,
  };
}

/** AuthContext CR-009 retourne par requirePermission */
function makeAuthContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: SESSION.userId,
    email: SESSION.email,
    phone: SESSION.phone,
    name: SESSION.name,
    globalRole: Role.ADMIN,
    activeSiteId: "site-1",
    siteRoleId: "sr-admin-1",
    siteRoleName: "Administrateur",
    permissions: ALL_PERMISSIONS,
    ...overrides,
  };
}

// ===== GET /api/sites ======================================================

describe("GET /api/sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("retourne la liste des sites de l'utilisateur", async () => {
    mockGetUserSites.mockResolvedValue([
      {
        id: "site-1",
        name: "Ferme A",
        address: "Douala",
        isActive: true,
        createdAt: now,
        _count: { members: 3, bacs: 5, vagues: 2 },
      },
    ]);

    const response = await getSites(makeRequest("/api/sites"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sites).toHaveLength(1);
    expect(data.sites[0].name).toBe("Ferme A");
    expect(data.sites[0].memberCount).toBe(3);
    expect(data.total).toBe(1);
  });

  it("retourne 401 sans session", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireAuth.mockRejectedValue(new AuthError("Non authentifie."));

    const response = await getSites(makeRequest("/api/sites"));
    expect(response.status).toBe(401);
  });
});

// ===== POST /api/sites =====================================================

describe("POST /api/sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
    // Default: active subscription with remaining quota
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: "ACTIF",
      daysRemaining: 25,
      planType: "ELEVEUR",
      isDecouverte: false,
    });
    mockGetQuotaSites.mockResolvedValue({ used: 0, limit: 1, remaining: 1 });
  });

  it("cree un site — createSite appele avec (data, userId) sans permissions", async () => {
    mockCreateSite.mockResolvedValue({
      id: "site-new",
      name: "Ferme B",
      address: "Yaounde",
      isActive: true,
      createdAt: now,
    });

    const request = makeRequest("/api/sites", {
      method: "POST",
      body: JSON.stringify({ name: "Ferme B", address: "Yaounde" }),
    });

    const response = await postSite(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Ferme B");
    // CR-009: createSite prend (data, userId) — PAS de permissions en 3e argument
    expect(mockCreateSite).toHaveBeenCalledWith(
      { name: "Ferme B", address: "Yaounde" },
      "user-admin"
    );
  });

  it("retourne 400 si le nom est manquant", async () => {
    const request = makeRequest("/api/sites", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await postSite(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "name")).toBe(true);
  });

  it("retourne 400 si le nom est une chaine vide", async () => {
    const request = makeRequest("/api/sites", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });

    const response = await postSite(request);
    expect(response.status).toBe(400);
  });

  it("retourne 403 si quota de sites atteint", async () => {
    mockGetQuotaSites.mockResolvedValue({ used: 1, limit: 1, remaining: 0 });

    const request = makeRequest("/api/sites", {
      method: "POST",
      body: JSON.stringify({ name: "Ferme C" }),
    });

    const response = await postSite(request);
    expect(response.status).toBe(403);
    expect(mockCreateSite).not.toHaveBeenCalled();
  });

  it("retourne 402 si pas d'abonnement actif", async () => {
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: null,
      daysRemaining: null,
      planType: null,
      isDecouverte: false,
    });

    const request = makeRequest("/api/sites", {
      method: "POST",
      body: JSON.stringify({ name: "Ferme C" }),
    });

    const response = await postSite(request);
    expect(response.status).toBe(402);
    expect(mockCreateSite).not.toHaveBeenCalled();
  });
});

// ===== GET /api/sites/[id] =================================================

describe("GET /api/sites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("retourne le detail du site avec membres (siteRoleId/siteRoleName au lieu de role)", async () => {
    mockGetSiteById.mockResolvedValue({
      id: "site-1",
      name: "Ferme A",
      address: "Douala",
      isActive: true,
      createdAt: now,
      _count: { bacs: 5, vagues: 2 },
      members: [
        {
          id: "m-1",
          user: { id: "user-admin", name: "Admin", email: "admin@ferme.cm", phone: null },
          siteRoleId: "sr-admin-1",
          siteRole: {
            id: "sr-admin-1",
            name: "Administrateur",
            permissions: ALL_PERMISSIONS,
          },
          isActive: true,
          createdAt: now,
        },
      ],
    });

    const response = await getSiteDetail(makeRequest("/api/sites/site-1"), {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Ferme A");
    expect(data.members).toHaveLength(1);
    // CR-009: plus de role plat — siteRoleId et siteRoleName
    expect(data.members[0].siteRoleId).toBe("sr-admin-1");
    expect(data.members[0].siteRoleName).toBe("Administrateur");
  });

  it("retourne 404 si le site est introuvable", async () => {
    mockGetSiteById.mockResolvedValue(null);

    const response = await getSiteDetail(makeRequest("/api/sites/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });
});

// ===== PUT /api/sites/[id] =================================================

describe("PUT /api/sites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("modifie le site quand le membre a SITE_GERER", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
    mockUpdateSite.mockResolvedValue({
      id: "site-1",
      name: "Ferme Modifiee",
      address: "Kribi",
      isActive: true,
      updatedAt: now,
    });

    const request = makeRequest("/api/sites/site-1", {
      method: "PUT",
      body: JSON.stringify({ name: "Ferme Modifiee", address: "Kribi" }),
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Ferme Modifiee");
  });

  it("retourne 403 si pas de permission SITE_GERER", async () => {
    mockGetSiteMember.mockResolvedValue(
      makeCallerMember([Permission.VAGUES_VOIR])
    );

    const request = makeRequest("/api/sites/site-1", {
      method: "PUT",
      body: JSON.stringify({ name: "Hack" }),
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si pas membre du site (getSiteMember retourne null)", async () => {
    mockGetSiteMember.mockResolvedValue(null);

    const request = makeRequest("/api/sites/site-1", {
      method: "PUT",
      body: JSON.stringify({ name: "Hack" }),
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });
});

// ===== GET /api/sites/[id]/members =========================================

describe("GET /api/sites/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("retourne la liste des membres avec siteRoleId et siteRoleName", async () => {
    mockGetSiteById.mockResolvedValue({
      id: "site-1",
      members: [
        {
          id: "m-1",
          user: { id: "user-admin", name: "Admin", email: "admin@ferme.cm", phone: null },
          siteRoleId: "sr-admin-1",
          siteRole: { id: "sr-admin-1", name: "Administrateur" },
          isActive: true,
          createdAt: now,
        },
      ],
    });

    const response = await getMembers(makeRequest("/api/sites/site-1/members"), {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.members).toHaveLength(1);
    expect(data.members[0].siteRoleId).toBe("sr-admin-1");
    expect(data.members[0].siteRoleName).toBe("Administrateur");
    expect(data.total).toBe(1);
  });
});

// ===== POST /api/sites/[id]/members ========================================

describe("POST /api/sites/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("ajoute un membre avec siteRoleId et retourne siteRoleId/siteRoleName", async () => {
    mockGetSiteMember
      .mockResolvedValueOnce(makeCallerMember(ALL_PERMISSIONS)) // caller
      .mockResolvedValueOnce(null); // target not yet a member
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-pisc-1",
      name: "Pisciculteur",
      permissions: PISC_PERMS,
      isSystem: true,
      siteId: "site-1",
    });
    mockCanAssignRole.mockReturnValue(true);
    mockGetUserByIdentifier.mockResolvedValue({
      id: "user-new",
      email: "new@ferme.cm",
      phone: null,
      name: "Nouveau",
    });
    mockAddMember.mockResolvedValue({
      id: "member-new",
      user: { id: "user-new", name: "Nouveau", email: "new@ferme.cm", phone: null },
      siteRoleId: "sr-pisc-1",
      siteRole: {
        id: "sr-pisc-1",
        name: "Pisciculteur",
        permissions: PISC_PERMS,
      },
      isActive: true,
      createdAt: now,
    });

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({
        identifier: "new@ferme.cm",
        siteRoleId: "sr-pisc-1",
      }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.siteRoleId).toBe("sr-pisc-1");
    expect(data.siteRoleName).toBe("Pisciculteur");
    expect(data.name).toBe("Nouveau");
    // addMember doit etre appele avec (siteId, userId, siteRoleId)
    expect(mockAddMember).toHaveBeenCalledWith("site-1", "user-new", "sr-pisc-1");
  });

  it("retourne 403 si le caller n'a pas MEMBRES_GERER", async () => {
    mockGetSiteMember.mockResolvedValue(
      makeCallerMember([Permission.VAGUES_VOIR])
    );

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({
        identifier: "new@ferme.cm",
        siteRoleId: "sr-pisc-1",
      }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si anti-escalation echoue (canAssignRole retourne false)", async () => {
    mockGetSiteMember.mockResolvedValueOnce(
      makeCallerMember([Permission.MEMBRES_GERER, Permission.VAGUES_VOIR])
    );
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
      siteId: "site-1",
    });
    mockCanAssignRole.mockReturnValue(false); // anti-escalation

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({
        identifier: "new@ferme.cm",
        siteRoleId: "sr-admin-1",
      }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 404 si le role cible n'existe pas", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
    mockGetSiteRoleById.mockResolvedValue(null);

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({
        identifier: "new@ferme.cm",
        siteRoleId: "sr-inexistant",
      }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 404 si l'utilisateur n'existe pas", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-pisc-1",
      name: "Pisciculteur",
      permissions: PISC_PERMS,
    });
    mockCanAssignRole.mockReturnValue(true);
    mockGetUserByIdentifier.mockResolvedValue(null);

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({
        identifier: "inexistant@ferme.cm",
        siteRoleId: "sr-pisc-1",
      }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 409 si l'utilisateur est deja membre", async () => {
    mockGetSiteMember
      .mockResolvedValueOnce(makeCallerMember(ALL_PERMISSIONS)) // caller
      .mockResolvedValueOnce({ id: "existing" }); // target already member
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-pisc-1",
      name: "Pisciculteur",
      permissions: PISC_PERMS,
    });
    mockCanAssignRole.mockReturnValue(true);
    mockGetUserByIdentifier.mockResolvedValue({
      id: "user-existing",
      email: "exist@ferme.cm",
    });

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({
        identifier: "exist@ferme.cm",
        siteRoleId: "sr-pisc-1",
      }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("retourne 400 si siteRoleId est manquant", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));

    const request = makeRequest("/api/sites/site-1/members", {
      method: "POST",
      body: JSON.stringify({ identifier: "new@ferme.cm" }),
    });

    const response = await postMember(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
  });
});

// ===== PUT /api/sites/[id]/members/[userId] ================================

describe("PUT /api/sites/[id]/members/[userId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("change le siteRole d'un membre et retourne siteRoleId/siteRoleName", async () => {
    mockGetSiteMember
      .mockResolvedValueOnce(makeCallerMember(ALL_PERMISSIONS)) // caller
      .mockResolvedValueOnce(makeTargetMember(PISC_PERMS)); // target
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-gerant-1",
      name: "Gerant",
      permissions: GERANT_PERMS,
      isSystem: true,
      siteId: "site-1",
    });
    mockCanAssignRole.mockReturnValue(true);
    mockUpdateMemberSiteRole.mockResolvedValue({});

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "PUT",
      body: JSON.stringify({ siteRoleId: "sr-gerant-1" }),
    });

    const response = await putMemberRole(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.siteRoleId).toBe("sr-gerant-1");
    expect(data.siteRoleName).toBe("Gerant");
    expect(mockUpdateMemberSiteRole).toHaveBeenCalledWith(
      "site-1",
      "user-target",
      "sr-gerant-1"
    );
  });

  it("retourne 403 si on tente de modifier son propre role", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));

    const request = makeRequest("/api/sites/site-1/members/user-admin", {
      method: "PUT",
      body: JSON.stringify({ siteRoleId: "sr-gerant-1" }),
    });

    const response = await putMemberRole(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-admin" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si anti-escalation check 1 echoue (target a plus de perms que caller)", async () => {
    mockRequireAuth.mockResolvedValue({
      ...SESSION,
      role: Role.GERANT,
      userId: "user-gerant",
    });
    mockGetSiteMember
      .mockResolvedValueOnce(
        makeCallerMember([Permission.MEMBRES_GERER, Permission.VAGUES_VOIR])
      )
      .mockResolvedValueOnce(makeTargetMember(ALL_PERMISSIONS)); // target a PLUS de perms
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-pisc-1",
      name: "Pisciculteur",
      permissions: PISC_PERMS,
      siteId: "site-1",
    });
    // check 1: caller < target perms => false
    mockCanAssignRole.mockReturnValueOnce(false);

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "PUT",
      body: JSON.stringify({ siteRoleId: "sr-pisc-1" }),
    });

    const response = await putMemberRole(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si anti-escalation check 2 echoue (nouveau role depasse caller)", async () => {
    mockRequireAuth.mockResolvedValue({
      ...SESSION,
      role: Role.GERANT,
      userId: "user-gerant",
    });
    mockGetSiteMember
      .mockResolvedValueOnce(makeCallerMember(GERANT_PERMS))
      .mockResolvedValueOnce(makeTargetMember(PISC_PERMS));
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: ALL_PERMISSIONS,
      siteId: "site-1",
    });
    // check 1 OK, check 2 echoue
    mockCanAssignRole
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "PUT",
      body: JSON.stringify({ siteRoleId: "sr-admin-1" }),
    });

    const response = await putMemberRole(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 404 si le role cible n'existe pas", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
    mockGetSiteRoleById.mockResolvedValue(null);

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "PUT",
      body: JSON.stringify({ siteRoleId: "sr-inexistant" }),
    });

    const response = await putMemberRole(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 400 si siteRoleId est manquant", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "PUT",
      body: JSON.stringify({}),
    });

    const response = await putMemberRole(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });

    expect(response.status).toBe(400);
  });
});

// ===== DELETE /api/sites/[id]/members/[userId] =============================

describe("DELETE /api/sites/[id]/members/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("retire un membre du site", async () => {
    mockGetSiteMember
      .mockResolvedValueOnce(makeCallerMember(ALL_PERMISSIONS))
      .mockResolvedValueOnce(makeTargetMember(PISC_PERMS));
    mockCanAssignRole.mockReturnValue(true);
    mockRemoveMember.mockResolvedValue({});

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "DELETE",
    });

    const response = await deleteMember(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("retourne 403 si on tente de se retirer soi-meme", async () => {
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));

    const request = makeRequest("/api/sites/site-1/members/user-admin", {
      method: "DELETE",
    });

    const response = await deleteMember(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-admin" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si le caller n'a pas MEMBRES_GERER", async () => {
    mockGetSiteMember.mockResolvedValue(
      makeCallerMember([Permission.VAGUES_VOIR])
    );

    const request = makeRequest("/api/sites/site-1/members/user-target", {
      method: "DELETE",
    });

    const response = await deleteMember(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-target" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si anti-escalation echoue (target a plus de perms que caller)", async () => {
    mockRequireAuth.mockResolvedValue({
      ...SESSION,
      role: Role.GERANT,
      userId: "user-gerant",
    });
    mockGetSiteMember
      .mockResolvedValueOnce(
        makeCallerMember([Permission.MEMBRES_GERER, Permission.VAGUES_VOIR])
      )
      .mockResolvedValueOnce(makeTargetMember(ALL_PERMISSIONS));
    mockCanAssignRole.mockReturnValue(false);

    const request = makeRequest("/api/sites/site-1/members/user-admin", {
      method: "DELETE",
    });

    const response = await deleteMember(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-admin" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 404 si le membre est introuvable", async () => {
    mockGetSiteMember
      .mockResolvedValueOnce(makeCallerMember(ALL_PERMISSIONS))
      .mockResolvedValueOnce(null);

    const request = makeRequest("/api/sites/site-1/members/user-unknown", {
      method: "DELETE",
    });

    const response = await deleteMember(request, {
      params: Promise.resolve({ id: "site-1", userId: "user-unknown" }),
    });

    expect(response.status).toBe(404);
  });
});

// ===== PUT /api/auth/site ==================================================

describe("PUT /api/auth/site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
  });

  it("change le site actif et retourne siteRole comme objet {id, name, permissions}", async () => {
    mockGetSiteMember.mockResolvedValue({
      id: "member-1",
      userId: SESSION.userId,
      siteId: "site-2",
      siteRoleId: "sr-gerant-1",
      siteRole: {
        id: "sr-gerant-1",
        name: "Gerant",
        permissions: GERANT_PERMS,
      },
      isActive: true,
      createdAt: now,
    });
    mockSessionUpdateMany.mockResolvedValue({});

    const request = makeRequest("/api/auth/site", {
      method: "PUT",
      headers: { cookie: "session_token=abc-123" },
      body: JSON.stringify({ siteId: "site-2" }),
    });

    const response = await putAuthSite(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.activeSiteId).toBe("site-2");
    // CR-009: siteRole est un objet, pas un string enum
    expect(data.siteRole).toEqual({
      id: "sr-gerant-1",
      name: "Gerant",
      permissions: GERANT_PERMS,
    });
    expect(typeof data.siteRole).toBe("object");
    expect(data.siteRole.id).toBe("sr-gerant-1");
    expect(data.siteRole.name).toBe("Gerant");
  });

  it("retourne 403 si pas membre du site cible", async () => {
    mockGetSiteMember.mockResolvedValue(null);

    const request = makeRequest("/api/auth/site", {
      method: "PUT",
      body: JSON.stringify({ siteId: "site-unknown" }),
    });

    const response = await putAuthSite(request);

    expect(response.status).toBe(403);
  });

  it("retourne 400 si siteId est manquant", async () => {
    const request = makeRequest("/api/auth/site", {
      method: "PUT",
      body: JSON.stringify({}),
    });

    const response = await putAuthSite(request);

    expect(response.status).toBe(400);
  });

  it("retourne 403 si le membre est inactif", async () => {
    mockGetSiteMember.mockResolvedValue({
      id: "member-1",
      userId: SESSION.userId,
      siteId: "site-2",
      siteRoleId: "sr-pisc-1",
      siteRole: { id: "sr-pisc-1", name: "Pisciculteur", permissions: PISC_PERMS },
      isActive: false,
    });

    const request = makeRequest("/api/auth/site", {
      method: "PUT",
      body: JSON.stringify({ siteId: "site-2" }),
    });

    const response = await putAuthSite(request);
    expect(response.status).toBe(403);
  });
});

// ===== GET /api/sites/[id]/roles ===========================================

describe("GET /api/sites/[id]/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(makeAuthContext({ activeSiteId: "site-1" }));
  });

  it("retourne la liste des roles du site", async () => {
    mockGetSiteRoles.mockResolvedValue([
      {
        id: "sr-admin-1",
        name: "Administrateur",
        description: "Acces complet",
        permissions: ALL_PERMISSIONS,
        isSystem: true,
        siteId: "site-1",
        _count: { members: 1 },
      },
      {
        id: "sr-pisc-1",
        name: "Pisciculteur",
        description: "Operations de base",
        permissions: PISC_PERMS,
        isSystem: true,
        siteId: "site-1",
        _count: { members: 3 },
      },
    ]);

    const response = await getSiteRolesList(makeRequest("/api/sites/site-1/roles"), {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.roles).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.roles[0].name).toBe("Administrateur");
  });

  it("retourne 403 si requirePermission lance ForbiddenError", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const response = await getSiteRolesList(makeRequest("/api/sites/site-1/roles"), {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 403 si le site actif est different du site demande", async () => {
    mockRequirePermission.mockResolvedValue(
      makeAuthContext({ activeSiteId: "site-autre" })
    );

    const response = await getSiteRolesList(makeRequest("/api/sites/site-1/roles"), {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 401 si requirePermission lance AuthError", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(
      new AuthError("Non authentifie.")
    );

    const response = await getSiteRolesList(makeRequest("/api/sites/site-1/roles"), {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(401);
  });
});

// ===== POST /api/sites/[id]/roles ==========================================

describe("POST /api/sites/[id]/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(makeAuthContext({ activeSiteId: "site-1" }));
  });

  it("cree un role personnalise", async () => {
    mockCanAssignRole.mockReturnValue(true);
    mockCreateSiteRole.mockResolvedValue({
      id: "sr-custom-1",
      name: "Superviseur",
      description: "Supervision des operations",
      permissions: [Permission.VAGUES_VOIR, Permission.RELEVES_VOIR],
      isSystem: false,
      siteId: "site-1",
      _count: { members: 0 },
    });

    const request = makeRequest("/api/sites/site-1/roles", {
      method: "POST",
      body: JSON.stringify({
        name: "Superviseur",
        description: "Supervision des operations",
        permissions: [Permission.VAGUES_VOIR, Permission.RELEVES_VOIR],
      }),
    });

    const response = await postSiteRole(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Superviseur");
    expect(data.isSystem).toBe(false);
    expect(mockCreateSiteRole).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ name: "Superviseur" })
    );
  });

  it("retourne 403 si anti-escalation echoue (permissions > caller)", async () => {
    mockCanAssignRole.mockReturnValue(false);

    const request = makeRequest("/api/sites/site-1/roles", {
      method: "POST",
      body: JSON.stringify({
        name: "Superviseur",
        permissions: ALL_PERMISSIONS, // plus que le caller hypothetique
      }),
    });

    const response = await postSiteRole(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 400 si le nom est manquant", async () => {
    const request = makeRequest("/api/sites/site-1/roles", {
      method: "POST",
      body: JSON.stringify({ permissions: [Permission.VAGUES_VOIR] }),
    });

    const response = await postSiteRole(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "name")).toBe(true);
  });

  it("retourne 400 si permissions est vide", async () => {
    const request = makeRequest("/api/sites/site-1/roles", {
      method: "POST",
      body: JSON.stringify({ name: "Superviseur", permissions: [] }),
    });

    const response = await postSiteRole(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("retourne 409 si un role avec ce nom existe deja (P2002)", async () => {
    mockCanAssignRole.mockReturnValue(true);
    const prismaError = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockCreateSiteRole.mockRejectedValue(prismaError);

    const request = makeRequest("/api/sites/site-1/roles", {
      method: "POST",
      body: JSON.stringify({
        name: "Administrateur",
        permissions: [Permission.VAGUES_VOIR],
      }),
    });

    const response = await postSiteRole(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("retourne 403 si le site actif est different", async () => {
    mockRequirePermission.mockResolvedValue(
      makeAuthContext({ activeSiteId: "site-autre" })
    );

    const request = makeRequest("/api/sites/site-1/roles", {
      method: "POST",
      body: JSON.stringify({
        name: "Superviseur",
        permissions: [Permission.VAGUES_VOIR],
      }),
    });

    const response = await postSiteRole(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(403);
  });
});

// ===== GET /api/sites/[id]/roles/[roleId] ==================================

describe("GET /api/sites/[id]/roles/[roleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(makeAuthContext({ activeSiteId: "site-1" }));
  });

  it("retourne le detail d'un role", async () => {
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-admin-1",
      name: "Administrateur",
      description: "Acces complet",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
      siteId: "site-1",
      _count: { members: 1 },
    });

    const response = await getSiteRoleDetail(
      makeRequest("/api/sites/site-1/roles/sr-admin-1"),
      { params: Promise.resolve({ id: "site-1", roleId: "sr-admin-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Administrateur");
    expect(data.isSystem).toBe(true);
  });

  it("retourne 404 si le role est introuvable", async () => {
    mockGetSiteRoleById.mockResolvedValue(null);

    const response = await getSiteRoleDetail(
      makeRequest("/api/sites/site-1/roles/sr-inexistant"),
      { params: Promise.resolve({ id: "site-1", roleId: "sr-inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 403 si pas la permission SITE_GERER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const response = await getSiteRoleDetail(
      makeRequest("/api/sites/site-1/roles/sr-admin-1"),
      { params: Promise.resolve({ id: "site-1", roleId: "sr-admin-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ===== PUT /api/sites/[id]/roles/[roleId] ==================================

describe("PUT /api/sites/[id]/roles/[roleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(makeAuthContext({ activeSiteId: "site-1" }));
  });

  it("met a jour les permissions d'un role personnalise", async () => {
    const customRole = {
      id: "sr-custom-1",
      name: "Superviseur",
      description: "Supervision",
      permissions: [Permission.VAGUES_VOIR],
      isSystem: false,
      siteId: "site-1",
      _count: { members: 2 },
    };
    mockGetSiteRoleById.mockResolvedValue(customRole);
    mockCanAssignRole.mockReturnValue(true);
    mockUpdateSiteRole.mockResolvedValue({
      ...customRole,
      permissions: [Permission.VAGUES_VOIR, Permission.RELEVES_VOIR],
    });

    const request = makeRequest("/api/sites/site-1/roles/sr-custom-1", {
      method: "PUT",
      body: JSON.stringify({
        permissions: [Permission.VAGUES_VOIR, Permission.RELEVES_VOIR],
      }),
    });

    const response = await putSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-custom-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.permissions).toContain(Permission.RELEVES_VOIR);
  });

  it("retourne 400 si on tente de renommer un role systeme", async () => {
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
      siteId: "site-1",
      _count: { members: 1 },
    });

    const request = makeRequest("/api/sites/site-1/roles/sr-admin-1", {
      method: "PUT",
      body: JSON.stringify({ name: "Nouveau Nom" }),
    });

    const response = await putSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-admin-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("retourne 403 si anti-escalation echoue pour les permissions", async () => {
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-custom-1",
      name: "Superviseur",
      permissions: [Permission.VAGUES_VOIR],
      isSystem: false,
      siteId: "site-1",
      _count: { members: 0 },
    });
    mockCanAssignRole.mockReturnValue(false);

    const request = makeRequest("/api/sites/site-1/roles/sr-custom-1", {
      method: "PUT",
      body: JSON.stringify({ permissions: ALL_PERMISSIONS }),
    });

    const response = await putSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-custom-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 404 si le role n'existe pas", async () => {
    mockGetSiteRoleById.mockResolvedValue(null);

    const request = makeRequest("/api/sites/site-1/roles/sr-inexistant", {
      method: "PUT",
      body: JSON.stringify({ name: "Test" }),
    });

    const response = await putSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-inexistant" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 409 si le nouveau nom est deja pris (P2002)", async () => {
    const customRole = {
      id: "sr-custom-1",
      name: "Superviseur",
      permissions: [Permission.VAGUES_VOIR],
      isSystem: false,
      siteId: "site-1",
      _count: { members: 0 },
    };
    mockGetSiteRoleById.mockResolvedValue(customRole);
    mockCanAssignRole.mockReturnValue(true);
    const prismaError = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockUpdateSiteRole.mockRejectedValue(prismaError);

    const request = makeRequest("/api/sites/site-1/roles/sr-custom-1", {
      method: "PUT",
      body: JSON.stringify({ name: "Gerant" }), // nom deja pris
    });

    const response = await putSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-custom-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("accepte la meme valeur de nom pour un role systeme (pas de renommage)", async () => {
    const systemRole = {
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
      siteId: "site-1",
      _count: { members: 1 },
    };
    mockGetSiteRoleById.mockResolvedValue(systemRole);
    mockCanAssignRole.mockReturnValue(true);
    mockUpdateSiteRole.mockResolvedValue({
      ...systemRole,
      description: "Nouvelle description",
    });

    const request = makeRequest("/api/sites/site-1/roles/sr-admin-1", {
      method: "PUT",
      body: JSON.stringify({
        name: "Administrateur", // meme nom = pas de changement = OK
        description: "Nouvelle description",
      }),
    });

    const response = await putSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-admin-1" }),
    });

    expect(response.status).toBe(200);
  });
});

// ===== DELETE /api/sites/[id]/roles/[roleId] ===============================

describe("DELETE /api/sites/[id]/roles/[roleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(makeAuthContext({ activeSiteId: "site-1" }));
  });

  it("supprime un role personnalise", async () => {
    const customRole = {
      id: "sr-custom-1",
      name: "Superviseur",
      permissions: [Permission.VAGUES_VOIR],
      isSystem: false,
      siteId: "site-1",
      _count: { members: 2 },
    };
    mockGetSiteRoleById.mockResolvedValue(customRole);
    mockDeleteSiteRole.mockResolvedValue({});

    const request = makeRequest("/api/sites/site-1/roles/sr-custom-1", {
      method: "DELETE",
    });

    const response = await deleteSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-custom-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.reassignedMembers).toBe(2);
    expect(mockDeleteSiteRole).toHaveBeenCalledWith("sr-custom-1", "site-1");
  });

  it("retourne 409 si on tente de supprimer un role systeme", async () => {
    mockGetSiteRoleById.mockResolvedValue({
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
      siteId: "site-1",
      _count: { members: 1 },
    });

    const request = makeRequest("/api/sites/site-1/roles/sr-admin-1", {
      method: "DELETE",
    });

    const response = await deleteSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-admin-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("retourne 404 si le role n'existe pas", async () => {
    mockGetSiteRoleById.mockResolvedValue(null);

    const request = makeRequest("/api/sites/site-1/roles/sr-inexistant", {
      method: "DELETE",
    });

    const response = await deleteSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-inexistant" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 403 si requirePermission echoue", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const request = makeRequest("/api/sites/site-1/roles/sr-custom-1", {
      method: "DELETE",
    });

    const response = await deleteSiteRole(request, {
      params: Promise.resolve({ id: "site-1", roleId: "sr-custom-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retourne 409 pour chaque role systeme (Gerant et Pisciculteur aussi)", async () => {
    for (const roleName of ["Gerant", "Pisciculteur"]) {
      mockGetSiteRoleById.mockResolvedValue({
        id: `sr-${roleName.toLowerCase()}-1`,
        name: roleName,
        permissions: roleName === "Gerant" ? GERANT_PERMS : PISC_PERMS,
        isSystem: true,
        siteId: "site-1",
        _count: { members: 0 },
      });

      const request = makeRequest(
        `/api/sites/site-1/roles/sr-${roleName.toLowerCase()}-1`,
        { method: "DELETE" }
      );

      const response = await deleteSiteRole(request, {
        params: Promise.resolve({
          id: "site-1",
          roleId: `sr-${roleName.toLowerCase()}-1`,
        }),
      });

      expect(response.status).toBe(409);
    }
  });
});
