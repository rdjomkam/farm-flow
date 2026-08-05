/**
 * Recette PR2bis.4 — construction d'un `ScenarioPourCalcul` (la forme
 * exacte produite par `chargerScenarioPourMoteur`, PR2.1) directement depuis
 * `entreesModele` des fixtures du jeu d'or, pour appeler la fonction
 * d'ORCHESTRATION ELLE-MEME (`calculerProjectionScenario`,
 * `route-orchestration.ts`) — jamais les fonctions du moteur pur prises
 * isolement (deja couvertes par `orchestration.ts`/les deux fichiers
 * `*.recette.test.ts`).
 *
 * Contexte (ERR-142, review-sprint-PR2.md, "Les 3 bugs Haute et ce qu'ils
 * revelent") : le moteur pur est recette a 0 ecart, mais
 * `route-orchestration.ts` — la seule couche qui a produit les 3 bugs Haute
 * de PR2 — ne l'etait pas. Ce fichier comble ce trou en construisant les
 * entrees de `ScenarioPourCalcul` (le type de sortie de
 * `chargerScenarioPourMoteur`) a partir des memes donnees `entreesModele`
 * deja utilisees par `orchestration.ts`, plutot que d'appeler Prisma.
 *
 * REGLE SACREE (identique a `orchestration.ts`) : ce fichier ne recalcule
 * JAMAIS une valeur ATTENDUE de jeu d'or. Il construit uniquement les
 * ENTREES du scenario (`ScenarioPourCalcul`) a partir des entrees brutes de
 * la fixture — la comparaison contre le jeu d'or reste a la charge des
 * fichiers `*.recette.test.ts`.
 *
 * REMISE REELLEMENT EXERCEE (story PR2sept.3, ADR-053 §13.4) : ce builder
 * passe par defaut les QUATRE paliers reels du classeur
 * (`entreesModele.paliersRemise`, `Parametres!B16:C19` — 0 t/0 %, 5 t/2 %,
 * 10 t/4 %, 15 t/6 %), tels qu'un utilisateur les saisit dans l'onglet
 * Parametres, sans aucune mise a l'echelle. La recette d'orchestration
 * compare donc des couts d'aliment REMISES au jeu d'or.
 *
 * Il en allait autrement jusqu'a ce sprint : ce builder forcait une liste de
 * paliers VIDE, c'est-a-dire qu'il DESACTIVAIT la remise dans la
 * seule recette de la couche qui a produit les trois bugs de severite Haute
 * de PR2 (ERR-142) — une recette qui neutralise la regle qu'elle pretend
 * valider. La justification invoquee (impossible de reproduire
 * `planVagues[].coutAlimentsFCFA` sans fabriquer un jeu de seuils par
 * granulometrie que le modele ne supporte pas) est tombee avec le correctif
 * d'ERR-143 : le palier se decide desormais sur le tonnage de la vague, une
 * seule fois, donc les quatre seuils du classeur sont passables tels quels.
 * Ne jamais re-neutraliser la remise pour faire passer une recette : ce
 * serait recreer le contournement sous un autre nom (ADR-053 §13.4).
 *
 * POSTES/JOURNAL/APPORTS REELLEMENT PEUPLES (story PR2non.3, rapport-story-
 * PR2non.1 §"gap structurel") : ce builder construisait jusqu'ici
 * systematiquement `postes: []`, `journal: []`, `apports: []` — meme apres
 * le correctif de logistique (PR2non.2), `baseRepartitionFCFA` ne pouvait
 * donc jamais etre comparee au jeu d'or au niveau `calculerProjectionScenario`
 * (le terme `chargesExploitation` restait toujours 0, quel que soit l'etat
 * du code de production). Par defaut desormais : `entreesModele.chargesExploitation`
 * -> `postes` (CHARGE_EXPLOITATION, inclusBaseRepartition=true),
 * `resultats.investissements` -> `journal` (INVESTISSEMENT),
 * `resultats.apportsCapital` -> `apports`. Les trois flags
 * `inclure{ChargesExploitation,Investissements,Apports}` permettent de les
 * desactiver individuellement — reserve a la preuve par falsification, jamais
 * a un usage normal.
 */
import { Decimal } from "../../decimal-config";
import type {
  ScenarioPourCalcul,
  ParametresPourCalcul,
  AlimentPrevisionPourCalcul,
  VaguePrevuePourCalcul,
  AlimentParVaguePrevuePourCalcul,
  PostePrevisionPourCalcul,
  JournalDepensePrevuePourCalcul,
  ApportCapitalPourCalcul,
} from "@/lib/queries/previsions-scenario-loader";
import type { PalierRemiseInput } from "../../types";
import {
  StatutVaguePrevue,
  StatutScenarioPrevision,
  TailleGranule,
  TypePostePrevision,
  CategorieJournalPrevu,
  TypeApportCapital,
} from "@/types";
import { pctFixtureVersMoteur, type GoldenFixture, type GoldenAliment } from "./helpers";
import { buildPaliersRemise } from "./orchestration";

/**
 * Mapping granulometrie (chaine libre du jeu d'or, ex. "2mm") -> enum
 * `TailleGranule` (ADR-053 §12.2 arbitrage 4 : reutilisation stricte de
 * l'existant, jamais un second referentiel). Les 3 seules granulometries du
 * jeu d'or (2mm/3mm/4mm) correspondent a G1/G2/G3 (cf.
 * `src/messages/fr/stock.json`).
 */
export const GRANULOMETRIE_VERS_TAILLE_GRANULE: Record<string, TailleGranule> = {
  "2mm": TailleGranule.G1,
  "3mm": TailleGranule.G2,
  "4mm": TailleGranule.G3,
};

function tailleGranuleDepuisFixture(granulometrie: string): TailleGranule {
  const taille = GRANULOMETRIE_VERS_TAILLE_GRANULE[granulometrie];
  if (!taille) {
    throw new Error(`[recette] granulometrie du jeu d'or sans mapping TailleGranule : "${granulometrie}".`);
  }
  return taille;
}

const DUREE_CYCLE_MOIS = 3;

/** Convertit "2026-08" en Date(2026, 7, 1) — premier jour du mois calendaire. */
export function parseMoisFixture(moisLabel: string): Date {
  const [annee, mois] = moisLabel.split("-").map((s) => parseInt(s, 10));
  return new Date(annee, mois - 1, 1);
}

/**
 * Construit un calibre + son UNIQUE article a 100% (ADR-053 §12.6, cas
 * nominal) — le jeu d'or n'a jamais qu'une seule marque par granulometrie
 * (`Aliments!A4:J6` du classeur, §12.1) : cette construction est donc le
 * cas degenere N=1 exige par l'ADR pour la non-regression byte-pour-byte de
 * la recette (§12.2 arbitrage 1, preuve chiffree).
 */
function buildAliments(aliments: GoldenAliment[]): AlimentPrevisionPourCalcul[] {
  return aliments.map((a, index) => ({
    id: a.granulometrie,
    tailleGranule: tailleGranuleDepuisFixture(a.granulometrie),
    sacsParTonneStandard: new Decimal(a.sacsParTonneStandard),
    ordre: index,
    repartitions: [
      { moisCycle: 1, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois1) },
      { moisCycle: 2, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois2) },
      { moisCycle: 3, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois3) },
    ],
    articles: [
      {
        id: `${a.granulometrie}-article-unique`,
        produitId: null,
        libelle: a.granulometrie,
        poidsSacKg: new Decimal(a.poidsSacKg),
        prixSacFCFA: new Decimal(a.prixSacFCFA),
        // Pur ratio d'unite (1000 / poidsSacKg) — ne doit JAMAIS entrer dans le
        // calcul de besoin (ERR-138) ; construit uniquement pour respecter la
        // forme complete du type d'entree.
        sacsParTonneUnitaire: new Decimal(1000).dividedBy(a.poidsSacKg),
        partApprovisionnementPct: new Decimal(100),
        ordre: 0,
      },
    ],
  }));
}

/**
 * buildPostesChargesExploitation — story PR2non.3 (ADR-053 §5.5, gap signale
 * par le rapport-story-PR2non.1 : "route-orchestration-builder.ts ne mappe
 * jamais entreesModele.chargesExploitation vers scenario.postes").
 *
 * Sans ce mappage, `scenario.postes` restait vide (`[]`) meme apres le
 * correctif de logistique de la story PR2non.2 : `baseRepartitionFCFA`
 * produite par `calculerProjectionScenario` n'aurait jamais pu etre comparee
 * au jeu d'or (`logistique + chargesExploitation`), puisque le second terme
 * n'existait dans aucun scenario construit par ce fichier. Un cas d'ecole
 * IDENTIQUE au bug de logistique aurait pu se loger ici sans jamais etre
 * detecte (meme cause structurelle qu'ERR-142).
 *
 * Chaque poste du jeu d'or (`entreesModele.chargesExploitation`, 6 postes
 * non nuls) devient un `PostePrevisionPourCalcul` de type
 * `CHARGE_EXPLOITATION`, `inclusBaseRepartition: true` (§3.1 : les charges
 * d'exploitation entrent TOUJOURS dans la base de repartition, ce n'est pas
 * une option de scenario dans le jeu d'or) — jamais une valeur ATTENDUE
 * reinjectee : `valeursParMoisFCFA` est une entree de saisie du classeur
 * (`Depenses!A14:V21`), pas une sortie calculee.
 */
function buildPostesChargesExploitation(fixture: GoldenFixture): PostePrevisionPourCalcul[] {
  return fixture.entreesModele.chargesExploitation.map((poste, index) => {
    const posteId = `charge-exploitation-${index}`;
    return {
      id: posteId,
      libelle: poste.libelle,
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      inclusBaseRepartition: true,
      ordre: index,
      chargesMensuelles: poste.valeursParMoisFCFA.map((montant, m) => ({
        id: `${posteId}-mois-${m}`,
        posteId,
        moisAbsolu: m,
        montantFCFA: new Decimal(montant),
      })),
    };
  });
}

/**
 * buildJournalInvestissements — mappe `resultats.investissements[mois]`
 * (decision de financement du scenario, LEGITIME comme entree — cf.
 * `rapport-story-PR2non.1.md`, meme statut que `resultats.apportsCapital`)
 * vers des lignes `JournalDepensePrevue` de categorie `INVESTISSEMENT`,
 * `vaguePrevueId: null`. Sans ce mappage, `depensesFCFA`/`resultatFCFA`
 * produits par `calculerProjectionScenario` ne pourraient jamais etre
 * compares aux cumuls du Scenario A (342 559 600 / 145 340 400), qui
 * dependent des 34 400 000 FCFA d'investissements.
 *
 * Une seule ligne de journal par mois non nul suffit : `calculerProjectionScenario`
 * ne fait que sommer les lignes `INVESTISSEMENT` du mois (ligne ~656-658),
 * la granularite interne au mois n'a aucune consequence sur le total.
 */
function buildJournalInvestissements(fixture: GoldenFixture): JournalDepensePrevuePourCalcul[] {
  return fixture.resultats.investissements
    .map((montantFCFA, moisAbsolu) => ({ montantFCFA, moisAbsolu }))
    .filter(({ montantFCFA }) => montantFCFA !== 0)
    .map(({ montantFCFA, moisAbsolu }) => ({
      id: `investissement-mois-${moisAbsolu}`,
      date: parseMoisFixture(fixture.mois[moisAbsolu]),
      libelle: `Investissement ${fixture.mois[moisAbsolu]} (jeu d'or)`,
      categorie: CategorieJournalPrevu.INVESTISSEMENT,
      montantFCFA: new Decimal(montantFCFA),
      vaguePrevueId: null,
    }));
}

/**
 * buildApportsCapital — mappe `resultats.apportsCapital[mois]` (decision de
 * financement, LEGITIME comme entree, cf. audit PR2non.1) vers des
 * `ApportCapital`. Meme raisonnement que `buildJournalInvestissements`
 * ci-dessus : sans ce mappage, le Scenario A (30 000 000 FCFA d'apports) ne
 * pourrait jamais etre rapproche du jeu d'or au niveau resultat/tresorerie.
 *
 * `type: CAPITAL` par defaut : le jeu d'or ne distingue pas apport propre /
 * credit au niveau de la serie `resultats.apportsCapital` (une seule serie
 * agregee) — `calculerProjectionScenario` ne filtre jamais par
 * `TypeApportCapital` (verifie : `scenario.apports.map(...)` sans filtre,
 * route-orchestration.ts ligne ~625), donc ce choix est sans consequence sur
 * la grandeur testee.
 */
function buildApportsCapital(fixture: GoldenFixture): ApportCapitalPourCalcul[] {
  return fixture.resultats.apportsCapital
    .map((montantFCFA, moisAbsolu) => ({ montantFCFA, moisAbsolu }))
    .filter(({ montantFCFA }) => montantFCFA !== 0)
    .map(({ montantFCFA, moisAbsolu }) => ({
      id: `apport-mois-${moisAbsolu}`,
      date: parseMoisFixture(fixture.mois[moisAbsolu]),
      libelle: `Apport ${fixture.mois[moisAbsolu]} (jeu d'or)`,
      montantFCFA: new Decimal(montantFCFA),
      type: TypeApportCapital.CAPITAL,
    }));
}

export interface BuildScenarioOptions {
  /**
   * `AlimentParVaguePrevue.sacsSaisis` deja persistees a injecter, indexees
   * par (code de vague, granulometrie, moisCycle). Vide par defaut (aucune
   * surcharge) — voir `route-orchestration.recette.test.ts` pour le cas
   * ERR-140 (deux grains de sacsSaisis).
   */
  surchargesSacsSaisis?: Array<{
    vagueCode: string;
    alimentPrevisionId: string;
    moisCycle: number;
    sacsSaisis: number;
  }>;
  /**
   * Remplace les paliers reels du jeu d'or (defaut : `buildPaliersRemise(fixture)`,
   * voir JSDoc d'en-tete). Reserve aux scenarios synthetiques qui ont besoin
   * d'un jeu de seuils particulier — jamais un moyen de desactiver la remise.
   */
  paliersRemise?: PalierRemiseInput[];
  /**
   * Inclut `entreesModele.chargesExploitation` dans `scenario.postes` (story
   * PR2non.3). Par defaut `true` — c'est le comportement fidele au jeu d'or.
   * `false` reserve EXCLUSIVEMENT a la preuve par falsification (verifier que
   * la recette detecte bien l'absence du mappage) — jamais un moyen normal
   * de construire un scenario de recette.
   */
  inclureChargesExploitation?: boolean;
  /**
   * Inclut `resultats.investissements` comme journal `INVESTISSEMENT` (story
   * PR2non.3). Par defaut `true`.
   */
  inclureInvestissements?: boolean;
  /**
   * Inclut `resultats.apportsCapital` comme `ApportCapital` (story PR2non.3).
   * Par defaut `true`.
   */
  inclureApports?: boolean;
}

/**
 * buildScenarioPourCalculDepuisFixture — construit un `ScenarioPourCalcul`
 * complet (la forme exacte de sortie de `chargerScenarioPourMoteur`)
 * directement depuis `entreesModele` d'une fixture du jeu d'or, pour
 * alimenter `calculerProjectionScenario` (route-orchestration.ts) SANS
 * jamais passer par Prisma.
 */
export function buildScenarioPourCalculDepuisFixture(
  fixture: GoldenFixture,
  options: BuildScenarioOptions = {}
): ScenarioPourCalcul {
  const { parametresScenario, aliments, planVagues, transport } = fixture.entreesModele;
  const dateDebutPlan = parseMoisFixture(fixture.mois[0]);

  const parametres: ParametresPourCalcul = {
    effectifAlevinsParVague: 0, // non consomme par calculerProjectionScenario (valeur par VaguePrevue utilisee a la place)
    margeSecuriteAlevinsPct: pctFixtureVersMoteur(parametresScenario.margeSecuriteAlevinsPct),
    tauxEpargnePct: pctFixtureVersMoteur(parametresScenario.tauxEpargnePct),
    poidsMoyenInitialG: new Decimal(1), // non consomme par calculerProjectionScenario
    poidsObjectifG: new Decimal(parametresScenario.poidsMoyenVenteKg).times(1000),
    prixAlevinUnitaireFCFA: new Decimal(parametresScenario.prixAlevinUnitaireFCFA),
    prixVenteKgFCFA: new Decimal(parametresScenario.prixVenteKgFCFA),
    nombreBacsSimultanesCible: 1, // non consomme par calculerProjectionScenario
    frequenceStockageMois: new Decimal(1), // non consomme par calculerProjectionScenario
    transportAliments: {
      capacite: new Decimal(transport.voyageAlimentsCapaciteSacs),
      coutUnitaireFCFA: new Decimal(transport.voyageAlimentsCoutFCFA),
    },
    transportPoissons: {
      capacite: new Decimal(transport.voyagePoissonsCapaciteKg),
      coutUnitaireFCFA: new Decimal(transport.voyagePoissonsCoutFCFA),
    },
    transportAlevins: {
      capacite: new Decimal(transport.voyageAlevinsCapaciteNb),
      coutUnitaireFCFA: new Decimal(transport.voyageAlevinsCoutFCFA),
    },
    // Story PR3.1a — desormais lu par la production (route-orchestration.ts)
    // au lieu d'un `new Decimal(0)` fige. Vaut 0 pour les deux fixtures du
    // jeu d'or (EXCEL-V12) : ce cablage ne change aucun resultat attendu.
    tresorerieInitialeFCFA: new Decimal(parametresScenario.tresorerieInitialeFCFA),
  };

  const vaguesPrevues: VaguePrevuePourCalcul[] = planVagues.map((v) => {
    const alimentsParMois: AlimentParVaguePrevuePourCalcul[] = (options.surchargesSacsSaisis ?? [])
      .filter((s) => s.vagueCode === v.vague)
      .map((s) => ({
        id: `${v.vague}-${s.alimentPrevisionId}-${s.moisCycle}`,
        alimentPrevisionId: s.alimentPrevisionId,
        moisCycle: s.moisCycle,
        // sacsCalcules/quantiteKgCalculee/coutCalculeFCFA : non lus par
        // calculerProjectionScenario pour la surcharge (seul sacsSaisis
        // compte, cf. route-orchestration.ts ligne ~320) — valeurs de
        // remplissage, jamais utilisees par le calcul teste ici.
        sacsCalcules: 0,
        sacsSaisis: s.sacsSaisis,
        quantiteKgCalculee: new Decimal(0),
        coutCalculeFCFA: new Decimal(0),
      }));

    return {
      id: v.vague,
      code: v.vague,
      dateStockagePrevue: parseMoisFixture(v.moisEmpoissonnement),
      effectifAlevinsPrevu: v.poissonsAVendreNb, // = D (ADR-053, story PR2bis.3)
      poidsMoyenInitialG: new Decimal(1), // non consomme par calculerProjectionScenario
      dureeCycleMoisFigee: DUREE_CYCLE_MOIS,
      statut: StatutVaguePrevue.EN_COURS,
      vaguePrevueParentId: null,
      vagueReelleId: null,
      alimentsParMois,
      // ERR-170 / ADR-053 §14 — mapping fidele du drapeau du jeu d'or ("OUI"/"NON",
      // toujours "NON" sur les 19 vagues connues) vers le booleen du moteur. Ce
      // builder ne DECIDE rien : il retranscrit l'entree telle quelle.
      alevinsAchetes: v.alevinsAchetes === "OUI",
    };
  });

  return {
    id: "scenario-recette-PR2bis.4",
    code: "SCN-RECETTE",
    nom: fixture.$description,
    dureeCycleMois: DUREE_CYCLE_MOIS,
    dateDebutPlan,
    statut: StatutScenarioPrevision.ACTIF,
    parametres,
    paliersRemise: options.paliersRemise ?? buildPaliersRemise(fixture),
    aliments: buildAliments(aliments),
    vaguesPrevues,
    postes: (options.inclureChargesExploitation ?? true) ? buildPostesChargesExploitation(fixture) : [],
    journal: (options.inclureInvestissements ?? true) ? buildJournalInvestissements(fixture) : [],
    apports: (options.inclureApports ?? true) ? buildApportsCapital(fixture) : [],
  };
}
