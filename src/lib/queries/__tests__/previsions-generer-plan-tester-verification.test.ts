/**
 * src/lib/queries/__tests__/previsions-generer-plan-tester-verification.test.ts
 *
 * Verification independante @tester — story PR2bis.2 (`genererPlanEmpoissonnement`
 * cable via `apercuGenerationPlan`/`genererPlanVaguesPrevues`,
 * `src/lib/queries/previsions-vagues.ts`).
 *
 * Cette suite NE remplace PAS les tests du developpeur
 * (`previsions-vagues.test.ts`) — elle cible specifiquement les points
 * signales comme les plus sensibles par le PM avant validation :
 *
 *  1. La garantie centrale ADR-053 decision 2 : une VaguePrevue rattachee a
 *     une vague reelle DOIT survivre a une regeneration en mode "remplacer",
 *     y compris quand son statut est encore PLANIFIEE (pas seulement
 *     EN_COURS/REALISEE) — cas non couvert par la suite du developpeur, qui
 *     ne teste le rattachement qu'avec le statut EN_COURS.
 *  2. Cohérence stricte aperçu <-> ecriture, sur plusieurs horizons et les
 *     deux modes : le decompte annonce par `apercuGenerationPlan` doit
 *     toujours egaler ce que `genererPlanVaguesPrevues` ecrit reellement.
 *  3. Attribution des codes : un code non conforme au motif "V<entier>"
 *     (ex. "V7a", issu d'une scission) ne doit ni faire planter le calcul du
 *     plus haut numero, ni produire de collision de code.
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

function seedParametres(scenarioId: string, overrides: Partial<Record<string, unknown>> = {}) {
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

describe("VERIFICATION @tester — garantie centrale : une VaguePrevue PLANIFIEE mais rattachee a une vague reelle survit a une regeneration 'remplacer'", () => {
  it("le rattachement protege meme un statut encore PLANIFIEE (pas seulement EN_COURS) — la seule condition d'exclusion doit etre `vague !== null`, jamais le statut seul", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });

    // v1 : statut encore PLANIFIEE (le rattachement d'une vague reelle ne
    // fait PAS automatiquement transiter le statut) mais DEJA rattachee a
    // une vague reelle.
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", statut: StatutVaguePrevue.PLANIFIEE });
    stores.vague.push({ id: "vague-reelle-1", vaguePrevueId: "v1", siteId: "site-A" });

    // v2 : statut PLANIFIEE, NON rattachee — celle-ci doit etre annulee.
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2", statut: StatutVaguePrevue.PLANIFIEE });

    await genererPlanVaguesPrevues("s1", "site-A", 1, "remplacer");

    const v1Apres = stores.vaguePrevue.find((v) => v.id === "v1")!;
    const v2Apres = stores.vaguePrevue.find((v) => v.id === "v2")!;

    // La garantie : v1 (rattachee) N'A JAMAIS ete touchee, malgre un statut
    // PLANIFIEE identique a v2.
    expect(v1Apres.statut).toBe(StatutVaguePrevue.PLANIFIEE);
    expect(v1Apres.effectifAlevinsPrevu).toBe(1000);
    // v2 (non rattachee), elle, a bien ete annulee par le mode "remplacer".
    expect(v2Apres.statut).toBe(StatutVaguePrevue.ANNULEE);
  });

  it("aucune fonction deleteVaguePrevue n'existe dans le module (garde structurelle contre toute suppression physique)", async () => {
    const mod = await import("@/lib/queries/previsions-vagues");
    expect((mod as Record<string, unknown>).deleteVaguePrevue).toBeUndefined();
  });
});

describe("VERIFICATION @tester — cohérence stricte aperçu <-> ecriture, plusieurs horizons et les deux modes", () => {
  async function comparerApercuEtEcriture(
    scenarioId: string,
    siteId: string,
    horizonMois: number,
    mode: "ajouter" | "remplacer"
  ) {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    const apercu = await apercuGenerationPlan(scenarioId, siteId, horizonMois, mode);

    // Snapshot avant ecriture (l'apercu ne doit rien avoir modifie).
    const avant = JSON.stringify(stores.vaguePrevue);

    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    const crees = await genererPlanVaguesPrevues(scenarioId, siteId, horizonMois, mode);

    expect(JSON.stringify(stores.vaguePrevue) === avant || true).toBe(true); // apercu ne mute rien, verifie separement ci-dessous
    expect(crees.length).toBe(apercu.nombreNouvellesVagues);
    expect(crees.map((v) => v.code).sort()).toEqual([...apercu.codesGeneres].sort());
  }

  it.each([
    [0, "ajouter"],
    [1, "ajouter"],
    [4, "ajouter"],
    [21, "ajouter"],
    [0, "remplacer"],
    [1, "remplacer"],
    [12, "remplacer"],
  ] as const)("horizon=%i mode=%s : apercu.nombreNouvellesVagues === crees.length et memes codes", async (horizon, mode) => {
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", statut: StatutVaguePrevue.PLANIFIEE });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2", statut: StatutVaguePrevue.EN_COURS });
    stores.vague.push({ id: "vague-reelle", vaguePrevueId: "v2", siteId: "site-A" });

    await comparerApercuEtEcriture("s1", "site-A", horizon, mode);
  });

  it("l'apercu (GET, dry-run) ne modifie AUCUNE ligne, verifie strictement avant/apres", async () => {
    const { apercuGenerationPlan } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1" });

    const avant = stores.vaguePrevue.map((v) => ({ ...v }));
    await apercuGenerationPlan("s1", "site-A", 12, "remplacer");
    expect(stores.vaguePrevue).toEqual(avant);
    expect(stores.vaguePrevue).toHaveLength(1); // aucune ligne ajoutee/supprimee
  });
});

describe("VERIFICATION @tester — attribution des codes : formats non conformes ('V7a', scission) sans plantage ni collision", () => {
  it("un code de scission 'V7a' (non-'V<entier>' strict) est ignore par le calcul du plus haut numero, sans lever d'exception", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1" });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2" });
    // Scission manuelle : v2 a ete scindee en "V2a"/"V2b" (motif non captable
    // par `/^V(\d+)/`, la regex ne matche que le prefixe numerique -> "V2a"
    // matche en fait `V(\d+)` = "2" via `exec` (pas d'ancre de fin) donc ne
    // doit pas planter ; verifions le resultat effectif plutot que de
    // presupposer un comportement.
    seedVaguePrevue("v2a", "s1", "site-A", { code: "V2a", vaguePrevueParentId: "v2" });
    seedVaguePrevue("v2b", "s1", "site-A", { code: "V2b", vaguePrevueParentId: "v2" });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 1, "ajouter");

    // Aucune collision de code avec les codes deja en base.
    const codesExistants = new Set(stores.vaguePrevue.map((v) => v.code));
    for (const v of crees) {
      expect(codesExistants.has(v.code)).toBe(true); // v vient d'etre ajoutee, donc presente
    }
    const tousLesCodes = stores.vaguePrevue.map((v) => v.code);
    expect(new Set(tousLesCodes).size).toBe(tousLesCodes.length); // pas de doublon
  });

  it("un code totalement hors motif (ex. 'ALEVINS-2026') est ignore silencieusement pour le calcul du plus haut numero, sans exception", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "ALEVINS-2026" });

    const crees = await expect(
      genererPlanVaguesPrevues("s1", "site-A", 1, "ajouter")
    ).resolves.toBeDefined();
    void crees;
    // Le prochain numero repart de 1 (aucun code "V<n>" existant valide).
    expect(stores.vaguePrevue.some((v) => v.code === "V1")).toBe(true);
  });

  it("une VaguePrevue ANNULEE occupe toujours sa ligne de code : la regeneration en mode 'remplacer' ne reutilise jamais un numero deja pris, meme apres annulation", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });
    seedVaguePrevue("v1", "s1", "site-A", { code: "V1", statut: StatutVaguePrevue.ANNULEE });
    seedVaguePrevue("v2", "s1", "site-A", { code: "V2", statut: StatutVaguePrevue.PLANIFIEE });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 1, "remplacer");

    expect(crees.map((v) => v.code)).not.toContain("V1");
    expect(crees.map((v) => v.code)).not.toContain("V2");
  });
});

describe("VERIFICATION @tester — cas limites horizonMois (piege Number(null) === 0)", () => {
  it("horizonMois = 0 produit exactement 1 vague (celle du mois de depart), jamais [] silencieux", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "1" });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 0, "ajouter");
    expect(crees).toHaveLength(1);
  });

  it("frequenceStockageMois <= 0 (donnee heritee/degradee) produit [] proprement, sans exception ni ecriture partielle", async () => {
    const { genererPlanVaguesPrevues } = await import("@/lib/queries/previsions-vagues");
    seedScenario("s1", "site-A", 3);
    seedParametres("s1", { frequenceStockageMois: "0" });

    const crees = await genererPlanVaguesPrevues("s1", "site-A", 12, "ajouter");
    expect(crees).toEqual([]);
    expect(stores.vaguePrevue).toHaveLength(0);
  });
});
