/**
 * Tests unitaires — story PR2.1, `src/lib/queries/previsions-aliments.ts`.
 *
 * Fusion `AlimentArticlePrevision` -> `AlimentPrevision` : chaque calibre
 * porte directement `produitId`/`libelle`/`poidsSacKg`/`prixSacFCFA`/
 * `sacsParTonneUnitaire` — plus de sous-liste `articles[]`, plus de
 * `partApprovisionnementPct`, plus d'action secondaire "ajouter un
 * article".
 *
 * Couvre :
 *  1. R8 — isolation par site sur toutes les fonctions.
 *  2. R4 — `createAlimentPrevision` : la validation "somme = 100%"
 *     (repartitions) a lieu AVANT le `create()` du calibre lui-meme -> si
 *     elle rejette, AUCUN AlimentPrevision n'est cree.
 *  3. `updateAlimentPrevision` : met a jour les champs (coefficient de
 *     besoin et/ou champs article), scope au site.
 *  4. R4 — `replaceRepartitionsMoisAliment` : validation puis ecriture dans
 *     la meme transaction -> rejet => anciennes repartitions intactes.
 *  5. `deleteAlimentPrevision` : verification d'existence scopee au site
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

function seedScenario(id: string, siteId: string, dureeCycleMois = 3) {
  stores.scenarioPrevision.push({ id, code: `C-${id}`, nom: "S", siteId, dureeCycleMois });
}

function seedAliment(id: string, scenarioId: string, siteId: string) {
  stores.alimentPrevision.push({
    id,
    scenarioId,
    tailleGranule: TailleGranule.G1,
    sacsParTonneStandard: null,
    ordre: 0,
    produitId: null,
    libelle: "Granule 2mm",
    poidsSacKg: "25",
    prixSacFCFA: "15000",
    sacsParTonneUnitaire: "40",
    siteId,
  });
}

describe("getAlimentsPrevisionParScenario / getAlimentPrevisionById — R8 isolation", () => {
  it("getAlimentsPrevisionParScenario ne renvoie rien pour le mauvais site", async () => {
    const { getAlimentsPrevisionParScenario } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    const result = await getAlimentsPrevisionParScenario("s1", "site-B");
    expect(result).toHaveLength(0);
  });

  it("getAlimentPrevisionById retourne null si l'aliment appartient a un autre site", async () => {
    const { getAlimentPrevisionById } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    const result = await getAlimentPrevisionById("a1", "site-B");
    expect(result).toBeNull();
  });

  it("inclut les repartitions triees par moisCycle pour le bon site", async () => {
    const { getAlimentPrevisionById } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");
    stores.repartitionMoisAliment.push(
      { id: "r2", alimentPrevisionId: "a1", moisCycle: 2, pourcentage: "40", siteId: "site-A" },
      { id: "r1", alimentPrevisionId: "a1", moisCycle: 1, pourcentage: "60", siteId: "site-A" }
    );

    const result = await getAlimentPrevisionById("a1", "site-A");
    expect(result!.repartitions.map((r: { moisCycle: number }) => r.moisCycle)).toEqual([1, 2]);
    expect(result!.libelle).toBe("Granule 2mm");
  });
});

describe("createAlimentPrevision — champs article fusionnes + R4/R8", () => {
  const alimentValide = { tailleGranule: TailleGranule.G1, ordre: 0, libelle: "Granule", poidsSacKg: 25, prixSacFCFA: 15000 };

  it("R8 — rejette si le scenario est d'un autre site, aucun AlimentPrevision cree", async () => {
    const { createAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    await expect(createAlimentPrevision("s1", "site-B", alimentValide)).rejects.toThrow(
      "Scenario introuvable"
    );

    expect(stores.alimentPrevision).toHaveLength(0);
  });

  it("R4 — somme des repartitions != 100% rejetee -> AUCUN AlimentPrevision cree", async () => {
    const { createAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    await expect(
      createAlimentPrevision("s1", "site-A", {
        ...alimentValide,
        repartitions: [
          { moisCycle: 1, pourcentage: 50 },
          { moisCycle: 2, pourcentage: 40 }, // somme = 90, pas 100
        ],
      })
    ).rejects.toThrow(/doit valoir 100/);

    // Le point le plus important : la validation a lieu AVANT le create() du
    // calibre — un bug destructeur serait de creer le calibre SANS ses
    // repartitions. Ici on prouve qu'il n'existe PAS DU TOUT.
    expect(stores.alimentPrevision).toHaveLength(0);
    expect(stores.repartitionMoisAliment).toHaveLength(0);
  });

  it("cree le calibre (champs article inclus) + repartitions (somme = 100%) dans la meme transaction", async () => {
    const { createAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    // dureeCycleMois=2 explicite : ce test fournit 2 mois de repartition
    // (ERR-162, validerCouvertureMoisRepartition exige desormais que la
    // couverture corresponde exactement a scenario.dureeCycleMois).
    seedScenario("s1", "site-A", 2);

    const result = await createAlimentPrevision("s1", "site-A", {
      ...alimentValide,
      sacsParTonneStandard: 8,
      repartitions: [
        { moisCycle: 1, pourcentage: 60 },
        { moisCycle: 2, pourcentage: 40 },
      ],
    });

    expect(result.repartitions).toHaveLength(2);
    expect(result.libelle).toBe("Granule");
    expect(Number(result.poidsSacKg)).toBe(25);
    expect(Number(result.prixSacFCFA)).toBe(15000);
    expect(stores.alimentPrevision).toHaveLength(1);
    expect(stores.alimentPrevision[0].siteId).toBe("site-A");
    expect(stores.alimentPrevision[0].tailleGranule).toBe(TailleGranule.G1);
  });

  it("permet la creation sans repartitions (optionnelles a la creation)", async () => {
    const { createAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    const result = await createAlimentPrevision("s1", "site-A", alimentValide);

    expect(result.repartitions).toHaveLength(0);
  });

  it("ERR-162 — repartitions FOURNIES mais incompletes (2 mois sur un cycle de 3, somme=100%) rejetees -> AUCUN AlimentPrevision cree", async () => {
    const { createAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A", 3);

    // Somme = 100% (validerSommeRepartitionMoisAliment seule ne detecterait
    // RIEN ici) mais le moisCycle=3 est absent — c'est exactement le bug
    // ERR-162 : sans validerCouvertureMoisRepartition, ce mois vaudrait 0%
    // silencieusement.
    await expect(
      createAlimentPrevision("s1", "site-A", {
        ...alimentValide,
        repartitions: [
          { moisCycle: 1, pourcentage: 60 },
          { moisCycle: 2, pourcentage: 40 },
        ],
      })
    ).rejects.toThrow(/mois manquant/);

    expect(stores.alimentPrevision).toHaveLength(0);
    expect(stores.repartitionMoisAliment).toHaveLength(0);
  });

  it("calcule sacsParTonneUnitaire (1000 / poidsSacKg) au moment de la creation", async () => {
    const { createAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");

    const result = await createAlimentPrevision("s1", "site-A", { ...alimentValide, poidsSacKg: 20 });

    expect(Number(stores.alimentPrevision[0].sacsParTonneUnitaire)).toBe(50); // 1000 / 20
    expect(result.libelle).toBe("Granule");
  });
});

describe("updateAlimentPrevision — R8 isolation", () => {
  it("R8 — rejette si l'aliment est d'un autre site", async () => {
    const { updateAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    await expect(
      updateAlimentPrevision("a1", "site-B", { libelle: "Nouveau libelle" })
    ).rejects.toThrow("Aliment previsionnel introuvable");
  });

  it("met a jour les champs article (libelle, poidsSacKg, prixSacFCFA) et recalcule sacsParTonneUnitaire", async () => {
    const { updateAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    const result = await updateAlimentPrevision("a1", "site-A", {
      libelle: "Nouvelle marque",
      poidsSacKg: 10,
      prixSacFCFA: 20000,
    });

    expect(result.libelle).toBe("Nouvelle marque");
    expect(Number(stores.alimentPrevision[0].poidsSacKg)).toBe(10);
    expect(Number(stores.alimentPrevision[0].prixSacFCFA)).toBe(20000);
    expect(Number(stores.alimentPrevision[0].sacsParTonneUnitaire)).toBe(100); // 1000/10
  });

  it("met a jour uniquement sacsParTonneStandard sans toucher aux champs article", async () => {
    const { updateAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    await updateAlimentPrevision("a1", "site-A", { sacsParTonneStandard: 8 });

    expect(Number(stores.alimentPrevision[0].sacsParTonneStandard)).toBe(8);
    expect(stores.alimentPrevision[0].libelle).toBe("Granule 2mm"); // inchange
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

  it("ERR-162 — mois manquant (somme=100% sur 2 mois d'un cycle de 3) rejete -> anciennes repartitions intactes", async () => {
    const { replaceRepartitionsMoisAliment } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A", 3);
    seedAliment("a1", "s1", "site-A");
    seedRepartitions("a1", "site-A");

    await expect(
      replaceRepartitionsMoisAliment("a1", "site-A", [
        { moisCycle: 1, pourcentage: 60 },
        { moisCycle: 2, pourcentage: 40 },
      ])
    ).rejects.toThrow(/mois manquant/);

    const remaining = stores.repartitionMoisAliment.filter((r) => r.alimentPrevisionId === "a1");
    expect(remaining.map((r) => r.id).sort()).toEqual(["rr1", "rr2"]);
  });

  it("ERR-162 — mois en double rejete -> anciennes repartitions intactes", async () => {
    const { replaceRepartitionsMoisAliment } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A", 2);
    seedAliment("a1", "s1", "site-A");
    seedRepartitions("a1", "site-A");

    await expect(
      replaceRepartitionsMoisAliment("a1", "site-A", [
        { moisCycle: 1, pourcentage: 50 },
        { moisCycle: 1, pourcentage: 50 },
      ])
    ).rejects.toThrow(/double/);

    const remaining = stores.repartitionMoisAliment.filter((r) => r.alimentPrevisionId === "a1");
    expect(remaining.map((r) => r.id).sort()).toEqual(["rr1", "rr2"]);
  });
});

describe("deleteAlimentPrevision — R8 isolation par site", () => {
  it("rejette la suppression si l'aliment appartient a un autre site (l'aliment survit)", async () => {
    const { deleteAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    await expect(deleteAlimentPrevision("a1", "site-B")).rejects.toThrow(
      "Aliment previsionnel introuvable"
    );
    expect(stores.alimentPrevision.find((a) => a.id === "a1")).toBeDefined();
  });

  it("supprime l'aliment pour le bon site", async () => {
    const { deleteAlimentPrevision } = await import("@/lib/queries/previsions-aliments");
    seedScenario("s1", "site-A");
    seedAliment("a1", "s1", "site-A");

    await deleteAlimentPrevision("a1", "site-A");
    expect(stores.alimentPrevision.find((a) => a.id === "a1")).toBeUndefined();
  });
});
