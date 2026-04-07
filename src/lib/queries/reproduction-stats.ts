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
import { StatutPonte, StatutLotAlevins } from "@/generated/prisma/enums";

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
