/**
 * Tests CG.4 — Alignement dateAssignation sur la date de l'opération métier
 *
 * Vérifie que AssignationBac.dateAssignation utilise la date métier (antidatée
 * ou du jour) et non new Date() (la date de création de l'enregistrement).
 *
 * Cas couverts :
 * 1. createCalibrage antidaté de 5 j → dateAssignation === calibrageDate (create défensif)
 * 2. createTransfert antidaté → dateAssignation === transfertDate (étape 6 + étape 9)
 * 3. createArrivage antidaté → dateAssignation === arrivageDate (bac libre)
 * 4. Opération à la date du jour → dateAssignation === aujourd'hui
 * 5. updateArrivageGroupe (bac différent) → dateAssignation === arrivage.date parent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalibrage } from "@/lib/queries/calibrages";
import { createTransfert } from "@/lib/queries/transferts";
import { createArrivage, updateArrivageGroupe } from "@/lib/queries/arrivages";
import { StatutVague, CategorieCalibrage, ModeTransfert, TypeVague } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma — calibrages
// ---------------------------------------------------------------------------

const mockCalibrageTx = {
  vague: { findFirst: vi.fn() },
  assignationBac: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  releve: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  calibrage: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  calibrageGroupe: { deleteMany: vi.fn() },
  calibrageModification: { createMany: vi.fn() },
};

// ---------------------------------------------------------------------------
// Mocks Prisma — transferts
// ---------------------------------------------------------------------------

const mockTransfertTx = {
  vague: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  assignationBac: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  releve: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  transfert: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  transfertGroupe: {
    update: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  transfertModification: { create: vi.fn() },
};

// ---------------------------------------------------------------------------
// Mocks Prisma — arrivages
// ---------------------------------------------------------------------------

const mockArrivageTx = {
  vague: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  bac: { findMany: vi.fn() },
  assignationBac: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  releve: { create: vi.fn() },
  arrivage: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  arrivageGroupe: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  arrivageModification: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
      // The mock transaction picks the right tx based on the function being called.
      // We use a single dispatch — each test sets up its own mock via the shared context.
      return fn(_mockActiveTx);
    }),
  },
}));

const mockComputeVivantsByBac = vi.fn(() => new Map<string, number>());
const mockComputeWeightedAverage = vi.fn((t1: number, a1: number, t2: number, a2: number) => ({
  newTotal: t1 + t2,
  newAvg: t1 + t2 === 0 ? 0 : (t1 * a1 + t2 * a2) / (t1 + t2),
}));

vi.mock("@/lib/calculs", () => ({
  computeVivantsByBac: (...args: unknown[]) => mockComputeVivantsByBac(...args),
  computeWeightedAverage: (...args: unknown[]) => mockComputeWeightedAverage(...args),
}));

// Active transaction context — set in each test suite
let _mockActiveTx: unknown = mockCalibrageTx;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_ID = "site-cg4";
const USER_ID = "user-cg4";
const VAGUE_ID = "vague-cg4";
const VAGUE_SOURCE_ID = "vague-source-cg4";
const VAGUE_DEST_ID = "vague-dest-cg4";
const BAC_SOURCE_ID = "bac-source-cg4";
const BAC_DEST_ID = "bac-dest-cg4";
const BAC_DEST_2_ID = "bac-dest-2-cg4";

// 5 days ago (antidated)
const ANTIDATED = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
const ANTIDATED_ISO = ANTIDATED.toISOString();

// ---------------------------------------------------------------------------
// Test 1 — createCalibrage antidaté → dateAssignation === calibrageDate
// ---------------------------------------------------------------------------

describe("CG.4 — Cas 1 : createCalibrage antidaté → dateAssignation === calibrageDate", () => {
  beforeEach(() => {
    _mockActiveTx = mockCalibrageTx;
    vi.clearAllMocks();

    mockComputeVivantsByBac.mockReturnValue(new Map([[BAC_SOURCE_ID, 100]]));

    // vague
    mockCalibrageTx.vague.findFirst.mockResolvedValue({
      id: VAGUE_ID, code: "V-CG4", statut: StatutVague.EN_COURS, nombreInitial: 100, poidsMoyenInitial: 50,
    });

    // 1. sourceAssignations
    // 2. destAssignations (must contain BAC_DEST_ID to pass the vague-membership check)
    // 3. allAssignationsVague (computeVivantsByBac)
    // 4. snapshotAvant
    mockCalibrageTx.assignationBac.findMany
      .mockResolvedValueOnce([
        { id: "a-src", bacId: BAC_SOURCE_ID, vagueId: VAGUE_ID, siteId: SITE_ID, dateFin: null, nombreActuel: 100, nombreInitial: 100, poidsMoyenInitial: 50, bac: { id: BAC_SOURCE_ID, nom: "Bac Src" } },
      ])
      // destAssignations — BAC_DEST_ID already belongs to this vague
      .mockResolvedValueOnce([{ bacId: BAC_DEST_ID }])
      // allAssignationsVague (computeVivantsByBac)
      .mockResolvedValueOnce([{ bacId: BAC_SOURCE_ID, nombreInitial: 100 }])
      // snapshotAvant
      .mockResolvedValueOnce([
        { bacId: BAC_SOURCE_ID, nombreActuel: 100, nombreInitial: 100, poidsMoyenInitial: 50, bac: { id: BAC_SOURCE_ID, nom: "Bac Src" } },
      ]);

    mockCalibrageTx.releve.findMany.mockResolvedValue([]);
    mockCalibrageTx.assignationBac.updateMany.mockResolvedValue({ count: 1 });
    mockCalibrageTx.assignationBac.update.mockResolvedValue({});
    // dest bac has NO active assignation → triggers create défensif
    mockCalibrageTx.assignationBac.findFirst
      .mockResolvedValueOnce(null)   // findFirst for dest (no existing)
      .mockResolvedValueOnce(null);  // historicAssignation
    mockCalibrageTx.assignationBac.create.mockResolvedValue({ id: "a-dest-new" });
    mockCalibrageTx.calibrage.create.mockResolvedValue({ id: "calib-1" });
    mockCalibrageTx.calibrage.findUniqueOrThrow.mockResolvedValue({
      id: "calib-1", vague: { id: VAGUE_ID, code: "V-CG4" }, user: { id: USER_ID, name: "Admin" }, groupes: [],
    });
    mockCalibrageTx.releve.create.mockResolvedValue({});
  });

  it("dateAssignation du create défensif === calibrageDate (antidaté)", async () => {
    await createCalibrage(SITE_ID, USER_ID, {
      vagueId: VAGUE_ID,
      sourceBacIds: [BAC_SOURCE_ID],
      nombreMorts: 0,
      date: ANTIDATED_ISO,
      groupes: [
        {
          categorie: CategorieCalibrage.MOYEN,
          destinationBacId: BAC_DEST_ID,
          nombrePoissons: 100,
          poidsMoyen: 50,
        },
      ],
    });

    expect(mockCalibrageTx.assignationBac.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: BAC_DEST_ID,
          dateAssignation: expect.any(Date),
        }),
      })
    );

    const callArg = mockCalibrageTx.assignationBac.create.mock.calls[0][0];
    const dateUsed: Date = callArg.data.dateAssignation;
    // Should be close to the antidated date (not now)
    expect(Math.abs(dateUsed.getTime() - ANTIDATED.getTime())).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — createTransfert antidaté → dateAssignation === transfertDate
// ---------------------------------------------------------------------------

describe("CG.4 — Cas 2 : createTransfert antidaté → dateAssignation === transfertDate (étapes 6 + 9)", () => {
  beforeEach(() => {
    _mockActiveTx = mockTransfertTx;
    vi.clearAllMocks();

    mockComputeWeightedAverage.mockReturnValue({ newTotal: 50, newAvg: 100 });

    mockTransfertTx.vague.findMany.mockResolvedValue([{
      id: VAGUE_SOURCE_ID, code: "PG-001", type: TypeVague.PRE_GROSSISSEMENT,
      statut: StatutVague.EN_COURS, nombreInitial: 100, siteId: SITE_ID,
    }]);
    mockTransfertTx.vague.findFirst
      .mockResolvedValueOnce({
        id: VAGUE_DEST_ID, code: "GR-001", type: TypeVague.GROSSISSEMENT,
        statut: StatutVague.EN_COURS, nombreInitial: 0, poidsMoyenInitial: 0, siteId: SITE_ID,
      })
      .mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockTransfertTx.vague.findUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockTransfertTx.vague.update.mockResolvedValue({});

    // AssignationBac étape 6 (préventif pour bac dest) : findFirst→null + historicFindFirst→null
    // AssignationBac étape 8 source : findMany
    // AssignationBac étape 9 dest : findFirst
    mockTransfertTx.assignationBac.findMany.mockResolvedValue([
      { id: "a-src", bacId: BAC_SOURCE_ID, nombreActuel: 100 },
    ]);
    mockTransfertTx.assignationBac.findFirst
      .mockResolvedValueOnce(null)    // étape 6 : pas d'assignation existante pour bac dest
      .mockResolvedValueOnce(null)    // étape 6 : historicAssignation
      .mockResolvedValueOnce(null);   // étape 9 : après transfert, findFirst (create path)

    mockTransfertTx.assignationBac.create.mockResolvedValue({ id: "a-dest-new" });
    mockTransfertTx.assignationBac.update.mockResolvedValue({});
    mockTransfertTx.assignationBac.updateMany.mockResolvedValue({ count: 1 });
    mockTransfertTx.releve.findMany.mockResolvedValue([]);
    mockTransfertTx.releve.create.mockResolvedValue({});
    mockTransfertTx.transfert.create.mockResolvedValue({ id: "transf-1" });
    mockTransfertTx.transfert.findUniqueOrThrow.mockResolvedValue({
      id: "transf-1", siteId: SITE_ID,
      groupes: [{ id: "tg-1", bacDestId: BAC_DEST_ID }],
    });
  });

  it("étape 6 — dateAssignation préventive === transfertDate (antidaté)", async () => {
    await createTransfert(SITE_ID, USER_ID, {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: VAGUE_DEST_ID,
      date: ANTIDATED_ISO,
      groupes: [{
        vagueSourceId: VAGUE_SOURCE_ID,
        bacSourceId: BAC_SOURCE_ID,
        bacDestId: BAC_DEST_ID,
        nombrePoissons: 50,
        poidsMoyenG: 100,
        nombreMorts: 0,
      }],
      notes: null,
    });

    // At least one create call with the antidated date
    const createCalls = mockTransfertTx.assignationBac.create.mock.calls;
    expect(createCalls.length).toBeGreaterThan(0);

    // All create calls must use the antidated date (not new Date())
    for (const call of createCalls) {
      const dateUsed: Date = call[0].data.dateAssignation;
      expect(dateUsed).toBeInstanceOf(Date);
      expect(Math.abs(dateUsed.getTime() - ANTIDATED.getTime())).toBeLessThan(1000);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3 — createArrivage antidaté → dateAssignation === arrivageDate
// ---------------------------------------------------------------------------

describe("CG.4 — Cas 3 : createArrivage antidaté → dateAssignation === arrivageDate (bac libre)", () => {
  beforeEach(() => {
    _mockActiveTx = mockArrivageTx;
    vi.clearAllMocks();

    mockArrivageTx.vague.findFirst.mockResolvedValue({
      id: VAGUE_ID, code: "PRE-001", type: TypeVague.PRE_GROSSISSEMENT,
      statut: StatutVague.EN_COURS, nombreInitial: 0, poidsMoyenInitial: 0, siteId: SITE_ID,
    });
    mockArrivageTx.bac.findMany.mockResolvedValue([
      { id: BAC_DEST_ID, nom: "Bac Dest" },
    ]);
    // No conflict for bac dest
    mockArrivageTx.assignationBac.findFirst
      .mockResolvedValueOnce(null)   // conflict check (autre vague)
      .mockResolvedValueOnce(null);  // étape 7 : pas d'assignation active → create
    mockArrivageTx.assignationBac.findMany.mockResolvedValue([]);
    mockArrivageTx.assignationBac.create.mockResolvedValue({ id: "a-new" });
    mockArrivageTx.vague.findUniqueOrThrow.mockResolvedValue({ id: VAGUE_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockArrivageTx.vague.update.mockResolvedValue({});
    mockArrivageTx.arrivage.create.mockResolvedValue({ id: "arr-1" });
    mockArrivageTx.arrivage.findUniqueOrThrow.mockResolvedValue({
      id: "arr-1", vagueId: VAGUE_ID, siteId: SITE_ID, date: ANTIDATED,
      groupes: [{ id: "ag-1", destinationBacId: BAC_DEST_ID, nombrePoissons: 200, poidsMoyen: 5 }],
      vague: { id: VAGUE_ID, code: "PRE-001" }, user: { id: USER_ID, name: "Admin" },
    });
    mockArrivageTx.releve.create.mockResolvedValue({});
  });

  it("dateAssignation === arrivageDate pour un bac libre (nouveau)", async () => {
    await createArrivage(SITE_ID, USER_ID, {
      vagueId: VAGUE_ID,
      date: ANTIDATED_ISO,
      groupes: [{
        destinationBacId: BAC_DEST_ID,
        nombrePoissons: 200,
        poidsMoyen: 5,
      }],
    });

    expect(mockArrivageTx.assignationBac.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: BAC_DEST_ID,
          dateAssignation: expect.any(Date),
        }),
      })
    );

    const callArg = mockArrivageTx.assignationBac.create.mock.calls[0][0];
    const dateUsed: Date = callArg.data.dateAssignation;
    expect(Math.abs(dateUsed.getTime() - ANTIDATED.getTime())).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Opération à la date du jour → dateAssignation ≈ maintenant
// ---------------------------------------------------------------------------

describe("CG.4 — Cas 4 : opération à la date du jour → dateAssignation ≈ aujourd'hui", () => {
  beforeEach(() => {
    _mockActiveTx = mockArrivageTx;
    vi.clearAllMocks();

    mockArrivageTx.vague.findFirst.mockResolvedValue({
      id: VAGUE_ID, code: "PRE-TODAY", type: TypeVague.PRE_GROSSISSEMENT,
      statut: StatutVague.EN_COURS, nombreInitial: 0, poidsMoyenInitial: 0, siteId: SITE_ID,
    });
    mockArrivageTx.bac.findMany.mockResolvedValue([{ id: BAC_DEST_ID, nom: "Bac Today" }]);
    mockArrivageTx.assignationBac.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockArrivageTx.assignationBac.findMany.mockResolvedValue([]);
    mockArrivageTx.assignationBac.create.mockResolvedValue({ id: "a-today" });
    mockArrivageTx.vague.findUniqueOrThrow.mockResolvedValue({ id: VAGUE_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockArrivageTx.vague.update.mockResolvedValue({});
    mockArrivageTx.arrivage.create.mockResolvedValue({ id: "arr-today" });
    mockArrivageTx.arrivage.findUniqueOrThrow.mockResolvedValue({
      id: "arr-today", vagueId: VAGUE_ID, siteId: SITE_ID, date: new Date(),
      groupes: [{ id: "ag-today", destinationBacId: BAC_DEST_ID, nombrePoissons: 100, poidsMoyen: 3 }],
      vague: { id: VAGUE_ID, code: "PRE-TODAY" }, user: { id: USER_ID, name: "Admin" },
    });
    mockArrivageTx.releve.create.mockResolvedValue({});
  });

  it("dateAssignation === aujourd'hui quand aucune date fournie", async () => {
    const before = Date.now();

    await createArrivage(SITE_ID, USER_ID, {
      vagueId: VAGUE_ID,
      // no date => defaults to new Date()
      groupes: [{
        destinationBacId: BAC_DEST_ID,
        nombrePoissons: 100,
        poidsMoyen: 3,
      }],
    });

    const after = Date.now();

    expect(mockArrivageTx.assignationBac.create).toHaveBeenCalled();
    const callArg = mockArrivageTx.assignationBac.create.mock.calls[0][0];
    const dateUsed: Date = callArg.data.dateAssignation;
    expect(dateUsed.getTime()).toBeGreaterThanOrEqual(before - 100);
    expect(dateUsed.getTime()).toBeLessThanOrEqual(after + 100);
  });
});

// ---------------------------------------------------------------------------
// Test 5 — updateArrivageGroupe (bac différent) → dateAssignation === arrivage.date parent
// ---------------------------------------------------------------------------

describe("CG.4 — Cas 5 : updateArrivageGroupe (nouveau bac) → dateAssignation === arrivage.date parent", () => {
  beforeEach(() => {
    _mockActiveTx = mockArrivageTx;
    vi.clearAllMocks();

    // Étape 2 — fetch arrivageGroupe (once)
    mockArrivageTx.arrivageGroupe.findFirst.mockResolvedValue({
      id: "ag-upd",
      destinationBacId: BAC_DEST_ID,
      nombrePoissons: 200,
      poidsMoyen: 5,
      arrivage: {
        id: "arr-parent",
        siteId: SITE_ID,
        vagueId: VAGUE_ID,
        date: ANTIDATED,
        vague: {
          id: VAGUE_ID, code: "PRE-001", type: TypeVague.PRE_GROSSISSEMENT,
          statut: StatutVague.EN_COURS, nombreInitial: 200, poidsMoyenInitial: 5,
        },
      },
    });

    // Bac différent (BAC_DEST_ID → BAC_DEST_2_ID)
    mockArrivageTx.assignationBac.findFirst
      // étape 5a : ancienne assignation (BAC_DEST_ID) existe
      .mockResolvedValueOnce({ id: "a-old", nombreActuel: 200, nombreInitial: 200, poidsMoyenInitial: 5 })
      // étape 6 (bac différent) : nouvelle assignation (BAC_DEST_2_ID) inexistante → create
      .mockResolvedValueOnce(null);
    mockArrivageTx.assignationBac.update.mockResolvedValue({});
    mockArrivageTx.assignationBac.create.mockResolvedValue({ id: "a-new-dest2" });

    // 6b vague après annulation
    mockArrivageTx.vague.findUniqueOrThrow.mockResolvedValue({
      id: VAGUE_ID, nombreInitial: 0, poidsMoyenInitial: 0,
    });
    mockArrivageTx.vague.update.mockResolvedValue({});

    // étape 7 audit
    mockArrivageTx.arrivageModification.create.mockResolvedValue({});

    // étape 8 update arrivage + groupe
    mockArrivageTx.arrivage.update.mockResolvedValue({});
    mockArrivageTx.arrivageGroupe.update.mockResolvedValue({});

    // final findUniqueOrThrow
    mockArrivageTx.arrivageGroupe.findUniqueOrThrow.mockResolvedValue({
      id: "ag-upd", destinationBacId: BAC_DEST_2_ID,
      nombrePoissons: 200, poidsMoyen: 5,
      destinationBac: { id: BAC_DEST_2_ID, nom: "Bac Dest 2" },
    });
  });

  it("dateAssignation du nouveau bac === arrivage.date parent (antidaté)", async () => {
    await updateArrivageGroupe(SITE_ID, USER_ID, "ag-upd", {
      raison: "Test CG4 bac différent",
      destinationBacId: BAC_DEST_2_ID,
      nombrePoissons: 200,
      poidsMoyen: 5,
    });

    // Create should have been called for the new bac
    expect(mockArrivageTx.assignationBac.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: BAC_DEST_2_ID,
          dateAssignation: expect.any(Date),
        }),
      })
    );

    const callArg = mockArrivageTx.assignationBac.create.mock.calls[0][0];
    const dateUsed: Date = callArg.data.dateAssignation;
    expect(Math.abs(dateUsed.getTime() - ANTIDATED.getTime())).toBeLessThan(1000);
  });
});
