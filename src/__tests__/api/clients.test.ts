import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_list, POST } from "@/app/api/clients/route";
import {
  GET as GET_detail,
  PUT,
  DELETE,
} from "@/app/api/clients/[id]/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetClients = vi.fn();
const mockCreateClient = vi.fn();
const mockGetClientById = vi.fn();
const mockUpdateClient = vi.fn();
const mockDeleteClient = vi.fn();

vi.mock("@/lib/queries/clients", () => ({
  getClients: (...args: unknown[]) => mockGetClients(...args),
  createClient: (...args: unknown[]) => mockCreateClient(...args),
  getClientById: (...args: unknown[]) => mockGetClientById(...args),
  updateClient: (...args: unknown[]) => mockUpdateClient(...args),
  deleteClient: (...args: unknown[]) => mockDeleteClient(...args),
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
  permissions: [Permission.CLIENTS_VOIR, Permission.CLIENTS_GERER],
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------
describe("GET /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des clients", async () => {
    const fakeClients = [
      { id: "c-1", nom: "Restaurant Le Silure", telephone: "655000001", isActive: true },
      { id: "c-2", nom: "Marche Central", telephone: null, isActive: true },
    ];
    mockGetClients.mockResolvedValue(fakeClients);

    const response = await GET_list(makeRequest("/api/clients"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.clients).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.clients[0].nom).toBe("Restaurant Le Silure");
  });

  it("passe siteId aux queries", async () => {
    mockGetClients.mockResolvedValue([]);

    await GET_list(makeRequest("/api/clients"));

    expect(mockGetClients).toHaveBeenCalledWith("site-1");
  });

  it("requiert la permission CLIENTS_VOIR", async () => {
    mockGetClients.mockResolvedValue([]);

    await GET_list(makeRequest("/api/clients"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.CLIENTS_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetClients.mockRejectedValue(new Error("DB error"));

    const response = await GET_list(makeRequest("/api/clients"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------
describe("POST /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree un client avec des donnees valides", async () => {
    const fakeClient = { id: "c-new", nom: "Nouveau Client", isActive: true };
    mockCreateClient.mockResolvedValue(fakeClient);

    const response = await POST(
      makeRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          nom: "Nouveau Client",
          telephone: "655111222",
          email: "client@test.cm",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nom).toBe("Nouveau Client");
    expect(mockCreateClient).toHaveBeenCalledWith("site-1", {
      nom: "Nouveau Client",
      telephone: "+237655111222",
      email: "client@test.cm",
      adresse: undefined,
    });
  });

  it("retourne 400 si nom manquant", async () => {
    const response = await POST(
      makeRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({ telephone: "655000000" }),
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

  it("retourne 400 si nom est une chaine vide", async () => {
    const response = await POST(
      makeRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({ nom: "   " }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors[0].field).toBe("nom");
  });

  it("retourne 400 si email invalide", async () => {
    const response = await POST(
      makeRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({ nom: "Client Test", email: "invalid-email" }),
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

  it("requiert la permission CLIENTS_GERER", async () => {
    mockCreateClient.mockResolvedValue({ id: "c-1", nom: "Test" });

    await POST(
      makeRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({ nom: "Test" }),
      })
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.CLIENTS_GERER
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockCreateClient.mockRejectedValue(new Error("DB error"));

    const response = await POST(
      makeRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({ nom: "Client" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/clients/[id]
// ---------------------------------------------------------------------------
describe("GET /api/clients/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le detail d'un client", async () => {
    const fakeClient = { id: "c-1", nom: "Restaurant Le Silure", telephone: "655000001" };
    mockGetClientById.mockResolvedValue(fakeClient);

    const response = await GET_detail(
      makeRequest("/api/clients/c-1"),
      { params: Promise.resolve({ id: "c-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nom).toBe("Restaurant Le Silure");
    expect(mockGetClientById).toHaveBeenCalledWith("c-1", "site-1");
  });

  it("retourne 404 si client introuvable", async () => {
    mockGetClientById.mockResolvedValue(null);

    const response = await GET_detail(
      makeRequest("/api/clients/unknown"),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetClientById.mockRejectedValue(new Error("DB error"));

    const response = await GET_detail(
      makeRequest("/api/clients/c-1"),
      { params: Promise.resolve({ id: "c-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/clients/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/clients/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour un client", async () => {
    const updated = { id: "c-1", nom: "Nouveau Nom", isActive: true };
    mockUpdateClient.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/clients/c-1", {
        method: "PUT",
        body: JSON.stringify({ nom: "Nouveau Nom" }),
      }),
      { params: Promise.resolve({ id: "c-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nom).toBe("Nouveau Nom");
    expect(mockUpdateClient).toHaveBeenCalledWith("c-1", "site-1", { nom: "Nouveau Nom" });
  });

  it("peut desactiver un client", async () => {
    mockUpdateClient.mockResolvedValue({ id: "c-1", isActive: false });

    await PUT(
      makeRequest("/api/clients/c-1", {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "c-1" }) }
    );

    expect(mockUpdateClient).toHaveBeenCalledWith("c-1", "site-1", { isActive: false });
  });

  it("retourne 404 si client introuvable", async () => {
    mockUpdateClient.mockRejectedValue(new Error("Client introuvable."));

    const response = await PUT(
      makeRequest("/api/clients/unknown", {
        method: "PUT",
        body: JSON.stringify({ nom: "Test" }),
      }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("requiert la permission CLIENTS_GERER", async () => {
    mockUpdateClient.mockResolvedValue({ id: "c-1" });

    await PUT(
      makeRequest("/api/clients/c-1", {
        method: "PUT",
        body: JSON.stringify({ nom: "X" }),
      }),
      { params: Promise.resolve({ id: "c-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.CLIENTS_GERER
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/clients/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/clients/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime un client", async () => {
    mockDeleteClient.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/clients/c-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "c-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteClient).toHaveBeenCalledWith("c-1", "site-1");
  });

  it("retourne 404 si client introuvable", async () => {
    mockDeleteClient.mockRejectedValue(new Error("Client introuvable."));

    const response = await DELETE(
      makeRequest("/api/clients/unknown", { method: "DELETE" }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("requiert la permission CLIENTS_GERER", async () => {
    mockDeleteClient.mockResolvedValue(undefined);

    await DELETE(
      makeRequest("/api/clients/c-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "c-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.CLIENTS_GERER
    );
  });
});
