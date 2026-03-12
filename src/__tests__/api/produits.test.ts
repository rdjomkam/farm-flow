import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/produits/route";
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/produits/[id]/route";
import { NextRequest } from "next/server";
import { Permission, CategorieProduit, UniteStock } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetProduits = vi.fn();
const mockCreateProduit = vi.fn();
const mockGetProduitById = vi.fn();
const mockUpdateProduit = vi.fn();
const mockDeleteProduit = vi.fn();

vi.mock("@/lib/queries/produits", () => ({
  getProduits: (...args: unknown[]) => mockGetProduits(...args),
  createProduit: (...args: unknown[]) => mockCreateProduit(...args),
  getProduitById: (...args: unknown[]) => mockGetProduitById(...args),
  updateProduit: (...args: unknown[]) => mockUpdateProduit(...args),
  deleteProduit: (...args: unknown[]) => mockDeleteProduit(...args),
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

const FAKE_PRODUIT = {
  id: "prod-1",
  nom: "Aliment Tilapia 3mm",
  categorie: CategorieProduit.ALIMENT,
  unite: UniteStock.KG,
  prixUnitaire: 5000,
  seuilAlerte: 50,
  stockActuel: 200,
  fournisseurId: "four-1",
  isActive: true,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  fournisseur: { id: "four-1", nom: "Fournisseur SA" },
  _count: { mouvements: 10 },
};

// ---------------------------------------------------------------------------
// GET /api/produits
// ---------------------------------------------------------------------------
describe("GET /api/produits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des produits avec le total", async () => {
    mockGetProduits.mockResolvedValue([FAKE_PRODUIT]);

    const response = await GET(makeRequest("/api/produits"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.produits).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetProduits).toHaveBeenCalledWith("site-1", {});
  });

  it("passe le filtre categorie", async () => {
    mockGetProduits.mockResolvedValue([]);

    await GET(makeRequest("/api/produits?categorie=ALIMENT"));

    expect(mockGetProduits).toHaveBeenCalledWith("site-1", {
      categorie: CategorieProduit.ALIMENT,
    });
  });

  it("passe le filtre fournisseurId", async () => {
    mockGetProduits.mockResolvedValue([]);

    await GET(makeRequest("/api/produits?fournisseurId=four-1"));

    expect(mockGetProduits).toHaveBeenCalledWith("site-1", {
      fournisseurId: "four-1",
    });
  });

  it("ignore une categorie invalide", async () => {
    mockGetProduits.mockResolvedValue([]);

    await GET(makeRequest("/api/produits?categorie=INVALIDE"));

    expect(mockGetProduits).toHaveBeenCalledWith("site-1", {});
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/produits"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/produits"));
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/produits
// ---------------------------------------------------------------------------
describe("POST /api/produits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    nom: "Aliment Tilapia 3mm",
    categorie: CategorieProduit.ALIMENT,
    unite: UniteStock.KG,
    prixUnitaire: 5000,
    seuilAlerte: 50,
    fournisseurId: "four-1",
  };

  it("cree un produit avec tous les champs", async () => {
    mockCreateProduit.mockResolvedValue(FAKE_PRODUIT);

    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("prod-1");
    expect(mockCreateProduit).toHaveBeenCalledWith("site-1", validBody);
  });

  it("retourne 400 si nom manquant", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, nom: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nom" })])
    );
  });

  it("retourne 400 si categorie invalide", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, categorie: "INVALIDE" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "categorie" })])
    );
  });

  it("retourne 400 si unite invalide", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, unite: "GALLON" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "unite" })])
    );
  });

  it("retourne 400 si prixUnitaire negatif", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, prixUnitaire: -100 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "prixUnitaire" })])
    );
  });

  it("retourne 400 si prixUnitaire absent", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, prixUnitaire: undefined }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si seuilAlerte negatif", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, seuilAlerte: -10 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "seuilAlerte" })])
    );
  });

  it("retourne 400 avec plusieurs erreurs de validation", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({
          categorie: "INVALIDE",
          prixUnitaire: -1,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("retourne 404 si fournisseur introuvable", async () => {
    mockCreateProduit.mockRejectedValue(new Error("Fournisseur introuvable"));

    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(404);
  });

  // --- Sprint 14 : uniteAchat + contenance validation ---

  it("retourne 400 si uniteAchat fourni sans contenance", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, uniteAchat: UniteStock.SACS }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "contenance" })])
    );
  });

  it("retourne 400 si contenance fournie sans uniteAchat", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({ ...validBody, contenance: 25 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "uniteAchat" })])
    );
  });

  it("retourne 400 si contenance <= 0", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          uniteAchat: UniteStock.SACS,
          contenance: 0,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "contenance" })])
    );
  });

  it("retourne 400 si contenance negative", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          uniteAchat: UniteStock.SACS,
          contenance: -10,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "contenance" })])
    );
  });

  it("retourne 400 si uniteAchat === unite (meme unite)", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          uniteAchat: UniteStock.KG,
          contenance: 25,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "uniteAchat" })])
    );
  });

  it("retourne 400 si uniteAchat invalide", async () => {
    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          uniteAchat: "INVALIDE",
          contenance: 25,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "uniteAchat" })])
    );
  });

  it("cree un produit avec uniteAchat + contenance valides", async () => {
    const produitAvecConversion = {
      ...FAKE_PRODUIT,
      uniteAchat: UniteStock.SACS,
      contenance: 25,
    };
    mockCreateProduit.mockResolvedValue(produitAvecConversion);

    const response = await POST(
      makeRequest("/api/produits", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          uniteAchat: UniteStock.SACS,
          contenance: 25,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("prod-1");
    expect(mockCreateProduit).toHaveBeenCalledWith("site-1", {
      ...validBody,
      uniteAchat: UniteStock.SACS,
      contenance: 25,
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/produits/[id]
// ---------------------------------------------------------------------------
describe("GET /api/produits/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le produit par ID", async () => {
    mockGetProduitById.mockResolvedValue(FAKE_PRODUIT);

    const response = await GET_DETAIL(makeRequest("/api/produits/prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("prod-1");
    expect(mockGetProduitById).toHaveBeenCalledWith("prod-1", "site-1");
  });

  it("retourne 404 si produit introuvable", async () => {
    mockGetProduitById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/produits/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/produits/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/produits/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour un produit (champs partiels)", async () => {
    const updated = { ...FAKE_PRODUIT, nom: "Aliment Clarias 5mm" };
    mockUpdateProduit.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ nom: "Aliment Clarias 5mm", prixUnitaire: 6000 }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nom).toBe("Aliment Clarias 5mm");
  });

  it("retourne 400 si categorie invalide en update", async () => {
    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ categorie: "INVALIDE" }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si unite invalide en update", async () => {
    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ unite: "GALLON" }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si prixUnitaire negatif en update", async () => {
    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ prixUnitaire: -1 }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si produit introuvable", async () => {
    mockUpdateProduit.mockRejectedValue(new Error("Produit introuvable"));

    const response = await PUT(
      makeRequest("/api/produits/xxx", {
        method: "PUT",
        body: JSON.stringify({ nom: "X" }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  // --- Sprint 14 : uniteAchat + contenance validation en update ---

  it("retourne 400 si uniteAchat fourni sans contenance en update", async () => {
    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ uniteAchat: UniteStock.SACS }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "contenance" })])
    );
  });

  it("retourne 400 si contenance fournie sans uniteAchat en update", async () => {
    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ contenance: 25 }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "uniteAchat" })])
    );
  });

  it("retourne 400 si contenance <= 0 en update", async () => {
    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ uniteAchat: UniteStock.SACS, contenance: 0 }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "contenance" })])
    );
  });

  it("retourne 409 si contenance change quand stockActuel > 0", async () => {
    mockUpdateProduit.mockRejectedValue(new Error("contenance non modifiable"));

    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ uniteAchat: UniteStock.SACS, contenance: 50 }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toContain("contenance non modifiable");
  });

  it("met a jour uniteAchat + contenance avec succes", async () => {
    const updated = { ...FAKE_PRODUIT, uniteAchat: UniteStock.SACS, contenance: 25 };
    mockUpdateProduit.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/produits/prod-1", {
        method: "PUT",
        body: JSON.stringify({ uniteAchat: UniteStock.SACS, contenance: 25 }),
      }),
      { params: Promise.resolve({ id: "prod-1" }) }
    );

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/produits/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/produits/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime (soft delete) un produit", async () => {
    mockDeleteProduit.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("/api/produits/prod-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteProduit).toHaveBeenCalledWith("prod-1", "site-1");
  });

  it("retourne 404 si produit introuvable", async () => {
    mockDeleteProduit.mockRejectedValue(new Error("Produit introuvable"));

    const response = await DELETE(makeRequest("/api/produits/xxx", { method: "DELETE" }), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(makeRequest("/api/produits/prod-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "prod-1" }),
    });

    expect(response.status).toBe(401);
  });
});
