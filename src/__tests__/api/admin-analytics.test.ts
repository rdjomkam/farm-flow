/**
 * Tests d'integration — Routes /api/admin/analytics et /api/admin/modules (Sprint 35, Story D.4)
 *
 * Couvre :
 * - GET  /api/admin/analytics              — KPIs plateforme (auth, plateforme, cache)
 * - GET  /api/admin/analytics/sites        — evolution sites (auth, plateforme, period)
 * - GET  /api/admin/analytics/revenus      — revenus (auth, plateforme, period)
 * - GET  /api/admin/analytics/modules      — distribution modules (auth, plateforme)
 * - GET  /api/admin/modules                — liste ModuleDefinition (SITES_VOIR)
 * - POST /api/admin/modules                — creation ModuleDefinition (SITES_GERER)
 * - GET  /api/admin/modules/[key]          — detail (auth, plateforme, 404)
 * - PUT  /api/admin/modules/[key]          — modification (immutabilite key/level)
 *
 * Story D.4 — Sprint 35
 * R2 : enums Permission importes depuis @/types
 * R8 : acces reserve au site plateforme uniquement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted pour eviter les problemes de TDZ avec vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  mockRequirePermission,
  mockIsPlatformSite,
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
  mockRequirePermission: vi.fn(),
  mockIsPlatformSite: vi.fn(),
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

import { GET as GET_KPI } from "@/app/api/admin/analytics/route";
import { GET as GET_SITES_GROWTH } from "@/app/api/admin/analytics/sites/route";
import { GET as GET_REVENUS } from "@/app/api/admin/analytics/revenus/route";
import { GET as GET_MODULES_DIST } from "@/app/api/admin/analytics/modules/route";
import {
  GET as GET_MODULES_LIST,
  POST as POST_MODULE,
} from "@/app/api/admin/modules/route";
import {
  GET as GET_MODULE_DETAIL,
  PUT as PUT_MODULE,
} from "@/app/api/admin/modules/[key]/route";

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
// Tests : GET /api/admin/analytics (KPIs)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    const res = await GET_KPI(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission ANALYTICS_PLATEFORME manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ANALYTICS_PLATEFORME requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    const res = await GET_KPI(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    const res = await GET_KPI(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBeDefined();
  });

  it("retourne 200 avec les KPIs de la plateforme", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    const res = await GET_KPI(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalSites).toBe(42);
    expect(data.activeSites).toBe(38);
    expect(data.mrr).toBe(1500000);
    expect(mockGetPlatformKPIs).toHaveBeenCalledOnce();
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    const res = await GET_KPI(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("verifie isPlatformSite avec l'activeSiteId de la session", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    await GET_KPI(req);

    expect(mockIsPlatformSite).toHaveBeenCalledWith(PLATFORM_SITE_ID);
  });

  it("verifie requirePermission avec ANALYTICS_PLATEFORME", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetPlatformKPIs.mockResolvedValue(FAKE_KPIS);

    const req = makeRequest("http://localhost:3000/api/admin/analytics");
    await GET_KPI(req);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.ANALYTICS_PLATEFORME
    );
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/analytics/sites (evolution)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission ANALYTICS_PLATEFORME manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ANALYTICS_PLATEFORME requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec period=30d par defaut", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetSitesGrowth.mockResolvedValue(FAKE_SITES_GROWTH);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/sites");
    const res = await GET_SITES_GROWTH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.period).toBe("30d");
    expect(data.data).toHaveLength(3);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("30d");
  });

  it("transmet le query param period=7d correctement", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetSitesGrowth.mockResolvedValue({ ...FAKE_SITES_GROWTH, period: "7d" });

    const req = makeRequest(
      "http://localhost:3000/api/admin/analytics/sites?period=7d"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("7d");
  });

  it("transmet le query param period=90d correctement", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetSitesGrowth.mockResolvedValue({ ...FAKE_SITES_GROWTH, period: "90d" });

    const req = makeRequest(
      "http://localhost:3000/api/admin/analytics/sites?period=90d"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("90d");
  });

  it("transmet le query param period=12m correctement", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetSitesGrowth.mockResolvedValue({ ...FAKE_SITES_GROWTH, period: "12m" });

    const req = makeRequest(
      "http://localhost:3000/api/admin/analytics/sites?period=12m"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("12m");
  });

  it("utilise la periode par defaut 30d pour une valeur invalide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetSitesGrowth.mockResolvedValue(FAKE_SITES_GROWTH);

    const req = makeRequest(
      "http://localhost:3000/api/admin/analytics/sites?period=INVALIDE"
    );
    const res = await GET_SITES_GROWTH(req);

    expect(res.status).toBe(200);
    expect(mockGetSitesGrowth).toHaveBeenCalledWith("30d");
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetSitesGrowth.mockResolvedValue(FAKE_SITES_GROWTH);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/sites");
    const res = await GET_SITES_GROWTH(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/analytics/revenus
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/revenus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission ANALYTICS_PLATEFORME manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ANALYTICS_PLATEFORME requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les donnees de revenus (period par defaut 30d)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetRevenueAnalytics.mockResolvedValue(FAKE_REVENUE_DATA);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/revenus");
    const res = await GET_REVENUS(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalRevenue).toBe(4500000);
    expect(data.data).toHaveLength(3);
    expect(mockGetRevenueAnalytics).toHaveBeenCalledWith("30d");
  });

  it("transmet le query param period correctement", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetRevenueAnalytics.mockResolvedValue({ ...FAKE_REVENUE_DATA, period: "12m" });

    const req = makeRequest(
      "http://localhost:3000/api/admin/analytics/revenus?period=12m"
    );
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(200);
    expect(mockGetRevenueAnalytics).toHaveBeenCalledWith("12m");
  });

  it("utilise la periode par defaut 30d pour une valeur invalide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetRevenueAnalytics.mockResolvedValue(FAKE_REVENUE_DATA);

    const req = makeRequest(
      "http://localhost:3000/api/admin/analytics/revenus?period=FAUX"
    );
    const res = await GET_REVENUS(req);

    expect(res.status).toBe(200);
    expect(mockGetRevenueAnalytics).toHaveBeenCalledWith("30d");
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetRevenueAnalytics.mockResolvedValue(FAKE_REVENUE_DATA);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/revenus");
    const res = await GET_REVENUS(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/analytics/modules (distribution)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission ANALYTICS_PLATEFORME manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ANALYTICS_PLATEFORME requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec la distribution des modules", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetModulesDistribution.mockResolvedValue(FAKE_MODULES_DISTRIBUTION);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/modules");
    const res = await GET_MODULES_DIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.distribution).toHaveLength(3);
    expect(data.distribution[0].module).toBe("GROSSISSEMENT");
    expect(data.distribution[0].count).toBe(30);
    expect(mockGetModulesDistribution).toHaveBeenCalledOnce();
  });

  it("retourne le header Cache-Control de 5 minutes", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetModulesDistribution.mockResolvedValue(FAKE_MODULES_DISTRIBUTION);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/modules");
    const res = await GET_MODULES_DIST(req);

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("retourne une liste vide si aucun module n'est utilise", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetModulesDistribution.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/admin/analytics/modules");
    const res = await GET_MODULES_DIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.distribution).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/modules (liste)
// ---------------------------------------------------------------------------

describe("GET /api/admin/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/admin/modules");
    const res = await GET_MODULES_LIST(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_VOIR requise.")
    );

    const req = makeRequest("http://localhost:3000/api/admin/modules");
    const res = await GET_MODULES_LIST(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/admin/modules");
    const res = await GET_MODULES_LIST(req);

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec la liste des modules", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindMany.mockResolvedValue([FAKE_MODULE_DEFINITION]);
    // enrichModulesWithStats appelle $queryRaw deux fois (siteCount + planCount)
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ module: "GROSSISSEMENT", count: BigInt(30) }])
      .mockResolvedValueOnce([{ module: "GROSSISSEMENT", count: BigInt(2) }]);

    const req = makeRequest("http://localhost:3000/api/admin/modules");
    const res = await GET_MODULES_LIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.modules).toHaveLength(1);
    expect(data.modules[0].key).toBe("GROSSISSEMENT");
    expect(data.modules[0].siteCount).toBe(30);
    expect(data.modules[0].planCount).toBe(2);
  });

  it("retourne 200 avec une liste vide si aucun module en base", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/admin/modules");
    const res = await GET_MODULES_LIST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.modules).toHaveLength(0);
    // $queryRaw ne doit pas etre appele pour une liste vide
    expect(mockPrismaQueryRaw).not.toHaveBeenCalled();
  });

  it("verifie requirePermission avec SITES_VOIR", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/admin/modules");
    await GET_MODULES_LIST(req);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.SITES_VOIR
    );
  });
});

// ---------------------------------------------------------------------------
// Tests : POST /api/admin/modules (creation)
// ---------------------------------------------------------------------------

describe("POST /api/admin/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePostRequest(body: unknown) {
    return makeRequest("http://localhost:3000/api/admin/modules", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makePostRequest({ label: "Nouveau Module", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_GERER requise.")
    );

    const req = makePostRequest({ label: "Nouveau Module", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makePostRequest({ label: "Nouveau Module", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(403);
  });

  it("retourne 400 si label est absent", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePostRequest({ level: "site" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/label/i);
  });

  it("retourne 400 si label est une chaine vide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePostRequest({ label: "   ", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(400);
  });

  it("retourne 400 si level est absent", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePostRequest({ label: "Nouveau Module" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/level/i);
  });

  it("retourne 400 si level est invalide (ni 'site' ni 'platform')", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePostRequest({ label: "Nouveau Module", level: "global" });
    const res = await POST_MODULE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/level/i);
  });

  it("retourne 409 si un module avec la meme cle existe deja", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);

    const req = makePostRequest({ label: "Grossissement", level: "site" });
    const res = await POST_MODULE(req);

    expect(res.status).toBe(409);
  });

  it("retourne 201 avec le module cree pour level=site", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
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
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
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
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
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

  it("verifie requirePermission avec SITES_GERER", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);
    mockPrismaModuleDefinitionCreate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      createdAt: new Date("2026-03-22"),
    });

    const req = makePostRequest({ label: "Test Module", level: "site" });
    await POST_MODULE(req);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.SITES_GERER
    );
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/admin/modules/[key]
// ---------------------------------------------------------------------------

describe("GET /api/admin/modules/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest(
      "http://localhost:3000/api/admin/modules/GROSSISSEMENT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_VOIR requise.")
    );

    const req = makeRequest(
      "http://localhost:3000/api/admin/modules/GROSSISSEMENT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makeRequest(
      "http://localhost:3000/api/admin/modules/GROSSISSEMENT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 404 si le module n'existe pas", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);

    const req = makeRequest(
      "http://localhost:3000/api/admin/modules/INEXISTANT"
    );
    const res = await GET_MODULE_DETAIL(req, {
      params: Promise.resolve({ key: "INEXISTANT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("INEXISTANT");
  });

  it("retourne 200 avec le detail du module et ses stats", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    // getModuleStats appelle $queryRaw deux fois (siteCount + planCount)
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(25) }])
      .mockResolvedValueOnce([{ count: BigInt(3) }]);

    const req = makeRequest(
      "http://localhost:3000/api/admin/modules/GROSSISSEMENT"
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
// Tests : PUT /api/admin/modules/[key]
// ---------------------------------------------------------------------------

describe("PUT /api/admin/modules/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePutRequest(key: string, body: unknown) {
    return makeRequest(`http://localhost:3000/api/admin/modules/${key}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makePutRequest("GROSSISSEMENT", { label: "Modifie" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission SITES_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission SITES_GERER requise.")
    );

    const req = makePutRequest("GROSSISSEMENT", { label: "Modifie" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 403 si session n'est pas sur le site plateforme", async () => {
    mockRequirePermission.mockResolvedValue({
      ...AUTH_CONTEXT,
      activeSiteId: "site-client",
    });
    mockIsPlatformSite.mockResolvedValue(false);

    const req = makePutRequest("GROSSISSEMENT", { label: "Modifie" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });

    expect(res.status).toBe(403);
  });

  it("retourne 400 si on tente de changer la cle (key immutable)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePutRequest("GROSSISSEMENT", { key: "NOUVEAU_NOM" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/key/i);
    expect(data.error).toMatch(/immuable/i);
  });

  it("retourne 400 si on tente de changer le level (level immutable)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);

    const req = makePutRequest("GROSSISSEMENT", { level: "platform" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/level/i);
    expect(data.error).toMatch(/immuable/i);
  });

  it("retourne 404 si le module n'existe pas", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(null);

    const req = makePutRequest("INEXISTANT", { label: "Modifie" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "INEXISTANT" }),
    });

    expect(res.status).toBe(404);
  });

  it("retourne 200 apres une mise a jour valide du label", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaModuleDefinitionUpdate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      label: "Grossissement Modifie",
    });
    // getModuleStats appelle $queryRaw deux fois
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(25) }])
      .mockResolvedValueOnce([{ count: BigInt(3) }]);

    const req = makePutRequest("GROSSISSEMENT", { label: "Grossissement Modifie" });
    const res = await PUT_MODULE(req, {
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
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaModuleDefinitionUpdate.mockResolvedValue({
      ...FAKE_MODULE_DEFINITION,
      isActive: false,
      isVisible: false,
    });
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const req = makePutRequest("GROSSISSEMENT", { isActive: false, isVisible: false });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isActive).toBe(false);
    expect(data.isVisible).toBe(false);
  });

  it("retourne 400 si sortOrder n'est pas un nombre", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);

    const req = makePutRequest("GROSSISSEMENT", { sortOrder: "dix" });
    const res = await PUT_MODULE(req, {
      params: Promise.resolve({ key: "GROSSISSEMENT" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/sortOrder/i);
  });

  it("verifie requirePermission avec SITES_GERER", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockIsPlatformSite.mockResolvedValue(true);
    mockPrismaModuleDefinitionFindUnique.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaModuleDefinitionUpdate.mockResolvedValue(FAKE_MODULE_DEFINITION);
    mockPrismaQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const req = makePutRequest("GROSSISSEMENT", { label: "Test" });
    await PUT_MODULE(req, { params: Promise.resolve({ key: "GROSSISSEMENT" }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.SITES_GERER
    );
  });
});
