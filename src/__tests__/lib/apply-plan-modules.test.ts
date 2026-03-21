/**
 * Tests unitaires — applyPlanModules / applyPlanModulesTx (Sprint 43)
 *
 * Couvre :
 * - applyPlanModules : plan introuvable → throw
 * - applyPlanModules : filtre les modules platform avant écriture
 * - applyPlanModules : met à jour site.enabledModules avec les bons modules
 * - applyPlanModules : plan sans modulesInclus → tableau vide
 * - applyPlanModulesTx : idem dans une transaction Prisma
 * - applyPlanModulesTx : plan introuvable dans tx → throw
 *
 * Story 43.5 — Sprint 43
 * R2 : enums SiteModule importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyPlanModules, applyPlanModulesTx } from "@/lib/abonnements/apply-plan-modules";
import { SiteModule, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPlanFindUnique = vi.fn();
const mockSiteUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    planAbonnement: {
      findUnique: (...args: unknown[]) => mockPlanFindUnique(...args),
    },
    site: {
      update: (...args: unknown[]) => mockSiteUpdate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const PLAN_SITE_MODULES = {
  modulesInclus: [SiteModule.GROSSISSEMENT, SiteModule.VENTES, SiteModule.INTRANTS],
  typePlan: TypePlan.ELEVEUR,
};

const PLAN_WITH_PLATFORM_MODULES = {
  modulesInclus: [
    SiteModule.GROSSISSEMENT,
    SiteModule.ABONNEMENTS,   // platform — doit être filtré
    SiteModule.COMMISSIONS,   // platform — doit être filtré
    SiteModule.REMISES,       // platform — doit être filtré
    SiteModule.VENTES,
  ],
  typePlan: TypePlan.PROFESSIONNEL,
};

const PLAN_EMPTY_MODULES = {
  modulesInclus: [],
  typePlan: TypePlan.DECOUVERTE,
};

// ---------------------------------------------------------------------------
// applyPlanModules — cas nominaux
// ---------------------------------------------------------------------------

describe("applyPlanModules — plan introuvable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw si le plan n'existe pas", async () => {
    mockPlanFindUnique.mockResolvedValue(null);

    await expect(
      applyPlanModules("site-abc", "plan-inexistant")
    ).rejects.toThrow(/Plan plan-inexistant introuvable/);

    expect(mockSiteUpdate).not.toHaveBeenCalled();
  });
});

describe("applyPlanModules — modules site-level uniquement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applique uniquement les modules site-level (filtre les modules platform)", async () => {
    mockPlanFindUnique.mockResolvedValue(PLAN_WITH_PLATFORM_MODULES);
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-1");

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-abc" },
      data: {
        enabledModules: [SiteModule.GROSSISSEMENT, SiteModule.VENTES],
      },
    });
  });

  it("ne write jamais ABONNEMENTS dans enabledModules", async () => {
    mockPlanFindUnique.mockResolvedValue({
      modulesInclus: [SiteModule.ABONNEMENTS],
      typePlan: TypePlan.ELEVEUR,
    });
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-1");

    const callArgs = mockSiteUpdate.mock.calls[0][0];
    expect(callArgs.data.enabledModules).not.toContain(SiteModule.ABONNEMENTS);
    expect(callArgs.data.enabledModules).toHaveLength(0);
  });

  it("ne write jamais COMMISSIONS dans enabledModules", async () => {
    mockPlanFindUnique.mockResolvedValue({
      modulesInclus: [SiteModule.COMMISSIONS, SiteModule.GROSSISSEMENT],
      typePlan: TypePlan.ELEVEUR,
    });
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-1");

    const callArgs = mockSiteUpdate.mock.calls[0][0];
    expect(callArgs.data.enabledModules).not.toContain(SiteModule.COMMISSIONS);
    expect(callArgs.data.enabledModules).toContain(SiteModule.GROSSISSEMENT);
  });

  it("ne write jamais REMISES dans enabledModules", async () => {
    mockPlanFindUnique.mockResolvedValue({
      modulesInclus: [SiteModule.REMISES, SiteModule.VENTES],
      typePlan: TypePlan.ELEVEUR,
    });
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-1");

    const callArgs = mockSiteUpdate.mock.calls[0][0];
    expect(callArgs.data.enabledModules).not.toContain(SiteModule.REMISES);
    expect(callArgs.data.enabledModules).toContain(SiteModule.VENTES);
  });
});

describe("applyPlanModules — plan avec modules valides", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passe tous les modules site-level tels quels", async () => {
    mockPlanFindUnique.mockResolvedValue(PLAN_SITE_MODULES);
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-eleveur");

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-abc" },
      data: {
        enabledModules: [SiteModule.GROSSISSEMENT, SiteModule.VENTES, SiteModule.INTRANTS],
      },
    });
  });

  it("accepte une liste vide de modules (désactivation de tous les modules)", async () => {
    mockPlanFindUnique.mockResolvedValue(PLAN_EMPTY_MODULES);
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-gratuit");

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-abc" },
      data: { enabledModules: [] },
    });
  });

  it("appelle findUnique avec le bon planId", async () => {
    mockPlanFindUnique.mockResolvedValue(PLAN_SITE_MODULES);
    mockSiteUpdate.mockResolvedValue({ id: "site-xyz" });

    await applyPlanModules("site-xyz", "plan-target");

    expect(mockPlanFindUnique).toHaveBeenCalledWith({
      where: { id: "plan-target" },
      select: { modulesInclus: true, typePlan: true },
    });
  });

  it("appelle site.update avec le bon siteId", async () => {
    mockPlanFindUnique.mockResolvedValue(PLAN_SITE_MODULES);
    mockSiteUpdate.mockResolvedValue({ id: "site-xyz" });

    await applyPlanModules("site-xyz", "plan-eleveur");

    const callArgs = mockSiteUpdate.mock.calls[0][0];
    expect(callArgs.where.id).toBe("site-xyz");
  });
});

// ---------------------------------------------------------------------------
// applyPlanModulesTx — variante transactionnelle
// ---------------------------------------------------------------------------

describe("applyPlanModulesTx — dans une transaction Prisma", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw si le plan est introuvable dans la transaction", async () => {
    const mockTx = {
      planAbonnement: { findUnique: vi.fn().mockResolvedValue(null) },
      site: { update: vi.fn() },
    };

    await expect(
      applyPlanModulesTx(mockTx as never, "site-abc", "plan-inexistant")
    ).rejects.toThrow(/Plan plan-inexistant introuvable/);

    expect(mockTx.site.update).not.toHaveBeenCalled();
  });

  it("filtre les modules platform dans la transaction", async () => {
    const mockTx = {
      planAbonnement: {
        findUnique: vi.fn().mockResolvedValue(PLAN_WITH_PLATFORM_MODULES),
      },
      site: { update: vi.fn().mockResolvedValue({ id: "site-abc" }) },
    };

    await applyPlanModulesTx(mockTx as never, "site-abc", "plan-1");

    expect(mockTx.site.update).toHaveBeenCalledWith({
      where: { id: "site-abc" },
      data: {
        enabledModules: [SiteModule.GROSSISSEMENT, SiteModule.VENTES],
      },
    });
  });

  it("applique les modules site-level valides dans la transaction", async () => {
    const mockTx = {
      planAbonnement: {
        findUnique: vi.fn().mockResolvedValue(PLAN_SITE_MODULES),
      },
      site: { update: vi.fn().mockResolvedValue({ id: "site-abc" }) },
    };

    await applyPlanModulesTx(mockTx as never, "site-abc", "plan-eleveur");

    const callArgs = mockTx.site.update.mock.calls[0][0];
    expect(callArgs.data.enabledModules).toEqual([
      SiteModule.GROSSISSEMENT,
      SiteModule.VENTES,
      SiteModule.INTRANTS,
    ]);
  });

  it("liste vide de modules → enabledModules vide dans la transaction", async () => {
    const mockTx = {
      planAbonnement: {
        findUnique: vi.fn().mockResolvedValue(PLAN_EMPTY_MODULES),
      },
      site: { update: vi.fn().mockResolvedValue({ id: "site-abc" }) },
    };

    await applyPlanModulesTx(mockTx as never, "site-abc", "plan-gratuit");

    const callArgs = mockTx.site.update.mock.calls[0][0];
    expect(callArgs.data.enabledModules).toEqual([]);
  });

  it("utilise le tx (pas prisma global) pour findUnique", async () => {
    const mockTx = {
      planAbonnement: {
        findUnique: vi.fn().mockResolvedValue(PLAN_SITE_MODULES),
      },
      site: { update: vi.fn().mockResolvedValue({ id: "site-abc" }) },
    };

    await applyPlanModulesTx(mockTx as never, "site-abc", "plan-eleveur");

    expect(mockTx.planAbonnement.findUnique).toHaveBeenCalledOnce();
    // Le mock global (prisma) ne doit pas avoir été appelé
    expect(mockPlanFindUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cas limites — idempotence et ordre des modules
// ---------------------------------------------------------------------------

describe("applyPlanModules — cas limites", () => {
  beforeEach(() => vi.clearAllMocks());

  it("plan avec uniquement des modules platform → enabledModules vide", async () => {
    mockPlanFindUnique.mockResolvedValue({
      modulesInclus: [SiteModule.ABONNEMENTS, SiteModule.COMMISSIONS, SiteModule.REMISES],
      typePlan: TypePlan.DECOUVERTE,
    });
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-platform-only");

    const callArgs = mockSiteUpdate.mock.calls[0][0];
    expect(callArgs.data.enabledModules).toHaveLength(0);
  });

  it("plan avec tous les modules site-level → tous passent le filtre", async () => {
    const allSiteModules = [
      SiteModule.REPRODUCTION,
      SiteModule.GROSSISSEMENT,
      SiteModule.INTRANTS,
      SiteModule.VENTES,
      SiteModule.ANALYSE_PILOTAGE,
      SiteModule.CONFIGURATION,
      SiteModule.INGENIEUR,
      SiteModule.NOTES,
    ];
    mockPlanFindUnique.mockResolvedValue({
      modulesInclus: allSiteModules,
      typePlan: TypePlan.ENTREPRISE,
    });
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-full");

    const callArgs = mockSiteUpdate.mock.calls[0][0];
    expect(callArgs.data.enabledModules).toHaveLength(8);
    expect(callArgs.data.enabledModules).toEqual(allSiteModules);
  });

  it("appelé deux fois de suite → site.update appelé deux fois (idempotence)", async () => {
    mockPlanFindUnique.mockResolvedValue(PLAN_SITE_MODULES);
    mockSiteUpdate.mockResolvedValue({ id: "site-abc" });

    await applyPlanModules("site-abc", "plan-eleveur");
    await applyPlanModules("site-abc", "plan-eleveur");

    expect(mockSiteUpdate).toHaveBeenCalledTimes(2);
  });
});
