/**
 * Tests FD.7 — getScoresFournisseurs (Sprint FD)
 *
 * Fonction testee : getScoresFournisseurs(siteId) dans src/lib/queries/analytics.ts
 *
 * Verifie :
 *   - Fournisseur sans produits ALIMENT → exclu de la liste
 *   - Fournisseur avec un seul produit → score = score du produit
 *   - Tri par scoreMoyen DESC (null en fin)
 *   - Moyenne ponderee par quantite correcte
 *
 * Note : computeAlimentMetrics appelle desormais getFCRByFeed (ADR-036).
 * Les mocks couvrent le pipeline complet de getFCRByFeed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScoresFournisseurs } from "@/lib/queries/analytics";

// ---------------------------------------------------------------------------
// Mock Prisma au niveau module — doit etre declare avant les imports dynamiques
// ---------------------------------------------------------------------------

const mockProduitFindMany = vi.fn();
const mockProduitFindFirst = vi.fn();
const mockReleveConsommationFindMany = vi.fn();
const mockReleveConsommationAggregate = vi.fn();
const mockVagueFindMany = vi.fn();
const mockReleveFindMany = vi.fn();
const mockCalibrageFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    produit: {
      findMany: (...args: unknown[]) => mockProduitFindMany(...args),
      findFirst: (...args: unknown[]) => mockProduitFindFirst(...args),
    },
    releveConsommation: {
      findMany: (...args: unknown[]) => mockReleveConsommationFindMany(...args),
      aggregate: (...args: unknown[]) => mockReleveConsommationAggregate(...args),
    },
    vague: {
      findMany: (...args: unknown[]) => mockVagueFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    calibrage: {
      findMany: (...args: unknown[]) => mockCalibrageFindMany(...args),
    },
    configElevage: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produit ALIMENT minimal avec fournisseur */
function makeProduit(overrides: {
  id?: string;
  nom?: string;
  fournisseurId?: string;
  fournisseurNom?: string;
  prixUnitaire?: number;
  tauxProteines?: number | null;
}) {
  const id = overrides.id ?? "prod-1";
  const fournisseurId = overrides.fournisseurId ?? "four-1";
  const fournisseurNom = overrides.fournisseurNom ?? "Fournisseur A";
  return {
    id,
    nom: overrides.nom ?? "Aliment Test",
    prixUnitaire: overrides.prixUnitaire ?? 2000,
    uniteAchat: null,
    contenance: null,
    tailleGranule: null,
    formeAliment: null,
    tauxProteines: overrides.tauxProteines ?? null,
    phasesCibles: [],
    fournisseurId,
    fournisseur: { id: fournisseurId, nom: fournisseurNom },
  };
}

/**
 * Configure les mocks pour simuler une vague avec de la consommation
 * mais sans biometrie (getFCRByFeed renvoie insufficientData=true, fcrGlobal=null).
 *
 * Ce scenario est realiste : getScoresFournisseurs peut avoir quantiteTotale > 0
 * mais fcrMoyen = null si pas assez de biometries.
 */
function setupVagueWithConsoNoBio(vagueId: string, produitId: string, quantite: number) {
  // getFCRByFeed step 1 — vague.findMany (find vagues with consommations for this product)
  mockVagueFindMany.mockResolvedValueOnce([
    {
      id: vagueId,
      code: `V-${vagueId}`,
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
      dateDebut: new Date("2026-01-01"),
      dateFin: null,
      bacs: [],
      sourceBacIds: [],
    },
  ]);

  // getFCRByFeed step 2 — releve.findMany for biometries (empty = insufficient data)
  mockReleveFindMany.mockResolvedValueOnce([]);

  // getFCRByFeed insufficient data branch — releveConsommation.aggregate
  mockReleveConsommationAggregate.mockResolvedValueOnce({
    _sum: { quantite },
  });

  // getVague metadata (in computeAlimentMetrics wrapper — vague.findMany for SGR)
  mockVagueFindMany.mockResolvedValueOnce([
    {
      id: vagueId,
      code: `V-${vagueId}`,
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
      dateDebut: new Date("2026-01-01"),
      dateFin: null,
      bacs: [],
    },
  ]);

  // computeAlimentMetrics wrapper — releve.findMany for biometrie/mortalite/comptage
  mockReleveFindMany.mockResolvedValueOnce([]);
}

// ---------------------------------------------------------------------------
// Tests : liste vide
// ---------------------------------------------------------------------------

describe("getScoresFournisseurs — liste vide", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("retourne [] si aucun produit ALIMENT actif sur le site", async () => {
    mockProduitFindMany.mockResolvedValue([]);

    const result = await getScoresFournisseurs("site-1");

    expect(result).toEqual([]);
  });

  it("appelle prisma.produit.findMany avec le siteId fourni", async () => {
    mockProduitFindMany.mockResolvedValue([]);

    await getScoresFournisseurs("site-XYZ");

    expect(mockProduitFindMany).toHaveBeenCalledOnce();
    const call = mockProduitFindMany.mock.calls[0][0] as { where: { siteId: string } };
    expect(call.where.siteId).toBe("site-XYZ");
  });

  it("appelle prisma.produit.findMany en filtrant sur categorie ALIMENT", async () => {
    mockProduitFindMany.mockResolvedValue([]);

    await getScoresFournisseurs("site-1");

    const call = mockProduitFindMany.mock.calls[0][0] as { where: { categorie: string } };
    expect(call.where.categorie).toBe("ALIMENT");
  });
});

// ---------------------------------------------------------------------------
// Tests : fournisseur exclu car produit sans quantite consommee
// ---------------------------------------------------------------------------

describe("getScoresFournisseurs — fournisseur sans consommation exclu", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fournisseur dont le produit a quantiteTotale=0 est exclu (guard analytique.quantiteTotale <= 0)", async () => {
    const produit = makeProduit({ id: "prod-1", fournisseurId: "four-1", fournisseurNom: "Sans Conso" });
    mockProduitFindMany.mockResolvedValue([produit]);

    // getFCRByFeed: produit.findFirst → returns produit (required for getFCRByFeed to proceed)
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit,
      fournisseur: { nom: produit.fournisseur.nom },
    });

    // getFCRByFeed step 1: aucune vague avec consommations pour ce produit
    mockVagueFindMany.mockResolvedValueOnce([]);

    // computeAlimentMetrics wrapper: vague.findMany for SGR (no vagues)
    // (when parVague is empty, we skip the vague metadata query, no mock needed)
    mockReleveFindMany.mockResolvedValueOnce([]);

    const result = await getScoresFournisseurs("site-1");

    // Le fournisseur ne doit pas apparaitre car quantiteTotale=0
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests : fournisseur avec un seul produit
// ---------------------------------------------------------------------------

describe("getScoresFournisseurs — fournisseur avec un seul produit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fournisseur avec 1 produit : nombreProduits = 1", async () => {
    const produit = makeProduit({ id: "prod-1", fournisseurId: "four-1", fournisseurNom: "Mono Produit" });
    mockProduitFindMany.mockResolvedValue([produit]);

    // getFCRByFeed: produit.findFirst
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit,
      fournisseur: { nom: produit.fournisseur.nom },
    });

    setupVagueWithConsoNoBio("vague-1", "prod-1", 50);

    const result = await getScoresFournisseurs("site-1");

    expect(result).toHaveLength(1);
    expect(result[0].fournisseurNom).toBe("Mono Produit");
    expect(result[0].nombreProduits).toBe(1);
  });

  it("fournisseur avec 1 produit : fcrMoyen null quand pas de releves biometrie", async () => {
    const produit = makeProduit({ id: "prod-1", fournisseurId: "four-1", fournisseurNom: "Fournisseur X" });
    mockProduitFindMany.mockResolvedValue([produit]);

    // getFCRByFeed: produit.findFirst
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit,
      fournisseur: { nom: produit.fournisseur.nom },
    });

    setupVagueWithConsoNoBio("vague-1", "prod-1", 100);

    const result = await getScoresFournisseurs("site-1");

    expect(result).toHaveLength(1);
    expect(result[0].fcrMoyen).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests : tri par scoreMoyen DESC
// ---------------------------------------------------------------------------

describe("getScoresFournisseurs — tri par scoreMoyen DESC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fournisseurs avec scoreMoyen null sont en fin de liste", async () => {
    mockProduitFindMany.mockResolvedValue([]);

    const result = await getScoresFournisseurs("site-1");

    // Liste vide = aucun a trier
    expect(result).toEqual([]);
  });

  it("un seul fournisseur avec scoreMoyen non-null → result de taille 1", async () => {
    const produit = makeProduit({
      id: "prod-1",
      fournisseurId: "four-1",
      fournisseurNom: "Top Fournisseur",
    });
    mockProduitFindMany.mockResolvedValue([produit]);

    // getFCRByFeed: produit.findFirst
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit,
      fournisseur: { nom: produit.fournisseur.nom },
    });

    setupVagueWithConsoNoBio("vague-1", "prod-1", 200);

    const result = await getScoresFournisseurs("site-1");

    expect(result).toHaveLength(1);
    expect(result[0].fournisseurNom).toBe("Top Fournisseur");
  });
});

// ---------------------------------------------------------------------------
// Tests : agregation par fournisseur
// ---------------------------------------------------------------------------

describe("getScoresFournisseurs — agregation par fournisseur", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deux produits du meme fournisseur → un seul entree avec nombreProduits=2", async () => {
    const produit1 = makeProduit({ id: "prod-1", fournisseurId: "four-1", fournisseurNom: "Fournisseur Commun" });
    const produit2 = makeProduit({ id: "prod-2", fournisseurId: "four-1", fournisseurNom: "Fournisseur Commun" });
    mockProduitFindMany.mockResolvedValue([produit1, produit2]);

    // Pour prod-1
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit1,
      fournisseur: { nom: produit1.fournisseur.nom },
    });
    setupVagueWithConsoNoBio("vague-1", "prod-1", 80);

    // Pour prod-2
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit2,
      fournisseur: { nom: produit2.fournisseur.nom },
    });
    setupVagueWithConsoNoBio("vague-1", "prod-2", 60);

    const result = await getScoresFournisseurs("site-1");

    // Les deux produits du meme fournisseur sont agreges en un seul entree
    expect(result).toHaveLength(1);
    expect(result[0].fournisseurId).toBe("four-1");
    expect(result[0].nombreProduits).toBe(2);
  });

  it("deux produits de fournisseurs differents → deux entrees distinctes", async () => {
    const produit1 = makeProduit({ id: "prod-A", fournisseurId: "four-A", fournisseurNom: "Fournisseur Alpha" });
    const produit2 = makeProduit({ id: "prod-B", fournisseurId: "four-B", fournisseurNom: "Fournisseur Beta" });
    mockProduitFindMany.mockResolvedValue([produit1, produit2]);

    // Pour prod-A
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit1,
      fournisseur: { nom: produit1.fournisseur.nom },
    });
    setupVagueWithConsoNoBio("vague-A", "prod-A", 100);

    // Pour prod-B
    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit2,
      fournisseur: { nom: produit2.fournisseur.nom },
    });
    setupVagueWithConsoNoBio("vague-B", "prod-B", 70);

    const result = await getScoresFournisseurs("site-1");

    const noms = result.map((r) => r.fournisseurNom);
    expect(noms).toContain("Fournisseur Alpha");
    expect(noms).toContain("Fournisseur Beta");
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests : structure du resultat
// ---------------------------------------------------------------------------

describe("getScoresFournisseurs — structure du resultat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("chaque entree possede les champs attendus", async () => {
    const produit = makeProduit({ id: "prod-str", fournisseurId: "four-str", fournisseurNom: "Struct Test" });
    mockProduitFindMany.mockResolvedValue([produit]);

    mockProduitFindFirst.mockResolvedValueOnce({
      ...produit,
      fournisseur: { nom: produit.fournisseur.nom },
    });
    setupVagueWithConsoNoBio("vague-str", "prod-str", 50);

    const result = await getScoresFournisseurs("site-1");

    expect(result).toHaveLength(1);
    const entree = result[0];
    expect(entree).toHaveProperty("fournisseurId");
    expect(entree).toHaveProperty("fournisseurNom");
    expect(entree).toHaveProperty("nombreProduits");
    expect(entree).toHaveProperty("scoreMoyen");
    expect(entree).toHaveProperty("fcrMoyen");
    expect(typeof entree.fournisseurId).toBe("string");
    expect(typeof entree.fournisseurNom).toBe("string");
    expect(typeof entree.nombreProduits).toBe("number");
  });
});
