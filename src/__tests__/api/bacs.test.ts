import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/bacs/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetBacs = vi.fn();
const mockCreateBac = vi.fn();

vi.mock("@/lib/queries/bacs", () => ({
  getBacs: (...args: unknown[]) => mockGetBacs(...args),
  createBac: (...args: unknown[]) => mockCreateBac(...args),
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
  permissions: [Permission.BACS_GERER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// GET /api/bacs
// ---------------------------------------------------------------------------
describe("GET /api/bacs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des bacs avec le total", async () => {
    const fakeBacs = [
      {
        id: "bac-1",
        nom: "Bac 1",
        volume: 1000,
        nombrePoissons: null,
        vagueId: null,
        siteId: "site-1",
        vagueCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "bac-2",
        nom: "Bac 2",
        volume: 2000,
        nombrePoissons: 500,
        vagueId: "vague-1",
        siteId: "site-1",
        vagueCode: "VAGUE-2024-001",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockGetBacs.mockResolvedValue(fakeBacs);

    const response = await GET(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bacs).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.bacs[0].nom).toBe("Bac 1");
    expect(data.bacs[1].vagueCode).toBe("VAGUE-2024-001");
  });

  it("passe le siteId a getBacs", async () => {
    mockGetBacs.mockResolvedValue([]);

    await GET(makeRequest("/api/bacs"));

    expect(mockGetBacs).toHaveBeenCalledWith("site-1");
  });

  it("retourne une liste vide quand il n'y a pas de bacs", async () => {
    mockGetBacs.mockResolvedValue([]);

    const response = await GET(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bacs).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetBacs.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// POST /api/bacs
// ---------------------------------------------------------------------------
describe("POST /api/bacs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree un bac avec des donnees valides", async () => {
    const newBac = {
      id: "bac-new",
      nom: "Bac 5",
      volume: 2000,
      nombrePoissons: null,
      vagueId: null,
      siteId: "site-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreateBac.mockResolvedValue(newBac);

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac 5", volume: 2000 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nom).toBe("Bac 5");
    expect(data.volume).toBe(2000);
    expect(mockCreateBac).toHaveBeenCalledWith("site-1", {
      nom: "Bac 5",
      volume: 2000,
    });
  });

  it("cree un bac avec nombrePoissons optionnel", async () => {
    const newBac = {
      id: "bac-new",
      nom: "Bac 6",
      volume: 1500,
      nombrePoissons: 200,
      vagueId: null,
      siteId: "site-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreateBac.mockResolvedValue(newBac);

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac 6", volume: 1500, nombrePoissons: 200 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nombrePoissons).toBe(200);
  });

  it("retourne 400 si le nom est manquant", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ volume: 1000 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
    expect(data.errors.some((e: { field: string }) => e.field === "nom")).toBe(true);
  });

  it("retourne 400 si le nom est une chaine vide", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "  ", volume: 1000 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "nom")).toBe(true);
  });

  it("retourne 400 si le volume est manquant", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac X" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "volume")).toBe(true);
  });

  it("retourne 400 si le volume est 0 ou negatif", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac X", volume: 0 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "volume")).toBe(true);
  });

  it("retourne 400 si le volume est negatif", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac X", volume: -100 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "volume")).toBe(true);
  });

  it("retourne 400 avec plusieurs erreurs a la fois", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("retourne 400 si nombrePoissons est negatif", async () => {
    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac X", volume: 1000, nombrePoissons: -5 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "nombrePoissons")).toBe(true);
  });
});
