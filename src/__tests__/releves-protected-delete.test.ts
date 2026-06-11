/**
 * Tests unitaires — Garde-fou deleteReleve contre la suppression de relevés liés.
 *
 * Cas couverts (7) :
 *  1. typeReleve=TRANSFERT, transfertGroupeId non-null → throw "lié à un transfert"
 *  2. typeReleve=ARRIVAGE,  arrivageId non-null       → throw "lié à un arrivage"
 *  3. typeReleve=VENTE,     venteId non-null           → throw "lié à une vente"
 *  4. typeReleve=BIOMETRIE, calibrageId non-null       → throw "lié à un calibrage"
 *  5. typeReleve=TRANSFERT, toutes FK null             → suppression OK (relevé orphelin)
 *  6. typeReleve=BIOMETRIE, toutes FK null             → suppression OK (inchangé)
 *  7. typeReleve=MORTALITE, toutes FK null             → suppression OK (inchangé)
 *
 * Stratégie : mock complet de Prisma ($transaction).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteReleve } from "@/lib/queries/releves";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockReleveFindFirst = vi.fn();
const mockReleveDelete = vi.fn();
const mockProduitUpdate = vi.fn();
const mockMouvementStockDeleteMany = vi.fn();
const mockActiviteUpdate = vi.fn();

/** Simule prisma.$transaction en exécutant directement le callback avec un tx mock */
const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    releve: {
      findFirst: (...args: unknown[]) => mockReleveFindFirst(...args),
      delete: (...args: unknown[]) => mockReleveDelete(...args),
    },
    produit: {
      update: (...args: unknown[]) => mockProduitUpdate(...args),
    },
    mouvementStock: {
      deleteMany: (...args: unknown[]) => mockMouvementStockDeleteMany(...args),
    },
    activite: {
      update: (...args: unknown[]) => mockActiviteUpdate(...args),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) =>
      mockTransaction(...(args as Parameters<typeof mockTransaction>)),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReleve(overrides: {
  typeReleve: string;
  transfertGroupeId?: string | null;
  arrivageId?: string | null;
  venteId?: string | null;
  calibrageId?: string | null;
}) {
  return {
    id: "releve-1",
    siteId: "site-1",
    vagueId: "vague-1",
    bacId: "bac-1",
    typeReleve: overrides.typeReleve,
    transfertGroupeId: overrides.transfertGroupeId ?? null,
    arrivageId: overrides.arrivageId ?? null,
    venteId: overrides.venteId ?? null,
    calibrageId: overrides.calibrageId ?? null,
    consommations: [],
    activite: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deleteReleve — garde-fou relevés liés à une opération parente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default : delete + deleteMany succeed silently
    mockReleveDelete.mockResolvedValue({ id: "releve-1" });
    mockMouvementStockDeleteMany.mockResolvedValue({ count: 0 });
  });

  // Test 1 — TRANSFERT avec transfertGroupeId non-null
  it("refuse la suppression si typeReleve=TRANSFERT et transfertGroupeId non-null", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({
        typeReleve: TypeReleve.TRANSFERT,
        transfertGroupeId: "transfert-groupe-1",
      })
    );

    await expect(deleteReleve("site-1", "releve-1")).rejects.toThrow(
      "Ce releve est lie a un transfert. Supprimez d'abord l'operation parente."
    );
    expect(mockReleveDelete).not.toHaveBeenCalled();
  });

  // Test 2 — ARRIVAGE avec arrivageId non-null
  it("refuse la suppression si typeReleve=ARRIVAGE et arrivageId non-null", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({
        typeReleve: TypeReleve.ARRIVAGE,
        arrivageId: "arrivage-1",
      })
    );

    await expect(deleteReleve("site-1", "releve-1")).rejects.toThrow(
      "Ce releve est lie a un arrivage. Supprimez d'abord l'operation parente."
    );
    expect(mockReleveDelete).not.toHaveBeenCalled();
  });

  // Test 3 — VENTE avec venteId non-null
  it("refuse la suppression si typeReleve=VENTE et venteId non-null", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({
        typeReleve: TypeReleve.VENTE,
        venteId: "vente-1",
      })
    );

    await expect(deleteReleve("site-1", "releve-1")).rejects.toThrow(
      "Ce releve est lie a une vente. Supprimez d'abord l'operation parente."
    );
    expect(mockReleveDelete).not.toHaveBeenCalled();
  });

  // Test 4 — BIOMETRIE auto-créé par calibrage (calibrageId non-null)
  it("refuse la suppression si calibrageId non-null (peu importe typeReleve)", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({
        typeReleve: TypeReleve.BIOMETRIE,
        calibrageId: "calibrage-1",
      })
    );

    await expect(deleteReleve("site-1", "releve-1")).rejects.toThrow(
      "Ce releve est lie a un calibrage. Supprimez d'abord l'operation parente."
    );
    expect(mockReleveDelete).not.toHaveBeenCalled();
  });

  // Test 5 — TRANSFERT orphelin (toutes FK null) → suppression OK
  it("autorise la suppression si typeReleve=TRANSFERT mais toutes FK null (releve orphelin)", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({
        typeReleve: TypeReleve.TRANSFERT,
        // toutes FK null (parent déjà supprimé via SetNull)
      })
    );

    const result = await deleteReleve("site-1", "releve-1");
    expect(result.vagueId).toBe("vague-1");
    expect(mockReleveDelete).toHaveBeenCalledOnce();
  });

  // Test 6 — BIOMETRIE normal (toutes FK null) → suppression OK
  it("autorise la suppression si typeReleve=BIOMETRIE et toutes FK null", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({ typeReleve: TypeReleve.BIOMETRIE })
    );

    const result = await deleteReleve("site-1", "releve-1");
    expect(result.vagueId).toBe("vague-1");
    expect(mockReleveDelete).toHaveBeenCalledOnce();
  });

  // Test 7 — MORTALITE normal (toutes FK null) → suppression OK
  it("autorise la suppression si typeReleve=MORTALITE et toutes FK null", async () => {
    mockReleveFindFirst.mockResolvedValue(
      makeReleve({ typeReleve: TypeReleve.MORTALITE })
    );

    const result = await deleteReleve("site-1", "releve-1");
    expect(result.vagueId).toBe("vague-1");
    expect(mockReleveDelete).toHaveBeenCalledOnce();
  });
});
