/**
 * Test d'ORCHESTRATION synthetique (@developer, cloture de la reserve M2 de
 * la review de la story PR2sept.3) de l'ORDRE DES OPERATIONS de la remise
 * dans `calculerProjectionScenario` (route-orchestration.ts).
 *
 * RAISON D'ETRE — trou reel identifie par la review : le test « ORDRE DES
 * OPERATIONS » existant (`aliments.test.ts`) ne couvre que le MOTEUR PUR
 * (`calculerCoutAlimentVague`). Sur le chemin d'orchestration, la remise est
 * appliquee PAR CALIBRE (`appliquerTauxRemise`, route-orchestration.ts) puis
 * les montants sont ventiles par mois avant d'etre sommes : si un
 * `toDecimalPlaces(0)` etait introduit un jour sur le cout remise du calibre
 * ou sur les montants mensuels, AUCUNE assertion existante ne tomberait — les
 * ecarts resteraient sous la tolerance de 1 FCFA de la recette (les fixtures
 * du jeu d'or n'ont ni prix impairs ni taux produisant des centimes).
 *
 * PIEGE METHODOLOGIQUE EXPLICITEMENT EVITE (ERR-148/ERR-155) : sans arrondi
 * intercale, les deux ordres sont algebriquement IDENTIQUES
 * (`Σ cᵢ(1−r) = (Σ cᵢ)(1−r)`) — un test qui ne comparerait que ces deux
 * formes ne prouverait strictement RIEN. Les valeurs sont donc choisies
 * (prix impairs, taux 7 %, repartition 50/50) pour que les candidats REJETES
 * soient NUMERIQUEMENT DISTINCTS de l'attendu, et ce fichier ASSERTE
 * explicitement qu'ils different :
 *
 *   attendu (aucun arrondi)            : (15001 + 10001) x 0,93 = 23 251,86
 *   rejete A (arrondi par calibre)     : round(13950,93) + round(9300,93) = 23 252
 *   rejete B (arrondi par mois)        : 2 x round(6975,465) + 2 x round(4650,465) = 23 250
 *
 * L'assertion sur l'attendu est une EGALITE STRICTE `Decimal.equals`, sans
 * aucune tolerance — 0,14 FCFA d'ecart suffit a la faire tomber.
 *
 * Aucune DB : `calculerProjectionScenario` est une fonction pure prenant un
 * `ScenarioPourCalcul` deja charge en memoire (meme patron que
 * `route-orchestration-detail-consommation.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { calculerProjectionScenario } from "../route-orchestration";
import { StatutScenarioPrevision, StatutVaguePrevue, TailleGranule } from "@/types";
import type {
  ScenarioPourCalcul,
  VaguePrevuePourCalcul,
  AlimentPrevisionPourCalcul,
} from "@/lib/queries/previsions-scenario-loader";

/** Prix de sac IMPAIRS : c'est ce qui rend les arrondis intercales visibles. */
const PRIX_SAC_G1_FCFA = new Decimal(15001);
const PRIX_SAC_G2_FCFA = new Decimal(10001);
/** Taux NON ROND applique a des prix impairs -> montants a 2 decimales. */
const TAUX_REMISE_PCT = new Decimal(7);

/**
 * Un calibre a UN SEUL article (part 100 %), `sacsParTonneStandard = 1` :
 * avec une vague de 1 tonne visee (voir `buildVague`), `sacsCalculesCycle =
 * ceil(1 x 1) = 1` sac exactement — le cout brut du calibre vaut donc son
 * prix de sac, sans aucun arrondi parasite venant du calcul des sacs.
 * Repartition 50/50 sur deux mois de cycle : la ventilation mensuelle produit
 * des montants a 3 decimales, ce qui discrimine le candidat rejete B.
 */
function buildCalibre(
  id: string,
  taille: TailleGranule,
  prixSacFCFA: Decimal
): AlimentPrevisionPourCalcul {
  return {
    id,
    tailleGranule: taille,
    sacsParTonneStandard: new Decimal(1),
    ordre: 0,
    repartitions: [
      { moisCycle: 1, pourcentage: new Decimal(50) },
      { moisCycle: 2, pourcentage: new Decimal(50) },
    ],
    articles: [
      {
        id: `${id}-article-unique`,
        produitId: null,
        libelle: taille,
        poidsSacKg: new Decimal(25),
        prixSacFCFA,
        sacsParTonneUnitaire: new Decimal(1000).dividedBy(25),
        partApprovisionnementPct: new Decimal(100),
        ordre: 0,
      },
    ],
  };
}

/**
 * `effectifAlevinsPrevu = 1` x `poidsObjectifG = 1 000 000` / 1000 = 1000 kg
 * = 1 tonne visee. Irrealiste biologiquement, mais ce test n'exerce QUE
 * l'arithmetique de la remise, jamais une contrainte biologique.
 */
function buildVague(): VaguePrevuePourCalcul {
  return {
    id: "V-REMISE",
    code: "V-REMISE",
    dateStockagePrevue: new Date(2026, 0, 1),
    effectifAlevinsPrevu: 1,
    poidsMoyenInitialG: new Decimal(1),
    dureeCycleMoisFigee: 2,
    statut: StatutVaguePrevue.EN_COURS,
    vaguePrevueParentId: null,
    vagueReelleId: null,
    // Non pertinent pour ce fichier (remise aliment, pas alevins) — false =
    // valeur par defaut du schema (ADR-053 §14.3), sans incidence ici.
    alevinsAchetes: false,
    alimentsParMois: [],
  };
}

function buildScenario(): ScenarioPourCalcul {
  return {
    id: "scenario-synthetique-remise-ordre",
    code: "SCN-REMISE-ORDRE",
    nom: "Scenario synthetique — ordre des operations de la remise",
    dureeCycleMois: 2,
    dateDebutPlan: new Date(2026, 0, 1),
    statut: StatutScenarioPrevision.ACTIF,
    parametres: {
      effectifAlevinsParVague: 1,
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
    // Palier atteint EXACTEMENT par la vague (1 t >= 1 t) -> 7 %. Les paliers
    // sont bien exerces ici : ce fichier mesure un MONTANT remise.
    paliersRemise: [
      { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilTonnes: new Decimal(1), pourcentageRemise: TAUX_REMISE_PCT },
    ],
    aliments: [
      buildCalibre("calibre-g1", TailleGranule.G1, PRIX_SAC_G1_FCFA),
      buildCalibre("calibre-g2", TailleGranule.G2, PRIX_SAC_G2_FCFA),
    ],
    vaguesPrevues: [buildVague()],
    postes: [],
    journal: [],
    apports: [],
  };
}

describe("calculerProjectionScenario — ORDRE DES OPERATIONS de la remise (ADR-053 §13.3, reserve M2 de la review PR2sept.3)", () => {
  const projection = calculerProjectionScenario(buildScenario()).vagues[0];

  /** (Σ cᵢ)(1−r) : la seule valeur correcte, exacte, sans aucun arrondi. */
  const attendu = PRIX_SAC_G1_FCFA.plus(PRIX_SAC_G2_FCFA).times(
    new Decimal(1).minus(TAUX_REMISE_PCT.dividedBy(100))
  );

  /** Candidat REJETE A : arrondi FCFA du cout remise PAR CALIBRE, puis somme. */
  const candidatArrondiParCalibre = [PRIX_SAC_G1_FCFA, PRIX_SAC_G2_FCFA].reduce(
    (somme, prix) =>
      somme.plus(
        prix
          .times(new Decimal(1).minus(TAUX_REMISE_PCT.dividedBy(100)))
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      ),
    new Decimal(0)
  );

  /** Candidat REJETE B : arrondi FCFA de chaque MONTANT MENSUEL, puis somme. */
  const candidatArrondiParMois = [PRIX_SAC_G1_FCFA, PRIX_SAC_G2_FCFA].reduce((somme, prix) => {
    const coutCalibre = prix.times(new Decimal(1).minus(TAUX_REMISE_PCT.dividedBy(100)));
    const mensuel = coutCalibre.times(50).dividedBy(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return somme.plus(mensuel.times(2));
  }, new Decimal(0));

  it("les deux candidats rejetes sont NUMERIQUEMENT DISTINCTS de l'attendu (sinon ce fichier ne prouverait rien — ERR-148)", () => {
    expect(attendu.equals(new Decimal("23251.86"))).toBe(true);
    expect(candidatArrondiParCalibre.equals(23252)).toBe(true);
    expect(candidatArrondiParMois.equals(23250)).toBe(true);
    expect(attendu.equals(candidatArrondiParCalibre)).toBe(false);
    expect(attendu.equals(candidatArrondiParMois)).toBe(false);
  });

  it("coutAlimentFCFA = (Σ couts bruts des calibres) x (1 − r) — EGALITE STRICTE, aucune tolerance", () => {
    expect(projection.coutAlimentFCFA.equals(attendu)).toBe(true);
    expect(projection.coutAlimentFCFA.equals(new Decimal("23251.86"))).toBe(true);
  });

  it("aucun arrondi ne s'intercale sur le cout remise PAR CALIBRE (rejette 23 252)", () => {
    expect(projection.coutAlimentFCFA.equals(candidatArrondiParCalibre)).toBe(false);
  });

  it("aucun arrondi ne s'intercale sur les MONTANTS MENSUELS (rejette 23 250)", () => {
    expect(projection.coutAlimentFCFA.equals(candidatArrondiParMois)).toBe(false);
  });

  it("les montants mensuels eux-memes restent exacts (6 975,465 et 4 650,465 par mois, jamais arrondis)", () => {
    const montants = projection.alimentsParMois;
    for (const [alimentPrevisionId, prix] of [
      ["calibre-g1", PRIX_SAC_G1_FCFA],
      ["calibre-g2", PRIX_SAC_G2_FCFA],
    ] as const) {
      const attenduMois = prix
        .times(new Decimal(1).minus(TAUX_REMISE_PCT.dividedBy(100)))
        .times(50)
        .dividedBy(100);
      for (const moisCycle of [1, 2]) {
        const ligne = montants.find(
          (m) => m.alimentPrevisionId === alimentPrevisionId && m.moisCycle === moisCycle
        )!;
        expect(ligne.montantFCFA.equals(attenduMois)).toBe(true);
        // Contre-preuve : la valeur arrondie serait DIFFERENTE.
        expect(
          ligne.montantFCFA.equals(attenduMois.toDecimalPlaces(0, Decimal.ROUND_HALF_UP))
        ).toBe(false);
      }
    }
  });

  it("la somme des montants mensuels reconstitue EXACTEMENT coutAlimentFCFA (aucune derive cumulative)", () => {
    const somme = projection.alimentsParMois.reduce(
      (s, m) => s.plus(m.montantFCFA),
      new Decimal(0)
    );
    expect(somme.equals(projection.coutAlimentFCFA)).toBe(true);
  });
});

/**
 * FERMETURE DE LA LIMITE SIGNALEE PAR @developer (rapport de sprint
 * PR2-septies, §C) — ajout @tester.
 *
 * Le bloc ci-dessus n'exerce QUE les deux arrondis situes EN AVAL de la
 * remise (cout remise par calibre, montants mensuels). Il ne dit rien du
 * troisieme point d'arrondi possible, situe EN AMONT : `coutBrutFCFA`
 * (`route-orchestration.ts`, `Σ prixSacFCFA x sacs`). Verifie par mutation :
 * un `.toDecimalPlaces(0)` ajoute sur cette ligne laisse passer a la fois le
 * bloc ci-dessus ET les 2 378 assertions de la recette — parce que les prix
 * de sac y sont TOUS entiers et les sacs entiers, ce qui rend l'arrondi
 * numeriquement neutre. Le trou n'est donc pas theorique : il est reel et
 * aucune assertion du depot ne le fermait.
 *
 * Or rien, ni dans le schema (`ArticleAliment.prixSacFCFA` est un `Decimal`
 * sans contrainte d'entier) ni dans le zod, n'interdit un prix de sac a
 * decimales. Ce bloc fixe donc le SEUL cas discriminant : un prix de sac
 * fractionnaire.
 *
 *   attendu (aucun arrondi)          : 15 000,5 x 0,93 = 13 950,465
 *   rejete C (arrondi du cout BRUT)  : round(15 000,5) x 0,93 = 13 950,93
 *
 * L'assertion est une egalite stricte `Decimal.equals`, et le candidat rejete
 * est asserte NUMERIQUEMENT DISTINCT de l'attendu (ERR-148).
 */
const PRIX_SAC_FRACTIONNAIRE_FCFA = new Decimal("15000.5");

describe("calculerProjectionScenario — aucun arrondi EN AMONT, sur le cout BRUT (prix de sac fractionnaire)", () => {
  const scenario = buildScenario();
  scenario.aliments = [buildCalibre("calibre-frac", TailleGranule.G1, PRIX_SAC_FRACTIONNAIRE_FCFA)];
  const projection = calculerProjectionScenario(scenario).vagues[0];

  const facteur = new Decimal(1).minus(TAUX_REMISE_PCT.dividedBy(100));
  /** (Σ cᵢ)(1−r) sans aucun arrondi : la seule valeur correcte. */
  const attendu = PRIX_SAC_FRACTIONNAIRE_FCFA.times(facteur);
  /** Candidat REJETE C : cout BRUT arrondi au FCFA AVANT l'application de la remise. */
  const candidatArrondiCoutBrut = PRIX_SAC_FRACTIONNAIRE_FCFA.toDecimalPlaces(
    0,
    Decimal.ROUND_HALF_UP
  ).times(facteur);

  it("le candidat rejete est NUMERIQUEMENT DISTINCT de l'attendu (sinon ce bloc ne prouverait rien — ERR-148)", () => {
    expect(attendu.equals(new Decimal("13950.465"))).toBe(true);
    expect(candidatArrondiCoutBrut.equals(new Decimal("13950.93"))).toBe(true);
    expect(attendu.equals(candidatArrondiCoutBrut)).toBe(false);
  });

  it("coutAlimentFCFA conserve les decimales du prix de sac — EGALITE STRICTE (rejette 13 950,93)", () => {
    expect(projection.coutAlimentFCFA.equals(attendu)).toBe(true);
    expect(projection.coutAlimentFCFA.equals(candidatArrondiCoutBrut)).toBe(false);
  });

  it("les montants mensuels heritent des memes decimales (13 950,465 / 2 par mois)", () => {
    const attenduMois = attendu.times(50).dividedBy(100);
    for (const moisCycle of [1, 2]) {
      const ligne = projection.alimentsParMois.find(
        (m) => m.alimentPrevisionId === "calibre-frac" && m.moisCycle === moisCycle
      )!;
      expect(ligne.montantFCFA.equals(attenduMois)).toBe(true);
    }
  });
});
