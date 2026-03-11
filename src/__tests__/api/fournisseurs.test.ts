import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/fournisseurs/route";
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/fournisseurs/[id]/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetFournisseurs = vi.fn();
const mockCreateFournisseur = vi.fn();
const mockGetFournisseurById = vi.fn();
const mockUpdateFournisseur = vi.fn();
const mockDeleteFournisseur = vi.fn();

vi.mock("@/lib/queries/fournisseurs", () => ({
  getFournisseurs: (...args: unknown[]) => mockGetFournisseurs(...args),
  createFournisseur: (...args: unknown[]) => mockCreateFournisseur(...args),
  getFournisseurById: (...args: unknown[]) => mockGetFournisseurById(...args),
  updateFournisseur: (...args: unknown[]) => mockUpdateFournisseur(...args),
  deleteFournisseur: (...args: unknown[]) => mockDeleteFournisseur(...args),
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
  permissions: [Permission.APPROVISIONNEMENT_VOIR, Permission.APPROVISIONNEMENT_GERER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_FOURNISSEUR = {
  id: "four-1",
  nom: "Fournisseur Aliment SA",
  telephone: "+237699000111",
  email: "contact@aliment-sa.cm",
  adresse: "Douala, Cameroun",
  isActive: true,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { produits: 3, commandes: 5 },
};

// ---------------------------------------------------------------------------
// GET /api/fournisseurs
// ---------------------------------------------------------------------------
describe("GET /api/fournisseurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des fournisseurs avec le total", async () => {
    mockGetFournisseurs.mockResolvedValue([FAKE_FOURNISSEUR]);

    const response = await GET(makeRequest("/api/fournisseurs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fournisseurs).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetFournisseurs).toHaveBeenCalledWith("site-1");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/fournisseurs"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/fournisseurs"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetFournisseurs.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/fournisseurs"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/fournisseurs
// ---------------------------------------------------------------------------
describe("POST /api/fournisseurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree un fournisseur avec tous les champs", async () => {
    const created = { ...FAKE_FOURNISSEUR, id: "four-new" };
    mockCreateFournisseur.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/fournisseurs", {
        method: "POST",
        body: JSON.stringify({
          nom: "Fournisseur Aliment SA",
          telephone: "+237699000111",
          email: "contact@aliment-sa.cm",
          adresse: "Douala, Cameroun",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("four-new");
    expect(mockCreateFournisseur).toHaveBeenCalledWith("site-1", {
      nom: "Fournisseur Aliment SA",
      telephone: "+237699000111",
      email: "contact@aliment-sa.cm",
      adresse: "Douala, Cameroun",
    });
  });

  it("cree un fournisseur avec le nom seulement", async () => {
    mockCreateFournisseur.mockResolvedValue({ id: "four-2", nom: "Simple" });

    const response = await POST(
      makeRequest("/api/fournisseurs", {
        method: "POST",
        body: JSON.stringify({ nom: "Simple" }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateFournisseur).toHaveBeenCalledWith("site-1", {
      nom: "Simple",
      telephone: undefined,
      email: undefined,
      adresse: undefined,
    });
  });

  it("retourne 400 si nom manquant", async () => {
    const response = await POST(
      makeRequest("/api/fournisseurs", {
        method: "POST",
        body: JSON.stringify({ email: "test@test.cm" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nom" }),
      ])
    );
  });

  it("retourne 400 si nom est vide", async () => {
    const response = await POST(
      makeRequest("/api/fournisseurs", {
        method: "POST",
        body: JSON.stringify({ nom: "  " }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si email invalide", async () => {
    const response = await POST(
      makeRequest("/api/fournisseurs", {
        method: "POST",
        body: JSON.stringify({ nom: "Valide", email: "pas-un-email" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
      ])
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/fournisseurs", {
        method: "POST",
        body: JSON.stringify({ nom: "Test" }),
      })
    );
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/fournisseurs/[id]
// ---------------------------------------------------------------------------
describe("GET /api/fournisseurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le fournisseur par ID", async () => {
    mockGetFournisseurById.mockResolvedValue(FAKE_FOURNISSEUR);

    const response = await GET_DETAIL(makeRequest("/api/fournisseurs/four-1"), {
      params: Promise.resolve({ id: "four-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("four-1");
    expect(mockGetFournisseurById).toHaveBeenCalledWith("four-1", "site-1");
  });

  it("retourne 404 si fournisseur introuvable", async () => {
    mockGetFournisseurById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/fournisseurs/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/fournisseurs/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/fournisseurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour un fournisseur", async () => {
    const updated = { ...FAKE_FOURNISSEUR, nom: "Nouveau Nom" };
    mockUpdateFournisseur.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/fournisseurs/four-1", {
        method: "PUT",
        body: JSON.stringify({ nom: "Nouveau Nom" }),
      }),
      { params: Promise.resolve({ id: "four-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nom).toBe("Nouveau Nom");
  });

  it("retourne 404 si fournisseur introuvable", async () => {
    mockUpdateFournisseur.mockRejectedValue(new Error("Fournisseur introuvable"));

    const response = await PUT(
      makeRequest("/api/fournisseurs/xxx", {
        method: "PUT",
        body: JSON.stringify({ nom: "X" }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/fournisseurs/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/fournisseurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime (soft delete) un fournisseur", async () => {
    mockDeleteFournisseur.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("/api/fournisseurs/four-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "four-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteFournisseur).toHaveBeenCalledWith("four-1", "site-1");
  });

  it("retourne 404 si fournisseur introuvable", async () => {
    mockDeleteFournisseur.mockRejectedValue(new Error("Fournisseur introuvable"));

    const response = await DELETE(makeRequest("/api/fournisseurs/xxx", { method: "DELETE" }), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(makeRequest("/api/fournisseurs/four-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "four-1" }),
    });

    expect(response.status).toBe(403);
  });
});
