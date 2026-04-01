/**
 * Tests for the idempotency helper (CR4.2)
 *
 * Covers:
 *  - hashBody() stability and ordering
 *  - checkIdempotency() with body hash comparison
 *  - storeIdempotency() stores body hash
 *  - Integration on POST /api/ventes, /api/commandes, /api/stock/mouvements
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { hashBody } from "@/lib/idempotency";
import { NextRequest } from "next/server";
import { Permission, TypeMouvement, StatutCommande } from "@/types";
import type { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    idempotencyRecord: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock permissions + auth
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mock query functions
// ---------------------------------------------------------------------------

const mockCreateVente = vi.fn();
const mockGetVentes = vi.fn();
vi.mock("@/lib/queries/ventes", () => ({
  createVente: (...args: unknown[]) => mockCreateVente(...args),
  getVentes: (...args: unknown[]) => mockGetVentes(...args),
}));

const mockCreateCommande = vi.fn();
const mockGetCommandes = vi.fn();
vi.mock("@/lib/queries/commandes", () => ({
  createCommande: (...args: unknown[]) => mockCreateCommande(...args),
  getCommandes: (...args: unknown[]) => mockGetCommandes(...args),
  getCommandeById: vi.fn(),
  envoyerCommande: vi.fn(),
  annulerCommande: vi.fn(),
}));

const mockCreateMouvement = vi.fn();
const mockGetMouvements = vi.fn();
vi.mock("@/lib/queries/mouvements", () => ({
  createMouvement: (...args: unknown[]) => mockCreateMouvement(...args),
  getMouvements: (...args: unknown[]) => mockGetMouvements(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [
    Permission.VENTES_VOIR,
    Permission.VENTES_CREER,
    Permission.APPROVISIONNEMENT_VOIR,
    Permission.APPROVISIONNEMENT_GERER,
    Permission.STOCK_VOIR,
    Permission.STOCK_GERER,
  ],
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

function makeIdempotentRequest(url: string, body: unknown, key = "test-key-123") {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "X-Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// hashBody tests
// ---------------------------------------------------------------------------

describe("hashBody()", () => {
  it("produces a deterministic hex string", () => {
    const body = { a: 1, b: "hello" };
    const h1 = hashBody(body);
    const h2 = hashBody(body);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is order-independent (same hash regardless of key order)", () => {
    const h1 = hashBody({ z: 3, a: 1, m: 2 });
    const h2 = hashBody({ a: 1, m: 2, z: 3 });
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different bodies", () => {
    const h1 = hashBody({ amount: 100 });
    const h2 = hashBody({ amount: 200 });
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// checkIdempotency / storeIdempotency unit tests
// ---------------------------------------------------------------------------

describe("checkIdempotency()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isDuplicate: false when no record exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    const { checkIdempotency } = await import("@/lib/idempotency");
    const result = await checkIdempotency("key-1", "site-1");
    expect(result).toEqual({ isDuplicate: false });
  });

  it("returns isDuplicate: true with cached response when record matches", async () => {
    mockFindUnique.mockResolvedValue({
      key: "key-1",
      siteId: "site-1",
      response: { id: "v-1" },
      statusCode: 201,
      bodyHash: null,
    });
    const { checkIdempotency } = await import("@/lib/idempotency");
    const result = await checkIdempotency("key-1", "site-1");
    expect(result).toMatchObject({ isDuplicate: true, statusCode: 201 });
  });

  it("returns isDuplicate: false when siteId does not match", async () => {
    mockFindUnique.mockResolvedValue({
      key: "key-1",
      siteId: "site-other",
      response: { id: "v-1" },
      statusCode: 201,
      bodyHash: null,
    });
    const { checkIdempotency } = await import("@/lib/idempotency");
    const result = await checkIdempotency("key-1", "site-1");
    expect(result).toEqual({ isDuplicate: false });
  });

  it("returns isDuplicate: true when bodyHash matches", async () => {
    const bHash = hashBody({ amount: 500 });
    mockFindUnique.mockResolvedValue({
      key: "key-1",
      siteId: "site-1",
      response: { id: "v-1" },
      statusCode: 201,
      bodyHash: bHash,
    });
    const { checkIdempotency } = await import("@/lib/idempotency");
    const result = await checkIdempotency("key-1", "site-1", bHash);
    expect(result).toMatchObject({ isDuplicate: true });
  });

  it("returns isConflict: true when same key but different body hash", async () => {
    const storedHash = hashBody({ amount: 500 });
    const newHash = hashBody({ amount: 999 });
    mockFindUnique.mockResolvedValue({
      key: "key-1",
      siteId: "site-1",
      response: { id: "v-1" },
      statusCode: 201,
      bodyHash: storedHash,
    });
    const { checkIdempotency } = await import("@/lib/idempotency");
    const result = await checkIdempotency("key-1", "site-1", newHash);
    expect(result).toMatchObject({ isConflict: true });
  });

  it("returns isDuplicate: false when no key is provided", async () => {
    const { checkIdempotency } = await import("@/lib/idempotency");
    const result = await checkIdempotency(null, "site-1");
    expect(result).toEqual({ isDuplicate: false });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/ventes — idempotency integration
// ---------------------------------------------------------------------------

describe("POST /api/ventes — idempotency", () => {
  let POST: (req: NextRequest) => Promise<NextResponse>;

  beforeAll(async () => {
    const mod = await import("@/app/api/ventes/route");
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validVenteBody = {
    clientId: "client-1",
    vagueId: "vague-1",
    quantitePoissons: 50,
    poidsTotalKg: 25,
    prixUnitaireKg: 2000,
  };

  const FAKE_VENTE = { id: "v-1", numero: "VTE-2026-001", montantTotal: 50000 };

  it("cree la vente et stocke l'enregistrement idempotent", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    mockCreateVente.mockResolvedValue(FAKE_VENTE);

    const response = await POST(
      makeIdempotentRequest("/api/ventes", validVenteBody, "key-v-1")
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "key-v-1" },
        create: expect.objectContaining({ key: "key-v-1", siteId: "site-1", statusCode: 201 }),
      })
    );
  });

  it("rejoue la reponse pour une cle identique avec le meme body", async () => {
    const bHash = hashBody(validVenteBody);
    mockFindUnique.mockResolvedValue({
      key: "key-v-1",
      siteId: "site-1",
      response: FAKE_VENTE,
      statusCode: 201,
      bodyHash: bHash,
    });

    const response = await POST(
      makeIdempotentRequest("/api/ventes", validVenteBody, "key-v-1")
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe("v-1");
    expect(mockCreateVente).not.toHaveBeenCalled();
  });

  it("retourne 409 pour une cle identique avec un body different", async () => {
    const storedHash = hashBody(validVenteBody);
    mockFindUnique.mockResolvedValue({
      key: "key-v-1",
      siteId: "site-1",
      response: FAKE_VENTE,
      statusCode: 201,
      bodyHash: storedHash,
    });

    const differentBody = { ...validVenteBody, poidsTotalKg: 99 };

    const response = await POST(
      makeIdempotentRequest("/api/ventes", differentBody, "key-v-1")
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toContain("corps de requete different");
    expect(mockCreateVente).not.toHaveBeenCalled();
  });

  it("fonctionne normalement sans cle d'idempotence", async () => {
    mockCreateVente.mockResolvedValue(FAKE_VENTE);

    const response = await POST(
      makeRequest("/api/ventes", {
        method: "POST",
        body: JSON.stringify(validVenteBody),
      })
    );

    expect(response.status).toBe(201);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/commandes — idempotency integration
// ---------------------------------------------------------------------------

describe("POST /api/commandes — idempotency", () => {
  let POST: (req: NextRequest) => Promise<NextResponse>;

  beforeAll(async () => {
    const mod = await import("@/app/api/commandes/route");
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validCommandeBody = {
    fournisseurId: "four-1",
    dateCommande: "2026-03-01T00:00:00.000Z",
    lignes: [{ produitId: "prod-1", quantite: 100, prixUnitaire: 5000 }],
  };

  const FAKE_COMMANDE = {
    id: "cmd-1",
    numero: "CMD-2026-001",
    statut: StatutCommande.BROUILLON,
    montantTotal: 500000,
  };

  it("cree la commande et stocke l'enregistrement idempotent", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    mockCreateCommande.mockResolvedValue(FAKE_COMMANDE);

    const response = await POST(
      makeIdempotentRequest("/api/commandes", validCommandeBody, "key-c-1")
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "key-c-1" },
        create: expect.objectContaining({ key: "key-c-1", siteId: "site-1", statusCode: 201 }),
      })
    );
  });

  it("rejoue la reponse pour une cle identique avec le meme body", async () => {
    const bHash = hashBody(validCommandeBody);
    mockFindUnique.mockResolvedValue({
      key: "key-c-1",
      siteId: "site-1",
      response: FAKE_COMMANDE,
      statusCode: 201,
      bodyHash: bHash,
    });

    const response = await POST(
      makeIdempotentRequest("/api/commandes", validCommandeBody, "key-c-1")
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe("cmd-1");
    expect(mockCreateCommande).not.toHaveBeenCalled();
  });

  it("retourne 409 pour une cle identique avec un body different", async () => {
    const storedHash = hashBody(validCommandeBody);
    mockFindUnique.mockResolvedValue({
      key: "key-c-1",
      siteId: "site-1",
      response: FAKE_COMMANDE,
      statusCode: 201,
      bodyHash: storedHash,
    });

    const differentBody = { ...validCommandeBody, fournisseurId: "four-2" };

    const response = await POST(
      makeIdempotentRequest("/api/commandes", differentBody, "key-c-1")
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toContain("corps de requete different");
    expect(mockCreateCommande).not.toHaveBeenCalled();
  });

  it("fonctionne normalement sans cle d'idempotence", async () => {
    mockCreateCommande.mockResolvedValue(FAKE_COMMANDE);

    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify(validCommandeBody),
      })
    );

    expect(response.status).toBe(201);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/stock/mouvements — idempotency integration
// ---------------------------------------------------------------------------

describe("POST /api/stock/mouvements — idempotency", () => {
  let POST: (req: NextRequest) => Promise<NextResponse>;

  beforeAll(async () => {
    const mod = await import("@/app/api/stock/mouvements/route");
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validMouvementBody = {
    produitId: "prod-1",
    type: TypeMouvement.ENTREE,
    quantite: 100,
    date: "2026-03-01T00:00:00.000Z",
    prixTotal: 500000,
  };

  const FAKE_MOUVEMENT = {
    id: "mouv-1",
    produitId: "prod-1",
    type: TypeMouvement.ENTREE,
    quantite: 100,
  };

  it("cree le mouvement et stocke l'enregistrement idempotent", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    mockCreateMouvement.mockResolvedValue(FAKE_MOUVEMENT);

    const response = await POST(
      makeIdempotentRequest("/api/stock/mouvements", validMouvementBody, "key-m-1")
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "key-m-1" },
        create: expect.objectContaining({ key: "key-m-1", siteId: "site-1", statusCode: 201 }),
      })
    );
  });

  it("rejoue la reponse pour une cle identique avec le meme body", async () => {
    const bHash = hashBody(validMouvementBody);
    mockFindUnique.mockResolvedValue({
      key: "key-m-1",
      siteId: "site-1",
      response: FAKE_MOUVEMENT,
      statusCode: 201,
      bodyHash: bHash,
    });

    const response = await POST(
      makeIdempotentRequest("/api/stock/mouvements", validMouvementBody, "key-m-1")
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe("mouv-1");
    expect(mockCreateMouvement).not.toHaveBeenCalled();
  });

  it("retourne 409 pour une cle identique avec un body different", async () => {
    const storedHash = hashBody(validMouvementBody);
    mockFindUnique.mockResolvedValue({
      key: "key-m-1",
      siteId: "site-1",
      response: FAKE_MOUVEMENT,
      statusCode: 201,
      bodyHash: storedHash,
    });

    const differentBody = { ...validMouvementBody, quantite: 999 };

    const response = await POST(
      makeIdempotentRequest("/api/stock/mouvements", differentBody, "key-m-1")
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toContain("corps de requete different");
    expect(mockCreateMouvement).not.toHaveBeenCalled();
  });

  it("fonctionne normalement sans cle d'idempotence", async () => {
    mockCreateMouvement.mockResolvedValue(FAKE_MOUVEMENT);

    const response = await POST(
      makeRequest("/api/stock/mouvements", {
        method: "POST",
        body: JSON.stringify(validMouvementBody),
      })
    );

    expect(response.status).toBe(201);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
