/**
 * Test dedie — story PR2q.2, verification independante (@tester).
 *
 * Objectif : prouver que `tauxEpargnePct` n'est pas un paramètre "saisi,
 * validé et affiché, mais jamais consommé" (famille de bug ERR-141,
 * `margeSecuriteAlevinsPct`, corrigee en PR2bis.3). Aucun test existant
 * avant celui-ci ne fait transiter DEUX valeurs DIFFERENTES de
 * `tauxEpargnePct` par le chemin complet :
 *
 *   ligne DB (mockee via previsions-fake-db) -> chargerScenarioPourMoteur
 *   -> calculerProjectionScenario -> mois[].epargneFCFA
 *
 * - `src/lib/queries/__tests__/previsions-scenario-loader.test.ts` ne seede
 *   jamais `tauxEpargnePct` dans `seedFullScenario` (le champ est absent de
 *   l'objet stores.parametresPrevision.push({...}), donc `undefined` au
 *   runtime) et n'assert jamais sur `result.parametres.tauxEpargnePct`.
 * - Les recettes `__tests__/recette/*.recette.test.ts` bypassent
 *   entierement `chargerScenarioPourMoteur` : `route-orchestration-builder.ts`
 *   construit le `ScenarioPourCalcul` a la main depuis le JSON du jeu d'or,
 *   jamais via le loader Prisma reel.
 *
 * Ce test comble ce trou : deux valeurs de `tauxEpargnePct` (10 et 50),
 * chargees via le VRAI `chargerScenarioPourMoteur` (mock Prisma), doivent
 * produire des `epargneFCFA` differentes ET dans le bon rapport
 * (epargne(50)/epargne(10) == 5, sur tout mois a resultat strictement
 * positif) en sortie de la fonction d'entree publique
 * `calculerProjectionScenario`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StatutScenarioPrevision,
  StatutVaguePrevue,
  TailleGranule,
} from "@/types";
import { createEmptyStores, buildFakePrisma, type Stores } from "./previsions-fake-db";

const stores: Stores = createEmptyStores();

vi.mock("@/lib/db", () => ({
  prisma: buildFakePrisma(stores),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
});

/** Scenario minimal complet, avec `tauxEpargnePct` explicitement seede (contrairement au fixture de previsions-scenario-loader.test.ts). */
function seedScenario(siteId: string, tauxEpargnePct: string) {
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
    margeSecuriteAlevinsPct: "0",
    tauxEpargnePct,
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
  });
  stores.alimentPrevision.push({
    id: "a1",
    scenarioId: "s1",
    tailleGranule: TailleGranule.G1,
    sacsParTonneStandard: "40",
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
  stores.vaguePrevue.push({
    id: "v0",
    scenarioId: "s1",
    code: "V0",
    dateStockagePrevue: new Date("2026-08-01"),
    effectifAlevinsPrevu: 1000,
    poidsMoyenInitialG: "5",
    dureeCycleMoisFigee: 3,
    statut: StatutVaguePrevue.PLANIFIEE,
    vaguePrevueParentId: null,
    siteId,
  });
  stores.alimentParVaguePrevue.push({
    id: "apv0",
    vaguePrevueId: "v0",
    alimentPrevisionId: "a1",
    moisCycle: 1,
    sacsCalcules: 5,
    sacsSaisis: null,
    quantiteKgCalculee: "125",
    coutCalculeFCFA: "187500",
    siteId,
  });
  // Aucun poste de charge : depensesFCFA du mois de recolte = seulement
  // le cout aliments/alevins, garantit un resultat positif ce mois-la
  // (le prix de vente domine largement, cf. previsions-scenario-loader.test.ts).
}

describe("tauxEpargnePct — consommation de bout en bout (chargement -> calculerProjectionScenario), story PR2q.2", () => {
  it("deux valeurs de tauxEpargnePct differentes produisent des epargneFCFA differentes en sortie de calculerProjectionScenario", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );
    const { calculerProjectionScenario } = await import(
      "@/lib/previsions/route-orchestration"
    );

    seedScenario("site-A", "10");
    const scenarioTaux10 = await chargerScenarioPourMoteur("s1", "site-A");
    expect(scenarioTaux10.parametres.tauxEpargnePct.toString()).toBe("10");
    const resultatTaux10 = calculerProjectionScenario(scenarioTaux10);

    Object.assign(stores, createEmptyStores());
    seedScenario("site-A", "50");
    const scenarioTaux50 = await chargerScenarioPourMoteur("s1", "site-A");
    expect(scenarioTaux50.parametres.tauxEpargnePct.toString()).toBe("50");
    const resultatTaux50 = calculerProjectionScenario(scenarioTaux50);

    expect(resultatTaux10.mois.length).toBe(resultatTaux50.mois.length);
    expect(resultatTaux10.mois.length).toBeGreaterThan(0);

    let auMoinsUnMoisPositifCompare = false;
    for (let m = 0; m < resultatTaux10.mois.length; m++) {
      const mois10 = resultatTaux10.mois[m];
      const mois50 = resultatTaux50.mois[m];

      // resultatFCFA ne doit PAS dependre de tauxEpargnePct (l'epargne est
      // une consommation du resultat, jamais une entree qui le modifie).
      expect(mois10.resultatFCFA.toString()).toBe(mois50.resultatFCFA.toString());

      if (mois10.resultatFCFA.gt(0)) {
        auMoinsUnMoisPositifCompare = true;
        // epargne(50%) doit valoir exactement 5x epargne(10%) sur un mois
        // a resultat positif (max(0, r) x taux / 100, r identique des deux cotes).
        const ratio = mois50.epargneFCFA.dividedBy(mois10.epargneFCFA);
        expect(ratio.toString()).toBe("5");
        expect(mois10.epargneFCFA.gt(0)).toBe(true);
        expect(mois50.epargneFCFA.gt(mois10.epargneFCFA)).toBe(true);
      } else {
        // resultat <= 0 : epargne nulle des DEUX cotes, quel que soit le taux
        // (branche max(0, ...) — le taux ne peut pas la faire echapper a 0).
        expect(mois10.epargneFCFA.toString()).toBe("0");
        expect(mois50.epargneFCFA.toString()).toBe("0");
      }
    }

    expect(auMoinsUnMoisPositifCompare).toBe(true);
  });

  it("tauxEpargnePct = 0 produit une epargneFCFA nulle sur TOUS les mois, meme a resultat positif", async () => {
    const { chargerScenarioPourMoteur } = await import(
      "@/lib/queries/previsions-scenario-loader"
    );
    const { calculerProjectionScenario } = await import(
      "@/lib/previsions/route-orchestration"
    );

    seedScenario("site-A", "0");
    const scenario = await chargerScenarioPourMoteur("s1", "site-A");
    const resultat = calculerProjectionScenario(scenario);

    const auMoinsUnMoisPositif = resultat.mois.some((m) => m.resultatFCFA.gt(0));
    expect(auMoinsUnMoisPositif).toBe(true);

    for (const mois of resultat.mois) {
      expect(mois.epargneFCFA.toString()).toBe("0");
    }
  });
});
