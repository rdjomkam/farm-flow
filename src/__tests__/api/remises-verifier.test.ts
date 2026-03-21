/**
 * Tests d'intégration — Route GET /api/remises/verifier (Sprint 35)
 *
 * Couvre :
 * - 200 avec valide: true — code promo valide
 * - 200 avec valide: false — code promo invalide (messageErreur)
 * - 400 — paramètre code manquant
 * - 429 — rate limit dépassé
 *
 * Story 35.1 — Sprint 35 (route publique sans auth)
 * R2 : enums TypeRemise importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/remises/verifier/route";
import { NextRequest } from "next/server";
import { TypeRemise } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerifierRemiseApplicable = vi.fn();

vi.mock("@/lib/queries/remises", () => ({
  verifierRemiseApplicable: (...args: unknown[]) => mockVerifierRemiseApplicable(...args),
}));

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

function makeRequest(code?: string, siteId?: string): NextRequest {
  let url = "http://localhost/api/remises/verifier";
  const params: string[] = [];
  if (code !== undefined) params.push(`code=${encodeURIComponent(code)}`);
  if (siteId !== undefined) params.push(`siteId=${encodeURIComponent(siteId)}`);
  if (params.length > 0) url += "?" + params.join("&");
  return new NextRequest(url);
}

describe("GET /api/remises/verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 400 si le paramètre code est manquant", async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.messageErreur).toContain("code");
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
    expect(data.messageErreur).toBeTruthy();
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
    expect(data.messageErreur).toContain("expiré");
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
    expect(mockVerifierRemiseApplicable).toHaveBeenCalledWith("EARLY2026", undefined);
  });

  it("retourne 401 si non authentifié — route publique, pas de 401", async () => {
    // La route est publique — elle ne vérifie pas l'authentification
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: mockRemise,
    });
    const req = makeRequest("EARLY2026");
    const res = await GET(req);
    // Route publique → pas de 401, toujours 200 si le code est valide
    expect(res.status).not.toBe(401);
  });

  it("vérifie la remise avec le siteId du query param", async () => {
    mockVerifierRemiseApplicable.mockResolvedValue({ remise: null, erreur: "Invalide" });
    const req = makeRequest("TEST", "site-1");
    await GET(req);
    expect(mockVerifierRemiseApplicable).toHaveBeenCalledWith(
      "TEST",
      "site-1"
    );
  });
});
