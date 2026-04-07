/**
 * Tests API — GET /api/reproduction/planning
 *
 * Couvre :
 *   - Retourne les evenements de planning (4 tableaux)
 *   - dateDebut et dateFin sont obligatoires (retourne 400 sinon)
 *   - Valide que dateFin > dateDebut (strictement)
 *   - Valide le format ISO des dates
 *   - Retourne 401 si non authentifie (AuthError)
 *   - Retourne 403 si permissions insuffisantes (ForbiddenError)
 *   - Passe les dates correctement a la fonction de requete
 *
 * Fichier source : src/app/api/reproduction/planning/route.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/reproduction/planning/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReproductionPlanningEvents = vi.fn();

vi.mock("@/lib/queries/reproduction-stats", () => ({
  getReproductionPlanningEvents: (...args: unknown[]) =>
    mockGetReproductionPlanningEvents(...args),
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
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  isSuperAdmin: false,
  permissions: [Permission.ALEVINS_VOIR],
};

const FAKE_PLANNING_EVENTS = {
  pontesPlanifiees: [
    {
      id: "ponte-1",
      code: "P-2026-001",
      dateDebut: new Date("2026-03-15"),
      dateFin: null,
      statut: "EN_COURS",
      femelle: { id: "repr-1", code: "F-001" },
    },
  ],
  incubationsEnCours: [
    {
      id: "incub-1",
      code: "INC-2026-001",
      dateDebut: new Date("2026-03-16"),
      dateEclosionPrevue: new Date("2026-03-30"),
      statut: "EN_COURS",
    },
  ],
  lotsEnElevage: [
    {
      id: "lot-1",
      code: "LOT-2026-001",
      phase: "LARVE",
      dateDebutPhase: new Date("2026-03-01"),
      ageJours: 14,
      nombreActuel: 500,
    },
  ],
  eclosionsPrevues: [
    {
      incubationId: "incub-1",
      code: "INC-2026-001",
      dateEclosionPrevue: new Date("2026-03-30"),
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRequest(queryParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/reproduction/planning");
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/planning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReproductionPlanningEvents.mockResolvedValue(FAKE_PLANNING_EVENTS);
  });

  it("retourne les 4 tableaux d'evenements de planning", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pontesPlanifiees).toBeDefined();
    expect(body.incubationsEnCours).toBeDefined();
    expect(body.lotsEnElevage).toBeDefined();
    expect(body.eclosionsPrevues).toBeDefined();
  });

  it("retourne les tableaux comme des Arrays", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(Array.isArray(body.pontesPlanifiees)).toBe(true);
    expect(Array.isArray(body.incubationsEnCours)).toBe(true);
    expect(Array.isArray(body.lotsEnElevage)).toBe(true);
    expect(Array.isArray(body.eclosionsPrevues)).toBe(true);
  });

  it("passe les dates correctement a getReproductionPlanningEvents", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    await GET(request);

    expect(mockGetReproductionPlanningEvents).toHaveBeenCalledWith(
      "site-1",
      expect.any(Date),
      expect.any(Date)
    );

    const callArgs = mockGetReproductionPlanningEvents.mock.calls[0];
    expect((callArgs[1] as Date).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("passe le siteId de l'auth context a la fonction", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    await GET(request);

    expect(mockGetReproductionPlanningEvents).toHaveBeenCalledWith(
      "site-1",
      expect.any(Date),
      expect.any(Date)
    );
  });

  it("retourne 400 si dateDebut est absent", async () => {
    const request = makeRequest({ dateFin: "2026-03-31" });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateDebut");
  });

  it("retourne 400 si dateFin est absent", async () => {
    const request = makeRequest({ dateDebut: "2026-03-01" });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateFin");
  });

  it("retourne 400 si ni dateDebut ni dateFin ne sont fournis", async () => {
    const request = makeRequest();
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBeDefined();
  });

  it("retourne 400 si dateDebut n'est pas une date ISO valide", async () => {
    const request = makeRequest({
      dateDebut: "not-a-date",
      dateFin: "2026-03-31",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateDebut");
  });

  it("retourne 400 si dateFin n'est pas une date ISO valide", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "invalid",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dateFin");
  });

  it("retourne 400 si dateFin est egale a dateDebut (doit etre strictement posterieure)", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-01",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("date");
  });

  it("retourne 400 si dateFin est anterieure a dateDebut", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-31",
      dateFin: "2026-03-01",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("date");
  });

  it("retourne 401 si l'utilisateur n'est pas authentifie (AuthError)", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("retourne 403 si les permissions sont insuffisantes (ForbiddenError)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission ALEVINS_VOIR requise")
    );

    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec la permission PLANNING_REPRODUCTION_VOIR (ADR-045)", async () => {
    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    await GET(request);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.PLANNING_REPRODUCTION_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockGetReproductionPlanningEvents.mockRejectedValue(
      new Error("DB connection lost")
    );

    const request = makeRequest({
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
    });
    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  it("retourne des tableaux vides quand aucun evenement dans la periode", async () => {
    mockGetReproductionPlanningEvents.mockResolvedValue({
      pontesPlanifiees: [],
      incubationsEnCours: [],
      lotsEnElevage: [],
      eclosionsPrevues: [],
    });

    const request = makeRequest({
      dateDebut: "2025-01-01",
      dateFin: "2025-01-31",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pontesPlanifiees).toEqual([]);
    expect(body.incubationsEnCours).toEqual([]);
    expect(body.lotsEnElevage).toEqual([]);
    expect(body.eclosionsPrevues).toEqual([]);
  });

  it("accepte une plage sur plusieurs mois", async () => {
    const request = makeRequest({
      dateDebut: "2026-01-01",
      dateFin: "2026-12-31",
    });
    const response = await GET(request);

    expect(response.status).toBe(200);

    const callArgs = mockGetReproductionPlanningEvents.mock.calls[0];
    const dateDebutPassed = callArgs[1] as Date;
    const dateFinPassed = callArgs[2] as Date;
    expect(dateFinPassed.getTime()).toBeGreaterThan(dateDebutPassed.getTime());
  });
});
