/**
 * Tests — guard « bon de livraison » dans signerBonLivraison (Sprint BL,
 * Story BL.3 ; adapté Sprint BF, Story BF.2).
 *
 * Le guard « signer sans quantités saisies » remplace l'ancien guard « BL
 * signé avant livraison » : depuis la fusion, c'est la signature elle-même
 * qui livre la vente. Il n'y a donc plus de scénario « vente livrée sans BL
 * signé » à tester — mais deux nouveaux invariants :
 * 1. BL sans LigneBonLivraison (quantités non saisies) -> refus de signer
 * 2. BL déjà SIGNE -> refus de signer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { signerBonLivraison } from "@/lib/queries/bons-livraison";
import { ValidationError } from "@/lib/errors";
import { StatutVente, StatutBonLivraison, TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma (meme pattern que cloture-vente-avarie.test.ts)
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
const mockLigneBonLivraisonUpdate = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirst(...args),
      updateMany: (...args: unknown[]) => mockBonLivraisonUpdateMany(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockBonLivraisonFindUniqueOrThrow(...args),
    },
    ligneBonLivraison: {
      update: (...args: unknown[]) => mockLigneBonLivraisonUpdate(...args),
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

function makeBonLivraison(overrides: {
  statut?: StatutBonLivraison;
  lignes?: Array<{ ligneVenteId: string; poidsLivreKg: number; nombreMortsTransport: number; motifAvarie: string | null }>;
} = {}) {
  return {
    id: BL_ID,
    numero: "BL-2026-001",
    statut: overrides.statut ?? StatutBonLivraison.EN_ATTENTE_SIGNATURE,
    dateLivraison: new Date("2026-07-20"),
    lignes:
      overrides.lignes ?? [
        { ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0, motifAvarie: null },
      ],
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

describe("signerBonLivraison — guard quantités saisies avant signature", () => {
  it("BL sans lignes (quantités non saisies) -> ValidationError, aucune écriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBonLivraison({ lignes: [] }));

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toMatch(/quantités livrées/i);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
  });

  it("BL déjà SIGNE -> ValidationError, aucune écriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBonLivraison({ statut: StatutBonLivraison.SIGNE }));

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
  });

  it("BL EN_ATTENTE_SIGNATURE avec lignes saisies -> passe, vente LIVREE", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBonLivraison());

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, SIGNATURE_DTO);

    expect(mockVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutVente.LIVREE }),
      })
    );
  });
});
