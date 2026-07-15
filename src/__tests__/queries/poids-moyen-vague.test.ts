/**
 * Tests pour getPoidsMoyenActuelVague.
 *
 * Verifie que la fonction calcule correctement la moyenne ponderee de la
 * derniere BIOMETRIE par bac, ponderee par le nombre de vivants.
 *
 * ADR-043 Phase 3: les bacs sont lus depuis vague.assignations (dateFin: null),
 * plus depuis vague.bacs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPoidsMoyenActuelVague } from "@/lib/queries/releves";
import { TypeReleve } from "@/types";

const mockVagueFindFirst = vi.fn();
const mockTransfertGroupeFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
  },
}));

/** Fabrique une assignation active avec nombreInitial */
function makeAssignation(bacId: string, nombreInitial: number) {
  return {
    bac: { id: bacId },
    nombreInitial,
  };
}

describe("getPoidsMoyenActuelVague", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null si la vague n'existe pas", async () => {
    mockVagueFindFirst.mockResolvedValue(null);
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBeNull();
  });

  it("retourne null si la vague n'a aucune assignation active", async () => {
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 100,
      // ADR-043 Phase 3: assignations au lieu de bacs
      assignations: [],
      releves: [],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBeNull();
  });

  it("retourne null si aucune biometrie n'a ete enregistree", async () => {
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 100,
      assignations: [makeAssignation("b-1", 100)],
      releves: [],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBeNull();
  });

  it("retourne la derniere biometrie pour un bac unique", async () => {
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 100,
      assignations: [makeAssignation("b-1", 100)],
      releves: [
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-01-01"),
          bacId: "b-1",
          poidsMoyen: 500,
          nombreMorts: null,
          nombreCompte: null,
        },
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-02-01"),
          bacId: "b-1",
          poidsMoyen: 800,
          nombreMorts: null,
          nombreCompte: null,
        },
      ],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    // 100 vivants, dernier poids 800 → moyenne = 800
    expect(result).toBe(800);
  });

  it("calcule la moyenne ponderee par vivants pour plusieurs bacs", async () => {
    // Bac A : 100 vivants, dernier poids 1000 g
    // Bac B : 50 vivants, dernier poids 400 g
    // Moyenne ponderee = (100*1000 + 50*400) / (100+50) = 120000/150 = 800
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 150,
      assignations: [
        makeAssignation("b-A", 100),
        makeAssignation("b-B", 50),
      ],
      releves: [
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-02-01"),
          bacId: "b-A",
          poidsMoyen: 1000,
          nombreMorts: null,
          nombreCompte: null,
        },
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-02-01"),
          bacId: "b-B",
          poidsMoyen: 400,
          nombreMorts: null,
          nombreCompte: null,
        },
      ],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBe(800);
  });

  it("ne prend en compte que la derniere biometrie par bac (les releves arrivent tries asc)", async () => {
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 100,
      assignations: [makeAssignation("b-1", 100)],
      releves: [
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-01-01"),
          bacId: "b-1",
          poidsMoyen: 300,
          nombreMorts: null,
          nombreCompte: null,
        },
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-03-01"),
          bacId: "b-1",
          poidsMoyen: 900,
          nombreMorts: null,
          nombreCompte: null,
        },
      ],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBe(900);
  });

  it("ignore les bacs sans biometrie dans le calcul de la moyenne", async () => {
    // Bac A : biometrie 800 g, 50 vivants → contribue
    // Bac B : pas de biometrie, 50 vivants → ignore
    // Moyenne = 800
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 100,
      assignations: [
        makeAssignation("b-A", 50),
        makeAssignation("b-B", 50),
      ],
      releves: [
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-02-01"),
          bacId: "b-A",
          poidsMoyen: 800,
          nombreMorts: null,
          nombreCompte: null,
        },
      ],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBe(800);
  });

  it("tient compte de la mortalite pour calculer les vivants par bac", async () => {
    // Bac A : 100 initial - 50 morts = 50 vivants, poids 1000 g
    // Bac B : 100 initial - 0 morts = 100 vivants, poids 500 g
    // Moyenne ponderee = (50*1000 + 100*500) / (50+100) = 100000/150 = 666.67
    mockVagueFindFirst.mockResolvedValue({
      nombreInitial: 200,
      assignations: [
        makeAssignation("b-A", 100),
        makeAssignation("b-B", 100),
      ],
      releves: [
        {
          typeReleve: "MORTALITE",
          date: new Date("2026-01-15"),
          bacId: "b-A",
          poidsMoyen: null,
          nombreMorts: 50,
          nombreCompte: null,
        },
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-02-01"),
          bacId: "b-A",
          poidsMoyen: 1000,
          nombreMorts: null,
          nombreCompte: null,
        },
        {
          typeReleve: TypeReleve.BIOMETRIE,
          date: new Date("2026-02-01"),
          bacId: "b-B",
          poidsMoyen: 500,
          nombreMorts: null,
          nombreCompte: null,
        },
      ],
    });
    const result = await getPoidsMoyenActuelVague("site-1", "v-1");
    expect(result).toBe(666.67);
  });
});
