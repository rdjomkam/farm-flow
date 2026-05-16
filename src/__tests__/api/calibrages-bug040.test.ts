/**
 * Tests de non-régression BUG-040 — createCalibrage (src/lib/queries/calibrages.ts)
 *
 * Vérifie les deux fixes apportés dans calibrages.ts :
 *
 * Fix 4 — vérification d'appartenance à la vague via OR (Bac.vagueId OU AssignationBac active)
 *   Un bac source avec Bac.vagueId = null mais une AssignationBac active pour la vague
 *   doit passer la validation d'appartenance sans lever d'erreur.
 *
 * Fix 5 — create défensif d'AssignationBac si manquante pour bac destination
 *   Après createCalibrage, si le bac destination n'avait pas d'AssignationBac active,
 *   une doit avoir été créée avec nombrePoissons = total reçu.
 *
 * Stratégie : mock complet de prisma.$transaction exécutant le callback avec un tx mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCalibrage, patchCalibrage } from "@/lib/queries/calibrages";
import { StatutVague, CategorieCalibrage } from "@/types";
import type { CreateCalibrageDTO } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockBacFindMany = vi.fn();
const mockBacFindUnique = vi.fn();
const mockBacUpdate = vi.fn();
const mockBacUpdateMany = vi.fn();
const mockCalibrageCreate = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacUpdate = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();
const mockAssignationBacCreate = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveFindMany = vi.fn();

/** Simule prisma.$transaction en exécutant le callback avec un tx mock complet */
const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
    },
    bac: {
      findMany: (...args: unknown[]) => mockBacFindMany(...args),
      findUnique: (...args: unknown[]) => mockBacFindUnique(...args),
      update: (...args: unknown[]) => mockBacUpdate(...args),
      updateMany: (...args: unknown[]) => mockBacUpdateMany(...args),
    },
    calibrage: {
      create: (...args: unknown[]) => mockCalibrageCreate(...args),
    },
    assignationBac: {
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

// ---------------------------------------------------------------------------
// Données de test communes
// ---------------------------------------------------------------------------

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VAGUE_ID = "vague-1";

const vagueEnCours = {
  id: VAGUE_ID,
  code: "V-2025-001",
  statut: StatutVague.EN_COURS,
  nombreInitial: 500,
  poidsMoyenInitial: 50,
  siteId: SITE_ID,
};

/** Bac source : lié via AssignationBac uniquement (Bac.vagueId = null) */
const bacSourceViaAssignationOnly = {
  id: "bac-src-assignation",
  nom: "Source Assignation",
  volume: 1000,
  vagueId: null, // Pas de FK direct — présent uniquement via AssignationBac
  nombrePoissons: 200,
  nombreInitial: 200,
  poidsMoyenInitial: 50,
  siteId: SITE_ID,
};

/** Bac destination : lié via Bac.vagueId, sans AssignationBac active */
const bacDestSanAssignation = {
  id: "bac-dest-fk",
  nom: "Dest FK",
  volume: 800,
  vagueId: VAGUE_ID, // Lié via FK mais sans AssignationBac
  nombrePoissons: 0,
  nombreInitial: null,
  poidsMoyenInitial: null,
  siteId: SITE_ID,
};

/** Résultat calibrage minimal retourné par tx.calibrage.create */
const fakeCalibrageCreated = {
  id: "calibrage-001",
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  userId: USER_ID,
  nombreMorts: 0,
  date: new Date(),
  sourceBacIds: [bacSourceViaAssignationOnly.id],
  notes: null,
  snapshotAvant: {},
  vague: { id: VAGUE_ID, code: "V-2025-001" },
  user: { id: USER_ID, name: "Test" },
  groupes: [
    {
      id: "groupe-001",
      calibrageId: "calibrage-001",
      categorie: CategorieCalibrage.MOYEN,
      destinationBacId: bacDestSanAssignation.id,
      nombrePoissons: 200,
      poidsMoyen: 50,
      tailleMoyenne: null,
      destinationBac: { id: bacDestSanAssignation.id, nom: bacDestSanAssignation.nom },
    },
  ],
};

/** DTO de calibrage valide pour les tests */
function makeDto(overrides?: Partial<CreateCalibrageDTO>): CreateCalibrageDTO {
  return {
    vagueId: VAGUE_ID,
    sourceBacIds: [bacSourceViaAssignationOnly.id],
    nombreMorts: 0,
    groupes: [
      {
        categorie: CategorieCalibrage.MOYEN,
        destinationBacId: bacDestSanAssignation.id,
        nombrePoissons: 200,
        poidsMoyen: 50,
        tailleMoyenne: null,
      },
    ],
    notes: null,
    date: "2025-06-01",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — Fix 4 : vérification d'appartenance via OR
// ---------------------------------------------------------------------------

describe("createCalibrage — Fix 4 BUG-040 : bac source via AssignationBac accepté", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // BUG-048 : par defaut, pas de releves → vivants = nombreInitial des bacs
    mockReleveFindMany.mockResolvedValue([]);
  });

  it("accepte un bac source sans Bac.vagueId mais avec AssignationBac active pour la vague", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);

    // tx.bac.findMany est appelé 4 fois :
    //  1. vérification bacs sources (retourne le bac source)
    //  2. vérification bacs destination (retourne le bac dest)
    //  3. allBacsVague pour computeVivantsByBac (BUG-048)
    //  4. snapshot allBacsOfVague
    mockBacFindMany
      .mockResolvedValueOnce([bacSourceViaAssignationOnly]) // sources
      .mockResolvedValueOnce([bacDestSanAssignation])       // destinations
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestSanAssignation]) // BUG-048 vivants
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestSanAssignation]); // snapshot

    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // Pour le bac destination : pas d'AssignationBac existante → create défensif
    mockAssignationBacFindFirst.mockResolvedValue(null);
    mockBacFindUnique.mockResolvedValue({
      nombrePoissons: 0,
      nombreInitial: null,
      poidsMoyenInitial: null,
    });
    mockAssignationBacCreate.mockResolvedValue({
      id: "new-assignation",
      bacId: bacDestSanAssignation.id,
      vagueId: VAGUE_ID,
    });
    mockBacUpdate.mockResolvedValue({ ...bacDestSanAssignation, nombrePoissons: 200 });
    mockReleveCreate.mockResolvedValue({});

    // Ne doit pas lever d'erreur d'appartenance
    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto())
    ).resolves.toBeDefined();

    // Vérifier que la recherche des bacs sources utilise bien la clause OR (BUG-040 Fix 4)
    const sourceCall = mockBacFindMany.mock.calls[0][0];
    expect(sourceCall.where.OR).toBeDefined();
    expect(sourceCall.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ vagueId: VAGUE_ID }),
        expect.objectContaining({
          assignations: expect.objectContaining({
            some: expect.objectContaining({ vagueId: VAGUE_ID, dateFin: null }),
          }),
        }),
      ])
    );
  });

  it("accepte un bac destination sans Bac.vagueId mais avec AssignationBac active", async () => {
    // Bac destination lié uniquement via AssignationBac
    const bacDestAssignationOnly = {
      ...bacDestSanAssignation,
      vagueId: null, // pas de FK direct
    };

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany
      .mockResolvedValueOnce([bacSourceViaAssignationOnly]) // sources
      .mockResolvedValueOnce([bacDestAssignationOnly])      // destinations (trouvé via OR)
      .mockResolvedValueOnce([bacSourceViaAssignationOnly]) // BUG-048 vivants
      .mockResolvedValueOnce([bacSourceViaAssignationOnly]);

    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // AssignationBac existante pour le bac destination
    const existingAssignation = { id: "assignation-dest-001", nombreActuel: 0 };
    mockAssignationBacFindFirst.mockResolvedValue(existingAssignation);
    mockBacUpdate.mockResolvedValue({ ...bacDestAssignationOnly, nombrePoissons: 200 });
    mockAssignationBacUpdate.mockResolvedValue({ id: "assignation-dest-001", nombreActuel: 200 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockReleveCreate.mockResolvedValue({});

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto())
    ).resolves.toBeDefined();

    // Vérifier que la recherche des bacs destinations utilise aussi le OR (BUG-040 Fix 4)
    const destCall = mockBacFindMany.mock.calls[1][0];
    expect(destCall.where.OR).toBeDefined();
  });

  it("rejette un bac source qui n'appartient pas du tout à la vague (ni FK ni AssignationBac)", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // findMany retourne 0 bac → validation échoue
    mockBacFindMany.mockResolvedValueOnce([]); // sources introuvables

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto())
    ).rejects.toThrow(/n'appartiennent pas a cette vague/);
  });
});

// ---------------------------------------------------------------------------
// Tests — Fix 5 : create défensif d'AssignationBac
// ---------------------------------------------------------------------------

describe("createCalibrage — Fix 5 BUG-040 : create défensif AssignationBac manquante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // BUG-048 : par defaut, pas de releves → vivants = nombreInitial des bacs
    mockReleveFindMany.mockResolvedValue([]);
  });

  it("crée une AssignationBac pour un bac destination sans assignation préalable", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany
      .mockResolvedValueOnce([bacSourceViaAssignationOnly]) // sources
      .mockResolvedValueOnce([bacDestSanAssignation])       // destinations
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestSanAssignation]) // BUG-048 vivants
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestSanAssignation]); // snapshot

    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // Pas d'AssignationBac active pour le bac destination → doit déclencher create défensif
    mockAssignationBacFindFirst.mockResolvedValue(null);
    mockBacFindUnique.mockResolvedValue({
      nombrePoissons: 0,
      nombreInitial: null,
      poidsMoyenInitial: null,
    });
    const mockCreatedAssignation = {
      id: "new-assignation-defensive",
      bacId: bacDestSanAssignation.id,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      nombrePoissons: 200,
    };
    mockAssignationBacCreate.mockResolvedValue(mockCreatedAssignation);
    mockBacUpdate.mockResolvedValue({ ...bacDestSanAssignation, nombrePoissons: 200 });
    mockReleveCreate.mockResolvedValue({});

    await createCalibrage(SITE_ID, USER_ID, makeDto());

    // Vérifier que assignationBac.create a été appelé (create défensif)
    expect(mockAssignationBacCreate).toHaveBeenCalledTimes(1);

    // Vérifier les arguments du create défensif
    const createCall = mockAssignationBacCreate.mock.calls[0][0];
    expect(createCall.data.bacId).toBe(bacDestSanAssignation.id);
    expect(createCall.data.vagueId).toBe(VAGUE_ID);
    expect(createCall.data.siteId).toBe(SITE_ID);
    expect(createCall.data.dateFin).toBeNull();
    // nombreActuel = existant (0) + reçus (200) = 200
    expect(createCall.data.nombreActuel).toBe(200);
  });

  it("ne crée pas d'AssignationBac si une existe déjà pour le bac destination", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany
      .mockResolvedValueOnce([bacSourceViaAssignationOnly])
      .mockResolvedValueOnce([bacDestSanAssignation])
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestSanAssignation]) // BUG-048 vivants
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestSanAssignation]);

    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });

    // AssignationBac déjà existante pour le bac destination → pas de create défensif
    const existingAssignation = { id: "assignation-existing", nombreActuel: 50 };
    mockAssignationBacFindFirst.mockResolvedValue(existingAssignation);

    // Cas normal : update direct via assignationBac.update (pas create)
    mockAssignationBacUpdate.mockResolvedValue({ id: "assignation-existing", nombreActuel: 250 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockBacUpdate.mockResolvedValue({ ...bacDestSanAssignation, nombrePoissons: 250 });
    mockReleveCreate.mockResolvedValue({});

    await createCalibrage(SITE_ID, USER_ID, makeDto());

    // Le create défensif ne doit PAS être appelé
    expect(mockAssignationBacCreate).not.toHaveBeenCalled();
  });

  it("le create défensif utilise nombreActuel = (existant + total reçu)", async () => {
    // Bac destination avec 30 poissons existants + 200 reçus = 230
    const bacDestAvecPoissons = { ...bacDestSanAssignation, nombrePoissons: 30 };

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany
      .mockResolvedValueOnce([bacSourceViaAssignationOnly])
      .mockResolvedValueOnce([bacDestAvecPoissons])
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestAvecPoissons]) // BUG-048 vivants
      .mockResolvedValueOnce([bacSourceViaAssignationOnly, bacDestAvecPoissons]);

    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    mockAssignationBacFindFirst.mockResolvedValue(null);
    mockBacFindUnique.mockResolvedValue({
      nombrePoissons: 30, // valeur existante dans le bac
      nombreInitial: null,
      poidsMoyenInitial: null,
    });
    mockAssignationBacCreate.mockResolvedValue({ id: "new-def" });
    mockBacUpdate.mockResolvedValue({ ...bacDestAvecPoissons, nombrePoissons: 230 });
    mockReleveCreate.mockResolvedValue({});

    await createCalibrage(SITE_ID, USER_ID, makeDto());

    const createCall = mockAssignationBacCreate.mock.calls[0][0];
    // 30 (existants) + 200 (reçus du groupe) = 230
    expect(createCall.data.nombreActuel).toBe(230);
  });
});

// ---------------------------------------------------------------------------
// Tests — Réserve 2 (review BUG-040) : patchCalibrage étape 5 via OR
// ---------------------------------------------------------------------------

const mockCalibrageGrouepDeleteMany = vi.fn();
const mockCalibrageModificationCreateMany = vi.fn();
const mockCalibrageUpdate = vi.fn();
const mockCalibrageFindFirst = vi.fn();
const mockVagueFindFirstPatch = vi.fn();
const mockBacFindManyPatch = vi.fn();
const mockBacUpdatePatch = vi.fn();
const mockBacUpdateManyPatch = vi.fn();
const mockAssignationBacFindFirstPatch = vi.fn();
const mockAssignationBacUpdatePatch = vi.fn();
const mockAssignationBacUpdateManyPatch = vi.fn();
const mockReleveDeleteMany = vi.fn();
const mockReleveUpdateMany = vi.fn();
const mockReleveCreatePatch = vi.fn();
const mockRelEveFindMany = vi.fn();
const mockReleveUpdate = vi.fn();

/** Transaction mock pour patchCalibrage — plus complet que pour createCalibrage */
const mockTransactionPatch = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirstPatch(...args),
    },
    bac: {
      findMany: (...args: unknown[]) => mockBacFindManyPatch(...args),
      update: (...args: unknown[]) => mockBacUpdatePatch(...args),
      updateMany: (...args: unknown[]) => mockBacUpdateManyPatch(...args),
    },
    calibrage: {
      findFirst: (...args: unknown[]) => mockCalibrageFindFirst(...args),
      update: (...args: unknown[]) => mockCalibrageUpdate(...args),
    },
    calibrageGroupe: {
      deleteMany: (...args: unknown[]) => mockCalibrageGrouepDeleteMany(...args),
    },
    calibrageModification: {
      createMany: (...args: unknown[]) => mockCalibrageModificationCreateMany(...args),
    },
    assignationBac: {
      findFirst: (...args: unknown[]) => mockAssignationBacFindFirstPatch(...args),
      update: (...args: unknown[]) => mockAssignationBacUpdatePatch(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateManyPatch(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockRelEveFindMany(...args),
      create: (...args: unknown[]) => mockReleveCreatePatch(...args),
      update: (...args: unknown[]) => mockReleveUpdate(...args),
      updateMany: (...args: unknown[]) => mockReleveUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockReleveDeleteMany(...args),
    },
  };
  return fn(tx);
});

describe("patchCalibrage — Réserve 2 BUG-040 : bac destination via AssignationBac accepté à l'étape 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Remplacer la transaction par celle dédiée au patch
    mockTransaction.mockImplementation(mockTransactionPatch);
  });

  afterEach(() => {
    // Restaurer la transaction d'origine après chaque test
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        vague: { findFirst: (...args: unknown[]) => mockVagueFindFirst(...args) },
        bac: {
          findMany: (...args: unknown[]) => mockBacFindMany(...args),
          findUnique: (...args: unknown[]) => mockBacFindUnique(...args),
          update: (...args: unknown[]) => mockBacUpdate(...args),
          updateMany: (...args: unknown[]) => mockBacUpdateMany(...args),
        },
        calibrage: { create: (...args: unknown[]) => mockCalibrageCreate(...args) },
        assignationBac: {
          findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
          update: (...args: unknown[]) => mockAssignationBacUpdate(...args),
          updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
          create: (...args: unknown[]) => mockAssignationBacCreate(...args),
        },
        releve: { create: (...args: unknown[]) => mockReleveCreate(...args) },
      };
      return fn(tx);
    });
  });

  it("accepte un bac destination sans Bac.vagueId mais avec AssignationBac active — étape 5", async () => {
    // Bac destination sans FK directe (vagueId = null) mais présent via AssignationBac
    const bacDestViaAssignationOnly = {
      id: "bac-dest-assignation-only",
      nom: "Dest Assignation",
      volume: 900,
      vagueId: null, // pas de FK directe
      nombrePoissons: 0,
      siteId: SITE_ID,
    };

    // Calibrage existant à modifier
    const ancienCalibrage = {
      id: "calibrage-to-patch",
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      userId: USER_ID,
      nombreMorts: 0,
      date: new Date("2025-06-01"),
      sourceBacIds: [bacSourceViaAssignationOnly.id],
      notes: null,
      modifie: false,
      snapshotAvant: {},
      snapshotAvantModif: null,
      vague: { id: VAGUE_ID, statut: StatutVague.EN_COURS },
      groupes: [
        {
          id: "ancien-groupe-001",
          calibrageId: "calibrage-to-patch",
          categorie: CategorieCalibrage.MOYEN,
          destinationBacId: bacDestSanAssignation.id,
          nombrePoissons: 200,
          poidsMoyen: 50,
          tailleMoyenne: null,
          destinationBac: { id: bacDestSanAssignation.id, nom: bacDestSanAssignation.nom },
        },
      ],
    };

    // Calibrage mis à jour retourné après patch
    const updatedCalibrage = {
      ...ancienCalibrage,
      modifie: true,
      groupes: [
        {
          id: "nouveau-groupe-001",
          calibrageId: "calibrage-to-patch",
          categorie: CategorieCalibrage.MOYEN,
          destinationBacId: bacDestViaAssignationOnly.id,
          nombrePoissons: 200,
          poidsMoyen: 50,
          tailleMoyenne: null,
          destinationBac: { id: bacDestViaAssignationOnly.id, nom: bacDestViaAssignationOnly.nom },
        },
      ],
      modifications: [
        {
          id: "modif-001",
          calibrageId: "calibrage-to-patch",
          userId: USER_ID,
          raison: "Test réserve 2",
          champModifie: "groupes",
          ancienneValeur: "[]",
          nouvelleValeur: "[]",
          siteId: SITE_ID,
          createdAt: new Date(),
          user: { id: USER_ID, name: "Test User" },
        },
      ],
    };

    mockCalibrageFindFirst
      .mockResolvedValueOnce(ancienCalibrage) // Étape 1 — fetch calibrage existant
      .mockResolvedValueOnce(updatedCalibrage); // Étape 9d — fetch calibrage mis à jour

    // Étape 5 : findMany pour vérification des bacs destination
    // Le bac destination est trouvé via la clause OR (AssignationBac active)
    mockBacFindManyPatch
      .mockResolvedValueOnce([bacDestViaAssignationOnly]); // Étape 5 : vérification appartenance

    // Étapes 6, 7 — opérations sur bacs et assignations
    mockBacUpdatePatch.mockResolvedValue({ id: "any" });
    mockBacUpdateManyPatch.mockResolvedValue({ count: 1 });
    mockAssignationBacFindFirstPatch.mockResolvedValue(null); // pas d'assignation active
    mockAssignationBacUpdatePatch.mockResolvedValue({ id: "any" });
    mockAssignationBacUpdateManyPatch.mockResolvedValue({ count: 0 });

    // Étape 5b — snapshot
    mockVagueFindFirstPatch.mockResolvedValue({
      id: VAGUE_ID,
      code: "V-2025-001",
      nombreInitial: 500,
      poidsMoyenInitial: 50,
      statut: StatutVague.EN_COURS,
    });
    mockBacFindManyPatch
      .mockResolvedValueOnce([bacDestViaAssignationOnly]); // snapshot bacs de la vague

    // Étape 8 — releves
    mockReleveDeleteMany.mockResolvedValue({ count: 2 });
    mockReleveCreatePatch.mockResolvedValue({});
    mockReleveUpdateMany.mockResolvedValue({ count: 0 });
    mockRelEveFindMany.mockResolvedValue([]);

    // Étape 9
    mockCalibrageUpdate.mockResolvedValue({});
    mockCalibrageGrouepDeleteMany.mockResolvedValue({ count: 1 });
    mockCalibrageModificationCreateMany.mockResolvedValue({ count: 1 });

    // Ne doit pas lever d'erreur "n'appartient pas a la vague"
    await expect(
      patchCalibrage(SITE_ID, USER_ID, "calibrage-to-patch", {
        groupes: [
          {
            categorie: CategorieCalibrage.MOYEN,
            destinationBacId: bacDestViaAssignationOnly.id,
            nombrePoissons: 200,
            poidsMoyen: 50,
            tailleMoyenne: undefined,
          },
        ],
      }, "Test réserve 2")
    ).resolves.toBeDefined();

    // Vérifier que la clause OR est bien présente dans la recherche des bacs destination (étape 5)
    const step5Call = mockBacFindManyPatch.mock.calls[0][0];
    expect(step5Call.where.OR).toBeDefined();
    expect(step5Call.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ vagueId: VAGUE_ID }),
        expect.objectContaining({
          assignations: expect.objectContaining({
            some: expect.objectContaining({ vagueId: VAGUE_ID, dateFin: null }),
          }),
        }),
      ])
    );
  });
});
