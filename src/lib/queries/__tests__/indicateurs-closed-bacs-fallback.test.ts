/**
 * Tests régression — poidsMoyen/biomasse/SGR/FCR doivent être non-null
 * même quand le seul bac actif n'a pas de biométrie, si des biométries
 * existent sur des bacs dont l'AssignationBac est fermée.
 *
 * Régression Vague 26-01 :
 *   5500 poissons initiaux, 38 biométries sur Bac 01-04 (assignations fermées)
 *   Bac test (seul actif, 124 vivants) n'a aucune biométrie
 *   → poidsMoyen/biomasse/sgr/fcr doivent utiliser la dernière biométrie connue
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
// Helpers
// ---------------------------------------------------------------------------

function makeBio(
  bacId: string,
  poidsMoyen: number,
  date = new Date("2026-01-15"),
  tailleMoyenne: number | null = null
) {
  return {
    typeReleve: TypeReleve.BIOMETRIE,
    date,
    bacId,
    poidsMoyen,
    tailleMoyenne,
    nombreMorts: null,
    nombreVendus: null,
    nombreTransferes: null,
    quantiteAliment: null,
    nombreCompte: null,
  };
}

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

function makeAlim(bacId: string, quantiteAliment: number, date = new Date("2026-01-12")) {
  return {
    typeReleve: TypeReleve.ALIMENTATION,
    date,
    bacId,
    poidsMoyen: null,
    tailleMoyenne: null,
    nombreMorts: null,
    nombreVendus: null,
    nombreTransferes: null,
    quantiteAliment,
    nombreCompte: null,
  };
}

function makeVague(overrides: {
  nombreInitial: number;
  poidsMoyenInitial: number;
  releves: ReturnType<typeof makeBio | typeof makeMort | typeof makeAlim>[];
  assignations: { bac: { id: string }; nombreInitial: number | null; poidsMoyenInitial: number | null }[];
  dateFin?: Date | null;
}) {
  return {
    id: "vague-test",
    siteId: "site-test",
    nombreInitial: overrides.nombreInitial,
    poidsMoyenInitial: overrides.poidsMoyenInitial,
    dateDebut: new Date("2026-01-01"),
    dateFin: overrides.dateFin ?? null,
    assignations: overrides.assignations,
    releves: overrides.releves,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getIndicateursVague — fallback biométrie bacs fermés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransfertGroupeFindMany.mockResolvedValue([]);
  });

  it("Régression Vague 26-01 : bac actif sans biométrie → utilise dernière bio des bacs fermés", async () => {
    // Bac test : seul actif, 124 vivants initiaux, 0 morts, 0 biométrie
    // Bac 01-04 : assignations fermées (pas dans assignations[]), biométries existantes
    // Dernière biométrie : 520g sur bac-02 (date la plus récente)
    const releves = [
      makeBio("bac-01", 480, new Date("2026-01-10")),
      makeBio("bac-02", 510, new Date("2026-01-12")),
      makeBio("bac-03", 490, new Date("2026-01-13")),
      makeBio("bac-02", 520, new Date("2026-01-20")), // dernière biométrie
      makeMort("bac-test", 0),
      makeAlim("bac-test", 50),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 5500,
        poidsMoyenInitial: 10,
        releves,
        assignations: [
          { bac: { id: "bac-test" }, nombreInitial: 124, poidsMoyenInitial: 10 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    // poidsMoyen doit venir de la dernière biométrie de la vague (520g)
    expect(result!.poidsMoyen).toBe(520);
    // biomasse = 520 * 124 / 1000 = 64.48 kg
    expect(result!.biomasse).toBeCloseTo(64.48, 1);
    // sgr doit être calculable (poidsMoyen non-null)
    expect(result!.sgr).not.toBeNull();
  });

  it("Cas standard : bac actif AVEC biométrie → comportement actuel inchangé (pas de régression)", async () => {
    const releves = [
      makeBio("bac-01", 480, new Date("2026-01-10")), // bac fermé
      makeBio("bac-active", 600, new Date("2026-01-20")), // bac actif avec bio
      makeMort("bac-active", 20),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 1000,
        poidsMoyenInitial: 10,
        releves,
        assignations: [
          { bac: { id: "bac-active" }, nombreInitial: 1000, poidsMoyenInitial: 10 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    // Le bac actif a une bio à 600g → poidsMoyen doit être 600, PAS 480
    expect(result!.poidsMoyen).toBe(600);
    // nombreVivants = 1000 - 20 = 980
    expect(result!.nombreVivants).toBe(980);
    // biomasse = 600 * 980 / 1000 = 588 kg
    expect(result!.biomasse).toBeCloseTo(588, 0);
  });

  it("Aucune biométrie du tout → poidsMoyen et biomasse restent null", async () => {
    const releves = [
      makeMort("bac-active", 10),
      makeAlim("bac-active", 30),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 500,
        poidsMoyenInitial: 5,
        releves,
        assignations: [
          { bac: { id: "bac-active" }, nombreInitial: 500, poidsMoyenInitial: 5 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    expect(result!.poidsMoyen).toBeNull();
    expect(result!.biomasse).toBeNull();
    // tauxSurvie reste calculable (dépend uniquement de mortalités)
    expect(result!.tauxSurvie).toBeCloseTo(98, 1); // (500-10)/500 * 100 = 98%
  });

  it("Plusieurs bacs actifs dont UN SEUL a une biométrie → weighted average (pas de fallback)", async () => {
    // bac-a : 500 vivants, bio à 400g
    // bac-b : 500 vivants, pas de bio
    const releves = [
      makeBio("bac-a", 400, new Date("2026-01-15")),
      makeBio("bac-closed", 300, new Date("2026-01-10")), // bac fermé ignoré pour weighted
      makeMort("bac-a", 0),
      makeMort("bac-b", 0),
    ];

    mockVagueFindFirst.mockResolvedValue(
      makeVague({
        nombreInitial: 1000,
        poidsMoyenInitial: 8,
        releves,
        assignations: [
          { bac: { id: "bac-a" }, nombreInitial: 500, poidsMoyenInitial: 8 },
          { bac: { id: "bac-b" }, nombreInitial: 500, poidsMoyenInitial: 8 },
        ],
      })
    );

    const result = await getIndicateursVague("site-test", "vague-test");

    expect(result).not.toBeNull();
    // Seul bac-a a une bio → poidsMoyen = 400g (weighted par vivants de bac-a seulement)
    expect(result!.poidsMoyen).toBe(400);
    // biomasse = 400 * 500 / 1000 = 200 kg (uniquement bac-a qui a une bio)
    expect(result!.biomasse).toBeCloseTo(200, 0);
  });
});
