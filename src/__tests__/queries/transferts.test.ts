/**
 * Tests unitaires — src/lib/queries/transferts.ts
 *
 * Story PG.4 — Tests unitaires des queries Prisma transferts.
 *
 * Couvre :
 * - computeWeightedAverage (helper interne via effets observables)
 * - createTransfert (Mode A + Mode B + erreurs + effets secondaires)
 * - getTransfertById
 * - listTransfertsForSite
 * - listTransfertsForVague
 * - updateTransfertGroupe
 * - getLineage
 * - canDeleteVague
 *
 * Pattern : vi.mock("@/lib/db") avec tx factice passé dans $transaction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTransfert,
  getTransfertById,
  listTransfertsForSite,
  listTransfertsForVague,
  updateTransfertGroupe,
  getLineage,
  canDeleteVague,
} from "@/lib/queries/transferts";
import {
  StatutVague,
  TypeVague,
  TypeReleve,
  CauseMortalite,
  ModeTransfert,
} from "@/types";
import type { CreateTransfertDTO, UpdateTransfertGroupeDTO } from "@/types";

// ---------------------------------------------------------------------------
// Mocks des handlers Prisma
// ---------------------------------------------------------------------------

const mockVagueFindMany = vi.fn();
const mockVagueFindFirst = vi.fn();
const mockVagueFindUniqueOrThrow = vi.fn();
const mockVagueCreate = vi.fn();
const mockVagueUpdate = vi.fn();

const mockTransfertCreate = vi.fn();
const mockTransfertFindUniqueOrThrow = vi.fn();
const mockTransfertFindFirst = vi.fn();
const mockTransfertFindMany = vi.fn();
const mockTransfertCount = vi.fn();

const mockTransfertGroupeFindMany = vi.fn();
const mockTransfertGroupeFindFirst = vi.fn();
const mockTransfertGroupeUpdate = vi.fn();
const mockTransfertGroupeFindUniqueOrThrow = vi.fn();
const mockTransfertGroupeCount = vi.fn();

const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacCreate = vi.fn();
const mockAssignationBacUpdate = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();

const mockReleveFindMany = vi.fn();
const mockReleveCreate = vi.fn();

const mockTransfertModificationCreate = vi.fn();

// Transaction factice — exécute fn(tx) avec tx = proxy vers les mocks
const mockTransaction = vi.fn(
  async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
    const tx = {
      vague: {
        findMany: (...args: unknown[]) => mockVagueFindMany(...args),
        findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
        findUniqueOrThrow: (...args: unknown[]) =>
          mockVagueFindUniqueOrThrow(...args),
        create: (...args: unknown[]) => mockVagueCreate(...args),
        update: (...args: unknown[]) => mockVagueUpdate(...args),
      },
      transfert: {
        create: (...args: unknown[]) => mockTransfertCreate(...args),
        findUniqueOrThrow: (...args: unknown[]) =>
          mockTransfertFindUniqueOrThrow(...args),
      },
      transfertGroupe: {
        findFirst: (...args: unknown[]) => mockTransfertGroupeFindFirst(...args),
        findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
        update: (...args: unknown[]) => mockTransfertGroupeUpdate(...args),
        findUniqueOrThrow: (...args: unknown[]) =>
          mockTransfertGroupeFindUniqueOrThrow(...args),
      },
      assignationBac: {
        findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
        findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
        create: (...args: unknown[]) => mockAssignationBacCreate(...args),
        update: (...args: unknown[]) => mockAssignationBacUpdate(...args),
        updateMany: (...args: unknown[]) =>
          mockAssignationBacUpdateMany(...args),
      },
      releve: {
        findMany: (...args: unknown[]) => mockReleveFindMany(...args),
        create: (...args: unknown[]) => mockReleveCreate(...args),
      },
      transfertModification: {
        create: (...args: unknown[]) => mockTransfertModificationCreate(...args),
      },
    };
    return fn(tx);
  }
);

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) =>
      mockTransaction(...(args as Parameters<typeof mockTransaction>)),
    transfert: {
      findFirst: (...args: unknown[]) => mockTransfertFindFirst(...args),
      findMany: (...args: unknown[]) => mockTransfertFindMany(...args),
      count: (...args: unknown[]) => mockTransfertCount(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
      count: (...args: unknown[]) => mockTransfertGroupeCount(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Constantes partagées
// ---------------------------------------------------------------------------

const SITE_ID = "site-001";
const USER_ID = "user-001";
const VAGUE_SRC_ID = "vague-src-001";
const VAGUE_DEST_ID = "vague-dest-001";
const BAC_SRC_ID = "bac-src-001";
const BAC_DEST_ID = "bac-dest-001";
const TRANSFERT_ID = "transfert-001";
const GROUPE_ID = "groupe-001";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const vaguePreGross = {
  id: VAGUE_SRC_ID,
  code: "PG-2026-001",
  type: TypeVague.PRE_GROSSISSEMENT,
  statut: StatutVague.EN_COURS,
  nombreInitial: 1000,
  poidsMoyenInitial: 50,
  siteId: SITE_ID,
};

const vagueGross = {
  id: VAGUE_DEST_ID,
  code: "G-2026-001",
  type: TypeVague.GROSSISSEMENT,
  statut: StatutVague.EN_COURS,
  nombreInitial: 500,
  poidsMoyenInitial: 60,
  siteId: SITE_ID,
};

const assignationSrc = {
  id: "assign-src-001",
  bacId: BAC_SRC_ID,
  vagueId: VAGUE_SRC_ID,
  siteId: SITE_ID,
  dateFin: null,
  nombreActuel: 1000,
  nombreInitial: 1000,
  poidsMoyenInitial: 50,
};

const assignationDest = {
  id: "assign-dest-001",
  bacId: BAC_DEST_ID,
  vagueId: VAGUE_DEST_ID,
  siteId: SITE_ID,
  dateFin: null,
  nombreActuel: 500,
  nombreInitial: 500,
  poidsMoyenInitial: 60,
};

const fakeTransfertWithGroupes = {
  id: TRANSFERT_ID,
  siteId: SITE_ID,
  userId: USER_ID,
  date: new Date("2026-05-01"),
  notes: null,
  user: { id: USER_ID, name: "Test User" },
  groupes: [
    {
      id: GROUPE_ID,
      transfertId: TRANSFERT_ID,
      vagueSourceId: VAGUE_SRC_ID,
      vagueDestId: VAGUE_DEST_ID,
      bacSourceId: BAC_SRC_ID,
      bacDestId: BAC_DEST_ID,
      nombrePoissons: 200,
      poidsMoyenG: 55,
      nombreMorts: 0,
      vagueSource: { id: VAGUE_SRC_ID, code: "PG-2026-001", type: TypeVague.PRE_GROSSISSEMENT },
      vagueDest: { id: VAGUE_DEST_ID, code: "G-2026-001", type: TypeVague.GROSSISSEMENT },
      bacSource: { id: BAC_SRC_ID, nom: "Bac Source" },
      bacDest: { id: BAC_DEST_ID, nom: "Bac Dest" },
      modifications: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper DTO factories
// ---------------------------------------------------------------------------

function makeModeADto(overrides?: Partial<{ nombrePoissons: number; nombreMorts: number; poidsMoyenG: number }>): CreateTransfertDTO {
  return {
    mode: ModeTransfert.CREATE_NEW,
    nouvelleVague: {
      code: "G-2026-NEW",
      dateDebut: "2026-05-01",
      poidsObjectifKg: null,
      uniteProductionId: null,
    },
    groupes: [
      {
        vagueSourceId: VAGUE_SRC_ID,
        bacSourceId: BAC_SRC_ID,
        bacDestId: BAC_DEST_ID,
        nombrePoissons: overrides?.nombrePoissons ?? 200,
        poidsMoyenG: overrides?.poidsMoyenG ?? 55,
        nombreMorts: overrides?.nombreMorts ?? 0,
      },
    ],
    notes: null,
    date: "2026-05-01",
  };
}

function makeModeBDto(overrides?: Partial<{ nombrePoissons: number; nombreMorts: number }>): CreateTransfertDTO {
  return {
    mode: ModeTransfert.USE_EXISTING,
    vagueDestId: VAGUE_DEST_ID,
    groupes: [
      {
        vagueSourceId: VAGUE_SRC_ID,
        bacSourceId: BAC_SRC_ID,
        bacDestId: BAC_DEST_ID,
        nombrePoissons: overrides?.nombrePoissons ?? 200,
        poidsMoyenG: 55,
        nombreMorts: overrides?.nombreMorts ?? 0,
      },
    ],
    notes: null,
    date: "2026-05-01",
  };
}

/**
 * Configure les mocks pour un happy path createTransfert Mode A.
 * Appels successifs à findMany + autres mocks standardisés.
 *
 * Ordre des appels mockAssignationBacFindMany dans createTransfert :
 *   1. Étape 5  — assignationsBacs source pour computeVivantsByBac + conservation
 *   2. Étape 12 — vivants restants par vague source pour clôture
 *
 * Ordre des appels mockAssignationBacFindFirst :
 *   1. Étape 6  — existence assignation dest (pour créer si absente)
 *   2. Étape 9  — increment assignation dest
 */
function setupHappyPathMocks(overrides?: {
  nombreActuelSrc?: number;
  nombrePoissonsTransfert?: number;
  nombreMorts?: number;
}) {
  const nombreActuelSrc = overrides?.nombreActuelSrc ?? 1000;
  const nombrePoissons = overrides?.nombrePoissonsTransfert ?? 200;
  const nombreMorts = overrides?.nombreMorts ?? 0;
  const restants = nombreActuelSrc - nombrePoissons - nombreMorts;

  // Vague source
  mockVagueFindMany.mockResolvedValue([vaguePreGross]);

  // Vague dest — Mode A : code pas encore pris + création
  mockVagueFindFirst.mockResolvedValue(null);
  mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });

  // Étape 5 — assignationsBacs source (nombreInitial = nombreActuelSrc pour que computeVivantsByBac donne les bons vivants)
  mockAssignationBacFindMany
    .mockResolvedValueOnce([
      { ...assignationSrc, nombreActuel: nombreActuelSrc, nombreInitial: nombreActuelSrc },
    ])
    // Étape 12 — vivants restants après transfert
    .mockResolvedValueOnce([{ nombreActuel: restants }]);

  // releves MORTALITE/COMPTAGE pour computeVivantsByBac (aucun par défaut → vivants = nombreInitial)
  mockReleveFindMany.mockResolvedValue([]);

  // GV.1-GV.2 — TransfertGroupe de la vague source (aucun par défaut, pas de chaîne de transferts)
  mockTransfertGroupeFindMany.mockResolvedValue([]);

  // Étape 6 — existence assignation dest + Étape 9 — increment
  mockAssignationBacFindFirst
    .mockResolvedValueOnce({ id: assignationDest.id }) // étape 6
    .mockResolvedValueOnce({ id: assignationDest.id }); // étape 9

  // Création du transfert raw
  mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });

  // findUniqueOrThrow pour retourner le transfert avec relations
  mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);

  // Vague dest pour recalcul pondéré (étape 10)
  mockVagueFindUniqueOrThrow.mockResolvedValue({
    id: VAGUE_DEST_ID,
    nombreInitial: 500,
    poidsMoyenInitial: 60,
  });

  // Mise à jour vague dest (étapes 10 + 12 si clôture)
  mockVagueUpdate.mockResolvedValue({});

  // Décrémentation source (R4 — updateMany)
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

  // Incrémentation dest
  mockAssignationBacUpdate.mockResolvedValue({});

  // Relevés auto (BIOMETRIE obligatoire, MORTALITE si nombreMorts > 0)
  mockReleveCreate.mockResolvedValue({});
}

// ---------------------------------------------------------------------------
// 1. computeWeightedAverage — tests via effets observables sur vague.update
// ---------------------------------------------------------------------------

describe("computeWeightedAverage — via createTransfert Mode A", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    // Default pour les appels supplémentaires (guard verifyAssignationInvariant — GD.1)
    mockAssignationBacFindMany.mockResolvedValue([]);
  });

  it("calcule la moyenne pondérée correctement pour deux groupes", async () => {
    // Vague dest initialement vide (nombreInitial=0, poidsMoyenInitial=0)
    // Groupe 1 : 200 poissons à 50g
    // Résultat attendu : newTotal=200, newAvg=50
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 }]) // étape 5
      .mockResolvedValueOnce([{ nombreActuel: 800 }]); // étape 12
    mockReleveFindMany.mockResolvedValue([]);
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" })
      .mockResolvedValueOnce({ id: "ad-1" });
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      id: VAGUE_DEST_ID,
      nombreInitial: 0,
      poidsMoyenInitial: 0,
    });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    const dto: CreateTransfertDTO = {
      mode: ModeTransfert.CREATE_NEW,
      nouvelleVague: { code: "G-NEW", dateDebut: "2026-05-01" },
      groupes: [{ vagueSourceId: VAGUE_SRC_ID, bacSourceId: BAC_SRC_ID, bacDestId: BAC_DEST_ID, nombrePoissons: 200, poidsMoyenG: 50 }],
      date: "2026-05-01",
    };

    // Vague créée (Mode A)
    mockVagueFindFirst.mockResolvedValue(null); // code non pris
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });

    await expect(createTransfert(SITE_ID, USER_ID, dto)).resolves.toBeDefined();

    // Vérifier que vague.update a reçu le recalcul pondéré correct
    const vagueUpdateCall = mockVagueUpdate.mock.calls.find(
      (call) => call[0]?.data?.poidsMoyenInitial !== undefined
    );
    expect(vagueUpdateCall).toBeDefined();
    expect(vagueUpdateCall![0].data.nombreInitial).toBe(200);
    expect(vagueUpdateCall![0].data.poidsMoyenInitial).toBe(50);
  });

  it("gère le cas total=0 sans division par zéro (retourne avg=0)", async () => {
    // computeWeightedAverage : si currentTotal=0 et newCount=1, avg = newAvg
    // Vague dest initialement vide (0 poissons), 1 poisson transféré à 75g → avg=75
    // DTO sans bacSourceId → code prend la branche "proportionnelle" (étape 8)
    //   qui appelle assignationBacFindMany (2ème appel) puis update (pas updateMany)
    // Donc l'ordre des mocks assignationBacFindMany :
    //   1. étape 5 — conservation
    //   2. étape 8 — distribution proportionnelle (pas de bac source)
    //   3. étape 12 — vivants restants
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreInitial: 1000, nombreActuel: 1000 }]) // étape 5
      .mockResolvedValueOnce([{ id: "assign-src-001", nombreActuel: 1000 }]) // étape 8 (distribution sans bac)
      .mockResolvedValueOnce([{ nombreActuel: 999 }]); // étape 12
    mockReleveFindMany.mockResolvedValue([]);
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    // Pas de bacDestId → pas d'appels findFirst pour dest
    mockAssignationBacFindFirst.mockResolvedValue(null);
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    const dto: CreateTransfertDTO = {
      mode: ModeTransfert.CREATE_NEW,
      nouvelleVague: { code: "G-NEW", dateDebut: "2026-05-01" },
      groupes: [{ vagueSourceId: VAGUE_SRC_ID, bacDestId: BAC_DEST_ID, nombrePoissons: 1, poidsMoyenG: 75 }],
      date: "2026-05-01",
    };

    await expect(createTransfert(SITE_ID, USER_ID, dto)).resolves.toBeDefined();

    const vagueUpdateCall = mockVagueUpdate.mock.calls.find(
      (call) => call[0]?.data?.poidsMoyenInitial !== undefined
    );
    expect(vagueUpdateCall![0].data.poidsMoyenInitial).toBe(75);
    expect(vagueUpdateCall![0].data.nombreInitial).toBe(1);
  });

  it("calcule correctement la moyenne pondérée cumulative pour 2 groupes", async () => {
    // Groupe 1 : 100 poissons à 40g → accTotal=100, accAvg=40
    // Groupe 2 : 100 poissons à 60g → accTotal=200, accAvg=(100*40+100*60)/200=50
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreInitial: 1000, nombreActuel: 1000 }]) // étape 5
      .mockResolvedValueOnce([{ nombreActuel: 800 }]); // étape 12
    mockReleveFindMany.mockResolvedValue([]);
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    // findFirst pour dest : 2 groupes → 2 appels étape 6 + 2 appels étape 9
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" }) // étape 6 bac-d1
      .mockResolvedValueOnce({ id: "ad-2" }) // étape 6 bac-d2
      .mockResolvedValueOnce({ id: "ad-1" }) // étape 9 bac-d1
      .mockResolvedValueOnce({ id: "ad-2" }); // étape 9 bac-d2
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    // Vague dest avec base 0 pour vérifier recalcul cumulatif
    mockVagueFindUniqueOrThrow
      .mockResolvedValueOnce({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    const dto: CreateTransfertDTO = {
      mode: ModeTransfert.CREATE_NEW,
      nouvelleVague: { code: "G-NEW-2", dateDebut: "2026-05-01" },
      groupes: [
        { vagueSourceId: VAGUE_SRC_ID, bacSourceId: BAC_SRC_ID, bacDestId: "bac-d1", nombrePoissons: 100, poidsMoyenG: 40 },
        { vagueSourceId: VAGUE_SRC_ID, bacSourceId: BAC_SRC_ID, bacDestId: "bac-d2", nombrePoissons: 100, poidsMoyenG: 60 },
      ],
      date: "2026-05-01",
    };

    await expect(createTransfert(SITE_ID, USER_ID, dto)).resolves.toBeDefined();

    const vagueUpdateCall = mockVagueUpdate.mock.calls.find(
      (call) => call[0]?.data?.poidsMoyenInitial !== undefined
    );
    expect(vagueUpdateCall![0].data.nombreInitial).toBe(200);
    expect(vagueUpdateCall![0].data.poidsMoyenInitial).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 2. createTransfert
// ---------------------------------------------------------------------------

describe("createTransfert", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // GV.1-GV.2 — TransfertGroupe de la vague source par défaut (pas de chaîne de transferts)
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    // Default pour les appels supplémentaires (guard verifyAssignationInvariant — GD.1) au-delà
    // des mockResolvedValueOnce explicitement queués par chaque test pour étapes 5/8/12.
    mockAssignationBacFindMany.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // Mode A — succès
  // -------------------------------------------------------------------------

  it("TC01 — Mode A : crée nouvelle vague GROSSISSEMENT + transfert + groupes + AssignationBac dest", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null); // code non pris
    mockVagueCreate.mockResolvedValue({ id: "vague-new-001" });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 }]) // étape 5
      .mockResolvedValueOnce([{ nombreActuel: 800 }]); // étape 12
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce(null) // pas encore d'assignation dest (étape 6) → crée
      .mockResolvedValueOnce({ id: "ad-new" }); // étape 9 : increment
    mockAssignationBacCreate.mockResolvedValue({});
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: "vague-new-001", nombreInitial: 0, poidsMoyenInitial: 0 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    const result = await createTransfert(SITE_ID, USER_ID, makeModeADto());

    expect(result).toBeDefined();
    expect(mockVagueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TypeVague.GROSSISSEMENT,
          statut: StatutVague.EN_COURS,
          siteId: SITE_ID,
        }),
      })
    );
    expect(mockTransfertCreate).toHaveBeenCalledOnce();
    // AssignationBac dest créée car inexistante
    expect(mockAssignationBacCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bacId: BAC_DEST_ID }),
      })
    );
  });

  it("TC01b — Mode A : retourne TransfertWithGroupes", async () => {
    setupHappyPathMocks();

    const result = await createTransfert(SITE_ID, USER_ID, makeModeADto());

    expect(result).toMatchObject({ id: TRANSFERT_ID, siteId: SITE_ID });
    expect(Array.isArray(result.groupes)).toBe(true);
  });

  it("TC01c — Mode A : décrémente AssignationBac source (R4 updateMany)", async () => {
    setupHappyPathMocks({ nombrePoissonsTransfert: 200 });

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 200 }));

    expect(mockAssignationBacUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bacId: BAC_SRC_ID,
          dateFin: null,
          nombreActuel: { gte: 200 },
        }),
        data: { nombreActuel: { decrement: 200 } },
      })
    );
  });

  // -------------------------------------------------------------------------
  // Mode B — succès
  // -------------------------------------------------------------------------

  it("TC02 — Mode B : transfère vers vague existante, incrémente AssignationBac dest", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(vagueGross); // vague dest existante
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreInitial: 1000 }])
      .mockResolvedValueOnce([{ nombreActuel: 300 }]);
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" }) // étape 6
      .mockResolvedValueOnce({ id: "ad-1" }); // étape 9
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 500, poidsMoyenInitial: 60 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    const result = await createTransfert(SITE_ID, USER_ID, makeModeBDto());

    expect(result).toBeDefined();
    // Pas de création de vague
    expect(mockVagueCreate).not.toHaveBeenCalled();
    // Incrémentation AssignationBac dest
    expect(mockAssignationBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nombreActuel: { increment: 200 } },
      })
    );
  });

  it("TC02b — Mode B : recalcul pondéré sur vague existante", async () => {
    // Base : 500 poissons à 60g, transfert 200 à 55g
    // Attendu : total=700, avg=(500*60+200*55)/700 = (30000+11000)/700 = 41000/700 ≈ 58.571...
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(vagueGross);
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreInitial: 1000 }])
      .mockResolvedValueOnce([{ nombreActuel: 800 }]);
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" })
      .mockResolvedValueOnce({ id: "ad-1" });
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 500, poidsMoyenInitial: 60 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    await createTransfert(SITE_ID, USER_ID, makeModeBDto({ nombrePoissons: 200 }));

    const vagueUpdateCall = mockVagueUpdate.mock.calls.find(
      (call) => call[0]?.data?.poidsMoyenInitial !== undefined
    );
    expect(vagueUpdateCall![0].data.nombreInitial).toBe(700);
    expect(vagueUpdateCall![0].data.poidsMoyenInitial).toBeCloseTo(58.571, 2);
  });

  // -------------------------------------------------------------------------
  // Erreurs — validation
  // -------------------------------------------------------------------------

  it("TC03 — Erreur : vague source pas PRE_GROSSISSEMENT", async () => {
    mockVagueFindMany.mockResolvedValue([{ ...vaguePreGross, type: TypeVague.GROSSISSEMENT }]);

    await expect(createTransfert(SITE_ID, USER_ID, makeModeADto())).rejects.toThrow(
      /n'est pas de type PRE_GROSSISSEMENT/
    );
  });

  it("TC04 — Erreur : vague source pas EN_COURS", async () => {
    mockVagueFindMany.mockResolvedValue([{ ...vaguePreGross, statut: StatutVague.TERMINEE }]);

    await expect(createTransfert(SITE_ID, USER_ID, makeModeADto())).rejects.toThrow(
      /n'est pas EN_COURS/
    );
  });

  it("TC05 — Erreur Mode B : vague dest pas GROSSISSEMENT", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue({ ...vagueGross, type: TypeVague.PRE_GROSSISSEMENT });

    await expect(createTransfert(SITE_ID, USER_ID, makeModeBDto())).rejects.toThrow(
      /n'est pas de type GROSSISSEMENT/
    );
  });

  it("TC06 — Erreur Mode B : vagueDestId ∈ sources (auto-référence)", async () => {
    // La vague source est aussi la vague dest
    const dto: CreateTransfertDTO = {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: VAGUE_SRC_ID, // même ID que la source
      groupes: [{ vagueSourceId: VAGUE_SRC_ID, bacDestId: "bac-dest-1", nombrePoissons: 100, poidsMoyenG: 50 }],
    };

    mockVagueFindMany.mockResolvedValue([vaguePreGross]);

    await expect(createTransfert(SITE_ID, USER_ID, dto)).rejects.toThrow(
      /ne peut pas être aussi une vague source/
    );
  });

  it("TC07 — Erreur : conservation violée (transfert > vivants disponibles)", async () => {
    // Vivants réels = 1000 (aucune mortalité), transfert = 1500 → violation
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValue([]);

    const dto = makeModeADto({ nombrePoissons: 1500 });
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });

    await expect(createTransfert(SITE_ID, USER_ID, dto)).rejects.toThrow(
      /Conservation violée/
    );
  });

  it("TC08 — Erreur : code unique violé en Mode A", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    // Code déjà pris
    mockVagueFindFirst.mockResolvedValue({ id: "existing-vague" });
    mockAssignationBacFindMany.mockResolvedValue([{ ...assignationSrc, nombreInitial: 1000 }]);
    mockReleveFindMany.mockResolvedValue([]);

    await expect(createTransfert(SITE_ID, USER_ID, makeModeADto())).rejects.toThrow(
      /déjà utilisé/
    );
  });

  // -------------------------------------------------------------------------
  // Effets secondaires : auto-relevés
  // -------------------------------------------------------------------------

  it("TC09 — Auto-création MORTALITE si nombreMorts > 0", async () => {
    setupHappyPathMocks({ nombreActuelSrc: 1000, nombrePoissonsTransfert: 200, nombreMorts: 5 });

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 200, nombreMorts: 5 }));

    expect(mockReleveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          typeReleve: TypeReleve.MORTALITE,
          nombreMorts: 5,
          causeMortalite: CauseMortalite.AUTRE,
          vagueId: VAGUE_SRC_ID,
        }),
      })
    );
  });

  it("TC10 — Auto-création BIOMETRIE pour chaque groupe sur vague dest", async () => {
    setupHappyPathMocks({ nombrePoissonsTransfert: 200 });

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 200 }));

    expect(mockReleveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          typeReleve: TypeReleve.BIOMETRIE,
          poidsMoyen: 55,
          vagueId: VAGUE_DEST_ID,
        }),
      })
    );
  });

  it("TC10b — Pas de relevé MORTALITE si nombreMorts = 0", async () => {
    setupHappyPathMocks({ nombreMorts: 0 });

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombreMorts: 0 }));

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls).toHaveLength(0);
  });

  it("TC11 — Clôture vague source si vivants restants = 0 après transfert", async () => {
    // Transfert de 1000 poissons (tous les vivants)
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 }])
      .mockResolvedValueOnce([{ nombreActuel: 0 }]); // 0 restants après transfert
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" })
      .mockResolvedValueOnce({ id: "ad-1" });
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 1000 }));

    expect(mockVagueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VAGUE_SRC_ID },
        data: expect.objectContaining({ statut: StatutVague.TERMINEE }),
      })
    );
  });

  it("TC11b — Pas de clôture si vivants restants > 0", async () => {
    // setupHappyPathMocks configure assignationBacFindMany[1] avec restants=800 (1000-200-0)
    setupHappyPathMocks({ nombreActuelSrc: 1000, nombrePoissonsTransfert: 200, nombreMorts: 0 });

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 200 }));

    const termineeCall = mockVagueUpdate.mock.calls.find(
      (call) => call[0]?.data?.statut === StatutVague.TERMINEE
    );
    expect(termineeCall).toBeUndefined();
  });

  it("TC12 — Conservation concurrente : updateMany retourne count=0 → throw", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 },
    ]); // étape 5 — conservation OK à ce stade
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" }) // étape 6
      .mockResolvedValueOnce({ id: "ad-1" }); // étape 9
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    // updateMany retourne count=0 (concurrence — entre la validation et la mise à jour)
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 0 });

    await expect(createTransfert(SITE_ID, USER_ID, makeModeADto())).rejects.toThrow(
      /Conservation violée \(concurrence détectée\)/
    );
  });
});

// ---------------------------------------------------------------------------
// 3. getTransfertById
// ---------------------------------------------------------------------------

describe("getTransfertById", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("TC13 — retourne null si transfert introuvable", async () => {
    mockTransfertFindFirst.mockResolvedValue(null);

    const result = await getTransfertById(SITE_ID, "inconnu");

    expect(result).toBeNull();
    expect(mockTransfertFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inconnu", siteId: SITE_ID } })
    );
  });

  it("TC14 — retourne TransfertWithGroupes avec relations chargées", async () => {
    mockTransfertFindFirst.mockResolvedValue(fakeTransfertWithGroupes);

    const result = await getTransfertById(SITE_ID, TRANSFERT_ID);

    expect(result).toMatchObject({ id: TRANSFERT_ID });
    expect(result?.groupes).toHaveLength(1);
  });

  it("TC15 — filtre par siteId (sécurité multi-tenant)", async () => {
    mockTransfertFindFirst.mockResolvedValue(null);

    await getTransfertById("autre-site", TRANSFERT_ID);

    expect(mockTransfertFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteId: "autre-site" }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 4. listTransfertsForSite
// ---------------------------------------------------------------------------

describe("listTransfertsForSite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("TC16 — retourne { data, total } avec pagination", async () => {
    mockTransfertFindMany.mockResolvedValue([fakeTransfertWithGroupes]);
    mockTransfertCount.mockResolvedValue(1);

    const result = await listTransfertsForSite(SITE_ID, {}, { limit: 10, offset: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockTransfertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 0 })
    );
  });

  it("TC17 — filtrage par vagueId + direction 'source'", async () => {
    mockTransfertFindMany.mockResolvedValue([]);
    mockTransfertCount.mockResolvedValue(0);

    await listTransfertsForSite(SITE_ID, { vagueId: VAGUE_SRC_ID, direction: "source" });

    expect(mockTransfertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupes: { some: { vagueSourceId: VAGUE_SRC_ID } },
        }),
      })
    );
  });

  it("TC18 — filtrage par vagueId + direction 'destination'", async () => {
    mockTransfertFindMany.mockResolvedValue([]);
    mockTransfertCount.mockResolvedValue(0);

    await listTransfertsForSite(SITE_ID, { vagueId: VAGUE_DEST_ID, direction: "destination" });

    expect(mockTransfertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupes: { some: { vagueDestId: VAGUE_DEST_ID } },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 5. listTransfertsForVague
// ---------------------------------------------------------------------------

describe("listTransfertsForVague", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("TC19 — filtre par direction 'source'", async () => {
    mockTransfertGroupeFindMany.mockResolvedValue([]);

    await listTransfertsForVague(SITE_ID, VAGUE_SRC_ID, "source");

    expect(mockTransfertGroupeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vagueSourceId: VAGUE_SRC_ID, transfert: { siteId: SITE_ID } },
      })
    );
  });

  it("TC20 — filtre par direction 'destination'", async () => {
    mockTransfertGroupeFindMany.mockResolvedValue([]);

    await listTransfertsForVague(SITE_ID, VAGUE_DEST_ID, "destination");

    expect(mockTransfertGroupeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vagueDestId: VAGUE_DEST_ID, transfert: { siteId: SITE_ID } },
      })
    );
  });

  it("TC21 — sécurité multi-tenant via transfert.siteId dans le filtre", async () => {
    mockTransfertGroupeFindMany.mockResolvedValue([]);

    await listTransfertsForVague("site-autre", VAGUE_SRC_ID, "source");

    expect(mockTransfertGroupeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transfert: { siteId: "site-autre" },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 6. updateTransfertGroupe
// ---------------------------------------------------------------------------

describe("updateTransfertGroupe", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    // Default pour les appels supplémentaires (guard verifyAssignationInvariant — GD.1)
    mockAssignationBacFindMany.mockResolvedValue([]);
  });

  const fakeGroupe = {
    id: GROUPE_ID,
    transfertId: TRANSFERT_ID,
    vagueSourceId: VAGUE_SRC_ID,
    vagueDestId: VAGUE_DEST_ID,
    bacSourceId: BAC_SRC_ID,
    bacDestId: BAC_DEST_ID,
    nombrePoissons: 200,
    poidsMoyenG: 55,
    nombreMorts: 0,
    transfert: { id: TRANSFERT_ID, siteId: SITE_ID },
    vagueSource: {
      id: VAGUE_SRC_ID,
      code: "PG-2026-001",
      statut: StatutVague.EN_COURS,
    },
    vagueDest: {
      id: VAGUE_DEST_ID,
      code: "G-2026-001",
      nombreInitial: 700,
      poidsMoyenInitial: 58,
    },
  };

  const fakeGroupeUpdated = {
    id: GROUPE_ID,
    transfertId: TRANSFERT_ID,
    vagueSourceId: VAGUE_SRC_ID,
    vagueDestId: VAGUE_DEST_ID,
    bacSourceId: BAC_SRC_ID,
    bacDestId: BAC_DEST_ID,
    nombrePoissons: 180,
    poidsMoyenG: 56,
    nombreMorts: 2,
    vagueSource: { id: VAGUE_SRC_ID, code: "PG-2026-001", type: TypeVague.PRE_GROSSISSEMENT },
    vagueDest: { id: VAGUE_DEST_ID, code: "G-2026-001", type: TypeVague.GROSSISSEMENT },
    bacSource: { id: BAC_SRC_ID, nom: "Bac Source" },
    bacDest: { id: BAC_DEST_ID, nom: "Bac Dest" },
    modifications: [],
  };

  function setupUpdateHappyPath() {
    mockTransfertGroupeFindFirst.mockResolvedValue(fakeGroupe);

    // Étape 4a : remettre sur source (increment)
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // Étape 4b : décrémenter dest (updateMany)
    // Étape 4c : annuler recalcul
    mockVagueUpdate.mockResolvedValue({});

    // Étape 5 : validation conservation après rollback
    mockAssignationBacFindMany.mockResolvedValue([
      { bacId: BAC_SRC_ID, nombreInitial: 1000, nombreActuel: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValue([]);
    mockVagueFindFirst.mockResolvedValue({ nombreInitial: 1000 });
    mockTransfertGroupeFindMany.mockResolvedValue([]);

    // Étape 6a : décrémenter source (R4)
    // (réutilise mockAssignationBacUpdateMany — second appel)
    mockAssignationBacUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // 4a increment src
      .mockResolvedValueOnce({ count: 1 }) // 4b decrement dest
      .mockResolvedValueOnce({ count: 1 }); // 6a decrement src nouveau

    // Étape 6b : incrémenter dest
    mockAssignationBacFindFirst.mockResolvedValue({ id: "ad-1" });
    mockAssignationBacUpdate.mockResolvedValue({});

    // Étape 6c : recalcul
    mockVagueFindUniqueOrThrow.mockResolvedValue({ nombreInitial: 500, poidsMoyenInitial: 60 });

    // Étape 7 : TransfertModification
    mockTransfertModificationCreate.mockResolvedValue({});

    // Étape 8 : update groupe + findUniqueOrThrow
    mockTransfertGroupeUpdate.mockResolvedValue({});
    mockTransfertGroupeFindUniqueOrThrow.mockResolvedValue(fakeGroupeUpdated);
  }

  it("TC22 — succès : update + crée TransfertModification + snapshot", async () => {
    setupUpdateHappyPath();

    const dto: UpdateTransfertGroupeDTO = {
      raison: "Correction du comptage",
      nombrePoissons: 180,
      poidsMoyenG: 56,
      nombreMorts: 2,
    };

    const result = await updateTransfertGroupe(SITE_ID, USER_ID, GROUPE_ID, dto);

    expect(result).toBeDefined();
    expect(mockTransfertModificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transfertGroupeId: GROUPE_ID,
          raison: "Correction du comptage",
          siteId: SITE_ID,
          snapshotAvant: expect.objectContaining({ nombrePoissons: 200 }),
          snapshotApres: expect.objectContaining({ nombrePoissons: 180 }),
        }),
      })
    );
    expect(mockTransfertGroupeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: GROUPE_ID } })
    );
  });

  it("TC23 — Erreur : vague source TERMINEE", async () => {
    mockTransfertGroupeFindFirst.mockResolvedValue({
      ...fakeGroupe,
      vagueSource: { ...fakeGroupe.vagueSource, statut: StatutVague.TERMINEE },
    });

    const dto: UpdateTransfertGroupeDTO = { raison: "Test", nombrePoissons: 100 };

    await expect(updateTransfertGroupe(SITE_ID, USER_ID, GROUPE_ID, dto)).rejects.toThrow(
      /Modification impossible.*n'est pas EN_COURS/
    );
  });

  it("TC24 — Erreur : conservation violée par les nouvelles valeurs", async () => {
    mockTransfertGroupeFindFirst.mockResolvedValue(fakeGroupe);
    // Étapes 4a, 4b, 4c (rollback)
    mockAssignationBacUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mockVagueUpdate.mockResolvedValue({});
    // Étape 5 : seulement 1000 vivants après rollback (après remise)
    mockAssignationBacFindMany.mockResolvedValue([
      { bacId: BAC_SRC_ID, nombreInitial: 1000, nombreActuel: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValue([]);
    mockVagueFindFirst.mockResolvedValue({ nombreInitial: 1000 });
    mockTransfertGroupeFindMany.mockResolvedValue([]);

    // Nouvelles valeurs : 5000 poissons (violation)
    const dto: UpdateTransfertGroupeDTO = { raison: "Test", nombrePoissons: 5000 };

    await expect(updateTransfertGroupe(SITE_ID, USER_ID, GROUPE_ID, dto)).rejects.toThrow(
      /Conservation violée/
    );
  });

  it("TC25 — Cross-site : refuse si transfert.siteId ≠ siteId param", async () => {
    mockTransfertGroupeFindFirst.mockResolvedValue({
      ...fakeGroupe,
      transfert: { id: TRANSFERT_ID, siteId: "autre-site" },
    });

    const dto: UpdateTransfertGroupeDTO = { raison: "Test" };

    await expect(updateTransfertGroupe(SITE_ID, USER_ID, GROUPE_ID, dto)).rejects.toThrow(
      /Accès refusé/
    );
  });
});

// ---------------------------------------------------------------------------
// 7. getLineage
// ---------------------------------------------------------------------------

describe("getLineage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("TC26 — retourne lineage avec 0 parent (vague sans transfert entrant)", async () => {
    mockTransfertGroupeFindMany.mockResolvedValue([]);

    const result = await getLineage(SITE_ID, VAGUE_DEST_ID);

    expect(result.vagueId).toBe(VAGUE_DEST_ID);
    expect(result.parents).toHaveLength(0);
  });

  it("TC27 — retourne lineage avec 1 niveau", async () => {
    // Niveau 0 → vague dest est fille de vague source (1 groupe)
    // Niveau 1 → vague source n'a pas de parents
    const groupe = {
      id: GROUPE_ID,
      vagueSourceId: VAGUE_SRC_ID,
      vagueDestId: VAGUE_DEST_ID,
      nombrePoissons: 200,
      poidsMoyenG: 55,
      nombreMorts: 0,
      vagueSource: { id: VAGUE_SRC_ID, code: "PG-2026-001" },
      transfert: { date: new Date("2026-05-01") },
    };

    mockTransfertGroupeFindMany
      .mockResolvedValueOnce([groupe]) // profondeur 0
      .mockResolvedValueOnce([]); // profondeur 1 : pas de parents de la source

    const result = await getLineage(SITE_ID, VAGUE_DEST_ID);

    expect(result.parents).toHaveLength(1);
    expect(result.parents[0].vagueSourceId).toBe(VAGUE_SRC_ID);
    expect(result.parents[0].nombrePoissons).toBe(200);
  });

  it("TC28 — retourne lineage récursif (2 niveaux)", async () => {
    // Grand-parent → Parent → Enfant
    const GRAND_PARENT_ID = "vague-grand-parent";
    const PARENT_ID = VAGUE_SRC_ID;
    const ENFANT_ID = VAGUE_DEST_ID;

    const groupeParentEnfant = {
      id: "g-pe",
      vagueSourceId: PARENT_ID,
      vagueDestId: ENFANT_ID,
      nombrePoissons: 200,
      poidsMoyenG: 55,
      nombreMorts: 0,
      vagueSource: { id: PARENT_ID, code: "Parent" },
      transfert: { date: new Date("2026-04-01") },
    };
    const groupeGrandParentParent = {
      id: "g-gpp",
      vagueSourceId: GRAND_PARENT_ID,
      vagueDestId: PARENT_ID,
      nombrePoissons: 500,
      poidsMoyenG: 40,
      nombreMorts: 0,
      vagueSource: { id: GRAND_PARENT_ID, code: "Grand-Parent" },
      transfert: { date: new Date("2026-03-01") },
    };

    mockTransfertGroupeFindMany
      .mockResolvedValueOnce([groupeParentEnfant]) // depth=0 : parents de ENFANT
      .mockResolvedValueOnce([groupeGrandParentParent]) // depth=1 : parents de PARENT
      .mockResolvedValueOnce([]); // depth=2 : parents de GRAND_PARENT (aucun)

    const result = await getLineage(SITE_ID, ENFANT_ID);

    expect(result.parents).toHaveLength(2);
    expect(result.parents[0].vagueSourceId).toBe(PARENT_ID);
    expect(result.parents[1].vagueSourceId).toBe(GRAND_PARENT_ID);
  });

  it("TC29 — s'arrête à maxDepth=5 sans throw", async () => {
    // Créer une chaîne circulaire de faux groupes pour tester la limite
    // Chaque niveau retourne un parent
    const makeGroupe = (srcId: string, destId: string, idx: number) => ({
      id: `g-${idx}`,
      vagueSourceId: srcId,
      vagueDestId: destId,
      nombrePoissons: 100,
      poidsMoyenG: 50,
      nombreMorts: 0,
      vagueSource: { id: srcId, code: `V-${idx}` },
      transfert: { date: new Date("2026-01-01") },
    });

    // 5 niveaux de parents successifs
    mockTransfertGroupeFindMany
      .mockResolvedValueOnce([makeGroupe("v-1", "v-0", 1)])
      .mockResolvedValueOnce([makeGroupe("v-2", "v-1", 2)])
      .mockResolvedValueOnce([makeGroupe("v-3", "v-2", 3)])
      .mockResolvedValueOnce([makeGroupe("v-4", "v-3", 4)])
      .mockResolvedValueOnce([makeGroupe("v-5", "v-4", 5)]);
    // depth=5 atteint → stop (retourne [] sans appel supplémentaire)

    const result = await getLineage(SITE_ID, "v-0", 5);

    // Doit retourner exactement 5 parents (profondeurs 0-4) et s'arrêter à 5
    expect(result.parents).toHaveLength(5);
    // Le 6ème niveau ne doit pas être appelé
    expect(mockTransfertGroupeFindMany).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// 8. canDeleteVague
// ---------------------------------------------------------------------------

describe("canDeleteVague", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("TC30 — retourne { canDelete: true } si aucun transfert", async () => {
    mockTransfertGroupeCount
      .mockResolvedValueOnce(0) // asSource
      .mockResolvedValueOnce(0); // asDest

    const result = await canDeleteVague(SITE_ID, VAGUE_SRC_ID);

    expect(result).toEqual({ canDelete: true });
  });

  it("TC31 — retourne { canDelete: false, reason } si transferts sortants", async () => {
    mockTransfertGroupeCount
      .mockResolvedValueOnce(3) // asSource : 3 transferts sortants
      .mockResolvedValueOnce(0); // asDest

    const result = await canDeleteVague(SITE_ID, VAGUE_SRC_ID);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain("3");
    expect(result.reason).toContain("source");
  });

  it("TC32 — retourne { canDelete: false, reason } si transferts entrants", async () => {
    mockTransfertGroupeCount
      .mockResolvedValueOnce(0) // asSource
      .mockResolvedValueOnce(2); // asDest : 2 transferts entrants

    const result = await canDeleteVague(SITE_ID, VAGUE_DEST_ID);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain("2");
    expect(result.reason).toContain("destination");
  });

  it("TC30b — filtre par siteId dans les deux requêtes count", async () => {
    mockTransfertGroupeCount.mockResolvedValue(0);

    await canDeleteVague(SITE_ID, VAGUE_SRC_ID);

    expect(mockTransfertGroupeCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ transfert: { siteId: SITE_ID } }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 9. CS.2 — createTransfert crée 2 relevés TRANSFERT par groupe (source + dest miroir)
// ---------------------------------------------------------------------------

describe("CS.2 — createTransfert crée relevé TRANSFERT miroir côté destination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // GV.1-GV.2 — TransfertGroupe de la vague source par défaut (pas de chaîne de transferts)
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    // Default pour les appels supplémentaires (guard verifyAssignationInvariant — GD.1)
    mockAssignationBacFindMany.mockResolvedValue([]);
  });

  it("TC33 — createTransfert crée un relevé TRANSFERT côté source et un miroir côté dest", async () => {
    // Happy path Mode A avec bacSourceId renseigné
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null); // code non pris
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 }])
      .mockResolvedValueOnce([{ nombreActuel: 800 }]);
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" }) // étape 6
      .mockResolvedValueOnce({ id: "ad-1" }); // étape 9
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 200 }));

    // Relevé TRANSFERT côté SOURCE
    const transfertSourceCall = mockReleveCreate.mock.calls.find(
      (call) =>
        call[0]?.data?.typeReleve === TypeReleve.TRANSFERT &&
        call[0]?.data?.vagueId === VAGUE_SRC_ID
    );
    expect(transfertSourceCall).toBeDefined();
    expect(transfertSourceCall![0].data).toMatchObject({
      typeReleve: TypeReleve.TRANSFERT,
      vagueId: VAGUE_SRC_ID,
      bacId: BAC_SRC_ID,
      nombreTransferes: 200,
      siteId: SITE_ID,
    });

    // Relevé TRANSFERT miroir côté DESTINATION
    const transfertDestCall = mockReleveCreate.mock.calls.find(
      (call) =>
        call[0]?.data?.typeReleve === TypeReleve.TRANSFERT &&
        call[0]?.data?.vagueId === VAGUE_DEST_ID
    );
    expect(transfertDestCall).toBeDefined();
    expect(transfertDestCall![0].data).toMatchObject({
      typeReleve: TypeReleve.TRANSFERT,
      vagueId: VAGUE_DEST_ID,
      bacId: BAC_DEST_ID,
      nombreTransferes: 200,
      notes: "Arrivage par transfert",
      siteId: SITE_ID,
    });
  });

  it("TC34 — les deux relevés TRANSFERT partagent le même transfertGroupeId", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(null);
    mockVagueCreate.mockResolvedValue({ id: VAGUE_DEST_ID });
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 }])
      .mockResolvedValueOnce([{ nombreActuel: 800 }]);
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" })
      .mockResolvedValueOnce({ id: "ad-1" });
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 0, poidsMoyenInitial: 0 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    await createTransfert(SITE_ID, USER_ID, makeModeADto({ nombrePoissons: 200 }));

    const transfertCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.TRANSFERT
    );

    // Il doit y avoir exactement 2 relevés TRANSFERT (source + miroir dest)
    expect(transfertCalls.length).toBe(2);

    // Les deux doivent partager le même transfertGroupeId
    const groupeIdSource = transfertCalls[0][0].data.transfertGroupeId;
    const groupeIdDest = transfertCalls[1][0].data.transfertGroupeId;
    expect(groupeIdSource).toBeDefined();
    expect(groupeIdDest).toBeDefined();
    expect(groupeIdSource).toBe(groupeIdDest);
  });

  it("TC35 — le relevé miroir dest a vagueId = vagueDestId et bacId = bacDestId", async () => {
    mockVagueFindMany.mockResolvedValue([vaguePreGross]);
    mockVagueFindFirst.mockResolvedValue(vagueGross); // Mode B
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ ...assignationSrc, nombreActuel: 1000, nombreInitial: 1000 }])
      .mockResolvedValueOnce([{ nombreActuel: 800 }]);
    mockReleveFindMany.mockResolvedValue([]);
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "ad-1" })
      .mockResolvedValueOnce({ id: "ad-1" });
    mockTransfertCreate.mockResolvedValue({ id: TRANSFERT_ID });
    mockTransfertFindUniqueOrThrow.mockResolvedValue(fakeTransfertWithGroupes);
    mockVagueFindUniqueOrThrow.mockResolvedValue({ id: VAGUE_DEST_ID, nombreInitial: 500, poidsMoyenInitial: 60 });
    mockVagueUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});

    await createTransfert(SITE_ID, USER_ID, makeModeBDto({ nombrePoissons: 200 }));

    const mirrorCall = mockReleveCreate.mock.calls.find(
      (call) =>
        call[0]?.data?.typeReleve === TypeReleve.TRANSFERT &&
        call[0]?.data?.vagueId === VAGUE_DEST_ID &&
        call[0]?.data?.bacId === BAC_DEST_ID
    );

    expect(mirrorCall).toBeDefined();
    expect(mirrorCall![0].data).toMatchObject({
      vagueId: VAGUE_DEST_ID,
      bacId: BAC_DEST_ID,
      nombreTransferes: 200,
    });
  });
});
