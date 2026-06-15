/**
 * Tests CX.1 — Calibrage Pass 2 populate `nombreInitial` sur destination vide
 *
 * Verifie que :
 * 1. Pass 2 sur AssignationBac existante avec init=0 → apres update : init = total, poidsMoyenInitial = avg
 * 2. Pass 2 sur AssignationBac existante avec init > 0 → init INCHANGE (historique valide)
 * 3. Pass 2 crée une nouvelle AssignationBac → init = total, poidsMoyenInitial = avg
 * 4. patchCalibrage Pass 2 : même comportement (régression)
 * 5. Régression CG.1 : la conservation stricte reste verte
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalibrage, patchCalibrage } from "@/lib/queries/calibrages";
import { StatutVague, TypeReleve, CategorieCalibrage } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();
const mockAssignationBacUpdate = vi.fn();
const mockAssignationBacCreate = vi.fn();
const mockReleveFindMany = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveUpdate = vi.fn();
const mockReleveUpdateMany = vi.fn();
const mockReleveDeleteMany = vi.fn();
const mockCalibrageCreate = vi.fn();
const mockCalibrageFindUniqueOrThrow = vi.fn();
const mockCalibrageFindFirst = vi.fn();
const mockCalibrageUpdate = vi.fn();
const mockCalibrageGroupeDeleteMany = vi.fn();
const mockCalibrageModificationCreateMany = vi.fn();
const mockTransfertGroupeFindMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
    },
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
      update: (...args: unknown[]) => mockAssignationBacUpdate(...args),
      create: (...args: unknown[]) => mockAssignationBacCreate(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
      create: (...args: unknown[]) => mockReleveCreate(...args),
      update: (...args: unknown[]) => mockReleveUpdate(...args),
      updateMany: (...args: unknown[]) => mockReleveUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockReleveDeleteMany(...args),
    },
    calibrage: {
      create: (...args: unknown[]) => mockCalibrageCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockCalibrageFindUniqueOrThrow(...args),
      findFirst: (...args: unknown[]) => mockCalibrageFindFirst(...args),
      update: (...args: unknown[]) => mockCalibrageUpdate(...args),
    },
    calibrageGroupe: {
      deleteMany: (...args: unknown[]) => mockCalibrageGroupeDeleteMany(...args),
    },
    calibrageModification: {
      createMany: (...args: unknown[]) => mockCalibrageModificationCreateMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
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
// Constantes
// ---------------------------------------------------------------------------

const SITE_ID = "site-cx1";
const USER_ID = "user-cx1";
const VAGUE_ID = "vague-cx1";
const BAC_SOURCE_ID = "bac-source-cx1";
const BAC_DEST_ID = "bac-dest-cx1";
const VIVANTS = 1000;
const POIDS_MOYEN = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVague(nombreInitial = VIVANTS) {
  return {
    id: VAGUE_ID,
    code: "V-CX1",
    statut: StatutVague.EN_COURS,
    nombreInitial,
    poidsMoyenInitial: 50,
  };
}

function makeSourceAssignation(nombreActuel: number) {
  return [
    {
      id: "assign-src-cx1",
      bacId: BAC_SOURCE_ID,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      dateFin: null,
      nombreActuel,
      nombreInitial: nombreActuel,
      poidsMoyenInitial: 50,
      bac: { id: BAC_SOURCE_ID, nom: "Bac Source CX1" },
    },
  ];
}

function makeCreateDTO(redistribues: number, morts = 0) {
  return {
    vagueId: VAGUE_ID,
    sourceBacIds: [BAC_SOURCE_ID],
    nombreMorts: morts,
    groupes: [
      {
        categorie: CategorieCalibrage.MOYEN,
        destinationBacId: BAC_DEST_ID,
        nombrePoissons: redistribues,
        poidsMoyen: POIDS_MOYEN,
      },
    ],
  };
}

/**
 * Configure les mocks communs pour createCalibrage :
 *  - appel 1 assignationBac.findMany → sourceAssignations
 *  - appel 2 assignationBac.findMany → destAssignations
 *  - appel 3 assignationBac.findMany → allAssignationsVague
 *  - releve.findMany appel 1 → computeVivantsByBac (COMPTAGE)
 *  - appel 4 assignationBac.findMany → snapshotAvant
 *  - appel 5 assignationBac.findMany → Guard post-écriture
 *  - releve.findMany appel 2 → Guard post-écriture COMPTAGE override
 */
function setupBaseCreateMocks(vivants = VIVANTS) {
  vi.resetAllMocks();
  mockVagueFindFirst.mockResolvedValue(makeVague(vivants));

  mockAssignationBacFindMany
    .mockResolvedValueOnce(makeSourceAssignation(vivants))       // 1. sourceAssignations
    .mockResolvedValueOnce([{ bacId: BAC_DEST_ID }])             // 2. destAssignations
    .mockResolvedValueOnce([                                     // 3. allAssignationsVague
      { bacId: BAC_SOURCE_ID, nombreInitial: vivants },
    ])
    .mockResolvedValueOnce([                                     // 4. snapshotAvant
      {
        bacId: BAC_SOURCE_ID,
        nombreActuel: vivants,
        nombreInitial: vivants,
        poidsMoyenInitial: 50,
        bac: { id: BAC_SOURCE_ID, nom: "Bac Source CX1" },
      },
    ])
    // 5. Guard post-écriture
    .mockResolvedValueOnce([
      { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: vivants },
      { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: vivants, nombreInitial: vivants },
    ]);

  mockReleveFindMany
    .mockResolvedValueOnce([                                     // computeVivantsByBac
      {
        bacId: BAC_SOURCE_ID,
        typeReleve: TypeReleve.COMPTAGE,
        nombreMorts: null,
        nombreCompte: vivants,
        nombreVendus: null,
        nombreTransferes: null,
        date: new Date("2026-06-01"),
      },
    ])
    .mockResolvedValueOnce([                                     // Guard releve.findMany
      {
        bacId: BAC_SOURCE_ID,
        typeReleve: "COMPTAGE",
        date: new Date("2026-06-01"),
        nombreMorts: null,
        nombreCompte: 0,
        nombreTransferes: null,
        nombreVendus: null,
      },
      {
        bacId: BAC_DEST_ID,
        typeReleve: "COMPTAGE",
        date: new Date("2026-06-01"),
        nombreMorts: null,
        nombreCompte: vivants,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);

  mockTransfertGroupeFindMany.mockResolvedValue([]);
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  mockAssignationBacUpdate.mockResolvedValue({});
  mockAssignationBacCreate.mockResolvedValue({});
  mockCalibrageCreate.mockResolvedValue({ id: "calibrage-cx1" });
  mockCalibrageFindUniqueOrThrow.mockResolvedValue({
    id: "calibrage-cx1",
    vague: { id: VAGUE_ID, code: "V-CX1" },
    user: { id: USER_ID, name: "Admin" },
    groupes: [],
  });
  mockReleveCreate.mockResolvedValue({});
}

// ---------------------------------------------------------------------------
// Cas 1 — Pass 2 sur AssignationBac existante avec init=0
// ---------------------------------------------------------------------------

describe("CX.1 — createCalibrage Pass 2 : dest existant avec init=0", () => {
  beforeEach(() => {
    setupBaseCreateMocks(VIVANTS);
  });

  it("met a jour nombreInitial et poidsMoyenInitial quand init=0", async () => {
    // findFirst pour le bac dest : assignation existante avec init=0
    mockAssignationBacFindFirst.mockResolvedValueOnce({
      id: "a-dest-cx1",
      nombreActuel: 0,
      nombreInitial: 0,
      poidsMoyenInitial: 0,
    });

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(VIVANTS))
    ).resolves.toBeDefined();

    // assignationBac.update doit avoir ete appele avec init = VIVANTS et poidsMoyenInitial = POIDS_MOYEN
    expect(mockAssignationBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a-dest-cx1" },
        data: expect.objectContaining({
          nombreActuel: VIVANTS,
          nombreInitial: VIVANTS,
          poidsMoyenInitial: POIDS_MOYEN,
        }),
      })
    );
  });

  it("ne touche pas nombreInitial quand init > 0 (historique valide)", async () => {
    const INIT_EXISTANT = 500;
    // findFirst pour le bac dest : assignation existante avec init > 0
    mockAssignationBacFindFirst.mockResolvedValueOnce({
      id: "a-dest-cx1-init",
      nombreActuel: 0,
      nombreInitial: INIT_EXISTANT,
      poidsMoyenInitial: 80,
    });

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(VIVANTS))
    ).resolves.toBeDefined();

    // assignationBac.update doit avoir ete appele SANS nombreInitial ni poidsMoyenInitial
    expect(mockAssignationBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a-dest-cx1-init" },
        data: {
          nombreActuel: VIVANTS, // seulement nombreActuel — init INCHANGE
        },
      })
    );
    // Verification negative : nombreInitial ne doit PAS etre dans les data
    const callArgs = mockAssignationBacUpdate.mock.calls[0][0];
    expect(callArgs.data).not.toHaveProperty("nombreInitial");
    expect(callArgs.data).not.toHaveProperty("poidsMoyenInitial");
  });
});

// ---------------------------------------------------------------------------
// Cas 3 — Pass 2 crée une nouvelle AssignationBac (create défensif)
// ---------------------------------------------------------------------------

describe("CX.1 — createCalibrage Pass 2 : create défensif (AssignationBac manquante)", () => {
  it("cree AssignationBac avec init=total et poidsMoyenInitial=avg", async () => {
    setupBaseCreateMocks(VIVANTS);

    // findFirst retourne null → create défensif
    mockAssignationBacFindFirst.mockResolvedValueOnce(null);

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(VIVANTS))
    ).resolves.toBeDefined();

    // assignationBac.create doit avoir ete appele avec init = total
    expect(mockAssignationBacCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: BAC_DEST_ID,
          vagueId: VAGUE_ID,
          siteId: SITE_ID,
          nombreActuel: VIVANTS,
          nombreInitial: VIVANTS,       // CX.1 : init = total
          poidsMoyenInitial: POIDS_MOYEN, // CX.1 : poids moyen pondéré
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Cas 4 — patchCalibrage Pass 2 : même comportement (régression)
// ---------------------------------------------------------------------------

describe("CX.1 — patchCalibrage Pass 2 : dest existant avec init=0", () => {
  const CALIBRAGE_ID = "calibrage-cx1-patch";

  const ancienCalibrage = {
    id: CALIBRAGE_ID,
    sourceBacIds: [BAC_SOURCE_ID],
    nombreMorts: 0,
    notes: null,
    date: new Date("2026-06-10"),
    modifie: false,
    snapshotAvant: null,
    snapshotAvantModif: null,
    vague: { id: VAGUE_ID, statut: StatutVague.EN_COURS },
    groupes: [
      {
        id: "grp-cx1",
        categorie: CategorieCalibrage.MOYEN,
        destinationBacId: BAC_DEST_ID,
        destinationBac: { id: BAC_DEST_ID, nom: "Bac Dest CX1" },
        nombrePoissons: VIVANTS,
        poidsMoyen: POIDS_MOYEN,
        tailleMoyenne: null,
      },
    ],
  };

  function setupPatchMocks() {
    vi.resetAllMocks();

    mockCalibrageFindFirst
      .mockResolvedValueOnce(ancienCalibrage)  // Etape 1 fetch
      .mockResolvedValue({                     // Etape 9d fetch updated
        id: CALIBRAGE_ID,
        vague: { id: VAGUE_ID, code: "V-CX1" },
        user: { id: USER_ID, name: "Admin" },
        groupes: [],
        modifications: [
          {
            id: "mod-cx1",
            calibrageId: CALIBRAGE_ID,
            userId: USER_ID,
            raison: "test-cx1",
            champModifie: "groupes",
            ancienneValeur: null,
            nouvelleValeur: null,
            createdAt: new Date(),
            user: { id: USER_ID, name: "Admin" },
          },
        ],
      });

    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ bacId: BAC_DEST_ID }])           // Etape 5: destAssignationsPatch
      .mockResolvedValueOnce([                                   // Etape 5b: allAssignationsVagueModif
        {
          bacId: BAC_SOURCE_ID,
          nombreActuel: 0,
          nombreInitial: VIVANTS,
          poidsMoyenInitial: 50,
          bac: { id: BAC_SOURCE_ID, nom: "Bac Source CX1" },
        },
      ])
      // Guard post-écriture
      .mockResolvedValueOnce([
        { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: VIVANTS, dateAssignation: null },
        { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: VIVANTS, nombreInitial: VIVANTS, dateAssignation: null },
      ]);

    // Etape 6b: findFirst bac dest pour decrement
    // Etape 6c: findFirst bac source pour restore
    // Etape 7 pass 2: findFirst bac dest nouveau dispatch (init=0)
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "a-dest", nombreActuel: VIVANTS })    // 6b decrement
      .mockResolvedValueOnce({ id: "a-src", nombreActuel: 0 })           // 6c restore
      .mockResolvedValueOnce({                                            // 7 pass 2 : init=0
        id: "a-dest-patch",
        nombreActuel: 0,
        nombreInitial: 0,
        poidsMoyenInitial: 0,
      });

    mockAssignationBacUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockReleveDeleteMany.mockResolvedValue({ count: 0 });
    mockReleveCreate.mockResolvedValue({});
    mockReleveUpdateMany.mockResolvedValue({ count: 0 });
    mockCalibrageUpdate.mockResolvedValue({});
    mockCalibrageGroupeDeleteMany.mockResolvedValue({ count: 1 });
    mockCalibrageModificationCreateMany.mockResolvedValue({ count: 1 });
    mockVagueFindFirst.mockResolvedValue(makeVague());
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_SOURCE_ID,
        typeReleve: "COMPTAGE",
        date: new Date("2026-06-10"),
        nombreMorts: null,
        nombreCompte: 0,
        nombreTransferes: null,
        nombreVendus: null,
      },
      {
        bacId: BAC_DEST_ID,
        typeReleve: "COMPTAGE",
        date: new Date("2026-06-10"),
        nombreMorts: null,
        nombreCompte: VIVANTS,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValue([]);
  }

  it("met a jour nombreInitial et poidsMoyenInitial quand la dest avait init=0", async () => {
    setupPatchMocks();

    await expect(
      patchCalibrage(
        SITE_ID,
        USER_ID,
        CALIBRAGE_ID,
        {
          groupes: [
            {
              categorie: CategorieCalibrage.MOYEN,
              destinationBacId: BAC_DEST_ID,
              nombrePoissons: VIVANTS,
              poidsMoyen: POIDS_MOYEN,
            },
          ],
          nombreMorts: 0,
        },
        "Test CX.1 patchCalibrage init fields"
      )
    ).resolves.toBeDefined();

    // Trouver l'appel update correspondant au Pass 2 (3e appel update — apres 6b et 6c)
    const updateCalls = mockAssignationBacUpdate.mock.calls;
    // Le 3e appel est le Pass 2 dispatch (index 2 — 6b=0, 6c=1, pass2=2)
    const pass2Call = updateCalls[2];
    expect(pass2Call).toBeDefined();
    expect(pass2Call[0]).toMatchObject({
      where: { id: "a-dest-patch" },
      data: expect.objectContaining({
        nombreActuel: VIVANTS,
        nombreInitial: VIVANTS,
        poidsMoyenInitial: POIDS_MOYEN,
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// Cas 5 — Régression CG.1 : conservation stricte reste verte
// ---------------------------------------------------------------------------

describe("Régression CG.1 — conservation stricte reste verte avec CX.1", () => {
  it("accepte un calibrage complet 1000 redistribues + 0 morts apres patch CX.1", async () => {
    setupBaseCreateMocks(VIVANTS);

    // dest avec init=0 → CX.1 populera init
    mockAssignationBacFindFirst.mockResolvedValueOnce({
      id: "a-dest-regr",
      nombreActuel: 0,
      nombreInitial: 0,
      poidsMoyenInitial: 0,
    });

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(VIVANTS, 0))
    ).resolves.toBeDefined();
  });

  it("rejette si redistribues + morts depassent les vivants meme avec CX.1", async () => {
    setupBaseCreateMocks(VIVANTS);

    mockAssignationBacFindFirst.mockResolvedValueOnce({
      id: "a-dest-regr2",
      nombreActuel: 0,
      nombreInitial: 0,
      poidsMoyenInitial: 0,
    });

    // 500 redistribues sur 1000 vivants → ecart -500 >> tolerance(5) → rejet
    const err = await createCalibrage(
      SITE_ID,
      USER_ID,
      makeCreateDTO(500, 0)
    ).catch((e) => e);

    // L'erreur doit etre lancee AVANT d'atteindre le Pass 2 (conservation check)
    expect(err).toBeDefined();
    expect(err.message).toContain("Conservation");
  });
});
