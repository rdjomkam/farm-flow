/**
 * Tests — cloturerVente avec avaries (Sprint AV, Story AV.7)
 *
 * Couvre :
 * 1. Régression bug racine : poidsLivré < commandé + nombreMortsTransport=0 → AUCUN MORTALITE
 * 2. Morts explicites → MORTALITE cause=AVARIE + LigneVente/VENTE relevé décrémentés + ReleveModification
 * 3. Cas mixte : morts + perte poids → 1 seul MORTALITE, pas de mort fictif
 * 4. Dépassement (morts > commandé) → ValidationError
 * 5. Stock bac inchangé
 * 6. Rétrocompat : DTO sans lignes → 0 morts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cloturerVente } from "@/lib/queries/ventes";
import { ValidationError } from "@/lib/errors";
import { StatutVente, TypeReleve, CauseMortalite, StatutBonLivraison } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVenteFindFirst = vi.fn();
const mockVenteUpdate = vi.fn();
const mockVenteFindUniqueOrThrow = vi.fn();
const mockLigneVenteUpdate = vi.fn();
const mockReleveFindFirst = vi.fn();
const mockReleveUpdate = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveModificationCreate = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacUpdateMany = vi.fn();
const mockFactureUpdate = vi.fn();
const mockSiteAuditLogCreate = vi.fn();
const mockTransfertGroupeFindManyTx = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vente: {
      findFirst: (...args: unknown[]) => mockVenteFindFirst(...args),
      update: (...args: unknown[]) => mockVenteUpdate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockVenteFindUniqueOrThrow(...args),
    },
    ligneVente: {
      update: (...args: unknown[]) => mockLigneVenteUpdate(...args),
    },
    releve: {
      findFirst: (...args: unknown[]) => mockReleveFindFirst(...args),
      update: (...args: unknown[]) => mockReleveUpdate(...args),
      create: (...args: unknown[]) => mockReleveCreate(...args),
      findMany: vi.fn().mockResolvedValue([]),
    },
    releveModification: {
      create: (...args: unknown[]) => mockReleveModificationCreate(...args),
    },
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      updateMany: (...args: unknown[]) => mockAssignationBacUpdateMany(...args),
    },
    facture: {
      update: (...args: unknown[]) => mockFactureUpdate(...args),
    },
    siteAuditLog: {
      create: (...args: unknown[]) => mockSiteAuditLogCreate(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindManyTx(...args),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...(args as Parameters<typeof mockTransaction>)),
    transfertGroupe: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VENTE_ID = "vente-1";
const LIGNE_ID = "ligne-1";
const BAC_ID = "bac-1";
const VAGUE_ID = "vague-1";

function makeVente(overrides: Partial<{
  statut: StatutVente;
  quantitePoissons: number;
  poidsTotalKg: number;
  prixUnitaireKg: number;
}> = {}) {
  return {
    id: VENTE_ID,
    numero: "VTE-2026-001",
    statut: StatutVente.EN_PREPARATION,
    quantitePoissons: 100,
    poidsTotalKg: 100,
    prixUnitaireKg: 1000,
    dateCommande: new Date("2026-07-15"),
    factureId: null,
    siteId: SITE_ID,
    client: { nom: "Test Client" },
    bonLivraison: { statut: StatutBonLivraison.SIGNE },
    lignes: [
      {
        id: LIGNE_ID,
        bacId: BAC_ID,
        vagueId: VAGUE_ID,
        nombrePoissons: 100,
        poidsTotalKg: 100,
        poidsMoyenG: 1000,
        poidsLivreKg: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockVenteUpdate.mockResolvedValue({});
  mockVenteFindUniqueOrThrow.mockResolvedValue({ id: VENTE_ID, statut: StatutVente.LIVREE, lignes: [] });
  mockLigneVenteUpdate.mockResolvedValue({});
  mockReleveUpdate.mockResolvedValue({});
  mockReleveCreate.mockResolvedValue({});
  mockReleveModificationCreate.mockResolvedValue({});
  mockAssignationBacFindMany.mockResolvedValue([]);
  mockAssignationBacUpdateMany.mockResolvedValue({ count: 0 });
  mockFactureUpdate.mockResolvedValue({});
  mockSiteAuditLogCreate.mockResolvedValue({});
  mockReleveFindFirst.mockResolvedValue({
    id: "releve-vente-1",
    typeReleve: TypeReleve.VENTE,
    bacId: BAC_ID,
    vagueId: VAGUE_ID,
    nombreVendus: 100,
    venteId: VENTE_ID,
  });
  mockTransfertGroupeFindManyTx.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Cas 1 — Régression bug racine
// ---------------------------------------------------------------------------

describe("cloturerVente — régression bug conversion kg→morts", () => {
  it("perte poids sans morts saisis → AUCUN MORTALITE créé", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente());

    await cloturerVente(SITE_ID, USER_ID, VENTE_ID, {
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 95, // 5 kg perdus déshydratation, aucune mort
          nombreMortsTransport: 0,
        },
      ],
    });

    // Aucun relevé MORTALITE créé pour la perte de poids
    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls.length).toBe(0);

    // LigneVente.nombrePoissons pas modifié (pas de mort saisi)
    const ligneUpdateCalls = mockLigneVenteUpdate.mock.calls;
    for (const call of ligneUpdateCalls) {
      expect(call[0].data.nombrePoissons).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Cas 2 — Morts explicites
// ---------------------------------------------------------------------------

describe("cloturerVente — morts transport explicites", () => {
  it("nombreMortsTransport=5 → MORTALITE(5) créé + LigneVente/VENTE décrémentés", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente());

    await cloturerVente(SITE_ID, USER_ID, VENTE_ID, {
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 100,
          nombreMortsTransport: 5,
          motifAvarie: "chaleur excessive",
        },
      ],
    });

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls.length).toBe(1);
    const mortaliteData = mortaliteCalls[0][0].data;
    expect(mortaliteData.causeMortalite).toBe(CauseMortalite.AVARIE);
    expect(mortaliteData.nombreMorts).toBe(5);
    expect(mortaliteData.venteId).toBeDefined();
    expect(mortaliteData.bacId).toBeDefined();

    // LigneVente.nombrePoissons décrémenté de 5
    const ligneUpdateWithNombre = mockLigneVenteUpdate.mock.calls.find(
      (call) => call[0].data.nombrePoissons !== undefined
    );
    expect(ligneUpdateWithNombre).toBeDefined();
    expect(ligneUpdateWithNombre![0].data.nombrePoissons).toBe(95);

    // Relevé VENTE décrémenté
    expect(mockReleveUpdate).toHaveBeenCalled();
    // ReleveModification créée
    expect(mockReleveModificationCreate).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cas 3 — Cas mixte
// ---------------------------------------------------------------------------

describe("cloturerVente — cas mixte (morts + perte poids)", () => {
  it("5 morts + poidsLivré=95 → 1 seul MORTALITE(5), pas de mort fictif", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente());

    await cloturerVente(SITE_ID, USER_ID, VENTE_ID, {
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 95,
          nombreMortsTransport: 5,
        },
      ],
    });

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    // Exactement 1 MORTALITE (les 5 saisis, pas de fictifs pour les 5 kg perdus)
    expect(mortaliteCalls.length).toBe(1);
    expect(mortaliteCalls[0][0].data.nombreMorts).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Cas 4 — Dépassement
// ---------------------------------------------------------------------------

describe("cloturerVente — dépassement morts", () => {
  it("nombreMortsTransport > nombrePoissons → ValidationError, aucune écriture", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente());

    const err = await cloturerVente(SITE_ID, USER_ID, VENTE_ID, {
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 100,
          nombreMortsTransport: 150, // > 100 commandés
        },
      ],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
    expect(mockReleveCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cas 5 — Stock bac inchangé
// ---------------------------------------------------------------------------

describe("cloturerVente — invariant stock bac", () => {
  it("assignationBac.nombreActuel n'est JAMAIS retouché lors de la clôture", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente());

    await cloturerVente(SITE_ID, USER_ID, VENTE_ID, {
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 100,
          nombreMortsTransport: 5,
        },
      ],
    });

    // Aucun updateMany sur AssignationBac (le stock est immuable à la clôture)
    const stockUpdates = mockAssignationBacUpdateMany.mock.calls;
    expect(stockUpdates.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cas 6 — Rétrocompatibilité
// ---------------------------------------------------------------------------

describe("cloturerVente — rétrocompat DTO sans lignes", () => {
  it("DTO sans lignes → 0 morts partout, aucun MORTALITE créé", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente());
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await cloturerVente(SITE_ID, USER_ID, VENTE_ID, {
      poidsLivreKg: 100, // legacy DTO
    });

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls.length).toBe(0);

    warnSpy.mockRestore();
  });
});
