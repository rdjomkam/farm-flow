/**
 * Tests unitaires — src/lib/queries/gompertz-analytics.ts (Sprint G3.4)
 *
 * Couvre :
 *   1. Retourne un tableau vide quand aucune donnee GompertzVague n'existe
 *   2. Exclut les produits avec 1 seule vague (minimum 2 requis)
 *   3. Exclut les niveaux de confiance LOW et INSUFFICIENT_DATA
 *   4. Calcule correctement le K pondere par quantite
 *   5. Assigne correctement kNiveau depuis evaluerKGompertz
 *   6. Filtre par siteId (R8)
 *   7. Trie les resultats par kMoyen decroissant
 *   8. Inclut le tableau details avec la ventilation par vague
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getKParAliment } from "@/lib/queries/gompertz-analytics";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockGompertzVagueFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    gompertzVague: {
      findMany: (...args: unknown[]) => mockGompertzVagueFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers — generateurs de donnees mock
// ---------------------------------------------------------------------------

/**
 * Construit un objet GompertzVague tel que retourne par Prisma avec les
 * includes de la query (vague.releves.consommations.produit.fournisseur).
 */
function makeGompertzEntry({
  vagueId,
  vagueCode,
  k,
  produitId,
  produitNom,
  fournisseurNom,
  quantite,
}: {
  vagueId: string;
  vagueCode: string;
  k: number;
  produitId: string;
  produitNom: string;
  fournisseurNom?: string | null;
  quantite: number;
}) {
  return {
    k,
    vagueId,
    vague: {
      id: vagueId,
      code: vagueCode,
      releves: [
        {
          consommations: [
            {
              produitId,
              quantite,
              produit: {
                id: produitId,
                nom: produitNom,
                fournisseur: fournisseurNom ? { nom: fournisseurNom } : null,
              },
            },
          ],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Retourne un tableau vide quand aucune donnee GompertzVague
// ---------------------------------------------------------------------------

describe("getKParAliment — tableau vide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne [] quand Prisma ne renvoie aucune entree", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([]);
    const result = await getKParAliment("site-1");
    expect(result).toEqual([]);
  });

  it("retourne [] quand toutes les vagues ont des releves sans consommations", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      {
        k: 0.025,
        vagueId: "vague-1",
        vague: {
          id: "vague-1",
          code: "V001",
          releves: [{ consommations: [] }],
        },
      },
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Exclut les produits avec 1 seule vague (minimum 2 requis)
// ---------------------------------------------------------------------------

describe("getKParAliment — filtre minimum 2 vagues par produit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exclut un produit present dans 1 seule vague", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({
        vagueId: "vague-1",
        vagueCode: "V001",
        k: 0.025,
        produitId: "prod-A",
        produitNom: "Aliment Premium",
        quantite: 100,
      }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toEqual([]);
  });

  it("inclut un produit present dans exactement 2 vagues", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({
        vagueId: "vague-1",
        vagueCode: "V001",
        k: 0.025,
        produitId: "prod-A",
        produitNom: "Aliment Premium",
        quantite: 100,
      }),
      makeGompertzEntry({
        vagueId: "vague-2",
        vagueCode: "V002",
        k: 0.020,
        produitId: "prod-A",
        produitNom: "Aliment Premium",
        quantite: 200,
      }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].produitId).toBe("prod-A");
    expect(result[0].nombreVagues).toBe(2);
  });

  it("inclut un produit present dans 3 vagues et calcule nombreVagues=3", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.020, produitId: "prod-A", produitNom: "A", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v3", vagueCode: "V003", k: 0.018, produitId: "prod-A", produitNom: "A", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].nombreVagues).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 3. Exclut les niveaux de confiance LOW et INSUFFICIENT_DATA
// ---------------------------------------------------------------------------

describe("getKParAliment — filtre niveau de confiance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appelle Prisma avec un filtre confidenceLevel in [HIGH, MEDIUM] uniquement", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([]);
    await getKParAliment("site-42");

    expect(mockGompertzVagueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confidenceLevel: { in: ["HIGH", "MEDIUM"] },
        }),
      })
    );
  });

  it("inclut le siteId dans le filtre Prisma (R8)", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([]);
    await getKParAliment("site-xyz");

    expect(mockGompertzVagueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: "site-xyz",
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Calcul K pondere correct
// ---------------------------------------------------------------------------

describe("getKParAliment — calcul K pondere par quantite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcule le K pondere : produit A avec K=0.025/qty=100 et K=0.015/qty=300 → kMoyen=0.01750", async () => {
    // K pondere = (0.025×100 + 0.015×300) / (100+300) = (2.5 + 4.5) / 400 = 7 / 400 = 0.01750
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "Aliment A", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.015, produitId: "prod-A", produitNom: "Aliment A", quantite: 300 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].kMoyen).toBeCloseTo(0.0175, 6);
  });

  it("calcule K pondere sur plusieurs consommations dans la meme vague (cumul quantites)", async () => {
    // meme vague, 2 consommations du meme produit : qty=50 + qty=50 = 100 total
    // K = 0.025 pour cette vague, donc poids = (0.025 × 100) = 2.5 dans la somme
    // Vague 2 : qty=200, K=0.015 → (0.015 × 200) = 3.0
    // K pondere = (2.5 + 3.0) / (100 + 200) = 5.5 / 300 ≈ 0.01833
    const entryVague1 = {
      k: 0.025,
      vagueId: "v1",
      vague: {
        id: "v1",
        code: "V001",
        releves: [
          {
            consommations: [
              { produitId: "prod-A", quantite: 50, produit: { id: "prod-A", nom: "A", fournisseur: null } },
              { produitId: "prod-A", quantite: 50, produit: { id: "prod-A", nom: "A", fournisseur: null } },
            ],
          },
        ],
      },
    };
    const entryVague2 = makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.015, produitId: "prod-A", produitNom: "A", quantite: 200 });

    mockGompertzVagueFindMany.mockResolvedValue([entryVague1, entryVague2]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].kMoyen).toBeCloseTo(5.5 / 300, 6);
  });

  it("filtre le produit si toutes les quantites sont 0 (sommeQuantite === 0)", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", quantite: 0 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.020, produitId: "prod-A", produitNom: "A", quantite: 0 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Attribution correcte du kNiveau depuis evaluerKGompertz
// ---------------------------------------------------------------------------

describe("getKParAliment — attribution kNiveau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigne kNiveau=EXCELLENT quand kMoyen >= 0.020", async () => {
    // K pondere = (0.025×200 + 0.022×200) / 400 = (5 + 4.4) / 400 = 0.02350 → EXCELLENT
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "Excellent", quantite: 200 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.022, produitId: "prod-A", produitNom: "Excellent", quantite: 200 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result[0].kNiveau).toBe("EXCELLENT");
  });

  it("assigne kNiveau=BON quand 0.015 <= kMoyen < 0.020", async () => {
    // K pondere = (0.018×100 + 0.016×100) / 200 = 0.017 → BON
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.018, produitId: "prod-B", produitNom: "Bon", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.016, produitId: "prod-B", produitNom: "Bon", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result[0].kNiveau).toBe("BON");
  });

  it("assigne kNiveau=FAIBLE quand kMoyen < 0.015", async () => {
    // K pondere = (0.012×150 + 0.010×150) / 300 = 0.011 → FAIBLE
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.012, produitId: "prod-C", produitNom: "Faible", quantite: 150 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.010, produitId: "prod-C", produitNom: "Faible", quantite: 150 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result[0].kNiveau).toBe("FAIBLE");
  });
});

// ---------------------------------------------------------------------------
// 6. Filtre par siteId (R8)
// ---------------------------------------------------------------------------

describe("getKParAliment — isolation siteId (R8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passe le siteId correct a la query Prisma", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([]);
    await getKParAliment("site-123");
    expect(mockGompertzVagueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteId: "site-123" }),
      })
    );
  });

  it("passe un siteId different pour un autre appel", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([]);
    await getKParAliment("site-456");
    expect(mockGompertzVagueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ siteId: "site-456" }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Tri par kMoyen decroissant
// ---------------------------------------------------------------------------

describe("getKParAliment — tri decroissant par kMoyen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trie les produits par kMoyen decroissant (meilleur en premier)", async () => {
    // Produit C kMoyen le plus haut, A intermediaire, B le plus bas
    mockGompertzVagueFindMany.mockResolvedValue([
      // Produit A : K = 0.018
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.018, produitId: "prod-A", produitNom: "Aliment A", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.018, produitId: "prod-A", produitNom: "Aliment A", quantite: 100 }),
      // Produit B : K = 0.010
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.010, produitId: "prod-B", produitNom: "Aliment B", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.010, produitId: "prod-B", produitNom: "Aliment B", quantite: 100 }),
      // Produit C : K = 0.025
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-C", produitNom: "Aliment C", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.025, produitId: "prod-C", produitNom: "Aliment C", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(3);
    expect(result[0].produitId).toBe("prod-C"); // 0.025 → premier
    expect(result[1].produitId).toBe("prod-A"); // 0.018 → second
    expect(result[2].produitId).toBe("prod-B"); // 0.010 → dernier
  });

  it("retourne les kMoyen dans l'ordre decroissant strict", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.015, produitId: "p1", produitNom: "P1", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.015, produitId: "p1", produitNom: "P1", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.030, produitId: "p2", produitNom: "P2", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.030, produitId: "p2", produitNom: "P2", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    for (let i = 1; i < result.length; i++) {
      expect(result[i].kMoyen).toBeLessThanOrEqual(result[i - 1].kMoyen);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. details — tableau de ventilation par vague
// ---------------------------------------------------------------------------

describe("getKParAliment — details par vague", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inclut un detail par vague avec vagueId, vagueCode, k et quantiteAliment", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", quantite: 150 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.018, produitId: "prod-A", produitNom: "A", quantite: 250 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result[0].details).toHaveLength(2);

    const detailV1 = result[0].details.find((d) => d.vagueId === "v1");
    expect(detailV1).toBeDefined();
    expect(detailV1!.vagueCode).toBe("V001");
    expect(detailV1!.k).toBe(0.025);
    expect(detailV1!.quantiteAliment).toBe(150);

    const detailV2 = result[0].details.find((d) => d.vagueId === "v2");
    expect(detailV2).toBeDefined();
    expect(detailV2!.vagueCode).toBe("V002");
    expect(detailV2!.k).toBe(0.018);
    expect(detailV2!.quantiteAliment).toBe(250);
  });

  it("expose le fournisseur du produit (ou null si absent)", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", fournisseurNom: "Agri Cam", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.020, produitId: "prod-A", produitNom: "A", fournisseurNom: "Agri Cam", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result[0].fournisseur).toBe("Agri Cam");
  });

  it("expose fournisseur=null quand le produit n'a pas de fournisseur", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", fournisseurNom: null, quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.020, produitId: "prod-A", produitNom: "A", fournisseurNom: null, quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result[0].fournisseur).toBeNull();
  });

  it("cumule les quantites quand un meme produit apparait dans plusieurs releves d'une meme vague", async () => {
    // Vague v1 : 2 releves avec le meme produit → quantites cumulees = 60+40=100
    const entryVague1 = {
      k: 0.025,
      vagueId: "v1",
      vague: {
        id: "v1",
        code: "V001",
        releves: [
          {
            consommations: [
              { produitId: "prod-A", quantite: 60, produit: { id: "prod-A", nom: "A", fournisseur: null } },
            ],
          },
          {
            consommations: [
              { produitId: "prod-A", quantite: 40, produit: { id: "prod-A", nom: "A", fournisseur: null } },
            ],
          },
        ],
      },
    };
    const entryVague2 = makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.015, produitId: "prod-A", produitNom: "A", quantite: 200 });

    mockGompertzVagueFindMany.mockResolvedValue([entryVague1, entryVague2]);
    const result = await getKParAliment("site-1");
    const detailV1 = result[0].details.find((d) => d.vagueId === "v1");
    expect(detailV1!.quantiteAliment).toBe(100); // 60 + 40 cumules
  });
});

// ---------------------------------------------------------------------------
// 9. Plusieurs produits independants
// ---------------------------------------------------------------------------

describe("getKParAliment — plusieurs produits independants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gere deux produits differents presents chacun dans 2 vagues", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.022, produitId: "prod-A", produitNom: "A", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-B", produitNom: "B", quantite: 50 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.010, produitId: "prod-B", produitNom: "B", quantite: 150 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(2);

    const prodA = result.find((r) => r.produitId === "prod-A");
    const prodB = result.find((r) => r.produitId === "prod-B");
    expect(prodA).toBeDefined();
    expect(prodB).toBeDefined();

    // Produit A : kMoyen = (0.025×100 + 0.022×100) / 200 = 0.0235
    expect(prodA!.kMoyen).toBeCloseTo(0.0235, 6);
    // Produit B : kMoyen = (0.025×50 + 0.010×150) / 200 = (1.25 + 1.5) / 200 = 0.01375
    expect(prodB!.kMoyen).toBeCloseTo(0.01375, 6);
  });
});

// ---------------------------------------------------------------------------
// CR2.3 — Validation K : filtrage silencieux des valeurs invalides
// ---------------------------------------------------------------------------

describe("getKParAliment — validation kMoyen (CR2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre silencieusement un produit dont sommeQuantite === 0", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A", quantite: 0 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.020, produitId: "prod-A", produitNom: "A", quantite: 0 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(0);
  });

  it("filtre silencieusement un produit dont le K Gompertz est negatif", async () => {
    // K negatif : kMoyen = (-0.025 * 100 + -0.020 * 100) / 200 = -0.0225 → filtre
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: -0.025, produitId: "prod-neg", produitNom: "Negatif", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: -0.020, produitId: "prod-neg", produitNom: "Negatif", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(0);
  });

  it("filtre silencieusement un produit dont kMoyen vaut exactement 0", async () => {
    // K = 0 pour toutes les vagues → kMoyen = 0 → filtre (kMoyen <= 0)
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0, produitId: "prod-zero", produitNom: "Zero", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0, produitId: "prod-zero", produitNom: "Zero", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(0);
  });

  it("retourne normalement un produit valide meme si un autre produit a quantite 0", async () => {
    // prod-A : quantite=0 → filtre ; prod-B : valide → retenu
    mockGompertzVagueFindMany.mockResolvedValue([
      // prod-A : quantite nulle
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.025, produitId: "prod-A", produitNom: "A-zero", quantite: 0 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.020, produitId: "prod-A", produitNom: "A-zero", quantite: 0 }),
      // prod-B : valide
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.022, produitId: "prod-B", produitNom: "B-valide", quantite: 150 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.018, produitId: "prod-B", produitNom: "B-valide", quantite: 250 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].produitId).toBe("prod-B");
    // K pondere = (0.022×150 + 0.018×250) / 400 = (3.3 + 4.5) / 400 = 7.8 / 400 = 0.0195
    expect(result[0].kMoyen).toBeCloseTo(0.0195, 6);
  });

  it("retourne normalement un produit valide meme si un autre produit a K negatif", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([
      // prod-neg : K negatif → filtre
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: -0.01, produitId: "prod-neg", produitNom: "Neg", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: -0.02, produitId: "prod-neg", produitNom: "Neg", quantite: 100 }),
      // prod-ok : valide
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.020, produitId: "prod-ok", produitNom: "OK", quantite: 200 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.016, produitId: "prod-ok", produitNom: "OK", quantite: 200 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].produitId).toBe("prod-ok");
  });

  it("filtre silencieusement un produit dont le kMoyen calcule est NaN (k=NaN en DB)", async () => {
    // k=NaN dans les deux vagues → kMoyen = NaN → filtre via isNaN(kMoyen)
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: NaN, produitId: "prod-nan", produitNom: "NaN-K", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: NaN, produitId: "prod-nan", produitNom: "NaN-K", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(0);
  });

  it("filtre silencieusement un produit dont le kMoyen est Infinity", async () => {
    // k=Infinity → kMoyen = Infinity → filtre via !isFinite(kMoyen)
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: Infinity, produitId: "prod-inf", produitNom: "Inf-K", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: Infinity, produitId: "prod-inf", produitNom: "Inf-K", quantite: 100 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(0);
  });

  it("retourne le produit valide quand un autre a kMoyen NaN", async () => {
    // prod-nan : k=NaN → filtre ; prod-ok : valide
    mockGompertzVagueFindMany.mockResolvedValue([
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: NaN, produitId: "prod-nan", produitNom: "NaN-K", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: NaN, produitId: "prod-nan", produitNom: "NaN-K", quantite: 100 }),
      makeGompertzEntry({ vagueId: "v1", vagueCode: "V001", k: 0.022, produitId: "prod-ok", produitNom: "OK", quantite: 150 }),
      makeGompertzEntry({ vagueId: "v2", vagueCode: "V002", k: 0.018, produitId: "prod-ok", produitNom: "OK", quantite: 150 }),
    ]);
    const result = await getKParAliment("site-1");
    expect(result).toHaveLength(1);
    expect(result[0].produitId).toBe("prod-ok");
  });
});

// ---------------------------------------------------------------------------
// 10. Appel Prisma avec filtre TypeReleve.ALIMENTATION
// ---------------------------------------------------------------------------

describe("getKParAliment — filtre TypeReleve dans la query Prisma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre les releves sur typeReleve ALIMENTATION dans la query", async () => {
    mockGompertzVagueFindMany.mockResolvedValue([]);
    await getKParAliment("site-1");

    const call = mockGompertzVagueFindMany.mock.calls[0][0];
    // La query doit avoir un filtre releves.where.typeReleve = ALIMENTATION
    expect(call.select.vague.select.releves.where.typeReleve).toBe(TypeReleve.ALIMENTATION);
  });
});
