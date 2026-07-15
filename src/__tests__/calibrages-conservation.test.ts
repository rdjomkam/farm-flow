/**
 * Tests de conservation du calibrage — Story CG.1
 *
 * Verifie que :
 * - L'ecart entre vivants sources et saisi (redistribues + morts) est rejetė
 *   au-dela de la tolerance de 0.5 % (min 1).
 * - La suppression du fallback dangereux declenche ConservationError si
 *   computeVivantsByBac ne retourne pas de donnee pour un bac source.
 * - patchCalibrage respecte la meme logique.
 *
 * Incident prod : calibrage a accepte 2449 redistribues sur 5973 vivants
 * (ecart -3524). Ce cas doit maintenant etre rejete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalibrage, patchCalibrage } from "@/lib/queries/calibrages";
import { ConservationError } from "@/lib/errors";
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
    // GV.1-GV.2 — TransfertGroupe de la vague (appelé hors transaction, via prisma global)
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VAGUE_ID = "vague-1";
const BAC_SOURCE_ID = "bac-source-1";
const BAC_DEST_ID = "bac-dest-1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVague(nombreInitial = 5973) {
  return {
    id: VAGUE_ID,
    code: "V001",
    statut: StatutVague.EN_COURS,
    nombreInitial,
    poidsMoyenInitial: 50,
  };
}

function makeSourceAssignation(nombreActuel: number) {
  return [
    {
      id: "assign-1",
      bacId: BAC_SOURCE_ID,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      dateFin: null,
      nombreActuel,
      nombreInitial: nombreActuel,
      poidsMoyenInitial: 50,
      bac: { id: BAC_SOURCE_ID, nom: "Bac Source" },
    },
  ];
}

function makeComptageReleve(bacId: string, nombreCompte: number) {
  return [
    {
      bacId,
      typeReleve: TypeReleve.COMPTAGE,
      nombreMorts: null,
      nombreCompte,
      nombreVendus: null,
      nombreTransferes: null,
      date: new Date("2026-06-01"),
    },
  ];
}

function makeCreateDTO(redistribues: number, morts: number) {
  return {
    vagueId: VAGUE_ID,
    sourceBacIds: [BAC_SOURCE_ID],
    nombreMorts: morts,
    groupes: [
      {
        categorie: CategorieCalibrage.MOYEN,
        destinationBacId: BAC_DEST_ID,
        nombrePoissons: redistribues,
        poidsMoyen: 80,
      },
    ],
  };
}

/**
 * Configure les mocks pour un createCalibrage avec vivants = vivants.
 * La sequence des appels assignationBac.findMany est :
 *   1. sourceAssignations
 *   2. destAssignations
 *   3. allAssignationsVague (pour computeVivantsByBac)
 *   4. allBacsOfVagueRaw (pour snapshotAvant) — seulement si conservation OK
 */
function setupCreateMocks(vivants: number) {
  vi.resetAllMocks();
  // GV.1-GV.2 — TransfertGroupe de la vague par défaut (pas de chaîne de transferts)
  mockTransfertGroupeFindMany.mockResolvedValue([]);
  mockVagueFindFirst.mockResolvedValue(makeVague());
  mockAssignationBacFindMany
    .mockResolvedValueOnce(makeSourceAssignation(vivants))    // 1. sourceAssignations
    .mockResolvedValueOnce([{ bacId: BAC_DEST_ID }])          // 2. destAssignations
    .mockResolvedValueOnce([{ bacId: BAC_SOURCE_ID, nombreInitial: vivants }]) // 3. allAssignationsVague
    .mockResolvedValueOnce([                                   // 4. snapshotAvant
      { bacId: BAC_SOURCE_ID, nombreActuel: vivants, nombreInitial: vivants, poidsMoyenInitial: 50, bac: { id: BAC_SOURCE_ID, nom: "Bac Source" } },
    ])
    // 5. Guard: verifyAssignationInvariant.assignationBac.findMany (source + dest)
    .mockResolvedValueOnce([
      { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: vivants },
      { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: vivants, nombreInitial: 0 },
    ]);
  mockReleveFindMany
    .mockResolvedValueOnce(makeComptageReleve(BAC_SOURCE_ID, vivants)) // 3. computeVivantsByBac
    // 5. Guard: releve.findMany — COMPTAGE override donne vivants sur BAC_SOURCE, 0 sur BAC_DEST
    .mockResolvedValueOnce([
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
  mockTransfertGroupeFindMany.mockResolvedValue([]); // Guard: aucun transfert entrant
  mockAssignationBacFindFirst.mockResolvedValue({ id: "a-dest", nombreActuel: 0, nombreInitial: 0, poidsMoyenInitial: 0 });
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  mockAssignationBacUpdate.mockResolvedValue({});
  mockCalibrageCreate.mockResolvedValue({ id: "calibrage-ok" });
  mockCalibrageFindUniqueOrThrow.mockResolvedValue({ id: "calibrage-ok", vague: { id: VAGUE_ID, code: "V001" }, user: { id: USER_ID, name: "Admin" }, groupes: [] });
  mockReleveCreate.mockResolvedValue({});
}

// ---------------------------------------------------------------------------
// createCalibrage — conservation stricte
// ---------------------------------------------------------------------------

describe("createCalibrage — conservation stricte", () => {
  it("rejette 2449 redistribues + 0 morts sur 5973 vivants (ecart -3524)", async () => {
    setupCreateMocks(5973);
    const err = await createCalibrage(SITE_ID, USER_ID, makeCreateDTO(2449, 0)).catch((e) => e);
    expect(err).toBeInstanceOf(ConservationError);
    expect(err.sourcesTotal).toBe(5973);
    expect(err.saisiTotal).toBe(2449);
    expect(err.ecart).toBe(-3524);
  });

  it("accepte 5973 redistribues + 0 morts sur 5973 vivants (ecart 0)", async () => {
    setupCreateMocks(5973);
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(5973, 0))
    ).resolves.toBeDefined();
  });

  it("accepte 5943 redistribues + 30 morts sur 5973 vivants (ecart exact 0)", async () => {
    setupCreateMocks(5973);
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(5943, 30))
    ).resolves.toBeDefined();
  });

  it("accepte 5963 redistribues + 10 morts sur 5973 (saisi 5973, ecart 0)", async () => {
    // 5963 + 10 = 5973 = sources → ecart 0 → OK
    setupCreateMocks(5973);
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(5963, 10))
    ).resolves.toBeDefined();
  });

  it("rejette 5900 redistribues + 10 morts sur 5973 (ecart -63, > tolerance 30)", async () => {
    // tolerance = max(1, round(5973 * 0.005)) = 30 ; saisi = 5910 ; ecart = -63 ; 63 > 30 → rejet
    setupCreateMocks(5973);
    const err = await createCalibrage(SITE_ID, USER_ID, makeCreateDTO(5900, 10)).catch((e) => e);
    expect(err).toBeInstanceOf(ConservationError);
    expect(err.ecart).toBe(-63);
    expect(err.sourcesTotal).toBe(5973);
    expect(err.saisiTotal).toBe(5910);
  });

  it("rejette si bac source absent de allBacsVague (fallback supprime)", async () => {
    // allAssignationsVague ne contient PAS BAC_SOURCE_ID → vivantsByBac.get(BAC_SOURCE_ID) = undefined
    vi.resetAllMocks();
    // GV.1-GV.2 — TransfertGroupe de la vague par défaut (pas de chaîne de transferts)
    mockTransfertGroupeFindMany.mockResolvedValue([]);
    mockVagueFindFirst.mockResolvedValue(makeVague());
    mockAssignationBacFindMany
      .mockResolvedValueOnce(makeSourceAssignation(5973))   // 1. sourceAssignations
      .mockResolvedValueOnce([{ bacId: BAC_DEST_ID }])      // 2. destAssignations
      // 3. allAssignationsVague — NE contient PAS BAC_SOURCE_ID → Map.get retournera undefined
      .mockResolvedValueOnce([{ bacId: "bac-autre", nombreInitial: 100 }]);
    mockReleveFindMany.mockResolvedValue([]);

    const err = await createCalibrage(SITE_ID, USER_ID, makeCreateDTO(5973, 0)).catch((e) => e);
    expect(err).toBeInstanceOf(ConservationError);
    expect(err.message).toContain("Impossible de calculer les vivants");
  });
});

// ---------------------------------------------------------------------------
// patchCalibrage — conservation stricte
// ---------------------------------------------------------------------------

describe("patchCalibrage — conservation stricte", () => {
  const CALIBRAGE_ID = "calibrage-1";

  /** ancienCalibrage : 5943 redistribues + 30 morts = 5973 total source */
  const ancienCalibrage = {
    id: CALIBRAGE_ID,
    sourceBacIds: [BAC_SOURCE_ID],
    nombreMorts: 30,
    notes: null,
    date: new Date("2026-06-10"),
    modifie: false,
    snapshotAvant: null,
    snapshotAvantModif: null,
    vague: { id: VAGUE_ID, statut: StatutVague.EN_COURS },
    groupes: [
      {
        id: "grp-1",
        categorie: CategorieCalibrage.MOYEN,
        destinationBacId: BAC_DEST_ID,
        destinationBac: { id: BAC_DEST_ID, nom: "Bac Dest" },
        nombrePoissons: 5943,
        poidsMoyen: 80,
        tailleMoyenne: null,
      },
    ],
  };

  /**
   * Configure les mocks pour patchCalibrage avec les nouveaux groupes fournis.
   * totalSourcePoissons = ancienCalibrage.groupes.sum + ancienCalibrage.nombreMorts = 5943 + 30 = 5973
   */
  function setupPatchMocks() {
    vi.resetAllMocks();
    mockCalibrageFindFirst
      .mockResolvedValueOnce(ancienCalibrage)  // Etape 1 fetch calibrage
      .mockResolvedValue({                     // Etape 9d fetch updated calibrage
        id: CALIBRAGE_ID,
        vague: { id: VAGUE_ID, code: "V001" },
        user: { id: USER_ID, name: "Admin" },
        groupes: [],
        modifications: [
          {
            id: "mod-1",
            calibrageId: CALIBRAGE_ID,
            userId: USER_ID,
            raison: "test",
            champModifie: "groupes",
            ancienneValeur: null,
            nouvelleValeur: null,
            createdAt: new Date(),
            user: { id: USER_ID, name: "Admin" },
          },
        ],
      });

    // Appels assignationBac.findMany dans patchCalibrage (quand groupes modifies) :
    // Call 1 : Etape 5 destAssignationsPatch — verifie que les bacs dest appartiennent a la vague
    // Call 2 : Etape 5b allAssignationsVagueModif — snapshot avec bac inclus
    // Call 3 : Guard post-écriture — verifyAssignationInvariant
    mockAssignationBacFindMany
      .mockResolvedValueOnce([{ bacId: BAC_DEST_ID }])  // Call 1: Etape 5 destAssignationsPatch
      .mockResolvedValueOnce([                          // Call 2: Etape 5b allAssignationsVagueModif
        {
          bacId: BAC_SOURCE_ID,
          nombreActuel: 0,
          nombreInitial: 5973,
          poidsMoyenInitial: 50,
          bac: { id: BAC_SOURCE_ID, nom: "Bac Source" },
        },
      ])
      // Call 3: Guard assignationBac.findMany — COMPTAGE override aligne nombreActuel
      .mockResolvedValueOnce([
        { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: 5973, dateAssignation: null },
        { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: 5943, nombreInitial: 0, dateAssignation: null },
      ]);

    // Etape 6b : findFirst bac dest pour decrement
    // Etape 6c : findFirst bac source pour restore
    // Etape 7 pass 2 : findFirst bac dest pour nouveau dispatch
    mockAssignationBacFindFirst
      .mockResolvedValueOnce({ id: "a-dest", nombreActuel: 5943 }) // 6b
      .mockResolvedValueOnce({ id: "a-src", nombreActuel: 0 })     // 6c
      .mockResolvedValueOnce({ id: "a-dest2", nombreActuel: 0 });  // 7 pass 2

    mockAssignationBacUpdate.mockResolvedValue({});
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockReleveDeleteMany.mockResolvedValue({ count: 0 });
    mockReleveCreate.mockResolvedValue({});
    mockReleveUpdateMany.mockResolvedValue({ count: 0 });
    mockCalibrageUpdate.mockResolvedValue({});
    mockCalibrageGroupeDeleteMany.mockResolvedValue({ count: 1 });
    mockCalibrageModificationCreateMany.mockResolvedValue({ count: 1 });
    // snapshotAvantModif : vagueForSnapshot
    mockVagueFindFirst.mockResolvedValue(makeVague());
    // Guard releve.findMany — COMPTAGE override aligne nombreActuel
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
        nombreCompte: 5943,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValue([]); // Guard: aucun transfert entrant
  }

  it("rejette 2449 redistribues + 0 morts lors d'un patch (sources = 5973)", async () => {
    setupPatchMocks();
    const err = await patchCalibrage(
      SITE_ID,
      USER_ID,
      CALIBRAGE_ID,
      {
        groupes: [
          {
            categorie: CategorieCalibrage.MOYEN,
            destinationBacId: BAC_DEST_ID,
            nombrePoissons: 2449,
            poidsMoyen: 80,
          },
        ],
        nombreMorts: 0,
      },
      "Correction test conservation"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ConservationError);
    expect(err.sourcesTotal).toBe(5973);
    expect(err.saisiTotal).toBe(2449);
    expect(err.ecart).toBe(-3524);
  });

  it("accepte 5943 redistribues + 30 morts lors d'un patch (ecart exact 0)", async () => {
    setupPatchMocks();
    // On change seulement le poidsMoyen pour qu'un vrai changement soit detecte
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
              nombrePoissons: 5943,
              poidsMoyen: 100, // changement reel vs 80
            },
          ],
          nombreMorts: 30,
        },
        "Correction poids moyen"
      )
    ).resolves.toBeDefined();
  });
});
