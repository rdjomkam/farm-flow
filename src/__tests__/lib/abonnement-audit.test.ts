/**
 * Tests unitaires — logAbonnementAudit + getAbonnementActifPourSite
 *
 * Story 53.1 — Sprint 53
 * Couvre :
 * - logAbonnementAudit : toutes les actions loguées correctement
 * - getAbonnementActifPourSite : résolution via ownerId, site introuvable, owner sans abonnement
 *
 * R2 : enums StatutAbonnement, TypePlan importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatutAbonnement, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — next/cache
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — Prisma
// ---------------------------------------------------------------------------

const mockAbonnementAuditCreate = vi.fn();
const mockAbonnementFindFirst = vi.fn();
const mockSiteFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnementAudit: {
      create: (...args: unknown[]) => mockAbonnementAuditCreate(...args),
    },
    abonnement: {
      findFirst: (...args: unknown[]) => mockAbonnementFindFirst(...args),
    },
    site: {
      findUnique: (...args: unknown[]) => mockSiteFindUnique(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports après les mocks
// ---------------------------------------------------------------------------

import {
  logAbonnementAudit,
  getAbonnementActifPourSite,
} from "@/lib/queries/abonnements";

// ---------------------------------------------------------------------------
// Tests : logAbonnementAudit
// ---------------------------------------------------------------------------

describe("logAbonnementAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAbonnementAuditCreate.mockResolvedValue({
      id: "audit-1",
      abonnementId: "abo-1",
      action: "TEST",
      userId: "user-1",
      metadata: null,
      createdAt: new Date(),
    });
  });

  it("crée une entrée d'audit avec les champs obligatoires", async () => {
    await logAbonnementAudit("abo-1", "ACTIVATION", "user-1");

    expect(mockAbonnementAuditCreate).toHaveBeenCalledOnce();
    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { abonnementId: string; action: string; userId: string; metadata?: unknown };
    };
    expect(callArgs.data.abonnementId).toBe("abo-1");
    expect(callArgs.data.action).toBe("ACTIVATION");
    expect(callArgs.data.userId).toBe("user-1");
  });

  it("logue l'action CREATION_ESSAI correctement", async () => {
    const metadata = { planId: "plan-1", typePlan: "ELEVEUR", dureeEssaiJours: 14 };
    await logAbonnementAudit("abo-essai-1", "CREATION_ESSAI", "user-1", metadata);

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string; metadata: unknown };
    };
    expect(callArgs.data.action).toBe("CREATION_ESSAI");
    expect(callArgs.data.metadata).toEqual(metadata);
  });

  it("logue l'action CONVERSION_ESSAI correctement", async () => {
    const metadata = { planId: "plan-2", typePlan: "PROFESSIONNEL", prixPlan: 8000 };
    await logAbonnementAudit("abo-essai-2", "CONVERSION_ESSAI", "user-2", metadata);

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string; userId: string };
    };
    expect(callArgs.data.action).toBe("CONVERSION_ESSAI");
    expect(callArgs.data.userId).toBe("user-2");
  });

  it("logue l'action UPGRADE correctement", async () => {
    const metadata = {
      abonnementPrecedentId: "abo-old",
      ancienPlanNom: "Eleveur",
      nouveauPlanNom: "Professionnel",
      creditProrata: 1500,
      montantAPaye: 0,
    };
    await logAbonnementAudit("abo-new", "UPGRADE", "user-3", metadata);

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string; metadata: Record<string, unknown> };
    };
    expect(callArgs.data.action).toBe("UPGRADE");
    expect(callArgs.data.metadata).toMatchObject({ creditProrata: 1500, montantAPaye: 0 });
  });

  it("logue l'action DOWNGRADE_PROGRAMME correctement", async () => {
    const metadata = { nouveauPlanId: "plan-eleveur", dateApplicationPrevue: "2026-05-01" };
    await logAbonnementAudit("abo-1", "DOWNGRADE_PROGRAMME", "user-1", metadata);

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string };
    };
    expect(callArgs.data.action).toBe("DOWNGRADE_PROGRAMME");
  });

  it("logue l'action DOWNGRADE_ANNULE correctement", async () => {
    await logAbonnementAudit("abo-1", "DOWNGRADE_ANNULE", "user-1", {
      ancienDowngradePlanId: "plan-old",
    });

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string };
    };
    expect(callArgs.data.action).toBe("DOWNGRADE_ANNULE");
  });

  it("logue l'action EXONERATION correctement", async () => {
    const metadata = {
      motif: "Partenaire DKFarm",
      userId: "user-partenaire",
      dateFin: "2099-12-31T23:59:59.000Z",
    };
    await logAbonnementAudit("abo-exo-1", "EXONERATION", "admin-1", metadata);

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string; userId: string; metadata: Record<string, unknown> };
    };
    expect(callArgs.data.action).toBe("EXONERATION");
    expect(callArgs.data.userId).toBe("admin-1");
    expect(callArgs.data.metadata).toMatchObject({ motif: "Partenaire DKFarm" });
  });

  it("logue l'action ANNULATION_EXONERATION correctement", async () => {
    const metadata = { motifOriginal: "Partenaire DKFarm", annulePar: "admin-2" };
    await logAbonnementAudit("abo-exo-1", "ANNULATION_EXONERATION", "admin-2", metadata);

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { action: string };
    };
    expect(callArgs.data.action).toBe("ANNULATION_EXONERATION");
  });

  it("sans metadata → metadata non passé à Prisma (undefined)", async () => {
    await logAbonnementAudit("abo-1", "ACTIVATION", "user-1");

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { metadata: unknown };
    };
    // metadata undefined → Prisma l'ignore (non passé)
    expect(callArgs.data.metadata).toBeUndefined();
  });

  it("avec metadata vide {} → metadata passé comme objet vide", async () => {
    await logAbonnementAudit("abo-1", "ACTIVATION", "user-1", {});

    const callArgs = mockAbonnementAuditCreate.mock.calls[0][0] as {
      data: { metadata: unknown };
    };
    expect(callArgs.data.metadata).toBeDefined();
  });

  it("retourne le résultat de Prisma create", async () => {
    const mockAudit = {
      id: "audit-42",
      abonnementId: "abo-1",
      action: "TEST",
      userId: "user-1",
      metadata: null,
      createdAt: new Date(),
    };
    mockAbonnementAuditCreate.mockResolvedValueOnce(mockAudit);

    const result = await logAbonnementAudit("abo-1", "TEST", "user-1");

    expect(result).toEqual(mockAudit);
  });
});

// ---------------------------------------------------------------------------
// Tests : getAbonnementActifPourSite
// ---------------------------------------------------------------------------

describe("getAbonnementActifPourSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("résout l'abonnement via ownerId du site", async () => {
    // Site trouvé → ownerId → findFirst retourne un abonnement actif
    mockSiteFindUnique.mockResolvedValue({ ownerId: "owner-1" });
    const dateFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-owner-1",
      userId: "owner-1",
      statut: StatutAbonnement.ACTIF,
      dateFin,
      plan: { typePlan: TypePlan.ELEVEUR },
    });

    const result = await getAbonnementActifPourSite("site-1");

    expect(result).not.toBeNull();
    expect(result?.statut).toBe(StatutAbonnement.ACTIF);
    expect(result?.plan.typePlan).toBe(TypePlan.ELEVEUR);
  });

  it("site introuvable → retourne null", async () => {
    mockSiteFindUnique.mockResolvedValue(null);

    const result = await getAbonnementActifPourSite("site-inexistant");

    expect(result).toBeNull();
    // findFirst ne doit pas être appelé si le site n'existe pas
    expect(mockAbonnementFindFirst).not.toHaveBeenCalled();
  });

  it("owner sans abonnement actif → retourne null", async () => {
    mockSiteFindUnique.mockResolvedValue({ ownerId: "owner-sans-abo" });
    mockAbonnementFindFirst.mockResolvedValue(null);

    const result = await getAbonnementActifPourSite("site-2");

    expect(result).toBeNull();
  });

  it("abonnement EN_GRACE retourné pour le site", async () => {
    mockSiteFindUnique.mockResolvedValue({ ownerId: "owner-grace" });
    const dateFin = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-grace",
      userId: "owner-grace",
      statut: StatutAbonnement.EN_GRACE,
      dateFin,
      plan: { typePlan: TypePlan.PROFESSIONNEL },
    });

    const result = await getAbonnementActifPourSite("site-grace");

    expect(result?.statut).toBe(StatutAbonnement.EN_GRACE);
    expect(result?.plan.typePlan).toBe(TypePlan.PROFESSIONNEL);
  });

  it("abonnement EXONERATION retourné pour le site (owner exonéré)", async () => {
    mockSiteFindUnique.mockResolvedValue({ ownerId: "owner-exo" });
    const dateFin = new Date("2099-12-31T23:59:59.000Z");
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-exo",
      userId: "owner-exo",
      statut: StatutAbonnement.ACTIF,
      dateFin,
      plan: { typePlan: TypePlan.EXONERATION },
    });

    const result = await getAbonnementActifPourSite("site-exo");

    expect(result?.plan.typePlan).toBe(TypePlan.EXONERATION);
    expect(result?.statut).toBe(StatutAbonnement.ACTIF);
  });
});
