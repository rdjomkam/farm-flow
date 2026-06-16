/**
 * Tests régression — totalMortalites doit inclure les morts sur les bacs fermés
 *
 * Régression Vague 26-01 :
 *   5500 poissons initiaux, 795 morts répartis sur 3 bacs aux AssignationBac FERMÉES
 *   + 1 bac actif avec 0 morts → tauxSurvie attendu : 85.5%
 *
 * Avant le fix : le path per-bac itérait uniquement sur bacsFromAssignations (actifs)
 * et ignorait les relevés de mortalité sur les bacs dont l'assignation était fermée.
 * Résultat : totalMortalites ≈ 0 → tauxSurvie faussement 100%.
 *
 * Après le fix : totalMortalites = reduce sur tous les relevés MORTALITE de la vague,
 * identique au comportement du path fallback.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma + transferts
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockTransfertGroupeFindMany = vi.fn();

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

// ---------------------------------------------------------------------------
// Helpers de construction de relevés
// ---------------------------------------------------------------------------

function makeMort(bacId: string, nombreMorts: number, date = new Date("2026-01-10")) {
  return {
    typeReleve: TypeReleve.MORTALITE,
    date,
    bacId,
    poidsMoyen: null,
    tailleMoyenne: null,
    nombreMorts,
    nombreVendus: null,
    nombreTransferes: null,
    quantiteAliment: null,
    nombreCompte: null,
  };
}

function makeBio(bacId: string, poidsMoyen: number, date = new Date("2026-01-15")) {
  return {
    typeReleve: TypeReleve.BIOMETRIE,
    date,
    bacId,
    poidsMoyen,
    tailleMoyenne: null,
    nombreMorts: null,
    nombreVendus: null,
    nombreTransferes: null,
    quantiteAliment: null,
    nombreCompte: null,
  };
}

function makeVague(overrides: {
  nombreInitial: number;
  poidsMoyenInitial: number;
  releves: ReturnType<typeof makeMort | typeof makeBio>[];
  assignations: { bac: { id: string }; nombreInitial: number | null; poidsMoyenInitial: number | null }[];
}) {
  return {
    id: "vague-test",
    siteId: "site-test",
    nombreInitial: overrides.nombreInitial,
    poidsMoyenInitial: overrides.poidsMoyenInitial,
    dateDebut: new Date("2026-01-01"),
    dateFin: null,
    assignations: overrides.assignations,
    releves: overrides.releves,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getIndicateursVague — totalMortalites inclut les bacs fermés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : pas de transfertGroupe (pas de bacDestId entrant)
    mockTransfertGroupeFindMany.mockResolvedValue([]);
  });

  it("Régression Vague 26-01 : 795 morts sur 3 bacs fermés + 1 bac actif → tauxSurvie 85.5%", async () => {
    // Seul bac actif : bac-test (124 poissons, 0 morts)
    // Les 3 autres bacs (bac-01, bac-02, bac-03) ont des AssignationBac fermées
    // Leurs relevés de mortalité sont toujours liés à la vague
    const releves = [
      makeMort("bac-01", 300),  // bac fermé — 300 morts
      makeMort("bac-02", 250),  // bac fermé — 250 morts
      makeMort("bac-03", 245),  // bac fermé — 245 morts
      makeMort("bac-test", 0),  // bac actif  — 0 morts
      makeBio("bac-test", 500),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 5500,
        poidsMoyenInitial: 10,
        releves,
        assignations: [
          // Uniquement le bac actif dans les assignations (dateFin: null)
          { bac: { id: "bac-test" }, nombreInitial: 124, poidsMoyenInitial: 10 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    // totalMortalites = 300 + 250 + 245 + 0 = 795
    expect(result!.totalMortalites).toBe(795);
    // tauxSurvie = (5500 - 795) / 5500 * 100 = 85.5454...% → arrondi 2 décimales
    expect(result!.tauxSurvie).toBeCloseTo(85.55, 1);
  });

  it("Cas standard : 1000 init + 50 morts sur bac actif → tauxSurvie 95%", async () => {
    const releves = [
      makeMort("bac-a", 50),
      makeBio("bac-a", 300),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 1000,
        poidsMoyenInitial: 5,
        releves,
        assignations: [
          { bac: { id: "bac-a" }, nombreInitial: 1000, poidsMoyenInitial: 5 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    expect(result!.totalMortalites).toBe(50);
    expect(result!.tauxSurvie).toBeCloseTo(95, 1);
  });

  it("Cas mixed : 10 morts sur bac actif + 40 morts sur bac fermé / 1000 init → tauxSurvie 95%", async () => {
    // bac-active est actif, bac-closed est fermé (pas dans assignations)
    const releves = [
      makeMort("bac-active", 10),
      makeMort("bac-closed", 40),
      makeBio("bac-active", 400),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 1000,
        poidsMoyenInitial: 8,
        releves,
        assignations: [
          { bac: { id: "bac-active" }, nombreInitial: 1000, poidsMoyenInitial: 8 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    // totalMortalites doit inclure les 40 morts sur bac-closed
    expect(result!.totalMortalites).toBe(50);
    // tauxSurvie = (1000 - 50) / 1000 * 100 = 95%
    expect(result!.tauxSurvie).toBeCloseTo(95, 1);
    // nombreVivants = seulement les vivants sur bacs actifs (pas bac-closed)
    // bac-active : 1000 - 10 = 990 vivants
    expect(result!.nombreVivants).toBe(990);
  });
});
