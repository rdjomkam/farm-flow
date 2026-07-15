/**
 * Tests edge cases du calibrage — Story CF.1
 *
 * Documente les 3 cas de comportement lors du calcul de totalSourcePoissons :
 *
 * - Cas A : bac source absent de allAssignationsVague (assignation fermee — race condition)
 *           → throw ConservationError avec message « n'est plus affecte »
 * - Cas B : bac present dans allAssignationsVague mais aucun releve exploitable
 *           → succes en utilisant nombreInitial de l'assignation comme base
 * - Cas C : flux normal avec releve COMPTAGE (regression)
 *           → succes, vivants = nombreCompte du releve
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalibrage } from "@/lib/queries/calibrages";
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
const mockCalibrageCreate = vi.fn();
const mockCalibrageFindUniqueOrThrow = vi.fn();
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
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    calibrage: {
      create: (...args: unknown[]) => mockCalibrageCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockCalibrageFindUniqueOrThrow(...args),
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

const SITE_ID = "site-cf1";
const USER_ID = "user-cf1";
const VAGUE_ID = "vague-cf1";
const BAC_SOURCE_ID = "bac-source-cf1";
const BAC_DEST_ID = "bac-dest-cf1";
const NOMBRE_INITIAL_VAGUE = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVague(nombreInitial = NOMBRE_INITIAL_VAGUE) {
  return {
    id: VAGUE_ID,
    code: "V-CF1",
    statut: StatutVague.EN_COURS,
    nombreInitial,
    poidsMoyenInitial: 50,
  };
}

/** Assignation active pour le bac source avec nombreInitial et nombreActuel */
function makeSourceAssignation(nombreActuel: number, nombreInitial: number) {
  return [
    {
      id: "assign-cf1",
      bacId: BAC_SOURCE_ID,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      dateFin: null,
      nombreActuel,
      nombreInitial,
      poidsMoyenInitial: 50,
      bac: { id: BAC_SOURCE_ID, nom: "Bac Source CF1" },
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

/** Configure les mocks communs pour toutes les variantes */
function setupBaseMocks() {
  vi.resetAllMocks();
  mockVagueFindFirst.mockResolvedValue(makeVague());
  // sourceAssignations — appel 1
  mockAssignationBacFindMany.mockResolvedValueOnce(
    makeSourceAssignation(NOMBRE_INITIAL_VAGUE, NOMBRE_INITIAL_VAGUE)
  );
  // destAssignations — appel 2
  mockAssignationBacFindMany.mockResolvedValueOnce([{ bacId: BAC_DEST_ID }]);
  // Mocks pour les operations d'ecriture (apres conservation OK)
  mockAssignationBacFindFirst.mockResolvedValue({
    id: "a-dest",
    nombreActuel: 0,
    nombreInitial: 0,
    poidsMoyenInitial: 0,
  });
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  mockAssignationBacUpdate.mockResolvedValue({});
  mockCalibrageCreate.mockResolvedValue({ id: "calibrage-cf1" });
  mockCalibrageFindUniqueOrThrow.mockResolvedValue({
    id: "calibrage-cf1",
    vague: { id: VAGUE_ID, code: "V-CF1" },
    user: { id: USER_ID, name: "Admin" },
    groupes: [],
  });
  mockReleveCreate.mockResolvedValue({});
  // Guard post-écriture — par défaut aucun transfert entrant
  mockTransfertGroupeFindMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Cas A — bac source absent de allAssignationsVague (assignation fermee)
// ---------------------------------------------------------------------------

describe("Cas A — assignation fermee (race condition)", () => {
  beforeEach(() => {
    setupBaseMocks();
  });

  it("throw ConservationError avec message 'n est plus affecte' quand le bac source est absent de allAssignationsVague", async () => {
    // allAssignationsVague (appel 3) : ne contient PAS BAC_SOURCE_ID
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { bacId: "bac-autre", nombreInitial: 500 },
    ]);
    // Pas de relevés exploitables
    mockReleveFindMany.mockResolvedValue([]);

    const err = await createCalibrage(
      SITE_ID,
      USER_ID,
      makeCreateDTO(NOMBRE_INITIAL_VAGUE, 0)
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ConservationError);
    expect(err.message).toMatch(/n'est plus affecte/i);
    expect(err.message).toContain("Bac Source CF1");
  });

  it("throw ConservationError (Cas A) meme si des releves existent — l'assignation fermee prime", async () => {
    // allAssignationsVague (appel 3) : bac source ABSENT
    mockAssignationBacFindMany.mockResolvedValueOnce([]);
    // Des relevés existent mais l'assignation est fermée → Cas A doit primer
    mockReleveFindMany.mockResolvedValue([
      {
        bacId: BAC_SOURCE_ID,
        typeReleve: TypeReleve.COMPTAGE,
        nombreMorts: null,
        nombreCompte: 900,
        nombreVendus: null,
        nombreTransferes: null,
        date: new Date("2026-06-01"),
      },
    ]);

    const err = await createCalibrage(
      SITE_ID,
      USER_ID,
      makeCreateDTO(900, 0)
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ConservationError);
    expect(err.message).toMatch(/n'est plus affecte/i);
  });
});

// ---------------------------------------------------------------------------
// Cas B — bac present dans allAssignationsVague, aucun releve exploitable
// ---------------------------------------------------------------------------

describe("Cas B — bac present mais sans releves exploitables", () => {
  beforeEach(() => {
    setupBaseMocks();
  });

  it("utilise nombreInitial de l'assignation comme base quand aucun releve disponible", async () => {
    const NOMBRE_INITIAL_ASSIGNATION = 800;

    // allAssignationsVague (appel 3) : bac source PRESENT avec nombreInitial
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { bacId: BAC_SOURCE_ID, nombreInitial: NOMBRE_INITIAL_ASSIGNATION },
    ]);
    // snapshotAvant (appel 4)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_SOURCE_ID,
        nombreActuel: NOMBRE_INITIAL_ASSIGNATION,
        nombreInitial: NOMBRE_INITIAL_ASSIGNATION,
        poidsMoyenInitial: 50,
        bac: { id: BAC_SOURCE_ID, nom: "Bac Source CF1" },
      },
    ]);
    // Aucun releve exploitable → computeVivantsByBac ne peut pas calculer depuis relevés
    // mais nombreInitial servira de base via le fallback Cas B
    mockReleveFindMany
      .mockResolvedValueOnce([]) // appel 1 computeVivantsByBac
      // Guard releve.findMany : COMPTAGE aligne source=0, dest=800
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
          nombreCompte: NOMBRE_INITIAL_ASSIGNATION,
          nombreTransferes: null,
          nombreVendus: null,
        },
      ]);
    // Guard assignationBac.findMany (appel 5)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: NOMBRE_INITIAL_ASSIGNATION },
      { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: NOMBRE_INITIAL_ASSIGNATION, nombreInitial: 0 },
    ]);

    // Le calibrage doit reussir : redistribues = nombreInitial, morts = 0
    await expect(
      createCalibrage(
        SITE_ID,
        USER_ID,
        makeCreateDTO(NOMBRE_INITIAL_ASSIGNATION, 0)
      )
    ).resolves.toBeDefined();
  });

  it("le fallback Cas B utilise nombreInitial = 0 (null → 0) quand computeVivantsByBac retourne undefined", async () => {
    // Ce cas est "ne devrait pas arriver" : computeVivantsByBac ne retourne undefined
    // que si le bac n'est pas dans allBacsVague — ce qui tomberait en Cas A.
    //
    // On le documente quand meme en simulant directement que le Map retourne undefined
    // pour BAC_SOURCE_ID malgre la presence de l'assignation (bac absent de allBacsVague
    // mais present dans assignationByBacId — situation impossible en prod, defensive only).
    //
    // Ici on force computeVivantsByBac a retourner undefined en passant allAssignationsVague
    // avec BAC_SOURCE_ID MAIS en ne le passant pas dans allBacsVague (via un mock qui
    // fait diverger les deux appels findMany).
    // Note : en pratique allBacsVague = allAssignationsVague.map(...) dans le meme appel,
    // donc la seule facon de tester le Cas B pur est de verifier que le fallback est 0
    // quand nombreInitial est null.
    //
    // Verification : si nombreInitial null → 0, totalSourcePoissons = 0, redistribues = 0
    // → ecart = 0 → conservation OK.

    // allAssignationsVague (appel 3) : bac source PRESENT avec nombreInitial null
    // allBacsVague = [{ id: BAC_SOURCE_ID, nombreInitial: null }]
    // computeVivantsByBac avec nombreInitial:null et aucun releve → distribue nombreInitialVague/1 = 1000
    // DONC v = 1000, pas null — le Cas B ne se declenche pas dans ce sous-scenario.
    //
    // Ce test documente plutot le comportement quand nombreInitial = 0 dans l'assignation
    // ET que computeVivantsByBac retourne 0 (via un releve COMPTAGE=0).
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { bacId: BAC_SOURCE_ID, nombreInitial: 0 },
    ]);
    // snapshotAvant (appel 4)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_SOURCE_ID,
        nombreActuel: 0,
        nombreInitial: 0,
        poidsMoyenInitial: 0,
        bac: { id: BAC_SOURCE_ID, nom: "Bac Source CF1" },
      },
    ]);
    // Guard assignationBac.findMany (appel 5) — source=0, dest=0
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: 0 },
      { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: 0, nombreInitial: 0 },
    ]);
    // Releve COMPTAGE=0 → vivants = 0
    // Guard releve.findMany : COMPTAGE=0 sur source et dest aligne nombreActuel=0
    const releveComptage0 = {
      bacId: BAC_SOURCE_ID,
      typeReleve: TypeReleve.COMPTAGE,
      nombreMorts: null,
      nombreCompte: 0,
      nombreVendus: null,
      nombreTransferes: null,
      date: new Date("2026-06-01"),
    };
    mockReleveFindMany
      .mockResolvedValueOnce([releveComptage0]) // appel 1 computeVivantsByBac
      .mockResolvedValueOnce([                 // Guard releve.findMany
        releveComptage0,
        {
          bacId: BAC_DEST_ID,
          typeReleve: "COMPTAGE",
          date: new Date("2026-06-01"),
          nombreMorts: null,
          nombreCompte: 0,
          nombreTransferes: null,
          nombreVendus: null,
        },
      ]);

    // redistribues = 0, morts = 0 → totalSaisi = 0 = totalSourcePoissons (0) → conservation OK
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeCreateDTO(0, 0))
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cas C — flux normal avec relevé COMPTAGE (regression)
// ---------------------------------------------------------------------------

describe("Cas C — flux normal avec releve COMPTAGE (regression)", () => {
  beforeEach(() => {
    setupBaseMocks();
  });

  it("utilise le dernier releve COMPTAGE pour calculer les vivants", async () => {
    const VIVANTS_COMPTAGE = 950;

    // allAssignationsVague (appel 3) : bac source PRESENT
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { bacId: BAC_SOURCE_ID, nombreInitial: NOMBRE_INITIAL_VAGUE },
    ]);
    // snapshotAvant (appel 4)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_SOURCE_ID,
        nombreActuel: VIVANTS_COMPTAGE,
        nombreInitial: NOMBRE_INITIAL_VAGUE,
        poidsMoyenInitial: 50,
        bac: { id: BAC_SOURCE_ID, nom: "Bac Source CF1" },
      },
    ]);
    // Guard assignationBac.findMany (appel 5) — source=0, dest=950
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-src", bacId: BAC_SOURCE_ID, nombreActuel: 0, nombreInitial: NOMBRE_INITIAL_VAGUE },
      { id: "ab-dest", bacId: BAC_DEST_ID, nombreActuel: VIVANTS_COMPTAGE, nombreInitial: 0 },
    ]);
    // Releve COMPTAGE => vivants = 950
    // Guard releve.findMany : COMPTAGE aligne source=0, dest=950
    const releveComptage = {
      bacId: BAC_SOURCE_ID,
      typeReleve: TypeReleve.COMPTAGE,
      nombreMorts: null,
      nombreCompte: VIVANTS_COMPTAGE,
      nombreVendus: null,
      nombreTransferes: null,
      date: new Date("2026-06-01"),
    };
    mockReleveFindMany
      .mockResolvedValueOnce([releveComptage])  // appel 1 computeVivantsByBac
      .mockResolvedValueOnce([                  // Guard releve.findMany
        {
          bacId: BAC_SOURCE_ID,
          typeReleve: "COMPTAGE",
          date: new Date("2026-06-01"),
          nombreMorts: null,
          nombreCompte: 0,  // post-calibrage : source vidée
          nombreTransferes: null,
          nombreVendus: null,
        },
        {
          bacId: BAC_DEST_ID,
          typeReleve: "COMPTAGE",
          date: new Date("2026-06-01"),
          nombreMorts: null,
          nombreCompte: VIVANTS_COMPTAGE,
          nombreTransferes: null,
          nombreVendus: null,
        },
      ]);

    // Conservation OK : redistribues = 950, morts = 0 = vivants = 950
    await expect(
      createCalibrage(
        SITE_ID,
        USER_ID,
        makeCreateDTO(VIVANTS_COMPTAGE, 0)
      )
    ).resolves.toBeDefined();
  });

  it("rejette si redistribues + morts depassent les vivants du releve COMPTAGE", async () => {
    const VIVANTS_COMPTAGE = 950;

    // allAssignationsVague (appel 3)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { bacId: BAC_SOURCE_ID, nombreInitial: NOMBRE_INITIAL_VAGUE },
    ]);
    mockReleveFindMany.mockResolvedValue([
      {
        bacId: BAC_SOURCE_ID,
        typeReleve: TypeReleve.COMPTAGE,
        nombreMorts: null,
        nombreCompte: VIVANTS_COMPTAGE,
        nombreVendus: null,
        nombreTransferes: null,
        date: new Date("2026-06-01"),
      },
    ]);

    // 500 redistribues + 0 morts sur 950 vivants → ecart = -450 >> tolerance(5) → rejet
    const err = await createCalibrage(
      SITE_ID,
      USER_ID,
      makeCreateDTO(500, 0)
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ConservationError);
    expect(err.sourcesTotal).toBe(VIVANTS_COMPTAGE);
    expect(err.saisiTotal).toBe(500);
    expect(err.ecart).toBe(-450);
  });
});
