/**
 * Tests d'intégration — Route GET /api/abonnements/statut-middleware (Sprint 36)
 *
 * Couvre :
 * - GET sans session → { statut: null, isDecouverte: false, planId: null, isBlocked: false }
 * - GET avec session + abonnement ACTIF → { isBlocked: false, statut: "ACTIF" }
 * - GET avec session + abonnement EXPIRE → { isBlocked: true, statut: "EXPIRE" }
 * - GET avec session + plan DECOUVERTE → { isDecouverte: true, isBlocked: false }
 * - GET avec session sans activeSiteId → fail open { isBlocked: false }
 * - Erreur interne → fail open { isBlocked: false }
 *
 * Story 36.3 — Sprint 36
 * R2 : enums StatutAbonnement, TypePlan importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/abonnements/statut-middleware/route";
import { NextRequest } from "next/server";
import { StatutAbonnement, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockGetSubscriptionStatus = vi.fn();
const mockIsBlocked = vi.fn();
const mockPrismaAbonnementFindFirst = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@/lib/abonnements/check-subscription", () => ({
  getSubscriptionStatus: (...args: unknown[]) => mockGetSubscriptionStatus(...args),
  isBlocked: (...args: unknown[]) => mockIsBlocked(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnement: {
      findFirst: (...args: unknown[]) => mockPrismaAbonnementFindFirst(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url = "http://localhost:3000/api/abonnements/statut-middleware") {
  return new NextRequest(new URL(url), { method: "GET" });
}

const FAKE_SESSION_WITH_SITE = {
  userId: "user-1",
  email: "test@farm.cm",
  phone: "+237600000001",
  name: "Gérant",
  role: "PISCICULTEUR",
  activeSiteId: "site-1",
  isImpersonating: false,
  originalUserId: null,
};

const FAKE_SESSION_WITHOUT_SITE = {
  ...FAKE_SESSION_WITH_SITE,
  activeSiteId: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/abonnements/statut-middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Cas 1 : Pas de session → fail open
  // -------------------------------------------------------------------------

  it("sans session → { statut: null, isDecouverte: false, planId: null, isBlocked: false }", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBeNull();
    expect(data.isDecouverte).toBe(false);
    expect(data.planId).toBeNull();
    expect(data.isBlocked).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cas 2 : Session sans activeSiteId → fail open
  // -------------------------------------------------------------------------

  it("session sans activeSiteId → { isBlocked: false }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITHOUT_SITE);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBeNull();
    expect(data.isBlocked).toBe(false);
    expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cas 3 : Abonnement ACTIF → isBlocked: false
  // -------------------------------------------------------------------------

  it("session + abonnement ACTIF → { isBlocked: false, statut: 'ACTIF' }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: StatutAbonnement.ACTIF,
      daysRemaining: 25,
      planType: TypePlan.ELEVEUR,
      isDecouverte: false,
    });
    mockPrismaAbonnementFindFirst.mockResolvedValue({ planId: "plan-eleveur" });
    mockIsBlocked.mockReturnValue(false);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBe(StatutAbonnement.ACTIF);
    expect(data.isBlocked).toBe(false);
    expect(data.isDecouverte).toBe(false);
    expect(data.planId).toBe("plan-eleveur");
    expect(mockGetSubscriptionStatus).toHaveBeenCalledWith("site-1");
  });

  // -------------------------------------------------------------------------
  // Cas 4 : Abonnement EXPIRE → isBlocked: true
  // -------------------------------------------------------------------------

  it("session + abonnement EXPIRE → { isBlocked: true, statut: 'EXPIRE' }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: StatutAbonnement.EXPIRE,
      daysRemaining: 0,
      planType: TypePlan.ELEVEUR,
      isDecouverte: false,
    });
    mockPrismaAbonnementFindFirst.mockResolvedValue({ planId: "plan-eleveur" });
    mockIsBlocked.mockReturnValue(true);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBe(StatutAbonnement.EXPIRE);
    expect(data.isBlocked).toBe(true);
    expect(data.isDecouverte).toBe(false);
    expect(data.planId).toBe("plan-eleveur");
  });

  // -------------------------------------------------------------------------
  // Cas 5 : Plan DECOUVERTE → isDecouverte: true, isBlocked: false
  // -------------------------------------------------------------------------

  it("session + plan DECOUVERTE → { isDecouverte: true, isBlocked: false }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: StatutAbonnement.ACTIF,
      daysRemaining: null,
      planType: TypePlan.DECOUVERTE,
      isDecouverte: true,
    });
    // R2 : isDecouverte via le flag du service → pas de query planId
    mockIsBlocked.mockReturnValue(false);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isDecouverte).toBe(true);
    expect(data.isBlocked).toBe(false);
    // Plan DECOUVERTE → planId non chargé (pas de findFirst)
    expect(data.planId).toBeNull();
    expect(mockPrismaAbonnementFindFirst).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cas 6 : isDecouverte via planType (pas via le flag) → même résultat
  // -------------------------------------------------------------------------

  it("planType === DECOUVERTE mais isDecouverte=false dans le service → isDecouverte résolu via planType", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: StatutAbonnement.ACTIF,
      daysRemaining: null,
      planType: TypePlan.DECOUVERTE,
      isDecouverte: false, // flag incorrect, mais planType est DECOUVERTE
    });
    mockIsBlocked.mockReturnValue(false);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // La route résout isDecouverte via le planType aussi
    expect(data.isDecouverte).toBe(true);
    expect(data.isBlocked).toBe(false);
    expect(mockPrismaAbonnementFindFirst).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cas 7 : Abonnement ANNULE → isBlocked: true
  // -------------------------------------------------------------------------

  it("session + abonnement ANNULE → { isBlocked: true }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: StatutAbonnement.ANNULE,
      daysRemaining: 0,
      planType: TypePlan.ELEVEUR,
      isDecouverte: false,
    });
    mockPrismaAbonnementFindFirst.mockResolvedValue({ planId: "plan-eleveur" });
    mockIsBlocked.mockReturnValue(true);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBe(StatutAbonnement.ANNULE);
    expect(data.isBlocked).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Cas 8 : Aucun abonnement enregistré → statut null → planId null → isBlocked false
  // -------------------------------------------------------------------------

  it("session + aucun abonnement → { statut: null, isBlocked: false }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: null,
      daysRemaining: null,
      planType: null,
      isDecouverte: false,
    });
    mockPrismaAbonnementFindFirst.mockResolvedValue(null);
    mockIsBlocked.mockReturnValue(false);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBeNull();
    expect(data.isBlocked).toBe(false);
    expect(data.planId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Cas 9 : Erreur interne → fail open
  // -------------------------------------------------------------------------

  it("erreur interne (getSubscriptionStatus throw) → fail open { isBlocked: false }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockRejectedValue(new Error("DB connexion échouée"));

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    // Fail open : ne pas bloquer l'utilisateur en cas d'erreur
    expect(res.status).toBe(200);
    expect(data.statut).toBeNull();
    expect(data.isDecouverte).toBe(false);
    expect(data.planId).toBeNull();
    expect(data.isBlocked).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cas 10 : Abonnement EN_GRACE → isBlocked: false (pas bloqué, juste en grace)
  // -------------------------------------------------------------------------

  it("session + abonnement EN_GRACE → { isBlocked: false, statut: 'EN_GRACE' }", async () => {
    mockGetSession.mockResolvedValue(FAKE_SESSION_WITH_SITE);
    mockGetSubscriptionStatus.mockResolvedValue({
      statut: StatutAbonnement.EN_GRACE,
      daysRemaining: 5,
      planType: TypePlan.ELEVEUR,
      isDecouverte: false,
    });
    mockPrismaAbonnementFindFirst.mockResolvedValue({ planId: "plan-eleveur" });
    // EN_GRACE n'est pas bloqué
    mockIsBlocked.mockReturnValue(false);

    const req = makeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.statut).toBe(StatutAbonnement.EN_GRACE);
    expect(data.isBlocked).toBe(false);
    expect(data.isDecouverte).toBe(false);
  });
});
