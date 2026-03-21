/**
 * Tests unitaires — GET /api/cron/subscription-lifecycle (Sprint 36)
 *
 * Couvre :
 * - GET sans header Authorization → 401
 * - GET avec CRON_SECRET invalide → 401
 * - GET avec CRON_SECRET valide → 200 + structure { processed: { graces, suspendus, expires, commissionsDisponibles } }
 * - GET quand CRON_SECRET non configuré en env → 500
 * - GET avec erreur service → 500
 *
 * Story 36.1 — Sprint 36
 * R2 : enums importés depuis @/types (aucun enum direct ici, mais on respecte le pattern)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — doivent être déclarés avant l'import du module testé
// ---------------------------------------------------------------------------

const mockTransitionnerStatuts = vi.fn();
const mockRendreCommissionsDisponiblesCron = vi.fn();

vi.mock("@/lib/services/abonnement-lifecycle", () => ({
  transitionnerStatuts: (...args: unknown[]) =>
    mockTransitionnerStatuts(...args),
}));

vi.mock("@/lib/services/commissions", () => ({
  rendreCommissionsDisponiblesCron: (...args: unknown[]) =>
    mockRendreCommissionsDisponiblesCron(...args),
}));

// Import après les mocks
import { GET } from "@/app/api/cron/subscription-lifecycle/route";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const VALID_SECRET = "test-cron-secret-abc123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["authorization"] = authHeader;
  }
  return new NextRequest(
    "http://localhost/api/cron/subscription-lifecycle",
    { method: "GET", headers }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/cron/subscription-lifecycle", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Configurer CRON_SECRET par défaut pour chaque test
    process.env = { ...originalEnv, CRON_SECRET: VALID_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ---- Authentification ----

  it("retourne 401 si le header Authorization est absent", async () => {
    const req = makeRequest(); // pas de header authorization
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.status).toBe(401);
    expect(data.message).toContain("invalide");
  });

  it("retourne 401 si le token Bearer est vide", async () => {
    const req = makeRequest("Bearer ");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.status).toBe(401);
  });

  it("retourne 401 si le CRON_SECRET est invalide", async () => {
    const req = makeRequest("Bearer mauvais-secret");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.status).toBe(401);
    expect(data.message).toContain("invalide");
  });

  it("retourne 401 si le token a la même longueur mais est différent", async () => {
    // Vérifie que timingSafeEqual rejette bien un token de même longueur
    const sameLength = "x".repeat(VALID_SECRET.length);
    const req = makeRequest(`Bearer ${sameLength}`);
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  // ---- Configuration manquante ----

  it("retourne 500 si CRON_SECRET n'est pas configuré dans l'env", async () => {
    delete process.env.CRON_SECRET;

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.status).toBe(500);
    expect(data.message).toContain("Configuration");
  });

  // ---- Succès ----

  it("retourne 200 avec { processed: { graces, suspendus, expires, commissionsDisponibles } } pour un token valide", async () => {
    mockTransitionnerStatuts.mockResolvedValue({
      graces: 3,
      suspendus: 1,
      expires: 2,
    });
    mockRendreCommissionsDisponiblesCron.mockResolvedValue(5);

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe(200);
    expect(data.message).toContain("succes");
    expect(data.processed).toBeDefined();
    expect(data.processed.graces).toBe(3);
    expect(data.processed.suspendus).toBe(1);
    expect(data.processed.expires).toBe(2);
    expect(data.processed.commissionsDisponibles).toBe(5);
  });

  it("retourne des counts à zéro quand aucune transition n'est nécessaire", async () => {
    mockTransitionnerStatuts.mockResolvedValue({
      graces: 0,
      suspendus: 0,
      expires: 0,
    });
    mockRendreCommissionsDisponiblesCron.mockResolvedValue(0);

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed.graces).toBe(0);
    expect(data.processed.suspendus).toBe(0);
    expect(data.processed.expires).toBe(0);
    expect(data.processed.commissionsDisponibles).toBe(0);
  });

  it("appelle transitionnerStatuts et rendreCommissionsDisponiblesCron avec un token valide", async () => {
    mockTransitionnerStatuts.mockResolvedValue({
      graces: 1,
      suspendus: 0,
      expires: 0,
    });
    mockRendreCommissionsDisponiblesCron.mockResolvedValue(2);

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    await GET(req);

    expect(mockTransitionnerStatuts).toHaveBeenCalledTimes(1);
    expect(mockRendreCommissionsDisponiblesCron).toHaveBeenCalledTimes(1);
  });

  it("ne doit pas appeler les services si le token est invalide", async () => {
    const req = makeRequest("Bearer mauvais-token");
    await GET(req);

    expect(mockTransitionnerStatuts).not.toHaveBeenCalled();
    expect(mockRendreCommissionsDisponiblesCron).not.toHaveBeenCalled();
  });

  // ---- Gestion des erreurs ----

  it("retourne 500 si transitionnerStatuts lève une erreur", async () => {
    mockTransitionnerStatuts.mockRejectedValue(
      new Error("Erreur base de données")
    );

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.status).toBe(500);
    expect(data.message).toContain("Erreur");
  });

  it("retourne 500 si rendreCommissionsDisponiblesCron lève une erreur", async () => {
    mockTransitionnerStatuts.mockResolvedValue({
      graces: 0,
      suspendus: 0,
      expires: 0,
    });
    mockRendreCommissionsDisponiblesCron.mockRejectedValue(
      new Error("Timeout connexion")
    );

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.status).toBe(500);
  });

  // ---- Structure de réponse ----

  it("la réponse 200 contient exactement les 4 clés attendues dans processed", async () => {
    mockTransitionnerStatuts.mockResolvedValue({
      graces: 10,
      suspendus: 5,
      expires: 2,
    });
    mockRendreCommissionsDisponiblesCron.mockResolvedValue(7);

    const req = makeRequest(`Bearer ${VALID_SECRET}`);
    const res = await GET(req);
    const data = await res.json();

    const processedKeys = Object.keys(data.processed).sort();
    expect(processedKeys).toEqual(
      ["commissionsDisponibles", "expires", "graces", "suspendus"]
    );
  });
});
