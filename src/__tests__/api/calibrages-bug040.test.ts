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
const mockAssignationBacFindMany = vi.fn();
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

/** Bac source : lié via AssignationBac uniquement */
const bacSourceViaAssignationOnly = {
  id: "bac-src-assignation",
  nom: "Source Assignation",
  volume: 1000,
  vagueId: null,
  nombrePoissons: 200,
  nombreInitial: 200,
  poidsMoyenInitial: 50,
  siteId: SITE_ID,
};

/** AssignationBac active pour le bac source */
const assignationBacSource = {
  id: "assignation-src-001",
  bacId: bacSourceViaAssignationOnly.id,
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  dateFin: null,
  nombreActuel: 200,
  nombreInitial: 200,
  poidsMoyenInitial: 50,
  bac: { id: bacSourceViaAssignationOnly.id, nom: bacSourceViaAssignationOnly.nom },
};

/** Bac destination : sans AssignationBac active préalable */
const bacDestSanAssignation = {
  id: "bac-dest-fk",
  nom: "Dest FK",
  volume: 800,
  vagueId: VAGUE_ID,
  nombrePoissons: 0,
  nombreInitial: null,
  poidsMoyenInitial: null,
  siteId: SITE_ID,
};

/** AssignationBac active pour le bac destination */
const assignationBacDest = {
  id: "assignation-dest-001",
  bacId: bacDestSanAssignation.id,
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  dateFin: null,
  nombreActuel: 0,
  nombreInitial: null,
  poidsMoyenInitial: null,
  bac: { id: bacDestSanAssignation.id, nom: bacDestSanAssignation.nom },
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

    // tx.assignationBac.findMany est appelé 4 fois :
    //  1. vérification bacs sources → retourne l'assignation source
    //  2. vérification bacs destination → retourne l'assignation dest
    //  3. allBacsVague pour computeVivantsByBac (BUG-048) → toutes les assignations
    //  4. snapshot allBacsOfVague → toutes les assignations
    mockAssignationBacFindMany
      .mockResolvedValueOnce([assignationBacSource])                           // sources
      .mockResolvedValueOnce([{ bacId: assignationBacDest.bacId }])            // destinations (select bacId)
      .mockResolvedValueOnce([{ bacId: assignationBacSource.bacId, nombreInitial: 200 }]) // BUG-048 vivants
      .mockResolvedValueOnce([assignationBacSource, assignationBacDest]);      // snapshot

    mockReleveFindMany.mockResolvedValue([]); // pas de mortalités
    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // Pour le bac destination : pas d'AssignationBac existante → create défensif
    mockAssignationBacFindFirst.mockResolvedValue(null).mockResolvedValueOnce(null);
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

    // Vérifier que la recherche des bacs sources passe bien par assignationBac.findMany
    expect(mockAssignationBacFindMany).toHaveBeenCalled();
    const sourceCall = mockAssignationBacFindMany.mock.calls[0][0];
    expect(sourceCall.where.bacId).toEqual({ in: [bacSourceViaAssignationOnly.id] });
    expect(sourceCall.where.vagueId).toBe(VAGUE_ID);
    expect(sourceCall.where.dateFin).toBeNull();
  });

  it("accepte un bac destination sans Bac.vagueId mais avec AssignationBac active", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany
      .mockResolvedValueOnce([assignationBacSource])                                    // sources
      .mockResolvedValueOnce([{ bacId: assignationBacDest.bacId }])                    // destinations
      .mockResolvedValueOnce([{ bacId: assignationBacSource.bacId, nombreInitial: 200 }]) // BUG-048 vivants
      .mockResolvedValueOnce([assignationBacSource, assignationBacDest]);               // snapshot

    mockReleveFindMany.mockResolvedValue([]);
    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // AssignationBac existante pour le bac destination
    const existingAssignation = { id: "assignation-dest-001", nombreActuel: 0 };
    mockAssignationBacFindFirst.mockResolvedValue(existingAssignation);
    mockAssignationBacUpdate.mockResolvedValue({ id: "assignation-dest-001", nombreActuel: 200 });
    mockReleveCreate.mockResolvedValue({});

    await expect(
      createCalibrage(SITE_ID, USER_ID, makeDto())
    ).resolves.toBeDefined();

    // Vérifier que la recherche des bacs destinations passe par assignationBac.findMany
    expect(mockAssignationBacFindMany).toHaveBeenCalledTimes(4);
    const destCall = mockAssignationBacFindMany.mock.calls[1][0];
    expect(destCall.where.bacId).toEqual({ in: [bacDestSanAssignation.id] });
    expect(destCall.where.vagueId).toBe(VAGUE_ID);
    expect(destCall.where.dateFin).toBeNull();
  });

  it("rejette un bac source qui n'appartient pas du tout à la vague (ni FK ni AssignationBac)", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // assignationBac.findMany retourne 0 → validation échoue
    mockAssignationBacFindMany.mockResolvedValue([]);

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
    // 4 appels à assignationBac.findMany :
    // 1. source validation → assignation source trouvée
    // 2. dest validation → assignation dest trouvée (pour valider appartenance)
    // 3. vivants BUG-048
    // 4. snapshot
    mockAssignationBacFindMany
      .mockResolvedValueOnce([assignationBacSource])                                    // sources
      .mockResolvedValueOnce([{ bacId: assignationBacDest.bacId }])                    // destinations
      .mockResolvedValueOnce([{ bacId: assignationBacSource.bacId, nombreInitial: 200 }]) // BUG-048 vivants
      .mockResolvedValueOnce([assignationBacSource, assignationBacDest]);               // snapshot

    mockReleveFindMany.mockResolvedValue([]);
    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // Pas d'AssignationBac active pour le bac destination → doit déclencher create défensif
    // findFirst: 1er appel = null (pas d'active), 2ème appel = null (historique)
    mockAssignationBacFindFirst.mockResolvedValue(null);
    const mockCreatedAssignation = {
      id: "new-assignation-defensive",
      bacId: bacDestSanAssignation.id,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      nombreActuel: 200,
    };
    mockAssignationBacCreate.mockResolvedValue(mockCreatedAssignation);
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
    // nombreActuel = total reçu (200)
    expect(createCall.data.nombreActuel).toBe(200);
  });

  it("ne crée pas d'AssignationBac si une existe déjà pour le bac destination", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany
      .mockResolvedValueOnce([assignationBacSource])                                    // sources
      .mockResolvedValueOnce([{ bacId: assignationBacDest.bacId }])                    // destinations
      .mockResolvedValueOnce([{ bacId: assignationBacSource.bacId, nombreInitial: 200 }]) // BUG-048 vivants
      .mockResolvedValueOnce([assignationBacSource, assignationBacDest]);               // snapshot

    mockReleveFindMany.mockResolvedValue([]);
    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });

    // AssignationBac déjà existante pour le bac destination → pas de create défensif
    const existingAssignation = { id: "assignation-existing", nombreActuel: 50 };
    mockAssignationBacFindFirst.mockResolvedValue(existingAssignation);

    // Cas normal : update direct via assignationBac.update (pas create)
    mockAssignationBacUpdate.mockResolvedValue({ id: "assignation-existing", nombreActuel: 250 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockReleveCreate.mockResolvedValue({});

    await createCalibrage(SITE_ID, USER_ID, makeDto());

    // Le create défensif ne doit PAS être appelé
    expect(mockAssignationBacCreate).not.toHaveBeenCalled();
  });

  it("le create défensif utilise nombreActuel = total reçu (AssignationBac manquante)", async () => {
    // Bac destination sans AssignationBac active — le create défensif reçoit le total du groupe

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany
      .mockResolvedValueOnce([assignationBacSource])                                    // sources
      .mockResolvedValueOnce([{ bacId: assignationBacDest.bacId }])                    // destinations
      .mockResolvedValueOnce([{ bacId: assignationBacSource.bacId, nombreInitial: 200 }]) // BUG-048 vivants
      .mockResolvedValueOnce([assignationBacSource, assignationBacDest]);               // snapshot

    mockReleveFindMany.mockResolvedValue([]);
    mockCalibrageCreate.mockResolvedValue(fakeCalibrageCreated);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });

    // findFirst: null pour active, null pour historique
    mockAssignationBacFindFirst.mockResolvedValue(null);
    mockAssignationBacCreate.mockResolvedValue({ id: "new-def" });
    mockReleveCreate.mockResolvedValue({});

    await createCalibrage(SITE_ID, USER_ID, makeDto());

    const createCall = mockAssignationBacCreate.mock.calls[0][0];
    // total reçu du groupe = 200
    expect(createCall.data.nombreActuel).toBe(200);
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
const mockAssignationBacFindManyPatch = vi.fn();
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
      // ADR-043 Phase 3: findMany needed for source/dest/all bacs lookups in patchCalibrage
      findMany: (...args: unknown[]) => mockAssignationBacFindManyPatch(...args),
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
        calibrage: {
          create: (...args: unknown[]) => mockCalibrageCreate(...args),
          findUniqueOrThrow: (...args: unknown[]) => mockCalibrageCreate(...args),
        },
        assignationBac: {
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

    const assignationDestViaAssignationOnly = {
      id: "assignation-dest-via-assignation",
      bacId: bacDestViaAssignationOnly.id,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      dateFin: null,
      nombreActuel: 200,
      nombreInitial: null,
      poidsMoyenInitial: null,
      bac: { id: bacDestViaAssignationOnly.id, nom: bacDestViaAssignationOnly.nom },
    };

    mockCalibrageFindFirst
      .mockResolvedValueOnce(ancienCalibrage) // Étape 1 — fetch calibrage existant
      .mockResolvedValueOnce(updatedCalibrage); // Étape 9d — fetch calibrage mis à jour

    // assignationBac.findMany appelé 2 fois :
    // 1. étape 5 : vérification appartenance bacs destination
    // 2. étape 5b : snapshot all bacs de la vague
    mockAssignationBacFindManyPatch
      .mockResolvedValueOnce([{ bacId: bacDestViaAssignationOnly.id }]) // étape 5 : dest trouvé
      .mockResolvedValueOnce([assignationDestViaAssignationOnly]);       // étape 5b : snapshot

    // Étapes 6, 7 — opérations sur assignations
    mockAssignationBacFindFirstPatch.mockResolvedValue(null); // pas d'assignation active dans rollback
    mockAssignationBacUpdatePatch.mockResolvedValue({ id: "any" });
    mockAssignationBacUpdateManyPatch.mockResolvedValue({ count: 1 });

    // Étape 5b — vague pour snapshot
    mockVagueFindFirstPatch.mockResolvedValue({
      id: VAGUE_ID,
      code: "V-2025-001",
      nombreInitial: 500,
      poidsMoyenInitial: 50,
      statut: StatutVague.EN_COURS,
    });

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

    // Vérifier que la vérification des bacs destination passe par assignationBac.findMany (étape 5)
    expect(mockAssignationBacFindManyPatch).toHaveBeenCalled();
    const step5Call = mockAssignationBacFindManyPatch.mock.calls[0][0];
    expect(step5Call.where.bacId).toEqual({ in: [bacDestViaAssignationOnly.id] });
    expect(step5Call.where.vagueId).toBe(VAGUE_ID);
    expect(step5Call.where.dateFin).toBeNull();
  });
});
