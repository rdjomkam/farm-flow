/**
 * Tests d'intégration — Route GET /api/remises/verifier (Sprint 33)
 *
 * Couvre :
 * - 200 avec valide: true — code promo valide
 * - 200 avec valide: false — code promo invalide (message d'erreur)
 * - 400 — paramètre code manquant
 * - 401 — non authentifié
 *
 * Story 33.5 — Sprint 33
 * R2 : enums Permission importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/remises/verifier/route";
import { NextRequest } from "next/server";
import { Permission, TypeRemise } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerifierRemiseApplicable = vi.fn();

vi.mock("@/lib/queries/remises", () => ({
  verifierRemiseApplicable: (...args: unknown[]) => mockVerifierRemiseApplicable(...args),
}));

const mockRequirePermission = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Forbidden") {
      super(msg);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    constructor(msg = "Non autorisé") {
      super(msg);
      this.name = "AuthError";
    }
  },
  getSession: vi.fn(),
}));

const mockAuth = {
  userId: "user-1",
  activeSiteId: "site-1",
  role: "ADMIN",
};

const mockRemise = {
  id: "remise-1",
  nom: "Early Adopter",
  code: "EARLY2026",
  valeur: 500,
  estPourcentage: false,
  type: TypeRemise.EARLY_ADOPTER,
  isActif: true,
  dateDebut: new Date("2026-01-01"),
  dateFin: null,
  limiteUtilisations: null,
  nombreUtilisations: 0,
  siteId: null,
  planId: null,
  userId: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(code?: string): NextRequest {
  const url = code
    ? `http://localhost/api/remises/verifier?code=${encodeURIComponent(code)}`
    : "http://localhost/api/remises/verifier";
  return new NextRequest(url);
}

describe("GET /api/remises/verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(mockAuth);
  });

  it("retourne 400 si le paramètre code est manquant", async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("code");
  });

  it("retourne 400 si le paramètre code est vide", async () => {
    const req = makeRequest("   ");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("retourne valide: false si le code est invalide", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: null,
      erreur: "Code promo invalide",
    });
    const req = makeRequest("INVALID");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valide).toBe(false);
    expect(data.message).toBeTruthy();
  });

  it("retourne valide: false si le code est expiré", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: null,
      erreur: "Code promo expiré",
    });
    const req = makeRequest("EXPIRED");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valide).toBe(false);
    expect(data.message).toContain("expiré");
  });

  it("retourne valide: true avec les détails de la remise", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: mockRemise,
    });
    const req = makeRequest("EARLY2026");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valide).toBe(true);
    expect(data.remise).toBeDefined();
    expect(data.remise.code).toBe("EARLY2026");
    expect(data.remise.valeur).toBe(500);
    expect(data.remise.estPourcentage).toBe(false);
  });

  it("normalise le code en majuscules avant vérification", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: mockRemise,
    });
    const req = makeRequest("early2026");
    await GET(req);
    expect(mockVerifierRemiseApplicable).toHaveBeenCalledWith("EARLY2026", "site-1");
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorisé"));
    const req = makeRequest("EARLY2026");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("vérifie la remise avec le siteId de l'utilisateur connecté", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({ remise: null, erreur: "Invalide" });
    const req = makeRequest("TEST");
    await GET(req);
    expect(mockVerifierRemiseApplicable).toHaveBeenCalledWith(
      expect.any(String),
      "site-1"
    );
  });
});
