/**
 * Tests unitaires — story PR2.1, `src/lib/queries/previsions-scenario-loader.ts`
 * (`chargerScenarioPourMoteur`).
 *
 * Couvre :
 *  1. R8 — un scenario d'un autre site n'est jamais charge.
 *  2. Conversion Decimal Prisma -> Decimal moteur via `prismaDecimalToEngine`
 *     (jamais un detour par `number`) sur chaque champ traverse.
 *  3. Absence de N+1 : le nombre de requetes Prisma reste CONSTANT quel que
 *     soit le nombre de VaguePrevue/AlimentPrevision du scenario. Le fake db
 *     partage (`previsions-fake-db.ts`) n'a pas de compteur de requetes
 *     integre nativement -> on instrumente ici un compteur explicite en
 *     enveloppant chaque methode de modele avec un espion, plutot que
 *     d'utiliser un middleware Prisma `$on('query')` reel (qui necessite un
 *     vrai client connecte a Postgres, hors de portee d'un test unitaire
 *     mocke). Cela mesure fidelement le nombre d'ALLERS-RETOURS logiques
 *     effectues par la fonction (chaque `findMany`/`findFirst` = un aller-
 *     retour reseau avec un vrai Prisma), ce qui est exactement la propriete
 *     que la JSDoc de la fonction revendique ("nombre constant de requetes,
 *     independant du nombre de vagues/aliments").
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatutScenarioPrevision, StatutVaguePrevue, TypePostePrevision, TailleGranule } from "@/types";
import { createEmptyStores, buildFakePrisma, type Stores } from "./previsions-fake-db";

const stores: Stores = createEmptyStores();
let queryCount = 0;

/**
 * Enveloppe chaque methode de CHAQUE modele (scenarioPrevision.findFirst,
 * alimentPrevision.findMany, etc.) pour compter un appel = un aller-retour
 * logique. `$transaction` n'est pas compte lui-meme (ce n'est pas une
 * requete), mais n'est pas utilise par `chargerScenarioPourMoteur` de toute
 * facon (lecture seule, pas de transaction).
 */
function countingProxy<T extends object>(target: T): T {
  const wrapped: Record<string, unknown> = {};
  for (const [modelName, modelOrFn] of Object.entries(target)) {
    if (modelName === "$transaction") {
      wrapped[modelName] = modelOrFn;
      continue;
    }
    const model = modelOrFn as Record<string, unknown>;
    const wrappedModel: Record<string, unknown> = {};
    for (const [method, fn] of Object.entries(model)) {
      wrappedModel[method] = (...args: unknown[]) => {
        queryCount += 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (fn as any).apply(model, args);
      };
    }
    wrapped[modelName] = wrappedModel;
  }
  return wrapped as T;
}

vi.mock("@/lib/db", () => ({
  prisma: countingProxy(buildFakePrisma(stores)),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
  queryCount = 0;
});

function seedFullScenario(siteId: string, nbVagues: number) {
  stores.scenarioPrevision.push({
    id: "s1",
    code: "PLAN-1",
    nom: "Plan",
    dureeCycleMois: 3,
    dateDebutPlan: new Date("2026-08-01"),
    statut: StatutScenarioPrevision.ACTIF,
    siteId,
  });
  stores.parametresPrevision.push({
    id: "params-1",
    scenarioId: "s1",
    effectifAlevinsParVague: 1000,
    margeSecuriteAlevinsPct: "5",
    poidsMoyenInitialG: "5",
    poidsObjectifG: "800",
    prixAlevinUnitaireFCFA: "50",
    prixVenteKgFCFA: "1500",
    nombreBacsSimultanesCible: 4,
    frequenceStockageMois: "1",
    capaciteTransportAlimentsSacs: "50",
    coutTransportAlimentsFCFA: "20000",
    capaciteTransportPoissonsKg: "500",
    coutTransportPoissonsFCFA: "30000",
    capaciteTransportAlevinsNb: "5000",
    coutTransportAlevinsFCFA: "15000",
    tresorerieInitialeFCFA: "0",
  });
  stores.palierRemise.push({ id: "pr1", scenarioId: "s1", seuilTonnes: "10", pourcentageRemise: "5", ordre: 1, siteId });
  stores.alimentPrevision.push({
    id: "a1",
    scenarioId: "s1",
    tailleGranule: TailleGranule.G1,
    sacsParTonneStandard: null,
    ordre: 0,
    siteId,
  });
  stores.alimentArticlePrevision.push({
    id: "art1",
    alimentCalibrePrevisionId: "a1",
    produitId: null,
    libelle: "Granule",
    poidsSacKg: "25",
    prixSacFCFA: "15000",
    sacsParTonneUnitaire: "40",
    partApprovisionnementPct: "100",
    ordre: 0,
    siteId,
  });
  stores.repartitionMoisAliment.push({
    id: "r1",
    alimentPrevisionId: "a1",
    moisCycle: 1,
    pourcentage: "100",
    siteId,
  });
  for (let i = 0; i < nbVagues; i++) {
    const vId = `v${i}`;
    stores.vaguePrevue.push({
      id: vId,
      scenarioId: "s1",
      code: `V${i}`,
      dateStockagePrevue: new Date("2026-08-01"),
      effectifAlevinsPrevu: 1000,
      poidsMoyenInitialG: "5",
      dureeCycleMoisFigee: 3,
      statut: StatutVaguePrevue.PLANIFIEE,
      vaguePrevueParentId: null,
      siteId,
    });
    stores.alimentParVaguePrevue.push({
      id: `apv${i}`,
      vaguePrevueId: vId,
      alimentPrevisionId: "a1",
      moisCycle: 1,
      sacsCalcules: 5,
      sacsSaisis: null,
      quantiteKgCalculee: "125",
      coutCalculeFCFA: "187500",
      siteId,
    });
  }
  stores.postePrevision.push({
    id: "p1",
    scenarioId: "s1",
    libelle: "Electricite",
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: true,
    ordre: 0,
    siteId,
  });
  stores.chargeMensuellePrevue.push({
    id: "cm1",
    scenarioId: "s1",
    posteId: "p1",
    moisAbsolu: 0,
    montantFCFA: "50000",
    siteId,
  });
}

describe("chargerScenarioPourMoteur — R8 isolation", () => {
  it("rejette si le scenario est d'un autre site", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );
    seedFullScenario("site-A", 1);

    await expect(chargerScenarioPourMoteur("s1", "site-B")).rejects.toThrow(
      "Scenario introuvable"
    );
  });

  it("rejette si les ParametresPrevision sont absents (etat incoherent)", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );
    seedFullScenario("site-A", 1);
    stores.parametresPrevision.length = 0;

    await expect(chargerScenarioPourMoteur("s1", "site-A")).rejects.toThrow(
      /ParametresPrevision/
    );
  });
});

describe("chargerScenarioPourMoteur — conversion Decimal Prisma -> Decimal moteur", () => {
  it("convertit chaque champ Decimal via .toString() (jamais un number bytes-lossy)", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );
    seedFullScenario("site-A", 1);
    stores.parametresPrevision[0].prixVenteKgFCFA = "1500.123456789012345";

    const result = await chargerScenarioPourMoteur("s1", "site-A");

    // Decimal moteur : la valeur doit rester exacte (pas de number intermediaire)
    expect(result.parametres.prixVenteKgFCFA.toString()).toBe("1500.123456789012345");
    expect(result.paliersRemise[0].seuilTonnes.toString()).toBe("10");
    expect(result.aliments[0].articles[0].poidsSacKg.toString()).toBe("25");
    expect(result.vaguesPrevues[0].alimentsParMois[0].quantiteKgCalculee.toString()).toBe("125");
    expect(result.postes[0].chargesMensuelles[0].montantFCFA.toString()).toBe("50000");
  });

  it("expose vagueReelleId=null quand aucune Vague reelle n'est liee, et l'id sinon", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );
    seedFullScenario("site-A", 1);

    const sansVague = await chargerScenarioPourMoteur("s1", "site-A");
    expect(sansVague.vaguesPrevues[0].vagueReelleId).toBeNull();

    stores.vague.push({ id: "vague-reelle-1", vaguePrevueId: "v0", siteId: "site-A" });
    const avecVague = await chargerScenarioPourMoteur("s1", "site-A");
    expect(avecVague.vaguesPrevues[0].vagueReelleId).toBe("vague-reelle-1");
  });
});

describe("chargerScenarioPourMoteur — absence de N+1 (nombre de requetes constant)", () => {
  it("le nombre de requetes ne croit PAS avec le nombre de VaguePrevue", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );

    seedFullScenario("site-A", 2);
    queryCount = 0;
    await chargerScenarioPourMoteur("s1", "site-A");
    const countAvec2Vagues = queryCount;

    Object.assign(stores, createEmptyStores());
    seedFullScenario("site-A", 20);
    queryCount = 0;
    await chargerScenarioPourMoteur("s1", "site-A");
    const countAvec20Vagues = queryCount;

    expect(countAvec20Vagues).toBe(countAvec2Vagues);
    // Documente la valeur constante observee (7 requetes : scenario+parametres,
    // paliers, aliments, vaguesPrevues, postes, journal, apports).
    expect(countAvec2Vagues).toBe(7);
  });
});
