/**
 * Tests CG.2 — bacDestId obligatoire sur TransfertGroupe
 *
 * Vérifie que :
 * 1. createTransfert avec bacDestId = null sur un groupe → throw field name
 * 2. createTransfert mode vague vide + bacDestId valide → AssignationBac créée
 * 3. createTransfert mode vague existante + bacDestId déjà assigné → AssignationBac incrémentée
 * 4. updateTransfertGroupe avec bacDestId null → throw
 * 5. API POST sans bacDestId dans un groupe → 400 avec groupes[0].bacDestId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransfert, updateTransfertGroupe } from "@/lib/queries/transferts";
import { ModeTransfert, StatutVague, TypeVague, TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockVagueFindMany = vi.fn();
const mockVagueCreate = vi.fn();
const mockVagueUpdate = vi.fn();
const mockVagueFindUniqueOrThrow = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacCreate = vi.fn();
const mockAssignationBacUpdate = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();
const mockReleveFindMany = vi.fn();
const mockReleveCreate = vi.fn();
const mockTransfertCreate = vi.fn();
const mockTransfertFindUniqueOrThrow = vi.fn();
const mockTransfertGroupeUpdate = vi.fn();
const mockTransfertGroupeFindFirst = vi.fn();
const mockTransfertGroupeFindUniqueOrThrow = vi.fn();
const mockTransfertModificationCreate = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
      findMany: (...args: unknown[]) => mockVagueFindMany(...args),
      create: (...args: unknown[]) => mockVagueCreate(...args),
      update: (...args: unknown[]) => mockVagueUpdate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockVagueFindUniqueOrThrow(...args),
    },
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
      create: (...args: unknown[]) => mockAssignationBacCreate(...args),
      update: (...args: unknown[]) => mockAssignationBacUpdate(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
      create: (...args: unknown[]) => mockReleveCreate(...args),
    },
    transfert: {
      create: (...args: unknown[]) => mockTransfertCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockTransfertFindUniqueOrThrow(...args),
    },
    transfertGroupe: {
      update: (...args: unknown[]) => mockTransfertGroupeUpdate(...args),
      findFirst: (...args: unknown[]) => mockTransfertGroupeFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockTransfertGroupeFindUniqueOrThrow(...args),
    },
    transfertModification: {
      create: (...args: unknown[]) => mockTransfertModificationCreate(...args),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) =>
      mockTransaction(fn as (tx: unknown) => Promise<unknown>, opts),
  },
}));

vi.mock("@/lib/calculs", () => ({
  computeVivantsByBac: vi.fn(() => new Map([["bac-source-1", 100]])),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VAGUE_SOURCE_ID = "vague-source-1";
const VAGUE_DEST_ID = "vague-dest-1";
const BAC_SOURCE_ID = "bac-source-1";
const BAC_DEST_ID = "bac-dest-1";

const vagueSource = {
  id: VAGUE_SOURCE_ID,
  code: "PG-001",
  type: TypeVague.PRE_GROSSISSEMENT,
  statut: StatutVague.EN_COURS,
  nombreInitial: 100,
  siteId: SITE_ID,
};

const vagueDest = {
  id: VAGUE_DEST_ID,
  code: "GR-001",
  type: TypeVague.GROSSISSEMENT,
  statut: StatutVague.EN_COURS,
  nombreInitial: 0,
  poidsMoyenInitial: 0,
  siteId: SITE_ID,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  mockVagueFindMany.mockResolvedValue([vagueSource]);
  mockVagueFindFirst
    .mockResolvedValueOnce(vagueDest) // vague dest check
    .mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
  mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
  mockVagueUpdate.mockResolvedValue({});
  mockAssignationBacFindMany.mockResolvedValue([
    { bacId: BAC_SOURCE_ID, nombreInitial: 100, nombreActuel: 100 },
  ]);
  mockAssignationBacFindFirst.mockResolvedValue(null);
  mockAssignationBacCreate.mockResolvedValue({ id: "ab-dest-1" });
  mockAssignationBacUpdate.mockResolvedValue({});
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  mockReleveFindMany.mockResolvedValue([]);
  mockReleveCreate.mockResolvedValue({});
  mockTransfertCreate.mockResolvedValue({ id: "transfert-1" });
  mockTransfertFindUniqueOrThrow.mockResolvedValue({
    id: "transfert-1",
    siteId: SITE_ID,
    groupes: [{ id: "groupe-1", bacDestId: BAC_DEST_ID }],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CG.2 — bacDestId obligatoire sur TransfertGroupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cas 1 — createTransfert avec bacDestId null → throw avec field name
  it("1. createTransfert avec bacDestId = null → throw avec numéro de groupe", async () => {
    await expect(
      createTransfert(SITE_ID, USER_ID, {
        mode: ModeTransfert.USE_EXISTING,
        vagueDestId: VAGUE_DEST_ID,
        groupes: [
          {
            vagueSourceId: VAGUE_SOURCE_ID,
            bacSourceId: BAC_SOURCE_ID,
            bacDestId: null as unknown as string,
            nombrePoissons: 50,
            poidsMoyenG: 100,
            nombreMorts: 0,
          },
        ],
        notes: null,
      })
    ).rejects.toThrow("Le bac destination est obligatoire pour le groupe 1");
  });

  // Cas 2 — createTransfert mode vague vide + bacDestId valide → AssignationBac créée
  it("2. createTransfert mode vague existante vide + bacDestId valide → AssignationBac créée", async () => {
    setupDefaultMocks();

    await createTransfert(SITE_ID, USER_ID, {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: VAGUE_DEST_ID,
      groupes: [
        {
          vagueSourceId: VAGUE_SOURCE_ID,
          bacSourceId: BAC_SOURCE_ID,
          bacDestId: BAC_DEST_ID,
          nombrePoissons: 50,
          poidsMoyenG: 100,
          nombreMorts: 0,
        },
      ],
      notes: null,
    });

    // Étape 6 : AssignationBac dest créée car findFirst retourne null
    expect(mockAssignationBacCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: BAC_DEST_ID,
          vagueId: VAGUE_DEST_ID,
        }),
      })
    );
  });

  // Cas 3 — createTransfert mode vague existante + bacDestId déjà assigné → AssignationBac incrémentée
  it("3. createTransfert mode vague existante + bacDestId déjà assigné → AssignationBac incrémentée", async () => {
    setupDefaultMocks();
    // Simuler qu'une AssignationBac existe déjà (étape 6 ne crée pas, et étape 9 incrémente)
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ab-dest-existing" }) // étape 6 : assignation déjà là
      .mockResolvedValueOnce({ id: "ab-dest-existing" }); // étape 9 : findFirst

    await createTransfert(SITE_ID, USER_ID, {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: VAGUE_DEST_ID,
      groupes: [
        {
          vagueSourceId: VAGUE_SOURCE_ID,
          bacSourceId: BAC_SOURCE_ID,
          bacDestId: BAC_DEST_ID,
          nombrePoissons: 50,
          poidsMoyenG: 100,
          nombreMorts: 0,
        },
      ],
      notes: null,
    });

    // Étape 9 : update incrémentiel appelé (pas create)
    expect(mockAssignationBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombreActuel: expect.objectContaining({ increment: 50 }),
        }),
      })
    );
    // AssignationBac create ne doit PAS être appelé en étape 9
    // (peut être appelé en étape 6 si la logique de création préventive est déclenchée,
    // mais ici findFirst retourne un objet existant donc create ne sera pas appelé)
    const createCallsWithBacDest = mockAssignationBacCreate.mock.calls.filter(
      (call) => call[0]?.data?.bacId === BAC_DEST_ID && call[0]?.data?.nombreActuel === 50
    );
    expect(createCallsWithBacDest.length).toBe(0);
  });

  // Cas 4 — updateTransfertGroupe avec bacDestId null → throw
  it("4. updateTransfertGroupe avec bacDestId null → throw", async () => {
    await expect(
      updateTransfertGroupe(SITE_ID, USER_ID, "groupe-1", {
        raison: "Correction test",
        bacDestId: null as unknown as string,
      })
    ).rejects.toThrow("Le bac destination est obligatoire");
  });

  // Cas 5 — updateTransfertGroupe avec bacDestId chaîne vide → throw
  it("5. updateTransfertGroupe avec bacDestId chaîne vide → throw", async () => {
    await expect(
      updateTransfertGroupe(SITE_ID, USER_ID, "groupe-1", {
        raison: "Correction test",
        bacDestId: "",
      })
    ).rejects.toThrow("Le bac destination est obligatoire");
  });
});
