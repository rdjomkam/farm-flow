/**
 * Tests API — GET /api/reproduction/kpis
 *              GET /api/reproduction/kpis/lots
 *              GET /api/reproduction/kpis/funnel
 *
 * Couvre :
 *   - GET kpis retourne un objet kpis avec les champs attendus
 *   - GET kpis accepte dateDebut / dateFin optionnels
 *   - GET kpis/lots retourne data.parPhase
 *   - GET kpis/funnel retourne un funnel de 3 etapes
 *   - GET kpis/funnel accepte dateDebut / dateFin optionnels
 *   - Retourne 401 si non authentifie (AuthError)
 *   - Retourne 403 si permissions insuffisantes (ForbiddenError)
 *   - Retourne 400 si dates invalides ou incoherentes
 *
 * Fichiers sources :
 *   src/app/api/reproduction/kpis/route.ts
 *   src/app/api/reproduction/kpis/lots/route.ts
 *   src/app/api/reproduction/kpis/funnel/route.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getKpis } from "@/app/api/reproduction/kpis/route";
import { GET as getKpisLots } from "@/app/api/reproduction/kpis/lots/route";
import { GET as getKpisFunnel } from "@/app/api/reproduction/kpis/funnel/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReproductionKpis = vi.fn();
const mockGetReproductionLotsKpis = vi.fn();
const mockGetReproductionFunnel = vi.fn();

vi.mock("@/lib/queries/reproduction-stats", () => ({
  getReproductionKpis: (...args: unknown[]) =>
    mockGetReproductionKpis(...args),
  getReproductionLotsKpis: (...args: unknown[]) =>
    mockGetReproductionLotsKpis(...args),
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

const FAKE_KPIS = {
  totalPontes: 12,
  totalPontesReussies: 10,
  totalOeufs: 6000,
  totalLarvesViables: 4800,
  totalAlevinsActifs: 3600,
  totalAlevinsSortis: 400,
  tauxFecondation: 83.3,
  tauxEclosion: 80,
  tauxSurvieLarvaire: 75,
  tauxSurvieGlobal: 49.9,
  totalFemelles: 5,
  totalMales: 3,
  femellesActives: 4,
  lotsEnCours: 3,
  lotsTransferes: 2,
  lotsPerdus: 1,
  productionMensuelle: [
    { mois: "2026-01", pontes: 2, alevins: 800 },
    { mois: "2026-02", pontes: 3, alevins: 1200 },
  ],
};

const FAKE_LOTS_KPIS = {
  parPhase: [
    { phase: "LARVE", count: 2, totalPoissons: 1200 },
    { phase: "ALEVIN", count: 1, totalPoissons: 600 },
  ],
  phaseMoyenneDureeJours: [
    { phase: "LARVE", dureeJours: 14 },
    { phase: "ALEVIN", dureeJours: 21 },
  ],
};

const FAKE_FUNNEL = [
  { etape: "Oeufs", count: 6000, pourcentage: 100 },
  { etape: "Larves viables", count: 4800, pourcentage: 80 },
  { etape: "Alevins actifs", count: 3600, pourcentage: 75 },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRequest(
  path: string,
  queryParams: Record<string, string> = {}
): NextRequest {
  const url = new URL(`http://localhost${path}`);
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

// ---------------------------------------------------------------------------
// GET /api/reproduction/kpis
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/kpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReproductionKpis.mockResolvedValue(FAKE_KPIS);
  });

  it("retourne un objet kpis avec les champs attendus", async () => {
    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis).toBeDefined();
    expect(body.kpis.totalPontes).toBeDefined();
    expect(body.kpis.tauxFecondation).toBeDefined();
    expect(body.kpis.totalLarvesViables).toBeDefined();
    expect(body.kpis.totalAlevinsActifs).toBeDefined();
    expect(body.kpis.lotsEnCours).toBeDefined();
    expect(body.kpis.productionMensuelle).toBeDefined();
  });

  it("retourne les kpis complets correspondant a la fixture", async () => {
    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis).toEqual(FAKE_KPIS);
  });

  it("retourne la periode avec dateDebut et dateFin null quand pas de filtres", async () => {
    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);
    const body = await response.json();

    expect(body.periode).toBeDefined();
    expect(body.periode.dateDebut).toBeNull();
    expect(body.periode.dateFin).toBeNull();
  });

  it("accepte dateDebut et dateFin ISO valides et les passe a la requete", async () => {
    const request = makeRequest("/api/reproduction/kpis", {
      dateDebut: "2026-01-01",
      dateFin: "2026-06-30",
    });
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis).toEqual(FAKE_KPIS);

    const callArgs = mockGetReproductionKpis.mock.calls[0];
    expect(callArgs[0]).toBe("site-1");
    expect(callArgs[1]).toBeInstanceOf(Date);
    expect(callArgs[2]).toBeInstanceOf(Date);
  });

  it("inclut les dates dans la periode quand filtres actifs", async () => {
    const request = makeRequest("/api/reproduction/kpis", {
      dateDebut: "2026-01-01",
      dateFin: "2026-06-30",
    });
    const response = await getKpis(request);
    const body = await response.json();

    expect(body.periode.dateDebut).toBe("2026-01-01T00:00:00.000Z");
    expect(body.periode.dateFin).toBeDefined();
    expect(body.periode.dateFin).not.toBeNull();
  });

  it("passe le siteId de l'auth context a getReproductionKpis", async () => {
    const request = makeRequest("/api/reproduction/kpis");
    await getKpis(request);

    expect(mockGetReproductionKpis).toHaveBeenCalledWith(
      "site-1",
      undefined,
      undefined
    );
  });

  it("retourne 400 si dateDebut est invalide", async () => {
    const request = makeRequest("/api/reproduction/kpis", {
      dateDebut: "pas-une-date",
    });
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateDebut");
  });

  it("retourne 400 si dateFin est invalide", async () => {
    const request = makeRequest("/api/reproduction/kpis", {
      dateFin: "invalide",
    });
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateFin");
  });

  it("retourne 400 si dateDebut est posterieure a dateFin", async () => {
    const request = makeRequest("/api/reproduction/kpis", {
      dateDebut: "2026-12-31",
      dateFin: "2026-01-01",
    });
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("date");
  });

  it("retourne 401 si l'utilisateur n'est pas authentifie (AuthError)", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);

    expect(response.status).toBe(401);
  });

  it("retourne 403 si les permissions sont insuffisantes (ForbiddenError)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ALEVINS_VOIR requise")
    );

    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec la permission ALEVINS_VOIR", async () => {
    const request = makeRequest("/api/reproduction/kpis");
    await getKpis(request);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.ALEVINS_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockGetReproductionKpis.mockRejectedValue(new Error("DB crash"));

    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);

    expect(response.status).toBe(500);
  });

  it("retourne des kpis avec productionMensuelle vide quand pas de donnees", async () => {
    const emptyKpis = {
      ...FAKE_KPIS,
      totalPontes: 0,
      totalPontesReussies: 0,
      tauxFecondation: 0,
      tauxSurvieGlobal: 0,
      productionMensuelle: [],
    };
    mockGetReproductionKpis.mockResolvedValue(emptyKpis);

    const request = makeRequest("/api/reproduction/kpis");
    const response = await getKpis(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis.totalPontes).toBe(0);
    expect(body.kpis.tauxFecondation).toBe(0);
    expect(body.kpis.productionMensuelle).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproduction/kpis/lots
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/kpis/lots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReproductionLotsKpis.mockResolvedValue(FAKE_LOTS_KPIS);
  });

  it("retourne data avec le tableau parPhase", async () => {
    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.parPhase).toBeDefined();
    expect(Array.isArray(body.data.parPhase)).toBe(true);
  });

  it("retourne data avec phaseMoyenneDureeJours", async () => {
    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);
    const body = await response.json();

    expect(body.data.phaseMoyenneDureeJours).toBeDefined();
    expect(Array.isArray(body.data.phaseMoyenneDureeJours)).toBe(true);
  });

  it("retourne les donnees completes de la fixture", async () => {
    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);
    const body = await response.json();

    expect(body.data).toEqual(FAKE_LOTS_KPIS);
  });

  it("passe le siteId de l'auth context a getReproductionLotsKpis", async () => {
    const request = makeRequest("/api/reproduction/kpis/lots");
    await getKpisLots(request);

    expect(mockGetReproductionLotsKpis).toHaveBeenCalledWith("site-1");
  });

  it("appelle requirePermission avec la permission ALEVINS_VOIR", async () => {
    const request = makeRequest("/api/reproduction/kpis/lots");
    await getKpisLots(request);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.ALEVINS_VOIR
    );
  });

  it("retourne 401 si l'utilisateur n'est pas authentifie (AuthError)", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);

    expect(response.status).toBe(401);
  });

  it("retourne 403 si les permissions sont insuffisantes (ForbiddenError)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ALEVINS_VOIR requise")
    );

    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockGetReproductionLotsKpis.mockRejectedValue(new Error("DB error"));

    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);

    expect(response.status).toBe(500);
  });

  it("retourne parPhase vide quand aucun lot actif", async () => {
    mockGetReproductionLotsKpis.mockResolvedValue({
      parPhase: [],
      phaseMoyenneDureeJours: [],
    });

    const request = makeRequest("/api/reproduction/kpis/lots");
    const response = await getKpisLots(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.parPhase).toEqual([]);
    expect(body.data.phaseMoyenneDureeJours).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproduction/kpis/funnel
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/kpis/funnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReproductionFunnel.mockResolvedValue(FAKE_FUNNEL);
  });

  it("retourne un funnel de 3 etapes", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.funnel).toBeDefined();
    expect(Array.isArray(body.funnel)).toBe(true);
    expect(body.funnel).toHaveLength(3);
  });

  it("retourne les etapes du funnel avec etape, count et pourcentage", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(body.funnel[0]).toHaveProperty("etape");
    expect(body.funnel[0]).toHaveProperty("count");
    expect(body.funnel[0]).toHaveProperty("pourcentage");
  });

  it("retourne les donnees completes du funnel", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(body.funnel).toEqual(FAKE_FUNNEL);
  });

  it("retourne la periode avec dateDebut et dateFin null sans filtres", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(body.periode).toBeDefined();
    expect(body.periode.dateDebut).toBeNull();
    expect(body.periode.dateFin).toBeNull();
  });

  it("accepte dateDebut et dateFin ISO valides", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel", {
      dateDebut: "2026-01-01",
      dateFin: "2026-06-30",
    });
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.funnel).toEqual(FAKE_FUNNEL);

    const callArgs = mockGetReproductionFunnel.mock.calls[0];
    expect(callArgs[0]).toBe("site-1");
    expect(callArgs[1]).toBeInstanceOf(Date);
    expect(callArgs[2]).toBeInstanceOf(Date);
  });

  it("inclut les dates dans la periode quand filtres actifs", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel", {
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(body.periode.dateDebut).not.toBeNull();
    expect(body.periode.dateFin).not.toBeNull();
  });

  it("passe le siteId de l'auth context a getReproductionFunnel", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel");
    await getKpisFunnel(request);

    expect(mockGetReproductionFunnel).toHaveBeenCalledWith(
      "site-1",
      undefined,
      undefined
    );
  });

  it("retourne 400 si dateDebut est invalide", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel", {
      dateDebut: "not-a-date",
    });
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateDebut");
  });

  it("retourne 400 si dateFin est invalide", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel", {
      dateFin: "bad-date",
    });
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateFin");
  });

  it("retourne 400 si dateDebut est posterieure a dateFin", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel", {
      dateDebut: "2026-12-01",
      dateFin: "2026-01-01",
    });
    const response = await getKpisFunnel(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("date");
  });

  it("retourne 401 si l'utilisateur n'est pas authentifie (AuthError)", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);

    expect(response.status).toBe(401);
  });

  it("retourne 403 si les permissions sont insuffisantes (ForbiddenError)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ALEVINS_VOIR requise")
    );

    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec la permission ALEVINS_VOIR", async () => {
    const request = makeRequest("/api/reproduction/kpis/funnel");
    await getKpisFunnel(request);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.ALEVINS_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockGetReproductionFunnel.mockRejectedValue(new Error("DB timeout"));

    const request = makeRequest("/api/reproduction/kpis/funnel");
    const response = await getKpisFunnel(request);

    expect(response.status).toBe(500);
  });
});
