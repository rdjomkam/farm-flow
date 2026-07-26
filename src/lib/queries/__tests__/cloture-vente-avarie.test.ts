/**
 * Tests — signerBonLivraison avec avaries (Sprint AV, Story AV.7 ; porté sur
 * signerBonLivraison par Sprint BF, Story BF.2 — la logique avaries est
 * strictement préservée, seule la source des quantités change : elle vient
 * désormais de `LigneBonLivraison` (saisie avant signature) au lieu du DTO
 * de `cloturerVente`, qui a été démonté.)
 *
 * Couvre :
 * 1. Régression bug racine : poidsLivré < commandé + nombreMortsTransport=0 → AUCUN MORTALITE
 * 2. Morts explicites → MORTALITE cause=AVARIE + LigneVente/VENTE relevé décrémentés + ReleveModification
 * 3. Cas mixte : morts + perte poids → 1 seul MORTALITE, pas de mort fictif
 * 4. Dépassement (morts > commandé) → ValidationError
 * 5. Stock bac inchangé
 * 6. BL sans lignes → ValidationError (remplace l'ancien cas "DTO legacy")
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { signerBonLivraison } from "@/lib/queries/bons-livraison";
import { ValidationError } from "@/lib/errors";
import { StatutVente, StatutBonLivraison, TypeReleve, CauseMortalite } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockBonLivraisonFindFirst = vi.fn();
const mockBonLivraisonUpdateMany = vi.fn();
const mockBonLivraisonFindUniqueOrThrow = vi.fn();
const mockVenteUpdate = vi.fn();
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
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirst(...args),
      updateMany: (...args: unknown[]) => mockBonLivraisonUpdateMany(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockBonLivraisonFindUniqueOrThrow(...args),
    },
    vente: {
      update: (...args: unknown[]) => mockVenteUpdate(...args),
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
const BL_ID = "bl-1";
const VENTE_ID = "vente-1";
const LIGNE_ID = "ligne-1";
const BAC_ID = "bac-1";
const VAGUE_ID = "vague-1";

const SIGNATURE_DTO = {
  signatureClient: "data:image/png;base64,AAA",
  signataireClientNom: "Jean Dupont",
  signatureLivreur: "data:image/png;base64,BBB",
};

function makeLigneBonLivraison(overrides: Partial<{
  poidsLivreKg: number;
  nombreMortsTransport: number;
  motifAvarie: string | null;
}> = {}) {
  return {
    id: "lbl-1",
    bonLivraisonId: BL_ID,
    ligneVenteId: LIGNE_ID,
    poidsLivreKg: 100,
    nombreMortsTransport: 0,
    motifAvarie: null,
    ...overrides,
  };
}

function makeBonLivraison(overrides: {
  lignes?: ReturnType<typeof makeLigneBonLivraison>[];
  statut?: StatutBonLivraison;
} = {}) {
  return {
    id: BL_ID,
    numero: "BL-2026-001",
    statut: overrides.statut ?? StatutBonLivraison.EN_ATTENTE_SIGNATURE,
    dateLivraison: new Date("2026-07-20"),
    lignes: overrides.lignes ?? [makeLigneBonLivraison()],
    vente: {
      id: VENTE_ID,
      numero: "VTE-2026-001",
      statut: StatutVente.EN_PREPARATION,
      quantitePoissons: 100,
      poidsTotalKg: 100,
      prixUnitaireKg: 1000,
      montantTotal: 100000,
      dateCommande: new Date("2026-07-15"),
      facture: null,
      vague: { id: VAGUE_ID, code: "V1", nombreInitial: 100 },
      client: { id: "client-1", nom: "Test Client" },
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
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockVenteUpdate.mockResolvedValue({});
  mockBonLivraisonUpdateMany.mockResolvedValue({ count: 1 });
  mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
    id: BL_ID,
    statut: StatutBonLivraison.SIGNE,
  });
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

describe("signerBonLivraison — régression bug conversion kg→morts", () => {
  it("perte poids sans morts saisis → AUCUN MORTALITE créé", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeBonLivraison({
        lignes: [makeLigneBonLivraison({ poidsLivreKg: 95, nombreMortsTransport: 0 })],
      })
    );

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO);

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls.length).toBe(0);

    const ligneUpdateCalls = mockLigneVenteUpdate.mock.calls;
    for (const call of ligneUpdateCalls) {
      expect(call[0].data.nombrePoissons).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Cas 2 — Morts explicites
// ---------------------------------------------------------------------------

describe("signerBonLivraison — morts transport explicites", () => {
  it("nombreMortsTransport=5 → MORTALITE(5) créé + LigneVente/VENTE décrémentés", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeBonLivraison({
        lignes: [
          makeLigneBonLivraison({
            poidsLivreKg: 100,
            nombreMortsTransport: 5,
            motifAvarie: "chaleur excessive",
          }),
        ],
      })
    );

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO);

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls.length).toBe(1);
    const mortaliteData = mortaliteCalls[0][0].data;
    expect(mortaliteData.causeMortalite).toBe(CauseMortalite.AVARIE);
    expect(mortaliteData.nombreMorts).toBe(5);
    expect(mortaliteData.venteId).toBeDefined();
    expect(mortaliteData.bacId).toBeDefined();

    const ligneUpdateWithNombre = mockLigneVenteUpdate.mock.calls.find(
      (call) => call[0].data.nombrePoissons !== undefined
    );
    expect(ligneUpdateWithNombre).toBeDefined();
    expect(ligneUpdateWithNombre![0].data.nombrePoissons).toBe(95);

    expect(mockReleveUpdate).toHaveBeenCalled();
    expect(mockReleveModificationCreate).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cas 3 — Cas mixte
// ---------------------------------------------------------------------------

describe("signerBonLivraison — cas mixte (morts + perte poids)", () => {
  it("5 morts + poidsLivré=95 → 1 seul MORTALITE(5), pas de mort fictif", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeBonLivraison({
        lignes: [makeLigneBonLivraison({ poidsLivreKg: 95, nombreMortsTransport: 5 })],
      })
    );

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO);

    const mortaliteCalls = mockReleveCreate.mock.calls.filter(
      (call) => call[0]?.data?.typeReleve === TypeReleve.MORTALITE
    );
    expect(mortaliteCalls.length).toBe(1);
    expect(mortaliteCalls[0][0].data.nombreMorts).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Cas 4 — Dépassement
// ---------------------------------------------------------------------------

describe("signerBonLivraison — dépassement morts", () => {
  it("nombreMortsTransport > nombrePoissons → ValidationError, aucune écriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeBonLivraison({
        lignes: [makeLigneBonLivraison({ poidsLivreKg: 100, nombreMortsTransport: 150 })],
      })
    );

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
    expect(mockReleveCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cas 5 — Stock bac inchangé
// ---------------------------------------------------------------------------

describe("signerBonLivraison — invariant stock bac", () => {
  it("assignationBac.nombreActuel n'est JAMAIS retouché lors de la signature", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeBonLivraison({
        lignes: [makeLigneBonLivraison({ poidsLivreKg: 100, nombreMortsTransport: 5 })],
      })
    );

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO);

    const stockUpdates = mockAssignationBacUpdateMany.mock.calls;
    expect(stockUpdates.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cas 6 — BL sans lignes (remplace l'ancien "DTO legacy sans lignes")
// ---------------------------------------------------------------------------

describe("signerBonLivraison — BL sans lignes", () => {
  it("BL sans LigneBonLivraison → ValidationError, aucune écriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBonLivraison({ lignes: [] }));

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toMatch(/quantités livrées/i);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
    expect(mockReleveCreate).not.toHaveBeenCalled();
  });
});
