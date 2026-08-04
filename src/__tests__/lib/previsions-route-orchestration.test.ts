/**
 * Tests unitaires — `src/lib/previsions/route-orchestration.ts` (Sprint PR2,
 * story PR2.2 ; restructure calibre/article par l'amendement ADR-053 §12,
 * Sprint PR2-quater). CE N'EST PAS le moteur teste par la recette
 * (1270/1270) : ce fichier orchestre le moteur pur pour la route de calcul
 * `GET /api/previsions/scenarios/[id]/calculer`. Aucune fonction du moteur
 * n'est appelee via un mock ici — ce sont les VRAIES fonctions du moteur,
 * seule l'orchestration (ce fichier) est sous test.
 *
 * GAP 1 — CORRIGE (ADR-053, amendement Sprint PR2 §11 ; bug de severite Haute
 * signale par le rapport de tests PR2.2 section 4.1). Les tests ci-dessous
 * attestent desormais le comportement CORRIGE : `sacsParTonneStandard`
 * (jamais `sacsParTonneUnitaire`) utilise pour le calcul de besoin, biomasse
 * convertie en TONNES avant la formule, et rejet explicite (422) quand
 * `sacsParTonneStandard` est `null`.
 *
 * ADR-053 §12 (amendement Sprint PR2-quater) : `AlimentPrevision` est
 * desormais le CALIBRE (porte `tailleGranule`/`sacsParTonneStandard`), et
 * `poidsSacKg`/`prixSacFCFA` sont descendus au niveau ARTICLE
 * (`aliment.articles[]`). Tous les scenarios construits ici portent UN SEUL
 * article a 100% par calibre (cas nominal, §12.6) — la non-regression
 * byte-pour-byte de ces tests face au comportement d'avant l'amendement est
 * garantie par la preuve chiffree de l'ADR (§12.2 arbitrage 1).
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/previsions/decimal-config";
import { calculerProjectionScenario, moisAbsoluDepuis } from "@/lib/previsions/route-orchestration";
import type { ScenarioPourCalcul, AlimentPrevisionPourCalcul } from "@/lib/queries/previsions-scenario-loader";
import { StatutScenarioPrevision, StatutVaguePrevue, TypePostePrevision, TailleGranule } from "@/types";

function transportNul() {
  return { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) };
}

/**
 * Construit un calibre avec son unique article a 100% (cas nominal, ADR-053
 * §12.6) — remplace la construction a plat d'avant l'amendement §12.
 */
function buildAlimentUnArticle(overrides: {
  id: string;
  tailleGranule: TailleGranule;
  poidsSacKg: number;
  prixSacFCFA: number;
  sacsParTonneStandard: number | null;
  ordre?: number;
  repartitions?: AlimentPrevisionPourCalcul["repartitions"];
}): AlimentPrevisionPourCalcul {
  return {
    id: overrides.id,
    tailleGranule: overrides.tailleGranule,
    sacsParTonneStandard:
      overrides.sacsParTonneStandard === null ? null : new Decimal(overrides.sacsParTonneStandard),
    ordre: overrides.ordre ?? 1,
    repartitions: overrides.repartitions ?? [{ moisCycle: 1, pourcentage: new Decimal(100) }],
    articles: [
      {
        id: `${overrides.id}-article-unique`,
        produitId: null,
        libelle: overrides.id,
        poidsSacKg: new Decimal(overrides.poidsSacKg),
        prixSacFCFA: new Decimal(overrides.prixSacFCFA),
        // Formule production reelle (previsions-scenarios.ts) : 1000 / poidsSacKg. Ne DOIT
        // JAMAIS entrer dans le calcul de besoin (GAP 1, corrige).
        sacsParTonneUnitaire: new Decimal(1000).dividedBy(overrides.poidsSacKg),
        partApprovisionnementPct: new Decimal(100),
        ordre: 0,
      },
    ],
  };
}

/** Construit un scenario minimal valide pour l'orchestration, une seule vague, un seul aliment. */
function buildScenario(overrides: Partial<ScenarioPourCalcul> = {}): ScenarioPourCalcul {
  return {
    id: "scenario-1",
    code: "PLAN-TEST",
    nom: "Plan test",
    dureeCycleMois: 3,
    dateDebutPlan: new Date("2026-08-01"),
    statut: StatutScenarioPrevision.ACTIF,
    parametres: {
      effectifAlevinsParVague: 5000,
      margeSecuriteAlevinsPct: new Decimal(10),
      tauxEpargnePct: new Decimal(30),
      poidsMoyenInitialG: new Decimal(5),
      poidsObjectifG: new Decimal(800),
      prixAlevinUnitaireFCFA: new Decimal(50),
      prixVenteKgFCFA: new Decimal(1500),
      nombreBacsSimultanesCible: 4,
      frequenceStockageMois: new Decimal(1),
      transportAliments: transportNul(),
      transportPoissons: transportNul(),
      transportAlevins: transportNul(),
    },
    paliersRemise: [],
    aliments: [
      buildAlimentUnArticle({
        id: "aliment-2mm",
        tailleGranule: TailleGranule.G1,
        poidsSacKg: 15,
        prixSacFCFA: 18000,
        // Coefficient de besoin (jeu d'or, 2mm) : 8 sacs / tonne de POISSON produit.
        sacsParTonneStandard: 8,
      }),
    ],
    vaguesPrevues: [
      {
        id: "vp-1",
        code: "V1",
        dateStockagePrevue: new Date("2026-08-01"),
        effectifAlevinsPrevu: 5000,
        poidsMoyenInitialG: new Decimal(5),
        dureeCycleMoisFigee: 3,
        statut: StatutVaguePrevue.PLANIFIEE,
        vaguePrevueParentId: null,
        vagueReelleId: null,
        alevinsAchetes: false,
        alimentsParMois: [],
      },
    ],
    postes: [],
    journal: [],
    apports: [],
    ...overrides,
  };
}

describe("moisAbsoluDepuis", () => {
  it("calcule l'index 0-based du mois calendaire par rapport a dateDebutPlan", () => {
    const debut = new Date("2026-08-01");
    expect(moisAbsoluDepuis(debut, new Date("2026-08-15"))).toBe(0);
    expect(moisAbsoluDepuis(debut, new Date("2026-09-01"))).toBe(1);
    expect(moisAbsoluDepuis(debut, new Date("2026-11-01"))).toBe(3);
  });
});

describe("calculerProjectionScenario — GAP 1 CORRIGE : sacsParTonneStandard + conversion kg->tonnes", () => {
  it(
    "REGRESSION (test chiffre qui aurait echoue avec l'ancienne formule) : le besoin en aliment " +
      "utilise sacsParTonneStandard (jamais sacsParTonneUnitaire) et convertit la biomasse cible " +
      "en TONNES avant la formule — plus de facteur ~8300x",
    () => {
      // tonnageCibleKg = effectifAlevinsPrevu * poidsObjectifG / 1000 = 5000 * 800 / 1000 = 4000 kg
      // tonnageCibleTonnes = 4000 / 1000 = 4 tonnes
      // besoinTotalCycleKg (formule corrigee) = 4 * sacsParTonneStandard(8) * poidsSacKg(15) = 480 kg
      const scenario = buildScenario(); // aliment par defaut : sacsParTonneStandard = 8, poidsSacKg = 15

      const projection = calculerProjectionScenario(scenario);
      const vague = projection.vagues[0];
      const besoinTotalKg = vague.alimentsParMois.reduce((sum, a) => sum + a.quantiteKg.toNumber(), 0);

      // Formule correcte, transposee fidelement de la recette (jeu d'or) : 480 kg attendus,
      // PAS 4 000 000 kg (ancienne formule fausse : tonnageCibleKg * sacsParTonneUnitaire * poidsSacKg
      // degenerait en tonnageCibleKg * 1000, insensible a la granulometrie).
      expect(besoinTotalKg).toBe(480);
      expect(besoinTotalKg).not.toBe(4_000_000);
    }
  );

  it("deux granulometries de meme poidsSacKg mais de sacsParTonneStandard different recoivent desormais des besoins differents", () => {
    // Deux granulometries reelles du jeu d'or (poidsSacKg=15 pour les deux,
    // sacsParTonneStandard = 8 pour 2mm et 18 pour 3mm — cf.
    // prisma/fixtures/previsions/plan-v12-corrige.json). Avec la formule corrigee, les deux
    // granulometries recoivent des besoins DISTINCTS, proportionnels a sacsParTonneStandard.
    const scenario = buildScenario({
      aliments: [
        buildAlimentUnArticle({
          id: "aliment-2mm",
          tailleGranule: TailleGranule.G1,
          poidsSacKg: 15,
          prixSacFCFA: 18000,
          sacsParTonneStandard: 8,
          ordre: 1,
        }),
        buildAlimentUnArticle({
          id: "aliment-3mm",
          tailleGranule: TailleGranule.G2,
          poidsSacKg: 15,
          prixSacFCFA: 16500,
          sacsParTonneStandard: 18,
          ordre: 2,
        }),
      ],
    });

    const projection = calculerProjectionScenario(scenario);
    const vague = projection.vagues[0];
    const kg2mm = vague.alimentsParMois.find((a) => a.alimentPrevisionId === "aliment-2mm")!.quantiteKg.toNumber();
    const kg3mm = vague.alimentsParMois.find((a) => a.alimentPrevisionId === "aliment-3mm")!.quantiteKg.toNumber();

    expect(kg2mm).toBe(480); // 4 tonnes * 8 * 15
    expect(kg3mm).toBe(1080); // 4 tonnes * 18 * 15
    expect(kg2mm).not.toBe(kg3mm);
  });

  it("rejet explicite (jamais un defaut silencieux) quand sacsParTonneStandard est null pour une granulometrie utilisee", () => {
    const scenario = buildScenario({
      aliments: [
        buildAlimentUnArticle({
          id: "aliment-2mm",
          tailleGranule: TailleGranule.G1,
          poidsSacKg: 15,
          prixSacFCFA: 18000,
          sacsParTonneStandard: null, // non configure
        }),
      ],
    });

    expect(() => calculerProjectionScenario(scenario)).toThrow(
      /sacsParTonneStandard non configure.*"G1"/
    );
  });
});

describe("calculerProjectionScenario — GAP 2 CORRIGE : sacsSaisis persistes, appliques par la route (COALESCE)", () => {
  it(
    "une surcharge AlimentParVaguePrevue.sacsSaisis deja persistee pour un mois de cycle exact " +
      "PREVAUT sur le besoin brut recalcule par le moteur, conformement a ADR-053 section 3.6 " +
      "(COALESCE(sacsSaisis, sacsCalcules) dans tous les calculs downstream)",
    () => {
      // Le scenario porte une VaguePrevue avec une ligne AlimentParVaguePrevue deja
      // persistee, sacsSaisis = 999 (surcharge terrain tres eloignee du calcul brut).
      const scenario = buildScenario({
        vaguesPrevues: [
          {
            id: "vp-1",
            code: "V1",
            dateStockagePrevue: new Date("2026-08-01"),
            effectifAlevinsPrevu: 5000,
            poidsMoyenInitialG: new Decimal(5),
            dureeCycleMoisFigee: 3,
            statut: StatutVaguePrevue.PLANIFIEE,
            vaguePrevueParentId: null,
            vagueReelleId: null,
            alevinsAchetes: false,
            alimentsParMois: [
              {
                id: "apvp-1",
                alimentPrevisionId: "aliment-2mm",
                moisCycle: 1,
                sacsCalcules: 10,
                sacsSaisis: 999, // surcharge terrain deja enregistree
                quantiteKgCalculee: new Decimal(150),
                coutCalculeFCFA: new Decimal(180000),
              },
            ],
          },
        ],
      });

      const projection = calculerProjectionScenario(scenario);
      const vague = projection.vagues[0];
      const ligneAliment = vague.alimentsParMois.find((a) => a.moisCycle === 1)!;

      // La surcharge deja persistee (999) prevaut desormais sur le besoin brut recalcule
      // par le moteur pour ce mois de cycle exact.
      expect(ligneAliment.sacs).toBe(999);

      // `quantiteKg` (kg physiques projetes) reste le besoin BRUT du moteur, jamais
      // surcharge — l'ADR ne demande la surcharge que pour cout/budget/tresorerie (section
      // 3.6), pas pour la quantite physique en kg.
      expect(ligneAliment.quantiteKg.toNumber()).not.toBe(999);

      // Le cout du mois est recalcule a partir du total de cycle effectif (ici, un seul
      // mois avec repartition 100%, donc le total de cycle = 999 sacs) — jamais a partir
      // du besoin brut ignore de la surcharge. Un seul article a 100% -> cout = 999 * prix.
      expect(ligneAliment.montantFCFA.toNumber()).toBe(999 * 18000);
    }
  );

  it(
    "sans aucune surcharge persistee, le comportement reste inchange : la route retombe " +
      "sur le besoin brut recalcule par le moteur (sacsCalculesCycle)",
    () => {
      const scenario = buildScenario({
        vaguesPrevues: [
          {
            id: "vp-1",
            code: "V1",
            dateStockagePrevue: new Date("2026-08-01"),
            effectifAlevinsPrevu: 5000,
            poidsMoyenInitialG: new Decimal(5),
            dureeCycleMoisFigee: 3,
            statut: StatutVaguePrevue.PLANIFIEE,
            vaguePrevueParentId: null,
            vagueReelleId: null,
            alevinsAchetes: false,
            alimentsParMois: [], // aucune ligne persistee (premier calcul du scenario)
          },
        ],
      });

      const projection = calculerProjectionScenario(scenario);
      const vague = projection.vagues[0];
      const ligneAliment = vague.alimentsParMois.find((a) => a.moisCycle === 1)!;

      // Meme resultat que le comportement d'origine (avant correctif) quand aucune
      // surcharge n'existe : le besoin brut du moteur est utilise tel quel.
      expect(ligneAliment.sacs).not.toBe(999);
      expect(ligneAliment.sacs).toBeGreaterThan(0);
    }
  );

  it(
    "un mois de cycle SANS surcharge, dans une vague ou UN AUTRE mois porte une surcharge, " +
      "n'est pas affecte au niveau du sac affiche (seul le mois qui porte la ligne persistee " +
      "est remplace)",
    () => {
      const scenario = buildScenario({
        aliments: [
          buildAlimentUnArticle({
            id: "aliment-2mm",
            tailleGranule: TailleGranule.G1,
            poidsSacKg: 15,
            prixSacFCFA: 18000,
            sacsParTonneStandard: 8,
            repartitions: [
              { moisCycle: 1, pourcentage: new Decimal(50) },
              { moisCycle: 2, pourcentage: new Decimal(50) },
            ],
          }),
        ],
        vaguesPrevues: [
          {
            id: "vp-1",
            code: "V1",
            dateStockagePrevue: new Date("2026-08-01"),
            effectifAlevinsPrevu: 5000,
            poidsMoyenInitialG: new Decimal(5),
            dureeCycleMoisFigee: 3,
            statut: StatutVaguePrevue.PLANIFIEE,
            vaguePrevueParentId: null,
            vagueReelleId: null,
            alevinsAchetes: false,
            alimentsParMois: [
              {
                id: "apvp-1",
                alimentPrevisionId: "aliment-2mm",
                moisCycle: 1,
                sacsCalcules: 10,
                sacsSaisis: 999,
                quantiteKgCalculee: new Decimal(150),
                coutCalculeFCFA: new Decimal(180000),
              },
            ],
          },
        ],
      });

      const projection = calculerProjectionScenario(scenario);
      const vague = projection.vagues[0];
      const mois1 = vague.alimentsParMois.find((a) => a.moisCycle === 1)!;
      const mois2 = vague.alimentsParMois.find((a) => a.moisCycle === 2)!;

      expect(mois1.sacs).toBe(999);
      expect(mois2.sacs).not.toBe(999);
    }
  );
});

describe("calculerProjectionScenario — point bas de tresorerie", () => {
  it("renvoie la tresorerie cumulee, le point bas et le mois ou il survient", () => {
    const scenario = buildScenario({
      journal: [],
      apports: [],
    });

    const projection = calculerProjectionScenario(scenario);

    expect(projection.mois.length).toBe(projection.horizonMois);
    expect(projection.pointBas).not.toBeNull();
    expect(typeof projection.pointBas!.moisAbsolu).toBe("number");
    expect(projection.pointBas!.pointBasFCFA).toBeInstanceOf(Decimal);

    // Sans apports ni revenus suffisants pour couvrir les couts (aliments + alevins),
    // le solde du mois 0 doit etre negatif — la vague n'est recoltee qu'au mois 2 (cycle
    // de 3 mois), donc aucun revenu n'est comptabilise avant le mois de recolte.
    const soldeMois0 = projection.mois[0].soldeFCFA;
    expect(soldeMois0.lessThan(0)).toBe(true);
  });

  it("le point bas correspond bien au minimum de la serie de soldes mensuels", () => {
    const scenario = buildScenario();
    const projection = calculerProjectionScenario(scenario);

    const min = projection.mois.reduce(
      (acc, m) => (m.soldeFCFA.lessThan(acc) ? m.soldeFCFA : acc),
      projection.mois[0].soldeFCFA
    );

    expect(projection.pointBas!.pointBasFCFA.equals(min)).toBe(true);
  });
});

describe("calculerProjectionScenario — decision 6 (base_repartition exclut le journal affecte)", () => {
  it("un poste de charge inclusBaseRepartition=false n'entre pas dans la quote-part", () => {
    const scenario = buildScenario({
      postes: [
        {
          id: "poste-1",
          libelle: "Poste exceptionnel",
          type: TypePostePrevision.CHARGE_EXPLOITATION,
          inclusBaseRepartition: false,
          ordre: 1,
          chargesMensuelles: [{ id: "charge-1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: new Decimal(1_000_000) }],
        },
      ],
    });

    const projection = calculerProjectionScenario(scenario);
    expect(projection.mois[0].baseRepartitionFCFA.toNumber()).toBe(0);
  });
});

describe("calculerProjectionScenario — ADR-053 §12.2 arbitrage 1 (somme par article) : N articles d'un meme calibre", () => {
  it("le cout d'un calibre a 2 articles est la somme (sacs_i x prix_i), jamais une moyenne des prix", () => {
    // sacsParTonneStandard = 25.25, tonnage = 4 tonnes -> totalSacsCalibre =
    // ceil(4 * 25.25) = 101 (entier exact, le ceil ne modifie rien) —
    // independant de tout poidsSacKg (ADR-053 §12.2 arbitrage 1).
    // Hare-Niemeyer, parts 50/50 : partExacte = 50.5 chacun, plancher = 50
    // chacun, reste = 0.5 chacun (ex aequo) -> depart par `ordre` croissant,
    // article-A (ordre 0) recoit le sac supplementaire : sacs_A=51, sacs_B=50.
    const scenario = buildScenario({
      aliments: [
        {
          id: "aliment-2mm",
          tailleGranule: TailleGranule.G1,
          sacsParTonneStandard: new Decimal(25.25),
          ordre: 1,
          repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
          articles: [
            {
              id: "article-A",
              produitId: null,
              libelle: "Marque A",
              poidsSacKg: new Decimal(15),
              prixSacFCFA: new Decimal(18000),
              sacsParTonneUnitaire: new Decimal(1000).dividedBy(15),
              partApprovisionnementPct: new Decimal(50),
              ordre: 0,
            },
            {
              id: "article-B",
              produitId: null,
              libelle: "Marque B",
              poidsSacKg: new Decimal(20),
              prixSacFCFA: new Decimal(20000),
              sacsParTonneUnitaire: new Decimal(1000).dividedBy(20),
              partApprovisionnementPct: new Decimal(50),
              ordre: 1,
            },
          ],
        },
      ],
    });

    const projection = calculerProjectionScenario(scenario);
    const vague = projection.vagues[0];
    const ligneMois1 = vague.alimentsParMois.find((a) => a.moisCycle === 1)!;

    // Somme article par article : 51*18000 + 50*20000 = 918000 + 1000000 = 1918000.
    const coutSommeArticles = 51 * 18000 + 50 * 20000;
    // Contre-preuve explicite : une moyenne des prix (19000) appliquee au
    // total de 101 sacs donnerait 1919000 — UN MONTANT DIFFERENT, exactement
    // la confusion que l'arbitrage 1 (revise) proscrit.
    const coutSiMoyennePonderee = 101 * 19000;

    expect(ligneMois1.montantFCFA.toNumber()).toBe(coutSommeArticles);
    expect(ligneMois1.montantFCFA.toNumber()).not.toBe(coutSiMoyennePonderee);
  });

  it("cas d'ecart plus marque (parts asymetriques 30/70, prix tres differents) : la somme et la moyenne ponderee divergent de facon mesurable, pas seulement d'un sac d'arrondi", () => {
    // totalSacsCalibre = ceil(4 * 8) = 32 (tonnage/sacsParTonneStandard par defaut de buildScenario).
    // Hare-Niemeyer 30/70 sur 32 : partExacte = 9.6 / 22.4, planchers = 9/22 (somme 31),
    // reste = 0.6 (A) / 0.4 (B) -> le sac supplementaire va a A (plus grand reste) : sacsA=10, sacsB=22.
    const scenario = buildScenario({
      aliments: [
        {
          id: "aliment-2mm",
          tailleGranule: TailleGranule.G1,
          sacsParTonneStandard: new Decimal(8),
          ordre: 1,
          repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
          articles: [
            {
              id: "article-cher",
              produitId: null,
              libelle: "Marque premium",
              poidsSacKg: new Decimal(15),
              prixSacFCFA: new Decimal(30000),
              sacsParTonneUnitaire: new Decimal(1000).dividedBy(15),
              partApprovisionnementPct: new Decimal(30),
              ordre: 0,
            },
            {
              id: "article-eco",
              produitId: null,
              libelle: "Marque economique",
              poidsSacKg: new Decimal(25),
              prixSacFCFA: new Decimal(10000),
              sacsParTonneUnitaire: new Decimal(1000).dividedBy(25),
              partApprovisionnementPct: new Decimal(70),
              ordre: 1,
            },
          ],
        },
      ],
    });

    const projection = calculerProjectionScenario(scenario);
    const coutTotal = projection.vagues[0].coutAlimentFCFA.toNumber();

    // Somme article par article (REGLE RETENUE, ADR-053 §12.2 arbitrage 1) : 10*30000 + 22*10000.
    const coutSommeArticles = 10 * 30000 + 22 * 10000; // 300000 + 220000 = 520000
    // Moyenne SIMPLE des prix (19999.5..) x total : rejetee explicitement par l'ADR (ni ponderee ni
    // simple ne sont la bonne grandeur), utilisee ici uniquement comme contre-preuve chiffree.
    const coutSiMoyenneSimple = 32 * ((30000 + 10000) / 2); // 32 * 20000 = 640000
    // Moyenne PONDEREE par les parts declarees (30%/70%) x total : le candidat le plus proche,
    // explicitement invalide par l'utilisateur (ADR-053 §12.2 arbitrage 1, revision 2026-08-03).
    const coutSiMoyennePonderee = 32 * (30000 * 0.3 + 10000 * 0.7); // 32 * 16000 = 512000

    expect(coutTotal).toBe(coutSommeArticles);
    expect(coutTotal).not.toBe(coutSiMoyenneSimple);
    expect(coutTotal).not.toBe(coutSiMoyennePonderee);
    // Ecart avec la moyenne ponderee : 8000 FCFA, pas 1 FCFA d'arrondi — la divergence
    // est structurelle (methode de calcul), pas un artefact de precision.
    expect(Math.abs(coutTotal - coutSiMoyennePonderee)).toBe(8000);
  });

  it("le NOMBRE TOTAL DE SACS DU CALIBRE (et donc le cout a prix egal) est INDEPENDANT du poidsSacKg des articles — ne depend que du tonnage et de sacsParTonneStandard (ADR-053 §12.2 arbitrage 1)", () => {
    // Deux scenarios, memes tonnage/sacsParTonneStandard, MEME prix par sac (1000 FCFA) sur
    // tous les articles, mais poidsSacKg tres differents (15 vs 30) et repartis 30/70 dans le
    // scenario a deux articles. Si le total de sacs du calibre dependait, meme partiellement,
    // d'un poidsSacKg de reference, les deux couts totaux divergeraient (des poidsSacKg
    // differents produiraient des poidsSacKgReference differents). Ils doivent etre identiques.
    const scenarioUnArticle = buildScenario({
      aliments: [
        buildAlimentUnArticle({
          id: "aliment-2mm",
          tailleGranule: TailleGranule.G1,
          poidsSacKg: 15,
          prixSacFCFA: 1000,
          sacsParTonneStandard: 8,
        }),
      ],
    });

    const scenarioDeuxArticles = buildScenario({
      aliments: [
        {
          id: "aliment-2mm",
          tailleGranule: TailleGranule.G1,
          sacsParTonneStandard: new Decimal(8),
          ordre: 1,
          repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
          articles: [
            {
              id: "article-A",
              produitId: null,
              libelle: "Marque A",
              poidsSacKg: new Decimal(15),
              prixSacFCFA: new Decimal(1000),
              sacsParTonneUnitaire: new Decimal(1000).dividedBy(15),
              partApprovisionnementPct: new Decimal(30),
              ordre: 0,
            },
            {
              id: "article-B",
              produitId: null,
              libelle: "Marque B (sac deux fois plus lourd)",
              poidsSacKg: new Decimal(30),
              prixSacFCFA: new Decimal(1000),
              sacsParTonneUnitaire: new Decimal(1000).dividedBy(30),
              partApprovisionnementPct: new Decimal(70),
              ordre: 1,
            },
          ],
        },
      ],
    });

    const coutUnArticle = calculerProjectionScenario(scenarioUnArticle).vagues[0].coutAlimentFCFA.toNumber();
    const coutDeuxArticles = calculerProjectionScenario(scenarioDeuxArticles).vagues[0].coutAlimentFCFA.toNumber();

    // Meme prix (1000) partout -> le cout total ne peut etre identique QUE si le nombre total
    // de sacs (32, ceil(4*8)) est identique dans les deux scenarios, quel que soit poidsSacKg.
    expect(coutUnArticle).toBe(32 * 1000);
    expect(coutDeuxArticles).toBe(32 * 1000);
    expect(coutDeuxArticles).toBe(coutUnArticle);
  });

  it("ajouter un second article a un calibre ne change PAS la repartition mensuelle (les pourcentages de RepartitionMoisAliment restent la seule source de la ventilation par mois du cout deja remise)", () => {
    // Repartition mensuelle asymetrique (60% mois 1, 40% mois 2) — cycle de 2 mois.
    const repartitionsAsymetriques = [
      { moisCycle: 1, pourcentage: new Decimal(60) },
      { moisCycle: 2, pourcentage: new Decimal(40) },
    ];

    function buildAvecNArticles(articles: AlimentPrevisionPourCalcul["articles"]) {
      return buildScenario({
        vaguesPrevues: [
          {
            id: "vp-1",
            code: "V1",
            dateStockagePrevue: new Date("2026-08-01"),
            effectifAlevinsPrevu: 5000,
            poidsMoyenInitialG: new Decimal(5),
            dureeCycleMoisFigee: 2,
            statut: StatutVaguePrevue.PLANIFIEE,
            vaguePrevueParentId: null,
            vagueReelleId: null,
            alevinsAchetes: false,
            alimentsParMois: [],
          },
        ],
        aliments: [
          {
            id: "aliment-2mm",
            tailleGranule: TailleGranule.G1,
            sacsParTonneStandard: new Decimal(8),
            ordre: 1,
            repartitions: repartitionsAsymetriques,
            articles,
          },
        ],
      });
    }

    const projectionUnArticle = calculerProjectionScenario(
      buildAvecNArticles([
        {
          id: "article-unique",
          produitId: null,
          libelle: "Marque unique",
          poidsSacKg: new Decimal(15),
          prixSacFCFA: new Decimal(18000),
          sacsParTonneUnitaire: new Decimal(1000).dividedBy(15),
          partApprovisionnementPct: new Decimal(100),
          ordre: 0,
        },
      ])
    );

    const projectionDeuxArticles = calculerProjectionScenario(
      buildAvecNArticles([
        {
          id: "article-A",
          produitId: null,
          libelle: "Marque A",
          poidsSacKg: new Decimal(15),
          prixSacFCFA: new Decimal(18000),
          sacsParTonneUnitaire: new Decimal(1000).dividedBy(15),
          partApprovisionnementPct: new Decimal(45),
          ordre: 0,
        },
        {
          id: "article-B",
          produitId: null,
          libelle: "Marque B",
          poidsSacKg: new Decimal(20),
          prixSacFCFA: new Decimal(22000),
          sacsParTonneUnitaire: new Decimal(1000).dividedBy(20),
          partApprovisionnementPct: new Decimal(55),
          ordre: 1,
        },
      ])
    );

    for (const projection of [projectionUnArticle, projectionDeuxArticles]) {
      const vague = projection.vagues[0];
      const mois1 = vague.alimentsParMois.find((a) => a.moisCycle === 1)!;
      const mois2 = vague.alimentsParMois.find((a) => a.moisCycle === 2)!;
      const total = vague.coutAlimentFCFA;

      // Le ratio mois1/total et mois2/total reste EXACTEMENT 60%/40% (les pourcentages de
      // RepartitionMoisAliment), que le calibre porte un ou deux articles — la ventilation
      // mensuelle est une propriete du CALIBRE (repartitions), jamais de l'ARTICLE.
      expect(mois1.montantFCFA.dividedBy(total).toNumber()).toBeCloseTo(0.6, 10);
      expect(mois2.montantFCFA.dividedBy(total).toNumber()).toBeCloseTo(0.4, 10);
    }
  });
});
