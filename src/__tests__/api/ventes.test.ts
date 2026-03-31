import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_list, POST } from "@/app/api/ventes/route";
import { GET as GET_detail } from "@/app/api/ventes/[id]/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetVentes = vi.fn();
const mockCreateVente = vi.fn();
const mockGetVenteById = vi.fn();

vi.mock("@/lib/queries/ventes", () => ({
  getVentes: (...args: unknown[]) => mockGetVentes(...args),
  createVente: (...args: unknown[]) => mockCreateVente(...args),
  getVenteById: (...args: unknown[]) => mockGetVenteById(...args),
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
  permissions: [Permission.VENTES_VOIR, Permission.VENTES_CREER],
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// GET /api/ventes
// ---------------------------------------------------------------------------
describe("GET /api/ventes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des ventes", async () => {
    const fakeVentes = [
      {
        id: "v-1",
        numero: "VTE-2026-001",
        quantitePoissons: 50,
        poidsTotalKg: 25,
        prixUnitaireKg: 2000,
        montantTotal: 50000,
        client: { nom: "Restaurant Le Silure" },
        vague: { code: "VAGUE-2026-001" },
      },
    ];
    mockGetVentes.mockResolvedValue({ data: fakeVentes, total: 1 });

    const response = await GET_list(makeRequest("/api/ventes"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.data[0].numero).toBe("VTE-2026-001");
  });

  it("passe siteId et filtres aux queries", async () => {
    mockGetVentes.mockResolvedValue({ data: [], total: 0 });

    await GET_list(makeRequest("/api/ventes?clientId=c-1&vagueId=v-1"));

    expect(mockGetVentes).toHaveBeenCalledWith("site-1", {
      clientId: "c-1",
      vagueId: "v-1",
    }, expect.any(Object));
  });

  it("passe les filtres de date", async () => {
    mockGetVentes.mockResolvedValue({ data: [], total: 0 });

    await GET_list(makeRequest("/api/ventes?dateFrom=2026-01-01&dateTo=2026-03-31"));

    expect(mockGetVentes).toHaveBeenCalledWith("site-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    }, expect.any(Object));
  });

  it("requiert la permission VENTES_VOIR", async () => {
    mockGetVentes.mockResolvedValue([]);

    await GET_list(makeRequest("/api/ventes"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.VENTES_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetVentes.mockRejectedValue(new Error("DB error"));

    const response = await GET_list(makeRequest("/api/ventes"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// POST /api/ventes
// ---------------------------------------------------------------------------
describe("POST /api/ventes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    clientId: "c-1",
    vagueId: "v-1",
    quantitePoissons: 50,
    poidsTotalKg: 25,
    prixUnitaireKg: 2000,
    notes: "Livraison mardi",
  };

  it("cree une vente avec des donnees valides", async () => {
    const fakeVente = {
      id: "vte-new",
      numero: "VTE-2026-002",
      montantTotal: 50000,
      ...validBody,
    };
    mockCreateVente.mockResolvedValue(fakeVente);

    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.numero).toBe("VTE-2026-002");
    expect(mockCreateVente).toHaveBeenCalledWith("site-1", "user-1", {
      clientId: "c-1",
      vagueId: "v-1",
      quantitePoissons: 50,
      poidsTotalKg: 25,
      prixUnitaireKg: 2000,
      notes: "Livraison mardi",
    });
  });

  it("retourne 400 si clientId manquant", async () => {
    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, clientId: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "clientId" })])
    );
  });

  it("retourne 400 si vagueId manquant", async () => {
    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, vagueId: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "vagueId" })])
    );
  });

  it("retourne 400 si quantitePoissons <= 0", async () => {
    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, quantitePoissons: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "quantitePoissons" })])
    );
  });

  it("retourne 400 si poidsTotalKg <= 0", async () => {
    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, poidsTotalKg: -5 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poidsTotalKg" })])
    );
  });

  it("retourne 400 si prixUnitaireKg <= 0", async () => {
    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, prixUnitaireKg: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "prixUnitaireKg" })])
    );
  });

  it("retourne 409 si stock insuffisant", async () => {
    mockCreateVente.mockRejectedValue(new Error("Stock de poissons insuffisant dans cette vague."));

    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("insuffisant");
  });

  it("retourne 404 si client introuvable", async () => {
    mockCreateVente.mockRejectedValue(new Error("Client introuvable ou inactif."));

    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("requiert la permission VENTES_CREER", async () => {
    mockCreateVente.mockResolvedValue({ id: "v-1" });

    await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.VENTES_CREER
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockCreateVente.mockRejectedValue(new Error("DB error"));

    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/ventes/[id]
// ---------------------------------------------------------------------------
describe("GET /api/ventes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le detail d'une vente", async () => {
    const fakeVente = {
      id: "v-1",
      numero: "VTE-2026-001",
      quantitePoissons: 50,
      poidsTotalKg: 25,
      prixUnitaireKg: 2000,
      montantTotal: 50000,
      client: { id: "c-1", nom: "Restaurant Le Silure" },
      vague: { id: "vg-1", code: "VAGUE-2026-001" },
    };
    mockGetVenteById.mockResolvedValue(fakeVente);

    const response = await GET_detail(
      makeRequest("/api/ventes/v-1"),
      { params: Promise.resolve({ id: "v-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.numero).toBe("VTE-2026-001");
    expect(data.client.nom).toBe("Restaurant Le Silure");
    expect(mockGetVenteById).toHaveBeenCalledWith("v-1", "site-1");
  });

  it("retourne 404 si vente introuvable", async () => {
    mockGetVenteById.mockResolvedValue(null);

    const response = await GET_detail(
      makeRequest("/api/ventes/unknown"),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetVenteById.mockRejectedValue(new Error("DB error"));

    const response = await GET_detail(
      makeRequest("/api/ventes/v-1"),
      { params: Promise.resolve({ id: "v-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
  });
});
