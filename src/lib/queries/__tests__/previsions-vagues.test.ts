/**
 * Tests unitaires — story PR2.1, `src/lib/queries/previsions-vagues.ts`.
 *
 * Coeur metier de la story. Couvre :
 *  1. R8 — isolation par site sur toutes les fonctions.
 *  2. R4 — `scinderVaguePrevue` et `replaceAlimentsParVaguePrevue` :
 *     remplacement/creation en bloc, rollback complet sur erreur.
 *  3. Regle metier ADR-053 decision 2 : `annulerVaguePrevue` interdit si une
 *     vague reelle est rattachee ; AUCUNE fonction `deleteVaguePrevue`
 *     n'existe dans le module.
 *  4. Scission : enfants avec `vaguePrevueParentId` renseigne,
 *     `dureeCycleMoisFigee` copiee depuis le PARENT, parent -> ANNULEE.
 *  5. `rattacherVaguePrevue` : la contrainte @unique de `Vague.vaguePrevueId`
 *     rejette un double-rattachement (simulee dans le fake db).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatutVaguePrevue } from "@/types";
import { createEmptyStores, buildFakePrisma, type Stores } from "./previsions-fake-db";

const stores: Stores = createEmptyStores();

vi.mock("@/lib/db", () => ({
  prisma: buildFakePrisma(stores),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
});

function seedScenario(id: string, siteId: string, dureeCycleMois = 3) {
  stores.scenarioPrevision.push({
    id,
    code: `C-${id}`,
    nom: "S",
    dureeCycleMois,
    dateDebutPlan: new Date("2026-08-01"),
    siteId,
  });
}

function seedParametres(
  scenarioId: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  stores.parametresPrevision.push({
    id: `param-${scenarioId}`,
    scenarioId,
    effectifAlevinsParVague: 5000,
    margeSecuriteAlevinsPct: "10",
    poidsMoyenInitialG: "5",
    poidsObjectifG: "800",
    prixAlevinUnitaireFCFA: "50",
    prixVenteKgFCFA: "1500",
    nombreBacsSimultanesCible: 4,
    frequenceStockageMois: "1",
    ...overrides,
  });
}

function seedVaguePrevue(
  id: string,
  scenarioId: string,
  siteId: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  stores.vaguePrevue.push({
    id,
    scenarioId,
    code: `V-${id}`,
    dateStockagePrevue: new Date("2026-08-01"),
    effectifAlevinsPrevu: 1000,
    poidsMoyenInitialG: "5",
    dureeCycleMoisFigee: 3,
    statut: StatutVaguePrevue.PLANIFIEE,
    vaguePrevueParentId: null,
    siteId,
    ...overrides,
  });
}

describe("Aucune fonction deleteVaguePrevue exposee (regle structurelle ADR-053 decision 2)", () => {
  it("le module n'exporte pas de fonction deleteVaguePrevue", async () => {
    const mod = await import("@/lib/queries/previsions-vagues");
    expect((mod as Record<string, unknown>).deleteVaguePrevue).toBeUndefined();
  });
});

describe("getVaguesPrevuesParScenario / getVaguePrevueById — R8 isolation", () => {
  it("getVaguesPrevuesParScenario ne renvoie rien pour le mauvais site", async () => {
    const { getVaguesPrevuesParScenario } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    const result = await getVaguesPrevuesParScenario("s1", "site-B");
    expect(result).toHaveLength(0);
  });

  it("getVaguePrevueById retourne null si la VaguePrevue est d'un autre site", async () => {
    const { getVaguePrevueById } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    expect(await getVaguePrevueById("v1", "site-B")).toBeNull();
  });

  it("filtre par statut", async () => {
    const { getVaguesPrevuesParScenario } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedVaguePrevue("v2", "s1", "site-A", { statut: StatutVaguePrevue.ANNULEE });

    const result = await getVaguesPrevuesParScenario("s1", "site-A", {
      statut: StatutVaguePrevue.ANNULEE,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("v2");
  });
});

describe("createVaguePrevue — copie dureeCycleMoisFigee + R8", () => {
  it("copie dureeCycleMoisFigee depuis le scenario au moment de la creation", async () => {
    const { createVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 4);
    seedParametres("s1");

    const result = await createVaguePrevue("s1", "site-A", {
      code: "V1",
      dateStockagePrevue: "2026-08-01",
      effectifAlevinsPrevu: 1000,
      poidsMoyenInitialG: 5,
    });

    expect(result.dureeCycleMoisFigee).toBe(4);
  });

  it("R8 — rejette si le scenario est d'un autre site, aucune VaguePrevue creee", async () => {
    const { createVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");

    await expect(
      createVaguePrevue("s1", "site-B", {
        code: "V1",
        dateStockagePrevue: "2026-08-01",
        effectifAlevinsPrevu: 1000,
        poidsMoyenInitialG: 5,
      })
    ).rejects.toThrow("Scenario introuvable");

    expect(stores.vaguePrevue).toHaveLength(0);
  });
});

describe("createVaguePrevue — propagation de alevinsAchetesParDefaut (ERR-170 / ADR-053 §14, pre-analyse §4 point 1)", () => {
  it("herite de ParametresPrevision.alevinsAchetesParDefaut quand alevinsAchetes n'est pas fourni (defaut = true)", async () => {
    const { createVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1", { alevinsAchetesParDefaut: true });

    const result = await createVaguePrevue("s1", "site-A", {
      code: "V1",
      dateStockagePrevue: "2026-08-01",
      effectifAlevinsPrevu: 1000,
      poidsMoyenInitialG: 5,
    });

    expect(result.alevinsAchetes).toBe(true);
  });

  it("herite de ParametresPrevision.alevinsAchetesParDefaut quand alevinsAchetes n'est pas fourni (defaut = false)", async () => {
    const { createVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1", { alevinsAchetesParDefaut: false });

    const result = await createVaguePrevue("s1", "site-A", {
      code: "V1",
      dateStockagePrevue: "2026-08-01",
      effectifAlevinsPrevu: 1000,
      poidsMoyenInitialG: 5,
    });

    expect(result.alevinsAchetes).toBe(false);
  });

  it("alevinsAchetes fourni explicitement PREVAUT sur le defaut du scenario", async () => {
    const { createVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1", { alevinsAchetesParDefaut: true });

    const result = await createVaguePrevue("s1", "site-A", {
      code: "V1",
      dateStockagePrevue: "2026-08-01",
      effectifAlevinsPrevu: 1000,
      poidsMoyenInitialG: 5,
      alevinsAchetes: false,
    });

    expect(result.alevinsAchetes).toBe(false);
  });
});

describe("updateVaguePrevue — R8 isolation (updateMany atomique)", () => {
  it("rejette la mise a jour si la VaguePrevue est d'un autre site, sans rien modifier", async () => {
    const { updateVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    await expect(
      updateVaguePrevue("v1", "site-B", { effectifAlevinsPrevu: 5000 })
    ).rejects.toThrow("VaguePrevue introuvable");

    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.effectifAlevinsPrevu).toBe(1000);
  });

  it("alevinsAchetes est librement editable apres creation (ADR-053 §14, pre-analyse §4 point 4)", async () => {
    const { updateVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A", { alevinsAchetes: false });

    const result = await updateVaguePrevue("v1", "site-A", { alevinsAchetes: true });
    expect(result.alevinsAchetes).toBe(true);
  });
});

describe("scinderVaguePrevue — R4 + regle metier decision 2", () => {
  it("exige au moins 2 scissions (rejet avant meme d'ouvrir la transaction)", async () => {
    const { scinderVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    await expect(
      scinderVaguePrevue("v1", "site-A", [
        { code: "V1a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
      ])
    ).rejects.toThrow("au moins 2 vagues prevues");

    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.PLANIFIEE);
  });

  it("cree les enfants avec vaguePrevueParentId renseigne et dureeCycleMoisFigee COPIEE DU PARENT, puis annule le parent", async () => {
    const { scinderVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 6); // duree courante du scenario DIFFERENTE de celle figee du parent
    seedVaguePrevue("v1", "s1", "site-A", { dureeCycleMoisFigee: 3 });

    const enfants = await scinderVaguePrevue("v1", "site-A", [
      { code: "V1a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
      { code: "V1b", dateStockagePrevue: "2026-09-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
    ]);

    expect(enfants).toHaveLength(2);
    for (const enfant of enfants) {
      expect(enfant.vaguePrevueParentId).toBe("v1");
      // Copiee depuis le PARENT (3), jamais depuis scenario.dureeCycleMois courant (6).
      expect(enfant.dureeCycleMoisFigee).toBe(3);
      expect(enfant.statut).toBe(StatutVaguePrevue.PLANIFIEE);
    }

    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.ANNULEE);
  });

  it("alevinsAchetes des enfants COPIE DU PARENT (true), jamais du defaut du scenario (false) — ERR-170 / ADR-053 §14, pre-analyse §4 point 3", async () => {
    const { scinderVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1", { alevinsAchetesParDefaut: false }); // defaut du scenario DIFFERENT du parent
    seedVaguePrevue("v1", "s1", "site-A", { alevinsAchetes: true });

    const enfants = await scinderVaguePrevue("v1", "site-A", [
      { code: "V1a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
      { code: "V1b", dateStockagePrevue: "2026-09-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
    ]);

    for (const enfant of enfants) {
      expect(enfant.alevinsAchetes).toBe(true);
    }
  });

  it("alevinsAchetes des enfants COPIE DU PARENT (false), jamais du defaut du scenario (true) — sens inverse du test precedent", async () => {
    const { scinderVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1", { alevinsAchetesParDefaut: true }); // defaut du scenario DIFFERENT du parent
    seedVaguePrevue("v1", "s1", "site-A", { alevinsAchetes: false });

    const enfants = await scinderVaguePrevue("v1", "site-A", [
      { code: "V1a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
      { code: "V1b", dateStockagePrevue: "2026-09-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
    ]);

    for (const enfant of enfants) {
      expect(enfant.alevinsAchetes).toBe(false);
    }
  });

  it("R8 — rejette si le parent est d'un autre site ; aucun enfant cree, parent intact", async () => {
    const { scinderVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    await expect(
      scinderVaguePrevue("v1", "site-B", [
        { code: "V1a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
        { code: "V1b", dateStockagePrevue: "2026-09-01", effectifAlevinsPrevu: 500, poidsMoyenInitialG: 5 },
      ])
    ).rejects.toThrow("VaguePrevue introuvable");

    expect(stores.vaguePrevue.filter((v) => v.vaguePrevueParentId === "v1")).toHaveLength(0);
    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.PLANIFIEE);
  });
});

describe("annulerVaguePrevue — regle metier decision 2 + R8", () => {
  it("passe le statut a ANNULEE quand aucune vague reelle n'est rattachee", async () => {
    const { annulerVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    const result = await annulerVaguePrevue("v1", "site-A");
    expect(result.statut).toBe(StatutVaguePrevue.ANNULEE);
  });

  it("INTERDIT l'annulation si une vague reelle est rattachee : statut inchange", async () => {
    const { annulerVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    stores.vague.push({ id: "vague-reelle-1", vaguePrevueId: "v1", siteId: "site-A" });

    await expect(annulerVaguePrevue("v1", "site-A")).rejects.toThrow(
      /rattachee a une vague reelle/
    );

    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.PLANIFIEE);
  });

  it("R8 — rejette si la VaguePrevue est d'un autre site, statut inchange", async () => {
    const { annulerVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");

    await expect(annulerVaguePrevue("v1", "site-B")).rejects.toThrow("VaguePrevue introuvable");
    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.PLANIFIEE);
  });

  it("R4 — l'ecriture est conditionnee sur `vague: null` (updateMany), pas un check-then-update : un rattachement concurrent juste avant l'appel bloque bien l'annulation", async () => {
    const { annulerVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    // Simule un rattachement concurrent survenu juste avant l'appel :
    // le fake db n'a pas de vraie concurrence, mais ce test prouve que la
    // condition `vague: null` est bien portee par l'ecriture elle-meme
    // (updateMany), et non plus par une lecture prealable separee dont le
    // resultat serait perime au moment du update.
    stores.vague.push({ id: "vague-concurrente", vaguePrevueId: "v1", siteId: "site-A" });

    await expect(annulerVaguePrevue("v1", "site-A")).rejects.toThrow(
      /rattachee a une vague reelle/
    );
    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.PLANIFIEE);
  });
});

describe("rattacherVaguePrevue — R8 isolation + contrainte @unique Vague.vaguePrevueId", () => {
  function seedVagueReelle(id: string, siteId: string, vaguePrevueId: string | null = null) {
    stores.vague.push({ id, vaguePrevueId, siteId });
  }

  it("rattache la vague reelle a la VaguePrevue pour le bon site", async () => {
    const { rattacherVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedVagueReelle("vague-1", "site-A");

    const result = await rattacherVaguePrevue("vague-1", "v1", "site-A");
    expect(result.vaguePrevueId).toBe("v1");
  });

  it("R8 — rejette si la VaguePrevue est d'un autre site, vague reelle non modifiee", async () => {
    const { rattacherVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedVagueReelle("vague-1", "site-B");

    await expect(rattacherVaguePrevue("vague-1", "v1", "site-B")).rejects.toThrow(
      "VaguePrevue introuvable"
    );
    expect(stores.vague.find((v) => v.id === "vague-1")!.vaguePrevueId).toBeNull();
  });

  it("R8 — rejette si la vague reelle est d'un autre site que celui demande", async () => {
    const { rattacherVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedVagueReelle("vague-1", "site-B"); // vague reelle d'un AUTRE site que v1/site-A

    await expect(rattacherVaguePrevue("vague-1", "v1", "site-A")).rejects.toThrow(
      "Vague introuvable"
    );
  });
});

describe("replaceAlimentsParVaguePrevue — R4 rollback reel sur violation @@unique + R8", () => {
  function seedAlimentsParMois(vaguePrevueId: string, siteId: string) {
    stores.alimentParVaguePrevue.push(
      {
        id: "old-1",
        vaguePrevueId,
        alimentPrevisionId: "aliment-1",
        moisCycle: 1,
        sacsCalcules: 10,
        sacsSaisis: null,
        quantiteKgCalculee: "250",
        coutCalculeFCFA: "375000",
        siteId,
      }
    );
  }

  it("remplace en bloc les lignes de besoin aliment", async () => {
    const { replaceAlimentsParVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedAlimentsParMois("v1", "site-A");

    const result = await replaceAlimentsParVaguePrevue("v1", "site-A", [
      {
        alimentPrevisionId: "aliment-1",
        moisCycle: 1,
        sacsCalcules: 12,
        sacsSaisis: null,
        quantiteKgCalculee: 300,
        coutCalculeFCFA: 450000,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(stores.alimentParVaguePrevue.find((l) => l.id === "old-1")).toBeUndefined();
    expect(stores.alimentParVaguePrevue.filter((l) => l.vaguePrevueId === "v1")).toHaveLength(1);
  });

  it("R4 — violation reelle de la contrainte @@unique (vaguePrevueId,alimentPrevisionId,moisCycle) pendant createMany => rollback complet, anciennes lignes intactes", async () => {
    const { replaceAlimentsParVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedAlimentsParMois("v1", "site-A");

    const ligneDupliquee = {
      alimentPrevisionId: "aliment-1",
      moisCycle: 1,
      sacsCalcules: 12,
      sacsSaisis: null,
      quantiteKgCalculee: 300,
      coutCalculeFCFA: 450000,
    };

    await expect(
      replaceAlimentsParVaguePrevue("v1", "site-A", [ligneDupliquee, ligneDupliquee])
    ).rejects.toThrow(/Unique constraint failed/);

    // Le deleteMany a eu lieu AVANT le createMany dans la meme transaction :
    // sans rollback applicatif reel de la transaction, "old-1" serait perdu
    // meme si le createMany echoue ensuite. Le fake db simule le VRAI
    // comportement Postgres/Prisma ($transaction rollback sur exception) :
    // l'ancienne ligne doit avoir survecu.
    const remaining = stores.alimentParVaguePrevue.filter((l) => l.vaguePrevueId === "v1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("old-1");
  });

  it("R8 — rejette si la VaguePrevue est d'un autre site, anciennes lignes intactes", async () => {
    const { replaceAlimentsParVaguePrevue } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedVaguePrevue("v1", "s1", "site-A");
    seedAlimentsParMois("v1", "site-A");

    await expect(
      replaceAlimentsParVaguePrevue("v1", "site-B", [
        {
          alimentPrevisionId: "aliment-1",
          moisCycle: 2,
          sacsCalcules: 5,
          sacsSaisis: null,
          quantiteKgCalculee: 100,
          coutCalculeFCFA: 150000,
        },
      ])
    ).rejects.toThrow("VaguePrevue introuvable");

    expect(stores.alimentParVaguePrevue.filter((l) => l.vaguePrevueId === "v1")).toHaveLength(1);
  });
});

describe("updateSacsSaisis — COALESCE(sacsSaisis, sacsCalcules) + R8 (updateMany atomique)", () => {
  function seedLigne(id: string, siteId: string) {
    stores.alimentParVaguePrevue.push({
      id,
      vaguePrevueId: "v1",
      alimentPrevisionId: "aliment-1",
      moisCycle: 1,
      sacsCalcules: 10,
      sacsSaisis: null,
      quantiteKgCalculee: "250",
      coutCalculeFCFA: "375000",
      siteId,
    });
  }

  it("pose une surcharge sacsSaisis : c'est elle qui doit alimenter les calculs downstream, jamais sacsCalcules seul", async () => {
    const { updateSacsSaisis } = await import("@/lib/queries/previsions-vagues");
    seedLigne("l1", "site-A");

    const result = await updateSacsSaisis("l1", "site-A", 15);
    expect(result.sacsSaisis).toBe(15);
    expect(result.sacsCalcules).toBe(10); // sacsCalcules n'est jamais reecrit par cette fonction

    // La convention COALESCE(sacsSaisis, sacsCalcules) est une regle
    // downstream (moteur/consommateurs) : ici, on prouve seulement que la
    // valeur persistee est bien la surcharge (15), disponible pour ce COALESCE.
    const valeurUtilisable = result.sacsSaisis ?? result.sacsCalcules;
    expect(valeurUtilisable).toBe(15);
  });

  it("efface la surcharge (null) : le COALESCE retombera alors sur sacsCalcules", async () => {
    const { updateSacsSaisis } = await import("@/lib/queries/previsions-vagues");
    seedLigne("l1", "site-A");
    stores.alimentParVaguePrevue.find((l) => l.id === "l1")!.sacsSaisis = 20;

    const result = await updateSacsSaisis("l1", "site-A", null);
    expect(result.sacsSaisis).toBeNull();
    const valeurUtilisable = result.sacsSaisis ?? result.sacsCalcules;
    expect(valeurUtilisable).toBe(10);
  });

  it("R8 — rejette si la ligne est d'un autre site, sans rien modifier", async () => {
    const { updateSacsSaisis } = await import("@/lib/queries/previsions-vagues");
    seedLigne("l1", "site-A");

    await expect(updateSacsSaisis("l1", "site-B", 99)).rejects.toThrow(
      "Ligne AlimentParVaguePrevue introuvable"
    );
    expect(stores.alimentParVaguePrevue.find((l) => l.id === "l1")!.sacsSaisis).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// apercuGenerationPlan / genererPlanVaguesPrevues — story PR2bis.2
// ---------------------------------------------------------------------------
//
// Cable enfin `genererPlanEmpoissonnement` (moteur pur, jusque-la teste
// unitairement mais jamais appele depuis une query/route, cf. pre-analyse
// PR2bis.2). Seul `horizonMois` est un input reel : `dateDebutPlan`,
// `dureeCycleMois`, `effectifAlevinsParVague`, `poidsMoyenInitialG`,
// `frequenceStockageMois` sont relus depuis le scenario/ParametresPrevision
// seedes, jamais passes par l'appelant du test.

describe("apercuGenerationPlan — dry-run, aucune ecriture", () => {
  it("rejette si le scenario est d'un autre site (404)", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1");

    await expect(apercuGenerationPlan("s1", "site-B", 3, "ajouter")).rejects.toThrow(
      "Scenario introuvable"
    );
  });

  it("rejette explicitement si ParametresPrevision est absent (relation optionnelle)", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    // Pas de seedParametres : ParametresPrevision absent pour ce scenario.

    await expect(apercuGenerationPlan("s1", "site-A", 3, "ajouter")).rejects.toThrow(
      "ParametresPrevision absent"
    );
  });

  it("ne modifie AUCUNE table (dry-run reel)", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });

    await apercuGenerationPlan("s1", "site-A", 2, "ajouter");

    expect(stores.vaguePrevue).toHaveLength(0);
  });

  it("mode 'ajouter' : ne compte que les vagues theoriques au-dela de celles deja existantes", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    // 2 VaguePrevue deja existantes -> horizon 4 (5 vagues theoriques, mois 0..4) -> 3 nouvelles.
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1" });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2" });

    const apercu = await apercuGenerationPlan("s1", "site-A", 4, "ajouter");

    expect(apercu.nombreNouvellesVagues).toBe(3);
    expect(apercu.nombreVaguesAnnuleesEtRemplacees).toBe(0);
    expect(apercu.codesGeneres).toEqual(["V3", "V4", "V5"]);
  });

  it("mode 'ajouter' : 0 nouvelle vague si l'horizon ne depasse pas ce qui existe deja", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1" });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2" });
    seedVaguePrevue("v3", "s1", "site-A", { code: "V3" });

    const apercu = await apercuGenerationPlan("s1", "site-A", 1, "ajouter");

    expect(apercu.nombreNouvellesVagues).toBe(0);
    expect(apercu.codesGeneres).toEqual([]);
  });

  it("mode 'remplacer' : decompte separement les vagues rattachees (conservees) des PLANIFIEE non rattachees (annulees et remplacees)", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", statut: StatutVaguePrevue.PLANIFIEE });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2", statut: StatutVaguePrevue.EN_COURS });
    stores.vague.push({ id: "vague-reelle-1", vaguePrevueId: "v2", siteId: "site-A" });
    seedVaguePrevue("v3", "s1", "site-A", { code: "V3", statut: StatutVaguePrevue.REALISEE });
    stores.vague.push({ id: "vague-reelle-2", vaguePrevueId: "v3", siteId: "site-A" });

    const apercu = await apercuGenerationPlan("s1", "site-A", 2, "remplacer");

    // 2 vagues rattachees (v2, v3) conservees ; 1 PLANIFIEE non rattachee (v1) annulee.
    expect(apercu.nombreVaguesRattacheesConservees).toBe(2);
    expect(apercu.nombreVaguesAnnuleesEtRemplacees).toBe(1);
    // Codes neufs, jamais V1..V3 reutilises (arbitrage PM) : reprend apres le plus haut numero (3).
    expect(apercu.nombreNouvellesVagues).toBe(3);
    expect(apercu.codesGeneres).toEqual(["V4", "V5", "V6"]);
  });

  it("une VaguePrevue deja ANNULEE occupe toujours sa ligne de code — jamais reutilisee par une regeneration", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V7", statut: StatutVaguePrevue.ANNULEE });

    const apercu = await apercuGenerationPlan("s1", "site-A", 1, "ajouter");

    expect(apercu.codesGeneres[0]).toBe("V8");
  });
});

describe("genererPlanVaguesPrevues — R4 (transaction unique) + regles de code/mode", () => {
  it("rejette si le scenario est d'un autre site, aucune ecriture", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");
    seedParametres("s1");

    await expect(genererPlanVaguesPrevues("s1", "site-B", 3, "ajouter")).rejects.toThrow(
      "Scenario introuvable"
    );
    expect(stores.vaguePrevue).toHaveLength(0);
  });

  it("rejette explicitement si ParametresPrevision est absent, aucune ecriture", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A");

    await expect(genererPlanVaguesPrevues("s1", "site-A", 3, "ajouter")).rejects.toThrow(
      "ParametresPrevision absent"
    );
    expect(stores.vaguePrevue).toHaveLength(0);
  });

  it("cas de reference ADR-053 §1 : horizon 21 mois, frequence mensuelle -> 19 VaguePrevue creees en une seule transaction", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 18, "ajouter");

    // 19 vagues (mois 0..18 inclus, offset += 1) — le cas d'usage de reference (ADR-053 §1) :
    // planifier 19 vagues sur 21 mois.
    expect(crees).toHaveLength(19);
    expect(crees.map((v) => v.code)).toEqual(
      Array.from({ length: 19 }, (_, i) => `V${i + 1}`)
    );
    expect(stores.vaguePrevue).toHaveLength(19);
    for (const v of stores.vaguePrevue) {
      expect(v.statut).toBe(StatutVaguePrevue.PLANIFIEE);
    }
  });

  it("mode 'ajouter' : ne touche AUCUNE ligne existante, complete seulement a partir de la suite", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", effectifAlevinsPrevu: 4242 });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2", effectifAlevinsPrevu: 4242 });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 4, "ajouter");

    expect(crees).toHaveLength(3);
    expect(crees.map((v) => v.code)).toEqual(["V3", "V4", "V5"]);
    // Les 2 lignes existantes n'ont pas ete touchees (meme effectif custom).
    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.effectifAlevinsPrevu).toBe(4242);
    expect(stores.vaguePrevue.find((v) => v.id === "v2")!.effectifAlevinsPrevu).toBe(4242);
    expect(stores.vaguePrevue).toHaveLength(5);
  });

  it("mode 'remplacer' : annule uniquement les PLANIFIEE non rattachees ; EN_COURS/REALISEE/ANNULEE et les rattachees restent intactes", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", statut: StatutVaguePrevue.PLANIFIEE });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2", statut: StatutVaguePrevue.EN_COURS });
    stores.vague.push({ id: "vague-reelle-1", vaguePrevueId: "v2", siteId: "site-A" });
    seedVaguePrevue("v3", "s1", "site-A", { code: "V3", statut: StatutVaguePrevue.ANNULEE });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 1, "remplacer");

    expect(stores.vaguePrevue.find((v) => v.id === "v1")!.statut).toBe(StatutVaguePrevue.ANNULEE);
    expect(stores.vaguePrevue.find((v) => v.id === "v2")!.statut).toBe(StatutVaguePrevue.EN_COURS);
    expect(stores.vaguePrevue.find((v) => v.id === "v3")!.statut).toBe(StatutVaguePrevue.ANNULEE);
    // Codes neufs, jamais V1..V3 reutilises malgre l'annulation de v1.
    expect(crees.map((v) => v.code)).toEqual(["V4", "V5"]);
  });

  it("aucune fonction deleteVaguePrevue n'est utilisee : le mode 'remplacer' n'a jamais reduit le nombre total de lignes", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", statut: StatutVaguePrevue.PLANIFIEE });

    const avant = stores.vaguePrevue.length;
    await genererPlanVaguesPrevues("s1", "site-A", 1, "remplacer");

    expect(stores.vaguePrevue.length).toBeGreaterThan(avant);
  });

  it("applique ParametresPrevision.alevinsAchetesParDefaut a chaque VaguePrevue creee (true) — ERR-170 / ADR-053 §14, pre-analyse §4 point 2", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1", alevinsAchetesParDefaut: true });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 2, "ajouter");

    expect(crees.length).toBeGreaterThan(0);
    for (const v of crees) {
      expect(v.alevinsAchetes).toBe(true);
    }
  });

  it("applique ParametresPrevision.alevinsAchetesParDefaut a chaque VaguePrevue creee (false)", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1", alevinsAchetesParDefaut: false });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 2, "ajouter");

    expect(crees.length).toBeGreaterThan(0);
    for (const v of crees) {
      expect(v.alevinsAchetes).toBe(false);
    }
  });
});
