/**
 * Tests d'intégration — Routes /api/portefeuille (Sprint 34)
 *
 * Couvre :
 * - GET /portefeuille — retourne solde + commissions
 * - POST /portefeuille/retrait — solde suffisant → retrait créé
 * - POST /portefeuille/retrait — solde insuffisant → 400
 * - POST /portefeuille/retrait/[id]/traiter — admin → retrait traité
 * - GET /portefeuille/retrait/[id] — détail d'un retrait
 *
 * Story 34.5 — Sprint 34
 * R2 : enums StatutPaiementAbo, Permission importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_PORTEFEUILLE } from "@/app/api/portefeuille/route";
import { POST as POST_RETRAIT } from "@/app/api/portefeuille/retrait/route";
import { POST as POST_TRAITER } from "@/app/api/portefeuille/retrait/[id]/traiter/route";
import { GET as GET_RETRAIT } from "@/app/api/portefeuille/retrait/[id]/route";
import { NextRequest } from "next/server";
import { Permission, StatutPaiementAbo, FournisseurPaiement } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPortefeuille = vi.fn();

vi.mock("@/lib/queries/commissions", () => ({
  getPortefeuille: (...args: unknown[]) => mockGetPortefeuille(...args),
  demanderRetrait: (...args: unknown[]) => mockDemanderRetrait(...args),
  traiterRetrait: (...args: unknown[]) => mockTraiterRetrait(...args),
}));

const mockDemanderRetrait = vi.fn();
const mockTraiterRetrait = vi.fn();
const mockPrismaRetraitFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    retraitPortefeuille: {
      findUnique: (...args: unknown[]) => mockPrismaRetraitFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/queries/sites", () => ({
  isPlatformSite: vi.fn().mockResolvedValue(true),
  getPlatformSite: vi.fn().mockResolvedValue({ id: "site-platform", name: "DKFarm", isPlatform: true }),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthContext(
  userId = "user-1",
  permissions: Permission[] = [Permission.PORTEFEUILLE_VOIR]
) {
  return {
    userId,
    email: "test@example.com",
    phone: null,
    name: "Test User",
    globalRole: "INGENIEUR",
    activeSiteId: "site-1",
    siteRoleId: "role-1",
    siteRoleName: "Ingénieur",
    permissions,
  };
}

function makeRequest(
  url: string,
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// GET /portefeuille
// ---------------------------------------------------------------------------

describe("GET /api/portefeuille", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("200 — retourne solde + commissions récentes", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());
    mockGetPortefeuille.mockResolvedValue({
      portefeuille: {
        id: "wallet-1",
        ingenieurId: "user-1",
        solde: "5000",
        soldePending: "2000",
        totalGagne: "15000",
        totalPaye: "10000",
        retraits: [],
      },
      commissionsRecentes: [],
    });

    const request = makeRequest("http://localhost/api/portefeuille");
    const response = await GET_PORTEFEUILLE(request);
    const data = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.portefeuille).toBeDefined();
  });

  it("200 — retourne portefeuille vide si pas encore créé", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());
    mockGetPortefeuille.mockResolvedValue({
      portefeuille: null,
      commissionsRecentes: [],
    });

    const request = makeRequest("http://localhost/api/portefeuille");
    const response = await GET_PORTEFEUILLE(request);
    const data = await response.json() as { portefeuille: { solde: number } };

    expect(response.status).toBe(200);
    expect(data.portefeuille.solde).toBe(0);
  });

  it("401 — non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const request = makeRequest("http://localhost/api/portefeuille");
    const response = await GET_PORTEFEUILLE(request);

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /portefeuille/retrait
// ---------------------------------------------------------------------------

describe("POST /api/portefeuille/retrait", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("201 — solde suffisant → retrait créé", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());
    mockDemanderRetrait.mockResolvedValue({
      id: "retrait-1",
      montant: "10000",
      statut: StatutPaiementAbo.EN_ATTENTE,
    });

    const request = makeRequest("http://localhost/api/portefeuille/retrait", {
      montant: 10000,
      phoneNumber: "+237690000001",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const response = await POST_RETRAIT(request);
    const data = await response.json() as { retrait: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(data.retrait).toBeDefined();
  });

  it("400 — solde insuffisant → message clair", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());
    mockDemanderRetrait.mockRejectedValue(
      new Error("Solde insuffisant : 3000 FCFA disponibles, 10000 FCFA demandés")
    );

    const request = makeRequest("http://localhost/api/portefeuille/retrait", {
      montant: 10000,
      phoneNumber: "+237690000001",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const response = await POST_RETRAIT(request);
    const data = await response.json() as { status: number; message: string };

    expect(response.status).toBe(400);
    expect(data.message).toContain("Solde insuffisant");
  });

  it("400 — montant en dessous du minimum (5000 FCFA)", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());

    const request = makeRequest("http://localhost/api/portefeuille/retrait", {
      montant: 1000,
      phoneNumber: "+237690000001",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const response = await POST_RETRAIT(request);
    const data = await response.json() as { status: number; errors: unknown[] };

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("400 — numéro de téléphone manquant", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());

    const request = makeRequest("http://localhost/api/portefeuille/retrait", {
      montant: 10000,
      phoneNumber: "",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const response = await POST_RETRAIT(request);
    const data = await response.json() as { status: number; errors: unknown[] };

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("401 — non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const request = makeRequest("http://localhost/api/portefeuille/retrait", {
      montant: 10000,
      phoneNumber: "+237690000001",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const response = await POST_RETRAIT(request);

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /portefeuille/retrait/[id]/traiter
// ---------------------------------------------------------------------------

describe("POST /api/portefeuille/retrait/[id]/traiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("200 — admin traite le retrait avec CONFIRME", async () => {
    mockRequirePermission.mockResolvedValue(
      makeAuthContext("admin-1", [Permission.PORTEFEUILLE_GERER])
    );
    mockTraiterRetrait.mockResolvedValue({ count: 1 });

    const request = makeRequest("http://localhost/api/portefeuille/retrait/retrait-1/traiter", {
      statut: StatutPaiementAbo.CONFIRME,
      referenceExterne: "MTN20260328XXXX",
    });

    const response = await POST_TRAITER(request, {
      params: Promise.resolve({ id: "retrait-1" }),
    });
    const data = await response.json() as { success: boolean; count: number };

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(1);
  });

  it("404 — retrait introuvable ou déjà traité", async () => {
    mockRequirePermission.mockResolvedValue(
      makeAuthContext("admin-1", [Permission.PORTEFEUILLE_GERER])
    );
    mockTraiterRetrait.mockResolvedValue({ count: 0 });

    const request = makeRequest("http://localhost/api/portefeuille/retrait/retrait-inexistant/traiter", {
      statut: StatutPaiementAbo.CONFIRME,
      referenceExterne: "MTN20260328XXXX",
    });

    const response = await POST_TRAITER(request, {
      params: Promise.resolve({ id: "retrait-inexistant" }),
    });

    expect(response.status).toBe(404);
  });

  it("400 — référence de virement manquante", async () => {
    mockRequirePermission.mockResolvedValue(
      makeAuthContext("admin-1", [Permission.PORTEFEUILLE_GERER])
    );

    const request = makeRequest("http://localhost/api/portefeuille/retrait/retrait-1/traiter", {
      statut: StatutPaiementAbo.CONFIRME,
      referenceExterne: "",
    });

    const response = await POST_TRAITER(request, {
      params: Promise.resolve({ id: "retrait-1" }),
    });
    const data = await response.json() as { status: number; errors: unknown[] };

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("403 — sans permission PORTEFEUILLE_GERER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));

    const request = makeRequest("http://localhost/api/portefeuille/retrait/retrait-1/traiter", {
      statut: StatutPaiementAbo.CONFIRME,
      referenceExterne: "MTN20260328XXXX",
    });

    const response = await POST_TRAITER(request, {
      params: Promise.resolve({ id: "retrait-1" }),
    });

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /portefeuille/retrait/[id]
// ---------------------------------------------------------------------------

describe("GET /api/portefeuille/retrait/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("200 — ingénieur voit son propre retrait", async () => {
    const userId = "user-1";
    mockRequirePermission.mockResolvedValue(makeAuthContext(userId));
    mockPrismaRetraitFindUnique.mockResolvedValue({
      id: "retrait-1",
      montant: "10000",
      statut: StatutPaiementAbo.EN_ATTENTE,
      portefeuille: {
        id: "wallet-1",
        ingenieurId: userId, // Même utilisateur
        solde: "5000",
      },
      demandeur: { id: userId, name: "Ingénieur Test" },
      traiteur: null,
    });

    const request = makeRequest("http://localhost/api/portefeuille/retrait/retrait-1");
    const response = await GET_RETRAIT(request, {
      params: Promise.resolve({ id: "retrait-1" }),
    });

    expect(response.status).toBe(200);
  });

  it("403 — ingénieur ne peut pas voir le retrait d'un autre", async () => {
    const userId = "user-1";
    mockRequirePermission.mockResolvedValue(makeAuthContext(userId, [Permission.PORTEFEUILLE_VOIR]));
    mockPrismaRetraitFindUnique.mockResolvedValue({
      id: "retrait-2",
      montant: "10000",
      statut: StatutPaiementAbo.EN_ATTENTE,
      portefeuille: {
        id: "wallet-2",
        ingenieurId: "autre-ingenieur", // Autre utilisateur
        solde: "5000",
      },
      demandeur: { id: "autre-ingenieur", name: "Autre Ingénieur" },
      traiteur: null,
    });

    const request = makeRequest("http://localhost/api/portefeuille/retrait/retrait-2");
    const response = await GET_RETRAIT(request, {
      params: Promise.resolve({ id: "retrait-2" }),
    });

    expect(response.status).toBe(403);
  });

  it("404 — retrait inexistant", async () => {
    mockRequirePermission.mockResolvedValue(makeAuthContext());
    mockPrismaRetraitFindUnique.mockResolvedValue(null);

    const request = makeRequest("http://localhost/api/portefeuille/retrait/inexistant");
    const response = await GET_RETRAIT(request, {
      params: Promise.resolve({ id: "inexistant" }),
    });

    expect(response.status).toBe(404);
  });
});
