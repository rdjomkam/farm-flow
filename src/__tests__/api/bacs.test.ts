import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/bacs/route";
import { NextRequest } from "next/server";
import { Permission, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetBacs = vi.fn();
const mockCreateBac = vi.fn();

vi.mock("@/lib/queries/bacs", () => ({
  getBacs: (...args: unknown[]) => mockGetBacs(...args),
  createBac: (...args: unknown[]) => mockCreateBac(...args),
}));

// Mock check-quotas : normaliseLimite et isQuotaAtteint réels, getQuotasUsage mocké
vi.mock("@/lib/abonnements/check-quotas", () => ({
  normaliseLimite: (valeur: number) => (valeur >= 999 ? null : valeur),
  isQuotaAtteint: (ressource: { actuel: number; limite: number | null }) => {
    if (ressource.limite === null) return false;
    return ressource.actuel >= ressource.limite;
  },
  getQuotasUsage: vi.fn(),
}));

// Mock getAbonnementActif — utilisé dans la transaction POST
const mockGetAbonnementActif = vi.fn();
vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
}));

// Mock prisma.$transaction + tx.bac.count + tx.bac.create
const mockBacCount = vi.fn();
const mockBacCreate = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    bac: {
      count: (...args: unknown[]) => mockBacCount(...args),
      create: (...args: unknown[]) => mockBacCreate(...args),
    },
  },
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

/**
 * Simule prisma.$transaction(async (tx) => { ... }) en exécutant le callback
 * avec un objet "tx" dont les méthodes sont mockées.
 * Capture les erreurs internes (ex: QUOTA_DEPASSE) et les propage via .catch().
 */
function setupTransactionMock(
  bacCountResult: number,
  bacCreateResult: unknown,
  abonnementPlan?: string
) {
  // Configurer getAbonnementActif selon le plan souhaité
  if (abonnementPlan) {
    mockGetAbonnementActif.mockResolvedValue({
      id: "abo-1",
      plan: { typePlan: abonnementPlan },
    });
  } else {
    mockGetAbonnementActif.mockResolvedValue(null);
  }

  mockPrismaTransaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        bac: {
          count: vi.fn().mockResolvedValue(bacCountResult),
          create: vi.fn().mockResolvedValue(bacCreateResult),
        },
      };
      return callback(tx);
    }
  );
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
    mockGetBacs.mockResolvedValue({ data: fakeBacs, total: 2 });

    const response = await GET(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.data[0].nom).toBe("Bac 1");
    expect(data.data[1].vagueCode).toBe("VAGUE-2024-001");
  });

  it("passe le siteId a getBacs", async () => {
    mockGetBacs.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/bacs"));

    expect(mockGetBacs).toHaveBeenCalledWith("site-1", expect.any(Object));
  });

  it("retourne une liste vide quand il n'y a pas de bacs", async () => {
    mockGetBacs.mockResolvedValue({ data: [], total: 0 });

    const response = await GET(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
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
    // Plan ELEVEUR avec 1 bac existant sur 10 → quota non atteint
    setupTransactionMock(1, newBac, TypePlan.ELEVEUR);

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac 5", volume: 2000 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nom).toBe("Bac 5");
    expect(data.volume).toBe(2000);
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
    // Plan ELEVEUR avec 2 bacs existants → quota non atteint
    setupTransactionMock(2, newBac, TypePlan.ELEVEUR);

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac 6", volume: 1500, nombrePoissons: 200 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nombrePoissons).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Test d'intégration Sprint 36 : quota DECOUVERTE + 3 bacs existants → 402
  // ---------------------------------------------------------------------------

  it("plan DECOUVERTE avec 3 bacs existants → 402 QUOTA_DEPASSE", async () => {
    // Plan DECOUVERTE : limitesBacs = 3. Avec 3 bacs → quota plein.
    setupTransactionMock(3, null, TypePlan.DECOUVERTE);
    // La transaction doit lever QUOTA_DEPASSE avant tx.bac.create

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac 4", volume: 1000 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.code).toBe("QUOTA_DEPASSE");
    expect(data.message).toContain("3");
  });

  it("plan ELEVEUR avec 10 bacs existants → 402 QUOTA_DEPASSE", async () => {
    // Plan ELEVEUR : limitesBacs = 10. Avec 10 bacs → quota plein.
    setupTransactionMock(10, null, TypePlan.ELEVEUR);

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac 11", volume: 500 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.code).toBe("QUOTA_DEPASSE");
    expect(data.message).toContain("10");
  });

  it("plan ENTREPRISE (limite 999 = illimite) → creation autorisee", async () => {
    const newBac = {
      id: "bac-ent",
      nom: "Bac Entreprise",
      volume: 5000,
      nombrePoissons: null,
      vagueId: null,
      siteId: "site-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Plan ENTREPRISE : limitesBacs = 999 → normaliseLimite → null → pas de quota
    setupTransactionMock(500, newBac, TypePlan.ENTREPRISE);

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac Entreprise", volume: 5000 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("sans abonnement actif → limites DECOUVERTE appliquees (3 bacs → 402)", async () => {
    // Pas d'abonnement → DECOUVERTE par défaut → limitesBacs = 3
    setupTransactionMock(3, null, undefined); // undefined = pas d'abonnement

    const request = makeRequest("/api/bacs", {
      method: "POST",
      body: JSON.stringify({ nom: "Bac X", volume: 1000 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.code).toBe("QUOTA_DEPASSE");
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
