/**
 * Tests Sprint 23 — Lifecycle PackActivation et archivage activites
 *
 * Couvre :
 *   expirePackActivations   : ACTIVE → EXPIREE si vague TERMINEE
 *   suspendPackActivations  : ACTIVE → SUSPENDUE si vague ANNULEE
 *   archiveOldActivities    : compte les activites TERMINEE/ANNULEE > ageDays
 *   runLifecycle            : agregation des 3 fonctions, collecte des erreurs
 *
 * Strategiie : mock complet de Prisma (prisma.packActivation, prisma.activite).
 * Tests purement unitaires — pas d'acces DB.
 *
 * Regles testees :
 *   R4 — updateMany atomique (verifie que updateMany est appele, pas update en boucle)
 *   R8 — siteId passe en parametre et utilise dans le where
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  expirePackActivations,
  suspendPackActivations,
  archiveOldActivities,
  runLifecycle,
} from "@/lib/queries/lifecycle";
import { StatutActivation, StatutVague, StatutActivite } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPackActivationFindMany = vi.fn();
const mockPackActivationUpdateMany = vi.fn();
const mockActiviteCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    packActivation: {
      findMany: (...args: unknown[]) => mockPackActivationFindMany(...args),
      updateMany: (...args: unknown[]) => mockPackActivationUpdateMany(...args),
    },
    activite: {
      count: (...args: unknown[]) => mockActiviteCount(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// expirePackActivations
// ---------------------------------------------------------------------------

describe("expirePackActivations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne updated=0 si aucune activation a expirer", async () => {
    mockPackActivationFindMany.mockResolvedValue([]);

    const result = await expirePackActivations("site-dkfarm");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockPackActivationUpdateMany).not.toHaveBeenCalled();
  });

  it("expire les activations ACTIVE dont une vague est TERMINEE", async () => {
    const activationsToExpire = [{ id: "act-1" }, { id: "act-2" }];
    mockPackActivationFindMany.mockResolvedValue(activationsToExpire);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 2 });

    const result = await expirePackActivations("site-dkfarm");

    expect(result.updated).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("utilise updateMany atomique (R4) — pas d'update individuel", async () => {
    mockPackActivationFindMany.mockResolvedValue([{ id: "act-1" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 1 });

    await expirePackActivations("site-dkfarm");

    // updateMany appele une seule fois (atomique)
    expect(mockPackActivationUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("passe le statut EXPIREE a updateMany (R2 — enum importe)", async () => {
    mockPackActivationFindMany.mockResolvedValue([{ id: "act-1" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 1 });

    await expirePackActivations("site-dkfarm");

    expect(mockPackActivationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statut: StatutActivation.EXPIREE },
      })
    );
  });

  it("filtre par statut ACTIVE dans findMany (R8 — siteId)", async () => {
    mockPackActivationFindMany.mockResolvedValue([]);

    await expirePackActivations("site-dkfarm");

    expect(mockPackActivationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: "site-dkfarm",
          statut: StatutActivation.ACTIVE,
          vagues: {
            some: { statut: StatutVague.TERMINEE },
          },
        }),
      })
    );
  });

  it("retourne les erreurs si Prisma echoue", async () => {
    mockPackActivationFindMany.mockRejectedValue(new Error("DB connection error"));

    const result = await expirePackActivations("site-dkfarm");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("expirePackActivations");
    expect(result.errors[0]).toContain("site-dkfarm");
  });

  it("le siteId est utilise dans le filtre (R8)", async () => {
    mockPackActivationFindMany.mockResolvedValue([]);

    await expirePackActivations("site-autre");

    expect(mockPackActivationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteId: "site-autre" }),
      })
    );
  });

  it("la garde updateMany inclut statut ACTIVE pour eviter les race conditions", async () => {
    mockPackActivationFindMany.mockResolvedValue([{ id: "act-1" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 1 });

    await expirePackActivations("site-dkfarm");

    expect(mockPackActivationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: StatutActivation.ACTIVE,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// suspendPackActivations
// ---------------------------------------------------------------------------

describe("suspendPackActivations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne updated=0 si aucune activation a suspendre", async () => {
    mockPackActivationFindMany.mockResolvedValue([]);

    const result = await suspendPackActivations("site-dkfarm");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockPackActivationUpdateMany).not.toHaveBeenCalled();
  });

  it("suspend les activations ACTIVE dont une vague est ANNULEE", async () => {
    mockPackActivationFindMany.mockResolvedValue([{ id: "act-1" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await suspendPackActivations("site-dkfarm");

    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("passe le statut SUSPENDUE a updateMany (R2 — enum importe)", async () => {
    mockPackActivationFindMany.mockResolvedValue([{ id: "act-1" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 1 });

    await suspendPackActivations("site-dkfarm");

    expect(mockPackActivationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statut: StatutActivation.SUSPENDUE },
      })
    );
  });

  it("filtre par vagues ANNULEE dans findMany", async () => {
    mockPackActivationFindMany.mockResolvedValue([]);

    await suspendPackActivations("site-dkfarm");

    expect(mockPackActivationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vagues: {
            some: { statut: StatutVague.ANNULEE },
          },
        }),
      })
    );
  });

  it("retourne les erreurs si Prisma echoue", async () => {
    mockPackActivationFindMany.mockRejectedValue(new Error("Timeout"));

    const result = await suspendPackActivations("site-dkfarm");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("suspendPackActivations");
  });

  it("utilise updateMany atomique (R4)", async () => {
    mockPackActivationFindMany.mockResolvedValue([{ id: "act-1" }, { id: "act-2" }, { id: "act-3" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 3 });

    await suspendPackActivations("site-dkfarm");

    // Un seul appel updateMany, pas 3 updates individuels
    expect(mockPackActivationUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockPackActivationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["act-1", "act-2", "act-3"] },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// archiveOldActivities
// ---------------------------------------------------------------------------

describe("archiveOldActivities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne le nombre d'activites concernees", async () => {
    mockActiviteCount.mockResolvedValue(5);

    const result = await archiveOldActivities("site-dkfarm");

    expect(result.updated).toBe(5);
    expect(result.errors).toHaveLength(0);
  });

  it("retourne 0 si aucune activite ancienne", async () => {
    mockActiviteCount.mockResolvedValue(0);

    const result = await archiveOldActivities("site-dkfarm");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("filtre les statuts TERMINEE et ANNULEE", async () => {
    mockActiviteCount.mockResolvedValue(3);

    await archiveOldActivities("site-dkfarm");

    expect(mockActiviteCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: {
            in: [StatutActivite.TERMINEE, StatutActivite.ANNULEE],
          },
        }),
      })
    );
  });

  it("utilise un seuil de 90 jours par defaut", async () => {
    mockActiviteCount.mockResolvedValue(0);

    const beforeCall = Date.now();
    await archiveOldActivities("site-dkfarm");
    const afterCall = Date.now();

    const call = mockActiviteCount.mock.calls[0][0];
    const cutoff: Date = call.where.updatedAt.lte;

    // Le cutoff doit etre il y a ~90 jours
    const cutoffMs = cutoff.getTime();
    const expectedMin = beforeCall - 90 * 24 * 60 * 60 * 1000 - 5000;
    const expectedMax = afterCall - 90 * 24 * 60 * 60 * 1000 + 5000;

    expect(cutoffMs).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoffMs).toBeLessThanOrEqual(expectedMax);
  });

  it("accepte un seuil personnalise (ageDays=30)", async () => {
    mockActiviteCount.mockResolvedValue(2);

    const beforeCall = Date.now();
    await archiveOldActivities("site-dkfarm", 30);
    const afterCall = Date.now();

    const call = mockActiviteCount.mock.calls[0][0];
    const cutoff: Date = call.where.updatedAt.lte;

    const cutoffMs = cutoff.getTime();
    const expectedMin = beforeCall - 30 * 24 * 60 * 60 * 1000 - 5000;
    const expectedMax = afterCall - 30 * 24 * 60 * 60 * 1000 + 5000;

    expect(cutoffMs).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoffMs).toBeLessThanOrEqual(expectedMax);
  });

  it("filtre par siteId (R8)", async () => {
    mockActiviteCount.mockResolvedValue(0);

    await archiveOldActivities("site-xyz");

    expect(mockActiviteCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteId: "site-xyz" }),
      })
    );
  });

  it("retourne les erreurs si Prisma echoue", async () => {
    mockActiviteCount.mockRejectedValue(new Error("Count failed"));

    const result = await archiveOldActivities("site-dkfarm");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("archiveOldActivities");
  });
});

// ---------------------------------------------------------------------------
// runLifecycle
// ---------------------------------------------------------------------------

describe("runLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("execute les 3 operations et retourne les statistiques", async () => {
    // expirePackActivations : 2 expirees
    mockPackActivationFindMany
      .mockResolvedValueOnce([{ id: "act-1" }, { id: "act-2" }]) // expire
      .mockResolvedValueOnce([]); // suspend

    mockPackActivationUpdateMany.mockResolvedValue({ count: 2 });
    mockActiviteCount.mockResolvedValue(10);

    const result = await runLifecycle("site-dkfarm");

    expect(result.expirationsPackActivation).toBe(2);
    expect(result.suspensionsPackActivation).toBe(0);
    expect(result.activitesArchivees).toBe(10);
    expect(result.errors).toHaveLength(0);
  });

  it("collecte toutes les erreurs des 3 operations", async () => {
    mockPackActivationFindMany.mockRejectedValue(new Error("DB error 1"));
    mockActiviteCount.mockRejectedValue(new Error("DB error 3"));

    const result = await runLifecycle("site-dkfarm");

    // expire et suspend appellent toutes les deux findMany → 2 erreurs
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.expirationsPackActivation).toBe(0);
    expect(result.suspensionsPackActivation).toBe(0);
  });

  it("retourne 0 pour toutes les stats si aucune entite concernee", async () => {
    mockPackActivationFindMany.mockResolvedValue([]);
    mockActiviteCount.mockResolvedValue(0);

    const result = await runLifecycle("site-dkfarm");

    expect(result.expirationsPackActivation).toBe(0);
    expect(result.suspensionsPackActivation).toBe(0);
    expect(result.activitesArchivees).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("les erreurs d'une operation n'empechent pas les autres d'etre executees", async () => {
    // expire echoue, suspend et archive reussissent
    mockPackActivationFindMany
      .mockRejectedValueOnce(new Error("expire error"))
      .mockResolvedValueOnce([{ id: "act-1" }]);
    mockPackActivationUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteCount.mockResolvedValue(5);

    const result = await runLifecycle("site-dkfarm");

    // expire a echoue → 0
    expect(result.expirationsPackActivation).toBe(0);
    // suspend a reussi → 1
    expect(result.suspensionsPackActivation).toBe(1);
    // archive a reussi → 5
    expect(result.activitesArchivees).toBe(5);
    // 1 erreur collectee
    expect(result.errors).toHaveLength(1);
  });
});
