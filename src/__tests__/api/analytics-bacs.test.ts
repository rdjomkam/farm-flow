import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_comparaison } from "@/app/api/analytics/bacs/route";
import { GET as GET_detail } from "@/app/api/analytics/bacs/[bacId]/route";
import { GET as GET_historique } from "@/app/api/analytics/bacs/[bacId]/historique/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetComparaisonBacs = vi.fn();
const mockGetIndicateursBac = vi.fn();
const mockGetHistoriqueBac = vi.fn();

vi.mock("@/lib/queries/analytics", () => ({
  getComparaisonBacs: (...args: unknown[]) => mockGetComparaisonBacs(...args),
  getIndicateursBac: (...args: unknown[]) => mockGetIndicateursBac(...args),
  getHistoriqueBac: (...args: unknown[]) => mockGetHistoriqueBac(...args),
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

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Pisciculteur",
  permissions: [Permission.VAGUES_VOIR],
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// ---------------------------------------------------------------------------
// GET /api/analytics/bacs — comparaison
// ---------------------------------------------------------------------------
describe("GET /api/analytics/bacs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la comparaison des bacs pour une vague", async () => {
    const fakeComparaison = {
      vagueId: "vague-1",
      vagueCode: "VAGUE-2026-001",
      bacs: [
        {
          bacId: "bac-1",
          bacNom: "Bac 1",
          vagueId: "vague-1",
          volume: 1000,
          biomasse: 45.2,
          poidsMoyen: 150,
          densite: 45.2,
          nombreVivants: 301,
          totalMortalites: 24,
          totalAliment: 38,
          dernierReleve: new Date().toISOString(),
          nombreReleves: 12,
        },
      ],
      alertes: [],
    };
    mockGetComparaisonBacs.mockResolvedValue(fakeComparaison);

    const response = await GET_comparaison(makeRequest("/api/analytics/bacs?vagueId=vague-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vagueCode).toBe("VAGUE-2026-001");
    expect(data.bacs).toHaveLength(1);
    expect(data.bacs[0].bacNom).toBe("Bac 1");
  });

  it("passe siteId et vagueId aux queries", async () => {
    mockGetComparaisonBacs.mockResolvedValue({
      vagueId: "v-1",
      vagueCode: "V1",
      bacs: [],
      alertes: [],
    });

    await GET_comparaison(makeRequest("/api/analytics/bacs?vagueId=v-1"));

    expect(mockGetComparaisonBacs).toHaveBeenCalledWith("site-1", "v-1");
  });

  it("retourne 400 si vagueId manquant", async () => {
    const response = await GET_comparaison(makeRequest("/api/analytics/bacs"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("vagueId");
  });

  it("retourne 404 si vague introuvable", async () => {
    mockGetComparaisonBacs.mockResolvedValue(null);

    const response = await GET_comparaison(makeRequest("/api/analytics/bacs?vagueId=unknown"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetComparaisonBacs.mockRejectedValue(new Error("DB error"));

    const response = await GET_comparaison(makeRequest("/api/analytics/bacs?vagueId=v-1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/analytics/bacs/[bacId] — detail
// ---------------------------------------------------------------------------
describe("GET /api/analytics/bacs/[bacId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne les indicateurs d'un bac", async () => {
    const fakeIndicateurs = {
      bacId: "bac-1",
      bacNom: "Bac 1",
      vagueId: "vague-1",
      volume: 1000,
      biomasse: 40,
      poidsMoyen: 120,
      densite: 40,
      nombreVivants: 333,
      totalMortalites: 37,
      totalAliment: 30,
      dernierReleve: new Date().toISOString(),
      nombreReleves: 8,
    };
    mockGetIndicateursBac.mockResolvedValue(fakeIndicateurs);

    const response = await GET_detail(
      makeRequest("/api/analytics/bacs/bac-1?vagueId=vague-1"),
      { params: Promise.resolve({ bacId: "bac-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bacNom).toBe("Bac 1");
    expect(data.biomasse).toBe(40);
    expect(data.densite).toBe(40);
  });

  it("passe siteId, vagueId et bacId aux queries", async () => {
    mockGetIndicateursBac.mockResolvedValue({ bacId: "b-1" });

    await GET_detail(
      makeRequest("/api/analytics/bacs/b-1?vagueId=v-1"),
      { params: Promise.resolve({ bacId: "b-1" }) }
    );

    expect(mockGetIndicateursBac).toHaveBeenCalledWith("site-1", "v-1", "b-1");
  });

  it("retourne 400 si vagueId manquant", async () => {
    const response = await GET_detail(
      makeRequest("/api/analytics/bacs/bac-1"),
      { params: Promise.resolve({ bacId: "bac-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("vagueId");
  });

  it("retourne 404 si bac introuvable", async () => {
    mockGetIndicateursBac.mockResolvedValue(null);

    const response = await GET_detail(
      makeRequest("/api/analytics/bacs/unknown?vagueId=v-1"),
      { params: Promise.resolve({ bacId: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetIndicateursBac.mockRejectedValue(new Error("DB error"));

    const response = await GET_detail(
      makeRequest("/api/analytics/bacs/b-1?vagueId=v-1"),
      { params: Promise.resolve({ bacId: "b-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/analytics/bacs/[bacId]/historique
// ---------------------------------------------------------------------------
describe("GET /api/analytics/bacs/[bacId]/historique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne l'historique d'un bac", async () => {
    const fakeHistorique = {
      bacId: "bac-1",
      bacNom: "Bac 1",
      volume: 1000,
      cycles: [
        {
          vagueId: "v-1",
          vagueCode: "VAGUE-2026-001",
          dateDebut: "2026-01-01",
          dateFin: "2026-02-28",
          biomasse: 35,
          poidsMoyen: 140,
          nombreReleves: 15,
        },
      ],
    };
    mockGetHistoriqueBac.mockResolvedValue(fakeHistorique);

    const response = await GET_historique(
      makeRequest("/api/analytics/bacs/bac-1/historique"),
      { params: Promise.resolve({ bacId: "bac-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bacNom).toBe("Bac 1");
    expect(data.cycles).toHaveLength(1);
    expect(data.cycles[0].vagueCode).toBe("VAGUE-2026-001");
  });

  it("passe siteId et bacId aux queries", async () => {
    mockGetHistoriqueBac.mockResolvedValue({
      bacId: "b-1",
      bacNom: "B1",
      volume: 500,
      cycles: [],
    });

    await GET_historique(
      makeRequest("/api/analytics/bacs/b-1/historique"),
      { params: Promise.resolve({ bacId: "b-1" }) }
    );

    expect(mockGetHistoriqueBac).toHaveBeenCalledWith("site-1", "b-1");
  });

  it("retourne 404 si bac introuvable", async () => {
    mockGetHistoriqueBac.mockResolvedValue(null);

    const response = await GET_historique(
      makeRequest("/api/analytics/bacs/unknown/historique"),
      { params: Promise.resolve({ bacId: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne un historique vide si aucun cycle", async () => {
    mockGetHistoriqueBac.mockResolvedValue({
      bacId: "bac-1",
      bacNom: "Bac 1",
      volume: 1000,
      cycles: [],
    });

    const response = await GET_historique(
      makeRequest("/api/analytics/bacs/bac-1/historique"),
      { params: Promise.resolve({ bacId: "bac-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cycles).toHaveLength(0);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetHistoriqueBac.mockRejectedValue(new Error("DB error"));

    const response = await GET_historique(
      makeRequest("/api/analytics/bacs/b-1/historique"),
      { params: Promise.resolve({ bacId: "b-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});
