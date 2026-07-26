/**
 * Tests — bons-livraison queries (Sprint BL, Story BL.3 ; étendu Sprint BF, Story BF.2 ;
 * notion de BL actif Sprint BF phase 2, Story BF.6b)
 *
 * Couvre :
 * 1. createBonLivraison : vente inexistante -> erreur
 * 2. createBonLivraison : vente pas EN_PREPARATION -> ValidationError
 * 3. createBonLivraison : BL ACTIF deja existant -> retourne le meme (idempotent)
 * 4. createBonLivraison : numerotation BL-YYYY-NNN
 * 5. createBonLivraison : préremplissage des LigneBonLivraison à la création (Sprint BF)
 * 6. createBonLivraison : rattrapage d'un BL legacy sans lignes (Sprint BF)
 * 7. createBonLivraison : idempotence porte sur l'ACTIF, pas sur l'historique (BF.6b)
 * 8. getBonLivraisonByVente : retourne le BL actif (rectifiePar null) (BF.6b)
 * 9. getBonLivraisonByVente : rattrapage défensif si le BL n'a aucune ligne (Sprint BF)
 * 10. enregistrerQuantitesBonLivraison : upsert, refus si SIGNE, refus si vente pas EN_PREPARATION,
 *     refus si morts > nombrePoissons (Sprint BF)
 * 11. signerBonLivraison : BROUILLON/EN_ATTENTE_SIGNATURE -> SIGNE avec signatures persistees
 * 12. signerBonLivraison : deja SIGNE -> ValidationError
 * 13. signerBonLivraison : deja rectifie (rectifiePar non null) -> ValidationError (BF.6b)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBonLivraison,
  getBonLivraisonByVente,
  enregistrerQuantitesBonLivraison,
  signerBonLivraison,
} from "@/lib/queries/bons-livraison";
import { ValidationError } from "@/lib/errors";
import { StatutBonLivraison, StatutVente } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVenteFindFirst = vi.fn();
const mockBonLivraisonFindFirst = vi.fn();
const mockBonLivraisonFindFirstRoot = vi.fn(); // prisma.bonLivraison.findFirst (hors transaction)
const mockBonLivraisonFindUniqueOrThrow = vi.fn();
const mockBonLivraisonCreate = vi.fn();
const mockBonLivraisonUpdate = vi.fn();
const mockBonLivraisonUpdateMany = vi.fn();
const mockLigneBonLivraisonCount = vi.fn();
const mockLigneBonLivraisonCreateMany = vi.fn();
const mockLigneBonLivraisonUpsert = vi.fn();
const mockLigneBonLivraisonUpdate = vi.fn();
const mockVenteUpdate = vi.fn();
const mockLigneVenteUpdate = vi.fn();
const mockReleveFindFirst = vi.fn();
const mockReleveUpdate = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveModificationCreate = vi.fn();
const mockFactureUpdate = vi.fn();
const mockSiteAuditLogCreate = vi.fn();

const mockExecuteRaw = vi.fn().mockResolvedValue(0);

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    // SU.3 — generateNextNumero pose un pg_advisory_xact_lock via $executeRaw
    // avant de lire le dernier numero. Le tx mocke doit exposer cette methode.
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
    vente: {
      findFirst: (...args: unknown[]) => mockVenteFindFirst(...args),
      update: (...args: unknown[]) => mockVenteUpdate(...args),
    },
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockBonLivraisonFindUniqueOrThrow(...args),
      create: (...args: unknown[]) => mockBonLivraisonCreate(...args),
      update: (...args: unknown[]) => mockBonLivraisonUpdate(...args),
      updateMany: (...args: unknown[]) => mockBonLivraisonUpdateMany(...args),
    },
    ligneBonLivraison: {
      count: (...args: unknown[]) => mockLigneBonLivraisonCount(...args),
      createMany: (...args: unknown[]) => mockLigneBonLivraisonCreateMany(...args),
      upsert: (...args: unknown[]) => mockLigneBonLivraisonUpsert(...args),
      update: (...args: unknown[]) => mockLigneBonLivraisonUpdate(...args),
    },
    ligneVente: {
      update: (...args: unknown[]) => mockLigneVenteUpdate(...args),
    },
    releve: {
      findFirst: (...args: unknown[]) => mockReleveFindFirst(...args),
      update: (...args: unknown[]) => mockReleveUpdate(...args),
      create: (...args: unknown[]) => mockReleveCreate(...args),
    },
    releveModification: {
      create: (...args: unknown[]) => mockReleveModificationCreate(...args),
    },
    facture: {
      update: (...args: unknown[]) => mockFactureUpdate(...args),
    },
    siteAuditLog: {
      create: (...args: unknown[]) => mockSiteAuditLogCreate(...args),
    },
    assignationBac: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirstRoot(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockBonLivraisonFindUniqueOrThrow(...args),
    },
    ligneBonLivraison: {
      count: (...args: unknown[]) => mockLigneBonLivraisonCount(...args),
      createMany: (...args: unknown[]) => mockLigneBonLivraisonCreateMany(...args),
    },
  },
}));

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VENTE_ID = "vente-1";
const BL_ID = "bl-1";
const LIGNE_ID = "ligne-1";
const BAC_ID = "bac-1";
const VAGUE_ID = "vague-1";

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
      lignes: [],
    });
    // getBonLivraisonActif : aucun BL actif
    mockBonLivraisonFindFirst.mockResolvedValue(null);

    const err = await createBonLivraison(SITE_ID, USER_ID, VENTE_ID).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("BL ACTIF deja existant avec lignes -> retourne le meme (idempotent), pas de rattrapage", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.EN_PREPARATION,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 100 }],
    });
    // getBonLivraisonActif renvoie un BL actif (rectifiePar null, filtre applique par la query)
    mockBonLivraisonFindFirst.mockResolvedValue({ id: BL_ID });
    mockLigneBonLivraisonCount.mockResolvedValue(1);
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
    expect(mockLigneBonLivraisonCreateMany).not.toHaveBeenCalled();
  });

  it("l'idempotence interroge le BL ACTIF (rectifiePar null), pas l'historique (BF.6b)", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.EN_PREPARATION,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 100 }],
    });
    mockBonLivraisonFindFirst.mockResolvedValue({ id: BL_ID });
    mockLigneBonLivraisonCount.mockResolvedValue(1);
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      numero: "BL-2026-002",
      statut: StatutBonLivraison.BROUILLON,
    });

    await createBonLivraison(SITE_ID, USER_ID, VENTE_ID);

    expect(mockBonLivraisonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venteId: VENTE_ID,
          siteId: SITE_ID,
          rectifiePar: { is: null },
        }),
      })
    );
  });

  it("cree le BL avec numerotation BL-YYYY-NNN incrementale + préremplit les LigneBonLivraison", async () => {
    const year = new Date().getFullYear();
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.EN_PREPARATION,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 245.25 }],
    });
    // 1er appel bonLivraison.findFirst : getBonLivraisonActif -> aucun BL actif
    // 2e appel : generateNextNumero -> dernier numero existant
    mockBonLivraisonFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: `BL-${year}-007` });
    mockBonLivraisonCreate.mockResolvedValue({ id: BL_ID });
    mockLigneBonLivraisonCount.mockResolvedValue(0);
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
    expect(mockLigneBonLivraisonCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            bonLivraisonId: BL_ID,
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 245.25,
            nombreMortsTransport: 0,
            siteId: SITE_ID,
          }),
        ],
      })
    );
    expect(result).toEqual({
      id: BL_ID,
      numero: `BL-${year}-008`,
      statut: StatutBonLivraison.BROUILLON,
    });
  });

  it("BL legacy existant sans lignes -> rattrapage (créé les LigneBonLivraison manquantes)", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      statut: StatutVente.EN_PREPARATION,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 349 }],
    });
    mockBonLivraisonFindFirst.mockResolvedValue({ id: BL_ID });
    mockLigneBonLivraisonCount.mockResolvedValue(0);
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      numero: "BL-2026-001",
      statut: StatutBonLivraison.BROUILLON,
    });

    await createBonLivraison(SITE_ID, USER_ID, VENTE_ID);

    expect(mockLigneBonLivraisonCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            bonLivraisonId: BL_ID,
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 349,
            nombreMortsTransport: 0,
            siteId: SITE_ID,
          }),
        ],
      })
    );
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
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 100 }],
    });
    mockBonLivraisonFindFirstRoot.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.BROUILLON,
      lignes: [{ id: "lbl-1" }],
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(result?.blocPaiement).toEqual({
      totalVente: 100000,
      paye: 40000,
      resteAPayer: 60000,
    });
    expect(mockLigneBonLivraisonCreateMany).not.toHaveBeenCalled();
  });

  it("sans facture liee -> paye=0, resteAPayer=totalVente", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 50000,
      client: { id: "client-1", nom: "Client A" },
      facture: null,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 50 }],
    });
    mockBonLivraisonFindFirstRoot.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.BROUILLON,
      lignes: [{ id: "lbl-1" }],
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(result?.blocPaiement).toEqual({
      totalVente: 50000,
      paye: 0,
      resteAPayer: 50000,
    });
  });

  it("aucun BL ACTIF pour la vente -> null", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 50000,
      client: { id: "client-1", nom: "Client A" },
      facture: null,
      lignes: [],
    });
    mockBonLivraisonFindFirstRoot.mockResolvedValue(null);

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(result).toBeNull();
  });

  it("BL legacy sans lignes -> rattrapage défensif avant de retourner le résultat", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 82625,
      client: { id: "client-1", nom: "Client A" },
      facture: null,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 826.25 }],
    });
    mockBonLivraisonFindFirstRoot.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.BROUILLON,
      lignes: [],
    });
    mockLigneBonLivraisonCount.mockResolvedValue(0);
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.BROUILLON,
      lignes: [{ id: "lbl-1", ligneVenteId: LIGNE_ID, poidsLivreKg: 826.25, nombreMortsTransport: 0 }],
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(mockLigneBonLivraisonCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            bonLivraisonId: BL_ID,
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 826.25,
          }),
        ],
      })
    );
    expect(result?.bonLivraison.lignes.length).toBe(1);
  });

  it("interroge le BL ACTIF (rectifiePar null) et ignore l'historique rectifie (BF.6b)", async () => {
    mockVenteFindFirst.mockResolvedValue({
      id: VENTE_ID,
      montantTotal: 100000,
      client: { id: "client-1", nom: "Client A" },
      facture: null,
      lignes: [{ id: LIGNE_ID, poidsTotalKg: 100 }],
    });
    // Simule la query filtrant sur rectifiePar null : ne renvoie que le BL actif,
    // meme si un BL rectifie (historique) existe aussi pour cette vente.
    mockBonLivraisonFindFirstRoot.mockResolvedValue({
      id: "bl-actif",
      statut: StatutBonLivraison.SIGNE,
      lignes: [{ id: "lbl-1" }],
    });

    const result = await getBonLivraisonByVente(SITE_ID, VENTE_ID);

    expect(mockBonLivraisonFindFirstRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venteId: VENTE_ID,
          siteId: SITE_ID,
          rectifiePar: { is: null },
        }),
      })
    );
    expect(result?.bonLivraison.id).toBe("bl-actif");
  });
});

// ---------------------------------------------------------------------------
// enregistrerQuantitesBonLivraison
// ---------------------------------------------------------------------------

describe("enregistrerQuantitesBonLivraison", () => {
  function makeBL(overrides: { statut?: StatutBonLivraison; venteStatut?: StatutVente } = {}) {
    return {
      id: BL_ID,
      statut: overrides.statut ?? StatutBonLivraison.BROUILLON,
      vente: {
        id: VENTE_ID,
        statut: overrides.venteStatut ?? StatutVente.EN_PREPARATION,
        lignes: [{ id: LIGNE_ID, nombrePoissons: 100 }],
      },
    };
  }

  it("BL introuvable -> erreur", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(null);

    await expect(
      enregistrerQuantitesBonLivraison(SITE_ID, USER_ID, BL_ID, {
        lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0 }],
      })
    ).rejects.toThrow("Bon de livraison introuvable");
  });

  it("BL deja SIGNE -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBL({ statut: StatutBonLivraison.SIGNE }));

    const err = await enregistrerQuantitesBonLivraison(SITE_ID, USER_ID, BL_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0 }],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockLigneBonLivraisonUpsert).not.toHaveBeenCalled();
  });

  it("vente pas EN_PREPARATION -> ValidationError", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBL({ venteStatut: StatutVente.LIVREE }));

    const err = await enregistrerQuantitesBonLivraison(SITE_ID, USER_ID, BL_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 0 }],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockLigneBonLivraisonUpsert).not.toHaveBeenCalled();
  });

  it("nombreMortsTransport > nombrePoissons -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBL());

    const err = await enregistrerQuantitesBonLivraison(SITE_ID, USER_ID, BL_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 100, nombreMortsTransport: 150 }],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockLigneBonLivraisonUpsert).not.toHaveBeenCalled();
  });

  it("ligneVenteId hors vente -> ValidationError", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBL());

    const err = await enregistrerQuantitesBonLivraison(SITE_ID, USER_ID, BL_ID, {
      lignes: [{ ligneVenteId: "autre-ligne", poidsLivreKg: 100, nombreMortsTransport: 0 }],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
  });

  it("upsert les LigneBonLivraison + passe le BL en EN_ATTENTE_SIGNATURE", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeBL());
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.EN_ATTENTE_SIGNATURE,
    });

    await enregistrerQuantitesBonLivraison(SITE_ID, USER_ID, BL_ID, {
      lignes: [{ ligneVenteId: LIGNE_ID, poidsLivreKg: 95, nombreMortsTransport: 2, motifAvarie: "chaleur" }],
    });

    expect(mockLigneBonLivraisonUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bonLivraisonId_ligneVenteId: { bonLivraisonId: BL_ID, ligneVenteId: LIGNE_ID },
        },
        create: expect.objectContaining({
          bonLivraisonId: BL_ID,
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 95,
          nombreMortsTransport: 2,
          motifAvarie: "chaleur",
          siteId: SITE_ID,
        }),
        update: expect.objectContaining({
          poidsLivreKg: 95,
          nombreMortsTransport: 2,
          motifAvarie: "chaleur",
        }),
      })
    );
    expect(mockBonLivraisonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BL_ID },
        data: expect.objectContaining({ statut: StatutBonLivraison.EN_ATTENTE_SIGNATURE }),
      })
    );
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

  function makeSignableBL(overrides: { rectifiePar?: { id: string } | null } = {}) {
    return {
      id: BL_ID,
      numero: "BL-2026-001",
      statut: StatutBonLivraison.EN_ATTENTE_SIGNATURE,
      dateLivraison: new Date("2026-07-20"),
      rectifiePar: overrides.rectifiePar ?? null,
      lignes: [
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
        facture: null,
        vague: { id: VAGUE_ID, code: "V1", nombreInitial: 100 },
        client: { id: "client-1", nom: "Client A" },
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

  it("BROUILLON/EN_ATTENTE_SIGNATURE avec lignes -> SIGNE avec signatures persistees, vente LIVREE", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeSignableBL());
    mockBonLivraisonUpdateMany.mockResolvedValue({ count: 1 });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.SIGNE,
      ...dto,
    });
    mockVenteUpdate.mockResolvedValue({});
    mockLigneVenteUpdate.mockResolvedValue({});
    mockSiteAuditLogCreate.mockResolvedValue({});

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
    expect(mockVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: StatutVente.LIVREE }),
      })
    );
    expect(mockSiteAuditLogCreate).toHaveBeenCalled();
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
      ...makeSignableBL(),
      statut: StatutBonLivraison.SIGNE,
    });

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonUpdateMany).not.toHaveBeenCalled();
  });

  it("BL sans lignes -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue({ ...makeSignableBL(), lignes: [] });

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockVenteUpdate).not.toHaveBeenCalled();
  });

  it("BL deja rectifie (rectifiePar non null) -> ValidationError, aucune ecriture (BF.6b)", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeSignableBL({ rectifiePar: { id: "bl-nouveau" } })
    );

    const err = await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonUpdateMany).not.toHaveBeenCalled();
    expect(mockVenteUpdate).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // Review Sprint BF phase 2 (finding Haute) — snapshot nombrePoissonsLivres
  // ---------------------------------------------------------------------

  it("persiste le snapshot nombrePoissonsLivres sur LigneBonLivraison a la signature", async () => {
    const bl = makeSignableBL();
    bl.lignes = [
      { ligneVenteId: LIGNE_ID, poidsLivreKg: 90, nombreMortsTransport: 10, motifAvarie: "chaleur" },
    ];
    bl.vente.lignes[0].nombrePoissons = 100;
    mockBonLivraisonFindFirst.mockResolvedValue(bl);
    mockBonLivraisonUpdateMany.mockResolvedValue({ count: 1 });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.SIGNE,
      ...dto,
    });
    mockVenteUpdate.mockResolvedValue({});
    mockLigneVenteUpdate.mockResolvedValue({});
    mockSiteAuditLogCreate.mockResolvedValue({});
    mockReleveFindFirst.mockResolvedValue(null);
    mockLigneBonLivraisonUpdate.mockResolvedValue({});

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto);

    // 100 poissons - 10 morts transport = 90 effectivement livres, fige sur CE BL
    expect(mockLigneBonLivraisonUpdate).toHaveBeenCalledWith({
      where: {
        bonLivraisonId_ligneVenteId: { bonLivraisonId: BL_ID, ligneVenteId: LIGNE_ID },
      },
      data: { nombrePoissonsLivres: 90 },
    });
  });

  it("clamp nombreVendus (mode normal) : console.warn si le calcul produit une valeur negative", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bl = makeSignableBL();
    bl.lignes = [
      { ligneVenteId: LIGNE_ID, poidsLivreKg: 90, nombreMortsTransport: 5, motifAvarie: null },
    ];
    bl.vente.lignes[0].nombrePoissons = 10;
    mockBonLivraisonFindFirst.mockResolvedValue(bl);
    mockBonLivraisonUpdateMany.mockResolvedValue({ count: 1 });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_ID,
      statut: StatutBonLivraison.SIGNE,
      ...dto,
    });
    mockVenteUpdate.mockResolvedValue({});
    mockLigneVenteUpdate.mockResolvedValue({});
    mockSiteAuditLogCreate.mockResolvedValue({});
    mockLigneBonLivraisonUpdate.mockResolvedValue({});
    // Le releve VENTE n'a que 2 nombreVendus deja enregistres, alors que
    // nombreMortsTransport = 5 -> 2 - 5 = -3, un delta incoherent en amont.
    mockReleveFindFirst.mockResolvedValue({ id: "releve-vente-1", nombreVendus: 2 });

    await signerBonLivraison(SITE_ID, USER_ID, BL_ID, dto);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("clamp nombreVendus (mode normal)"),
      expect.objectContaining({
        bonLivraisonId: BL_ID,
        ligneVenteId: LIGNE_ID,
        oldVendus: 2,
        nombreMortsTransport: 5,
        rawVendus: -3,
      })
    );
    expect(mockReleveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombreVendus: 0 }) })
    );

    warnSpy.mockRestore();
  });
});
