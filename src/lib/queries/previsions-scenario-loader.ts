/**
 * src/lib/queries/previsions-scenario-loader.ts
 *
 * `chargerScenarioPourMoteur` — chargement complet d'un scenario pour
 * alimenter le moteur de calcul pur (Sprint PR2, story PR2.1, fonction
 * pivot de cette story).
 *
 * BORNE, JAMAIS N+1 : un scenario complet (19 vagues x 3 mois x N
 * granulometries dans le jeu d'or, ADR-053 section 3.7) se charge en un
 * NOMBRE CONSTANT de requetes (7, independant du nombre de vagues/aliments) :
 *   1. ScenarioPrevision + ParametresPrevision (un seul `findFirst` + include)
 *   2. PalierRemise[] (findMany)
 *   3. AlimentPrevision[] + RepartitionMoisAliment[] (un seul `findMany` + include)
 *   4. VaguePrevue[] + AlimentParVaguePrevue[] + vague reelle liee (un seul `findMany` + include)
 *   5. PostePrevision[] + ChargeMensuellePrevue[] (un seul `findMany` + include)
 *   6. JournalDepensePrevue[] (findMany)
 *   7. ApportCapital[] (findMany)
 * — jamais une boucle de queries par vague/aliment.
 *
 * PORTEE DELIBEREMENT BORNEE (decision explicite de cette story, a
 * documenter au rapport de cloture) : cette fonction charge et convertit les
 * donnees BRUTES du scenario (Decimal Prisma -> Decimal moteur), dans la
 * forme la plus proche possible des types d'entree du moteur quand un
 * mapping 1:1 sans perte existe (`PalierRemiseInput`, `RepartitionMoisInput`,
 * `ParametresTransportInput`) — mais elle NE COMPOSE PAS
 * `AlimentPrevisionCalcInput.besoinTotalCycleKg` : ce champ est un GAP DE
 * MODELE deja signale par le moteur (`src/lib/previsions/types.ts`, JSDoc de
 * `AlimentPrevisionCalcInput`) qui depend du tonnage vise d'UNE VaguePrevue
 * particuliere (`objectifTonnes * sacsParTonneStandard * poidsSacKg`,
 * `src/lib/previsions/__tests__/recette/orchestration.ts:80`) — une donnee
 * D'ORCHESTRATION, pas une donnee de chargement. Composer les types d'entree
 * complets du moteur et enchainer les 12 fonctions sur l'horizon complet est
 * le role de la route de calcul dediee (PR2.2, "aucune logique de calcul
 * dupliquee dans la route" — cette route utilisera precisement les donnees
 * BRUTES converties ici comme matiere premiere de son orchestration, sans
 * jamais reinterroger Prisma). Le moteur lui-meme reste zero I/O (ADR-053
 * section 4) : cette fonction est la frontiere I/O -> Decimal moteur,
 * jamais l'inverse.
 *
 * Conversion Decimal : voir `src/lib/previsions/decimal-io.ts`
 * (`prismaDecimalToEngine`, `.toString()` uniquement — jamais `.toNumber()`).
 */
import { prisma } from "@/lib/db";
import {
  StatutScenarioPrevision,
  StatutVaguePrevue,
  TypePostePrevision,
  CategorieJournalPrevu,
  TypeApportCapital,
  TailleGranule,
} from "@/types";
import { prismaDecimalToEngine } from "@/lib/previsions/decimal-io";
import { Decimal } from "@/lib/previsions/decimal-config";
import type { RepartitionMoisInput, PalierRemiseInput } from "@/lib/previsions/types";
import type { ParametresTransportInput } from "@/lib/previsions/logistique";

export interface ParametresPourCalcul {
  effectifAlevinsParVague: number;
  margeSecuriteAlevinsPct: Decimal;
  /**
   * Taux d'epargne applique par le moteur (story PR2q.2, jeu d'or
   * "Parametres!B36") — echelle 0..100 (pourcentage), meme convention que
   * `margeSecuriteAlevinsPct` ci-dessus. Consomme par
   * `calculerEpargne` (`tresorerie.ts`) via `route-orchestration.ts`.
   */
  tauxEpargnePct: Decimal;
  poidsMoyenInitialG: Decimal;
  poidsObjectifG: Decimal;
  prixAlevinUnitaireFCFA: Decimal;
  prixVenteKgFCFA: Decimal;
  nombreBacsSimultanesCible: number;
  frequenceStockageMois: Decimal;
  transportAliments: ParametresTransportInput;
  transportPoissons: ParametresTransportInput;
  transportAlevins: ParametresTransportInput;
  /**
   * Tresorerie d'ouverture du scenario (§4.1 des exigences, jeu d'or
   * "Parametres!B37") — LIBRE, peut etre negative. Consomme par
   * `calculerProjectionScenario` (route-orchestration.ts) comme solde
   * initial de `genererSerieTresorerie`, jamais un `new Decimal(0)` fige
   * (dette 3, pre-analyse PR3 ; ERR-171/ERR-142).
   */
  tresorerieInitialeFCFA: Decimal;
}

/**
 * Le CALIBRE d'aliment previsionnel — porte directement les champs article
 * (fusion `AlimentArticlePrevision` -> `AlimentPrevision` : chaque calibre
 * correspond a exactement un article/produit, plus de sous-liste
 * `articles[]` ni de `partApprovisionnementPct`).
 */
export interface AlimentPrevisionPourCalcul {
  id: string;
  /** identite du calibre — NOT NULL */
  tailleGranule: TailleGranule;
  /**
   * Coefficient de besoin en aliment (sacs de cette granulometrie par tonne
   * de POISSON produit). Nullable : `null` = non configure, tout calcul qui
   * en depend doit rejeter explicitement.
   */
  sacsParTonneStandard: Decimal | null;
  ordre: number;
  repartitions: RepartitionMoisInput[];
  /** rapprochement uniquement — jamais lu par le moteur */
  produitId: string | null;
  libelle: string;
  poidsSacKg: Decimal;
  prixSacFCFA: Decimal;
  /**
   * Pur ratio d'unite de poids (1000 / poidsSacKg) — ne doit JAMAIS entrer
   * dans un calcul de besoin en aliment par tonne de POISSON produit.
   */
  sacsParTonneUnitaire: Decimal;
}

/**
 * Ligne de besoin aliment DEJA calculee et persistee (sortie du moteur, pas
 * une entree de `calculerBesoinAlimentMensuel`). `sacsCalcules`/`sacsSaisis`
 * restent des `number` entiers (colonne Prisma `Int`) — voir la JSDoc de
 * `AlimentParVaguePrevueInputDTO` (`previsions-vagues.ts`) sur l'homonymie
 * avec les types en memoire du moteur (`aliments.ts`).
 */
export interface AlimentParVaguePrevuePourCalcul {
  id: string;
  alimentPrevisionId: string;
  moisCycle: number;
  sacsCalcules: number;
  sacsSaisis: number | null;
  quantiteKgCalculee: Decimal;
  coutCalculeFCFA: Decimal;
}

export interface VaguePrevuePourCalcul {
  id: string;
  code: string;
  dateStockagePrevue: Date;
  effectifAlevinsPrevu: number;
  poidsMoyenInitialG: Decimal;
  dureeCycleMoisFigee: number;
  statut: StatutVaguePrevue;
  vaguePrevueParentId: string | null;
  /** id de la Vague reelle liee (relation inverse Vague.vaguePrevueId), null si non realisee */
  vagueReelleId: string | null;
  /** false = production interne (cout d'achat gate a 0), true = alevins achetes (ERR-170) */
  alevinsAchetes: boolean;
  alimentsParMois: AlimentParVaguePrevuePourCalcul[];
}

export interface ChargeMensuellePourCalcul {
  id: string;
  posteId: string;
  moisAbsolu: number;
  montantFCFA: Decimal;
}

export interface PostePrevisionPourCalcul {
  id: string;
  libelle: string;
  type: TypePostePrevision;
  inclusBaseRepartition: boolean;
  ordre: number;
  /**
   * ADR-053 §16 (story A.4) — identite stable, site-scopee, resolue par
   * `resoudreCibleCleDuScenarioCourant` (`previsions-mapping-orphelins.ts`) pour retrouver, dans
   * le scenario courant, le PostePrevision dont `posteReferentielId` correspond au `cibleId`
   * (site-scope) d'un mapping `POSTE_PREVISION` — jamais l'inverse.
   */
  posteReferentielId: string;
  chargesMensuelles: ChargeMensuellePourCalcul[];
}

export interface JournalDepensePrevuePourCalcul {
  id: string;
  date: Date;
  libelle: string;
  categorie: CategorieJournalPrevu;
  montantFCFA: Decimal;
  vaguePrevueId: string | null;
}

export interface ApportCapitalPourCalcul {
  id: string;
  date: Date;
  libelle: string;
  montantFCFA: Decimal;
  type: TypeApportCapital;
}

export interface ScenarioPourCalcul {
  id: string;
  code: string;
  nom: string;
  dureeCycleMois: number;
  dateDebutPlan: Date;
  statut: StatutScenarioPrevision;
  parametres: ParametresPourCalcul;
  paliersRemise: PalierRemiseInput[];
  aliments: AlimentPrevisionPourCalcul[];
  vaguesPrevues: VaguePrevuePourCalcul[];
  postes: PostePrevisionPourCalcul[];
  journal: JournalDepensePrevuePourCalcul[];
  apports: ApportCapitalPourCalcul[];
}

/**
 * Charge un scenario complet et convertit chaque `Decimal` Prisma en
 * `Decimal` moteur (decimal.js) au passage — jamais l'inverse, jamais un
 * detour par `number` (cf. en-tete de fichier et `decimal-io.ts`).
 *
 * @throws {Error} si le scenario est introuvable pour ce site (R8), ou si
 *   ses ParametresPrevision (1-1 obligatoire, ADR-053 section 3.3) sont
 *   absents — un scenario sans parametres est un etat incoherent qui ne
 *   devrait jamais exister en pratique (creation transactionnelle,
 *   `createScenario`), mais reste explicitement garde ici plutot que de
 *   propager silencieusement un `undefined` jusqu'au moteur.
 */
export async function chargerScenarioPourMoteur(
  scenarioId: string,
  siteId: string
): Promise<ScenarioPourCalcul> {
  const scenario = await prisma.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    include: { parametres: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }
  if (!scenario.parametres) {
    throw new Error("Le scenario n'a pas de ParametresPrevision (etat incoherent)");
  }

  const [paliers, aliments, vaguesPrevues, postes, journal, apports] = await Promise.all([
    prisma.palierRemise.findMany({
      where: { scenarioId, siteId },
      orderBy: { ordre: "asc" },
    }),
    prisma.alimentPrevision.findMany({
      where: { scenarioId, siteId },
      include: {
        repartitions: { orderBy: { moisCycle: "asc" } },
      },
      orderBy: { ordre: "asc" },
    }),
    prisma.vaguePrevue.findMany({
      where: { scenarioId, siteId },
      include: {
        alimentsParMois: true,
        vague: { select: { id: true } },
      },
      orderBy: { dateStockagePrevue: "asc" },
    }),
    prisma.postePrevision.findMany({
      where: { scenarioId, siteId },
      include: { chargesMensuelles: { orderBy: { moisAbsolu: "asc" } } },
      orderBy: { ordre: "asc" },
    }),
    prisma.journalDepensePrevue.findMany({
      where: { scenarioId, siteId },
      orderBy: { date: "asc" },
    }),
    prisma.apportCapital.findMany({
      where: { scenarioId, siteId },
      orderBy: { date: "asc" },
    }),
  ]);

  const parametres = scenario.parametres;

  return {
    id: scenario.id,
    code: scenario.code,
    nom: scenario.nom,
    dureeCycleMois: scenario.dureeCycleMois,
    dateDebutPlan: scenario.dateDebutPlan,
    statut: scenario.statut as StatutScenarioPrevision,
    parametres: {
      effectifAlevinsParVague: parametres.effectifAlevinsParVague,
      margeSecuriteAlevinsPct: prismaDecimalToEngine(parametres.margeSecuriteAlevinsPct),
      tauxEpargnePct: prismaDecimalToEngine(parametres.tauxEpargnePct),
      poidsMoyenInitialG: prismaDecimalToEngine(parametres.poidsMoyenInitialG),
      poidsObjectifG: prismaDecimalToEngine(parametres.poidsObjectifG),
      prixAlevinUnitaireFCFA: prismaDecimalToEngine(parametres.prixAlevinUnitaireFCFA),
      prixVenteKgFCFA: prismaDecimalToEngine(parametres.prixVenteKgFCFA),
      nombreBacsSimultanesCible: parametres.nombreBacsSimultanesCible,
      frequenceStockageMois: prismaDecimalToEngine(parametres.frequenceStockageMois),
      transportAliments: {
        capacite: new Decimal(parametres.capaciteTransportAlimentsSacs),
        coutUnitaireFCFA: prismaDecimalToEngine(parametres.coutTransportAlimentsFCFA),
      },
      transportPoissons: {
        capacite: new Decimal(parametres.capaciteTransportPoissonsKg),
        coutUnitaireFCFA: prismaDecimalToEngine(parametres.coutTransportPoissonsFCFA),
      },
      transportAlevins: {
        capacite: new Decimal(parametres.capaciteTransportAlevinsNb),
        coutUnitaireFCFA: prismaDecimalToEngine(parametres.coutTransportAlevinsFCFA),
      },
      tresorerieInitialeFCFA: prismaDecimalToEngine(parametres.tresorerieInitialeFCFA),
    },
    paliersRemise: paliers.map((p) => ({
      ordre: p.ordre,
      seuilTonnes: prismaDecimalToEngine(p.seuilTonnes),
      pourcentageRemise: prismaDecimalToEngine(p.pourcentageRemise),
    })),
    aliments: aliments.map((a) => ({
      id: a.id,
      tailleGranule: a.tailleGranule as TailleGranule,
      sacsParTonneStandard: prismaDecimalToEngine(a.sacsParTonneStandard),
      ordre: a.ordre,
      repartitions: a.repartitions.map((r) => ({
        moisCycle: r.moisCycle,
        pourcentage: prismaDecimalToEngine(r.pourcentage),
      })),
      produitId: a.produitId,
      libelle: a.libelle,
      poidsSacKg: prismaDecimalToEngine(a.poidsSacKg),
      prixSacFCFA: prismaDecimalToEngine(a.prixSacFCFA),
      sacsParTonneUnitaire: prismaDecimalToEngine(a.sacsParTonneUnitaire),
    })),
    vaguesPrevues: vaguesPrevues.map((v) => ({
      id: v.id,
      code: v.code,
      dateStockagePrevue: v.dateStockagePrevue,
      effectifAlevinsPrevu: v.effectifAlevinsPrevu,
      poidsMoyenInitialG: prismaDecimalToEngine(v.poidsMoyenInitialG),
      dureeCycleMoisFigee: v.dureeCycleMoisFigee,
      statut: v.statut as StatutVaguePrevue,
      vaguePrevueParentId: v.vaguePrevueParentId,
      vagueReelleId: v.vague?.id ?? null,
      alevinsAchetes: v.alevinsAchetes,
      alimentsParMois: v.alimentsParMois.map((l) => ({
        id: l.id,
        alimentPrevisionId: l.alimentPrevisionId,
        moisCycle: l.moisCycle,
        sacsCalcules: l.sacsCalcules,
        sacsSaisis: l.sacsSaisis,
        quantiteKgCalculee: prismaDecimalToEngine(l.quantiteKgCalculee),
        coutCalculeFCFA: prismaDecimalToEngine(l.coutCalculeFCFA),
      })),
    })),
    postes: postes.map((p) => ({
      id: p.id,
      libelle: p.libelle,
      type: p.type as TypePostePrevision,
      inclusBaseRepartition: p.inclusBaseRepartition,
      ordre: p.ordre,
      posteReferentielId: p.posteReferentielId,
      chargesMensuelles: p.chargesMensuelles.map((c) => ({
        id: c.id,
        posteId: c.posteId,
        moisAbsolu: c.moisAbsolu,
        montantFCFA: prismaDecimalToEngine(c.montantFCFA),
      })),
    })),
    journal: journal.map((j) => ({
      id: j.id,
      date: j.date,
      libelle: j.libelle,
      categorie: j.categorie as CategorieJournalPrevu,
      montantFCFA: prismaDecimalToEngine(j.montantFCFA),
      vaguePrevueId: j.vaguePrevueId,
    })),
    apports: apports.map((a) => ({
      id: a.id,
      date: a.date,
      libelle: a.libelle,
      montantFCFA: prismaDecimalToEngine(a.montantFCFA),
      type: a.type as TypeApportCapital,
    })),
  };
}
