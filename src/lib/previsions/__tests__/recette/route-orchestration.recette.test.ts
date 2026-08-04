/**
 * Recette PR2bis.4 — extension de `__tests__/recette/` a
 * `calculerProjectionScenario` elle-meme (`route-orchestration.ts`), pas
 * seulement aux fonctions du moteur pur qu'elle appelle.
 *
 * Motivation (ERR-142, review-sprint-PR2.md) : les 3 bugs Haute de PR2
 * etaient tous dans `route-orchestration.ts`, une couche jamais couverte
 * par la recette existante (`orchestration.ts` appelle les fonctions du
 * moteur ISOLEMENT, jamais `calculerProjectionScenario` elle-meme).
 *
 * Couverture minimale exigee par la story :
 *  - `besoinTotalCycleKg` (bug d'unite kg/tonnes, ERR-139) — Section A.
 *  - application de `sacsSaisis` aux DEUX grains (affichage mensuel ET
 *    agregat de cycle qui pilote la remise), ERR-140 — Section B.
 *
 * Section A couvre les DEUX fixtures du jeu d'or (convention etablie,
 * `entreesModele` identique entre les deux — verifie a nouveau ici, pas
 * suppose). Section B utilise un scenario delibrement minimal (1 vague, 1
 * granulometrie) car aucune des deux fixtures du jeu d'or ne modelise de
 * surcharge `sacsSaisis` — voir JSDoc de la section B.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../../decimal-config";
import { calculerProjectionScenario } from "../../route-orchestration";
import { calculerBesoinAlimentMensuel, calculerCoutAlimentGranulometrieParMois } from "../../aliments";
import { calculerEpargne } from "../../tresorerie";
import type { AlimentPrevisionCalcInput, PalierRemiseInput } from "../../types";
import {
  loadGoldenFixture,
  expectEntierExact,
  expectKgApprox,
  expectMontantFCFA,
  type GoldenFixture,
  type GoldenVague,
} from "./helpers";
import {
  buildScenarioPourCalculDepuisFixture,
  parseMoisFixture,
  GRANULOMETRIE_VERS_TAILLE_GRANULE,
} from "./route-orchestration-builder";
import { StatutVaguePrevue } from "@/types";

/** Champs bruts du jeu d'or absents du type partage `GoldenVague` (celui-ci
 * ne porte que les champs deja consommes par `orchestration.ts`) — etendus
 * localement pour ce fichier, sans toucher `helpers.ts` (partage). */
interface GoldenVagueAvecSacs extends GoldenVague {
  sacs2mm: number;
  sacs3mm: number;
  sacs4mm: number;
  sacsTotal: number;
  kgTotal: number;
}

function runSectionA(fixture: GoldenFixture, label: string) {
  describe(`Section A — besoinTotalCycleKg via calculerProjectionScenario (${label})`, () => {
    // Les quatre paliers reels du classeur sont passes par defaut depuis la
    // story PR2sept.3 (voir JSDoc route-orchestration-builder.ts) : les
    // grandeurs comparees ici incluent donc la remise.
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);
    const vagues = fixture.entreesModele.planVagues as GoldenVagueAvecSacs[];
    const granulometrieVersPoidsSacKg = new Map(
      fixture.entreesModele.aliments.map((a) => [a.granulometrie, a.poidsSacKg])
    );

    it(`${label} — calculerProjectionScenario produit bien 19 VagueProjectionResult`, () => {
      expect(resultat.vagues).toHaveLength(19);
    });

    for (const vague of vagues) {
      const projection = resultat.vagues.find((v) => v.code === vague.vague)!;

      it(`${vague.vague} — VagueProjectionResult trouve`, () => {
        expect(projection).toBeDefined();
      });

      for (const g of ["2mm", "3mm", "4mm"] as const) {
        // NOTE : la somme des `sacs` MENSUELS (chacun individuellement
        // ceile par `calculerBesoinAlimentMensuel`) n'est PAS comparee ici
        // a `vague.sacsXmm` — ce sont deux grandeurs legitimement
        // DIFFERENTES (ceil-par-mois-puis-somme vs ceil-une-fois-sur-le-
        // cycle-complet, meme famille de piege que ERR-128), verifie
        // numeriquement en construisant ce fichier (V1 : 26+7+0 = 33 sacs
        // mensuels ceiles separement, contre 32 = ceil(480/15) au niveau du
        // cycle complet). `vague.sacsXmm` du jeu d'or correspond au
        // cycle-ceil-une-fois (= sacsCalculesCycle, interne a
        // route-orchestration.ts, jamais expose par `VagueProjectionResult`)
        // — verifie plus bas via `coutAlimentFCFA` (Section A, bloc dedie),
        // pas ici.
        it(`${vague.vague} — quantiteKg ${g} sur tout le cycle`, () => {
          const kgCycle = projection.alimentsParMois
            .filter((l) => l.alimentPrevisionId === g)
            .reduce((s, l) => s.plus(l.quantiteKg), new Decimal(0));
          const poidsSacKg = granulometrieVersPoidsSacKg.get(g)!;
          // besoinTotalCycleKg attendu = objectifTonnes (entree fixture) x
          // sacsParTonneStandard x poidsSacKg (kg) — meme transposition que
          // `orchestration.ts` (recette du moteur pur), ici verifiee sur la
          // sortie de `calculerProjectionScenario` (route-orchestration.ts).
          const aliment = fixture.entreesModele.aliments.find((a) => a.granulometrie === g)!;
          const attenduKg = new Decimal(vague.objectifTonnes).times(aliment.sacsParTonneStandard).times(poidsSacKg);
          expectKgApprox(kgCycle, attenduKg.toNumber(), `${vague.vague}.quantiteKg.${g}`);
        });
      }

      it(`${vague.vague} — coutAlimentFCFA REMISE == planVagues[].coutAlimentsFCFA du jeu d'or (tolerance <= 1 FCFA) — remise reellement exercee de bout en bout`, () => {
        // Story PR2sept.3 (ADR-053 §13.4) : cette assertion ne comparait
        // jusqu'ici qu'un cout BRUT, parce que le builder desactivait la
        // remise (liste de paliers vide). Les quatre paliers reels du classeur
        // sont desormais passes tels quels, donc `coutAlimentFCFA` se compare
        // DIRECTEMENT a la valeur du jeu d'or, remise incluse — c'est la
        // preuve, jamais faite jusqu'ici, que le chemin applicatif
        // (`route-orchestration.ts`) reproduit le classeur AVEC remise.
        const ecart = projection.coutAlimentFCFA.minus(vague.coutAlimentsFCFA).abs();
        expect(ecart.lte(1)).toBe(true);
      });

      it(`${vague.vague} — le TAUX de remise retenu == planVagues[].remisePct du jeu d'or (${vague.remisePct}), pas seulement le montant`, () => {
        // Le cout BRUT (`vague.sacsXmm`, entree litterale du jeu d'or,
        // verifiee exacte par `orchestration.ts`) sert ici de denominateur
        // pour EXTRAIRE le taux effectivement applique par l'orchestration :
        // `1 - cout_remise / cout_brut`. C'est le pourcentage lui-meme qui
        // est asserte, pas le montant qui en decoule (ADR-053 §13.4).
        const coutBrut = (["2mm", "3mm", "4mm"] as const).reduce((total, g) => {
          const aliment = fixture.entreesModele.aliments.find((a) => a.granulometrie === g)!;
          const sacsCycleFixture = vague[`sacs${g}` as "sacs2mm" | "sacs3mm" | "sacs4mm"];
          return total.plus(new Decimal(sacsCycleFixture).times(aliment.prixSacFCFA));
        }, new Decimal(0));
        const remiseEffective = new Decimal(1).minus(projection.coutAlimentFCFA.dividedBy(coutBrut));
        const ecart = remiseEffective.minus(vague.remisePct).abs();
        expect(ecart.lte(1e-9)).toBe(true);
      });

      it(`${vague.vague} — kgTotal (3 granulometries)`, () => {
        const kgTotal = projection.alimentsParMois.reduce((s, l) => s.plus(l.quantiteKg), new Decimal(0));
        expectKgApprox(kgTotal, vague.kgTotal, `${vague.vague}.kgTotal`);
      });

      it(`${vague.vague} — biomasseKg = objectifTonnes x 1000 (entree fixture, ERR-139 au niveau revenu/biomasse)`, () => {
        expectKgApprox(projection.biomasseKg, vague.objectifTonnes * 1000, `${vague.vague}.biomasseKg`);
      });

      it(`${vague.vague} — alevinsACommanderNb (tolerance 0, story PR2bis.3, reconfirme via calculerProjectionScenario)`, () => {
        expectEntierExact(projection.alevinsACommanderNb, vague.alevinsACommanderNb, `${vague.vague}.alevinsACommanderNb`);
      });

      it(`${vague.vague} — coutAlevinsFCFA == planVagues[].coutAlevinsFCFA (0 sur alevinsAchetes=NON, tolerance 1 FCFA) — ERR-170/ADR-053 §14.7`, () => {
        expectMontantFCFA(projection.coutAlevinsFCFA, vague.coutAlevinsFCFA, `${vague.vague}.coutAlevinsFCFA`);
      });

      it(`${vague.vague} — moisStockageAbsolu correspond au mois d'empoissonnement de la fixture`, () => {
        const idxAttendu = fixture.mois.indexOf(vague.moisEmpoissonnement);
        expect(projection.moisStockageAbsolu).toBe(idxAttendu);
      });

      it(`${vague.vague} — moisRecolteAbsolu = moisStockageAbsolu + dureeCycle - 1`, () => {
        expect(projection.moisRecolteAbsolu).toBe(projection.moisStockageAbsolu + 3 - 1);
      });
    }
  });
}

/**
 * Section C — story PR2q.2, ERR-142 : la recette de PR2bis.4 ne comparait la
 * sortie de `calculerProjectionScenario` qu'au grain PAR VAGUE (`resultat.vagues`,
 * 19 entrees), jamais au grain `mois[]` de la fonction publique elle-meme —
 * exactement l'angle mort qu'ERR-142 documente ("trois bugs Haute se sont
 * deja loges dans cette zone non recettee"). Cette section ajoute une
 * comparaison au niveau `mois[]`, DIRECTEMENT sur la sortie de
 * `calculerProjectionScenario` (pas seulement sur un helper de
 * `orchestration.ts`).
 *
 * `resultatFCFA`/`epargneFCFA` n'ont pas d'equivalent EXACT dans le jeu d'or
 * a ce grain via `calculerProjectionScenario` (le builder de ce fichier
 * construit un scenario avec `postes: []`/`journal: []`/`apports: []`) —
 * comparer directement a
 * `fixture.resultats.resultat`/`epargne` produirait donc un FAUX ecart, pas
 * un vrai. Ce qui EST verifiable sans recalculer la formule dans ce test
 * (regle sacree) : les DEUX identites algebriques que la story demande de
 * prouver plutot que de supposer, evaluees sur la sortie REELLE et PUBLIQUE
 * de `calculerProjectionScenario` pour chaque mois de l'horizon :
 *   1. `resultatFCFA[m] == revenusFCFA[m] + apportsFCFA[m] - depensesFCFA[m]`
 *      (composition des champs deja exposes, jamais une formule reimplementee
 *      independamment).
 *   2. `soldeFCFA[m] - soldeFCFA[m-1] == resultatFCFA[m]` (le delta que
 *      `calculerTresorerieMensuelle`, Etape 10 du moteur, ajoute reellement a
 *      la tresorerie cumulee EST `resultatFCFA` — pas une coincidence).
 *   3. `epargneFCFA[m] == calculerEpargne(resultatFCFA[m], tauxEpargnePct)`,
 *      `calculerEpargne` etant appelee ICI DIRECTEMENT (moteur pur reel,
 *      `tresorerie.ts`), jamais reimplementee — meme convention que la
 *      Section B ci-dessus ("attendu" = appel direct au moteur reel, pas un
 *      recalcul de fixture).
 */
function runSectionC(fixture: GoldenFixture, label: string) {
  describe(`Section C — resultat/epargne au niveau mois[] (${label}), ERR-142`, () => {
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);

    it(`${label} — au moins un mois dans l'horizon calcule`, () => {
      expect(resultat.mois.length).toBeGreaterThan(0);
    });

    for (let m = 0; m < resultat.mois.length; m++) {
      const moisCourant = resultat.mois[m];

      it(`${label} — mois ${m} — resultatFCFA == revenusFCFA + apportsFCFA - depensesFCFA`, () => {
        const attendu = moisCourant.revenusFCFA.plus(moisCourant.apportsFCFA).minus(moisCourant.depensesFCFA);
        const ecart = moisCourant.resultatFCFA.minus(attendu).abs();
        expect(ecart.lte(1)).toBe(true);
      });

      it(`${label} — mois ${m} — soldeFCFA[m] - soldeFCFA[m-1] == resultatFCFA[m] (identite avec le delta de tresorerie)`, () => {
        const soldePrecedent = m === 0 ? new Decimal(0) : resultat.mois[m - 1].soldeFCFA;
        const delta = moisCourant.soldeFCFA.minus(soldePrecedent);
        const ecart = delta.minus(moisCourant.resultatFCFA).abs();
        expect(ecart.lte(1)).toBe(true);
      });

      it(`${label} — mois ${m} — epargneFCFA == calculerEpargne(resultatFCFA, tauxEpargnePct) (moteur reel appele directement)`, () => {
        const attendu = calculerEpargne(moisCourant.resultatFCFA, scenario.parametres.tauxEpargnePct);
        const ecart = moisCourant.epargneFCFA.minus(attendu).abs();
        expect(ecart.lte(1)).toBe(true);
      });

      it(`${label} — mois ${m} — epargneFCFA n'est jamais negative`, () => {
        expect(moisCourant.epargneFCFA.gte(0)).toBe(true);
      });
    }
  });
}

/**
 * Section D — story PR2q.3 : les accumulateurs par mois CALENDAIRE ajoutes a
 * `MoisProjectionResult` (`empoissonneKg`, `ventesKg`, `alevinsACommanderNb`,
 * `besoinAlimentsTotalKg`, `sacsAlimentsTotal`, `sacsParGranulometrie`)
 * n'avaient jamais ete rapproches du jeu d'or au grain `mois[]` de
 * `calculerProjectionScenario` — cette section comble ce trou, meme
 * discipline que la Section C (ERR-142) : les valeurs ATTENDUES viennent
 * exclusivement des blocs de sortie de la fixture (`entrees`,
 * `besoinsAliments`, `depenses`), jamais recalculees.
 *
 * `dateDebutPlan = parseMoisFixture(fixture.mois[0])` (builder) : l'index
 * `moisAbsolu` de `calculerProjectionScenario` correspond donc EXACTEMENT a
 * l'index de `fixture.mois` — aucune reindexation necessaire.
 *
 * MISE A JOUR story PR2non.3 : la limite ci-dessous (apports jamais
 * mappes) a disparu. `buildScenarioPourCalculDepuisFixture` mappe desormais
 * par defaut `resultats.apportsCapital` -> `ApportCapital`
 * (`route-orchestration-builder.ts`, `buildApportsCapital`) — LEGITIME comme
 * entree (decision de financement du scenario, jamais une sortie calculee,
 * cf. `rapport-story-PR2non.1.md`). `resultats.totalEntrees` du jeu d'or
 * (= CA + apports) est donc desormais rapproche directement ci-dessous,
 * plutot que de constater sa degenerescence a `revenusFCFA` (verifie
 * independamment : `resultats.totalEntrees == entrees.chiffreAffaires +
 * resultats.apportsCapital` exactement sur les deux fixtures).
 */
function runSectionD(fixture: GoldenFixture, label: string) {
  describe(`Section D — accumulateurs mensuels story PR2q.3 (${label})`, () => {
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);
    const nbMoisCompares = Math.min(resultat.mois.length, fixture.mois.length);

    it(`${label} — calculerProjectionScenario couvre bien tous les mois de la fixture`, () => {
      expect(nbMoisCompares).toBe(fixture.mois.length);
    });

    for (let m = 0; m < nbMoisCompares; m++) {
      const moisCourant = resultat.mois[m];
      const libelleMois = fixture.mois[m];

      it(`${label} — mois ${libelleMois} — empoissonneKg == entrees.empoissonneT x 1000`, () => {
        expectKgApprox(
          moisCourant.empoissonneKg,
          fixture.entrees.empoissonneT[m] * 1000,
          `${label}.mois[${libelleMois}].empoissonneKg`
        );
      });

      it(`${label} — mois ${libelleMois} — ventesKg == entrees.ventesT x 1000`, () => {
        expectKgApprox(
          moisCourant.ventesKg,
          fixture.entrees.ventesT[m] * 1000,
          `${label}.mois[${libelleMois}].ventesKg`
        );
      });

      it(`${label} — mois ${libelleMois} — besoinAlimentsTotalKg == besoinsAliments.totalKg`, () => {
        expectKgApprox(
          moisCourant.besoinAlimentsTotalKg,
          fixture.besoinsAliments.totalKg[m],
          `${label}.mois[${libelleMois}].besoinAlimentsTotalKg`
        );
      });

      it(`${label} — mois ${libelleMois} — sacsAlimentsTotal == besoinsAliments.sacsTotal`, () => {
        expectEntierExact(
          moisCourant.sacsAlimentsTotal,
          fixture.besoinsAliments.sacsTotal[m],
          `${label}.mois[${libelleMois}].sacsAlimentsTotal`
        );
      });

      for (const [granulometrieFixture, tailleGranule] of Object.entries(GRANULOMETRIE_VERS_TAILLE_GRANULE)) {
        it(`${label} — mois ${libelleMois} — sacsParGranulometrie.${tailleGranule} == besoinsAliments.sacsParGranulometrie.${granulometrieFixture}`, () => {
          expectEntierExact(
            moisCourant.sacsParGranulometrie[tailleGranule] ?? 0,
            fixture.besoinsAliments.sacsParGranulometrie[granulometrieFixture][m],
            `${label}.mois[${libelleMois}].sacsParGranulometrie.${tailleGranule}`
          );
        });
      }

      it(`${label} — mois ${libelleMois} — alevinsACommanderNb == depenses.alevinsCommandes`, () => {
        expectEntierExact(
          moisCourant.alevinsACommanderNb.toNumber(),
          fixture.depenses.alevinsCommandes[m],
          `${label}.mois[${libelleMois}].alevinsACommanderNb`
        );
      });

      it(`${label} — mois ${libelleMois} — coutAlevinsFCFA == depenses.alevins (0 sur alevinsAchetes=NON, tolerance 1 FCFA) — ERR-170/ADR-053 §14.7`, () => {
        expectMontantFCFA(
          moisCourant.coutAlevinsFCFA,
          fixture.depenses.alevins[m],
          `${label}.mois[${libelleMois}].coutAlevinsFCFA`
        );
      });

      it(`${label} — mois ${libelleMois} — revenusFCFA == entrees.chiffreAffaires (composante CA de resultats.totalEntrees)`, () => {
        const ecart = moisCourant.revenusFCFA.minus(fixture.entrees.chiffreAffaires[m]).abs();
        expect(ecart.lte(1)).toBe(true);
      });

      it(`${label} — mois ${libelleMois} — apportsFCFA == resultats.apportsCapital (story PR2non.3 — mappage desormais reel, plus jamais [])`, () => {
        const ecart = moisCourant.apportsFCFA.minus(fixture.resultats.apportsCapital[m]).abs();
        expect(ecart.lte(1)).toBe(true);
      });

      it(`${label} — mois ${libelleMois} — Total des entrées (UI, revenusFCFA + apportsFCFA) == resultats.totalEntrees du jeu d'or`, () => {
        const totalEntreesUI = moisCourant.revenusFCFA.plus(moisCourant.apportsFCFA);
        const ecart = totalEntreesUI.minus(fixture.resultats.totalEntrees[m]).abs();
        expect(ecart.lte(1)).toBe(true);
      });
    }
  });
}

/**
 * Section E — story PR2sex.2 : `detailParVagueSacs` (sacs CONSOMMES, ROUND,
 * indicatif — `Previsions!A11:V23`), rapproche du jeu d'or
 * `besoinsAliments.detailParVagueSacs` (story PR2sex.1). Tolerance ZERO
 * (entier), 21 mois x 3 granulometries x 3 positions de cycle x 2 fixtures —
 * exigence explicite de la story (ERR-155 : une serie disponible et jamais
 * assertee est un angle mort invisible).
 *
 * Le nommage `moisCycleN` n'existe QUE dans la fixture JSON (particularite
 * du jeu d'or, ADR-053 §12.5) — jamais reproduit dans la signature du
 * moteur, indexe par un ENTIER generique (`Record<number, ...>`). Cette
 * section fait exactement le pont documente par la pre-analyse §5 : mapper
 * `moisCycleN` (fixture) -> position entiere `N` (moteur), jamais l'inverse.
 *
 * RAPPEL DE LIMITE (voir JSDoc de `calculerDetailConsommationMensuelle`,
 * docs/analysis/pre-analysis-story-PR2sex.2.md §2) : cette recette ne peut
 * PAS, a elle seule, discriminer `ROUND(Σ)` de `Σ ROUND()` — les 19 vagues
 * des deux fixtures ont 19 mois d'empoissonnement distincts, la somme Σ ne
 * contient donc jamais plus d'un terme sur ces donnees. Un ecart nul ici ne
 * valide QUE le cas a un seul terme ; la protection de l'invariant
 * sum-then-round est le test synthetique dedie de
 * `__tests__/aliments.test.ts` ("PROTECTION sum-then-round"), pas cette
 * section.
 */
/**
 * Cumuls de controle (colonne W du classeur, `SUM` sur les 21 mois) —
 * README `prisma/fixtures/previsions/README.md`, section
 * `besoinsAliments.detailParVagueSacs`. Identiques pour les DEUX fixtures
 * (verifie ci-dessus : seule la zone `resultats` diverge entre A et B,
 * jamais `detailParVagueSacs`). Ajoute par @tester (verification adverse
 * post-implementation, story PR2sex.2) : Section E comparait deja chaque
 * mois individuellement, mais aucune assertion ne verifiait le cumul global
 * annonce par le README — un ecart affectant plusieurs mois dans un sens
 * puis l'autre (compensation) resterait invisible a un simple `it.each`
 * mois par mois si, par accident, on regardait la mauvaise colonne. Trois
 * des neuf series (moisCycle1.4mm, moisCycle3.2mm, moisCycle3.3mm) sont
 * intégralement nulles sur les deux fixtures (0/21 mois non nuls) — leur
 * cumul de controle est 0, une assertion peu discriminante en soi (ERR-155 :
 * une serie a zero ne prouve presque rien), mais conservee ici pour
 * exhaustivite et documentee comme telle plutot que silencieusement omise.
 */
const CUMULS_CONTROLE_DETAIL_PAR_VAGUE_SACS: Record<string, Record<string, number>> = {
  moisCycle1: { "2mm": 1543, "3mm": 867, "4mm": 0 },
  moisCycle2: { "2mm": 385, "3mm": 3471, "4mm": 4820 },
  moisCycle3: { "2mm": 0, "3mm": 0, "4mm": 7230 },
};

function runSectionE(fixture: GoldenFixture, label: string) {
  describe(`Section E — detailParVagueSacs story PR2sex.2 (${label})`, () => {
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);
    const nbMoisCompares = Math.min(resultat.mois.length, fixture.mois.length);

    for (const positionCycle of [1, 2, 3]) {
      const cleFixture = `moisCycle${positionCycle}`;
      const blocFixture = fixture.besoinsAliments.detailParVagueSacs[cleFixture];

      for (const [granulometrieFixture, tailleGranule] of Object.entries(GRANULOMETRIE_VERS_TAILLE_GRANULE)) {
        const serieAttendue = blocFixture[granulometrieFixture];

        for (let m = 0; m < nbMoisCompares; m++) {
          const libelleMois = fixture.mois[m];
          it(`${label} — position ${positionCycle} — mois ${libelleMois} — detailParVagueSacs[${positionCycle}].${tailleGranule} == besoinsAliments.detailParVagueSacs.${cleFixture}.${granulometrieFixture}`, () => {
            const actuel = resultat.mois[m].detailParVagueSacs[positionCycle]?.[tailleGranule] ?? 0;
            expectEntierExact(
              actuel,
              serieAttendue[m],
              `${label}.mois[${libelleMois}].detailParVagueSacs[${positionCycle}].${tailleGranule}`
            );
          });
        }

        it(`${label} — position ${positionCycle} — CUMUL SUR L'HORIZON (colonne W du classeur) — Σ moteur == Σ jeu d'or == cumul de controle README`, () => {
          const sommeMoteur = Array.from({ length: nbMoisCompares }, (_, m) => m).reduce(
            (total, m) => total + (resultat.mois[m].detailParVagueSacs[positionCycle]?.[tailleGranule] ?? 0),
            0
          );
          const sommeJeuDor = serieAttendue.reduce((total: number, v: number) => total + v, 0);
          const cumulControle = CUMULS_CONTROLE_DETAIL_PAR_VAGUE_SACS[cleFixture][granulometrieFixture];

          expectEntierExact(sommeMoteur, cumulControle, `${label}.cumulControle.${cleFixture}.${granulometrieFixture} (moteur)`);
          expectEntierExact(sommeJeuDor, cumulControle, `${label}.cumulControle.${cleFixture}.${granulometrieFixture} (jeu d'or)`);
        });
      }
    }
  });
}

describe("Recette PR2bis.4 — calculerProjectionScenario (route-orchestration.ts)", () => {
  runSectionA(loadGoldenFixture("plan-v12-corrige.json"), "plan-v12-corrige (scenario A)");
  runSectionA(loadGoldenFixture("annexe-b-corrigee.json"), "annexe-b-corrigee (scenario B)");
  runSectionC(loadGoldenFixture("plan-v12-corrige.json"), "plan-v12-corrige (scenario A)");
  runSectionC(loadGoldenFixture("annexe-b-corrigee.json"), "annexe-b-corrigee (scenario B)");
  runSectionD(loadGoldenFixture("plan-v12-corrige.json"), "plan-v12-corrige (scenario A)");
  runSectionD(loadGoldenFixture("annexe-b-corrigee.json"), "annexe-b-corrigee (scenario B)");
  runSectionE(loadGoldenFixture("plan-v12-corrige.json"), "plan-v12-corrige (scenario A)");
  runSectionE(loadGoldenFixture("annexe-b-corrigee.json"), "annexe-b-corrigee (scenario B)");

  /**
   * Section B — ERR-140 : `sacsSaisis` doit s'appliquer aux DEUX grains :
   *   1. l'affichage mensuel (`AlimentParVagueEtMoisProjection.sacs` du mois
   *      surcharge) ;
   *   2. l'agregat de cycle qui pilote le MONTANT du cout
   *      (`calculerCoutAlimentGranulometrieParMois`, appele avec
   *      `sacsSaisisCycle`).
   *
   * REECRITE par la story PR2sept.3 (ADR-053 §13.7, arbitrage tranche avant
   * implementation). Le grain 2 verifiait auparavant que la surcharge faisait
   * FRANCHIR UN SEUIL DE REMISE ; ce n'est plus vrai, et ce n'est pas une
   * regression : le palier se decide desormais sur le seul tonnage vise de la
   * vague. Le §3.6 (COALESCE) reste integralement en vigueur pour le montant.
   * Les deux moities de l'arbitrage sont figees ci-dessous, pour interdire
   * aussi bien la lecture « la surcharge pilote encore le taux » que la
   * lecture paresseuse inverse « surcharger desactive la remise » :
   *   B1. surcharge + tonnage SOUS le seuil -> montant suivant la surcharge,
   *       AUCUNE remise ;
   *   B2. surcharge + tonnage AU-DESSUS du seuil -> remise appliquee quand
   *       meme, sur le montant issu de la surcharge.
   *
   * Aucune des deux fixtures du jeu d'or ne modelise de surcharge
   * `sacsSaisis` (le concept n'existe pas dans le classeur Excel source,
   * uniquement dans le schema ADR-053 section 3.6) — impossible de comparer
   * a une valeur ATTENDUE du jeu d'or ici. La valeur attendue est donc
   * obtenue en appelant DIRECTEMENT les fonctions du moteur reel
   * (`calculerBesoinAlimentMensuel`, `calculerCoutAlimentGranulometrieParMois`)
   * avec le meme total de cycle que celui que `calculerProjectionScenario`
   * DOIT construire (COALESCE par mois, somme sur le cycle) — jamais une
   * formule reimplementee independamment : c'est une verification de
   * COMPOSITION (route-orchestration cable-t-elle correctement les DEUX
   * grains vers le moteur deja recette ?), exactement la recommandation
   * d'ERR-142.
   */
  describe("Section B — sacsSaisis aux deux grains (mois + cycle), ERR-140", () => {
    const fixture = loadGoldenFixture("plan-v12-corrige.json");
    const aliment2mm = fixture.entreesModele.aliments.find((a) => a.granulometrie === "2mm")!;
    const poidsSacKg = new Decimal(aliment2mm.poidsSacKg);
    const prixSacFCFA = new Decimal(aliment2mm.prixSacFCFA);

    // V1 vise 4 tonnes. Deux jeux de seuils EN TONNES, choisis de part et
    // d'autre de ce tonnage, pour exercer les deux moities de l'arbitrage
    // §13.7 — aucun des deux ne depend du nombre de sacs, surcharge comprise.
    /** 400 t : jamais atteint par V1 (4 t) -> 0 %, quelle que soit la surcharge de sacs. */
    const paliersNonAtteints: PalierRemiseInput[] = [
      { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilTonnes: new Decimal(400), pourcentageRemise: new Decimal(10) },
    ];
    /** 4 t : atteint EXACTEMENT par V1 (semantique `>=`) -> 10 %, avec ou sans surcharge. */
    const paliersAtteints: PalierRemiseInput[] = [
      { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilTonnes: new Decimal(4), pourcentageRemise: new Decimal(10) },
    ];

    // Scenario minimal : une seule vague (V1), une seule granulometrie
    // (2mm) — construit depuis la MEME fixture (entreesModele), avec une
    // seule vague reelle a considerer (statut EN_COURS), pour isoler la
    // mecanique de surcharge sans le bruit des 18 autres vagues.
    const fixtureUneVague: GoldenFixture = {
      ...fixture,
      entreesModele: {
        ...fixture.entreesModele,
        aliments: [aliment2mm],
        planVagues: [fixture.entreesModele.planVagues[0]], // V1 : objectifTonnes = 4, sacsCalcules 2mm = 32
      },
    };

    // Surcharge : mois de cycle 1 force a 500 sacs (au lieu du besoin brut
    // calcule pour ce mois, 26 pour V1/2mm) — le TOTAL DU CYCLE devient
    // 500 + besoin brut des mois 2 et 3 = 500 + 7 + 0 = 507 sacs, contre 32
    // sans surcharge (ceil(480/15) au grain cycle-complet — jamais 33, la
    // somme des ceils mensuels, cf. Section A). Cette surcharge change donc
    // massivement le MONTANT, et ne doit rien changer au TAUX.
    const MOIS_CYCLE_SURCHARGE = 1;
    const SACS_SAISIS = 500;

    const surcharges = [
      { vagueCode: "V1", alimentPrevisionId: "2mm", moisCycle: MOIS_CYCLE_SURCHARGE, sacsSaisis: SACS_SAISIS },
    ];

    const scenarioSansSurcharge = buildScenarioPourCalculDepuisFixture(fixtureUneVague, {
      paliersRemise: paliersNonAtteints,
    });
    const scenarioAvecSurcharge = buildScenarioPourCalculDepuisFixture(fixtureUneVague, {
      paliersRemise: paliersNonAtteints,
      surchargesSacsSaisis: surcharges,
    });
    const scenarioAvecSurchargeEtRemise = buildScenarioPourCalculDepuisFixture(fixtureUneVague, {
      paliersRemise: paliersAtteints,
      surchargesSacsSaisis: surcharges,
    });
    const scenarioSansSurchargeAvecRemise = buildScenarioPourCalculDepuisFixture(fixtureUneVague, {
      paliersRemise: paliersAtteints,
    });

    const projectionSansSurcharge = calculerProjectionScenario(scenarioSansSurcharge).vagues[0];
    const projectionAvecSurcharge = calculerProjectionScenario(scenarioAvecSurcharge).vagues[0];
    const projectionAvecSurchargeEtRemise = calculerProjectionScenario(scenarioAvecSurchargeEtRemise).vagues[0];
    const projectionSansSurchargeAvecRemise = calculerProjectionScenario(scenarioSansSurchargeAvecRemise).vagues[0];

    it("sans surcharge : le mois 1 affiche le besoin BRUT calcule par le moteur (pas 500)", () => {
      const ligneMois1 = projectionSansSurcharge.alimentsParMois.find((l) => l.moisCycle === MOIS_CYCLE_SURCHARGE)!;
      expect(ligneMois1.sacs).not.toBe(SACS_SAISIS);
    });

    it("GRAIN 1 (affichage mensuel) : avec surcharge, le mois 1 affiche exactement 500 sacs, pas le besoin brut", () => {
      const ligneMois1 = projectionAvecSurcharge.alimentsParMois.find((l) => l.moisCycle === MOIS_CYCLE_SURCHARGE)!;
      expectEntierExact(ligneMois1.sacs, SACS_SAISIS, "alimentsParMois[moisCycle=1].sacs (avec surcharge)");
    });

    it("les mois NON surcharges restent au besoin brut calcule (la surcharge ne s'etend pas aux autres mois)", () => {
      for (const moisCycle of [2, 3]) {
        const ligne = projectionAvecSurcharge.alimentsParMois.find((l) => l.moisCycle === moisCycle)!;
        const ligneBase = projectionSansSurcharge.alimentsParMois.find((l) => l.moisCycle === moisCycle)!;
        expectEntierExact(ligne.sacs, ligneBase.sacs, `alimentsParMois[moisCycle=${moisCycle}].sacs (mois non surcharge)`);
      }
    });

    it("GRAIN 2 (B1, ADR-053 §13.7) : surcharge + tonnage SOUS le seuil (4 t < 400 t) -> le montant suit la surcharge, AUCUNE remise", () => {
      const coutPlein = prixSacFCFA.times(
        SACS_SAISIS + projectionSansSurcharge.alimentsParMois[1].sacs + projectionSansSurcharge.alimentsParMois[2].sacs
      );
      // Egalite stricte au FCFA pres : la surcharge ne franchit PLUS aucun
      // seuil (elle ne pilote plus le palier du tout) — c'etait exactement
      // l'inverse qui etait fige ici avant la story PR2sept.3.
      expect(projectionAvecSurcharge.coutAlimentFCFA.minus(coutPlein).abs().lte(1)).toBe(true);
    });

    it("GRAIN 2 (B2, ADR-053 §13.7) : surcharge + tonnage AU-DESSUS du seuil (4 t >= 4 t) -> la remise s'applique QUAND MEME, sur le montant issu de la surcharge", () => {
      const coutPlein = prixSacFCFA.times(
        SACS_SAISIS + projectionSansSurcharge.alimentsParMois[1].sacs + projectionSansSurcharge.alimentsParMois[2].sacs
      );
      const attendu = coutPlein.times(new Decimal(0.9)); // remise 10 %, decidee par le tonnage seul
      expect(projectionAvecSurchargeEtRemise.coutAlimentFCFA.minus(attendu).abs().lte(1)).toBe(true);
    });

    it("GRAIN 2 (B3) : le TAUX est identique avec et sans surcharge — seule la base change (interdit la lecture 'surcharger desactive la remise')", () => {
      const tauxSansSurcharge = new Decimal(1).minus(
        projectionSansSurchargeAvecRemise.coutAlimentFCFA.dividedBy(prixSacFCFA.times(32))
      );
      const coutPlein = prixSacFCFA.times(
        SACS_SAISIS + projectionSansSurcharge.alimentsParMois[1].sacs + projectionSansSurcharge.alimentsParMois[2].sacs
      );
      const tauxAvecSurcharge = new Decimal(1).minus(
        projectionAvecSurchargeEtRemise.coutAlimentFCFA.dividedBy(coutPlein)
      );
      expect(tauxSansSurcharge.minus(tauxAvecSurcharge).abs().lte(1e-12)).toBe(true);
      expect(tauxSansSurcharge.minus(new Decimal("0.1")).abs().lte(1e-12)).toBe(true);
    });

    it("GRAIN 2 : coutAlimentFCFA avec surcharge == somme (calculerCoutAlimentGranulometrieParMois appele directement avec sacsSaisisCycle = COALESCE-par-mois-puis-somme)", () => {
      // "Attendu" construit en appelant le moteur REEL (deja recette a 0
      // ecart), jamais une formule reimplementee independamment — voir JSDoc
      // de section B. Reproduit exactement ce que route-orchestration.ts DOIT
      // faire (bloc "Surcharges manuelles", points 1-3 de son en-tete).
      const alimentCalcInput: AlimentPrevisionCalcInput = {
        id: "2mm",
        poidsSacKg,
        besoinTotalCycleKg: new Decimal(fixtureUneVague.entreesModele.planVagues[0].objectifTonnes)
          .times(aliment2mm.sacsParTonneStandard)
          .times(aliment2mm.poidsSacKg),
        repartitions: [
          { moisCycle: 1, pourcentage: new Decimal(aliment2mm.repartitionPctMois1).times(100) },
          { moisCycle: 2, pourcentage: new Decimal(aliment2mm.repartitionPctMois2).times(100) },
          { moisCycle: 3, pourcentage: new Decimal(aliment2mm.repartitionPctMois3).times(100) },
        ],
      };
      const besoinBrutMois2 = calculerBesoinAlimentMensuel([alimentCalcInput], 2)[0];
      const besoinBrutMois3 = calculerBesoinAlimentMensuel([alimentCalcInput], 3)[0];
      const sacsSaisisCycleAttendu = SACS_SAISIS + besoinBrutMois2.sacs + besoinBrutMois3.sacs;

      const montantsAttendus = calculerCoutAlimentGranulometrieParMois(
        {
          alimentPrevisionId: "2mm",
          sacsCalculesCycle: 32, // besoin brut du cycle complet (V1, non affecte par la surcharge)
          sacsSaisisCycle: sacsSaisisCycleAttendu,
          prixSacFCFA,
          repartitions: alimentCalcInput.repartitions,
        },
        // Tonnage vise de V1 (entree du jeu d'or) : la SEULE grandeur qui
        // decide le palier depuis la story PR2sept.3.
        new Decimal(fixtureUneVague.entreesModele.planVagues[0].objectifTonnes),
        paliersAtteints
      );
      const coutAttendu = montantsAttendus.reduce((s, m) => s.plus(m.montantFCFA), new Decimal(0));

      const ecart = projectionAvecSurchargeEtRemise.coutAlimentFCFA.minus(coutAttendu).abs();
      expect(ecart.lte(1)).toBe(true);
    });

    it("sans surcharge, tonnage sous le seuil (4 t < 400 t) : coutAlimentFCFA reste au taux plein (32 sacs)", () => {
      const coutAttenduSansRemise = prixSacFCFA.times(32);
      const ecart = projectionSansSurcharge.coutAlimentFCFA.minus(coutAttenduSansRemise).abs();
      expect(ecart.lte(1)).toBe(true);
    });
  });

  /**
   * Garde-fou de non-regression sur le constructeur lui-meme : verifie que
   * les vagues construites ne sont jamais filtrees par erreur (statut
   * ANNULEE exclurait la vague de `vaguesActives`, route-orchestration.ts
   * ligne ~265).
   */
  it("le constructeur de scenario ne produit jamais de vague ANNULEE (sinon elle serait silencieusement exclue)", () => {
    const fixture = loadGoldenFixture("plan-v12-corrige.json");
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    expect(scenario.vaguesPrevues.every((v) => v.statut !== StatutVaguePrevue.ANNULEE)).toBe(true);
  });

  it("parseMoisFixture('2026-08') = 1er aout 2026", () => {
    const d = parseMoisFixture("2026-08");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(1);
  });
});
