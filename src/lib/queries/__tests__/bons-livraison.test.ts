/**
 * Tests — bons-livraison queries (Sprint BL, Story BL.3)
 *
 * Couvre :
 * 1. createBonLivraison : vente inexistante -> erreur
 * 2. createBonLivraison : vente pas EN_PREPARATION -> ValidationError
 * 3. createBonLivraison : BL deja existant -> retourne le meme (idempotent)
 * 4. createBonLivraison : numerotation BL-YYYY-NNN
 * 5. signerBonLivraison : BROUILLON -> SIGNE avec signatures persistees
 * 6. signerBonLivraison : deja SIGNE -> ValidationError
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBonLivraison,
  signerBonLivraison,
  getBonLivraisonByVente,
} from "@/lib/queries/bons-livraison";
import { ValidationError } from "@/lib/errors";
import { StatutBonLivraison, StatutVente } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVenteFindFirst = vi.fn();
const mockBonLivraisonFindFirst = vi.fn();
const mockBonLivraisonFindUniqueOrThrow = vi.fn();
const mockBonLivraisonCreate = vi.fn();
const mockBonLivraisonUpdateMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vente: {
      findFirst: (...args: unknown[]) => mockVenteFindFirst(...args),
    },
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockBonLivraisonFindUniqueOrThrow(...args),
      create: (...args: unknown[]) => mockBonLivraisonCreate(...args),
      updateMany: (...args: unknown[]) => mockBonLivraisonUpdateMany(...args),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) =>
      mockTransaction(...(args as Parameters<typeof mockTransaction>)),
    vente: {
      findFirst: (...args: unknown[]) => mockVenteFindFirst(...args),
    },
  },
}));

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VENTE_ID = "vente-1";
const BL_ID = "bl-1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// createBonLivraison
// ---------------------------------------------------------------------------

describe("createBonLivraison", () => {
  it("vente introuvable -> erreur", async () => {
    mockVenteFindFirst.mockResolvedValue(null);

    await expect(
      createBonLivraison(SITE_ID, USER_ID, VENTE_ID)
    ).rejects.toThrow("Vente introuvable");

    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("vente pas EN_PREPARATION -> ValidationError", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.LIVREE,
      bonLivraison: null,
    });

    const err = await createBonLivraison(SITE_ID, USER_ID, VENTE_ID).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("BL deja existant -> retourne le meme (idempotent)", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.EN_PREPARATION,
      bonLivraison: { id: BL_ID },
    });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      numero: "BL-2026-001",
      statut: StatutBonLivraison.BROUILLON,
    });

    const result = await createBonLivraison(SITE_ID, USER_ID, VENTE_ID);

    expect(result).toEqual({
      id: BL_ID,
      numero: "BL-2026-001",
      statut: StatutBonLivraison.BROUILLON,
    });
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
    expect(mockBonLivraisonFindUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BL_ID } })
    );
  });

  it("cree le BL avec numerotation BL-YYYY-NNN incrementale", async () => {
    const year = new Date().getFullYear();
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.EN_PREPARATION,
      bonLivraison: null,
    });
    mockBonLivraisonFindFirst.mockResolvedValue({
      numero: `BL-${year}-007`,
    });
    mockBonLivraisonCreate.mockResolvedValue({ id: BL_ID });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      numero: `BL-${year}-008`,
      statut: StatutBonLivraison.BROUILLON,
    });

    const result = await createBonLivraison(SITE_ID, USER_ID, VENTE_ID);

    expect(mockBonLivraisonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numero: `BL-${year}-008`,
          venteId: VENTE_ID,
          statut: StatutBonLivraison.BROUILLON,
          userId: USER_ID,
          siteId: SITE_ID,
        }),
      })
    );
    expect(result).toEqual({
      id: BL_ID,
      numero: `BL-${year}-008`,
      statut: StatutBonLivraison.BROUILLON,
    });
  });
});

// ---------------------------------------------------------------------------
// signerBonLivraison
// ---------------------------------------------------------------------------

describe("signerBonLivraison", () => {
  const dto = {
    signatureClient: "data:image/png;base64,AAA",
    signataireClientNom: "Jean Dupont",
    signatureLivreur: "data:image/png;base64,BBB",
  };

  it("BROUILLON -> SIGNE avec signatures persistees", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.BROUILLON,
    });
    mockBonLivraisonUpdateMany.mockResolvedValue({ count: 1 });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.SIGNE,
      ...dto,
    });

    const result = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto);

    expect(mockBonLivraisonUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BL_ID, siteId: SITE_ID }),
        data: expect.objectContaining({
          statut: StatutBonLivraison.SIGNE,
          signatureClient: dto.signatureClient,
          signataireClientNom: dto.signataireClientNom,
          signatureLivreur: dto.signatureLivreur,
        }),
      })
    );
    expect(result.statut).toBe(StatutBonLivraison.SIGNE);
  });

  it("BL introuvable -> erreur", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(null);

    await expect(
      signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto)
    ).rejects.toThrow("Bon de livraison introuvable");

    expect(mockBonLivraisonUpdateMany).not.toHaveBeenCalled();
  });

  it("deja SIGNE -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.SIGNE,
    });

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonUpdateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getBonLivraisonByVente
// ---------------------------------------------------------------------------

describe("getBonLivraisonByVente", () => {
  it("calcule le bloc paiement depuis la facture liee", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 100000,
      client: { id: "client-1", nom: "Client A" },
      facture: { id: "fac-1", montantPaye: 40000 },
      bonLivraison: { id: BL_ID, statut: StatutBonLivraison.BROUILLON },
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(result?.blocPaiement).toEqual({
      totalVente: 100000,
      paye: 40000,
      resteAPayer: 60000,
    });
  });

  it("sans facture liee -> paye=0, resteAPayer=totalVente", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 50000,
      client: { id: "client-1", nom: "Client A" },
      facture: null,
      bonLivraison: { id: BL_ID, statut: StatutBonLivraison.BROUILLON },
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(result?.blocPaiement).toEqual({
      totalVente: 50000,
      paye: 0,
      resteAPayer: 50000,
    });
  });

  it("aucun BL pour la vente -> null", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 50000,
      client: { id: "client-1", nom: "Client A" },
      facture: null,
      bonLivraison: null,
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(result).toBeNull();
  });
});
