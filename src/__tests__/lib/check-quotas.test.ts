/**
 * Tests unitaires — src/lib/abonnements/check-quotas.ts (Sprint 36)
 *
 * Couvre :
 * - normaliseLimite(999) → null (illimité)
 * - normaliseLimite(10)  → 10  (fini)
 * - normaliseLimite(null via cast) → null
 * - isQuotaAtteint({ actuel: 3, limite: 3 })    → true  (quota plein)
 * - isQuotaAtteint({ actuel: 2, limite: 3 })    → false (quota non plein)
 * - isQuotaAtteint({ actuel: 5, limite: null })  → false (illimité)
 * - getQuotasUsage — plan DECOUVERTE, 3 bacs → quota plein
 * - getQuotasUsage — plan ELEVEUR, 2/10 bacs  → quota non plein
 * - getQuotasUsage — plan ENTREPRISE          → limite null (illimité)
 * - getQuotasUsage — pas d'abonnement actif   → limites DECOUVERTE
 *
 * Story 36.4 — Sprint 36
 * R2 : enums StatutVague, TypePlan importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normaliseLimite,
  isQuotaAtteint,
  getQuotasUsage,
} from "@/lib/abonnements/check-quotas";
import { TypePlan } from "@/types";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAbonnementActifPourSite = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActifPourSite: (...args: unknown[]) => mockGetAbonnementActifPourSite(...args),
}));

const mockPrismaBacCount = vi.fn();
const mockPrismaVagueCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    bac: {
      count: (...args: unknown[]) => mockPrismaBacCount(...args),
    },
    vague: {
      count: (...args: unknown[]) => mockPrismaVagueCount(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests : normaliseLimite
// ---------------------------------------------------------------------------

describe("normaliseLimite", () => {
  it("999 → null (seuil illimité)", () => {
    expect(normaliseLimite(999)).toBeNull();
  });

  it("valeur > 999 → null (au-dessus du seuil)", () => {
    expect(normaliseLimite(1000)).toBeNull();
  });

  it("10 → 10 (limite finie conservée)", () => {
    expect(normaliseLimite(10)).toBe(10);
  });

  it("1 → 1 (limite minimale conservée)", () => {
    expect(normaliseLimite(1)).toBe(1);
  });

  it("998 → 998 (juste en dessous du seuil)", () => {
    expect(normaliseLimite(998)).toBe(998);
  });

  it("3 → 3 (limite DECOUVERTE conservée)", () => {
    expect(normaliseLimite(3)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests : isQuotaAtteint
// ---------------------------------------------------------------------------

describe("isQuotaAtteint", () => {
  it("actuel=3, limite=3 → true (quota plein exact)", () => {
    expect(isQuotaAtteint({ actuel: 3, limite: 3 })).toBe(true);
  });

  it("actuel=4, limite=3 → true (quota dépassé)", () => {
    expect(isQuotaAtteint({ actuel: 4, limite: 3 })).toBe(true);
  });

  it("actuel=2, limite=3 → false (quota non plein)", () => {
    expect(isQuotaAtteint({ actuel: 2, limite: 3 })).toBe(false);
  });

  it("actuel=0, limite=3 → false (aucune ressource utilisée)", () => {
    expect(isQuotaAtteint({ actuel: 0, limite: 3 })).toBe(false);
  });

  it("actuel=5, limite=null → false (illimité, jamais atteint)", () => {
    expect(isQuotaAtteint({ actuel: 5, limite: null })).toBe(false);
  });

  it("actuel=0, limite=null → false (illimité sans usage)", () => {
    expect(isQuotaAtteint({ actuel: 0, limite: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests : getQuotasUsage
// ---------------------------------------------------------------------------

describe("getQuotasUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plan DECOUVERTE avec 3 bacs → quota bacs plein (isQuotaAtteint = true)", async () => {
    // DECOUVERTE : limitesBacs = 3, limitesVagues = 1
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-decouverte",
      plan: { typePlan: TypePlan.DECOUVERTE },
    });
    mockPrismaBacCount.mockResolvedValue(3);
    mockPrismaVagueCount.mockResolvedValue(0);

    const result = await getQuotasUsage("site-1");

    expect(result.bacs.actuel).toBe(3);
    expect(result.bacs.limite).toBe(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs);
    expect(isQuotaAtteint(result.bacs)).toBe(true);
  });

  it("plan DECOUVERTE avec 1 bac → quota bacs non plein (isQuotaAtteint = false)", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-decouverte",
      plan: { typePlan: TypePlan.DECOUVERTE },
    });
    mockPrismaBacCount.mockResolvedValue(1);
    mockPrismaVagueCount.mockResolvedValue(0);

    const result = await getQuotasUsage("site-1");

    expect(result.bacs.actuel).toBe(1);
    expect(isQuotaAtteint(result.bacs)).toBe(false);
  });

  it("plan ELEVEUR avec 2 bacs sur 10 → quota non plein", async () => {
    // ELEVEUR : limitesBacs = 10, limitesVagues = 3
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-eleveur",
      plan: { typePlan: TypePlan.ELEVEUR },
    });
    mockPrismaBacCount.mockResolvedValue(2);
    mockPrismaVagueCount.mockResolvedValue(1);

    const result = await getQuotasUsage("site-2");

    expect(result.bacs.actuel).toBe(2);
    expect(result.bacs.limite).toBe(PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs);
    expect(isQuotaAtteint(result.bacs)).toBe(false);
    expect(result.vagues.actuel).toBe(1);
    expect(result.vagues.limite).toBe(PLAN_LIMITES[TypePlan.ELEVEUR].limitesVagues);
  });

  it("plan ENTREPRISE → limite null (illimité) sur bacs, vagues, sites", async () => {
    // ENTREPRISE : limitesBacs = 999 → normalisé null
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-entreprise",
      plan: { typePlan: TypePlan.ENTREPRISE },
    });
    mockPrismaBacCount.mockResolvedValue(150);
    mockPrismaVagueCount.mockResolvedValue(50);

    const result = await getQuotasUsage("site-3");

    expect(result.bacs.limite).toBeNull();
    expect(result.vagues.limite).toBeNull();
    expect(result.sites.limite).toBeNull();
    expect(isQuotaAtteint(result.bacs)).toBe(false);
    expect(isQuotaAtteint(result.vagues)).toBe(false);
    expect(isQuotaAtteint(result.sites)).toBe(false);
  });

  it("pas d'abonnement actif → retourne null (pas de crash)", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(null);
    mockPrismaBacCount.mockResolvedValue(0);
    mockPrismaVagueCount.mockResolvedValue(0);

    const result = await getQuotasUsage("site-sans-abo");
    expect(result).toBeNull();
  });

  it("sites.actuel est toujours 1 (un site ne gère que lui-même)", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-eleveur",
      plan: { typePlan: TypePlan.ELEVEUR },
    });
    mockPrismaBacCount.mockResolvedValue(5);
    mockPrismaVagueCount.mockResolvedValue(1);

    const result = await getQuotasUsage("site-1");

    expect(result.sites.actuel).toBe(1);
  });

  it("plan PROFESSIONNEL — limites bacs=30, vagues=10", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-pro",
      plan: { typePlan: TypePlan.PROFESSIONNEL },
    });
    mockPrismaBacCount.mockResolvedValue(15);
    mockPrismaVagueCount.mockResolvedValue(4);

    const result = await getQuotasUsage("site-pro");

    expect(result.bacs.limite).toBe(30);
    expect(result.vagues.limite).toBe(10);
    expect(isQuotaAtteint(result.bacs)).toBe(false);
    expect(isQuotaAtteint(result.vagues)).toBe(false);
  });

  it("plan DECOUVERTE, 1 vague active → quota vagues plein (limite=1)", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-decouverte-2",
      plan: { typePlan: TypePlan.DECOUVERTE },
    });
    mockPrismaBacCount.mockResolvedValue(1);
    mockPrismaVagueCount.mockResolvedValue(1);

    const result = await getQuotasUsage("site-dec");

    expect(result.vagues.actuel).toBe(1);
    expect(result.vagues.limite).toBe(1);
    expect(isQuotaAtteint(result.vagues)).toBe(true);
  });

  it("plan inconnu → lève QUOTA_PLAN_INCONNU (Sprint 52 : fallback DECOUVERTE supprimé)", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-inconnu",
      // typePlan invalide non présent dans PLAN_LIMITES
      plan: { typePlan: "PLAN_INEXISTANT" },
    });
    mockPrismaBacCount.mockResolvedValue(2);
    mockPrismaVagueCount.mockResolvedValue(0);

    await expect(getQuotasUsage("site-fallback")).rejects.toThrow("QUOTA_PLAN_INCONNU");
  });

  it("les comptes Prisma sont appelés avec le bon siteId", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-1",
      plan: { typePlan: TypePlan.ELEVEUR },
    });
    mockPrismaBacCount.mockResolvedValue(0);
    mockPrismaVagueCount.mockResolvedValue(0);

    await getQuotasUsage("site-xyz");

    expect(mockPrismaBacCount).toHaveBeenCalledWith({
      where: { siteId: "site-xyz", isBlocked: false },
    });
    expect(mockPrismaVagueCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteId: "site-xyz", isBlocked: false }),
      })
    );
  });
});
