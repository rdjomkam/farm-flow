/**
 * Tests unitaires pour la logique de retrait de bac dans updateVague
 * (src/lib/queries/vagues.ts).
 *
 * ADR-043 Phase 3: le retrait utilise maintenant AssignationBac.findMany
 * (plus Bac.vagueId/nombrePoissons). Les mocks reflètent cette source unique.
 *
 * Strategie : mock complet de Prisma ($transaction).
 *
 * Cas couverts :
 *   1. transferDestinationBacId dans removeBacIds → erreur metier
 *   2. AssignationBac avec poissons mais aucun transferDestinationBacId → erreur metier
 *      avec nom du bac et nombre de poissons dans le message
 *   3. vague.nombreInitial n'est JAMAIS decremente apres retrait d'un bac
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateVague } from "@/lib/queries/vagues";
import { StatutVague } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma
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
// ADR-043 Phase 3: mocks AssignationBac
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();

/** Simule prisma.$transaction en executant directement le callback avec un tx mock */
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
    // ADR-043 Phase 3: table de jonction AssignationBac
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
    $transaction: (...args: unknown[]) => mockTransaction(...args as Parameters<typeof mockTransaction>),
  },
}));

// ---------------------------------------------------------------------------
// Donnees de test communes
// ---------------------------------------------------------------------------

/** Une vague EN_COURS avec 2 assignations actives */
const vagueEnCours = {
  id: "vague-1",
  statut: StatutVague.EN_COURS,
  nombreInitial: 500,
  poidsMoyenInitial: 10,
  // ADR-043 Phase 3: _count utilise assignations (plus bacs)
  _count: { assignations: 2 },
};

/**
 * ADR-043 Phase 3: les données de retrait viennent des assignations.
 * makeAssignation simule ce que tx.assignationBac.findMany retourne.
 */
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

/** Une assignation vide (aucun poisson) */
const assignationVide = makeAssignation({ bacId: "bac-a", nom: "Bac A", nombreActuel: 0 });

/** Une assignation avec des poissons */
const assignationAvecPoissons = makeAssignation({ bacId: "bac-b", nom: "Bac B", nombreActuel: 120 });

/** Une assignation de destination valide */
const assignationDestination = makeAssignation({ bacId: "bac-c", nom: "Bac C", nombreActuel: 200 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateVague — retrait de bac (removeBacIds)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1 — transferDestinationBacId inclus dans removeBacIds → erreur
  it("leve une erreur si transferDestinationBacId est dans removeBacIds", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // findMany retourne une assignation vide
    mockAssignationBacFindMany.mockResolvedValue([assignationVide]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-a"],
        transferDestinationBacId: "bac-a", // dest == source → interdit
      })
    ).rejects.toThrow("Le bac de destination ne peut pas faire partie des bacs à retirer");
  });

  // Test 2 — AssignationBac avec poissons, sans transferDestinationBacId → erreur avec nom + count
  it("leve une erreur mentionnant le nom du bac et le nombre de poissons", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany.mockResolvedValue([assignationAvecPoissons]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-b"],
        // Pas de transferDestinationBacId
      })
    ).rejects.toThrow(/Bac B/);

    // Re-run pour verifier aussi le count
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany.mockResolvedValue([assignationAvecPoissons]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-b"],
      })
    ).rejects.toThrow(/120/);
  });

  // Test 3 — message contient "transférer"
  it("le message d'erreur invite a transferer vers un autre bac", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany.mockResolvedValue([assignationAvecPoissons]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-b"],
      })
    ).rejects.toThrow(/transf/i);
  });

  // Test 4 — vague.nombreInitial n'est JAMAIS decremente lors du retrait
  it("ne decremente pas vague.nombreInitial lors du retrait d'une assignation vide", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany.mockResolvedValue([assignationVide]);
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockVagueFindUniqueOrThrow.mockResolvedValue({ ...vagueEnCours, _count: { assignations: 1 } });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-a"],
    });

    // Verifier que vague.update n'a PAS ete appele avec un decrement sur nombreInitial
    if (mockVagueUpdate.mock.calls.length > 0) {
      const updateCall = mockVagueUpdate.mock.calls[0][0];
      const updateData = updateCall?.data ?? {};
      // nombreInitial ne doit pas apparaitre avec decrement
      if (typeof updateData.nombreInitial === "object") {
        expect(updateData.nombreInitial).not.toHaveProperty("decrement");
      }
    }

    // L'assignation active doit être fermée (dateFin renseigné)
    expect(mockAssignationBacUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bacId: { in: ["bac-a"] },
          vagueId: "vague-1",
          dateFin: null,
        }),
        data: expect.objectContaining({
          dateFin: expect.any(Date),
        }),
      })
    );
  });

  // Test 5 — Retrait d'une assignation vide ne cree pas de releve COMPTAGE
  it("ne cree pas de releve COMPTAGE lors du retrait d'une assignation vide", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockAssignationBacFindMany.mockResolvedValue([assignationVide]);
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockVagueFindUniqueOrThrow.mockResolvedValue({ ...vagueEnCours, _count: { assignations: 1 } });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-a"],
    });

    // Aucun releve cree puisque l'assignation est vide
    expect(mockReleveCreate).not.toHaveBeenCalled();
  });

  // Test 6 — Retrait avec transfert cree 2 releves COMPTAGE (source=0, dest=nouveau total)
  it("cree 2 releves COMPTAGE lors du transfert de poissons", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    // Assignation source : 120 poissons
    mockAssignationBacFindMany.mockResolvedValue([assignationAvecPoissons]);
    // AssignationBac de destination : 200 poissons
    mockAssignationBacFindFirst.mockResolvedValue(assignationDestination);
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockVagueFindUniqueOrThrow.mockResolvedValue({ ...vagueEnCours, _count: { assignations: 1 } });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-b"],
      transferDestinationBacId: "bac-c",
    });

    // 2 releves : COMPTAGE=0 pour source, COMPTAGE=320 pour destination
    expect(mockReleveCreate).toHaveBeenCalledTimes(2);

    const calls = mockReleveCreate.mock.calls.map((c) => c[0].data);
    const sourceComptage = calls.find((d) => d.bacId === "bac-b");
    const destComptage = calls.find((d) => d.bacId === "bac-c");

    expect(sourceComptage?.nombreCompte).toBe(0);
    // 200 (existants) + 120 (transferes) = 320
    expect(destComptage?.nombreCompte).toBe(320);
  });

  // Test 7 — Retrait impossible si vague n'a qu'un seul bac
  it("leve une erreur si on tente de retirer le dernier bac", async () => {
    const vagueUnBac = { ...vagueEnCours, _count: { assignations: 1 } };
    mockVagueFindFirst.mockResolvedValue(vagueUnBac);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-a"],
      })
    ).rejects.toThrow(/au moins un bac/);
  });

  // Test 8 — Vague introuvable → erreur
  it("leve une erreur si la vague est introuvable", async () => {
    mockVagueFindFirst.mockResolvedValue(null);

    await expect(
      updateVague("vague-inexistante", "site-1", {
        removeBacIds: ["bac-a"],
      })
    ).rejects.toThrow("Vague introuvable");
  });
});
