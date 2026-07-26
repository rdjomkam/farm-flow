/**
 * Tests — bon de livraison rectificatif (Sprint BF phase 2, Story BF.7a).
 *
 * Couvre :
 * 1. creerBonLivraisonRectificatif : gardes (origine pas SIGNE, deja
 *    rectifiee, vente CLOTUREE), prereplissage depuis les lignes de l'origine
 * 2. signerBonLivraison en mode delta (rectifieId != null) :
 *    - morts 3 -> 0 (poissons rendus, releve MORTALITE supprime, VENTE incremente)
 *    - morts 3 -> 5 (delta inverse)
 *    - poids seul modifie, morts inchanges (aucun mouvement de poissons)
 *    - chaine A <- B <- C : le delta de C se calcule vs B, pas vs A
 *    - facture : montantPaye > nouveau montant -> PAYEE, jamais de blocage
 *    - guard : bac dont les morts passent a 0 reste dans le perimetre verifie
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  creerBonLivraisonRectificatif,
  signerBonLivraison,
} from "@/lib/queries/bons-livraison";
import { ValidationError } from "@/lib/errors";
import {
  StatutBonLivraison,
  StatutVente,
  StatutFacture,
  CauseMortalite,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockBonLivraisonFindFirst = vi.fn();
const mockBonLivraisonFindUniqueOrThrow = vi.fn();
const mockBonLivraisonCreate = vi.fn();
const mockBonLivraisonUpdateMany = vi.fn();
const mockLigneBonLivraisonCreateMany = vi.fn();
const mockLigneBonLivraisonUpdate = vi.fn();
const mockVenteUpdate = vi.fn();
const mockLigneVenteUpdate = vi.fn();
const mockReleveFindFirst = vi.fn();
const mockReleveUpdate = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveDelete = vi.fn();
const mockReleveModificationCreate = vi.fn();
const mockFactureUpdate = vi.fn();
const mockSiteAuditLogCreate = vi.fn();
const mockAssignationBacFindMany = vi.fn();

const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    vente: {
      update: (...args: unknown[]) => mockVenteUpdate(...args),
    },
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockBonLivraisonFindUniqueOrThrow(...args),
      create: (...args: unknown[]) => mockBonLivraisonCreate(...args),
      updateMany: (...args: unknown[]) => mockBonLivraisonUpdateMany(...args),
    },
    ligneBonLivraison: {
      createMany: (...args: unknown[]) => mockLigneBonLivraisonCreateMany(...args),
      update: (...args: unknown[]) => mockLigneBonLivraisonUpdate(...args),
    },
    ligneVente: {
      update: (...args: unknown[]) => mockLigneVenteUpdate(...args),
    },
    releve: {
      findFirst: (...args: unknown[]) => mockReleveFindFirst(...args),
      update: (...args: unknown[]) => mockReleveUpdate(...args),
      create: (...args: unknown[]) => mockReleveCreate(...args),
      delete: (...args: unknown[]) => mockReleveDelete(...args),
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
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) =>
      mockTransaction(...(args as Parameters<typeof mockTransaction>)),
  },
}));

const SITE_ID = "site-1";
const USER_ID = "user-1";
const VENTE_ID = "vente-1";
const BL_ORIGINE_ID = "bl-origine";
const BL_RECTIF_ID = "bl-rectif";
const LIGNE_ID = "ligne-1";
const BAC_ID = "bac-1";
const VAGUE_ID = "vague-1";

beforeEach(() => {
  vi.resetAllMocks();
  mockAssignationBacFindMany.mockResolvedValue([]); // guard trivialement satisfait par defaut
});

// ---------------------------------------------------------------------------
// creerBonLivraisonRectificatif
// ---------------------------------------------------------------------------

describe("creerBonLivraisonRectificatif", () => {
  function makeOrigine(overrides: {
    statut?: StatutBonLivraison;
    rectifiePar?: { id: string } | null;
    venteStatut?: StatutVente;
  } = {}) {
    return {
      id: BL_ORIGINE_ID,
      numero: "BL-2026-001",
      venteId: VENTE_ID,
      statut: overrides.statut ?? StatutBonLivraison.SIGNE,
      rectifiePar: overrides.rectifiePar ?? null,
      vente: { id: VENTE_ID, statut: overrides.venteStatut ?? StatutVente.LIVREE },
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: 97,
          nombreMortsTransport: 3,
          motifAvarie: "chaleur",
        },
      ],
    };
  }

  it("origine introuvable -> erreur", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(null);

    await expect(
      creerBonLivraisonRectificatif(SITE_ID, USER_ID, BL_ORIGINE_ID, {
        motifRectification: "Poids errone constate",
      })
    ).rejects.toThrow("Bon de livraison introuvable");

    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("origine pas SIGNE -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeOrigine({ statut: StatutBonLivraison.BROUILLON })
    );

    const err = await creerBonLivraisonRectificatif(SITE_ID, USER_ID, BL_ORIGINE_ID, {
      motifRectification: "Poids errone constate",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("origine deja rectifiee (rectifiePar non null) -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeOrigine({ rectifiePar: { id: "bl-nouveau" } })
    );

    const err = await creerBonLivraisonRectificatif(SITE_ID, USER_ID, BL_ORIGINE_ID, {
      motifRectification: "Poids errone constate",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("vente CLOTUREE -> ValidationError explicite, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeOrigine({ venteStatut: StatutVente.CLOTUREE })
    );

    const err = await creerBonLivraisonRectificatif(SITE_ID, USER_ID, BL_ORIGINE_ID, {
      motifRectification: "Poids errone constate",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toMatch(/clôturée/);
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("vente pas LIVREE (ex: EN_PREPARATION) -> ValidationError, aucune ecriture", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeOrigine({ venteStatut: StatutVente.EN_PREPARATION })
    );

    const err = await creerBonLivraisonRectificatif(SITE_ID, USER_ID, BL_ORIGINE_ID, {
      motifRectification: "Poids errone constate",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(mockBonLivraisonCreate).not.toHaveBeenCalled();
  });

  it("cree le BL rectificatif et preremplit les lignes depuis l'origine (pas depuis les quantites commandees)", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(makeOrigine());
    mockBonLivraisonCreate.mockResolvedValue({ id: BL_RECTIF_ID });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_RECTIF_ID,
      numero: "BL-2026-002",
      statut: StatutBonLivraison.BROUILLON,
      rectifieId: BL_ORIGINE_ID,
      motifRectification: "Poids errone constate",
    });

    const result = await creerBonLivraisonRectificatif(SITE_ID, USER_ID, BL_ORIGINE_ID, {
      motifRectification: "Poids errone constate",
    });

    expect(mockBonLivraisonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          venteId: VENTE_ID,
          statut: StatutBonLivraison.BROUILLON,
          rectifieId: BL_ORIGINE_ID,
          motifRectification: "Poids errone constate",
          userId: USER_ID,
          siteId: SITE_ID,
        }),
      })
    );
    expect(mockLigneBonLivraisonCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            bonLivraisonId: BL_RECTIF_ID,
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 97, // depuis l'origine, pas depuis la vente
            nombreMortsTransport: 3,
            motifAvarie: "chaleur",
            siteId: SITE_ID,
          }),
        ],
      })
    );
    expect(result).toEqual(
      expect.objectContaining({ id: BL_RECTIF_ID, rectifieId: BL_ORIGINE_ID })
    );
  });
});

// ---------------------------------------------------------------------------
// signerBonLivraison — mode rectificatif (delta)
// ---------------------------------------------------------------------------

describe("signerBonLivraison — mode rectificatif (delta)", () => {
  const dto = {
    signatureClient: "data:image/png;base64,AAA",
    signataireClientNom: "Jean Dupont",
    signatureLivreur: "data:image/png;base64,BBB",
  };

  /**
   * BL rectificatif signable : `rectifieId` pointe vers le BL rectifie (dont
   * les lignes representent l'etat DEJA applique — anciensMorts).
   */
  function makeRectificatifBL(opts: {
    anciensMorts: number;
    nouveauxMorts: number;
    poidsLivreLigne?: number;
    ligneVenteNombrePoissons: number; // etat courant (deja reduit par anciensMorts)
    rectifieNumero?: string;
  }) {
    return {
      id: BL_RECTIF_ID,
      numero: "BL-2026-002",
      statut: StatutBonLivraison.EN_ATTENTE_SIGNATURE,
      dateLivraison: new Date("2026-07-25"),
      rectifieId: BL_ORIGINE_ID,
      motifRectification: "Poids errone constate",
      rectifiePar: null,
      rectifie: {
        id: BL_ORIGINE_ID,
        numero: opts.rectifieNumero ?? "BL-2026-001",
        lignes: [
          {
            ligneVenteId: LIGNE_ID,
            poidsLivreKg: 97,
            nombreMortsTransport: opts.anciensMorts,
            motifAvarie: null,
          },
        ],
      },
      lignes: [
        {
          ligneVenteId: LIGNE_ID,
          poidsLivreKg: opts.poidsLivreLigne ?? 97,
          nombreMortsTransport: opts.nouveauxMorts,
          motifAvarie: null,
        },
      ],
      vente: {
        id: VENTE_ID,
        numero: "VTE-2026-001",
        statut: StatutVente.LIVREE,
        quantitePoissons: 97,
        poidsTotalKg: 97,
        prixUnitaireKg: 1000,
        montantTotal: 97000,
        facture: null,
        vague: { id: VAGUE_ID, code: "V1", nombreInitial: 100 },
        client: { id: "client-1", nom: "Client A" },
        lignes: [
          {
            id: LIGNE_ID,
            bacId: BAC_ID,
            vagueId: VAGUE_ID,
            nombrePoissons: opts.ligneVenteNombrePoissons,
            poidsTotalKg: 100,
            poidsMoyenG: 1000,
            poidsLivreKg: 97,
          },
        ],
      },
    };
  }

  beforeEach(() => {
    mockBonLivraisonUpdateMany.mockResolvedValue({ count: 1 });
    mockBonLivraisonFindUniqueOrThrow.mockResolvedValue({
      id: BL_RECTIF_ID,
      statut: StatutBonLivraison.SIGNE,
    });
    mockVenteUpdate.mockResolvedValue({});
    mockLigneVenteUpdate.mockResolvedValue({});
    mockSiteAuditLogCreate.mockResolvedValue({});
    mockReleveUpdate.mockResolvedValue({});
    mockReleveCreate.mockResolvedValue({});
    mockReleveDelete.mockResolvedValue({});
    mockReleveModificationCreate.mockResolvedValue({});
  });

  it("morts 3 -> 0 : poissons rendus, releve MORTALITE supprime, releve VENTE reincremente", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({ anciensMorts: 3, nouveauxMorts: 0, ligneVenteNombrePoissons: 97 })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string; typeReleve: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 3 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 3 });
    });

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    // Poissons rendus : 97 + (3 - 0) = 100
    expect(mockLigneVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombrePoissons: 100 }),
      })
    );
    // Releve VENTE nombreVendus += 3
    expect(mockReleveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "releve-vente-1" },
        data: expect.objectContaining({ nombreVendus: 6 }),
      })
    );
    // Releve MORTALITE supprime directement (chemin sanctionne)
    expect(mockReleveDelete).toHaveBeenCalledWith({ where: { id: "releve-mortalite-1" } });
    expect(mockReleveCreate).not.toHaveBeenCalled();
    expect(mockSiteAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "RELEVE_MORTALITE_SUPPRIME_RECTIFICATIF" }),
      })
    );
    // Vente reste LIVREE (jamais retransitionnee) — pas de champ statut dans l'update
    expect(mockVenteUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ data: expect.objectContaining({ statut: expect.anything() }) })
    );
  });

  it("morts 3 -> 5 : delta inverse, releve MORTALITE mis a jour (pas supprime)", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({ anciensMorts: 3, nouveauxMorts: 5, ligneVenteNombrePoissons: 97 })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 3 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 3 });
    });

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    // deltaMorts = 3 - 5 = -2 -> nombrePoissons = 97 - 2 = 95
    expect(mockLigneVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombrePoissons: 95 }) })
    );
    expect(mockReleveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "releve-vente-1" },
        data: expect.objectContaining({ nombreVendus: 1 }), // 3 + (-2)
      })
    );
    expect(mockReleveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "releve-mortalite-1" },
        data: expect.objectContaining({ nombreMorts: 5 }),
      })
    );
    expect(mockReleveDelete).not.toHaveBeenCalled();
  });

  it("poids seul modifie, morts inchanges -> montant recalcule, aucun mouvement de poissons", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({
        anciensMorts: 3,
        nouveauxMorts: 3,
        poidsLivreLigne: 90, // poids corrige
        ligneVenteNombrePoissons: 97,
      })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 3 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 3 });
    });

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    // Aucun mouvement de poissons : nombrePoissons inchange (deltaMorts = 0)
    expect(mockLigneVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombrePoissons: 97, poidsLivreKg: 90 }),
      })
    );
    // Releve VENTE non touche (deltaMorts === 0 -> skip)
    expect(mockReleveModificationCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ champModifie: "nombreVendus" }),
      })
    );
    // Montant recalcule sur le nouveau poids
    expect(mockVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ montantTotal: 90 * 1000 }),
      })
    );
  });

  it("chaine A <- B <- C : le delta de C se calcule vs B (rectifie), pas vs A", async () => {
    // B (rectifie) a deja 2 morts appliques ; C (en cours de signature) en saisit 5.
    // Si le delta etait calcule vs A (0 morts d'origine), le resultat serait faux.
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({
        anciensMorts: 2,
        nouveauxMorts: 5,
        ligneVenteNombrePoissons: 95, // deja reduit par B (100 - anciensMorts via A->B, simplifie a 95 ici)
        rectifieNumero: "BL-2026-002", // B, pas A
      })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 2 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 2 });
    });

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    // delta = anciensMorts(2, vs B) - nouveauxMorts(5) = -3 -> nombrePoissons = 95 - 3 = 92
    expect(mockLigneVenteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombrePoissons: 92 }) })
    );
  });

  it("facture : montantPaye superieur au nouveau montant -> statut PAYEE, aucun blocage", async () => {
    const bl = makeRectificatifBL({
      anciensMorts: 3,
      nouveauxMorts: 0,
      poidsLivreLigne: 50, // nouveau montant faible : 50 * 1000 = 50000
      ligneVenteNombrePoissons: 97,
    });
    bl.vente.facture = {
      id: "facture-1",
      montantPaye: 97000, // deja paye largement plus que le nouveau montant
      statut: StatutFacture.PAYEE,
    } as unknown as typeof bl.vente.facture;
    mockBonLivraisonFindFirst.mockResolvedValue(bl);
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 3 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 3 });
    });

    await expect(
      signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto)
    ).resolves.toBeDefined();

    expect(mockFactureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "facture-1" },
        data: expect.objectContaining({ statut: StatutFacture.PAYEE }),
      })
    );
  });

  it("guard : bac dont les morts passent a 0 reste dans le perimetre verifie (superset des deux BL)", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({ anciensMorts: 3, nouveauxMorts: 0, ligneVenteNombrePoissons: 97 })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 3 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 3 });
    });

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    // Le bac doit avoir ete inclus dans le pre-scan du guard de conservation
    // (captureEcartsAssignation) malgre nouveauxMorts === 0, car ancienMorts > 0.
    expect(mockAssignationBacFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bacId: { in: [BAC_ID] } }),
      })
    );
  });

  // ---------------------------------------------------------------------
  // Review Sprint BF phase 2 (finding Haute) — snapshot nombrePoissonsLivres
  // ---------------------------------------------------------------------

  it("persiste le snapshot sur LA ligne du rectificatif signe, jamais sur celle du BL d'origine", async () => {
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({ anciensMorts: 3, nouveauxMorts: 5, ligneVenteNombrePoissons: 97 })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 3 });
      }
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 3 });
    });
    mockLigneBonLivraisonUpdate.mockResolvedValue({});

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    // nombrePoissons = 97 + (3 - 5) = 95, fige sur LE RECTIFICATIF (BL_RECTIF_ID),
    // jamais sur BL_ORIGINE_ID — le PDF de l'origine doit rester intact.
    expect(mockLigneBonLivraisonUpdate).toHaveBeenCalledWith({
      where: {
        bonLivraisonId_ligneVenteId: { bonLivraisonId: BL_RECTIF_ID, ligneVenteId: LIGNE_ID },
      },
      data: { nombrePoissonsLivres: 95 },
    });
    expect(mockLigneBonLivraisonUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bonLivraisonId_ligneVenteId: expect.objectContaining({
            bonLivraisonId: BL_ORIGINE_ID,
          }),
        }),
      })
    );
  });

  it("clamp nombreVendus (mode rectificatif) : console.warn si le calcul produit une valeur negative", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockBonLivraisonFindFirst.mockResolvedValue(
      makeRectificatifBL({ anciensMorts: 2, nouveauxMorts: 5, ligneVenteNombrePoissons: 95 })
    );
    mockReleveFindFirst.mockImplementation((args: { where: { causeMortalite?: string } }) => {
      if (args.where.causeMortalite === CauseMortalite.AVARIE) {
        return Promise.resolve({ id: "releve-mortalite-1", nombreMorts: 2 });
      }
      // deltaMorts = 2 - 5 = -3 ; oldVendus(1) + (-3) = -2 < 0
      return Promise.resolve({ id: "releve-vente-1", nombreVendus: 1 });
    });
    mockLigneBonLivraisonUpdate.mockResolvedValue({});

    await signerBonLivraison(SITE_ID, USER_ID, BL_RECTIF_ID, dto);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("clamp nombreVendus (mode rectificatif)"),
      expect.objectContaining({
        bonLivraisonId: BL_RECTIF_ID,
        ligneVenteId: LIGNE_ID,
        oldVendus: 1,
        deltaMorts: -3,
        rawVendus: -2,
      })
    );
    expect(mockReleveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "releve-vente-1" },
        data: expect.objectContaining({ nombreVendus: 0 }),
      })
    );

    warnSpy.mockRestore();
  });
});
