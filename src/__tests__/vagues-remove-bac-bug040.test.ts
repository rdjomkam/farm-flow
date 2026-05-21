/**
 * Tests de non-régression BUG-040 — Action #3
 * AssignationBac dans removeBacs (src/lib/queries/vagues.ts)
 *
 * ADR-043 Phase 3: le retrait utilise uniquement AssignationBac comme source de vérité.
 * Bac.vagueId n'existe plus. Les assignations sont fermées (dateFin) lors du retrait.
 *
 * Cas couverts :
 *   1. Bac appartenant via AssignationBac active (nombreActuel = 0)
 *      → le retrait réussit et ferme l'assignation
 *   2. nombrePoissons lu depuis AssignationBac.nombreActuel (prioritaire)
 *      → assignationBac.updateMany(nombreActuel = 230), 2 releves COMPTAGE
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateVague } from "@/lib/queries/vagues";
import { StatutVague } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma — même pattern que vagues-remove-bac.test.ts
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockVagueUpdate = vi.fn();
const mockVagueFindUniqueOrThrow = vi.fn();
const mockBacFindMany = vi.fn();
const mockBacFindFirst = vi.fn();
const mockBacUpdate = vi.fn();
const mockBacUpdateMany = vi.fn();
const mockReleveCreate = vi.fn();
const mockActiviteUpdateMany = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
      update: (...args: unknown[]) => mockVagueUpdate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockVagueFindUniqueOrThrow(...args),
    },
    bac: {
      findMany: (...args: unknown[]) => mockBacFindMany(...args),
      findFirst: (...args: unknown[]) => mockBacFindFirst(...args),
      update: (...args: unknown[]) => mockBacUpdate(...args),
      updateMany: (...args: unknown[]) => mockBacUpdateMany(...args),
    },
    releve: {
      create: (...args: unknown[]) => mockReleveCreate(...args),
    },
    activite: {
      updateMany: (...args: unknown[]) => mockActiviteUpdateMany(...args),
    },
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
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
// Données de test
// ---------------------------------------------------------------------------

/** Vague EN_COURS avec 2 assignations actives */
const vagueEnCours = {
  id: "vague-1",
  statut: StatutVague.EN_COURS,
  nombreInitial: 500,
  poidsMoyenInitial: 10,
  _count: { assignations: 2 },
};

/** Fabrique une AssignationBac retournée par tx.assignationBac.findMany */
function makeAssignation(opts: {
  bacId: string;
  nom: string;
  nombreActuel: number;
}) {
  return {
    id: `assign-${opts.bacId}`,
    bacId: opts.bacId,
    vagueId: "vague-1",
    siteId: "site-1",
    dateFin: null,
    nombreActuel: opts.nombreActuel,
    nombreInitial: opts.nombreActuel,
    poidsMoyenInitial: 10,
    bac: { id: opts.bacId, nom: opts.nom },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateVague — BUG-040 Action #3 : AssignationBac dans removeBacs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Cas 1 : Bac appartenant via AssignationBac (nombreActuel = 0)
  // -------------------------------------------------------------------------
  it("Cas 1 — retrait réussit si le bac est lié via AssignationBac (nombreActuel = 0)", async () => {
    // Assignation active pour ce bac, aucun poisson dedans
    const assignationVide = makeAssignation({
      bacId: "bac-assign-only",
      nom: "Bac Assign Only",
      nombreActuel: 0,
    });

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // findMany retourne l'assignation grâce à where: { bacId, vagueId, dateFin: null }
    mockAssignationBacFindMany.mockResolvedValue([assignationVide]);
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      ...vagueEnCours,
      _count: { assignations: 1 },
    });

    // Ne doit pas lever d'erreur
    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-assign-only"],
      })
    ).resolves.not.toThrow();

    // L'assignation active doit être fermée (dateFin renseigné)
    expect(mockAssignationBacUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bacId: { in: ["bac-assign-only"] },
          vagueId: "vague-1",
          dateFin: null,
        }),
        data: expect.objectContaining({
          dateFin: expect.any(Date),
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // Cas 2 : nombrePoissons lu depuis AssignationBac.nombreActuel lors du transfert
  // -------------------------------------------------------------------------
  it("Cas 2 — transfert utilise AssignationBac.nombreActuel (150) pour la source", async () => {
    // AssignationBac source avec 150 poissons (valeur à jour)
    const assignationSource = makeAssignation({
      bacId: "bac-source",
      nom: "Bac Source",
      nombreActuel: 150,
    });

    // AssignationBac de destination avec 80 poissons
    const assignationDest = makeAssignation({
      bacId: "bac-dest",
      nom: "Bac Dest",
      nombreActuel: 80,
    });

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // findMany pour les bacs à retirer
    mockAssignationBacFindMany.mockResolvedValue([assignationSource]);
    // findFirst pour la destination
    mockAssignationBacFindFirst.mockResolvedValue(assignationDest);
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockReleveCreate.mockResolvedValue({});
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      ...vagueEnCours,
      _count: { assignations: 1 },
    });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-source"],
      transferDestinationBacId: "bac-dest",
    });

    // --- Assertion 2a : assignationBac.updateMany du dest écrit 80 + 150 = 230 ---
    const updateManyCalls = mockAssignationBacUpdateMany.mock.calls;

    const destAssignUpdate = updateManyCalls.find(
      (call) =>
        call[0]?.where?.bacId === "bac-dest" &&
        call[0]?.where?.vagueId === "vague-1" &&
        call[0]?.where?.dateFin === null
    );

    expect(destAssignUpdate).toBeDefined();
    expect(destAssignUpdate![0].data.nombreActuel).toBe(230); // 80 + 150

    // --- Assertion 2b : le relevé COMPTAGE source est bien à 0 ---
    const releveSourceCall = mockReleveCreate.mock.calls.find(
      (call) => call[0]?.data?.bacId === "bac-source"
    );
    expect(releveSourceCall?.[0].data.nombreCompte).toBe(0);

    // --- Assertion 2c : le relevé COMPTAGE destination est bien à 230 (80 + 150) ---
    const releveDestCall = mockReleveCreate.mock.calls.find(
      (call) => call[0]?.data?.bacId === "bac-dest"
    );
    expect(releveDestCall?.[0].data.nombreCompte).toBe(230); // 80 + 150
  });
});
