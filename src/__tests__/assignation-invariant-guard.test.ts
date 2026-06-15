/**
 * Tests CS.3 — Post-write guard sur l'invariant AssignationBac
 *
 * Vérifie que :
 * - verifyAssignationInvariant ne lance pas d'erreur quand nombreActuel est correct.
 * - verifyAssignationInvariant lance ConservationError si nombreActuel est falsifié.
 * - Le guard respecte la logique COMPTAGE comme override de base de calcul.
 * - Les TRANSFERT entrants (bacDestId) sont traités en ajout (+), sortants en soustraction (-).
 * - Les ARRIVAGE (post-comptage) sont ajoutés.
 * - Un tableau vide de bacIds retourne immédiatement sans erreur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyAssignationInvariant } from "@/lib/guards/assignation-invariant";
import { ConservationError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockAssignationBacFindMany = vi.fn();
const mockReleveFindMany = vi.fn();
const mockTransfertGroupeFindMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockTransaction(fn),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit un objet tx mock minimal pour appeler verifyAssignationInvariant.
 * Les mocks globaux sont déjà configurés par beforeEach.
 */
function buildTx() {
  return {
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
  } as unknown as Parameters<typeof verifyAssignationInvariant>[0];
}

const SITE_ID = "site-1";
const VAGUE_ID = "vague-1";
const BAC_A = "bac-a";
const BAC_B = "bac-b";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Cas 1 : liste vide → retour immédiat sans erreur
// ---------------------------------------------------------------------------

describe("verifyAssignationInvariant", () => {
  it("retourne immédiatement sans requête si bacIds est vide", async () => {
    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, []),
    ).resolves.toBeUndefined();

    expect(mockAssignationBacFindMany).not.toHaveBeenCalled();
    expect(mockReleveFindMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cas 2 : invariant OK — transfert valide (1000 initial, -200 transfert)
  // -------------------------------------------------------------------------

  it("ne lance pas d'erreur quand nombreActuel correspond au replay (transfert sortant)", async () => {
    // AssignationBac : 800 actuels, 1000 initial
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 800, nombreInitial: 1000 },
    ]);
    // Relevés : 1 TRANSFERT sortant de 200
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "TRANSFERT",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 200,
        nombreVendus: null,
      },
    ]);
    // Pas de TransfertGroupe entrant pour ce bac
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Cas 3 : invariant CASSÉ — nombreActuel falsifié manuellement
  // -------------------------------------------------------------------------

  it("lance ConservationError si nombreActuel ne correspond pas au calcul", async () => {
    // AssignationBac : 900 actuels mais on s'attendait à 800
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 900, nombreInitial: 1000 },
    ]);
    // Relevés : 1 TRANSFERT sortant de 200 → attendu 800
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "TRANSFERT",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 200,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).rejects.toThrow(ConservationError);
  });

  // -------------------------------------------------------------------------
  // Cas 4 : transfert entrant (GROSSISSEMENT) — ajout
  // -------------------------------------------------------------------------

  it("traite les TRANSFERT entrants comme ajout (+)", async () => {
    // Bac destination : 500 actuels, 0 initial, 500 arrivés par transfert entrant
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-dest", bacId: BAC_B, nombreActuel: 500, nombreInitial: 0 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_B,
        typeReleve: "TRANSFERT",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 500,
        nombreVendus: null,
      },
    ]);
    // BAC_B est un bac de destination (entrant)
    mockTransfertGroupeFindMany.mockResolvedValueOnce([
      { bacDestId: BAC_B },
    ]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_B]),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Cas 5 : COMPTAGE override — base = COMPTAGE, puis replay post-comptage
  // -------------------------------------------------------------------------

  it("utilise le COMPTAGE comme base et rejoue uniquement les opérations postérieures", async () => {
    // Scénario :
    //   - nombreInitial = 1000
    //   - MORTALITE -50 avant comptage (ignorée)
    //   - COMPTAGE 900 (base)
    //   - MORTALITE -100 après comptage → attendu = 800
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 800, nombreInitial: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      // Mortalité avant le comptage : ne doit PAS être rejouée
      {
        bacId: BAC_A,
        typeReleve: "MORTALITE",
        date: new Date("2026-01-01"),
        nombreMorts: 50,
        nombreCompte: null,
        nombreTransferes: null,
        nombreVendus: null,
      },
      // COMPTAGE : base = 900
      {
        bacId: BAC_A,
        typeReleve: "COMPTAGE",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: 900,
        nombreTransferes: null,
        nombreVendus: null,
      },
      // Mortalité après le comptage : doit être déduite
      {
        bacId: BAC_A,
        typeReleve: "MORTALITE",
        date: new Date("2026-01-03"),
        nombreMorts: 100,
        nombreCompte: null,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Cas 6 : COMPTAGE override cassé → ConservationError
  // -------------------------------------------------------------------------

  it("lance ConservationError si nombreActuel ne correspond pas après COMPTAGE override", async () => {
    // Attendu : 900 - 100 = 800. Enregistré : 750 (falsifié)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 750, nombreInitial: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "COMPTAGE",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: 900,
        nombreTransferes: null,
        nombreVendus: null,
      },
      {
        bacId: BAC_A,
        typeReleve: "MORTALITE",
        date: new Date("2026-01-03"),
        nombreMorts: 100,
        nombreCompte: null,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).rejects.toThrow(ConservationError);
  });

  // -------------------------------------------------------------------------
  // Cas 7 : ARRIVAGE valide → OK
  // -------------------------------------------------------------------------

  it("prend en compte les ARRIVAGE comme ajout", async () => {
    // 1000 initial + 200 arrivage = 1200 attendu
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1200, nombreInitial: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "ARRIVAGE",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: 200,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Cas 8 : VENTE valide → OK
  // -------------------------------------------------------------------------

  it("prend en compte les VENTE comme soustraction", async () => {
    // 1000 initial - 300 vendus = 700 attendu
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 700, nombreInitial: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "VENTE",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: null,
        nombreVendus: 300,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Cas 9 : transfert entrant cassé → ConservationError
  // -------------------------------------------------------------------------

  it("lance ConservationError si un transfert entrant est mal comptabilisé", async () => {
    // Attendu : 0 + 500 = 500. Enregistré : 400 (falsifié)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-dest", bacId: BAC_B, nombreActuel: 400, nombreInitial: 0 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_B,
        typeReleve: "TRANSFERT",
        date: new Date("2026-01-02"),
        nombreMorts: null,
        nombreCompte: null,
        nombreTransferes: 500,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([{ bacDestId: BAC_B }]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_B]),
    ).rejects.toThrow(ConservationError);
  });

  // -------------------------------------------------------------------------
  // Cas 10 : aucune assignation active → pas d'erreur (guard passthrough)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Cas 11 : CX.2 — COMPTAGE créé exactement au même instant que dateAssignation
  //           → doit être inclus dans le replay (filtre >= et non >)
  // -------------------------------------------------------------------------

  it("compte les relevés créés au même instant que dateAssignation (CX.2)", async () => {
    // AssignationBac dateAssignation = 2026-06-15T10:00:00Z
    // COMPTAGE relevé date = 2026-06-15T10:00:00Z (exactement le même instant)
    // nombreInitial = 0, nombrePoissons = 100, nombreCompte = 100
    // → guard doit utiliser le COMPTAGE comme base → expected = 100 = actual → pas d'erreur
    const assignationDate = new Date("2026-06-15T10:00:00Z");
    mockAssignationBacFindMany.mockResolvedValueOnce([
      {
        id: "ab-cx2",
        bacId: BAC_A,
        nombreActuel: 100,
        nombreInitial: 0,
        dateAssignation: assignationDate,
      },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "COMPTAGE",
        date: assignationDate, // même instant — doit être inclus avec >=
        nombreMorts: null,
        nombreCompte: 100,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Cas 12 : non-régression CX.2 — relevé STRICTEMENT antérieur à dateAssignation
  //           → doit être exclu (assignation précédente déjà clôturée)
  // -------------------------------------------------------------------------

  it("exclut les relevés strictement antérieurs à dateAssignation (non-régression CX.2)", async () => {
    // dateAssignation = 2026-06-15T10:00:00Z
    // MORTALITE -50 à 2026-06-14T10:00:00Z (antérieur) → exclue
    // → replay depuis nombreInitial = 100, aucun relevé postérieur → expected = 100 = actual → OK
    const assignationDate = new Date("2026-06-15T10:00:00Z");
    mockAssignationBacFindMany.mockResolvedValueOnce([
      {
        id: "ab-cx2-nr",
        bacId: BAC_A,
        nombreActuel: 100,
        nombreInitial: 100,
        dateAssignation: assignationDate,
      },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([
      {
        bacId: BAC_A,
        typeReleve: "MORTALITE",
        date: new Date("2026-06-14T10:00:00Z"), // strictement antérieur → exclu
        nombreMorts: 50,
        nombreCompte: null,
        nombreTransferes: null,
        nombreVendus: null,
      },
    ]);
    mockTransfertGroupeFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();
  });

  it("ne lance pas d'erreur si aucune assignation active trouvée pour les bacIds", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]),
    ).resolves.toBeUndefined();

    expect(mockReleveFindMany).not.toHaveBeenCalled();
  });
});
