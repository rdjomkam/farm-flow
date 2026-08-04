/**
 * Tests unitaires — story PR2.1 / amendement ADR-053 §12 (Sprint PR2-quater),
 * `src/lib/queries/previsions-aliments.ts`.
 *
 * Couvre :
 *  1. R8 — isolation par site sur toutes les fonctions.
 *  2. R4 — `createAlimentPrevisionAvecArticle` : la validation "somme = 100%"
 *     (repartitions) a lieu AVANT le `create()` du calibre lui-meme -> si
 *     elle rejette, AUCUN AlimentPrevision ni article n'est cree.
 *  3. ADR-053 §12.6 — creer un calibre cree son unique article DANS LE MEME
 *     GESTE, avec `partApprovisionnementPct = 100` ecrit par le serveur,
 *     jamais demande a l'appelant.
 *  4. ADR-053 §12.2 arbitrage 3 — `addAlimentArticlePrevision` : ajout d'un
 *     second article, validation bloquante "somme des parts = 100%".
 *  5. R4 — `replaceRepartitionsMoisAliment` : validation puis ecriture dans
 *     la meme transaction -> rejet => anciennes repartitions intactes.
 *  6. `deleteAlimentPrevision` : verification d'existence scopee au site
 *     avant suppression.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TailleGranule } from "@/types";
import { createEmptyStores, buildFakePrisma, type Stores } from "./previsions-fake-db";

const stores: Stores = createEmptyStores();

vi.mock("@/lib/db", () => ({
  prisma: buildFakePrisma(stores),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
});

function seedScenario(id: string, siteId: string) {
  stores.scenarioPrevision.push({ id, code: `C-${id}`, nom: "S", siteId });
}

function seedAliment(id: string, scenarioId: string, siteId: string) {
  stores.alimentPrevision.push({
    id,
    scenarioId,
    tailleGranule: TailleGranule.G1,
    sacsParTonneStandard: null,
    ordre: 0,
    siteId,
  });
}

function seedArticle(id: string, alimentCalibrePrevisionId: string, siteId: string, part = "100") {
  stores.alimentArticlePrevision.push({
    id,
    alimentCalibrePrevisionId,
    produitId: null,
    libelle: "Granule 2mm",
    poidsSacKg: "25",
    prixSacFCFA: "15000",
    sacsParTonneUnitaire: "40",
    partApprovisionnementPct: part,
    ordre: 0,
    siteId,
  });
}

describe("getAlimentsPrevisionParScenario / getAlimentPrevisionById — R8 isolation", () => {
  it("getAlimentsPrevisionParScenario ne renvoie rien pour le mauvais site", async () => {
    const { getAlimentsPrevisionParScenario } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    const result = await getAlimentsPrevisionParScenario("s1", "site-B");
    expect(result).toHaveLength(0);
  });

  it("getAlimentPrevisionById retourne null si l'aliment appartient a un autre site", async () => {
    const { getAlimentPrevisionById } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    const result = await getAlimentPrevisionById("a1", "site-B");
    expect(result).toBeNull();
  });

  it("inclut les repartitions triees par moisCycle et les articles pour le bon site", async () => {
    const { getAlimentPrevisionById } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");
    stores.repartitionMoisAliment.push(
      { id: "r2", alimentPrevisionId: "a1", moisCycle: 2, pourcentage: "40", siteId: "site-A" },
      { id: "r1", alimentPrevisionId: "a1", moisCycle: 1, pourcentage: "60", siteId: "site-A" }
    );

    const result = await getAlimentPrevisionById("a1", "site-A");
    expect(result!.repartitions.map((r: { moisCycle: number }) => r.moisCycle)).toEqual([1, 2]);
    expect(result!.articles).toHaveLength(1);
    expect(result!.articles[0].id).toBe("art1");
  });
});

describe("createAlimentPrevisionAvecArticle — ADR-053 §12.6 (calibre + article dans le meme geste) + R4/R8", () => {
  const articleValide = { libelle: "Granule", poidsSacKg: 25, prixSacFCFA: 15000 };

  it("R8 — rejette si le scenario est d'un autre site, aucun AlimentPrevision ni article cree", async () => {
    const { createAlimentPrevisionAvecArticle } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    await expect(
      createAlimentPrevisionAvecArticle("s1", "site-B", {
        tailleGranule: TailleGranule.G1,
        ordre: 0,
        article: articleValide,
      })
    ).rejects.toThrow("Scenario introuvable");

    expect(stores.alimentPrevision).toHaveLength(0);
    expect(stores.alimentArticlePrevision).toHaveLength(0);
  });

  it("R4 — somme des repartitions != 100% rejetee -> AUCUN AlimentPrevision NI article crees", async () => {
    const { createAlimentPrevisionAvecArticle } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    await expect(
      createAlimentPrevisionAvecArticle("s1", "site-A", {
        tailleGranule: TailleGranule.G1,
        ordre: 0,
        article: articleValide,
        repartitions: [
          { moisCycle: 1, pourcentage: 50 },
          { moisCycle: 2, pourcentage: 40 }, // somme = 90, pas 100
        ],
      })
    ).rejects.toThrow(/doit valoir 100/);

    // Le point le plus important : la validation a lieu AVANT le create() du
    // calibre — un bug destructeur serait de creer le calibre (et son
    // article) SANS ses repartitions. Ici on prouve qu'il n'existe PAS DU TOUT.
    expect(stores.alimentPrevision).toHaveLength(0);
    expect(stores.alimentArticlePrevision).toHaveLength(0);
    expect(stores.repartitionMoisAliment).toHaveLength(0);
  });

  it("cree le calibre + son unique article (partApprovisionnementPct = 100 ecrit par le serveur) + repartitions (somme = 100%) dans la meme transaction", async () => {
    const { createAlimentPrevisionAvecArticle } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    const result = await createAlimentPrevisionAvecArticle("s1", "site-A", {
      tailleGranule: TailleGranule.G1,
      sacsParTonneStandard: 8,
      ordre: 0,
      article: articleValide,
      repartitions: [
        { moisCycle: 1, pourcentage: 60 },
        { moisCycle: 2, pourcentage: 40 },
      ],
    });

    expect(result.repartitions).toHaveLength(2);
    expect(result.articles).toHaveLength(1);
    expect(Number(result.articles[0].partApprovisionnementPct)).toBe(100);
    expect(stores.alimentPrevision).toHaveLength(1);
    expect(stores.alimentPrevision[0].siteId).toBe("site-A");
    expect(stores.alimentPrevision[0].tailleGranule).toBe(TailleGranule.G1);
    expect(stores.alimentArticlePrevision).toHaveLength(1);
    expect(stores.alimentArticlePrevision[0].siteId).toBe("site-A");
  });

  it("permet la creation sans repartitions (optionnelles a la creation)", async () => {
    const { createAlimentPrevisionAvecArticle } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    const result = await createAlimentPrevisionAvecArticle("s1", "site-A", {
      tailleGranule: TailleGranule.G1,
      ordre: 0,
      article: articleValide,
    });

    expect(result.repartitions).toHaveLength(0);
    expect(result.articles).toHaveLength(1);
  });

  it("le payload de creation n'accepte jamais partApprovisionnementPct — elle vaut toujours 100 (§12.6)", async () => {
    const { createAlimentPrevisionAvecArticle } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    const result = await createAlimentPrevisionAvecArticle("s1", "site-A", {
      tailleGranule: TailleGranule.G2,
      ordre: 0,
      // @ts-expect-error — partApprovisionnementPct n'existe pas dans AlimentArticlePrevisionInputDTO,
      // meme si un appelant JS non type l'envoyait, le serveur l'ignore et ecrit 100 quand meme.
      article: { ...articleValide, partApprovisionnementPct: 42 },
    });

    expect(Number(result.articles[0].partApprovisionnementPct)).toBe(100);
  });
});

describe("addAlimentArticlePrevision — ADR-053 §12.2 arbitrage 3 (somme des parts = 100%, action secondaire)", () => {
  it("R8 — rejette si le calibre est d'un autre site, aucun article ajoute", async () => {
    const { addAlimentArticlePrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    await expect(
      addAlimentArticlePrevision("a1", "site-B", {
        nouvelArticle: { libelle: "Marque B", poidsSacKg: 15, prixSacFCFA: 16000 },
        repartition: [
          { articleId: "art1", partApprovisionnementPct: 50 },
          { partApprovisionnementPct: 50 },
        ],
      })
    ).rejects.toThrow("Aliment previsionnel introuvable");

    expect(stores.alimentArticlePrevision).toHaveLength(1);
  });

  it("R4 — somme des parts != 100% rejetee : AUCUN nouvel article cree, part de l'existant intacte", async () => {
    const { addAlimentArticlePrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    await expect(
      addAlimentArticlePrevision("a1", "site-A", {
        nouvelArticle: { libelle: "Marque B", poidsSacKg: 15, prixSacFCFA: 16000 },
        repartition: [
          { articleId: "art1", partApprovisionnementPct: 60 },
          { partApprovisionnementPct: 60 }, // somme = 120, pas 100
        ],
      })
    ).rejects.toThrow(/doit valoir 100/);

    expect(stores.alimentArticlePrevision).toHaveLength(1);
    expect(Number(stores.alimentArticlePrevision[0].partApprovisionnementPct)).toBe(100);
  });

  it("ajoute le second article et repartit les parts (somme = 100%) dans la meme transaction", async () => {
    const { addAlimentArticlePrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    const result = await addAlimentArticlePrevision("a1", "site-A", {
      nouvelArticle: { libelle: "Marque B", poidsSacKg: 15, prixSacFCFA: 16000 },
      repartition: [
        { articleId: "art1", partApprovisionnementPct: 70 },
        { partApprovisionnementPct: 30 },
      ],
    });

    expect(result.articles).toHaveLength(2);
    const parts = result.articles.map((a: { partApprovisionnementPct: unknown }) =>
      Number(a.partApprovisionnementPct)
    );
    expect(parts.reduce((s: number, p: number) => s + p, 0)).toBe(100);
    expect(stores.alimentArticlePrevision).toHaveLength(2);
  });

  it("rejette une repartition sans exactement un element sans articleId, avec une ValidationError typee (jamais un 500 — bug PR2q.4 §6, rapport @tester)", async () => {
    const { addAlimentArticlePrevision } = await import("@/lib/queries/previsions-aliments");
    const { ValidationError } = await import("@/lib/errors");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    const call = addAlimentArticlePrevision("a1", "site-A", {
      nouvelArticle: { libelle: "Marque B", poidsSacKg: 15, prixSacFCFA: 16000 },
      repartition: [{ articleId: "art1", partApprovisionnementPct: 100 }],
    });

    await expect(call).rejects.toThrow(/exactement un element sans articleId/);
    // Le type importe autant que le message : c'est en etant une
    // ValidationError (et non une Error nue) que handleApiError la mappe en
    // 400 sans dependre du mecanisme fragile de PREVISIONS_STATUS_MAP
    // (mapping par sous-chaine, cf. review-sprint-PR2-bis.md reserve 6).
    await expect(call).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("replaceRepartitionsMoisAliment — R4 atomicite + R8 isolation", () => {
  function seedRepartitions(alimentPrevisionId: string, siteId: string) {
    stores.repartitionMoisAliment.push(
      { id: "rr1", alimentPrevisionId, moisCycle: 1, pourcentage: "50", siteId },
      { id: "rr2", alimentPrevisionId, moisCycle: 2, pourcentage: "50", siteId }
    );
  }

  it("remplace en bloc quand la somme vaut 100%", async () => {
    const { replaceRepartitionsMoisAliment } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedRepartitions("a1", "site-A");

    const result = await replaceRepartitionsMoisAliment("a1", "site-A", [
      { moisCycle: 1, pourcentage: 30 },
      { moisCycle: 2, pourcentage: 30 },
      { moisCycle: 3, pourcentage: 40 },
    ]);

    expect(result).toHaveLength(3);
    expect(stores.repartitionMoisAliment.filter((r) => r.alimentPrevisionId === "a1")).toHaveLength(3);
  });

  it("R4 — somme != 100% rejetee : AUCUNE ecriture, anciennes repartitions intactes", async () => {
    const { replaceRepartitionsMoisAliment } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedRepartitions("a1", "site-A");

    await expect(
      replaceRepartitionsMoisAliment("a1", "site-A", [
        { moisCycle: 1, pourcentage: 50 },
        { moisCycle: 2, pourcentage: 30 }, // somme = 80
      ])
    ).rejects.toThrow(/doit valoir 100/);

    const remaining = stores.repartitionMoisAliment.filter((r) => r.alimentPrevisionId === "a1");
    expect(remaining).toHaveLength(2);
    expect(remaining.map((r) => r.id).sort()).toEqual(["rr1", "rr2"]);
  });

  it("R8 — rejette si l'aliment est d'un autre site, sans toucher aux repartitions existantes", async () => {
    const { replaceRepartitionsMoisAliment } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedRepartitions("a1", "site-A");

    await expect(
      replaceRepartitionsMoisAliment("a1", "site-B", [{ moisCycle: 1, pourcentage: 100 }])
    ).rejects.toThrow("Aliment previsionnel introuvable");

    expect(stores.repartitionMoisAliment.filter((r) => r.alimentPrevisionId === "a1")).toHaveLength(2);
  });
});

describe("deleteAlimentPrevision — R8 isolation par site", () => {
  it("rejette la suppression si l'aliment appartient a un autre site (l'aliment survit)", async () => {
    const { deleteAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    await expect(deleteAlimentPrevision("a1", "site-B")).rejects.toThrow(
      "Aliment previsionnel introuvable"
    );
    expect(stores.alimentPrevision.find((a) => a.id === "a1")).toBeDefined();
  });

  it("supprime l'aliment pour le bon site", async () => {
    const { deleteAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    seedArticle("art1", "a1", "site-A");

    await deleteAlimentPrevision("a1", "site-A");
    expect(stores.alimentPrevision.find((a) => a.id === "a1")).toBeUndefined();
  });
});
