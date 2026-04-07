/**
 * Tests API — GET /api/reproduction/stats
 *
 * Couvre :
 *   - GET retourne stats + funnel + periode
 *   - Valide le format de dateDebut / dateFin
 *   - Valide que dateDebut <= dateFin
 *   - Retourne 401 si non authentifie (AuthError)
 *   - Retourne 403 si permissions insuffisantes (ForbiddenError)
 *
 * Fichier source : src/app/api/reproduction/stats/route.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/reproduction/stats/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReproductionStats = vi.fn();
const mockGetReproductionFunnel = vi.fn();

vi.mock("@/lib/queries/reproduction-stats", () => ({
  getReproductionStats: (...args: unknown[]) =>
    mockGetReproductionStats(...args),
  getReproductionFunnel: (...args: unknown[]) =>
    mockGetReproductionFunnel(...args),
}));

const mockRequirePermission = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  ForbiddenError: class ForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  isSuperAdmin: false,
  permissions: [Permission.ALEVINS_VOIR],
};

const FAKE_STATS = {
  totalPontes: 10,
  pontesReussies: 8,
  tauxFecondation: 80,
  totalOeufs: 5000,
  totalLarvesViables: 4000,
  tauxEclosion: 80,
  totalAlevinsActuels: 3000,
  tauxSurvieLarvaire: 75,
  tauxSurvieGlobal: 48,
};

const FAKE_FUNNEL = [
  { etape: "Oeufs", count: 5000, pourcentage: 100 },
  { etape: "Larves viables", count: 4000, pourcentage: 80 },
  { etape: "Alevins actifs", count: 3000, pourcentage: 75 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(queryParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/reproduction/stats");
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReproductionStats.mockResolvedValue(FAKE_STATS);
    mockGetReproductionFunnel.mockResolvedValue(FAKE_FUNNEL);
  });

  it("retourne les stats, le funnel et la periode sans filtres", async () => {
    const request = makeRequest();
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toEqual(FAKE_STATS);
    expect(body.funnel).toEqual(FAKE_FUNNEL);
    expect(body.periode).toBeDefined();
    expect(body.periode.dateDebut).toBeNull();
    expect(body.periode.dateFin).toBeNull();
  });

  it("accepte des dates ISO valides et les passe aux fonctions de stats", async () => {
    const request = makeRequest({
      dateDebut: "2026-01-01",
      dateFin: "2026-06-30",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toEqual(FAKE_STATS);

    // Verifier que les fonctions ont ete appelees avec les bonnes dates
    const statsCallArgs = mockGetReproductionStats.mock.calls[0];
    expect(statsCallArgs[0]).toBe("site-1");
    expect(statsCallArgs[1]).toBeInstanceOf(Date);
    expect(statsCallArgs[2]).toBeInstanceOf(Date);
  });

  it("inclut les dates de periode dans la reponse quand filtres actifs", async () => {
    const request = makeRequest({
      dateDebut: "2026-01-01",
      dateFin: "2026-06-30",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(body.periode.dateDebut).toBe("2026-01-01T00:00:00.000Z");
    expect(body.periode.dateFin).toBeDefined();
    expect(body.periode.dateFin).not.toBeNull();
  });

  it("retourne 400 si dateDebut est invalide", async () => {
    const request = makeRequest({ dateDebut: "not-a-date" });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateDebut");
  });

  it("retourne 400 si dateFin est invalide", async () => {
    const request = makeRequest({ dateFin: "invalid" });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateFin");
  });

  it("retourne 400 si dateDebut > dateFin", async () => {
    const request = makeRequest({
      dateDebut: "2026-12-31",
      dateFin: "2026-01-01",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("date");
  });

  it("retourne 401 si l'utilisateur n'est pas authentifie (AuthError)", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(
      new AuthError("Non authentifie")
    );

    const request = makeRequest();
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("retourne 403 si les permissions sont insuffisantes (ForbiddenError)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ALEVINS_VOIR requise")
    );

    const request = makeRequest();
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("passe le siteId de l'auth context aux fonctions de stats", async () => {
    const request = makeRequest();
    await GET(request);

    expect(mockGetReproductionStats).toHaveBeenCalledWith(
      "site-1",
      undefined,
      undefined
    );
    expect(mockGetReproductionFunnel).toHaveBeenCalledWith(
      "site-1",
      undefined,
      undefined
    );
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockGetReproductionStats.mockRejectedValue(new Error("DB connection failed"));

    const request = makeRequest();
    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  it("appelle requirePermission avec la permission ALEVINS_VOIR", async () => {
    const request = makeRequest();
    await GET(request);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.ALEVINS_VOIR
    );
  });

  it("execute getReproductionStats et getReproductionFunnel en parallele", async () => {
    const callOrder: string[] = [];

    mockGetReproductionStats.mockImplementation(async () => {
      callOrder.push("stats");
      return FAKE_STATS;
    });
    mockGetReproductionFunnel.mockImplementation(async () => {
      callOrder.push("funnel");
      return FAKE_FUNNEL;
    });

    const request = makeRequest();
    await GET(request);

    // Les deux fonctions doivent avoir ete appelees (ordre non garanti en parallele)
    expect(callOrder).toContain("stats");
    expect(callOrder).toContain("funnel");
  });
});
