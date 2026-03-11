import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_comparaison } from "@/app/api/analytics/aliments/route";
import { GET as GET_detail } from "@/app/api/analytics/aliments/[produitId]/route";
import { POST as POST_simulation } from "@/app/api/analytics/aliments/simulation/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetComparaisonAliments = vi.fn();
const mockGetDetailAliment = vi.fn();
const mockGetSimulationChangementAliment = vi.fn();

vi.mock("@/lib/queries/analytics", () => ({
  getComparaisonAliments: (...args: unknown[]) => mockGetComparaisonAliments(...args),
  getDetailAliment: (...args: unknown[]) => mockGetDetailAliment(...args),
  getSimulationChangementAliment: (...args: unknown[]) => mockGetSimulationChangementAliment(...args),
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
  permissions: [Permission.STOCK_VOIR],
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// GET /api/analytics/aliments — comparaison
// ---------------------------------------------------------------------------
describe("GET /api/analytics/aliments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la comparaison de tous les aliments", async () => {
    const fakeComparaison = {
      siteId: "site-1",
      aliments: [
        {
          produitId: "prod-1",
          produitNom: "Raanan 42%",
          fournisseurNom: "AquaFeed",
          categorie: "ALIMENT",
          prixUnitaire: 2000,
          quantiteTotale: 120,
          coutTotal: 240000,
          nombreVagues: 2,
          fcrMoyen: 1.52,
          sgrMoyen: 1.8,
          coutParKgGain: 2280,
          tauxSurvieAssocie: 91.5,
        },
      ],
      meilleurFCR: "prod-1",
      meilleurCoutKg: "prod-1",
      meilleurSGR: "prod-1",
      recommandation: "L'aliment 'Raanan 42%' a le meilleur rapport qualite/prix.",
    };
    mockGetComparaisonAliments.mockResolvedValue(fakeComparaison);

    const response = await GET_comparaison(makeRequest("/api/analytics/aliments"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aliments).toHaveLength(1);
    expect(data.aliments[0].produitNom).toBe("Raanan 42%");
    expect(data.meilleurFCR).toBe("prod-1");
    expect(data.recommandation).toContain("Raanan 42%");
  });

  it("passe siteId et filtre fournisseurId aux queries", async () => {
    mockGetComparaisonAliments.mockResolvedValue({
      siteId: "site-1",
      aliments: [],
      meilleurFCR: null,
      meilleurCoutKg: null,
      meilleurSGR: null,
      recommandation: null,
    });

    await GET_comparaison(makeRequest("/api/analytics/aliments?fournisseurId=fourn-1"));

    expect(mockGetComparaisonAliments).toHaveBeenCalledWith("site-1", {
      fournisseurId: "fourn-1",
    });
  });

  it("passe undefined quand pas de filtre", async () => {
    mockGetComparaisonAliments.mockResolvedValue({
      siteId: "site-1",
      aliments: [],
      meilleurFCR: null,
      meilleurCoutKg: null,
      meilleurSGR: null,
      recommandation: null,
    });

    await GET_comparaison(makeRequest("/api/analytics/aliments"));

    expect(mockGetComparaisonAliments).toHaveBeenCalledWith("site-1", {
      fournisseurId: undefined,
    });
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetComparaisonAliments.mockRejectedValue(new Error("DB error"));

    const response = await GET_comparaison(makeRequest("/api/analytics/aliments"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/analytics/aliments/[produitId] — detail
// ---------------------------------------------------------------------------
describe("GET /api/analytics/aliments/[produitId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le detail d'un aliment", async () => {
    const fakeDetail = {
      produitId: "prod-1",
      produitNom: "Raanan 42%",
      fournisseurNom: "AquaFeed",
      categorie: "ALIMENT",
      prixUnitaire: 2000,
      quantiteTotale: 120,
      coutTotal: 240000,
      nombreVagues: 2,
      fcrMoyen: 1.52,
      sgrMoyen: 1.8,
      coutParKgGain: 2280,
      tauxSurvieAssocie: 91.5,
      parVague: [
        {
          vagueId: "v-1",
          vagueCode: "VAGUE-2026-001",
          quantite: 60,
          fcr: 1.4,
          sgr: 2.0,
          coutParKgGain: 2100,
          periode: { debut: "2026-01-01", fin: "2026-02-28" },
        },
      ],
      evolutionFCR: [{ date: "2026-01-15", fcr: 1.4 }],
    };
    mockGetDetailAliment.mockResolvedValue(fakeDetail);

    const response = await GET_detail(
      makeRequest("/api/analytics/aliments/prod-1"),
      { params: Promise.resolve({ produitId: "prod-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.produitNom).toBe("Raanan 42%");
    expect(data.parVague).toHaveLength(1);
    expect(data.evolutionFCR).toHaveLength(1);
  });

  it("passe siteId et produitId aux queries", async () => {
    mockGetDetailAliment.mockResolvedValue({ produitId: "prod-1" });

    await GET_detail(
      makeRequest("/api/analytics/aliments/prod-1"),
      { params: Promise.resolve({ produitId: "prod-1" }) }
    );

    expect(mockGetDetailAliment).toHaveBeenCalledWith("site-1", "prod-1");
  });

  it("retourne 404 si produit introuvable", async () => {
    mockGetDetailAliment.mockResolvedValue(null);

    const response = await GET_detail(
      makeRequest("/api/analytics/aliments/unknown"),
      { params: Promise.resolve({ produitId: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetDetailAliment.mockRejectedValue(new Error("DB error"));

    const response = await GET_detail(
      makeRequest("/api/analytics/aliments/prod-1"),
      { params: Promise.resolve({ produitId: "prod-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// POST /api/analytics/aliments/simulation
// ---------------------------------------------------------------------------
describe("POST /api/analytics/aliments/simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le resultat de la simulation", async () => {
    const fakeSimulation = {
      ancienProduitId: "prod-1",
      ancienProduitNom: "Raanan 42%",
      nouveauProduitId: "prod-2",
      nouveauProduitNom: "Coppens Catfish",
      productionCible: 1000,
      ancienFCR: 1.52,
      nouveauFCR: 1.85,
      ancienCout: 3040000,
      nouveauCout: 4625000,
      economie: -1585000,
      message: "Le passage de 'Raanan 42%' a 'Coppens Catfish' couterait 1 585 000 CFA de plus.",
    };
    mockGetSimulationChangementAliment.mockResolvedValue(fakeSimulation);

    const response = await POST_simulation(
      makeRequest("/api/analytics/aliments/simulation", {
        method: "POST",
        body: JSON.stringify({
          ancienProduitId: "prod-1",
          nouveauProduitId: "prod-2",
          productionCible: 1000,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ancienProduitNom).toBe("Raanan 42%");
    expect(data.nouveauProduitNom).toBe("Coppens Catfish");
    expect(data.economie).toBe(-1585000);
  });

  it("passe les parametres corrects aux queries", async () => {
    mockGetSimulationChangementAliment.mockResolvedValue({ economie: 0, message: "ok" });

    await POST_simulation(
      makeRequest("/api/analytics/aliments/simulation", {
        method: "POST",
        body: JSON.stringify({
          ancienProduitId: "p-1",
          nouveauProduitId: "p-2",
          productionCible: 500,
        }),
      })
    );

    expect(mockGetSimulationChangementAliment).toHaveBeenCalledWith("site-1", "p-1", "p-2", 500);
  });

  it("retourne 400 si champs obligatoires manquants", async () => {
    const response = await POST_simulation(
      makeRequest("/api/analytics/aliments/simulation", {
        method: "POST",
        body: JSON.stringify({ ancienProduitId: "p-1" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("obligatoires");
  });

  it("retourne 400 si productionCible n'est pas un nombre positif", async () => {
    const response = await POST_simulation(
      makeRequest("/api/analytics/aliments/simulation", {
        method: "POST",
        body: JSON.stringify({
          ancienProduitId: "p-1",
          nouveauProduitId: "p-2",
          productionCible: -100,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("positif");
  });

  it("retourne 404 si un produit introuvable", async () => {
    mockGetSimulationChangementAliment.mockResolvedValue(null);

    const response = await POST_simulation(
      makeRequest("/api/analytics/aliments/simulation", {
        method: "POST",
        body: JSON.stringify({
          ancienProduitId: "unknown",
          nouveauProduitId: "p-2",
          productionCible: 1000,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvables");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetSimulationChangementAliment.mockRejectedValue(new Error("DB error"));

    const response = await POST_simulation(
      makeRequest("/api/analytics/aliments/simulation", {
        method: "POST",
        body: JSON.stringify({
          ancienProduitId: "p-1",
          nouveauProduitId: "p-2",
          productionCible: 1000,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});
