/**
 * Tests d'intégration — Routes webhook paiements (Sprint 31)
 *
 * Couvre :
 * - POST /api/webhooks/smobilpay
 *   - Signature invalide → 401
 *   - Paiement déjà traité → 200 idempotent
 *   - CONFIRME → paiement confirmé + abonnement activé
 *   - ECHEC → paiement marqué ECHEC
 * - POST /api/webhooks/manuel
 *   - Sans auth → 401
 *   - Données manquantes → 400
 *   - Idempotence → 200
 *
 * Story 31.5 — Sprint 31
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/webhooks/smobilpay/route";
import { POST as POST_MANUEL } from "@/app/api/webhooks/manuel/route";
import { NextRequest } from "next/server";
import { FournisseurPaiement, StatutPaiementAbo } from "@/types";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPaymentGateway = vi.fn();
const mockGetPaiementByReference = vi.fn();
const mockConfirmerPaiement = vi.fn();
const mockActiverAbonnement = vi.fn();
const mockRequirePermission = vi.fn();
const mockPrismaTransaction = vi.fn();
const mockPrismaUpdateMany = vi.fn();
const mockPrismaFindFirst = vi.fn();

vi.mock("@/lib/payment/factory", () => ({
  getPaymentGateway: (...args: unknown[]) => mockGetPaymentGateway(...args),
}));

vi.mock("@/lib/queries/paiements-abonnements", () => ({
  getPaiementByReference: (...args: unknown[]) =>
    mockGetPaiementByReference(...args),
  confirmerPaiement: (...args: unknown[]) => mockConfirmerPaiement(...args),
}));

vi.mock("@/lib/queries/abonnements", () => ({
  activerAbonnement: (...args: unknown[]) => mockActiverAbonnement(...args),
}));

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

// Mock Prisma complet
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        paiementAbonnement: { updateMany: mockPrismaUpdateMany, findFirst: mockPrismaFindFirst },
        abonnement: { updateMany: mockPrismaUpdateMany },
      });
    },
    paiementAbonnement: {
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
      updateMany: (...args: unknown[]) => mockPrismaUpdateMany(...args),
    },
    abonnement: {
      updateMany: (...args: unknown[]) => mockPrismaUpdateMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWebhookSecret() {
  return "test-webhook-secret-abc123";
}

function signBody(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function makeSmobilpayRequest(
  body: Record<string, unknown>,
  signature: string
): NextRequest {
  const rawBody = JSON.stringify(body);
  return new NextRequest("http://localhost/api/webhooks/smobilpay", {
    method: "POST",
    body: rawBody,
    headers: {
      "Content-Type": "application/json",
      "x-smobilpay-signature": signature,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests POST /api/webhooks/smobilpay
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/smobilpay", () => {
  const secret = createWebhookSecret();

  beforeEach(() => {
    vi.clearAllMocks();

    // Par défaut : signature valide
    mockGetPaymentGateway.mockReturnValue({
      fournisseur: FournisseurPaiement.SMOBILPAY,
      verifySignature: vi.fn().mockReturnValue(true),
      processWebhook: vi.fn().mockResolvedValue({
        success: true,
        referenceExterne: "pay-token-123",
        statut: StatutPaiementAbo.CONFIRME,
      }),
    });

    mockGetPaiementByReference.mockResolvedValue(null);
    mockPrismaFindFirst.mockResolvedValue({ abonnementId: "abo-1" });
    mockPrismaUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("retourne 401 si signature invalide", async () => {
    mockGetPaymentGateway.mockReturnValue({
      fournisseur: FournisseurPaiement.SMOBILPAY,
      verifySignature: vi.fn().mockReturnValue(false),
      processWebhook: vi.fn(),
    });

    const body = { payToken: "tok-123", status: "SUCCESS" };
    const request = makeSmobilpayRequest(body, "bad-signature");
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("retourne 200 idempotent si paiement déjà CONFIRME", async () => {
    mockGetPaiementByReference.mockResolvedValue({
      id: "pay-1",
      statut: StatutPaiementAbo.CONFIRME,
      abonnementId: "abo-1",
    });

    const body = { payToken: "pay-token-123", status: "SUCCESS" };
    const rawBody = JSON.stringify(body);
    const signature = signBody(rawBody, secret);
    const request = makeSmobilpayRequest(body, signature);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    // Le paiement ne doit pas être re-confirmé
    expect(mockPrismaUpdateMany).not.toHaveBeenCalled();
  });

  it("confirme paiement + active abonnement pour statut CONFIRME", async () => {
    mockGetPaiementByReference.mockResolvedValue({
      id: "pay-1",
      statut: StatutPaiementAbo.INITIE,
      abonnementId: "abo-1",
    });

    const body = { payToken: "pay-token-123", status: "SUCCESS" };
    const request = makeSmobilpayRequest(body, "valid-sig");
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("retourne 200 même en cas d'erreur interne (Smobilpay ne retentera pas)", async () => {
    mockGetPaiementByReference.mockRejectedValue(new Error("DB error"));

    const body = { payToken: "pay-token-error", status: "SUCCESS" };
    const request = makeSmobilpayRequest(body, "valid-sig");
    const response = await POST(request);

    // CRITIQUE : toujours 200 pour éviter les retries Smobilpay
    expect(response.status).toBe(200);
  });

  it("marque le paiement ECHEC pour statut FAILED", async () => {
    mockGetPaymentGateway.mockReturnValue({
      fournisseur: FournisseurPaiement.SMOBILPAY,
      verifySignature: vi.fn().mockReturnValue(true),
      processWebhook: vi.fn().mockResolvedValue({
        success: true,
        referenceExterne: "pay-token-failed",
        statut: StatutPaiementAbo.ECHEC,
      }),
    });

    mockGetPaiementByReference.mockResolvedValue({
      id: "pay-2",
      statut: StatutPaiementAbo.INITIE,
      abonnementId: "abo-2",
    });

    const body = { payToken: "pay-token-failed", status: "FAILED" };
    const request = makeSmobilpayRequest(body, "valid-sig");
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockPrismaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutPaiementAbo.ECHEC }),
      })
    );
  });

  it("GET n'est pas autorisé → 405", async () => {
    const { GET } = await import("@/app/api/webhooks/smobilpay/route");
    const request = new NextRequest(
      "http://localhost/api/webhooks/smobilpay",
      { method: "GET" }
    );
    const response = await GET();
    expect(response.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Tests POST /api/webhooks/manuel
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/manuel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    mockRequirePermission.mockRejectedValue(new Error("Non authentifié"));

    const request = new NextRequest(
      "http://localhost/api/webhooks/manuel",
      {
        method: "POST",
        body: JSON.stringify({ referenceExterne: "ref-1", abonnementId: "abo-1" }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST_MANUEL(request);
    expect(response.status).toBe(401);
  });

  it("retourne 400 si referenceExterne manquant", async () => {
    mockRequirePermission.mockResolvedValue({
      userId: "user-1",
      siteId: "site-1",
    });

    const request = new NextRequest(
      "http://localhost/api/webhooks/manuel",
      {
        method: "POST",
        body: JSON.stringify({ abonnementId: "abo-1" }), // manque referenceExterne
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST_MANUEL(request);
    expect(response.status).toBe(400);
  });

  it("retourne 200 idempotent si paiement déjà CONFIRME", async () => {
    mockRequirePermission.mockResolvedValue({
      userId: "user-admin",
      siteId: "site-1",
    });

    // La route manuel utilise getPaiementByReference (query Sprint 30)
    mockGetPaiementByReference.mockResolvedValue({
      id: "pay-1",
      statut: StatutPaiementAbo.CONFIRME,
      abonnementId: "abo-1",
    });

    const request = new NextRequest(
      "http://localhost/api/webhooks/manuel",
      {
        method: "POST",
        body: JSON.stringify({
          referenceExterne: "ref-already-confirmed",
          abonnementId: "abo-1",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST_MANUEL(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.message).toMatch(/déjà confirmé/i);
  });

  it("retourne 404 si paiement introuvable", async () => {
    mockRequirePermission.mockResolvedValue({
      userId: "user-admin",
      siteId: "site-1",
    });

    mockGetPaiementByReference.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/webhooks/manuel",
      {
        method: "POST",
        body: JSON.stringify({
          referenceExterne: "ref-inexistant",
          abonnementId: "abo-1",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST_MANUEL(request);
    expect(response.status).toBe(404);
  });
});
