/**
 * Recette PR1.4 — orchestration des fonctions reelles du moteur pour
 * reproduire les series calendaires/par-vague du jeu d'or a partir du bloc
 * `entreesModele` (identique entre les deux fixtures).
 *
 * IMPORTANT (regle de la story) : ce fichier n'invente et ne recalcule
 * AUCUNE formule metier. Il ne fait que :
 *   1. Construire les entrees typees du moteur (`AlimentPrevisionCalcInput`,
 *      `PalierRemiseInput`, `AlimentParVagueCalcInput`) a partir du JSON.
 *   2. Appeler les fonctions REELLES du moteur (`calculerBesoinAlimentMensuel`,
 *      `calculerCoutAlimentVague`) pour effectuer le calcul.
 *   3. Additionner (operation associative, pas une formule metier) les
 *      resultats obtenus par plusieurs appels quand plusieurs VaguePrevue
 *      sont actives le meme mois calendaire — l'agregation multi-vague n'est
 *      couverte par AUCUNE des 12 fonctions de l'ADR-053 section 4 (elles
 *      operent toutes a l'echelle d'UNE VaguePrevue), voir le rapport de
 *      recette pour le detail de ce gap.
 *
 * Piege verifie numeriquement (script Python independant, voir rapport) :
 * `besoinsAliments.sacsParGranulometrie`/`sacsTotal` (series calendaires)
 * sont obtenus par CEIL-APRES-SOMME (sommer les kg de toutes les vagues
 * actives d'un mois calendaire donne, PUIS ceil UNE SEULE FOIS) — jamais en
 * sommant des `sacs` deja ceil'es individuellement par vague. Pour rester
 * fidele a "ne jamais reimplementer une formule du moteur dans le test", la
 * seconde passe ci-dessous rappelle `calculerBesoinAlimentMensuel` lui-meme
 * (avec un besoin deja agrege, `repartitions: [{moisCycle: 1, pourcentage:
 * 100}]`) pour que le ceil soit reellement execute par le moteur, jamais par
 * ce fichier.
 */
import { Decimal } from "../../decimal-config";
import { calculerBesoinAlimentMensuel, calculerCoutAlimentVague, calculerCoutAlimentGranulometrieParMois } from "../../aliments";
import { calculerLogistiqueMensuelle } from "../../logistique";
import { genererSerieTresorerie } from "../../tresorerie";
import type { AlimentPrevisionCalcInput, PalierRemiseInput } from "../../types";
import type { AlimentParVagueCalcInput, AlimentParVagueMensuelCalcInput } from "../../aliments";
import type { LogistiqueMensuelleResult } from "../../logistique";
import type { TresorerieMoisResult } from "../../tresorerie";
import { indexMoisCalendaire, pctFixtureVersMoteur, type GoldenFixture } from "./helpers";

export interface BesoinsAlimentsCalendrier {
  totalKg: Decimal[];
  kgParGranulometrie: Record<string, Decimal[]>;
  sacsTotal: number[];
  sacsParGranulometrie: Record<string, number[]>;
}

const DUREE_CYCLE_MOIS = 3;

/**
 * Reconstruit les series calendaires `besoinsAliments` du jeu d'or, en
 * appelant `calculerBesoinAlimentMensuel` une fois par (VaguePrevue,
 * moisCycle), puis une seconde fois par (granulometrie, moisCalendaire) pour
 * le ceil agrege (voir doc du fichier).
 */
export function buildBesoinsAlimentsCalendrier(
  fixture: GoldenFixture,
  nbMoisCalendrier: number
): BesoinsAlimentsCalendrier {
  const granulometries = fixture.entreesModele.aliments.map((a) => a.granulometrie);

  const totalKg: Decimal[] = Array.from({ length: nbMoisCalendrier }, () => new Decimal(0));
  const kgParGranulometrie: Record<string, Decimal[]> = {};
  for (const g of granulometries) {
    kgParGranulometrie[g] = Array.from({ length: nbMoisCalendrier }, () => new Decimal(0));
  }

  // Passe 1 : quantiteKg par (vague, granulometrie, moisCycle), sommee par mois calendaire.
  for (const vague of fixture.entreesModele.planVagues) {
    const moisDepart = indexMoisCalendaire(fixture.mois, vague.moisEmpoissonnement);
    const objectifTonnes = new Decimal(vague.objectifTonnes);

    for (let moisCycle = 1; moisCycle <= DUREE_CYCLE_MOIS; moisCycle++) {
      const moisCalendaire = moisDepart + (moisCycle - 1);
      if (moisCalendaire >= nbMoisCalendrier) continue;

      const alimentsInput: AlimentPrevisionCalcInput[] = fixture.entreesModele.aliments.map((a) => ({
        id: a.granulometrie,
        poidsSacKg: new Decimal(a.poidsSacKg),
        // besoin total (kg) de cette granulometrie sur TOUT le cycle de CETTE vague
        besoinTotalCycleKg: objectifTonnes.times(a.sacsParTonneStandard).times(a.poidsSacKg),
        repartitions: [
          { moisCycle: 1, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois1) },
          { moisCycle: 2, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois2) },
          { moisCycle: 3, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois3) },
        ],
      }));

      const resultats = calculerBesoinAlimentMensuel(alimentsInput, moisCycle);
      for (const r of resultats) {
        totalKg[moisCalendaire] = totalKg[moisCalendaire].plus(r.quantiteKg);
        kgParGranulometrie[r.alimentPrevisionId][moisCalendaire] = kgParGranulometrie[r.alimentPrevisionId][
          moisCalendaire
        ].plus(r.quantiteKg);
      }
    }
  }

  // Passe 2 : ceil agrege par (granulometrie, moisCalendaire), execute par le moteur lui-meme
  // (calculerBesoinAlimentMensuel rappele avec le besoin deja somme comme "cycle" a 100% mois 1).
  const sacsTotal: number[] = Array.from({ length: nbMoisCalendrier }, () => 0);
  const sacsParGranulometrie: Record<string, number[]> = {};
  for (const g of granulometries) {
    sacsParGranulometrie[g] = Array.from({ length: nbMoisCalendrier }, () => 0);
    const poidsSacKg = new Decimal(
      fixture.entreesModele.aliments.find((a) => a.granulometrie === g)!.poidsSacKg
    );
    for (let m = 0; m < nbMoisCalendrier; m++) {
      const aggInput: AlimentPrevisionCalcInput[] = [
        {
          id: g,
          poidsSacKg,
          besoinTotalCycleKg: kgParGranulometrie[g][m],
          repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
        },
      ];
      const [resultat] = calculerBesoinAlimentMensuel(aggInput, 1);
      sacsParGranulometrie[g][m] = resultat.sacs;
      sacsTotal[m] += resultat.sacs;
    }
  }

  return { totalKg, kgParGranulometrie, sacsTotal, sacsParGranulometrie };
}

export interface CoutAlimentVagueResult {
  vague: string;
  coutFCFA: Decimal;
}

/**
 * Reconstruit `planVagues[].coutAlimentsFCFA` (cout aliment TOTAL sur tout
 * le cycle d'une vague, apres remise) via `calculerCoutAlimentVague`.
 *
 * Adaptation d'unite necessaire au point d'appel (pas une reimplementation
 * de formule) : `PalierRemise` du schema ADR-053 (section 3.4) et le moteur
 * (`appliquerPalierRemise`) raisonnent en SEUIL DE SACS, alors que le jeu
 * d'or applique la remise sur le TONNAGE de la vague (`paliersRemise[].seuilTonnes`,
 * verifie numeriquement contre les 19 vagues, voir rapport). Les deux sont
 * equivalents a une mise a l'echelle pres : `sacsCalcules` de chaque ligne =
 * le total de sacs de CETTE granulometrie sur TOUT le cycle de la vague
 * (`objectifTonnes * sacsParTonneStandard`), et le seuil est mis a l'echelle
 * identiquement (`seuilTonnes * sacsParTonneStandard` de la MEME
 * granulometrie) — le rapport (sacs/seuil) est alors strictement egal au
 * rapport (tonnage vague/seuilTonnes), donc la decision de remise obtenue
 * par `appliquerPalierRemise` (interne a `calculerCoutAlimentVague`) est
 * identique a celle du classeur, quelle que soit la granulometrie.
 */
export function buildCoutAlimentsParVague(fixture: GoldenFixture): CoutAlimentVagueResult[] {
  return fixture.entreesModele.planVagues.map((vague) => {
    const objectifTonnes = new Decimal(vague.objectifTonnes);

    const lignes: AlimentParVagueCalcInput[] = fixture.entreesModele.aliments.map((a) => {
      const sacsParTonneStandard = new Decimal(a.sacsParTonneStandard);
      const sacsCalcules = objectifTonnes.times(sacsParTonneStandard).toNumber();

      const paliers: PalierRemiseInput[] = fixture.entreesModele.paliersRemise.map((p) => ({
        ordre: p.ordre,
        seuilSacs: new Decimal(p.seuilTonnes).times(sacsParTonneStandard),
        pourcentageRemise: new Decimal(p.remisePct).times(100), // 0..1 -> 0..100
      }));

      return {
        alimentPrevisionId: a.granulometrie,
        sacsCalcules,
        sacsSaisis: null,
        prixSacFCFA: new Decimal(a.prixSacFCFA),
        paliers,
      };
    });

    return { vague: vague.vague, coutFCFA: calculerCoutAlimentVague(lignes) };
  });
}

/**
 * ---------------------------------------------------------------------
 * Gap 1 comble (transport/logistique, src/lib/previsions/logistique.ts).
 * ---------------------------------------------------------------------
 */

export interface LogistiqueCalendrierResult {
  voyagesAliments: number[];
  voyagesPoissons: number[];
  voyagesAlevins: number[];
  /** correspond a logistique.transportAlevins du jeu d'or */
  transportAlevinsFCFA: Decimal[];
  /** correspond a logistique.sousTotal du jeu d'or */
  sousTotalFCFA: Decimal[];
}

/**
 * buildLogistiqueCalendrier — reproduit `logistique.{voyagesAliments,
 * voyagesPoissons, voyagesAlevins, transportAlevins, sousTotal}` du jeu
 * d'or via `calculerLogistiqueMensuelle` (moteur reel), pour chaque mois
 * calendaire.
 *
 * RENFORCEMENT DE CHAINE (demande explicite de la story) : la quantite
 * d'aliments a transporter (`quantiteAlimentsSacs`) n'est PAS lue depuis
 * `fixture.besoinsAliments.sacsTotal` (une valeur ATTENDUE du jeu d'or) —
 * elle est prise depuis `sacsTotalCalcule`, la sortie de
 * `buildBesoinsAlimentsCalendrier` (deja produite par le moteur reel,
 * `calculerBesoinAlimentMensuel`, verifiee exacte ailleurs dans la
 * recette). Aucune valeur de sortie du jeu d'or n'est donc reinjectee ici
 * comme entree pour cette quantite.
 *
 * ENTREES qui restent necessairement des donnees du jeu d'or (aucune des
 * 12 fonctions ADR-053 section 4 ne les produit) :
 * - `entreesModele.transport` (capacites + couts unitaires par voyage) —
 *   veritable ENTREE de modele (parametre de scenario), jamais une sortie.
 * - `entrees.ventesT[mois]` — planning de vente/recolte mensuel (kg de
 *   poisson a transporter) : aucune des 12 fonctions ne produit de
 *   calendrier de recolte, seulement un revenu previsionnel PAR VAGUE
 *   (`calculerRevenuPrevu`), pas un tonnage mensuel agrege exploitable ici
 *   sans fabriquer un `effectifFinal` factice — voir le rapport de recette
 *   pour la discussion de ce choix.
 * - `entreesModele.planVagues[].alevinsACommanderNb` — veritable ENTREE de
 *   modele (plan d'empoissonnement), consommee telle quelle.
 *
 * @param fixture - fixture du jeu d'or (scenario A ou B)
 * @param sacsTotalCalcule - sortie de `buildBesoinsAlimentsCalendrier(...).sacsTotal` (moteur reel, PAS le jeu d'or)
 * @param nbMoisCalendrier - nombre de mois du plan (fixture.mois.length)
 */
export function buildLogistiqueCalendrier(
  fixture: GoldenFixture,
  sacsTotalCalcule: number[],
  nbMoisCalendrier: number
): LogistiqueCalendrierResult {
  const { transport } = fixture.entreesModele;

  const alevinsParMoisCalendaire: Decimal[] = Array.from({ length: nbMoisCalendrier }, () => new Decimal(0));
  for (const vague of fixture.entreesModele.planVagues) {
    const idx = indexMoisCalendaire(fixture.mois, vague.moisEmpoissonnement);
    if (idx < nbMoisCalendrier) {
      alevinsParMoisCalendaire[idx] = alevinsParMoisCalendaire[idx].plus(vague.alevinsACommanderNb);
    }
  }

  const voyagesAliments: number[] = [];
  const voyagesPoissons: number[] = [];
  const voyagesAlevins: number[] = [];
  const transportAlevinsFCFA: Decimal[] = [];
  const sousTotalFCFA: Decimal[] = [];

  for (let m = 0; m < nbMoisCalendrier; m++) {
    const resultat: LogistiqueMensuelleResult = calculerLogistiqueMensuelle({
      quantiteAlimentsSacs: new Decimal(sacsTotalCalcule[m]),
      transportAliments: {
        capacite: new Decimal(transport.voyageAlimentsCapaciteSacs),
        coutUnitaireFCFA: new Decimal(transport.voyageAlimentsCoutFCFA),
      },
      quantitePoissonsKg: new Decimal(fixture.entrees.ventesT[m]).times(1000),
      transportPoissons: {
        capacite: new Decimal(transport.voyagePoissonsCapaciteKg),
        coutUnitaireFCFA: new Decimal(transport.voyagePoissonsCoutFCFA),
      },
      quantiteAlevinsNb: alevinsParMoisCalendaire[m],
      transportAlevins: {
        capacite: new Decimal(transport.voyageAlevinsCapaciteNb),
        coutUnitaireFCFA: new Decimal(transport.voyageAlevinsCoutFCFA),
      },
    });

    voyagesAliments.push(resultat.voyagesAliments);
    voyagesPoissons.push(resultat.voyagesPoissons);
    voyagesAlevins.push(resultat.voyagesAlevins);
    transportAlevinsFCFA.push(resultat.coutAlevinsFCFA);
    sousTotalFCFA.push(resultat.sousTotalFCFA);
  }

  return { voyagesAliments, voyagesPoissons, voyagesAlevins, transportAlevinsFCFA, sousTotalFCFA };
}

/**
 * ---------------------------------------------------------------------
 * Gap 2 comble (apportionnement mensuel du cout aliment,
 * src/lib/previsions/aliments.ts : apportionnerCoutAlimentMensuel,
 * calculerCoutAlimentGranulometrieParMois).
 * ---------------------------------------------------------------------
 */

export interface CoutAlimentLigneCalculee {
  vague: string;
  granulometrie: string;
  moisCycle: number;
  moisCalendaire: number;
  montantFCFA: Decimal;
}

/**
 * buildCoutAlimentsParVagueEtMois — calcule, pour CHAQUE (vague,
 * granulometrie, moisCycle), le montant aliment remise via
 * `calculerCoutAlimentGranulometrieParMois` (moteur reel, compose
 * `appliquerPalierRemise` + `apportionnerCoutAlimentMensuel`).
 *
 * Reutilise EXACTEMENT la meme adaptation d'unite tonnes->sacs que
 * `buildCoutAlimentsParVague` (section 4.2 du rapport de recette) : le
 * total de sacs du CYCLE COMPLET sert de base a la decision de remise,
 * jamais un volume mensuel seul (voir la docstring de
 * `apportionnerCoutAlimentMensuel` dans le moteur).
 *
 * Ne filtre PAS sur `nbMoisCalendrier` ici (un mois de cycle peut
 * legitimement depasser l'horizon du plan pour une vague tardive) — le
 * filtrage vers un calendrier borne est a la charge de l'appelant
 * (`aggregerDepensesAlimentsParMoisCalendaire`).
 */
export function buildCoutAlimentsParVagueEtMois(fixture: GoldenFixture): CoutAlimentLigneCalculee[] {
  const lignes: CoutAlimentLigneCalculee[] = [];

  for (const vague of fixture.entreesModele.planVagues) {
    const moisDepart = indexMoisCalendaire(fixture.mois, vague.moisEmpoissonnement);
    const objectifTonnes = new Decimal(vague.objectifTonnes);

    for (const a of fixture.entreesModele.aliments) {
      const sacsParTonneStandard = new Decimal(a.sacsParTonneStandard);
      const sacsCalculesCycle = objectifTonnes.times(sacsParTonneStandard).toNumber();

      // Meme mise a l'echelle tonnes->sacs que buildCoutAlimentsParVague (section 4.2 du rapport).
      const paliers: PalierRemiseInput[] = fixture.entreesModele.paliersRemise.map((p) => ({
        ordre: p.ordre,
        seuilSacs: new Decimal(p.seuilTonnes).times(sacsParTonneStandard),
        pourcentageRemise: new Decimal(p.remisePct).times(100),
      }));

      const ligne: AlimentParVagueMensuelCalcInput = {
        alimentPrevisionId: a.granulometrie,
        sacsCalculesCycle,
        sacsSaisisCycle: null,
        prixSacFCFA: new Decimal(a.prixSacFCFA),
        paliers,
        repartitions: [
          { moisCycle: 1, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois1) },
          { moisCycle: 2, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois2) },
          { moisCycle: 3, pourcentage: pctFixtureVersMoteur(a.repartitionPctMois3) },
        ],
      };

      const resultatsMois = calculerCoutAlimentGranulometrieParMois(ligne);
      for (const r of resultatsMois) {
        lignes.push({
          vague: vague.vague,
          granulometrie: a.granulometrie,
          moisCycle: r.moisCycle,
          moisCalendaire: moisDepart + (r.moisCycle - 1),
          montantFCFA: r.montantFCFA,
        });
      }
    }
  }

  return lignes;
}

/**
 * aggregerDepensesAlimentsParMoisCalendaire — reproduit
 * `depenses.aliments[mois]` (serie calendaire) en sommant les lignes
 * (vague x granulometrie x moisCycle) de
 * `buildCoutAlimentsParVagueEtMois` par mois CALENDAIRE. Somme = operation
 * associative, pas une formule metier (meme principe que l'agregation
 * multi-vague de `buildBesoinsAlimentsCalendrier`).
 */
export function aggregerDepensesAlimentsParMoisCalendaire(
  lignes: CoutAlimentLigneCalculee[],
  nbMoisCalendrier: number
): Decimal[] {
  const parMois: Decimal[] = Array.from({ length: nbMoisCalendrier }, () => new Decimal(0));
  for (const ligne of lignes) {
    if (ligne.moisCalendaire < nbMoisCalendrier) {
      parMois[ligne.moisCalendaire] = parMois[ligne.moisCalendaire].plus(ligne.montantFCFA);
    }
  }
  return parMois;
}

export interface CoutAlimentsMensuelParVague {
  vague: string;
  mois1FCFA: Decimal;
  mois2FCFA: Decimal;
  mois3FCFA: Decimal;
}

/**
 * aggregerCoutAlimentsParVagueEtMoisCycle — reproduit
 * `planVagues[].coutAlimentsMois{1,2,3}FCFA` (grain vague x moisCycle,
 * TOUTES granulometries confondues) en sommant les lignes de
 * `buildCoutAlimentsParVagueEtMois` par (vague, moisCycle) — somme
 * associative sur les granulometries d'une meme vague/mois, pas une
 * formule metier.
 */
export function aggregerCoutAlimentsParVagueEtMoisCycle(
  lignes: CoutAlimentLigneCalculee[]
): CoutAlimentsMensuelParVague[] {
  const parVague = new Map<string, { mois1: Decimal; mois2: Decimal; mois3: Decimal }>();

  for (const ligne of lignes) {
    if (!parVague.has(ligne.vague)) {
      parVague.set(ligne.vague, { mois1: new Decimal(0), mois2: new Decimal(0), mois3: new Decimal(0) });
    }
    const acc = parVague.get(ligne.vague)!;
    if (ligne.moisCycle === 1) acc.mois1 = acc.mois1.plus(ligne.montantFCFA);
    else if (ligne.moisCycle === 2) acc.mois2 = acc.mois2.plus(ligne.montantFCFA);
    else if (ligne.moisCycle === 3) acc.mois3 = acc.mois3.plus(ligne.montantFCFA);
  }

  return Array.from(parVague.entries()).map(([vague, acc]) => ({
    vague,
    mois1FCFA: acc.mois1,
    mois2FCFA: acc.mois2,
    mois3FCFA: acc.mois3,
  }));
}

/**
 * ---------------------------------------------------------------------
 * Renforcement de chaine demande par la story : depenses.baseRepartition,
 * resultats.depensesTotales, resultats.resultat, resultats.tresorerie
 * reconstruits SANS reinjecter logistique.sousTotal ni
 * resultats.depensesTotales du jeu d'or comme entree.
 * ---------------------------------------------------------------------
 */

export interface ChaineFinanciereCalendrierResult {
  /** correspond a depenses.baseRepartition (logistique.sousTotal calcule + chargesExploitation) */
  baseRepartitionFCFA: Decimal[];
  /** correspond a resultats.depensesTotales */
  depensesTotalesFCFA: Decimal[];
  /** correspond a resultats.resultat */
  resultatFCFA: Decimal[];
  /** correspond a resultats.tresorerie (serie cumulee, genererSerieTresorerie) */
  tresorerie: TresorerieMoisResult[];
}

/**
 * buildChaineFinanciereCalendrier — compose la chaine complete
 * baseRepartition -> depensesTotales -> resultat -> tresorerie, EN
 * REUTILISANT les series deja calculees par le moteur reel
 * (`sousTotalLogistiqueFCFA`, `depensesAlimentsFCFA`) plutot que les
 * valeurs correspondantes du jeu d'or.
 *
 * Ce qui reste necessairement une ENTREE du jeu d'or (aucune des 12
 * fonctions ADR-053 section 4 ne les produit — a documenter honnetement,
 * voir rapport section "entrees vs valeurs attendues") :
 * - `entrees.chiffreAffaires[mois]` — revenu mensuel encaisse : aucune
 *   fonction n'agrege un revenu par mois calendaire a partir d'un
 *   tonnage vendu (`calculerRevenuPrevu` opere par VAGUE avec un
 *   `effectifFinal` qui n'existe pas a l'echelle du mois calendaire sans
 *   etre fabrique).
 * - `resultats.apportsCapital[mois]` — plan d'apports en capital/credit :
 *   aucune formule ne le derive, c'est une decision de financement du
 *   scenario.
 * - `resultats.investissements[mois]` — plan d'investissements (capex) :
 *   idem, decision de scenario, jamais calculee.
 * - `entreesModele.planVagues[].coutAlevinsFCFA` — cout d'achat des
 *   alevins (0 sur les 19 vagues des deux fixtures, `alevinsAchetes =
 *   "NON"" partout) : veritable ENTREE de modele (entreesModele), sommee
 *   ici par mois d'empoissonnement, jamais recalculee — aucune des 12
 *   fonctions ne calcule de cout d'achat d'alevins.
 *
 * Charges d'exploitation (`entreesModele.chargesExploitation`) et
 * investissements/apports/chiffreAffaires ne sont PAS des sorties du
 * moteur : ce sont des entrees de scenario au meme titre que
 * `entreesModele.transport` ou `entreesModele.aliments` — le fait
 * qu'elles apparaissent sous les blocs `entrees`/`resultats` (pas
 * `entreesModele`) dans le JSON du jeu d'or est une particularite de la
 * structure d'export (extract-golden.py), pas une indication qu'il
 * s'agit de sorties calculees.
 *
 * @param fixture - fixture du jeu d'or
 * @param sousTotalLogistiqueFCFA - sortie de `buildLogistiqueCalendrier(...).sousTotalFCFA` (moteur reel)
 * @param depensesAlimentsFCFA - sortie de `aggregerDepensesAlimentsParMoisCalendaire(...)` (moteur reel)
 * @param nbMoisCalendrier - nombre de mois du plan
 */
export function buildChaineFinanciereCalendrier(
  fixture: GoldenFixture,
  sousTotalLogistiqueFCFA: Decimal[],
  depensesAlimentsFCFA: Decimal[],
  nbMoisCalendrier: number
): ChaineFinanciereCalendrierResult {
  const chargesExpParMois: Decimal[] = Array.from({ length: nbMoisCalendrier }, (_, m) =>
    fixture.entreesModele.chargesExploitation.reduce(
      (sum, poste) => sum.plus(poste.valeursParMoisFCFA[m]),
      new Decimal(0)
    )
  );

  const baseRepartitionFCFA = sousTotalLogistiqueFCFA.map((sousTotal, m) => sousTotal.plus(chargesExpParMois[m]));

  const coutAlevinsParMois: Decimal[] = Array.from({ length: nbMoisCalendrier }, () => new Decimal(0));
  for (const vague of fixture.entreesModele.planVagues) {
    const idx = indexMoisCalendaire(fixture.mois, vague.moisEmpoissonnement);
    if (idx < nbMoisCalendrier) {
      coutAlevinsParMois[idx] = coutAlevinsParMois[idx].plus(vague.coutAlevinsFCFA);
    }
  }

  const depensesTotalesFCFA: Decimal[] = [];
  const resultatFCFA: Decimal[] = [];
  const moisOrdonnes: { moisAbsolu: number; revenus: Decimal; depenses: Decimal; apports: Decimal }[] = [];

  for (let m = 0; m < nbMoisCalendrier; m++) {
    const autresDepenses = baseRepartitionFCFA[m].plus(fixture.resultats.investissements[m]);
    const depensesTotales = depensesAlimentsFCFA[m].plus(coutAlevinsParMois[m]).plus(autresDepenses);
    depensesTotalesFCFA.push(depensesTotales);

    const totalEntrees = new Decimal(fixture.entrees.chiffreAffaires[m]).plus(fixture.resultats.apportsCapital[m]);
    resultatFCFA.push(totalEntrees.minus(depensesTotales));

    moisOrdonnes.push({
      moisAbsolu: m,
      revenus: new Decimal(fixture.entrees.chiffreAffaires[m]),
      depenses: depensesTotales,
      apports: new Decimal(fixture.resultats.apportsCapital[m]),
    });
  }

  const tresorerie = genererSerieTresorerie(
    moisOrdonnes,
    new Decimal(fixture.entreesModele.parametresScenario.tresorerieInitialeFCFA)
  );

  return { baseRepartitionFCFA, depensesTotalesFCFA, resultatFCFA, tresorerie };
}
