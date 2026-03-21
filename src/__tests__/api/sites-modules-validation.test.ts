/**
 * Tests API — PUT /api/sites/[id] validation des modules (BUG-022 / Story 38.5)
 *
 * Couvre :
 * - Rejet des modules platform (ABONNEMENTS, COMMISSIONS, REMISES) dans enabledModules
 * - Acceptation des modules site-level valides dans enabledModules
 * - Validation du type de enabledModules (doit être un tableau)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, SiteModule } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted pour eviter les problemes de TDZ
// ---------------------------------------------------------------------------

const {
  mockRequireAuth,
  mockGetSiteMember,
  mockUpdateSite,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetSiteMember: vi.fn(),
  mockUpdateSite: vi.fn(),
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
    requirePermission: vi.fn(),
    ForbiddenError: MockForbiddenError,
  };
});

vi.mock("@/lib/queries/sites", () => ({
  getUserSites: vi.fn(),
  createSite: vi.fn(),
  getSiteById: vi.fn(),
  updateSite: (...args: unknown[]) => mockUpdateSite(...args),
  getSiteMember: (...args: unknown[]) => mockGetSiteMember(...args),
  addMember: vi.fn(),
  updateMemberSiteRole: vi.fn(),
  removeMember: vi.fn(),
}));

import { PUT as putSite } from "@/app/api/sites/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

const ALL_PERMISSIONS = Object.values(Permission);
const now = new Date();

const SESSION = {
  userId: "user-admin",
  email: "admin@ferme.cm",
  phone: null,
  name: "Admin Ferme",
  role: "ADMIN",
  activeSiteId: "site-1",
};

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

// ---------------------------------------------------------------------------
// PUT /api/sites/[id] — validation enabledModules (modules platform rejetés)
// ---------------------------------------------------------------------------

describe("PUT /api/sites/[id] — validation enabledModules : modules platform rejetés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
  });

  it("retourne 400 quand ABONNEMENTS est dans enabledModules", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [SiteModule.ABONNEMENTS],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain(SiteModule.ABONNEMENTS);
  });

  it("retourne 400 quand COMMISSIONS est dans enabledModules", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [SiteModule.COMMISSIONS],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain(SiteModule.COMMISSIONS);
  });

  it("retourne 400 quand REMISES est dans enabledModules", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [SiteModule.REMISES],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain(SiteModule.REMISES);
  });

  it("retourne 400 quand un mix de modules valides et ABONNEMENTS est envoyé", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT, SiteModule.ABONNEMENTS],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain(SiteModule.ABONNEMENTS);
  });

  it("retourne 400 quand les trois modules platform sont envoyés ensemble", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [
        SiteModule.ABONNEMENTS,
        SiteModule.COMMISSIONS,
        SiteModule.REMISES,
      ],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("retourne 400 quand un module inconnu est envoyé dans enabledModules", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: ["MODULE_INEXISTANT"],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("retourne 400 quand enabledModules n'est pas un tableau", async () => {
    const request = makeRequest("/api/sites/site-1", {
      enabledModules: "GROSSISSEMENT",
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/sites/[id] — modules site-level valides acceptés
// ---------------------------------------------------------------------------

describe("PUT /api/sites/[id] — modules site-level valides acceptés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
  });

  it("accepte enabledModules avec uniquement GROSSISSEMENT", async () => {
    mockUpdateSite.mockResolvedValue({
      id: "site-1",
      name: "Ferme A",
      address: "Douala",
      isActive: true,
      enabledModules: [SiteModule.GROSSISSEMENT],
      updatedAt: now,
    });

    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockUpdateSite).toHaveBeenCalledOnce();
  });

  it("accepte enabledModules avec plusieurs modules site-level", async () => {
    mockUpdateSite.mockResolvedValue({
      id: "site-1",
      name: "Ferme A",
      address: "Douala",
      isActive: true,
      enabledModules: [SiteModule.GROSSISSEMENT, SiteModule.VENTES, SiteModule.INTRANTS],
      updatedAt: now,
    });

    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT, SiteModule.VENTES, SiteModule.INTRANTS],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(200);
  });

  it("accepte enabledModules vide (désactivation de tous les modules site)", async () => {
    mockUpdateSite.mockResolvedValue({
      id: "site-1",
      name: "Ferme A",
      address: "Douala",
      isActive: true,
      enabledModules: [],
      updatedAt: now,
    });

    const request = makeRequest("/api/sites/site-1", {
      enabledModules: [],
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(200);
  });

  it("accepte tous les modules site-level sans aucun module platform", async () => {
    const allSiteModules = [
      SiteModule.REPRODUCTION,
      SiteModule.GROSSISSEMENT,
      SiteModule.INTRANTS,
      SiteModule.VENTES,
      SiteModule.ANALYSE_PILOTAGE,
      SiteModule.CONFIGURATION,
      SiteModule.INGENIEUR,
      SiteModule.NOTES,
    ];

    mockUpdateSite.mockResolvedValue({
      id: "site-1",
      name: "Ferme A",
      address: "Douala",
      isActive: true,
      enabledModules: allSiteModules,
      updatedAt: now,
    });

    const request = makeRequest("/api/sites/site-1", {
      enabledModules: allSiteModules,
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockUpdateSite).toHaveBeenCalledOnce();
  });

  it("la réponse inclut enabledModules dans le payload retourné", async () => {
    const expectedModules = [SiteModule.GROSSISSEMENT, SiteModule.VENTES];
    mockUpdateSite.mockResolvedValue({
      id: "site-1",
      name: "Ferme A",
      address: "Douala",
      isActive: true,
      enabledModules: expectedModules,
      updatedAt: now,
    });

    const request = makeRequest("/api/sites/site-1", {
      enabledModules: expectedModules,
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabledModules).toEqual(expectedModules);
  });
});
