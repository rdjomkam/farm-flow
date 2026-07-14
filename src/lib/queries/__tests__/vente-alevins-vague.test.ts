/**
 * Tests — createVenteAlevinsDepuisVague (Sprint VA, Story VA.6)
 *
 * Couvre :
 * 1. Vente valide (3 bacs actifs) → Vente ALEVINS_PG + LigneVente + relevés VENTE + AssignationBac décrémentés
 * 2. Quantité > vivants → Error "Stock insuffisant"
 * 3. Vague pas PRE_GROSSISSEMENT → ValidationError
 * 4. Auto-clôture + tous bacs vidés → vague TERMINEE + AssignationBac fermées
 * 5. Guard invariant cassé → ConservationError (rollback)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVenteAlevinsDepuisVague } from "@/lib/queries/ventes";
import { ValidationError, ConservationError } from "@/lib/errors";
import { StatutVague, TypeVague, OrigineVente, TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockClientFindFirst = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();
const mockLigneVenteCreate = vi.fn();
const mockReleveFindMany = vi.fn();
const mockReleveCreate = vi.fn();
const mockVenteFindFirst = vi.fn();
const mockVenteCreate = vi.fn();
const mockVenteFindUniqueOrThrow = vi.fn();
const mockVagueUpdate = vi.fn();
const mockDepenseFindFirst = vi.fn();
const mockDepenseCreate = vi.fn();
const mockTransfertGroupeFindManyTx = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
      update: (...args: unknown[]) => mockVagueUpdate(...args),
    },
    client: {
      findFirst: (...args: unknown[]) => mockClientFindFirst(...args),
    },
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
    },
    ligneVente: {
      create: (...args: unknown[]) => mockLigneVenteCreate(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
      create: (...args: unknown[]) => mockReleveCreate(...args),
    },
    vente: {
      findFirst: (...args: unknown[]) => mockVenteFindFirst(...args),
      create: (...args: unknown[]) => mockVenteCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockVenteFindUniqueOrThrow(...args),
    },
    depense: {
      findFirst: (...args: unknown[]) => mockDepenseFindFirst(...args),
      create: (...args: unknown[]) => mockDepenseCreate(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindManyTx(...args),
    },
  };
  return fn(tx);
});

const mockTransfertGroupeFindManyGlobal = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) =>
      mockTransaction(...(args as Parameters<typeof mockTransaction>)),
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindManyGlobal(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VAGUE_ID = "vague-pg-1";
const CLIENT_ID = "client-1";
const BAC1 = "bac-1";
const BAC2 = "bac-2";
const BAC3 = "bac-3";

function makeVaguePG(overrides: Partial<{ statut: StatutVague; type: TypeVague; nombreInitial: number }> = {}) {
  return {
    id: VAGUE_ID,
    code: "PG-001",
    type: TypeVague.PRE_GROSSISSEMENT,
    statut: StatutVague.EN_COURS,
    nombreInitial: 300,
    ...overrides,
  };
}

function makeClient() {
  return { id: CLIENT_ID, nom: "Nurserie interne", isActive: true, isSysteme: true, siteId: SITE_ID };
}

function makeAssignations(nombreActuel = 100) {
  return [BAC1, BAC2, BAC3].map((bacId) => ({
    bacId,
    nombreInitial: 100,
    nombreActuel,
    bac: { nom: bacId },
  }));
}

function makeDTO(overrides: Partial<Parameters<typeof createVenteAlevinsDepuisVague>[2]> = {}) {
  return {
    vagueId: VAGUE_ID,
    clientId: CLIENT_ID,
    dateCommande: "2026-07-15T00:00:00.000Z",
    lignes: [BAC1, BAC2, BAC3].map((bacId) => ({
      bacId,
      nombrePoissons: 50,
      poidsMoyenG: 50,
      prixUnitaireKg: 1000,
    })),
    autoCloture: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 1 });
  mockLigneVenteCreate.mockResolvedValue({});
  mockReleveCreate.mockResolvedValue({});
  mockVenteFindFirst.mockResolvedValue(null);
  mockVenteCreate.mockResolvedValue({ id: "vente-alevins-1" });
  mockVenteFindUniqueOrThrow.mockResolvedValue({
    id: "vente-alevins-1",
    numero: "VTE-2026-001",
    origineType: OrigineVente.ALEVINS_PG,
    lignes: [],
  });
  mockTransfertGroupeFindManyGlobal.mockResolvedValue([]);
  mockTransfertGroupeFindManyTx.mockResolvedValue([]);
  mockVagueUpdate.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Cas 1 — Vente valide
// ---------------------------------------------------------------------------

describe("createVenteAlevinsDepuisVague — vente valide", () => {
  it("crée la Vente ALEVINS_PG, les LigneVente, les relevés VENTE et décrémente AssignationBac", async () => {
    mockVagueFindFirst.mockResolvedValue(makeVaguePG());
    mockClientFindFirst.mockResolvedValue(makeClient());
    mockAssignationBacFindMany
      .mockResolvedValueOnce(makeAssignations(100))
      .mockResolvedValueOnce(
        [BAC1, BAC2, BAC3].map((bacId) => ({
          id: `ab-${bacId}`,
          bacId,
          nombreActuel: 50,
          nombreInitial: 100,
          dateAssignation: null,
        }))
      );
    mockReleveFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        [BAC1, BAC2, BAC3].map((bacId) => ({
          bacId,
          typeReleve: TypeReleve.VENTE,
          date: new Date("2026-07-15"),
          nombreMorts: null,
          nombreCompte: null,
          nombreTransferes: null,
          nombreVendus: 50,
        }))
      );

    const result = await createVenteAlevinsDepuisVague(SITE_ID, USER_ID, makeDTO());

    expect(result).toBeDefined();
    expect(mockVenteCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockVenteCreate.mock.calls[0][0];
    expect(createArgs.data.origineType).toBe(OrigineVente.ALEVINS_PG);
    expect(createArgs.data.vagueId).toBe(VAGUE_ID);
    expect(createArgs.data.quantitePoissons).toBe(150);

    expect(mockLigneVenteCreate).toHaveBeenCalledTimes(3);
    expect(mockReleveCreate).toHaveBeenCalledTimes(3);
    expect(mockAssignationBacUpdateMany).toHaveBeenCalledTimes(3);
    for (const call of mockAssignationBacUpdateMany.mock.calls) {
      expect(call[0].data.nombreActuel).toBe(50);
    }
  });
});

// ---------------------------------------------------------------------------
// Cas 2 — Quantité > vivants
// ---------------------------------------------------------------------------

describe("createVenteAlevinsDepuisVague — stock insuffisant", () => {
  it("rejette sans écrire quand nombrePoissons > vivants disponibles", async () => {
    mockVagueFindFirst.mockResolvedValue(makeVaguePG());
    mockClientFindFirst.mockResolvedValue(makeClient());
    mockAssignationBacFindMany.mockResolvedValueOnce(makeAssignations(100));
    mockReleveFindMany.mockResolvedValueOnce([]);

    const dto = makeDTO({
      lignes: [{ bacId: BAC1, nombrePoissons: 150, poidsMoyenG: 50, prixUnitaireKg: 1000 }],
    });

    const err = await createVenteAlevinsDepuisVague(SITE_ID, USER_ID, dto).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Stock insuffisant|dépasse|excède/i);
    expect(mockVenteCreate).not.toHaveBeenCalled();
    expect(mockAssignationBacUpdateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cas 3 — Vague pas PRE_GROSSISSEMENT
// ---------------------------------------------------------------------------

describe("createVenteAlevinsDepuisVague — type de vague invalide", () => {
  it("rejette avec ValidationError si la vague est GROSSISSEMENT", async () => {
    mockVagueFindFirst.mockResolvedValue(makeVaguePG({ type: TypeVague.GROSSISSEMENT }));

    const err = await createVenteAlevinsDepuisVague(SITE_ID, USER_ID, makeDTO()).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("PRE_GROSSISSEMENT");
    expect(mockVenteCreate).not.toHaveBeenCalled();
  });

  it("rejette avec ValidationError si la vague n'est pas EN_COURS", async () => {
    mockVagueFindFirst.mockResolvedValue(makeVaguePG({ statut: StatutVague.TERMINEE }));

    const err = await createVenteAlevinsDepuisVague(SITE_ID, USER_ID, makeDTO()).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message.toLowerCase()).toContain("statut");
  });
});

// ---------------------------------------------------------------------------
// Cas 4 — Auto-clôture
// ---------------------------------------------------------------------------

describe("createVenteAlevinsDepuisVague — auto-clôture", () => {
  it("clôture la vague et ferme les AssignationBac quand tous les bacs sont vidés", async () => {
    mockVagueFindFirst.mockResolvedValue(makeVaguePG());
    mockClientFindFirst.mockResolvedValue(makeClient());
    mockAssignationBacFindMany
      .mockResolvedValueOnce(makeAssignations(100))
      .mockResolvedValueOnce(
        [BAC1, BAC2, BAC3].map((bacId) => ({
          id: `ab-${bacId}`,
          bacId,
          nombreActuel: 0,
          nombreInitial: 100,
          dateAssignation: null,
        }))
      );
    const soldReleves = [BAC1, BAC2, BAC3].map((bacId) => ({
      bacId,
      typeReleve: TypeReleve.VENTE,
      date: new Date("2026-07-15"),
      nombreMorts: null,
      nombreCompte: null,
      nombreTransferes: null,
      nombreVendus: 100,
    }));
    mockReleveFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(soldReleves)
      .mockResolvedValueOnce(soldReleves);

    const dto = makeDTO({
      lignes: [BAC1, BAC2, BAC3].map((bacId) => ({
        bacId,
        nombrePoissons: 100,
        poidsMoyenG: 50,
        prixUnitaireKg: 1000,
      })),
      autoCloture: true,
    });

    await createVenteAlevinsDepuisVague(SITE_ID, USER_ID, dto);

    expect(mockVagueUpdate).toHaveBeenCalledTimes(1);
    expect(mockVagueUpdate.mock.calls[0][0].data.statut).toBe(StatutVague.TERMINEE);
    // 3 updateMany pour déduction + 1 fermeture
    expect(mockAssignationBacUpdateMany.mock.calls.length).toBeGreaterThanOrEqual(4);
    const closureCall = mockAssignationBacUpdateMany.mock.calls.at(-1)![0];
    expect(closureCall.data.dateFin).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Cas 5 — Guard invariant cassé
// ---------------------------------------------------------------------------

describe("createVenteAlevinsDepuisVague — guard invariant", () => {
  it("throw ConservationError et n'atteint pas le fetch final si l'invariant est cassé", async () => {
    mockVagueFindFirst.mockResolvedValue(makeVaguePG());
    mockClientFindFirst.mockResolvedValue(makeClient());
    mockAssignationBacFindMany
      .mockResolvedValueOnce(makeAssignations(100))
      .mockResolvedValueOnce([
        { id: `ab-${BAC1}`, bacId: BAC1, nombreActuel: 999, nombreInitial: 100, dateAssignation: null },
      ]);
    mockReleveFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const dto = makeDTO({
      lignes: [{ bacId: BAC1, nombrePoissons: 50, poidsMoyenG: 50, prixUnitaireKg: 1000 }],
    });

    const err = await createVenteAlevinsDepuisVague(SITE_ID, USER_ID, dto).catch((e) => e);

    expect(err).toBeInstanceOf(ConservationError);
    expect(mockVenteFindUniqueOrThrow).not.toHaveBeenCalled();
  });
});
