/**
 * Tests unitaires — story PR2.1 (Queries Prisma module Previsions),
 * `src/lib/queries/previsions-scenarios.ts`.
 *
 * Reference : ADR-053, docs/sprints/SPRINT-PR2-PREVISIONS.md,
 * docs/analysis/pre-analysis-story-PR2.1.md.
 *
 * Couvre en priorite (cf. instructions de la story tests) :
 *  1. R8 — isolation par site sur getScenarios/getScenarioById/
 *     updateParametresPrevision/replacePaliersRemise/archiverScenario/
 *     activerScenario : une entite d'un autre site n'est jamais renvoyee ni
 *     modifiee.
 *  2. R4 — `replacePaliersRemise` : une validation qui rejette (seuils non
 *     strictement croissants) ne doit RIEN ecrire — les anciens paliers
 *     restent intacts.
 *  3. `createScenario` : creation transactionnelle + copie des
 *     AlimentPrevision depuis les Produit ALIMENT actifs du site (jamais
 *     ceux d'un autre site), code duplique rejete au sein du meme site,
 *     code duplique autorise entre sites differents.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatutScenarioPrevision, CategorieProduit, TailleGranule } from "@/types";
import {
  createEmptyStores,
  buildFakePrisma,
  type Stores,
} from "./previsions-fake-db";

const stores: Stores = createEmptyStores();

vi.mock("@/lib/db", () => ({
  prisma: buildFakePrisma(stores),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
});

const PARAMS = {
  effectifAlevinsParVague: 1000,
  margeSecuriteAlevinsPct: 5,
  poidsMoyenInitialG: 5,
  poidsObjectifG: 800,
  prixAlevinUnitaireFCFA: 50,
  prixVenteKgFCFA: 1500,
  nombreBacsSimultanesCible: 4,
  frequenceStockageMois: 1,
};

function seedScenario(id: string, siteId: string, code = "PLAN-001") {
  stores.scenarioPrevision.push({
    id,
    code,
    nom: `Scenario ${id}`,
    description: null,
    dureeCycleMois: 3,
    dateDebutPlan: new Date("2026-01-01"),
    statut: StatutScenarioPrevision.BROUILLON,
    userId: "user-1",
    siteId,
    createdAt: new Date(),
  });
  stores.parametresPrevision.push({
    id: `params-${id}`,
    scenarioId: id,
    ...PARAMS,
  });
}

describe("getScenarios — R8 isolation par site", () => {
  it("ne renvoie que les scenarios du site demande", async () => {
    const { getScenarios } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedScenario("s2", "site-B");

    const { data, total } = await getScenarios("site-A");
    expect(total).toBe(1);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("s1");
  });

  it("filtre par statut sans faire fuiter un autre site", async () => {
    const { getScenarios } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedScenario("s2", "site-A", "PLAN-002");
    stores.scenarioPrevision.find((s) => s.id === "s2")!.statut =
      StatutScenarioPrevision.ACTIF;

    const { data } = await getScenarios("site-A", { statut: StatutScenarioPrevision.ACTIF });
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("s2");
  });

  it("pagine correctement (limit/offset)", async () => {
    const { getScenarios } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A", "P1");
    seedScenario("s2", "site-A", "P2");
    seedScenario("s3", "site-A", "P3");

    const { data, total } = await getScenarios("site-A", undefined, { limit: 2, offset: 1 });
    expect(total).toBe(3);
    expect(data).toHaveLength(2);
  });
});

describe("getScenarioById — R8 isolation par site", () => {
  it("retourne null si le scenario appartient a un autre site (jamais l'entite)", async () => {
    const { getScenarioById } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    const result = await getScenarioById("s1", "site-B");
    expect(result).toBeNull();
  });

  it("retourne le scenario avec parametres et paliers pour le bon site", async () => {
    const { getScenarioById } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    stores.palierRemise.push({ id: "pr1", scenarioId: "s1", seuilTonnes: "10", pourcentageRemise: "5", ordre: 1, siteId: "site-A" });

    const result = await getScenarioById("s1", "site-A");
    expect(result).not.toBeNull();
    expect(result!.parametres).not.toBeNull();
    expect(result!.paliersRemise).toHaveLength(1);
  });
});

describe("createScenario — transaction, copie AlimentPrevision (calibre+article, ADR-053 §12), isolation site", () => {
  it("cree le scenario + parametres et copie uniquement les Produit ALIMENT actifs DU MEME SITE, un calibre + un article a 100% par produit", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");

    stores.produit.push(
      { id: "p1", nom: "Granule A", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p2", nom: "Granule B (inactif)", categorie: CategorieProduit.ALIMENT, isActive: false, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p3", nom: "Autre categorie", categorie: CategorieProduit.INTRANT, isActive: true, contenance: 1, prixUnitaire: 1000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p4", nom: "Granule autre site", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-B" }
    );

    const scenario = await createScenario("site-A", {
      code: "PLAN-2026-08",
      nom: "Plan Aout",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
    });

    expect(scenario.siteId).toBe("site-A");
    expect(scenario.parametres).not.toBeNull();

    const aliments = stores.alimentPrevision.filter((a) => a.scenarioId === scenario.id);
    expect(aliments).toHaveLength(1);
    expect(aliments[0].tailleGranule).toBe(TailleGranule.G1);
    expect(aliments[0].siteId).toBe("site-A");

    const articles = stores.alimentArticlePrevision.filter(
      (a) => a.alimentCalibrePrevisionId === aliments[0].id
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].produitId).toBe("p1");
    expect(Number(articles[0].partApprovisionnementPct)).toBe(100);
    expect(articles[0].siteId).toBe("site-A");
  });

  it("ADR-053 §12.4 — regroupe par tailleGranule : deux Produit de la meme granulometrie deviennent UN calibre + DEUX articles dont la somme des parts vaut 100", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");

    stores.produit.push(
      { id: "p1", nom: "Marque A", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p2", nom: "Marque B", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 15, prixUnitaire: 16000, tailleGranule: TailleGranule.G1, siteId: "site-A" }
    );

    const scenario = await createScenario("site-A", {
      code: "PLAN-MULTI",
      nom: "Plan multi-marque",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
    });

    const aliments = stores.alimentPrevision.filter((a) => a.scenarioId === scenario.id);
    expect(aliments).toHaveLength(1); // UN SEUL calibre pour les deux produits du meme tailleGranule

    const articles = stores.alimentArticlePrevision.filter(
      (a) => a.alimentCalibrePrevisionId === aliments[0].id
    );
    expect(articles).toHaveLength(2);
    const sommeParts = articles.reduce((s, a) => s + Number(a.partApprovisionnementPct), 0);
    expect(sommeParts).toBe(100);
  });

  it("ADR-053 §12.2 arbitrage 5 — rejet NOMME (jamais une valeur devinee) si un Produit ALIMENT actif n'a pas de tailleGranule : AUCUN scenario cree", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");

    stores.produit.push(
      { id: "p1", nom: "Granule sans calibre", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: null, siteId: "site-A" }
    );

    await expect(
      createScenario("site-A", {
        code: "PLAN-SANS-CALIBRE",
        nom: "Plan invalide",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
      })
    ).rejects.toThrow(/sans tailleGranule.*Granule sans calibre/);

    // R4 : rien n'est cree — ni le scenario, ni ses parametres, ni un calibre orphelin.
    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-SANS-CALIBRE")).toHaveLength(0);
    expect(stores.alimentPrevision).toHaveLength(0);
  });

  it("rejette un code deja utilise au sein du MEME site", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A", "PLAN-DUP");

    await expect(
      createScenario("site-A", {
        code: "PLAN-DUP",
        nom: "Doublon",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
      })
    ).rejects.toThrow('deja utilise');

    // R4 : aucun ParametresPrevision fantome cree pour la tentative rejetee
    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-DUP")).toHaveLength(1);
  });

  it("autorise le meme code sur deux sites differents (pas de collision inter-site)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A", "PLAN-SAME");

    await expect(
      createScenario("site-B", {
        code: "PLAN-SAME",
        nom: "Plan site B",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
      })
    ).resolves.toBeDefined();

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-SAME")).toHaveLength(2);
  });
});

describe("createScenario — nombreCalibresAlimentsCrees (ADR-053 §18.2(b), signal explicite)", () => {
  it("expose nombreCalibresAlimentsCrees == 1 pour un seul calibre copie (produitIds absent)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");

    stores.produit.push({
      id: "p1",
      nom: "Granule A",
      categorie: CategorieProduit.ALIMENT,
      isActive: true,
      contenance: 25,
      prixUnitaire: 15000,
      tailleGranule: TailleGranule.G1,
      siteId: "site-A",
    });

    const scenario = await createScenario("site-A", {
      code: "PLAN-COUNT",
      nom: "Plan comptage",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
    });

    expect(scenario.nombreCalibresAlimentsCrees).toBe(1);
  });
});

describe("createScenario — ADR-053 §18, selection explicite via produitIds", () => {
  function seedDeuxCalibresQuatreProduits() {
    stores.produit.push(
      { id: "p1", nom: "Marque A G1", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p2", nom: "Marque B G1", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 15, prixUnitaire: 16000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p3", nom: "Marque C G2", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 20, prixUnitaire: 14000, tailleGranule: TailleGranule.G2, siteId: "site-A" },
      { id: "p4", nom: "Marque D sans calibrage", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: null, prixUnitaire: 12000, tailleGranule: null, siteId: "site-A" }
    );
  }

  it("regle 4 — sous-ensemble EXACT : deux produits du meme tailleGranule (G1), un seul coche -> UN calibre, UN article, 100% (pas la repartition a deux)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    const scenario = await createScenario("site-A", {
      code: "PLAN-SOUS-ENSEMBLE-UN",
      nom: "Plan sous-ensemble un seul",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
      produitIds: ["p1"],
    });

    expect(scenario.nombreCalibresAlimentsCrees).toBe(1);
    const aliments = stores.alimentPrevision.filter((a) => a.scenarioId === scenario.id);
    expect(aliments).toHaveLength(1);
    expect(aliments[0].tailleGranule).toBe(TailleGranule.G1);
    const articles = stores.alimentArticlePrevision.filter(
      (a) => a.alimentCalibrePrevisionId === aliments[0].id
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].produitId).toBe("p1");
    expect(Number(articles[0].partApprovisionnementPct)).toBe(100);
  });

  it("regle 4 — sous-ensemble EXACT : les deux produits du meme tailleGranule (G1) coches -> UN calibre, DEUX articles, somme des parts = 100 exact", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    const scenario = await createScenario("site-A", {
      code: "PLAN-SOUS-ENSEMBLE-DEUX",
      nom: "Plan sous-ensemble deux",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
      produitIds: ["p1", "p2"],
    });

    const aliments = stores.alimentPrevision.filter((a) => a.scenarioId === scenario.id);
    expect(aliments).toHaveLength(1);
    const articles = stores.alimentArticlePrevision.filter(
      (a) => a.alimentCalibrePrevisionId === aliments[0].id
    );
    expect(articles).toHaveLength(2);
    const somme = articles.reduce((s, a) => s + Number(a.partApprovisionnementPct), 0);
    expect(somme).toBe(100);
  });

  it("regle 4 — produitIds restreint aux DEUX calibres choisis, exclut le troisieme produit ALIMENT actif du site non coche", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    const scenario = await createScenario("site-A", {
      code: "PLAN-DEUX-CALIBRES",
      nom: "Plan deux calibres",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
      produitIds: ["p1", "p3"],
    });

    const aliments = stores.alimentPrevision.filter((a) => a.scenarioId === scenario.id);
    expect(aliments).toHaveLength(2);
    const taillesGranule = aliments.map((a) => a.tailleGranule).sort();
    expect(taillesGranule).toEqual([TailleGranule.G1, TailleGranule.G2].sort());
    const tousArticles = stores.alimentArticlePrevision.filter((a) =>
      aliments.some((al) => al.id === a.alimentCalibrePrevisionId)
    );
    expect(tousArticles.map((a) => a.produitId).sort()).toEqual(["p1", "p3"]);
  });

  it("regle 4 — ORDRE deterministe : filtrer produitIds preserve l'ordre alphabetique (orderBy nom asc), jamais l'ordre de produitIds", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    // p3 ("Marque C G2") vient APRES p1 ("Marque A G1") dans l'ordre alphabetique,
    // mais produitIds les liste dans l'ordre inverse ([p3, p1]) — l'ordre de
    // creation des calibres doit rester alphabetique (p1/G1 avant p3/G2),
    // jamais reconstruit depuis l'ordre du tableau produitIds.
    const scenario = await createScenario("site-A", {
      code: "PLAN-ORDRE",
      nom: "Plan ordre",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
      produitIds: ["p3", "p1"],
    });

    const aliments = stores.alimentPrevision
      .filter((a) => a.scenarioId === scenario.id)
      .sort((a, b) => (a.ordre as number) - (b.ordre as number));
    expect(aliments.map((a) => a.tailleGranule)).toEqual([TailleGranule.G1, TailleGranule.G2]);
  });

  it("regle 5 — produitIds: [] (selection vide EXPLICITE) autorisee : scenario cree, nombreCalibresAlimentsCrees === 0, aucune erreur", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    const scenario = await createScenario("site-A", {
      code: "PLAN-VIDE",
      nom: "Plan vide",
      dateDebutPlan: "2026-08-01",
      userId: "user-1",
      parametres: PARAMS,
      produitIds: [],
    });

    expect(scenario.id).toBeTruthy();
    expect(scenario.nombreCalibresAlimentsCrees).toBe(0);
    expect(stores.alimentPrevision.filter((a) => a.scenarioId === scenario.id)).toHaveLength(0);
  });

  it("regle 6 — produitIds ABSENT (undefined) : comportement historique STRICTEMENT inchange, copie TOUS les Produit ALIMENT actifs (y compris p4 qui serait rejete SI choisi explicitement)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    // p4 n'a pas de tailleGranule : le garde tout-ou-rien doit se declencher
    // exactement comme avant cet amendement quand produitIds est absent.
    stores.produit.push(
      { id: "p1", nom: "Marque A G1", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p4", nom: "Marque D sans calibrage", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 12000, tailleGranule: null, siteId: "site-A" }
    );

    await expect(
      createScenario("site-A", {
        code: "PLAN-ABSENT-TOUT-OU-RIEN",
        nom: "Plan absent",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        // produitIds volontairement absent du DTO
      })
    ).rejects.toThrow(/sans tailleGranule/);

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-ABSENT-TOUT-OU-RIEN")).toHaveLength(0);
  });

  it("regle 3 — garde serveur : id inconnu dans produitIds -> 422 NOMMANT l'id, AUCUNE ecriture (le garde s'execute AVANT tx.$transaction)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    await expect(
      createScenario("site-A", {
        code: "PLAN-ID-INCONNU",
        nom: "Plan id inconnu",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        produitIds: ["p1", "id-inexistant"],
      })
    ).rejects.toThrow(/id-inexistant/);

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-ID-INCONNU")).toHaveLength(0);
  });

  it("regle 3 — garde serveur : id HORS SITE dans produitIds -> 422 (rejete comme introuvable, jamais copie depuis un autre site)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();
    stores.produit.push({
      id: "p-autre-site",
      nom: "Produit autre site",
      categorie: CategorieProduit.ALIMENT,
      isActive: true,
      contenance: 25,
      prixUnitaire: 15000,
      tailleGranule: TailleGranule.G1,
      siteId: "site-B",
    });

    await expect(
      createScenario("site-A", {
        code: "PLAN-HORS-SITE",
        nom: "Plan hors site",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        produitIds: ["p-autre-site"],
      })
    ).rejects.toThrow(/p-autre-site/);

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-HORS-SITE")).toHaveLength(0);
  });

  it("regle 3 — garde serveur : id d'un produit NON-ALIMENT (autre categorie) dans produitIds -> 422", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    stores.produit.push({
      id: "p-intrant",
      nom: "Intrant quelconque",
      categorie: CategorieProduit.INTRANT,
      isActive: true,
      contenance: 25,
      prixUnitaire: 1000,
      tailleGranule: TailleGranule.G1,
      siteId: "site-A",
    });

    await expect(
      createScenario("site-A", {
        code: "PLAN-NON-ALIMENT",
        nom: "Plan non aliment",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        produitIds: ["p-intrant"],
      })
    ).rejects.toThrow(/p-intrant/);

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-NON-ALIMENT")).toHaveLength(0);
  });

  it("regle 3 — garde serveur : id d'un produit INACTIF dans produitIds -> 422", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    stores.produit.push({
      id: "p-inactif",
      nom: "Produit inactif",
      categorie: CategorieProduit.ALIMENT,
      isActive: false,
      contenance: 25,
      prixUnitaire: 15000,
      tailleGranule: TailleGranule.G1,
      siteId: "site-A",
    });

    await expect(
      createScenario("site-A", {
        code: "PLAN-INACTIF",
        nom: "Plan inactif",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        produitIds: ["p-inactif"],
      })
    ).rejects.toThrow(/p-inactif/);

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-INACTIF")).toHaveLength(0);
  });

  it("regle 3 — garde serveur : produit choisi explicitement SANS tailleGranule -> 422 nommant le produit ET la raison TAILLE_GRANULE_MANQUANTE", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    seedDeuxCalibresQuatreProduits();

    await expect(
      createScenario("site-A", {
        code: "PLAN-SANS-GRANULE-CHOISI",
        nom: "Plan sans granule choisi",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        produitIds: ["p1", "p4"],
      })
    ).rejects.toThrow(/p4/);

    expect(stores.scenarioPrevision.filter((s) => s.code === "PLAN-SANS-GRANULE-CHOISI")).toHaveLength(0);
    // Aucune ecriture partielle non plus pour p1 (rejet AVANT toute transaction).
    expect(stores.alimentPrevision).toHaveLength(0);
  });

  it("regle 3 — garde serveur : produit choisi explicitement avec contenance <= 0 -> 422 nommant le produit ET CONTENANCE_MANQUANTE (jamais un article a 0 kg/sac silencieux)", async () => {
    const { createScenario } = await import("@/lib/queries/previsions-scenarios");
    stores.produit.push({
      id: "p-sans-contenance",
      nom: "Produit sans contenance",
      categorie: CategorieProduit.ALIMENT,
      isActive: true,
      contenance: 0,
      prixUnitaire: 15000,
      tailleGranule: TailleGranule.G1,
      siteId: "site-A",
    });

    await expect(
      createScenario("site-A", {
        code: "PLAN-SANS-CONTENANCE-CHOISI",
        nom: "Plan sans contenance choisi",
        dateDebutPlan: "2026-08-01",
        userId: "user-1",
        parametres: PARAMS,
        produitIds: ["p-sans-contenance"],
      })
    ).rejects.toThrow(/p-sans-contenance/);

    expect(
      stores.scenarioPrevision.filter((s) => s.code === "PLAN-SANS-CONTENANCE-CHOISI")
    ).toHaveLength(0);
    expect(stores.alimentArticlePrevision).toHaveLength(0);
  });
});

describe("getProduitsAlimentairesEligibles — ADR-053 §18.1 (GET /produits-alimentaires-eligibles)", () => {
  it("renvoie TOUS les Produit ALIMENT actifs du site, chacun marque eligible/non-eligible — jamais filtre", async () => {
    const { getProduitsAlimentairesEligibles } = await import("@/lib/queries/previsions-scenarios");
    stores.produit.push(
      { id: "p1", nom: "Eligible", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p2", nom: "Sans granule", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: null, siteId: "site-A" },
      { id: "p3", nom: "Sans contenance", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: null, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p4", nom: "Inactif", categorie: CategorieProduit.ALIMENT, isActive: false, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p5", nom: "Autre categorie", categorie: CategorieProduit.INTRANT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-A" },
      { id: "p6", nom: "Autre site", categorie: CategorieProduit.ALIMENT, isActive: true, contenance: 25, prixUnitaire: 15000, tailleGranule: TailleGranule.G1, siteId: "site-B" }
    );

    const result = await getProduitsAlimentairesEligibles("site-A");

    // Appartenance : seuls les ALIMENT actifs du site — p4/p5/p6 exclus par le where.
    expect(result.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3"]);

    const p1 = result.find((p) => p.id === "p1")!;
    expect(p1.eligible).toBe(true);
    expect(p1.raisonsInvalidite).toEqual([]);

    const p2 = result.find((p) => p.id === "p2")!;
    expect(p2.eligible).toBe(false);
    expect(p2.raisonsInvalidite).toContain("TAILLE_GRANULE_MANQUANTE");

    const p3 = result.find((p) => p.id === "p3")!;
    expect(p3.eligible).toBe(false);
    expect(p3.raisonsInvalidite).toContain("CONTENANCE_MANQUANTE");
  });

  it("site sans aucun Produit ALIMENT actif -> tableau vide (signal non ambigu, ADR-053 §18.2(a))", async () => {
    const { getProduitsAlimentairesEligibles } = await import("@/lib/queries/previsions-scenarios");
    const result = await getProduitsAlimentairesEligibles("site-A");
    expect(result).toEqual([]);
  });
});

describe("updateParametresPrevision — R8 isolation par site", () => {
  it("rejette la mise a jour si le scenario appartient a un autre site, sans rien modifier", async () => {
    const { updateParametresPrevision } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    await expect(
      updateParametresPrevision("s1", "site-B", { prixVenteKgFCFA: 9999 })
    ).rejects.toThrow("Scenario introuvable");

    const params = stores.parametresPrevision.find((p) => p.scenarioId === "s1")!;
    expect(params.prixVenteKgFCFA).toBe(PARAMS.prixVenteKgFCFA);
  });

  it("met a jour uniquement les champs fournis pour le bon site", async () => {
    const { updateParametresPrevision } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    const updated = await updateParametresPrevision("s1", "site-A", { prixVenteKgFCFA: 1800 });
    expect(updated.prixVenteKgFCFA).toBe(1800);
    expect(updated.poidsObjectifG).toBe(PARAMS.poidsObjectifG);
  });
});

describe("replacePaliersRemise — R4 atomicite + R8 isolation", () => {
  function seedPaliers(scenarioId: string, siteId: string) {
    stores.palierRemise.push(
      { id: "pr-old-1", scenarioId, seuilTonnes: "10", pourcentageRemise: "2", ordre: 1, siteId },
      { id: "pr-old-2", scenarioId, seuilTonnes: "20", pourcentageRemise: "5", ordre: 2, siteId }
    );
  }

  it("remplace en bloc les paliers d'un scenario du bon site", async () => {
    const { replacePaliersRemise } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedPaliers("s1", "site-A");

    const result = await replacePaliersRemise("s1", "site-A", [
      { seuilTonnes: 15, pourcentageRemise: 3, ordre: 1 },
      { seuilTonnes: 30, pourcentageRemise: 7, ordre: 2 },
    ]);

    expect(result).toHaveLength(2);
    expect(stores.palierRemise.filter((p) => p.scenarioId === "s1")).toHaveLength(2);
    expect(stores.palierRemise.find((p) => p.id === "pr-old-1")).toBeUndefined();
  });

  it("R4 — seuils non strictement croissants rejetes : AUCUNE ecriture (anciens paliers intacts)", async () => {
    const { replacePaliersRemise } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedPaliers("s1", "site-A");

    await expect(
      replacePaliersRemise("s1", "site-A", [
        { seuilTonnes: 30, pourcentageRemise: 3, ordre: 1 },
        { seuilTonnes: 10, pourcentageRemise: 7, ordre: 2 }, // decroissant : invalide
      ])
    ).rejects.toThrow(/strictement croissants/);

    // Etat anterieur intact — ni delete ni create n'a persiste.
    const remaining = stores.palierRemise.filter((p) => p.scenarioId === "s1");
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.id).sort()).toEqual(["pr-old-1", "pr-old-2"]);
  });

  it("R4 — deux paliers de meme `ordre` rejetes par un message metier francais : AUCUNE ecriture", async () => {
    const { replacePaliersRemise } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedPaliers("s1", "site-A");

    // Sans cette garde : createMany echoue sur @@unique([scenarioId, ordre])
    // en P2002, traduit par "Cette valeur existe deja (scenarioId, ordre)" —
    // un message de base de donnees expose a l'utilisateur (ADR-053 §13.8).
    await expect(
      replacePaliersRemise("s1", "site-A", [
        { seuilTonnes: 5, pourcentageRemise: 1, ordre: 2 },
        { seuilTonnes: 10, pourcentageRemise: 3, ordre: 2 },
      ])
    ).rejects.toThrow(/meme ordre d'evaluation/);

    const remaining = stores.palierRemise.filter((p) => p.scenarioId === "s1");
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.id).sort()).toEqual(["pr-old-1", "pr-old-2"]);
  });

  it("R8 — rejette si le scenario appartient a un autre site, sans toucher aux paliers existants", async () => {
    const { replacePaliersRemise } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedPaliers("s1", "site-A");

    await expect(
      replacePaliersRemise("s1", "site-B", [{ seuilTonnes: 5, pourcentageRemise: 1, ordre: 1 }])
    ).rejects.toThrow("Scenario introuvable");

    expect(stores.palierRemise.filter((p) => p.scenarioId === "s1")).toHaveLength(2);
  });

  it("supporte le vidage complet (liste vide) sans createMany", async () => {
    const { replacePaliersRemise } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");
    seedPaliers("s1", "site-A");

    const result = await replacePaliersRemise("s1", "site-A", []);
    expect(result).toHaveLength(0);
    expect(stores.palierRemise.filter((p) => p.scenarioId === "s1")).toHaveLength(0);
  });
});

describe("archiverScenario / activerScenario — R8 isolation par site (updateMany atomique)", () => {
  it("archiverScenario rejette et ne modifie rien si le scenario est d'un autre site", async () => {
    const { archiverScenario } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    await expect(archiverScenario("s1", "site-B")).rejects.toThrow("Scenario introuvable");
    expect(stores.scenarioPrevision.find((s) => s.id === "s1")!.statut).toBe(
      StatutScenarioPrevision.BROUILLON
    );
  });

  it("archiverScenario passe le statut a ARCHIVE pour le bon site", async () => {
    const { archiverScenario } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    const result = await archiverScenario("s1", "site-A");
    expect(result.statut).toBe(StatutScenarioPrevision.ARCHIVE);
  });

  it("activerScenario rejette et ne modifie rien si le scenario est d'un autre site", async () => {
    const { activerScenario } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    await expect(activerScenario("s1", "site-B")).rejects.toThrow("Scenario introuvable");
    expect(stores.scenarioPrevision.find((s) => s.id === "s1")!.statut).toBe(
      StatutScenarioPrevision.BROUILLON
    );
  });

  it("activerScenario passe le statut a ACTIF pour le bon site", async () => {
    const { activerScenario } = await import("@/lib/queries/previsions-scenarios");
    seedScenario("s1", "site-A");

    const result = await activerScenario("s1", "site-A");
    expect(result.statut).toBe(StatutScenarioPrevision.ACTIF);
  });
});
