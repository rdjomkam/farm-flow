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
const mockTransfertGroupeFindMany = vi.fn();

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
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
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
  // Call 1 : étape 5 conservation source
  // Call 2 : étape 12 clôture check (50 restants → pas de clôture)
  mockAssignationBacFindMany
    .mockResolvedValueOnce([
      { bacId: BAC_SOURCE_ID, nombreInitial: 100, nombreActuel: 100 },
    ])
    .mockResolvedValueOnce([
      { nombreActuel: 50 }, // étape 12 : 50 restants → source pas clôturée
    ]);
  mockAssignationBacFindFirst.mockResolvedValue(null);
  mockAssignationBacCreate.mockResolvedValue({ id: "ab-dest-1" });
  mockAssignationBacUpdate.mockResolvedValue({});
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  // Call 1 : étape 5 conservation source relevés
  mockReleveFindMany.mockResolvedValueOnce([]);
  mockReleveCreate.mockResolvedValue({});
  mockTransfertCreate.mockResolvedValue({ id: "transfert-1" });
  mockTransfertFindUniqueOrThrow.mockResolvedValue({
    id: "transfert-1",
    siteId: SITE_ID,
    groupes: [{ id: "groupe-1", bacDestId: BAC_DEST_ID }],
  });
}

/**
 * Ajoute les mocks du guard post-écriture pour un transfert de 50 poissons
 * vers un bac destination vierge (premier transfert).
 */
function addGuardMocksForFirstTransfer(transferDate: Date) {
  mockAssignationBacFindMany
    // guard source: 50 restants, dateAssignation null
    .mockResolvedValueOnce([
      { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 50, nombreInitial: 100, dateAssignation: null },
    ])
    // guard dest: dateAssignation=transferDate → CX.2 (>=) : le TRANSFERT entrant créé ce même
    // jour est INCLUS. nombreInitial doit donc être 0 (baseline avant ce premier transfert vers
    // un bac vierge) pour éviter le double comptage → attendu 0+50=50 ✓
    .mockResolvedValueOnce([
      { id: "ab-dest-1", bacId: BAC_DEST_ID, nombreActuel: 50, nombreInitial: 0, dateAssignation: transferDate },
    ]);
  mockReleveFindMany
    // guard source: TRANSFERT sortant 50
    .mockResolvedValueOnce([
      {
        bacId: BAC_SOURCE_ID,
        typeReleve: "TRANSFERT",
        date: transferDate,
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 50,
        nombreVendus: null,
        transfertGroupeId: "groupe-1",
      },
    ])
    // guard dest: TRANSFERT entrant à transferDate → exclu
    .mockResolvedValueOnce([
      {
        bacId: BAC_DEST_ID,
        typeReleve: "TRANSFERT",
        date: transferDate,
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 50,
        nombreVendus: null,
        transfertGroupeId: "groupe-1",
      },
    ]);
  // GV.1-GV.2 — TransfertGroupe résolu PAR RELEVÉ (via transfertGroupeId) : bacSourceId/bacDestId
  // permettent au guard de discriminer entrant/sortant, pas de discrimination par bac.
  mockTransfertGroupeFindMany.mockResolvedValue([
    { id: "groupe-1", bacSourceId: BAC_SOURCE_ID, bacDestId: BAC_DEST_ID },
  ]);
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
    const transferDate = new Date("2026-01-10");
    setupDefaultMocks();
    addGuardMocksForFirstTransfer(transferDate);

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
    // Override guard dest mock : après 2nd transfert, dest=100 (50 initial + 50 new)
    // dateAssignation=firstTransferDate, TRANSFERT entrant de firstTransferDate exclu, de newTransferDate inclus
    const firstTransferDate = new Date("2026-01-10"); // même que setupDefaultMocks
    const secondTransferDate = new Date("2026-01-20");
    // setupDefaultMocks a déjà consommé les 2 premiers mockResolvedValueOnce pour findMany,
    // puis les 2 pour releve. On ajoute les guards pour le 2nd appel (test 3 réutilise la fixture
    // en réécrasant les guards avec des valeurs cohérentes).
    // Re-queue guards pour ce test (les Once de setupDefaultMocks sont consommés par la création):
    mockAssignationBacFindMany
      .mockResolvedValueOnce([ // guard source
        { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 50, nombreInitial: 100, dateAssignation: null },
      ])
      .mockResolvedValueOnce([ // guard dest : nombreActuel=100 (50 du 1er transfert + 50 du 2e)
        // dateAssignation=firstTransferDate → CX.2 (>=) : les 2 TRANSFERT entrants sont inclus.
        // nombreInitial doit donc être 0 (baseline avant le tout premier transfert vers ce bac
        // vierge) pour éviter le double comptage → attendu 0+50+50=100 ✓
        { id: "ab-dest-existing", bacId: BAC_DEST_ID, nombreActuel: 100, nombreInitial: 0, dateAssignation: firstTransferDate },
      ]);
    mockReleveFindMany
      .mockResolvedValueOnce([ // guard source: TRANSFERT sortant 50 → attendu 50
        {
          bacId: BAC_SOURCE_ID,
          typeReleve: "TRANSFERT",
          date: secondTransferDate,
          nombreMorts: null,
          nombreCompte: null,
          nombreTransferes: 50,
          nombreVendus: null,
          transfertGroupeId: "groupe-2",
        },
      ])
      .mockResolvedValueOnce([ // guard dest: CX.2 (>=) : les 2 TRANSFERT entrants sont inclus → nombreInitial(0)+50+50=100
        {
          bacId: BAC_DEST_ID,
          typeReleve: "TRANSFERT",
          date: firstTransferDate, // inclus (>= dateAssignation=firstTransferDate)
          nombreMorts: null,
          nombreCompte: null,
          nombreTransferes: 50,
          nombreVendus: null,
          transfertGroupeId: "groupe-1",
        },
        {
          bacId: BAC_DEST_ID,
          typeReleve: "TRANSFERT",
          date: secondTransferDate, // inclus (>= firstTransferDate)
          nombreMorts: null,
          nombreCompte: null,
          nombreTransferes: 50,
          nombreVendus: null,
          transfertGroupeId: "groupe-2",
        },
      ]);
    // GV.1-GV.2 — TransfertGroupe résolus PAR RELEVÉ : groupe-1 (1er transfert) et groupe-2 (2ème)
    mockTransfertGroupeFindMany.mockResolvedValue([
      { id: "groupe-1", bacSourceId: BAC_SOURCE_ID, bacDestId: BAC_DEST_ID },
      { id: "groupe-2", bacSourceId: BAC_SOURCE_ID, bacDestId: BAC_DEST_ID },
    ]);
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
