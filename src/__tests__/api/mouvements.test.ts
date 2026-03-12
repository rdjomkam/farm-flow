import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/stock/mouvements/route";
import { NextRequest } from "next/server";
import { Permission, TypeMouvement } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetMouvements = vi.fn();
const mockCreateMouvement = vi.fn();

vi.mock("@/lib/queries/mouvements", () => ({
  getMouvements: (...args: unknown[]) => mockGetMouvements(...args),
  createMouvement: (...args: unknown[]) => mockCreateMouvement(...args),
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
  permissions: [Permission.STOCK_VOIR, Permission.STOCK_GERER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_MOUVEMENT = {
  id: "mouv-1",
  produitId: "prod-1",
  type: TypeMouvement.ENTREE,
  quantite: 100,
  prixTotal: 500000,
  vagueId: null,
  commandeId: "cmd-1",
  userId: "user-1",
  date: new Date("2026-03-09"),
  notes: "Reception commande CMD-2026-001",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  produit: { id: "prod-1", nom: "Aliment 3mm", unite: "KG" },
  user: { id: "user-1", name: "Test User" },
};

// ---------------------------------------------------------------------------
// GET /api/stock/mouvements
// ---------------------------------------------------------------------------
describe("GET /api/stock/mouvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des mouvements avec le total", async () => {
    mockGetMouvements.mockResolvedValue([FAKE_MOUVEMENT]);

    const response = await GET(makeRequest("/api/stock/mouvements"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mouvements).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {});
  });

  it("passe le filtre produitId", async () => {
    mockGetMouvements.mockResolvedValue([]);

    await GET(makeRequest("/api/stock/mouvements?produitId=prod-1"));

    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {
      produitId: "prod-1",
    });
  });

  it("passe le filtre type", async () => {
    mockGetMouvements.mockResolvedValue([]);

    await GET(makeRequest("/api/stock/mouvements?type=ENTREE"));

    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {
      type: TypeMouvement.ENTREE,
    });
  });

  it("passe le filtre vagueId", async () => {
    mockGetMouvements.mockResolvedValue([]);

    await GET(makeRequest("/api/stock/mouvements?vagueId=vague-1"));

    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {
      vagueId: "vague-1",
    });
  });

  it("passe le filtre commandeId", async () => {
    mockGetMouvements.mockResolvedValue([]);

    await GET(makeRequest("/api/stock/mouvements?commandeId=cmd-1"));

    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {
      commandeId: "cmd-1",
    });
  });

  it("passe les filtres de date", async () => {
    mockGetMouvements.mockResolvedValue([]);

    await GET(
      makeRequest("/api/stock/mouvements?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
  });

  it("ignore un type invalide", async () => {
    mockGetMouvements.mockResolvedValue([]);

    await GET(makeRequest("/api/stock/mouvements?type=INVALIDE"));

    expect(mockGetMouvements).toHaveBeenCalledWith("site-1", {});
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/stock/mouvements"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/stock/mouvements"));
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/stock/mouvements
// ---------------------------------------------------------------------------
describe("POST /api/stock/mouvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    produitId: "prod-1",
    type: TypeMouvement.ENTREE,
    quantite: 100,
    date: "2026-03-09T00:00:00.000Z",
    prixTotal: 500000,
    notes: "Livraison fournisseur",
  };

  it("cree un mouvement ENTREE", async () => {
    mockCreateMouvement.mockResolvedValue(FAKE_MOUVEMENT);

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("mouv-1");
    expect(mockCreateMouvement).toHaveBeenCalledWith("site-1", "user-1", {
      produitId: "prod-1",
      type: TypeMouvement.ENTREE,
      quantite: 100,
      date: "2026-03-09T00:00:00.000Z",
      prixTotal: 500000,
      vagueId: undefined,
      commandeId: undefined,
      notes: "Livraison fournisseur",
    });
  });

  it("cree un mouvement SORTIE avec vagueId", async () => {
    const sortie = { ...FAKE_MOUVEMENT, type: TypeMouvement.SORTIE, vagueId: "vague-1" };
    mockCreateMouvement.mockResolvedValue(sortie);

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          type: TypeMouvement.SORTIE,
          vagueId: "vague-1",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateMouvement).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({
        type: TypeMouvement.SORTIE,
        vagueId: "vague-1",
      })
    );
  });

  it("retourne 400 si produitId manquant", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, produitId: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "produitId" })])
    );
  });

  it("retourne 400 si type invalide", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, type: "TRANSFERT" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "type" })])
    );
  });

  it("retourne 400 si quantite <= 0", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, quantite: 0 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si quantite negative", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, quantite: -10 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si date manquante", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, date: undefined }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si date invalide", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, date: "pas-une-date" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si prixTotal negatif", async () => {
    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({ ...validBody, prixTotal: -100 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si produit introuvable", async () => {
    mockCreateMouvement.mockRejectedValue(new Error("Produit introuvable"));

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si stock insuffisant pour SORTIE", async () => {
    mockCreateMouvement.mockRejectedValue(
      new Error("Stock insuffisant pour Aliment 3mm. Disponible : 50 KG, demande : 100 KG")
    );

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          type: TypeMouvement.SORTIE,
          quantite: 100,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("Stock insuffisant");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(401);
  });

  // --- Sprint 14 : conversion d'unites d'achat pour ENTREE ---

  it("passe la quantite originale au createMouvement (conversion dans la query)", async () => {
    // La conversion est faite dans la query, pas dans la route API.
    // Le mouvement stocke la quantite originale (ex: 2 sacs).
    const mouvementEntreeConversion = {
      ...FAKE_MOUVEMENT,
      quantite: 2,
      produit: {
        id: "prod-1",
        nom: "Farine poisson",
        unite: "KG",
        uniteAchat: "SACS",
        contenance: 25,
      },
    };
    mockCreateMouvement.mockResolvedValue(mouvementEntreeConversion);

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          quantite: 2,
        }),
      })
    );

    expect(response.status).toBe(201);
    // L'API route passe la quantite brute; la conversion se fait dans createMouvement
    expect(mockCreateMouvement).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ quantite: 2 })
    );
  });

  it("cree un mouvement SORTIE sans conversion (quantite en unite de base)", async () => {
    const mouvementSortie = {
      ...FAKE_MOUVEMENT,
      type: TypeMouvement.SORTIE,
      quantite: 5,
      produit: {
        id: "prod-1",
        nom: "Farine poisson",
        unite: "KG",
        uniteAchat: "SACS",
        contenance: 25,
      },
    };
    mockCreateMouvement.mockResolvedValue(mouvementSortie);

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          type: TypeMouvement.SORTIE,
          quantite: 5,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateMouvement).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({
        type: TypeMouvement.SORTIE,
        quantite: 5,
      })
    );
  });
});
