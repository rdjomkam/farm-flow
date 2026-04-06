/**
 * Tests unitaires pour la logique de retrait de bac dans updateVague
 * (src/lib/queries/vagues.ts).
 *
 * Strategie : mock complet de Prisma (prisma.$transaction executant le callback,
 * prisma.bac.findFirst, prisma.bac.findMany, prisma.bac.updateMany, prisma.vague.update...).
 *
 * Cas couverts :
 *   1. transferDestinationBacId dans removeBacIds → erreur metier
 *   2. Bac avec poissons mais aucun transferDestinationBacId → erreur metier
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
const mockBacFindMany = vi.fn();
const mockBacFindFirst = vi.fn();
const mockBacUpdate = vi.fn();
const mockBacUpdateMany = vi.fn();
const mockReleveCreate = vi.fn();
const mockActiviteUpdateMany = vi.fn();
// ADR-043 Phase 2: mocks AssignationBac
const mockAssignationBacUpdateMany = vi.fn();

/** Simule prisma.$transaction en executant directement le callback avec un tx mock */
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
    // ADR-043 Phase 2: table de jonction AssignationBac
    assignationBac: {
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

/** Une vague EN_COURS avec 2 bacs */
const vagueEnCours = {
  id: "vague-1",
  statut: StatutVague.EN_COURS,
  nombreInitial: 500,
  poidsMoyenInitial: 10,
  // ADR-043 Phase 2: _count inclut maintenant les assignations actives
  _count: { bacs: 2, assignations: 2 },
};

/** Un bac vide (aucun poisson) */
const bacVide = {
  id: "bac-a",
  nom: "Bac A",
  vagueId: "vague-1",
  nombrePoissons: 0,
  nombreInitial: 250,
  poidsMoyenInitial: 10,
};

/** Un bac avec des poissons */
const bacAvecPoissons = {
  id: "bac-b",
  nom: "Bac B",
  vagueId: "vague-1",
  nombrePoissons: 120,
  nombreInitial: 250,
  poidsMoyenInitial: 10,
};

/** Un bac de destination valide (reste dans la vague) */
const bacDestination = {
  id: "bac-c",
  nom: "Bac C",
  vagueId: "vague-1",
  nombrePoissons: 200,
  nombreInitial: 200,
  poidsMoyenInitial: 10,
};

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
    // Un bac vide a retirer (pas de poissons, donc le code atteint la guard apres)
    // Mais la garde "dest in removeBacIds" est verifiee avant la boucle
    mockBacFindMany.mockResolvedValue([bacVide]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-a"],
        transferDestinationBacId: "bac-a", // dest == source → interdit
      })
    ).rejects.toThrow("Le bac de destination ne peut pas faire partie des bacs à retirer");
  });

  // Test 2 — Bac avec poissons, sans transferDestinationBacId → erreur avec nom + count
  it("leve une erreur mentionnant le nom du bac et le nombre de poissons", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacAvecPoissons]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-b"],
        // Pas de transferDestinationBacId
      })
    ).rejects.toThrow(/Bac B/);

    // Re-run pour verifier aussi le count
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacAvecPoissons]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-b"],
      })
    ).rejects.toThrow(/120/);
  });

  // Test 3 — Bac avec poissons, sans transferDestinationBacId → message contient "transférer"
  it("le message d'erreur invite a transferer vers un autre bac", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacAvecPoissons]);

    await expect(
      updateVague("vague-1", "site-1", {
        removeBacIds: ["bac-b"],
      })
    ).rejects.toThrow(/transf/i);
  });

  // Test 4 — vague.nombreInitial n'est JAMAIS decremente lors du retrait
  it("ne decremente pas vague.nombreInitial lors du retrait d'un bac vide", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacVide]); // bac vide, aucun transfert necessaire
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockVagueUpdate.mockResolvedValue({ ...vagueEnCours, _count: { bacs: 1, assignations: 1 } });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-a"],
    });

    // Verifier que vague.update n'a PAS ete appele avec un decrement sur nombreInitial
    if (mockVagueUpdate.mock.calls.length > 0) {
      const updateCall = mockVagueUpdate.mock.calls[0][0];
      const updateData = updateCall?.data ?? {};
      // nombreInitial ne doit pas apparaitre avec decrement
      expect(updateData.nombreInitial).toBeUndefined();
      // Pas de $decrement non plus
      if (typeof updateData.nombreInitial === "object") {
        expect(updateData.nombreInitial).not.toHaveProperty("decrement");
      }
    }

    // Verifier que bac.updateMany a bien libere le bac (vagueId → null)
    expect(mockBacUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vagueId: null }),
      })
    );
  });

  // Test 5 — Retrait d'un bac vide reussit sans creer de releve COMPTAGE
  it("ne cree pas de releve COMPTAGE lors du retrait d'un bac vide", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacVide]);
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockVagueUpdate.mockResolvedValue({ ...vagueEnCours, _count: { bacs: 1, assignations: 1 } });

    await updateVague("vague-1", "site-1", {
      removeBacIds: ["bac-a"],
    });

    // Aucun releve cree puisque le bac est vide
    expect(mockReleveCreate).not.toHaveBeenCalled();
  });

  // Test 6 — Retrait avec transfert cree 2 releves COMPTAGE (source=0, dest=nouveau total)
  it("cree 2 releves COMPTAGE lors du transfert de poissons", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueEnCours);
    mockBacFindMany.mockResolvedValue([bacAvecPoissons]); // 120 poissons
    mockBacFindFirst.mockResolvedValue(bacDestination); // dest a 200 poissons
    mockBacUpdate.mockResolvedValue({});
    mockBacUpdateMany.mockResolvedValue({ count: 1 });
    mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
    mockActiviteUpdateMany.mockResolvedValue({ count: 0 });
    mockVagueUpdate.mockResolvedValue({ ...vagueEnCours, _count: { bacs: 1, assignations: 1 } });

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
    const vagueUnBac = { ...vagueEnCours, _count: { bacs: 1, assignations: 1 } };
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
