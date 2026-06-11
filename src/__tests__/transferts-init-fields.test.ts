/**
 * Tests CS.1 — nombreInitial + poidsMoyenInitial sur AssignationBac destination
 *
 * Vérifie que :
 * 1. createTransfert vers bac vierge → nombreInitial = nombrePoissons, poidsMoyenInitial = poidsMoyenG
 * 2. createTransfert 2e fois vers même bac (déjà assigné) → init inchangé, nombreActuel incrémenté
 * 3. updateTransfertGroupe change bacDest vers bac vierge → nouvelle AssignationBac avec init correct
 * 4. updateTransfertGroupe vers bac existant → init inchangé (update seul)
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
const BAC_DEST_ID_2 = "bac-dest-2";

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
// Helper — setup mocks pour un createTransfert standard vers bac vierge
// ---------------------------------------------------------------------------

function setupCreateTransfertVirginDest() {
  mockVagueFindMany.mockResolvedValue([vagueSource]);
  mockVagueFindFirst
    .mockResolvedValueOnce(vagueDest) // vague dest check (étape 2)
    .mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
  mockVagueFindUniqueOrThrow.mockResolvedValue({
    id: VAGUE_DEST_ID,
    nombreInitial: 0,
    poidsMoyenInitial: 0,
  });
  mockVagueUpdate.mockResolvedValue({});
  mockAssignationBacFindMany.mockResolvedValue([
    { bacId: BAC_SOURCE_ID, nombreInitial: 100, nombreActuel: 100 },
  ]);
  // Étape 6 : pas d'assignation dest existante + pas d'historique
  mockAssignationBacFindFirst
    .mockResolvedValueOnce(null) // étape 6 : findFirst pour vérifier existance
    .mockResolvedValueOnce(null) // étape 6 : historicAssignation
    .mockResolvedValueOnce(null); // étape 9 : findFirst pour incrément
  mockAssignationBacCreate.mockResolvedValue({ id: "ab-dest-new" });
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

describe("CS.1 — nombreInitial + poidsMoyenInitial sur AssignationBac destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cas 1 — createTransfert vers bac vierge → init = qty / avg du groupe
  it("1. createTransfert vers bac vierge → nombreInitial et poidsMoyenInitial = valeurs du groupe", async () => {
    setupCreateTransfertVirginDest();

    await createTransfert(SITE_ID, USER_ID, {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: VAGUE_DEST_ID,
      groupes: [
        {
          vagueSourceId: VAGUE_SOURCE_ID,
          bacSourceId: BAC_SOURCE_ID,
          bacDestId: BAC_DEST_ID,
          nombrePoissons: 60,
          poidsMoyenG: 150,
          nombreMorts: 0,
        },
      ],
      notes: null,
    });

    // Étape 6 : AssignationBac créée avec init = valeurs du groupe (pas de fallback 0)
    const createCallsStep6 = mockAssignationBacCreate.mock.calls.filter(
      (call) =>
        call[0]?.data?.bacId === BAC_DEST_ID &&
        call[0]?.data?.vagueId === VAGUE_DEST_ID
    );
    expect(createCallsStep6.length).toBeGreaterThan(0);
    const createDataStep6 = createCallsStep6[0][0].data;
    expect(createDataStep6.nombreInitial).toBe(60);
    expect(createDataStep6.poidsMoyenInitial).toBe(150);
  });

  // Cas 2 — createTransfert 2e fois vers même bac → init inchangé, nombreActuel incrémenté
  it("2. createTransfert vers bac déjà assigné → init inchangé, nombreActuel incrémenté", async () => {
    mockVagueFindMany.mockResolvedValue([vagueSource]);
    mockVagueFindFirst
      .mockResolvedValueOnce(vagueDest) // vague dest check
      .mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 60, poidsMoyenInitial: 150 });
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      id: VAGUE_DEST_ID,
      nombreInitial: 60,
      poidsMoyenInitial: 150,
    });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacFindMany.mockResolvedValue([
      { bacId: BAC_SOURCE_ID, nombreInitial: 100, nombreActuel: 100 },
    ]);
    // Étape 6 : assignation déjà existante → pas de create
    // Étape 9 : assignation existante → update (incrément)
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ab-dest-existing", nombreInitial: 60, poidsMoyenInitial: 150 }) // étape 6
      .mockResolvedValueOnce({ id: "ab-dest-existing", nombreInitial: 60, poidsMoyenInitial: 150 }); // étape 9
    mockAssignationBacCreate.mockResolvedValue({});
    mockAssignationBacUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockReleveFindMany.mockResolvedValue([]);
    mockReleveCreate.mockResolvedValue({});
    mockTransfertCreate.mockResolvedValue({ id: "transfert-2" });
    mockTransfertFindUniqueOrThrow.mockResolvedValue({
      id: "transfert-2",
      siteId: SITE_ID,
      groupes: [{ id: "groupe-2", bacDestId: BAC_DEST_ID }],
    });

    await createTransfert(SITE_ID, USER_ID, {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: VAGUE_DEST_ID,
      groupes: [
        {
          vagueSourceId: VAGUE_SOURCE_ID,
          bacSourceId: BAC_SOURCE_ID,
          bacDestId: BAC_DEST_ID,
          nombrePoissons: 40,
          poidsMoyenG: 160,
          nombreMorts: 0,
        },
      ],
      notes: null,
    });

    // Aucun create ne doit être déclenché pour le bac dest (assignation existante)
    const createCallsForDest = mockAssignationBacCreate.mock.calls.filter(
      (call) =>
        call[0]?.data?.bacId === BAC_DEST_ID &&
        call[0]?.data?.vagueId === VAGUE_DEST_ID
    );
    expect(createCallsForDest.length).toBe(0);

    // L'update incrémentiel doit être appelé
    expect(mockAssignationBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombreActuel: expect.objectContaining({ increment: 40 }),
        }),
      })
    );
  });

  // Cas 3 — updateTransfertGroupe change bacDest vers bac vierge → init correct
  it("3. updateTransfertGroupe vers bac vierge → nouvelle AssignationBac avec init = nouvelles valeurs", async () => {
    // Setup groupe existant
    mockTransfertGroupeFindFirst.mockResolvedValue({
      id: "groupe-1",
      nombrePoissons: 60,
      poidsMoyenG: 150,
      nombreMorts: 0,
      bacSourceId: BAC_SOURCE_ID,
      bacDestId: BAC_DEST_ID,
      transfert: { id: "transfert-1", siteId: SITE_ID, date: new Date("2026-03-26") },
      vagueSource: { id: VAGUE_SOURCE_ID, code: "PG-001", statut: StatutVague.EN_COURS },
      vagueDest: {
        id: VAGUE_DEST_ID,
        code: "GR-001",
        nombreInitial: 60,
        poidsMoyenInitial: 150,
      },
    });

    // Annulation étape 4 : updateMany source + updateMany dest (retourner count > 0)
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockVagueUpdate.mockResolvedValue({});

    // Étape 5 : validation conservation
    mockAssignationBacFindMany.mockResolvedValue([
      { bacId: BAC_SOURCE_ID, nombreInitial: 100, nombreActuel: 100 },
    ]);
    mockReleveFindMany.mockResolvedValue([]);
    mockVagueFindFirst.mockResolvedValue({ nombreInitial: 100 });

    // Étape 6 — bac dest nouveau (BAC_DEST_ID_2) vierge
    mockAssignationBacFindFirst.mockResolvedValue(null); // pas d'assignation existante

    mockAssignationBacCreate.mockResolvedValue({ id: "ab-dest-new-2" });
    mockTransfertGroupeUpdate.mockResolvedValue({ id: "groupe-1" });
    mockTransfertGroupeFindUniqueOrThrow.mockResolvedValue({
      id: "groupe-1",
      nombrePoissons: 70,
      poidsMoyenG: 180,
      nombreMorts: 0,
      bacSourceId: BAC_SOURCE_ID,
      bacDestId: BAC_DEST_ID_2,
      transfert: { id: "transfert-1", siteId: SITE_ID, date: new Date("2026-03-26") },
      vagueSource: { id: VAGUE_SOURCE_ID, code: "PG-001", statut: StatutVague.EN_COURS },
      vagueDest: { id: VAGUE_DEST_ID, code: "GR-001" },
      modifications: [],
    });

    await updateTransfertGroupe(SITE_ID, USER_ID, "groupe-1", {
      raison: "Test init fields",
      bacDestId: BAC_DEST_ID_2,
      nombrePoissons: 70,
      poidsMoyenG: 180,
    });

    // Vérifier que l'AssignationBac créée a les bons champs init
    const createCallsForNewDest = mockAssignationBacCreate.mock.calls.filter(
      (call) =>
        call[0]?.data?.bacId === BAC_DEST_ID_2 &&
        call[0]?.data?.vagueId === VAGUE_DEST_ID
    );
    expect(createCallsForNewDest.length).toBeGreaterThan(0);
    const createData = createCallsForNewDest[0][0].data;
    expect(createData.nombreInitial).toBe(70);
    expect(createData.poidsMoyenInitial).toBe(180);
  });

  // Cas 4 — updateTransfertGroupe vers bac existant → init inchangé (update seul)
  it("4. updateTransfertGroupe vers bac existant → update sans toucher init", async () => {
    mockTransfertGroupeFindFirst.mockResolvedValue({
      id: "groupe-1",
      nombrePoissons: 60,
      poidsMoyenG: 150,
      nombreMorts: 0,
      bacSourceId: BAC_SOURCE_ID,
      bacDestId: BAC_DEST_ID,
      transfert: { id: "transfert-1", siteId: SITE_ID, date: new Date("2026-03-26") },
      vagueSource: { id: VAGUE_SOURCE_ID, code: "PG-001", statut: StatutVague.EN_COURS },
      vagueDest: {
        id: VAGUE_DEST_ID,
        code: "GR-001",
        nombreInitial: 60,
        poidsMoyenInitial: 150,
      },
    });

    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockVagueUpdate.mockResolvedValue({});

    // Étape 5
    mockAssignationBacFindMany.mockResolvedValue([
      { bacId: BAC_SOURCE_ID, nombreInitial: 100, nombreActuel: 100 },
    ]);
    mockReleveFindMany.mockResolvedValue([]);
    mockVagueFindFirst.mockResolvedValue({ nombreInitial: 100 });

    // Étape 6b : bac dest BAC_DEST_ID existe déjà
    mockAssignationBacFindFirst.mockResolvedValue({ id: "ab-dest-existing" });

    mockAssignationBacCreate.mockResolvedValue({});
    mockTransfertGroupeUpdate.mockResolvedValue({ id: "groupe-1" });
    mockTransfertGroupeFindUniqueOrThrow.mockResolvedValue({
      id: "groupe-1",
      nombrePoissons: 65,
      poidsMoyenG: 155,
      nombreMorts: 0,
      bacSourceId: BAC_SOURCE_ID,
      bacDestId: BAC_DEST_ID,
      transfert: { id: "transfert-1", siteId: SITE_ID, date: new Date("2026-03-26") },
      vagueSource: { id: VAGUE_SOURCE_ID, code: "PG-001", statut: StatutVague.EN_COURS },
      vagueDest: { id: VAGUE_DEST_ID, code: "GR-001" },
      modifications: [],
    });

    await updateTransfertGroupe(SITE_ID, USER_ID, "groupe-1", {
      raison: "Ajustement quantité",
      nombrePoissons: 65,
      poidsMoyenG: 155,
    });

    // Pas de create pour bac dest (assignation existante)
    const createCallsForDest = mockAssignationBacCreate.mock.calls.filter(
      (call) =>
        call[0]?.data?.bacId === BAC_DEST_ID &&
        call[0]?.data?.vagueId === VAGUE_DEST_ID
    );
    expect(createCallsForDest.length).toBe(0);

    // Update incrémentiel appelé pour la destination
    expect(mockAssignationBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ab-dest-existing" },
        data: expect.objectContaining({
          nombreActuel: expect.objectContaining({ increment: 65 }),
        }),
      })
    );
  });
});
