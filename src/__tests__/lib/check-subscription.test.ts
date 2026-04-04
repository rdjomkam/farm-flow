/**
 * Tests unitaires — src/lib/abonnements/check-subscription.ts
 *
 * Couvre :
 * - isSubscriptionValid() — ACTIF → true, EN_GRACE → true, SUSPENDU → false
 * - isReadOnlyMode() — SUSPENDU → true, ACTIF → false
 * - isBlocked() — EXPIRE → true, ANNULE → true, ACTIF → false
 * - getSubscriptionStatus(userId) — cache user-level, tag subscription-{userId}
 * - getSubscriptionStatusForSite(siteId) — wrapper siteId, tag subscription-site-{siteId}
 *
 * Story 32.5 — Sprint 32
 * Story 46.3 — Sprint 46 : ajout tests getSubscriptionStatusForSite
 * R2 : enums StatutAbonnement, TypePlan importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSubscriptionValid,
  isReadOnlyMode,
  isBlocked,
  getSubscriptionStatus,
  getSubscriptionStatusForSite,
} from "@/lib/abonnements/check-subscription";
import { StatutAbonnement, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — next/cache (unstable_cache incompatible hors contexte Next.js)
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — getAbonnementActif / getAbonnementActifPourSite
// ---------------------------------------------------------------------------

const mockGetAbonnementActif = vi.fn();
const mockGetAbonnementActifPourSite = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
  getAbonnementActifPourSite: (...args: unknown[]) => mockGetAbonnementActifPourSite(...args),
}));

// ---------------------------------------------------------------------------
// Tests : isSubscriptionValid
// ---------------------------------------------------------------------------

describe("isSubscriptionValid", () => {
  it("ACTIF → true", () => {
    expect(isSubscriptionValid(StatutAbonnement.ACTIF)).toBe(true);
  });

  it("EN_GRACE → true", () => {
    expect(isSubscriptionValid(StatutAbonnement.EN_GRACE)).toBe(true);
  });

  it("SUSPENDU → false", () => {
    expect(isSubscriptionValid(StatutAbonnement.SUSPENDU)).toBe(false);
  });

  it("EXPIRE → false", () => {
    expect(isSubscriptionValid(StatutAbonnement.EXPIRE)).toBe(false);
  });

  it("ANNULE → false", () => {
    expect(isSubscriptionValid(StatutAbonnement.ANNULE)).toBe(false);
  });

  it("null → false", () => {
    expect(isSubscriptionValid(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests : isReadOnlyMode
// ---------------------------------------------------------------------------

describe("isReadOnlyMode", () => {
  it("SUSPENDU → true", () => {
    expect(isReadOnlyMode(StatutAbonnement.SUSPENDU)).toBe(true);
  });

  it("ACTIF → false", () => {
    expect(isReadOnlyMode(StatutAbonnement.ACTIF)).toBe(false);
  });

  it("EN_GRACE → false (non bloqué, juste en période de grâce)", () => {
    expect(isReadOnlyMode(StatutAbonnement.EN_GRACE)).toBe(false);
  });

  it("EXPIRE → false (bloqué, pas mode lecture seule)", () => {
    expect(isReadOnlyMode(StatutAbonnement.EXPIRE)).toBe(false);
  });

  it("null → false", () => {
    expect(isReadOnlyMode(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests : isBlocked
// ---------------------------------------------------------------------------

describe("isBlocked", () => {
  it("EXPIRE → true", () => {
    expect(isBlocked(StatutAbonnement.EXPIRE)).toBe(true);
  });

  it("ANNULE → true", () => {
    expect(isBlocked(StatutAbonnement.ANNULE)).toBe(true);
  });

  it("ACTIF → false", () => {
    expect(isBlocked(StatutAbonnement.ACTIF)).toBe(false);
  });

  it("EN_GRACE → false", () => {
    expect(isBlocked(StatutAbonnement.EN_GRACE)).toBe(false);
  });

  it("SUSPENDU → false (mode lecture seule, pas bloqué)", () => {
    expect(isBlocked(StatutAbonnement.SUSPENDU)).toBe(false);
  });

  it("null → false", () => {
    expect(isBlocked(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests : getSubscriptionStatus
// ---------------------------------------------------------------------------

describe("getSubscriptionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abonnement ACTIF avec plan ELEVEUR → statut ACTIF, daysRemaining > 0", async () => {
    const dateFin = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 jours
    mockGetAbonnementActif.mockResolvedValue({
      id: "abo-1",
      statut: StatutAbonnement.ACTIF,
      dateFin,
      plan: { typePlan: TypePlan.ELEVEUR },
    });

    const result = await getSubscriptionStatus("user-1");

    expect(result.statut).toBe(StatutAbonnement.ACTIF);
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.daysRemaining).toBeLessThanOrEqual(10);
    expect(result.planType).toBe(TypePlan.ELEVEUR);
    expect(result.isDecouverte).toBe(false);
  });

  it("plan DECOUVERTE → isDecouverte = true", async () => {
    const dateFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockGetAbonnementActif.mockResolvedValue({
      id: "abo-decouverte",
      statut: StatutAbonnement.ACTIF,
      dateFin,
      plan: { typePlan: TypePlan.DECOUVERTE },
    });

    const result = await getSubscriptionStatus("user-1");

    expect(result.isDecouverte).toBe(true);
    expect(result.planType).toBe(TypePlan.DECOUVERTE);
  });

  it("aucun abonnement → statut null, daysRemaining null", async () => {
    mockGetAbonnementActif.mockResolvedValue(null);

    const result = await getSubscriptionStatus("user-vide");

    expect(result.statut).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.planType).toBeNull();
    expect(result.isDecouverte).toBe(false);
  });

  it("abonnement expiré hier → daysRemaining = 0", async () => {
    const dateFin = new Date(Date.now() - 24 * 60 * 60 * 1000); // hier
    mockGetAbonnementActif.mockResolvedValue({
      id: "abo-1",
      statut: StatutAbonnement.EN_GRACE,
      dateFin,
      plan: { typePlan: TypePlan.PROFESSIONNEL },
    });

    const result = await getSubscriptionStatus("user-1");

    expect(result.daysRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests : getSubscriptionStatusForSite
// ---------------------------------------------------------------------------

describe("getSubscriptionStatusForSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abonnement ACTIF via siteId → statut ACTIF, daysRemaining > 0", async () => {
    const dateFin = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 jours
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-site-1",
      statut: StatutAbonnement.ACTIF,
      dateFin,
      plan: { typePlan: TypePlan.PROFESSIONNEL },
    });

    const result = await getSubscriptionStatusForSite("site-1");

    expect(result.statut).toBe(StatutAbonnement.ACTIF);
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.daysRemaining).toBeLessThanOrEqual(15);
    expect(result.planType).toBe(TypePlan.PROFESSIONNEL);
    expect(result.isDecouverte).toBe(false);
  });

  it("aucun abonnement pour le site → statut null", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(null);

    const result = await getSubscriptionStatusForSite("site-vide");

    expect(result.statut).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.planType).toBeNull();
    expect(result.isDecouverte).toBe(false);
  });

  it("plan DECOUVERTE via siteId → isDecouverte = true", async () => {
    const dateFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-decouverte-site",
      statut: StatutAbonnement.ACTIF,
      dateFin,
      plan: { typePlan: TypePlan.DECOUVERTE },
    });

    const result = await getSubscriptionStatusForSite("site-1");

    expect(result.isDecouverte).toBe(true);
    expect(result.planType).toBe(TypePlan.DECOUVERTE);
  });

  it("abonnement EN_GRACE via siteId → statut EN_GRACE", async () => {
    const dateFin = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 jours de grâce
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-grace",
      statut: StatutAbonnement.EN_GRACE,
      dateFin,
      plan: { typePlan: TypePlan.ELEVEUR },
    });

    const result = await getSubscriptionStatusForSite("site-1");

    expect(result.statut).toBe(StatutAbonnement.EN_GRACE);
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.daysRemaining).toBeLessThanOrEqual(3);
  });
});
