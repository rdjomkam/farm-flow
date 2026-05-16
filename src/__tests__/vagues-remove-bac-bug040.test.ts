/**
 * Tests de non-régression BUG-040 — Action #3
 * Fallback AssignationBac dans removeBacs (src/lib/queries/vagues.ts)
 *
 * Cas couverts :
 *   1. Bac appartenant uniquement via AssignationBac (Bac.vagueId = null)
 *      → le retrait réussit et ferme l'assignation
 *   2. nombrePoissons lu depuis AssignationBac (prioritaire sur Bac.nombrePoissons)
 *      → bac.update(increment = 150), assignationBac.updateMany(nombreActuel = 230)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateVague } from "@/lib/queries/vagues";
import { StatutVague } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma — même pattern que vagues-remove-bac.test.ts
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockVagueUpdate = vi.fn();
const mockBacFindMany = vi.fn();
const mockBacFindFirst = vi.fn();
const mockBacUpdate = vi.fn();
const mockBacUpdateMany = vi.fn();
const mockReleveCreate = vi.fn();
const mockActiviteUpdateMany = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
      update: (...args: unknown[]) => mockVagueUpdate(...args),
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

/** Vague EN_COURS avec 2 bacs */
const vagueEnCours = {
  id: "vague-1",
  statut: StatutVague.EN_COURS,
  nombreInitial: 500,
  poidsMoyenInitial: 10,
  _count: { bacs: 2, assignations: 2 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateVague — BUG-040 Action #3 : fallback AssignationBac dans removeBacs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Cas 1 : Bac appartenant uniquement via AssignationBac (Bac.vagueId = null)
  // -------------------------------------------------------------------------
  it("Cas 1 — retrait réussit si le bac est lié uniquement via AssignationBac (Bac.vagueId = null)", async () => {
    // Le bac a vagueId = null mais une AssignationBac active pour vague-1
    const bacViaSousAssignation = {
      id: "bac-assign-only",
      nom: "Bac Assign Only",
      vagueId: null, // pas de FK directe
      nombrePoissons: 0,
      nombreInitial: 200,
      poidsMoyenInitial: 10,
      assignations: [
        { id: "assign-1", nombrePoissons: 0 }, // actif, trouvé via clause OR
      ],
    };

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // findMany retourne le bac grâce à la clause OR (assignations actives)
    mockBacFindMany.mockResolvedValue([bacViaSousAssignation]);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    // La fermeture de l'assignation doit être appelée
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockVagueUpdate.mockResolvedValue({
      ...vagueEnCours,
      _count: { bacs: 1, assignations: 1 },
    });

    // Ne doit pas lever d'erreur "bac introuvable"
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
  // Cas 2 : nombrePoissons lu depuis AssignationBac en priorité lors du transfert
  // -------------------------------------------------------------------------
  it("Cas 2 — transfer utilise AssignationBac.nombrePoissons (150) et non Bac.nombrePoissons (100)", async () => {
    // Bac source : stale FK (100) vs AssignationBac à jour (150)
    const bacSource = {
      id: "bac-source",
      nom: "Bac Source",
      vagueId: "vague-1",
      nombrePoissons: 100, // valeur stale
      nombreInitial: 300,
      poidsMoyenInitial: 10,
      assignations: [
        { id: "assign-source", nombrePoissons: 150 }, // valeur à jour — prioritaire
      ],
    };

    // Bac destination : stale FK (50) vs AssignationBac à jour (80)
    const bacDestination = {
      id: "bac-dest",
      nom: "Bac Dest",
      vagueId: "vague-1",
      nombrePoissons: 50, // valeur stale
      nombreInitial: 200,
      poidsMoyenInitial: 10,
      assignations: [
        { id: "assign-dest", nombrePoissons: 80 }, // valeur à jour — prioritaire
      ],
    };

    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacSource]);
    mockBacFindFirst.mockResolvedValue(bacDestination);
    mockBacUpdate.mockResolvedValue({});
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockReleveCreate.mockResolvedValue({});
    mockVagueUpdate.mockResolvedValue({
      ...vagueEnCours,
      _count: { bacs: 1, assignations: 1 },
    });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-source"],
      transferDestinationBacId: "bac-dest",
    });

    // --- Assertion 2a : bac.update incrémente de 150 (AssignationBac source), pas de 100 ---
    expect(mockBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bac-dest" },
        data: { nombrePoissons: { increment: 150 } },
      })
    );

    // --- Assertion 2b : assignationBac.updateMany du dest écrit 80 + 150 = 230, pas 50 + 100 ---
    // Le premier appel updateMany (avant la fermeture des bacs retirés) cible la destination
    const updateManyCalls = mockAssignationBacUpdateMany.mock.calls;

    const destAssignUpdate = updateManyCalls.find(
      (call) =>
        call[0]?.where?.bacId === "bac-dest" &&
        call[0]?.where?.vagueId === "vague-1" &&
        call[0]?.where?.dateFin === null
    );

    expect(destAssignUpdate).toBeDefined();
    expect(destAssignUpdate![0].data.nombrePoissons).toBe(230); // 80 + 150

    // --- Assertion 2c : le relevé COMPTAGE source est bien à 0 ---
    const releveSourceCall = mockReleveCreate.mock.calls.find(
      (call) => call[0]?.data?.bacId === "bac-source"
    );
    expect(releveSourceCall?.[0].data.nombreCompte).toBe(0);

    // --- Assertion 2d : le relevé COMPTAGE destination est bien à 230 (80 + 150) ---
    const releveDestCall = mockReleveCreate.mock.calls.find(
      (call) => call[0]?.data?.bacId === "bac-dest"
    );
    expect(releveDestCall?.[0].data.nombreCompte).toBe(230); // 80 + 150
  });
});
