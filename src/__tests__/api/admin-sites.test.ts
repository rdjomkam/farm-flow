/**
 * Tests d'integration — Routes /api/admin/sites (Sprint 35, Story B.6)
 *
 * Couvre :
 * - GET  /api/admin/sites           — liste paginee (auth, plateforme, filtres)
 * - GET  /api/admin/sites/[id]      — detail d'un site
 * - PATCH /api/admin/sites/[id]/status   — cycle de vie (SUSPEND, BLOCK, RESTORE, ARCHIVE)
 * - PATCH /api/admin/sites/[id]/modules  — mise a jour des modules
 *
 * Story B.6 — Sprint 35
 * R2 : enums Permission, SiteModule, SiteStatus importes depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, SiteModule, SiteStatus } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted pour eviter les problemes de TDZ avec vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  mockRequirePermission,
  mockIsPlatformSite,
  mockGetAdminSites,
  mockGetAdminSiteById,
  mockUpdateSiteStatus,
  mockUpdateSiteModulesAdmin,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockIsPlatformSite: vi.fn(),
  mockGetAdminSites: vi.fn(),
  mockGetAdminSiteById: vi.fn(),
  mockUpdateSiteStatus: vi.fn(),
  mockUpdateSiteModulesAdmin: vi.fn(),
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
  };
});

vi.mock("@/lib/auth", () => {
  class MockAuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  }
  return {
    AuthError: MockAuthError,
  };
});

vi.mock("@/lib/queries/sites", () => ({
  isPlatformSite: (...args: unknown[]) => mockIsPlatformSite(...args),
}));

vi.mock("@/lib/queries/admin-sites", () => ({
  getAdminSites: (...args: unknown[]) => mockGetAdminSites(...args),
  getAdminSiteById: (...args: unknown[]) => mockGetAdminSiteById(...args),
  updateSiteStatus: (...args: unknown[]) => mockUpdateSiteStatus(...args),
  updateSiteModulesAdmin: (...args: unknown[]) => mockUpdateSiteModulesAdmin(...args),
}));

// ---------------------------------------------------------------------------
// Imports des routes (apres les mocks)
// ---------------------------------------------------------------------------

import { GET as GET_SITES } from "@/app/api/admin/sites/route";
import { GET as GET_SITE_DETAIL } from "@/app/api/admin/sites/[id]/route";
import { PATCH as PATCH_STATUS } from "@/app/api/admin/sites/[id]/status/route";
import { PATCH as PATCH_MODULES } from "@/app/api/admin/sites/[id]/modules/route";

// ---------------------------------------------------------------------------
// Donnees de test
// ---------------------------------------------------------------------------

const PLATFORM_SITE_ID = "site-platform";

const AUTH_CONTEXT = {
  userId: "user-admin",
  email: "admin@dkfarm.cm",
  phone: null,
  name: "Admin DKFarm",
  globalRole: "ADMIN",
  activeSiteId: PLATFORM_SITE_ID,
  siteRoleId: "role-admin",
  siteRoleName: "Super Admin",
  permissions: Object.values(Permission),
};

const FAKE_SITE_SUMMARY = {
  id: "site-1",
  name: "Ferme Bello",
  isActive: true,
  status: SiteStatus.ACTIVE,
  enabledModules: [SiteModule.GROSSISSEMENT],
  createdAt: new Date("2026-01-01"),
};

const FAKE_SITE_DETAIL = {
  ...FAKE_SITE_SUMMARY,
  address: "Yaounde, Cameroun",
  supervised: false,
  suspendedAt: null,
  suspendReason: null,
  blockedAt: null,
  blockReason: null,
  deletedAt: null,
  abonnement: null,
  members: [],
  _count: { members: 0, vagues: 2 },
};

const FAKE_SITES_LIST = {
  sites: [FAKE_SITE_SUMMARY],
  total: 1,
  page: 1,
  pageSize: 20,
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/sites
// ---------------------------------------------------------------------------

describe("GET /api/admin/sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/sites");
    const res = await GET_SITES(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_VOIR requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/sites");
    const res = await GET_SITES(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/sites");
    const res = await GET_SITES(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBeDefined();
    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.SITES_VOIR
    );
  });

  it("retourne 200 avec la liste paginee par defaut", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSites.mockResolvedValue(FAKE_SITES_LIST);

    const req = makeRequest("http://localhost:3000/api/admin/sites");
    const res = await GET_SITES(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sites).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(mockGetAdminSites).toHaveBeenCalledOnce();
  });

  it("transmet les filtres page et pageSize a getAdminSites", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSites.mockResolvedValue({ sites: [], total: 0, page: 2, pageSize: 10 });

    const req = makeRequest(
      "http://localhost:3000/api/admin/sites?page=2&pageSize=10"
    );
    const res = await GET_SITES(req);

    expect(res.status).toBe(200);
    expect(mockGetAdminSites).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 })
    );
  });

  it("transmet le filtre status valide a getAdminSites", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSites.mockResolvedValue({ sites: [], total: 0, page: 1, pageSize: 20 });

    const req = makeRequest(
      `http://localhost:3000/api/admin/sites?status=${SiteStatus.SUSPENDED}`
    );
    const res = await GET_SITES(req);

    expect(res.status).toBe(200);
    expect(mockGetAdminSites).toHaveBeenCalledWith(
      expect.objectContaining({ status: SiteStatus.SUSPENDED })
    );
  });

  it("ignore un status invalide (n'applique pas le filtre)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSites.mockResolvedValue(FAKE_SITES_LIST);

    const req = makeRequest(
      "http://localhost:3000/api/admin/sites?status=INVALID_STATUS"
    );
    const res = await GET_SITES(req);

    expect(res.status).toBe(200);
    expect(mockGetAdminSites).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined })
    );
  });

  it("transmet le filtre search a getAdminSites", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSites.mockResolvedValue(FAKE_SITES_LIST);

    const req = makeRequest(
      "http://localhost:3000/api/admin/sites?search=Bello"
    );
    const res = await GET_SITES(req);

    expect(res.status).toBe(200);
    expect(mockGetAdminSites).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Bello" })
    );
  });

  it("verifie isPlatformSite avec l'activeSiteId de la session", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSites.mockResolvedValue(FAKE_SITES_LIST);

    const req = makeRequest("http://localhost:3000/api/admin/sites");
    await GET_SITES(req);

    expect(mockIsPlatformSite).toHaveBeenCalledWith(PLATFORM_SITE_ID);
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/sites/[id]
// ---------------------------------------------------------------------------

describe("GET /api/admin/sites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/sites/site-1");
    const res = await GET_SITE_DETAIL(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_VOIR requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/sites/site-1");
    const res = await GET_SITE_DETAIL(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/sites/site-1");
    const res = await GET_SITE_DETAIL(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 404 si le site n'existe pas", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSiteById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/admin/sites/inexistant");
    const res = await GET_SITE_DETAIL(req, {
      params: Promise.resolve({ id: "inexistant" }),
    });

    expect(res.status).toBe(404);
  });

  it("retourne 200 avec le detail complet du site", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetAdminSiteById.mockResolvedValue(FAKE_SITE_DETAIL);

    const req = makeRequest("http://localhost:3000/api/admin/sites/site-1");
    const res = await GET_SITE_DETAIL(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("site-1");
    expect(data.name).toBe("Ferme Bello");
    expect(mockGetAdminSiteById).toHaveBeenCalledWith("site-1");
  });
});

// ---------------------------------------------------------------------------
// Tests : PATCH /api/admin/sites/[id]/status
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/sites/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePatchStatusRequest(id: string, body: unknown) {
    return makeRequest(`http://localhost:3000/api/admin/sites/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makePatchStatusRequest("site-1", { action: "SUSPEND", reason: "Test" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_GERER requise.")
    );

    const req = makePatchStatusRequest("site-1", { action: "SUSPEND", reason: "Test" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makePatchStatusRequest("site-1", { action: "SUSPEND", reason: "Test" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 400 si action absente", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", { reason: "Aucune raison" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("retourne 400 si action invalide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", {
      action: "DETRUIRE",
      reason: "Test",
    });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toMatch(/Action invalide/);
  });

  it("retourne 400 si reason manquant pour l'action SUSPEND", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", { action: "SUSPEND" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toMatch(/reason/i);
  });

  it("retourne 400 si reason manquant pour l'action BLOCK", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", { action: "BLOCK" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toMatch(/reason/i);
  });

  it("retourne 400 si reason est une chaine vide pour SUSPEND", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", { action: "SUSPEND", reason: "  " });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("retourne 400 si confirmArchive manquant pour ARCHIVE", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", { action: "ARCHIVE" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toMatch(/confirmArchive/i);
  });

  it("retourne 400 si confirmArchive = false pour ARCHIVE", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchStatusRequest("site-1", {
      action: "ARCHIVE",
      confirmArchive: false,
    });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("retourne 400 si updateSiteStatus leve une erreur metier (site isPlatform)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteStatus.mockRejectedValue(
      new Error("Le site plateforme ne peut pas etre modifie via cette action.")
    );

    const req = makePatchStatusRequest("site-1", {
      action: "SUSPEND",
      reason: "Test",
    });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("plateforme");
  });

  it("retourne 200 sur un SUSPEND valide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteStatus.mockResolvedValue({
      id: "site-1",
      status: SiteStatus.SUSPENDED,
      suspendedAt: new Date(),
    });

    const req = makePatchStatusRequest("site-1", {
      action: "SUSPEND",
      reason: "Non-paiement",
    });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe(SiteStatus.SUSPENDED);
    expect(mockUpdateSiteStatus).toHaveBeenCalledWith(
      "site-1",
      "SUSPEND",
      AUTH_CONTEXT.userId,
      "Non-paiement"
    );
  });

  it("retourne 200 sur un RESTORE valide (sans reason)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteStatus.mockResolvedValue({
      id: "site-1",
      status: SiteStatus.ACTIVE,
      suspendedAt: null,
    });

    const req = makePatchStatusRequest("site-1", { action: "RESTORE" });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe(SiteStatus.ACTIVE);
    expect(mockUpdateSiteStatus).toHaveBeenCalledWith(
      "site-1",
      "RESTORE",
      AUTH_CONTEXT.userId,
      undefined
    );
  });

  it("retourne 200 sur un BLOCK valide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteStatus.mockResolvedValue({
      id: "site-1",
      status: SiteStatus.BLOCKED,
    });

    const req = makePatchStatusRequest("site-1", {
      action: "BLOCK",
      reason: "Fraude detectee",
    });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdateSiteStatus).toHaveBeenCalledWith(
      "site-1",
      "BLOCK",
      AUTH_CONTEXT.userId,
      "Fraude detectee"
    );
  });

  it("retourne 200 sur un ARCHIVE valide avec confirmArchive = true", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteStatus.mockResolvedValue({
      id: "site-1",
      status: SiteStatus.ARCHIVED,
      deletedAt: new Date(),
    });

    const req = makePatchStatusRequest("site-1", {
      action: "ARCHIVE",
      confirmArchive: true,
    });
    const res = await PATCH_STATUS(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe(SiteStatus.ARCHIVED);
  });

  it("verifie que requirePermission est appelee avec SITES_GERER", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteStatus.mockResolvedValue({ id: "site-1", status: SiteStatus.ACTIVE });

    const req = makePatchStatusRequest("site-1", { action: "RESTORE" });
    await PATCH_STATUS(req, { params: Promise.resolve({ id: "site-1" }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.SITES_GERER
    );
  });
});

// ---------------------------------------------------------------------------
// Tests : PATCH /api/admin/sites/[id]/modules
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/sites/[id]/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePatchModulesRequest(id: string, body: unknown) {
    return makeRequest(`http://localhost:3000/api/admin/sites/${id}/modules`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_GERER requise.")
    );

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 400 si enabledModules n'est pas un tableau", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchModulesRequest("site-1", {
      enabledModules: "GROSSISSEMENT",
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toMatch(/tableau/i);
  });

  it("retourne 400 si enabledModules contient des valeurs SiteModule invalides", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePatchModulesRequest("site-1", {
      enabledModules: ["MODULE_INEXISTANT", "AUTRE_FAUX"],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toMatch(/Modules inconnus/i);
  });

  it("retourne 400 si enabledModules contient des modules platform-level (ABONNEMENTS)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    // La validation platform-level se fait dans updateSiteModulesAdmin
    mockUpdateSiteModulesAdmin.mockRejectedValue(
      new Error("Modules platform-level refuses : ABONNEMENTS.")
    );

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.ABONNEMENTS],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("ABONNEMENTS");
  });

  it("retourne 400 si enabledModules contient des modules platform-level (COMMISSIONS)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteModulesAdmin.mockRejectedValue(
      new Error("Modules platform-level refuses : COMMISSIONS.")
    );

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.COMMISSIONS],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("COMMISSIONS");
  });

  it("retourne 400 si enabledModules contient des modules platform-level (REMISES)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteModulesAdmin.mockRejectedValue(
      new Error("Modules platform-level refuses : REMISES.")
    );

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.REMISES],
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("REMISES");
  });

  it("retourne 200 avec un tableau vide (desactiver tous les modules)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteModulesAdmin.mockResolvedValue({
      id: "site-1",
      enabledModules: [],
    });

    const req = makePatchModulesRequest("site-1", { enabledModules: [] });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enabledModules).toHaveLength(0);
    expect(mockUpdateSiteModulesAdmin).toHaveBeenCalledWith(
      "site-1",
      [],
      AUTH_CONTEXT.userId
    );
  });

  it("retourne 200 avec des modules site-level valides", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    const updatedModules = [SiteModule.GROSSISSEMENT, SiteModule.REPRODUCTION];
    mockUpdateSiteModulesAdmin.mockResolvedValue({
      id: "site-1",
      enabledModules: updatedModules,
    });

    const req = makePatchModulesRequest("site-1", {
      enabledModules: updatedModules,
    });
    const res = await PATCH_MODULES(req, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enabledModules).toEqual(updatedModules);
    expect(mockUpdateSiteModulesAdmin).toHaveBeenCalledWith(
      "site-1",
      updatedModules,
      AUTH_CONTEXT.userId
    );
  });

  it("verifie que requirePermission est appelee avec SITES_GERER", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockUpdateSiteModulesAdmin.mockResolvedValue({
      id: "site-1",
      enabledModules: [SiteModule.GROSSISSEMENT],
    });

    const req = makePatchModulesRequest("site-1", {
      enabledModules: [SiteModule.GROSSISSEMENT],
    });
    await PATCH_MODULES(req, { params: Promise.resolve({ id: "site-1" }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.SITES_GERER
    );
  });
});
