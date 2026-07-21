/**
 * Tests — guard « bon de livraison signé » dans cloturerVente (Sprint BL, Story BL.3)
 *
 * Couvre :
 * 1. Vente sans bon de livraison -> ValidationError, aucune écriture
 * 2. Bon de livraison BROUILLON (pas signé) -> ValidationError, aucune écriture
 * 3. Bon de livraison SIGNE -> passe, vente LIVREE
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cloturerVente } from "@/lib/queries/ventes";
import { ValidationError } from "@/lib/errors";
import { StatutVente, StatutBonLivraison, TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma (meme pattern que cloture-vente-avarie.test.ts)
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

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VENTE_ID = "vente-1";
const LIGNE_ID = "ligne-1";
const BAC_ID = "bac-1";
const VAGUE_ID = "vague-1";

function makeVente(bonLivraison: { statut: StatutBonLivraison } | null) {
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
    bonLivraison,
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

describe("cloturerVente — guard bon de livraison signé", () => {
  it("aucun bon de livraison -> ValidationError, aucune écriture", async () => {
    mockVenteFindFirst.mockResolvedValue(makeVente(null));

    const err = await cloturerVente(VENTE_ID, SITE_ID, USER_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0 }],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toMatch(/bon de livraison doit être signé/i);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
  });

  it("bon de livraison BROUILLON (pas signé) -> ValidationError, aucune écriture", async () => {
    mockVenteFindFirst.mockResolvedValue(
      makeVente({ statut: StatutBonLivraison.BROUILLON })
    );

    const err = await cloturerVente(VENTE_ID, SITE_ID, USER_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0 }],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
  });

  it("bon de livraison SIGNE -> passe, vente LIVREE", async () => {
    mockVenteFindFirst.mockResolvedValue(
      makeVente({ statut: StatutBonLivraison.SIGNE })
    );

    await cloturerVente(VENTE_ID, SITE_ID, USER_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0 }],
    });

    expect(mockVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutVente.LIVREE }),
      })
    );
  });
});
