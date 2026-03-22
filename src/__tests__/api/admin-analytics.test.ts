/**
 * Tests d'integration — Routes /api/backoffice/analytics et /api/backoffice/modules (ADR-022 Sprint D)
 *
 * Couvre :
 * - GET  /api/backoffice/analytics              — KPIs plateforme (auth, super-admin, cache)
 * - GET  /api/backoffice/analytics/sites        — evolution sites (auth, super-admin, period)
 * - GET  /api/backoffice/analytics/revenus      — revenus (auth, super-admin, period)
 * - GET  /api/backoffice/analytics/modules      — distribution modules (auth, super-admin)
 * - GET  /api/backoffice/modules                — liste ModuleDefinition (super-admin)
 * - POST /api/backoffice/modules                — creation ModuleDefinition (super-admin)
 * - GET  /api/backoffice/modules/[key]          — detail (auth, super-admin, 404)
 * - PUT  /api/backoffice/modules/[key]          — modification (immutabilite key/level)
 *
 * Story D.3 — Sprint D (migration admin → backoffice)
 * R2 : enums Permission importes depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted pour eviter les problemes de TDZ avec vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  mockRequireSuperAdmin,
  mockGetPlatformKPIs,
  mockGetSitesGrowth,
  mockGetRevenueAnalytics,
  mockGetModulesDistribution,
  mockPrismaModuleDefinitionFindMany,
  mockPrismaModuleDefinitionFindUnique,
  mockPrismaModuleDefinitionCreate,
  mockPrismaModuleDefinitionUpdate,
  mockPrismaQueryRaw,
} = vi.hoisted(() => ({
  mockRequireSuperAdmin: vi.fn(),
  mockGetPlatformKPIs: vi.fn(),
  mockGetSitesGrowth: vi.fn(),
  mockGetRevenueAnalytics: vi.fn(),
  mockGetModulesDistribution: vi.fn(),
  mockPrismaModuleDefinitionFindMany: vi.fn(),
  mockPrismaModuleDefinitionFindUnique: vi.fn(),
  mockPrismaModuleDefinitionCreate: vi.fn(),
  mockPrismaModuleDefinitionUpdate: vi.fn(),
  mockPrismaQueryRaw: vi.fn(),
}));

vi.mock("@/lib/auth/backoffice", () => ({
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
}));

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

vi.mock("@/lib/permissions", () => {
  class MockForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  }
  return {
    ForbiddenError: MockForbiddenError,
  };
});

vi.mock("@/lib/queries/admin-analytics", () => ({
  getPlatformKPIs: (...args: unknown[]) => mockGetPlatformKPIs(...args),
  getSitesGrowth: (...args: unknown[]) => mockGetSitesGrowth(...args),
  getRevenueAnalytics: (...args: unknown[]) => mockGetRevenueAnalytics(...args),
  getModulesDistribution: (...args: unknown[]) => mockGetModulesDistribution(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    moduleDefinition: {
      findMany: (...args: unknown[]) => mockPrismaModuleDefinitionFindMany(...args),
      findUnique: (...args: unknown[]) => mockPrismaModuleDefinitionFindUnique(...args),
      create: (...args: unknown[]) => mockPrismaModuleDefinitionCreate(...args),
      update: (...args: unknown[]) => mockPrismaModuleDefinitionUpdate(...args),
    },
    $queryRaw: (...args: unknown[]) => mockPrismaQueryRaw(...args),
  },
}));

// ---------------------------------------------------------------------------
// Imports des routes (apres les mocks)
// ---------------------------------------------------------------------------

import { GET as GET_KPI } from "@/app/api/backoffice/analytics/route";
import { GET as GET_SITES_GROWTH } from "@/app/api/backoffice/analytics/sites/route";
import { GET as GET_REVENUS } from "@/app/api/backoffice/analytics/revenus/route";
import { GET as GET_MODULES_DIST } from "@/app/api/backoffice/analytics/modules/route";
import {
  GET as GET_MODULES_LIST,
  POST as POST_MODULE,
} from "@/app/api/backoffice/modules/route";
import {
  GET as GET_MODULE_DETAIL,
  PATCH as PATCH_MODULE,
} from "@/app/api/backoffice/modules/[key]/route";

// ---------------------------------------------------------------------------
// Donnees de test
// ---------------------------------------------------------------------------

const BACKOFFICE_SESSION = {
  userId: "user-admin",
  email: "admin@dkfarm.cm",
  phone: null,
  name: "Admin DKFarm",
  isSuperAdmin: true,
};

const FAKE_KPIS = {
  totalSites: 42,
  activeSites: 38,
  totalUsers: 120,
  mrr: 1500000,
  arr: 18000000,
  churnRate: 0.02,
  newSitesThisMonth: 5,
};

const FAKE_SITES_GROWTH = {
  period: "30d",
  data: [
    { date: "2026-02-01", count: 35 },
    { date: "2026-02-15", count: 38 },
    { date: "2026-03-01", count: 42 },
  ],
};

const FAKE_REVENUE_DATA = {
  period: "30d",
  totalRevenue: 4500000,
  data: [
    { month: "2026-01", amount: 1500000 },
    { month: "2026-02", amount: 1500000 },
    { month: "2026-03", amount: 1500000 },
  ],
};

const FAKE_MODULES_DISTRIBUTION = [
  { module: "GROSSISSEMENT", count: 30 },
  { module: "REPRODUCTION", count: 15 },
  { module: "STOCK", count: 20 },
];

const FAKE_MODULE_DEFINITION = {
  id: "mod-1",
  key: "GROSSISSEMENT",
  label: "Grossissement",
  description: "Suivi des vagues de grossissement",
  iconName: "Fish",
  sortOrder: 1,
  level: "site",
  dependsOn: [],
  isVisible: true,
  isActive: true,
  category: "production",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// Tests : GET /api/backoffice/analytics (KPIs)
// ---------------------------------------------------------------------------

describe("GET /api/backoffice/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics");
    const res = await GET_KPI(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics");
    const res = await GET_KPI(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les KPIs de la plateforme", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics");
    const res = await GET_KPI(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalSites).toBe(42);
    expect(data.activeSites).toBe(38);
    expect(data.mrr).toBe(1500000);
    expect(mockGetPlatformKPIs).toHaveBeenCalledOnce();
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics");
    const res = await GET_KPI(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("verifie que requireSuperAdmin est appelee", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics");
    await GET_KPI(req);

    expect(mockRequireSuperAdmin).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/backoffice/analytics/sites (evolution)
// ---------------------------------------------------------------------------

describe("GET /api/backoffice/analytics/sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec period=30d par defaut", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetSitesGrowth.mockResolvedValue(FAKE_SITES_GROWTH);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/sites");
    const res = await GET_SITES_GROWTH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.period).toBe("30d");
    expect(data.data).toHaveLength(3);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("30d");
  });

  it("transmet le query param period=7d correctement", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetSitesGrowth.mockResolvedValue({ ...FAKE_SITES_GROWTH, period: "7d" });

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/analytics/sites?period=7d"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("7d");
  });

  it("transmet le query param period=90d correctement", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetSitesGrowth.mockResolvedValue({ ...FAKE_SITES_GROWTH, period: "90d" });

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/analytics/sites?period=90d"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("90d");
  });

  it("transmet le query param period=12m correctement", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetSitesGrowth.mockResolvedValue({ ...FAKE_SITES_GROWTH, period: "12m" });

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/analytics/sites?period=12m"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("12m");
  });

  it("utilise la periode par defaut 30d pour une valeur invalide", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetSitesGrowth.mockResolvedValue(FAKE_SITES_GROWTH);

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/analytics/sites?period=INVALIDE"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("30d");
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetSitesGrowth.mockResolvedValue(FAKE_SITES_GROWTH);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/backoffice/analytics/revenus
// ---------------------------------------------------------------------------

describe("GET /api/backoffice/analytics/revenus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les donnees de revenus (period par defaut 30d)", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetRevenueAnalytics.mockResolvedValue(FAKE_REVENUE_DATA);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/revenus");
    const res = await GET_REVENUS(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalRevenue).toBe(4500000);
    expect(data.data).toHaveLength(3);
    expect(mockGetRevenueAnalytics).toHaveBeenCalledWith("30d");
  });

  it("transmet le query param period correctement", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetRevenueAnalytics.mockResolvedValue({ ...FAKE_REVENUE_DATA, period: "12m" });

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/analytics/revenus?period=12m"
    );
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(200);
    expect(mockGetRevenueAnalytics).toHaveBeenCalledWith("12m");
  });

  it("utilise la periode par defaut 30d pour une valeur invalide", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetRevenueAnalytics.mockResolvedValue(FAKE_REVENUE_DATA);

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/analytics/revenus?period=FAUX"
    );
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(200);
    expect(mockGetRevenueAnalytics).toHaveBeenCalledWith("30d");
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetRevenueAnalytics.mockResolvedValue(FAKE_REVENUE_DATA);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/backoffice/analytics/modules (distribution)
// ---------------------------------------------------------------------------

describe("GET /api/backoffice/analytics/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec la distribution des modules", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetModulesDistribution.mockResolvedValue(FAKE_MODULES_DISTRIBUTION);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/modules");
    const res = await GET_MODULES_DIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.distribution).toHaveLength(3);
    expect(data.distribution[0].module).toBe("GROSSISSEMENT");
    expect(data.distribution[0].count).toBe(30);
    expect(mockGetModulesDistribution).toHaveBeenCalledOnce();
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetModulesDistribution.mockResolvedValue(FAKE_MODULES_DISTRIBUTION);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("retourne une liste vide si aucun module n'est utilise", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockGetModulesDistribution.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/backoffice/analytics/modules");
    const res = await GET_MODULES_DIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.distribution).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/backoffice/modules (liste)
// ---------------------------------------------------------------------------

describe("GET /api/backoffice/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/backoffice/modules");
    const res = await GET_MODULES_LIST(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makeRequest("http://localhost:3000/api/backoffice/modules");
    const res = await GET_MODULES_LIST(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec la liste des modules", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindMany.mockResolvedValue([FAKE_MODULE_DEFINITION]);
    // enrichModulesWithStats appelle $queryRaw deux fois (siteCount + planCount)
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ module: "GROSSISSEMENT", count: BigInt(30) }])
      .mockResolvedValueOnce([{ module: "GROSSISSEMENT", count: BigInt(2) }]);

    const req = makeRequest("http://localhost:3000/api/backoffice/modules");
    const res = await GET_MODULES_LIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.modules).toHaveLength(1);
    expect(data.modules[0].key).toBe("GROSSISSEMENT");
    expect(data.modules[0].siteCount).toBe(30);
    expect(data.modules[0].planCount).toBe(2);
  });

  it("retourne 200 avec une liste vide si aucun module en base", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/backoffice/modules");
    const res = await GET_MODULES_LIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.modules).toHaveLength(0);
    // $queryRaw ne doit pas etre appele pour une liste vide
    expect(mockPrismaQueryRaw).not.toHaveBeenCalled();
  });

  it("verifie que requireSuperAdmin est appelee", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/backoffice/modules");
    await GET_MODULES_LIST(req);

    expect(mockRequireSuperAdmin).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tests : POST /api/backoffice/modules (creation)
// ---------------------------------------------------------------------------

describe("POST /api/backoffice/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePostRequest(body: unknown) {
    return makeRequest("http://localhost:3000/api/backoffice/modules", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makePostRequest({ label: "Nouveau Module", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makePostRequest({ label: "Nouveau Module", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(403);
  });

  it("retourne 400 si label est absent", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);

    const req = makePostRequest({ level: "site" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/label/i);
  });

  it("retourne 400 si label est une chaine vide", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);

    const req = makePostRequest({ label: "   ", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(400);
  });

  it("retourne 400 si level est absent", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);

    const req = makePostRequest({ label: "Nouveau Module" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/level/i);
  });

  it("retourne 400 si level est invalide (ni 'site' ni 'platform')", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);

    const req = makePostRequest({ label: "Nouveau Module", level: "global" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/level/i);
  });

  it("retourne 409 si un module avec la meme cle existe deja", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);

    const req = makePostRequest({ label: "Grossissement", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(409);
  });

  it("retourne 201 avec le module cree pour level=site", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);
    mockPrismaModuleDefinitionCreate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      key: "NOUVEAU_MODULE",
      label: "Nouveau Module",
      level: "site",
      createdAt: new Date("2026-03-22"),
    });

    const req = makePostRequest({ label: "Nouveau Module", level: "site" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.key).toBe("NOUVEAU_MODULE");
    expect(data.label).toBe("Nouveau Module");
    expect(data.siteCount).toBe(0);
    expect(data.planCount).toBe(0);
  });

  it("retourne 201 avec le module cree pour level=platform", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);
    mockPrismaModuleDefinitionCreate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      key: "MODULE_PLATEFORME",
      label: "Module Plateforme",
      level: "platform",
      createdAt: new Date("2026-03-22"),
    });

    const req = makePostRequest({ label: "Module Plateforme", level: "platform" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.level).toBe("platform");
  });

  it("derive correctement la cle depuis le label (majuscules + underscores)", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);
    mockPrismaModuleDefinitionCreate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      key: "SUIVI_QUALITE_EAU",
      label: "Suivi qualite eau",
      createdAt: new Date("2026-03-22"),
    });

    const req = makePostRequest({ label: "Suivi qualite eau", level: "site" });
    await POST_MODULE(req);

    expect(mockPrismaModuleDefinitionFindUnique).toHaveBeenCalledWith({
      where: { key: "SUIVI_QUALITE_EAU" },
    });
  });

  it("verifie que requireSuperAdmin est appelee", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);
    mockPrismaModuleDefinitionCreate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      createdAt: new Date("2026-03-22"),
    });

    const req = makePostRequest({ label: "Test Module", level: "site" });
    await POST_MODULE(req);

    expect(mockRequireSuperAdmin).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/backoffice/modules/[key]
// ---------------------------------------------------------------------------

describe("GET /api/backoffice/modules/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/modules/GROSSISSEMENT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/modules/GROSSISSEMENT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 404 si le module n'existe pas", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/modules/INEXISTANT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "INEXISTANT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("INEXISTANT");
  });

  it("retourne 200 avec le detail du module et ses stats", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    // getModuleStats appelle $queryRaw deux fois (siteCount + planCount)
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(25) }])
      .mockResolvedValueOnce([{ count: BigInt(3) }]);

    const req = makeRequest(
      "http://localhost:3000/api/backoffice/modules/GROSSISSEMENT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.key).toBe("GROSSISSEMENT");
    expect(data.label).toBe("Grossissement");
    expect(data.siteCount).toBe(25);
    expect(data.planCount).toBe(3);
    expect(mockPrismaModuleDefinitionFindUnique).toHaveBeenCalledWith({
      where: { key: "GROSSISSEMENT" },
    });
  });
});

// ---------------------------------------------------------------------------
// Tests : PUT /api/backoffice/modules/[key]
// ---------------------------------------------------------------------------

describe("PATCH /api/backoffice/modules/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePatchRequest(key: string, body: unknown) {
    return makeRequest(`http://localhost:3000/api/backoffice/modules/${key}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makePatchRequest("GROSSISSEMENT", { label: "Modifie" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si l'utilisateur n'est pas super-admin", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(
      new ForbiddenError("Acces reserve aux super-admins.")
    );

    const req = makePatchRequest("GROSSISSEMENT", { label: "Modifie" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 400 si on tente de changer la cle (key immutable)", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);

    const req = makePatchRequest("GROSSISSEMENT", { key: "NOUVEAU_NOM" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/key/i);
    expect(data.error).toMatch(/immuable/i);
  });

  it("retourne 400 si on tente de changer le level (level immutable)", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);

    const req = makePatchRequest("GROSSISSEMENT", { level: "platform" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/level/i);
    expect(data.error).toMatch(/immuable/i);
  });

  it("retourne 404 si le module n'existe pas", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);

    const req = makePatchRequest("INEXISTANT", { label: "Modifie" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "INEXISTANT" }),
    });

    expect(res.status).toBe(404);
  });

  it("retourne 200 apres une mise a jour valide du label", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaModuleDefinitionUpdate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      label: "Grossissement Modifie",
    });
    // getModuleStats appelle $queryRaw deux fois
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(25) }])
      .mockResolvedValueOnce([{ count: BigInt(3) }]);

    const req = makePatchRequest("GROSSISSEMENT", { label: "Grossissement Modifie" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.label).toBe("Grossissement Modifie");
    expect(data.key).toBe("GROSSISSEMENT");
    expect(mockPrismaModuleDefinitionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "GROSSISSEMENT" },
        data: expect.objectContaining({ label: "Grossissement Modifie" }),
      })
    );
  });

  it("retourne 200 apres une mise a jour de isActive et isVisible", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaModuleDefinitionUpdate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      isActive: false,
      isVisible: false,
    });
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const req = makePatchRequest("GROSSISSEMENT", { isActive: false, isVisible: false });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isActive).toBe(false);
    expect(data.isVisible).toBe(false);
  });

  it("retourne 400 si sortOrder n'est pas un nombre", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);

    const req = makePatchRequest("GROSSISSEMENT", { sortOrder: "dix" });
    const res = await PATCH_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/sortOrder/i);
  });

  it("verifie que requireSuperAdmin est appelee", async () => {
    mockRequireSuperAdmin.mockResolvedValue(BACKOFFICE_SESSION);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaModuleDefinitionUpdate.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const req = makePatchRequest("GROSSISSEMENT", { label: "Test" });
    await PATCH_MODULE(req, { params: Promise.resolve({ key: "GROSSISSEMENT" }) });

    expect(mockRequireSuperAdmin).toHaveBeenCalledOnce();
  });
});
