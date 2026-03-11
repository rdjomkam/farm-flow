import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/stock/alertes/route";
import { NextRequest } from "next/server";
import { Permission, CategorieProduit, UniteStock } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetProduitsEnAlerte = vi.fn();

vi.mock("@/lib/queries/produits", () => ({
  getProduitsEnAlerte: (...args: unknown[]) => mockGetProduitsEnAlerte(...args),
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
  siteRole: "PISCICULTEUR",
  permissions: [Permission.STOCK_VOIR],
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// ---------------------------------------------------------------------------
// GET /api/stock/alertes
// ---------------------------------------------------------------------------
describe("GET /api/stock/alertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne les produits en alerte avec le total", async () => {
    const produitsEnAlerte = [
      {
        id: "prod-1",
        nom: "Aliment 3mm",
        categorie: CategorieProduit.ALIMENT,
        unite: UniteStock.KG,
        stockActuel: 10,
        seuilAlerte: 50,
        fournisseur: { id: "four-1", nom: "Fournisseur SA" },
      },
      {
        id: "prod-2",
        nom: "Vitamines C",
        categorie: CategorieProduit.INTRANT,
        unite: UniteStock.LITRE,
        stockActuel: 0,
        seuilAlerte: 5,
        fournisseur: null,
      },
    ];
    mockGetProduitsEnAlerte.mockResolvedValue(produitsEnAlerte);

    const response = await GET(makeRequest("/api/stock/alertes"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.produits).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(mockGetProduitsEnAlerte).toHaveBeenCalledWith("site-1");
  });

  it("retourne une liste vide si aucun produit en alerte", async () => {
    mockGetProduitsEnAlerte.mockResolvedValue([]);

    const response = await GET(makeRequest("/api/stock/alertes"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.produits).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/stock/alertes"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/stock/alertes"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetProduitsEnAlerte.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/stock/alertes"));
    expect(response.status).toBe(500);
  });
});
