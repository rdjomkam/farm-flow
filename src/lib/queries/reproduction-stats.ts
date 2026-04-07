/**
 * Calcule le taux de survie global d'une chaine de reproduction.
 *
 * Chaine : Ponte (nombreOeufsEstime) -> Incubation (nombreLarvesViables) -> LotAlevins (nombreActuel, SORTI)
 *
 * Metriques retournees :
 * - tauxFecondation    : (pontes reussies / pontes totales) * 100
 * - tauxEclosion       : (somme larvesViables / somme oeufs totaux) * 100
 * - tauxSurvieLarvaire : (alevins sortis / larves viables) * 100
 * - tauxSurvieGlobal   : produit des trois etapes ci-dessus / 10000
 *
 * R8 : Toutes les requetes sont filtrees par siteId.
 */

import { prisma } from "@/lib/db";
import {
  StatutPonte,
  StatutLotAlevins,
  StatutIncubation,
  SexeReproducteur,
  StatutReproducteur,
  PhaseLot,
} from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface ReproductionStats {
  /** Nombre total de pontes dans la periode */
  totalPontes: number;
  /** Nombre de pontes reussies (statut TERMINEE) */
  pontesReussies: number;
  /** Taux de fecondation : pontesReussies / totalPontes * 100 */
  tauxFecondation: number;

  /** Somme des oeufs estimes sur toutes les pontes de la periode */
  totalOeufs: number;
  /** Somme des larves viables issues des incubations de la periode */
  totalLarvesViables: number;
  /** Taux d'eclosion : totalLarvesViables / totalOeufs * 100 */
  tauxEclosion: number;

  /** Nombre d'alevins toutes phases confondues (lots EN_ELEVAGE ou TRANSFERE) */
  totalAlevinsActuels: number;
  /** Taux de survie larvaire : totalAlevinsActuels / totalLarvesViables * 100 */
  tauxSurvieLarvaire: number;

  /**
   * Taux de survie global de la chaine :
   * tauxFecondation * tauxEclosion * tauxSurvieLarvaire / 10000
   * (division par 10000 car deux multiplications de pourcentages)
   */
  tauxSurvieGlobal: number;
}

export interface FunnelStep {
  etape: string;
  count: number;
  pourcentage: number;
}

// ---------------------------------------------------------------------------
// getReproductionStats
// ---------------------------------------------------------------------------

/**
 * Aggrege les donnees de la chaine de reproduction pour un site et une periode.
 *
 * @param siteId    - ID du site (R8)
 * @param dateDebut - Debut de la periode (optionnel)
 * @param dateFin   - Fin de la periode (optionnel)
 */
export async function getReproductionStats(
  siteId: string,
  dateDebut?: Date,
  dateFin?: Date
): Promise<ReproductionStats> {
  const datePonteFilter =
    dateDebut || dateFin
      ? {
          gte: dateDebut,
          lte: dateFin,
        }
      : undefined;

  // ------------------------------------------------------------------
  // 1. Pontes : total + reussies + somme des oeufs estimes
  // ------------------------------------------------------------------
  const pontes = await prisma.ponte.findMany({
    where: {
      siteId,
      ...(datePonteFilter ? { datePonte: datePonteFilter } : {}),
    },
    select: {
      statut: true,
      nombreOeufsEstime: true,
      nombreLarvesViables: true,
    },
  });

  const totalPontes = pontes.length;
  const pontesReussies = pontes.filter(
    (p) => p.statut === StatutPonte.TERMINEE
  ).length;
  const totalOeufsPontes = pontes.reduce(
    (acc, p) => acc + (p.nombreOeufsEstime ?? 0),
    0
  );
  // Larves viables issues des pontes (champ denormalise sur Ponte)
  const larvesViablesPontes = pontes.reduce(
    (acc, p) => acc + (p.nombreLarvesViables ?? 0),
    0
  );

  // ------------------------------------------------------------------
  // 2. Incubations : somme des larves viables (source autoritaire)
  //    On filtre les incubations liees aux pontes de la periode
  // ------------------------------------------------------------------
  const incubations = await prisma.incubation.findMany({
    where: {
      siteId,
      ...(datePonteFilter
        ? { ponte: { datePonte: datePonteFilter } }
        : {}),
    },
    select: {
      nombreOeufsPlaces: true,
      nombreLarvesViables: true,
    },
  });

  const totalOeufsIncubations = incubations.reduce(
    (acc, i) => acc + (i.nombreOeufsPlaces ?? 0),
    0
  );
  const totalLarvesViables = incubations.reduce(
    (acc, i) => acc + (i.nombreLarvesViables ?? 0),
    0
  );

  // Utiliser les oeufs des incubations en priorite, sinon ceux des pontes
  const totalOeufs =
    totalOeufsIncubations > 0 ? totalOeufsIncubations : totalOeufsPontes;

  // Si les incubations n'ont pas de larves viables, se replier sur les pontes
  const larvesViablesEffectives =
    totalLarvesViables > 0 ? totalLarvesViables : larvesViablesPontes;

  // ------------------------------------------------------------------
  // 3. LotAlevins : alevins survivants (EN_ELEVAGE ou TRANSFERE)
  // ------------------------------------------------------------------
  const lotsAlevins = await prisma.lotAlevins.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutLotAlevins.EN_ELEVAGE, StatutLotAlevins.TRANSFERE],
      },
      ...(datePonteFilter
        ? { ponte: { datePonte: datePonteFilter } }
        : {}),
    },
    select: {
      nombreActuel: true,
    },
  });

  const totalAlevinsActuels = lotsAlevins.reduce(
    (acc, lot) => acc + lot.nombreActuel,
    0
  );

  // ------------------------------------------------------------------
  // 4. Calcul des taux
  // ------------------------------------------------------------------
  const tauxFecondation =
    totalPontes > 0 ? (pontesReussies / totalPontes) * 100 : 0;

  const tauxEclosion =
    totalOeufs > 0 ? (larvesViablesEffectives / totalOeufs) * 100 : 0;

  const tauxSurvieLarvaire =
    larvesViablesEffectives > 0
      ? (totalAlevinsActuels / larvesViablesEffectives) * 100
      : 0;

  // Taux global : produit des 3 taux ramene a [0, 100]
  const tauxSurvieGlobal =
    (tauxFecondation * tauxEclosion * tauxSurvieLarvaire) / 10000;

  return {
    totalPontes,
    pontesReussies,
    tauxFecondation: Math.min(100, Math.round(tauxFecondation * 10) / 10),
    totalOeufs,
    totalLarvesViables: larvesViablesEffectives,
    tauxEclosion: Math.min(100, Math.round(tauxEclosion * 10) / 10),
    totalAlevinsActuels,
    tauxSurvieLarvaire: Math.min(100, Math.round(tauxSurvieLarvaire * 10) / 10),
    tauxSurvieGlobal: Math.min(100, Math.round(tauxSurvieGlobal * 10) / 10),
  };
}

// ---------------------------------------------------------------------------
// getReproductionFunnel
// ---------------------------------------------------------------------------

/**
 * Retourne les donnees du funnel de survie pour visualisation graphique.
 *
 * Chaque etape indique le nombre d'individus et le pourcentage par rapport
 * a l'etape precedente (sauf la premiere etape : 100%).
 *
 * Etapes :
 *   1. Oeufs          — totalOeufs
 *   2. Larves         — totalLarvesViables
 *   3. Alevins actifs — totalAlevinsActuels
 *
 * @param siteId    - ID du site (R8)
 * @param dateDebut - Debut de la periode (optionnel)
 * @param dateFin   - Fin de la periode (optionnel)
 */
export async function getReproductionFunnel(
  siteId: string,
  dateDebut?: Date,
  dateFin?: Date
): Promise<FunnelStep[]> {
  const stats = await getReproductionStats(siteId, dateDebut, dateFin);

  const etapes: FunnelStep[] = [
    {
      etape: "Oeufs",
      count: stats.totalOeufs,
      pourcentage: 100,
    },
    {
      etape: "Larves viables",
      count: stats.totalLarvesViables,
      pourcentage:
        stats.totalOeufs > 0
          ? Math.min(100, Math.round((stats.totalLarvesViables / stats.totalOeufs) * 1000) / 10)
          : 0,
    },
    {
      etape: "Alevins actifs",
      count: stats.totalAlevinsActuels,
      pourcentage:
        stats.totalLarvesViables > 0
          ? Math.min(
              100,
              Math.round(
                (stats.totalAlevinsActuels / stats.totalLarvesViables) * 1000
              ) / 10
            )
          : 0,
    },
  ];

  return etapes;
}

// ---------------------------------------------------------------------------
// Types publics — KPIs reproduction
// ---------------------------------------------------------------------------

export interface ProductionMensuellePoint {
  mois: string;
  pontes: number;
  alevins: number;
}

export interface ReproductionKpis {
  // Totaux periode
  totalPontes: number;
  totalPontesReussies: number;
  totalOeufs: number;
  totalLarvesViables: number;
  totalAlevinsActifs: number;
  totalAlevinsSortis: number;

  // Taux
  tauxFecondation: number;
  tauxEclosion: number;
  tauxSurvieLarvaire: number;
  tauxSurvieGlobal: number;

  // Geniteurs
  totalFemelles: number;
  totalMales: number;
  femellesActives: number;

  // Lots
  lotsEnCours: number;
  lotsTransferes: number;
  lotsPerdus: number;

  // Production mensuelle (6 derniers mois)
  productionMensuelle: ProductionMensuellePoint[];
}

export interface PhaseLotKpi {
  phase: PhaseLot;
  count: number;
  totalPoissons: number;
}

export interface PhaseDuree {
  phase: PhaseLot;
  dureeJours: number;
}

export interface ReproductionLotsKpis {
  parPhase: PhaseLotKpi[];
  phaseMoyenneDureeJours: PhaseDuree[];
}

export interface PontePlanifiee {
  id: string;
  code: string;
  dateDebut: Date;
  dateFin: Date | null;
  statut: string;
  femelle: { id: string; code: string } | null;
}

export interface IncubationEnCours {
  id: string;
  code: string;
  dateDebut: Date;
  dateEclosionPrevue: Date | null;
  statut: string;
}

export interface LotEnElevage {
  id: string;
  code: string;
  phase: PhaseLot;
  dateDebutPhase: Date;
  ageJours: number;
  nombreActuel: number;
}

export interface EclosionPrevue {
  incubationId: string;
  code: string;
  dateEclosionPrevue: Date;
}

export interface ReproductionPlanningEvents {
  pontesPlanifiees: PontePlanifiee[];
  incubationsEnCours: IncubationEnCours[];
  lotsEnElevage: LotEnElevage[];
  eclosionsPrevues: EclosionPrevue[];
}

// ---------------------------------------------------------------------------
// getReproductionKpis
// ---------------------------------------------------------------------------

/**
 * Retourne un objet KPI complet pour le module de reproduction.
 *
 * @param siteId    - ID du site (R8)
 * @param dateDebut - Debut de la periode (optionnel)
 * @param dateFin   - Fin de la periode (optionnel)
 */
export async function getReproductionKpis(
  siteId: string,
  dateDebut?: Date,
  dateFin?: Date
): Promise<ReproductionKpis> {
  const datePonteFilter =
    dateDebut || dateFin
      ? {
          gte: dateDebut,
          lte: dateFin,
        }
      : undefined;

  // ------------------------------------------------------------------
  // 1. Pontes + oeufs + larves
  // ------------------------------------------------------------------
  const pontes = await prisma.ponte.findMany({
    where: {
      siteId,
      ...(datePonteFilter ? { datePonte: datePonteFilter } : {}),
    },
    select: {
      id: true,
      statut: true,
      nombreOeufsEstime: true,
      nombreLarvesViables: true,
      datePonte: true,
    },
  });

  const totalPontes = pontes.length;
  const totalPontesReussies = pontes.filter(
    (p) => p.statut === StatutPonte.TERMINEE
  ).length;
  const totalOeufsPontes = pontes.reduce(
    (acc, p) => acc + (p.nombreOeufsEstime ?? 0),
    0
  );
  const larvesViablesPontes = pontes.reduce(
    (acc, p) => acc + (p.nombreLarvesViables ?? 0),
    0
  );

  // ------------------------------------------------------------------
  // 2. Incubations pour larves viables (source autoritaire)
  // ------------------------------------------------------------------
  const incubations = await prisma.incubation.findMany({
    where: {
      siteId,
      ...(datePonteFilter ? { ponte: { datePonte: datePonteFilter } } : {}),
    },
    select: {
      nombreOeufsPlaces: true,
      nombreLarvesViables: true,
    },
  });

  const totalOeufsIncubations = incubations.reduce(
    (acc, i) => acc + (i.nombreOeufsPlaces ?? 0),
    0
  );
  const totalLarvesViablesIncubations = incubations.reduce(
    (acc, i) => acc + (i.nombreLarvesViables ?? 0),
    0
  );

  const totalOeufs =
    totalOeufsIncubations > 0 ? totalOeufsIncubations : totalOeufsPontes;
  const totalLarvesViables =
    totalLarvesViablesIncubations > 0
      ? totalLarvesViablesIncubations
      : larvesViablesPontes;

  // ------------------------------------------------------------------
  // 3. Lots alevins
  // ------------------------------------------------------------------
  const lotsActifs = await prisma.lotAlevins.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutLotAlevins.EN_ELEVAGE, StatutLotAlevins.TRANSFERE],
      },
      ...(datePonteFilter
        ? { ponte: { datePonte: datePonteFilter } }
        : {}),
    },
    select: { nombreActuel: true, statut: true },
  });

  const totalAlevinsActifs = lotsActifs
    .filter((l) => l.statut === StatutLotAlevins.EN_ELEVAGE)
    .reduce((acc, l) => acc + l.nombreActuel, 0);

  const totalAlevinsSortis = lotsActifs
    .filter((l) => l.statut === StatutLotAlevins.TRANSFERE)
    .reduce((acc, l) => acc + l.nombreActuel, 0);

  // Counts par statut (pas filtre par date)
  const [lotsEnCoursCount, lotsTransferesCount, lotsPerdusCount] =
    await Promise.all([
      prisma.lotAlevins.count({
        where: { siteId, statut: StatutLotAlevins.EN_ELEVAGE },
      }),
      prisma.lotAlevins.count({
        where: { siteId, statut: StatutLotAlevins.TRANSFERE },
      }),
      prisma.lotAlevins.count({
        where: { siteId, statut: StatutLotAlevins.PERDU },
      }),
    ]);

  // ------------------------------------------------------------------
  // 4. Geniteurs
  // ------------------------------------------------------------------
  const [totalFemelles, totalMales] = await Promise.all([
    prisma.reproducteur.count({
      where: { siteId, sexe: SexeReproducteur.FEMELLE },
    }),
    prisma.reproducteur.count({
      where: { siteId, sexe: SexeReproducteur.MALE },
    }),
  ]);

  // Femelles actives : dernierePonte dans les 90 derniers jours
  const dateSeuilActivite = new Date();
  dateSeuilActivite.setDate(dateSeuilActivite.getDate() - 90);

  const femellesActives = await prisma.reproducteur.count({
    where: {
      siteId,
      sexe: SexeReproducteur.FEMELLE,
      statut: StatutReproducteur.ACTIF,
      dernierePonte: { gte: dateSeuilActivite },
    },
  });

  // ------------------------------------------------------------------
  // 5. Calcul des taux
  // ------------------------------------------------------------------
  const tauxFecondation =
    totalPontes > 0 ? (totalPontesReussies / totalPontes) * 100 : 0;

  const tauxEclosion =
    totalOeufs > 0 ? (totalLarvesViables / totalOeufs) * 100 : 0;

  const allAlevins = totalAlevinsActifs + totalAlevinsSortis;
  const tauxSurvieLarvaire =
    totalLarvesViables > 0 ? (allAlevins / totalLarvesViables) * 100 : 0;

  const tauxSurvieGlobal =
    (tauxFecondation * tauxEclosion * tauxSurvieLarvaire) / 10000;

  // ------------------------------------------------------------------
  // 6. Production mensuelle (6 derniers mois)
  // ------------------------------------------------------------------
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const pontesRecentes = await prisma.ponte.findMany({
    where: {
      siteId,
      datePonte: { gte: sixMonthsAgo },
    },
    select: { datePonte: true, lots: { select: { nombreActuel: true } } },
  });

  // Construire un map par "YYYY-MM"
  const monthlyMap: Record<string, { pontes: number; alevins: number }> = {};

  // Initialiser les 6 derniers mois
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = { pontes: 0, alevins: 0 };
  }

  for (const p of pontesRecentes) {
    const key = `${p.datePonte.getFullYear()}-${String(
      p.datePonte.getMonth() + 1
    ).padStart(2, "0")}`;
    if (monthlyMap[key]) {
      monthlyMap[key].pontes += 1;
      monthlyMap[key].alevins += p.lots.reduce(
        (acc, l) => acc + l.nombreActuel,
        0
      );
    }
  }

  const productionMensuelle: ProductionMensuellePoint[] = Object.entries(
    monthlyMap
  ).map(([mois, data]) => ({ mois, ...data }));

  return {
    totalPontes,
    totalPontesReussies,
    totalOeufs,
    totalLarvesViables,
    totalAlevinsActifs,
    totalAlevinsSortis,
    tauxFecondation: Math.min(100, Math.round(tauxFecondation * 10) / 10),
    tauxEclosion: Math.min(100, Math.round(tauxEclosion * 10) / 10),
    tauxSurvieLarvaire: Math.min(
      100,
      Math.round(tauxSurvieLarvaire * 10) / 10
    ),
    tauxSurvieGlobal: Math.min(100, Math.round(tauxSurvieGlobal * 10) / 10),
    totalFemelles,
    totalMales,
    femellesActives,
    lotsEnCours: lotsEnCoursCount,
    lotsTransferes: lotsTransferesCount,
    lotsPerdus: lotsPerdusCount,
    productionMensuelle,
  };
}

// ---------------------------------------------------------------------------
// getReproductionLotsKpis
// ---------------------------------------------------------------------------

/**
 * Retourne une decomposition par phase des lots d'alevins actifs.
 *
 * @param siteId - ID du site (R8)
 */
export async function getReproductionLotsKpis(
  siteId: string
): Promise<ReproductionLotsKpis> {
  const lots = await prisma.lotAlevins.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutLotAlevins.EN_ELEVAGE, StatutLotAlevins.EN_INCUBATION],
      },
    },
    select: {
      phase: true,
      nombreActuel: true,
      dateDebutPhase: true,
    },
  });

  // Grouper par phase
  const phaseMap: Record<
    string,
    { count: number; totalPoissons: number; totalDuree: number }
  > = {};

  const now = new Date();

  for (const lot of lots) {
    const key = lot.phase as string;
    if (!phaseMap[key]) {
      phaseMap[key] = { count: 0, totalPoissons: 0, totalDuree: 0 };
    }
    phaseMap[key].count += 1;
    phaseMap[key].totalPoissons += lot.nombreActuel;
    const dureeMs = now.getTime() - lot.dateDebutPhase.getTime();
    const dureeJours = Math.floor(dureeMs / (1000 * 60 * 60 * 24));
    phaseMap[key].totalDuree += dureeJours;
  }

  const parPhase: PhaseLotKpi[] = Object.entries(phaseMap).map(
    ([phase, data]) => ({
      phase: phase as PhaseLot,
      count: data.count,
      totalPoissons: data.totalPoissons,
    })
  );

  const phaseMoyenneDureeJours: PhaseDuree[] = Object.entries(phaseMap).map(
    ([phase, data]) => ({
      phase: phase as PhaseLot,
      dureeJours:
        data.count > 0 ? Math.round(data.totalDuree / data.count) : 0,
    })
  );

  return { parPhase, phaseMoyenneDureeJours };
}

// ---------------------------------------------------------------------------
// getReproductionPlanningEvents
// ---------------------------------------------------------------------------

/**
 * Retourne les evenements de planning pour la periode donnee.
 *
 * @param siteId    - ID du site (R8)
 * @param dateDebut - Debut de la periode (requis)
 * @param dateFin   - Fin de la periode (requis)
 */
export async function getReproductionPlanningEvents(
  siteId: string,
  dateDebut: Date,
  dateFin: Date
): Promise<ReproductionPlanningEvents> {
  const dateFilter = { gte: dateDebut, lte: dateFin };

  // ------------------------------------------------------------------
  // 1. Pontes dans la periode (filtree sur datePonte)
  // ------------------------------------------------------------------
  const pontesRaw = await prisma.ponte.findMany({
    where: {
      siteId,
      datePonte: dateFilter,
    },
    select: {
      id: true,
      code: true,
      datePonte: true,
      statut: true,
      femelle: { select: { id: true, code: true } },
    },
    orderBy: { datePonte: "asc" },
  });

  const pontesPlanifiees: PontePlanifiee[] = pontesRaw.map((p) => ({
    id: p.id,
    code: p.code,
    dateDebut: p.datePonte,
    dateFin: null,
    statut: p.statut,
    femelle: p.femelle ? { id: p.femelle.id, code: p.femelle.code } : null,
  }));

  // ------------------------------------------------------------------
  // 2. Incubations en cours ou en eclosion
  // ------------------------------------------------------------------
  const incubationsRaw = await prisma.incubation.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutIncubation.EN_COURS, StatutIncubation.ECLOSION_EN_COURS],
      },
    },
    select: {
      id: true,
      code: true,
      dateDebutIncubation: true,
      dateEclosionPrevue: true,
      statut: true,
    },
    orderBy: { dateDebutIncubation: "asc" },
  });

  const incubationsEnCours: IncubationEnCours[] = incubationsRaw.map((i) => ({
    id: i.id,
    code: i.code,
    dateDebut: i.dateDebutIncubation,
    dateEclosionPrevue: i.dateEclosionPrevue,
    statut: i.statut,
  }));

  // ------------------------------------------------------------------
  // 3. Lots en elevage ou en incubation
  // ------------------------------------------------------------------
  const lotsRaw = await prisma.lotAlevins.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutLotAlevins.EN_ELEVAGE, StatutLotAlevins.EN_INCUBATION],
      },
    },
    select: {
      id: true,
      code: true,
      phase: true,
      dateDebutPhase: true,
      ageJours: true,
      nombreActuel: true,
    },
    orderBy: { dateDebutPhase: "asc" },
  });

  const lotsEnElevage: LotEnElevage[] = lotsRaw.map((l) => ({
    id: l.id,
    code: l.code,
    phase: l.phase,
    dateDebutPhase: l.dateDebutPhase,
    ageJours: l.ageJours,
    nombreActuel: l.nombreActuel,
  }));

  // ------------------------------------------------------------------
  // 4. Eclosions prevues dans la periode
  // ------------------------------------------------------------------
  const eclosionsRaw = await prisma.incubation.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutIncubation.EN_COURS, StatutIncubation.ECLOSION_EN_COURS],
      },
      dateEclosionPrevue: dateFilter,
    },
    select: {
      id: true,
      code: true,
      dateEclosionPrevue: true,
    },
    orderBy: { dateEclosionPrevue: "asc" },
  });

  const eclosionsPrevues: EclosionPrevue[] = eclosionsRaw
    .filter((e) => e.dateEclosionPrevue !== null)
    .map((e) => ({
      incubationId: e.id,
      code: e.code,
      dateEclosionPrevue: e.dateEclosionPrevue as Date,
    }));

  return {
    pontesPlanifiees,
    incubationsEnCours,
    lotsEnElevage,
    eclosionsPrevues,
  };
}
