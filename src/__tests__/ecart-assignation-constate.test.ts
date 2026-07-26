/**
 * Tests SU.2 — Persistance des écarts de conservation tolérés (ADR-048).
 *
 * Couvre :
 * - persisterEcartConstate : upsert quand ecart !== 0, résolution quand ecart === 0
 * - non-régression du guard : verifyAssignationInvariant continue de tolérer
 *   un écart préexistant identique avant/après (ne bloque pas)
 * - non-propagation : un échec d'écriture du journal d'écart n'est jamais
 *   propagé à l'opération métier appelante (ADR-048 section 6)
 * - getBacsEnDerive : requête « bacs en dérive » (query layer)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyAssignationInvariant,
  persisterEcartConstate,
} from "@/lib/guards/assignation-invariant";
import { ContexteDetectionEcart } from "@/types";

const mockAssignationBacFindMany = vi.fn();
const mockReleveFindMany = vi.fn();
const mockTransfertGroupeFindMany = vi.fn();
const mockEcartUpsert = vi.fn();
const mockEcartFindUnique = vi.fn();
const mockEcartUpdate = vi.fn();

function buildTxWithEcartModel() {
  return {
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
    ecartAssignationConstate: {
      upsert: (...args: unknown[]) => mockEcartUpsert(...args),
      findUnique: (...args: unknown[]) => mockEcartFindUnique(...args),
      update: (...args: unknown[]) => mockEcartUpdate(...args),
    },
  } as unknown as Parameters<typeof verifyAssignationInvariant>[0];
}

/** tx SANS le modèle ecartAssignationConstate — simule un échec d'écriture. */
function buildTxWithoutEcartModel() {
  return {
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
  } as unknown as Parameters<typeof verifyAssignationInvariant>[0];
}

const SITE_ID = "site-su2";
const VAGUE_ID = "vague-su2";
const BAC_A = "bac-su2-a";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SU.2 — persisterEcartConstate", () => {
  it("upsert avec create/update quand ecart !== 0", async () => {
    const tx = buildTxWithEcartModel();
    await persisterEcartConstate(tx, SITE_ID, VAGUE_ID, BAC_A, 3, {
      userId: "user-1",
      contexte: ContexteDetectionEcart.CALIBRAGE,
    });

    expect(mockEcartUpsert).toHaveBeenCalledTimes(1);
    const call = mockEcartUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ bacId: BAC_A });
    expect(call.create).toMatchObject({
      siteId: SITE_ID,
      bacId: BAC_A,
      vagueId: VAGUE_ID,
      ecart: 3,
      dernierContexte: ContexteDetectionEcart.CALIBRAGE,
      dernierActorId: "user-1",
    });
    expect(call.update).toMatchObject({
      ecart: 3,
      dernierContexte: ContexteDetectionEcart.CALIBRAGE,
      dernierActorId: "user-1",
      resoluLe: null,
    });
  });

  it("dernierActorId: null et dernierContexte: INDETERMINE si options absent (call site non migré)", async () => {
    const tx = buildTxWithEcartModel();
    await persisterEcartConstate(tx, SITE_ID, VAGUE_ID, BAC_A, 2);

    const call = mockEcartUpsert.mock.calls[0][0];
    expect(call.create.dernierActorId).toBeNull();
    expect(call.create.dernierContexte).toBe(ContexteDetectionEcart.INDETERMINE);
  });

  it("marque résolu (ecart:0, resoluLe: now) si une ligne active existe et ecart === 0", async () => {
    mockEcartFindUnique.mockResolvedValueOnce({ id: "e-1", resoluLe: null });
    const tx = buildTxWithEcartModel();

    await persisterEcartConstate(tx, SITE_ID, VAGUE_ID, BAC_A, 0);

    expect(mockEcartUpdate).toHaveBeenCalledTimes(1);
    const call = mockEcartUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ bacId: BAC_A });
    expect(call.data.ecart).toBe(0);
    expect(call.data.resoluLe).toBeInstanceOf(Date);
    expect(mockEcartUpsert).not.toHaveBeenCalled();
  });

  it("ne fait rien si ecart === 0 et aucune ligne n'existe (pas de bruit)", async () => {
    mockEcartFindUnique.mockResolvedValueOnce(null);
    const tx = buildTxWithEcartModel();

    await persisterEcartConstate(tx, SITE_ID, VAGUE_ID, BAC_A, 0);

    expect(mockEcartUpdate).not.toHaveBeenCalled();
    expect(mockEcartUpsert).not.toHaveBeenCalled();
  });

  it("ne touche pas resoluLe (déjà résolu, ecart 0->0) : ne réécrit pas si resoluLe déjà non-null", async () => {
    mockEcartFindUnique.mockResolvedValueOnce({ id: "e-1", resoluLe: new Date("2026-01-01") });
    const tx = buildTxWithEcartModel();

    await persisterEcartConstate(tx, SITE_ID, VAGUE_ID, BAC_A, 0);

    expect(mockEcartUpdate).not.toHaveBeenCalled();
  });

  it("n'échoue JAMAIS et n'est jamais propagé — échec d'écriture avalé et loggé (ADR-048 section 6)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const tx = buildTxWithoutEcartModel(); // pas de modèle ecartAssignationConstate → accès undefined

    await expect(
      persisterEcartConstate(tx, SITE_ID, VAGUE_ID, BAC_A, 3)
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("SU.2 — verifyAssignationInvariant : non-régression + branchement persistance", () => {
  it("continue de tolérer un écart préexistant identique avant/après (ne bloque pas)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1002, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const tx = buildTxWithEcartModel();
    const ecartsRef = new Map([[BAC_A, 2]]);

    await expect(
      verifyAssignationInvariant(tx, SITE_ID, VAGUE_ID, [BAC_A], ecartsRef, {
        userId: "user-1",
        contexte: ContexteDetectionEcart.ARRIVAGE,
      })
    ).resolves.toBeUndefined();

    // Toujours journalisé (console.warn conservé, ADR-048 section 6)
    expect(warnSpy).toHaveBeenCalled();
    // ET persisté
    expect(mockEcartUpsert).toHaveBeenCalledTimes(1);
    const call = mockEcartUpsert.mock.calls[0][0];
    expect(call.create.dernierContexte).toBe(ContexteDetectionEcart.ARRIVAGE);
    expect(call.create.dernierActorId).toBe("user-1");

    warnSpy.mockRestore();
  });

  it("options absent → guard reste rétro-compatible (non-breaking) et persiste en dégradé", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1002, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const tx = buildTxWithEcartModel();
    const ecartsRef = new Map([[BAC_A, 2]]);

    // Appel à 5 arguments (signature historique, sans options) — doit compiler et fonctionner
    await expect(
      verifyAssignationInvariant(tx, SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).resolves.toBeUndefined();

    const call = mockEcartUpsert.mock.calls[0][0];
    expect(call.create.dernierActorId).toBeNull();
    expect(call.create.dernierContexte).toBe(ContexteDetectionEcart.INDETERMINE);
  });

  it("un échec de persistance ne bloque JAMAIS le guard (résolution normale malgré l'échec d'écriture)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1002, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const tx = buildTxWithoutEcartModel(); // simule échec d'écriture
    const ecartsRef = new Map([[BAC_A, 2]]);

    await expect(
      verifyAssignationInvariant(tx, SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("écart aggravé continue de rejeter (ConservationError) — persistance non déclenchée avant le throw", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1005, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const tx = buildTxWithEcartModel();
    const ecartsRef = new Map([[BAC_A, 2]]);

    await expect(
      verifyAssignationInvariant(tx, SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).rejects.toThrow();

    expect(mockEcartUpsert).not.toHaveBeenCalled();
  });
});

describe("SU.2 — getBacsEnDerive (query layer)", () => {
  it("filtre par siteId + ecart != 0, retourne le type BacEnDerive attendu, sans N+1 (un seul findMany avec include)", async () => {
    vi.resetModules();
    const mockFindMany = vi.fn().mockResolvedValueOnce([
      {
        bacId: "bac-1",
        vagueId: "vague-1",
        ecart: 4,
        premiereDetectionLe: new Date("2026-07-01"),
        derniereDetectionLe: new Date("2026-07-26"),
        dernierContexte: ContexteDetectionEcart.CALIBRAGE,
        bac: { nom: "Bac 11" },
        vague: { code: "Vague-26-03-Prep" },
      },
    ]);

    vi.doMock("@/lib/db", () => ({
      prisma: {
        ecartAssignationConstate: {
          findMany: mockFindMany,
        },
      },
    }));

    const { getBacsEnDerive } = await import("@/lib/queries/ecarts-assignation");
    const result = await getBacsEnDerive("site-1");

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ siteId: "site-1", ecart: { not: 0 } });
    expect(args.orderBy).toEqual({ derniereDetectionLe: "desc" });

    expect(result).toEqual([
      {
        bacId: "bac-1",
        bacNom: "Bac 11",
        vagueId: "vague-1",
        vagueCode: "Vague-26-03-Prep",
        ecart: 4,
        premiereDetectionLe: new Date("2026-07-01"),
        derniereDetectionLe: new Date("2026-07-26"),
        dernierContexte: ContexteDetectionEcart.CALIBRAGE,
      },
    ]);

    vi.doUnmock("@/lib/db");
  });
});
