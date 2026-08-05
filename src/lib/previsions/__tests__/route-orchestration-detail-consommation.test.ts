/**
 * Tests d'INTEGRATION synthetiques (@tester, verification adverse post-
 * implementation story PR2sex.2) de l'accumulateur `detailParVagueSacs` de
 * `calculerProjectionScenario` (route-orchestration.ts), PAS de la fonction
 * pure `calculerDetailConsommationMensuelle` (deja couverte isolement par
 * `aliments.test.ts`).
 *
 * RAISON D'ETRE — piege identifie par la pre-analyse §2 (docs/analysis/
 * pre-analysis-story-PR2sex.2.md) : la fonction pure recoit une somme DEJA
 * effectuee par l'appelant (`sommeSacsEffectifsCycle`). Le test synthetique
 * de `aliments.test.ts` ("PROTECTION sum-then-round") protege donc
 * uniquement la fonction pure — PAS l'accumulateur de
 * `route-orchestration.ts` (`sacsEffectifsCycleParAlimentMoisPosition`), qui
 * est le seul endroit ou une regression silencieuse pourrait reintroduire un
 * arrondi PAR VAGUE avant d'accumuler (`Σ ROUND()` au lieu de `ROUND(Σ)`)
 * sans qu'AUCUN test actuel ne le voie :
 *   - le jeu d'or (les deux fixtures de recette) ne peut structurellement
 *     pas exercer ce chemin (19 vagues, 19 `moisEmpoissonnement` distincts,
 *     jamais deux vagues stockees le meme mois calendaire) ;
 *   - le test synthetique de la fonction pure ne passe jamais par
 *     `route-orchestration.ts`.
 * Ce fichier construit directement un `ScenarioPourCalcul` synthetique avec
 * DEUX `VaguePrevue` stockees le MEME mois calendaire, choisies pour faire
 * diverger numeriquement `ROUND(Σ)` de `Σ ROUND()` (memes valeurs que le
 * test synthetique de la fonction pure : 3+3 sacs, pourcentage 16,66 %),
 * puis appelle `calculerProjectionScenario` (l'orchestration reelle, pas une
 * reimplementation) pour verifier que le resultat final est bien 1 (sum-
 * then-round), jamais 0 (round-then-sum) — sans DB, `calculerProjectionScenario`
 * est une fonction pure prenant un `ScenarioPourCalcul` deja charge en
 * memoire, donc entierement testable ici (aucune ecriture SQL).
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { calculerProjectionScenario } from "../route-orchestration";
import { StatutScenarioPrevision, StatutVaguePrevue, TailleGranule } from "@/types";
import type { ScenarioPourCalcul, VaguePrevuePourCalcul, AlimentPrevisionPourCalcul } from "@/lib/queries/previsions-scenario-loader";

/**
 * Un calibre unique (G1), sacsParTonneStandard=1, avec une seule repartition
 * a `moisCycle` (le reste absent -> 0%, comportement deja etabli). Choisi
 * pour que `sacsCalculesCycle = ceil(tonnageCibleTonnes * 1)` soit EXACTEMENT
 * 3 pour une vague dont `effectifAlevinsPrevu = 3` et `poidsObjectifG =
 * 1_000_000` (1 tonne/poisson — irrealiste biologiquement, mais ce test
 * n'exerce QUE l'arithmetique de l'accumulateur, jamais une contrainte
 * biologique) : tonnageCibleKg = 3 * 1_000_000 / 1000 = 3000 kg = 3 tonnes,
 * sacsCalculesCycle = ceil(3 * 1) = 3 sacs, exactement.
 */
function buildAlimentUnique(repartitionsParMoisCycle: Array<{ moisCycle: number; pourcentage: number }>): AlimentPrevisionPourCalcul {
  return {
    id: "aliment-g1",
    tailleGranule: TailleGranule.G1,
    sacsParTonneStandard: new Decimal(1),
    ordre: 0,
    repartitions: repartitionsParMoisCycle.map((r) => ({
      moisCycle: r.moisCycle,
      pourcentage: new Decimal(r.pourcentage),
    })),
    articles: [
      {
        id: "aliment-g1-article-unique",
        produitId: null,
        libelle: "G1",
        poidsSacKg: new Decimal(25),
        prixSacFCFA: new Decimal(15000),
        sacsParTonneUnitaire: new Decimal(1000).dividedBy(25),
        partApprovisionnementPct: new Decimal(100),
        ordre: 0,
      },
    ],
  };
}

function buildVague(
  code: string,
  dateStockagePrevue: Date,
  dureeCycleMoisFigee: number,
  effectifAlevinsPrevu = 3
): VaguePrevuePourCalcul {
  return {
    id: code,
    code,
    dateStockagePrevue,
    effectifAlevinsPrevu,
    poidsMoyenInitialG: new Decimal(1),
    dureeCycleMoisFigee,
    statut: StatutVaguePrevue.EN_COURS,
    vaguePrevueParentId: null,
    vagueReelleId: null,
    // Non pertinent pour ce fichier (accumulateur detailParVagueSacs, pas
    // alevins) — false = valeur par defaut du schema (ADR-053 §14.3).
    alevinsAchetes: false,
    alimentsParMois: [],
  };
}

function buildScenarioMinimal(
  aliments: AlimentPrevisionPourCalcul[],
  vaguesPrevues: VaguePrevuePourCalcul[],
  dureeCycleMois = 3
): ScenarioPourCalcul {
  return {
    id: "scenario-synthetique-detail-consommation",
    code: "SCN-SYNTH",
    nom: "Scenario synthetique — verification accumulateur detailParVagueSacs",
    dureeCycleMois,
    dateDebutPlan: new Date(2026, 0, 1),
    statut: StatutScenarioPrevision.ACTIF,
    parametres: {
      effectifAlevinsParVague: 0,
      margeSecuriteAlevinsPct: new Decimal(0),
      tauxEpargnePct: new Decimal(0),
      poidsMoyenInitialG: new Decimal(1),
      poidsObjectifG: new Decimal(1_000_000),
      prixAlevinUnitaireFCFA: new Decimal(0),
      prixVenteKgFCFA: new Decimal(0),
      nombreBacsSimultanesCible: 1,
      frequenceStockageMois: new Decimal(1),
      transportAliments: { capacite: new Decimal(60), coutUnitaireFCFA: new Decimal(15000) },
      transportPoissons: { capacite: new Decimal(1500), coutUnitaireFCFA: new Decimal(25000) },
      transportAlevins: { capacite: new Decimal(20000), coutUnitaireFCFA: new Decimal(30000) },
      tresorerieInitialeFCFA: new Decimal(0),
    },
    // Aucun palier : ce fichier n'asserte QUE des nombres de sacs CONSOMMES
    // (`detailParVagueSacs`, un ROUND d'entiers), jamais un montant — la
    // remise n'entre dans aucune des grandeurs mesurees ici. Ce n'est donc
    // pas une neutralisation de la regle testee (le contournement proscrit
    // par ADR-053 §13.4), mais l'absence d'un parametre hors sujet ; la
    // remise est exercee pour de vrai par la recette d'orchestration
    // (`__tests__/recette/route-orchestration.recette.test.ts`).
    paliersRemise: [],
    aliments,
    vaguesPrevues,
    postes: [],
    journal: [],
    apports: [],
  };
}

describe("calculerProjectionScenario — accumulateur detailParVagueSacs, story PR2sex.2 (@tester, verification adverse)", () => {
  it("DEUX vagues stockees le MEME mois calendaire : ROUND(Σ) = 1, jamais Σ ROUND() = 0 (memes valeurs que le test synthetique de la fonction pure)", () => {
    // Deux vagues, chacune produisant sacsEffectifsCycle = 3 (voir JSDoc
    // buildAlimentUnique), stockees le MEME mois calendaire (janvier 2026),
    // repartition 16,66% au 1er mois de cycle :
    //   ROUND(Σ)   = ROUND((3+3) x 16.66 / 100) = ROUND(0.9996) = 1
    //   Σ ROUND()  = ROUND(3 x 16.66/100) + ROUND(3 x 16.66/100) = 0 + 0 = 0
    const aliment = buildAlimentUnique([{ moisCycle: 1, pourcentage: 16.66 }]);
    const moisStockage = new Date(2026, 0, 1); // meme mois pour les deux vagues
    const vagueA = buildVague("V-A", moisStockage, 3);
    const vagueB = buildVague("V-B", moisStockage, 3);
    const scenario = buildScenarioMinimal([aliment], [vagueA, vagueB]);

    const resultat = calculerProjectionScenario(scenario);

    const moisJanvier = resultat.mois[0];
    expect(moisJanvier.detailParVagueSacs[1]?.[TailleGranule.G1]).toBe(1);
    // Preuve que le test discrimine reellement (sinon il ne prouverait rien,
    // meme piege methodologique qu'ERR-148/ERR-155) : le candidat REJETE
    // (round par vague puis somme) aurait produit 0, une valeur DIFFERENTE.
    expect(moisJanvier.detailParVagueSacs[1]?.[TailleGranule.G1]).not.toBe(0);
  });

  it("TROIS vagues stockees le MEME mois calendaire (au-dela du cas a deux termes) : la somme des trois sacsEffectifsCycle est bien accumulee avant le round", () => {
    // 3 vagues a 3 sacs chacune = 9 avant round. 9 x 16.66% = 1.4994 -> ROUND = 1.
    // Round par vague : ROUND(0.4998) x 3 = 0 x 3 = 0. Toujours divergent.
    const aliment = buildAlimentUnique([{ moisCycle: 1, pourcentage: 16.66 }]);
    const moisStockage = new Date(2026, 2, 1);
    const vagues = [
      buildVague("V-A", moisStockage, 3),
      buildVague("V-B", moisStockage, 3),
      buildVague("V-C", moisStockage, 3),
    ];
    const scenario = buildScenarioMinimal([aliment], vagues);

    const resultat = calculerProjectionScenario(scenario);
    const moisIndex = resultat.mois.findIndex((m) => m.detailParVagueSacs[1]?.[TailleGranule.G1] !== undefined);
    expect(moisIndex).toBeGreaterThanOrEqual(0);
    expect(resultat.mois[moisIndex].detailParVagueSacs[1]?.[TailleGranule.G1]).toBe(1);
  });

  it("Deux vagues stockees a des mois DIFFERENTS ne coincident jamais (regression du cas nominal, deja couvert par la recette) : chaque mois ne voit qu'UNE vague", () => {
    const aliment = buildAlimentUnique([{ moisCycle: 1, pourcentage: 16.66 }]);
    const vagueA = buildVague("V-A", new Date(2026, 0, 1), 3);
    const vagueB = buildVague("V-B", new Date(2026, 1, 1), 3);
    const scenario = buildScenarioMinimal([aliment], [vagueA, vagueB]);

    const resultat = calculerProjectionScenario(scenario);
    // Chaque mois isole : ROUND(3 x 16.66/100) = ROUND(0.4998) = 0, jamais 1
    // (contrairement au cas coincident ci-dessus).
    expect(resultat.mois[0].detailParVagueSacs[1]?.[TailleGranule.G1] ?? 0).toBe(0);
    expect(resultat.mois[1].detailParVagueSacs[1]?.[TailleGranule.G1] ?? 0).toBe(0);
  });

  it("dureeCycleMoisFigee = 4 (au-dela de 3) : les 4 positions de cycle sont produites, aucun `3` en dur ne tronque la boucle", () => {
    const aliment = buildAlimentUnique([
      { moisCycle: 1, pourcentage: 25 },
      { moisCycle: 2, pourcentage: 25 },
      { moisCycle: 3, pourcentage: 25 },
      { moisCycle: 4, pourcentage: 25 },
    ]);
    const vague = buildVague("V-4-mois", new Date(2026, 0, 1), 4);
    const scenario = buildScenarioMinimal([aliment], [vague], 4);

    const resultat = calculerProjectionScenario(scenario);

    // sacsEffectifsCycle = 3 (voir JSDoc), 25% -> ROUND(0.75) = 1 a chaque
    // position 1..4 : verifie qu'AUCUNE position au-dela de 3 n'est
    // silencieusement absente (ce qui trahirait un `k <= 3` fige en dur).
    for (const positionCycle of [1, 2, 3, 4]) {
      const moisAbsolu = positionCycle - 1; // vague stockee au mois 0
      expect(resultat.mois[moisAbsolu].detailParVagueSacs[positionCycle]?.[TailleGranule.G1]).toBe(1);
    }
    // Aucune position 5 n'existe (la vague n'a que 4 mois de cycle) :
    expect(resultat.mois[4]?.detailParVagueSacs[5]).toBeUndefined();
  });

  it("dureeCycleMoisFigee = 1 (cycle degenere, en dessous de 3) : une seule position de cycle produite, sans erreur", () => {
    const aliment = buildAlimentUnique([{ moisCycle: 1, pourcentage: 100 }]);
    const vague = buildVague("V-1-mois", new Date(2026, 0, 1), 1);
    const scenario = buildScenarioMinimal([aliment], [vague], 1);

    const resultat = calculerProjectionScenario(scenario);

    // sacsEffectifsCycle = 3, 100% -> ROUND(3) = 3, a la position 1 uniquement.
    expect(resultat.mois[0].detailParVagueSacs[1]?.[TailleGranule.G1]).toBe(3);
    // Aucune position 2 ou 3 ne doit exister pour cette vague a cycle d'1 mois.
    expect(resultat.mois[0].detailParVagueSacs[2]).toBeUndefined();
    expect(resultat.mois[0].detailParVagueSacs[3]).toBeUndefined();
  });
});
