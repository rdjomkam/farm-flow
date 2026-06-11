/**
 * Tests de non-regression BUG-048 — Conservation du calibrage utilise computeVivantsByBac
 *
 * Verifie que la verification de conservation dans createCalibrage prend en compte
 * les mortalites enregistrees via des releves MORTALITE, et non simplement
 * Bac.nombrePoissons (qui n'est pas decremente par les mortalites — BUG-045).
 *
 * Scenario : un bac source a Bac.nombrePoissons = 5048, mais 44 mortalites
 * MORTALITE ont ete enregistrees. Vivants reels = 5004.
 * Un calibrage qui redistribue 5004 poissons doit etre accepte.
 * Un calibrage qui redistribue 5048 poissons doit etre rejete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalibrage } from "@/lib/queries/calibrages";
import { StatutVague, CategorieCalibrage } from "@/types";
import type { CreateCalibrageDTO } from "@/types";

const mockVagueFindFirst = vi.fn();
const mockBacFindMany = vi.fn();
const mockBacFindUnique = vi.fn();
const mockBacUpdate = vi.fn();
const mockBacUpdateMany = vi.fn();
const mockCalibrageCreate = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacUpdate = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();
const mockAssignationBacCreate = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveFindMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: { findFirst: (...args: unknown[]) => mockVagueFindFirst(...args) },
    bac: {
      findMany: (...args: unknown[]) => mockBacFindMany(...args),
      findUnique: (...args: unknown[]) => mockBacFindUnique(...args),
      update: (...args: unknown[]) => mockBacUpdate(...args),
      updateMany: (...args: unknown[]) => mockBacUpdateMany(...args),
    },
    calibrage: {
      create: (...args: unknown[]) => mockCalibrageCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockCalibrageCreate(...args),
    },
    assignationBac: {
      // ADR-043 Phase 3: findMany needed for source/dest/all bacs lookups
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
      update: (...args: unknown[]) => mockAssignationBacUpdate(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
      create: (...args: unknown[]) => mockAssignationBacCreate(...args),
    },
    releve: {
      create: (...args: unknown[]) => mockReleveCreate(...args),
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args as Parameters<typeof mockTransaction>),
  },
}));

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VAGUE_ID = "vague-1";
const BAC_SRC = "bac-src";
const BAC_DEST = "bac-dest";

const vagueEnCours = {
  id: VAGUE_ID,
  code: "V-2026-001",
  statut: StatutVague.EN_COURS,
  nombreInitial: 5048,
  poidsMoyenInitial: 50,
  siteId: SITE_ID,
};

const bacSource = {
  id: BAC_SRC,
  nom: "Bac source",
  volume: 1000,
  vagueId: VAGUE_ID,
  // BUG-045 : nombrePoissons n'est PAS decremente par les mortalites
  // → reste a 5048 meme apres 44 mortalites
  nombrePoissons: 5048,
  nombreInitial: 5048,
  poidsMoyenInitial: 50,
  siteId: SITE_ID,
};

const bacDest = {
  id: BAC_DEST,
  nom: "Bac dest",
  volume: 800,
  vagueId: VAGUE_ID,
  nombrePoissons: 0,
  nombreInitial: null,
  poidsMoyenInitial: null,
  siteId: SITE_ID,
};

/** AssignationBac active pour le bac source (nombreActuel = 5048, stale vs mortalites) */
const assignationBacSrc = {
  id: "assignation-src-001",
  bacId: BAC_SRC,
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  dateFin: null,
  nombreActuel: 5048,
  nombreInitial: 5048,
  poidsMoyenInitial: 50,
  bac: { id: BAC_SRC, nom: "Bac source" },
};

/** AssignationBac active pour le bac destination */
const assignationBacDest = {
  id: "assignation-dest-001",
  bacId: BAC_DEST,
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  dateFin: null,
  nombreActuel: 0,
  nombreInitial: null,
  poidsMoyenInitial: null,
  bac: { id: BAC_DEST, nom: "Bac dest" },
};

const fakeCalibrageCreated = {
  id: "calibrage-bug048",
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  userId: USER_ID,
  vague: { id: VAGUE_ID, code: "V-2026-001" },
  user: { id: USER_ID, name: "Test" },
  groupes: [],
};

/** Returns mortality releves totaling `nombreMorts` on the source bac */
function relevesAvecMortalites(nombreMorts: number) {
  return [
    {
      bacId: BAC_SRC,
      typeReleve: "MORTALITE",
      nombreMorts,
      nombreCompte: null,
      date: new Date("2026-04-01"),
    },
  ];
}

function makeDto(groupePoissons: number, nombreMorts = 0): CreateCalibrageDTO {
  return {
    vagueId: VAGUE_ID,
    sourceBacIds: [BAC_SRC],
    nombreMorts,
    groupes: [
      {
        categorie: CategorieCalibrage.MOYEN,
        destinationBacId: BAC_DEST,
        nombrePoissons: groupePoissons,
        poidsMoyen: 50,
        tailleMoyenne: null,
      },
    ],
    notes: null,
    date: "2026-05-01",
  };
}

function setupHappyPathMocks() {
  mockVagueFindFirst.mockResolvedValue(vagueEnCours);
  mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
  mockBacUpdateMany.mockResolvedValue({ count: 1 });
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  mockAssignationBacFindFirst.mockResolvedValue({ id: "a-1", nombreActuel: 0 });
  mockBacUpdate.mockResolvedValue({ ...bacDest, nombrePoissons: 5004 });
  mockAssignationBacUpdate.mockResolvedValue({ id: "a-1", nombreActuel: 5004 });
  mockReleveCreate.mockResolvedValue({});
}

/**
 * Configure mockAssignationBacFindMany pour les 4 appels dans createCalibrage :
 * 1. source validation
 * 2. dest validation
 * 3. all bacs for computeVivantsByBac (conservation)
 * 4. snapshot
 */
function setupAssignationBacFindMany() {
  mockAssignationBacFindMany
    .mockResolvedValueOnce([assignationBacSrc])                    // 1. source validation
    .mockResolvedValueOnce([{ bacId: BAC_DEST }])                  // 2. dest validation
    .mockResolvedValueOnce([{ bacId: BAC_SRC, nombreInitial: 5048 }]) // 3. vivants
    .mockResolvedValueOnce([assignationBacSrc, assignationBacDest]); // 4. snapshot
}

describe("createCalibrage — BUG-048 : conservation basee sur computeVivantsByBac", () => {
  beforeEach(() => {
    // resetAllMocks() vide aussi les queues mockResolvedValueOnce (clearAllMocks ne le fait pas)
    vi.resetAllMocks();
  });

  it("accepte un calibrage qui redistribue exactement les vivants reels (apres mortalites)", async () => {
    setupHappyPathMocks();
    // tx.assignationBac.findMany : sources, destinations, allBacsVague (vivants), snapshot
    setupAssignationBacFindMany();
    // 44 mortalites enregistrees → vivants = 5048 - 44 = 5004
    mockReleveFindMany.mockResolvedValue(relevesAvecMortalites(44));

    // Le DTO redistribue 5004 poissons → doit etre accepte
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto(5004))
    ).resolves.toBeDefined();
  });

  it("rejette un calibrage qui se base sur Bac.nombrePoissons stale (ignore les mortalites)", async () => {
    setupHappyPathMocks();
    setupAssignationBacFindMany();
    mockReleveFindMany.mockResolvedValue(relevesAvecMortalites(44));

    // Le DTO redistribue 5048 (valeur stale) → conservation doit rejeter
    // Sources = 5004, saisi = 5048, ecart = +44. Tolerance = max(1, round(5004*0.005)) = 25.
    // Ecart abs 44 > 25 → rejet (ConservationError CG.1, message mis a jour : "Sources :" au lieu de "Source :").
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto(5048))
    ).rejects.toThrow(/Conservation non respectee.*Sources : 5004/);
  });

  it("accepte un calibrage dont l'ecart est dans la tolerance de 0.5% (CG.1)", async () => {
    setupHappyPathMocks();
    setupAssignationBacFindMany();
    mockReleveFindMany.mockResolvedValue(relevesAvecMortalites(10));
    // vivants = 5048 - 10 = 5038. DTO : 5000 + 30 morts = 5030. Ecart = -8.
    // Tolerance = max(1, round(5038 * 0.005)) = max(1, 25) = 25. |ecart| 8 <= 25 → ACCEPTE.
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto(5000, 30))
    ).resolves.toBeDefined();
  });

  it("sans aucun releve, conservation se base sur nombreInitial (vivants = nombreInitial)", async () => {
    setupHappyPathMocks();
    setupAssignationBacFindMany();
    mockReleveFindMany.mockResolvedValue([]); // aucune mortalite

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto(5048))
    ).resolves.toBeDefined();
  });
});
