/**
 * Tests unitaires — API /api/remises (Sprint 35)
 *
 * Couvre :
 * - GET /remises/verifier — code valide → { valide: true, remise: ... }
 * - GET /remises/verifier — code inexistant → { valide: false, messageErreur: "..." }
 * - GET /remises/verifier — code expiré → { valide: false }
 * - GET /remises/verifier — limite atteinte → { valide: false }
 * - POST /remises — code dupliqué → 409
 * - PATCH /remises/[id]/toggle — atomique, retourne nouvel état
 *
 * Story 35.4 — Sprint 35
 * R2 : enums importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as verifierGET } from "@/app/api/remises/verifier/route";
import { POST as remisesPOST } from "@/app/api/remises/route";
import { PATCH as togglePATCH } from "@/app/api/remises/[id]/toggle/route";
import { TypeRemise } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerifierRemiseApplicable = vi.fn();
const mockGetRemiseByCode = vi.fn();
const mockGetRemiseById = vi.fn();
const mockToggleRemise = vi.fn();
const mockCreateRemise = vi.fn();
const mockGetAllRemises = vi.fn();

vi.mock("@/lib/queries/remises", () => ({
  verifierRemiseApplicable: (...args: unknown[]) => mockVerifierRemiseApplicable(...args),
  getRemiseByCode: (...args: unknown[]) => mockGetRemiseByCode(...args),
  getRemiseById: (...args: unknown[]) => mockGetRemiseById(...args),
  toggleRemise: (...args: unknown[]) => mockToggleRemise(...args),
  createRemise: (...args: unknown[]) => mockCreateRemise(...args),
  getAllRemises: (...args: unknown[]) => mockGetAllRemises(...args),
}));

// BUG-029 : mock des helpers platform site
const mockIsPlatformSite = vi.fn();
const mockGetPlatformSite = vi.fn();
vi.mock("@/lib/queries/sites", () => ({
  isPlatformSite: (...args: unknown[]) => mockIsPlatformSite(...args),
  getPlatformSite: (...args: unknown[]) => mockGetPlatformSite(...args),
}));

const mockRequirePermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {},
}));

const PLATFORM_SITE = { id: "platform-site-1", name: "DKFarm", isPlatform: true, isActive: true };

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const REMISE_VALID = {
  id: "remise-1",
  nom: "Early Adopter 2026",
  code: "EARLY2026",
  type: TypeRemise.EARLY_ADOPTER,
  valeur: "2000",
  estPourcentage: false,
  dateDebut: new Date("2026-01-01"),
  dateFin: new Date("2026-12-31"),
  limiteUtilisations: 100,
  nombreUtilisations: 5,
  isActif: true,
  siteId: null,
  userId: "user-1",
  planId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const AUTH_CONTEXT = {
  userId: "user-1",
  activeSiteId: "site-1",
  permissions: ["REMISES_GERER", "ABONNEMENTS_GERER"],
};

function createRequest(url: string, method = "GET", body?: unknown): NextRequest {
  const request = new NextRequest(url, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  // Simuler une IP pour le rate limiting
  Object.defineProperty(request, "headers", {
    value: new Headers({
      "x-forwarded-for": "127.0.0.1",
      ...(body ? { "Content-Type": "application/json" } : {}),
    }),
    writable: false,
  });
  return request;
}

// ---------------------------------------------------------------------------
// Tests GET /api/remises/verifier
// ---------------------------------------------------------------------------

describe("GET /api/remises/verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne { valide: true, remise } pour un code valide", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({ remise: REMISE_VALID });

    const req = new NextRequest("http://localhost/api/remises/verifier?code=EARLY2026", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const res = await verifierGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valide).toBe(true);
    expect(data.remise.code).toBe("EARLY2026");
    // Ne pas fuiter userId ni siteId
    expect(data.remise.userId).toBeUndefined();
    expect(data.remise.siteId).toBeUndefined();
  });

  it("retourne { valide: false, messageErreur } pour un code inexistant", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: null,
      erreur: "Code promo invalide",
    });

    const req = new NextRequest("http://localhost/api/remises/verifier?code=INEXISTANT", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    const res = await verifierGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valide).toBe(false);
    expect(data.messageErreur).toBeTruthy();
  });

  it("retourne { valide: false } pour un code expiré", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: null,
      erreur: "Code promo expiré",
    });

    const req = new NextRequest("http://localhost/api/remises/verifier?code=EXPIREDCODE", {
      headers: { "x-forwarded-for": "10.0.0.3" },
    });
    const res = await verifierGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valide).toBe(false);
    expect(data.messageErreur).toContain("expiré");
  });

  it("retourne { valide: false } quand la limite d'utilisations est atteinte", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: null,
      erreur: "Limite d'utilisations atteinte",
    });

    const req = new NextRequest("http://localhost/api/remises/verifier?code=LIMITREACHED", {
      headers: { "x-forwarded-for": "10.0.0.4" },
    });
    const res = await verifierGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valide).toBe(false);
    expect(data.messageErreur).toContain("Limite");
  });

  it("retourne 400 si le paramètre code est absent", async () => {
    const req = new NextRequest("http://localhost/api/remises/verifier", {
      headers: { "x-forwarded-for": "10.0.0.5" },
    });
    const res = await verifierGET(req);

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests POST /api/remises
// ---------------------------------------------------------------------------

describe("POST /api/remises", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    // BUG-029 : simuler le contexte plateforme par défaut pour les tests POST
    mockIsPlatformSite.mockResolvedValue(true);
    mockGetPlatformSite.mockResolvedValue(PLATFORM_SITE);
  });

  it("retourne 409 si le code est déjà utilisé", async () => {
    mockGetRemiseByCode.mockResolvedValue(REMISE_VALID);

    const req = new NextRequest("http://localhost/api/remises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Test",
        code: "EARLY2026",
        type: TypeRemise.MANUELLE,
        valeur: 500,
        estPourcentage: false,
        dateDebut: "2026-01-01",
      }),
    });
    const res = await remisesPOST(req);

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.message).toContain("EARLY2026");
  });

  it("crée une remise avec code normalisé en majuscules", async () => {
    mockGetRemiseByCode.mockResolvedValue(null);
    mockCreateRemise.mockResolvedValue({ ...REMISE_VALID, id: "new-remise-1" });

    const req = new NextRequest("http://localhost/api/remises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Nouvelle remise",
        code: "nouvelle2026",
        type: TypeRemise.MANUELLE,
        valeur: 1000,
        estPourcentage: false,
        dateDebut: "2026-01-01",
      }),
    });
    const res = await remisesPOST(req);

    expect(res.status).toBe(201);
    // Vérifier que getRemiseByCode a été appelé avec le code en majuscules
    expect(mockGetRemiseByCode).toHaveBeenCalledWith("NOUVELLE2026");
  });

  it("retourne 400 si les champs requis manquent", async () => {
    const req = new NextRequest("http://localhost/api/remises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: "Test" }), // code, type, valeur manquants
    });
    const res = await remisesPOST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests PATCH /api/remises/[id]/toggle
// ---------------------------------------------------------------------------

describe("PATCH /api/remises/[id]/toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("toggle isActif de true à false de façon atomique", async () => {
    const remiseActive = { ...REMISE_VALID, isActif: true };
    const remiseDesactivee = { ...REMISE_VALID, isActif: false };
    mockGetRemiseById
      .mockResolvedValueOnce(remiseActive) // premier appel (lecture état actuel)
      .mockResolvedValueOnce(remiseDesactivee); // second appel (après update)
    mockToggleRemise.mockResolvedValue({ count: 1 });

    const req = new NextRequest("http://localhost/api/remises/remise-1/toggle", {
      method: "PATCH",
    });
    const res = await togglePATCH(req, { params: { id: "remise-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    // R4 : toggleRemise (updateMany) a été appelé avec l'état inversé
    expect(mockToggleRemise).toHaveBeenCalledWith("remise-1", false);
    expect(data.isActif).toBe(false);
  });

  it("toggle isActif de false à true", async () => {
    const remiseInactive = { ...REMISE_VALID, isActif: false };
    const remiseActive = { ...REMISE_VALID, isActif: true };
    mockGetRemiseById
      .mockResolvedValueOnce(remiseInactive)
      .mockResolvedValueOnce(remiseActive);
    mockToggleRemise.mockResolvedValue({ count: 1 });

    const req = new NextRequest("http://localhost/api/remises/remise-1/toggle", {
      method: "PATCH",
    });
    const res = await togglePATCH(req, { params: { id: "remise-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockToggleRemise).toHaveBeenCalledWith("remise-1", true);
    expect(data.isActif).toBe(true);
  });

  it("retourne 404 si la remise n'existe pas", async () => {
    mockGetRemiseById.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/remises/inexistant/toggle", {
      method: "PATCH",
    });
    const res = await togglePATCH(req, { params: { id: "inexistant" } });

    expect(res.status).toBe(404);
  });
});
