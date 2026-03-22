/**
 * admin-analytics.ts — Queries analytics plateforme (ADR-021, Story D.1).
 *
 * Ces fonctions sont reservees aux super-admins (isSuperAdmin = true, ADR-022).
 * Acces via requireSuperAdmin() dans les routes /api/backoffice/analytics/*.
 *
 * R2 : enums importes depuis @/types.
 * R4 : agregations en SQL ou groupBy — pas de check-then-update.
 * R8 : siteId non applicable ici (analytics globales plateforme).
 */

import { prisma } from "@/lib/db";
import {
  StatutAbonnement,
  StatutPaiementAbo,
  PeriodeFacturation,
  SiteModule,
  Role,
  TypePlan,
} from "@/types";
import type { AdminAnalyticsResponse, AdminAnalyticsSitesResponse } from "@/types";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Convertit un nombre Decimal Prisma (ou null) en number JS. */
function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "object" && val !== null && "toNumber" in (val as object)
    ? (val as { toNumber(): number }).toNumber()
    : Number(val);
}

/** Retourne la date de debut selon la periode. */
function periodStart(period: "7d" | "30d" | "90d" | "12m"): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "12m":
      return new Date(
        new Date().setMonth(new Date().getMonth() - 12)
      );
  }
}

// ---------------------------------------------------------------------------
// 1. getPlatformKPIs — KPIs globaux plateforme
// ---------------------------------------------------------------------------

/**
 * Retourne les KPIs consolides de toute la plateforme DKFarm.
 *
 * MRR = SUM(prixMensuel for MENSUEL) + SUM(prixTrimestriel/3 for TRIMESTRIEL)
 *       + SUM(prixAnnuel/12 for ANNUEL)
 * Uniquement les abonnements avec statut ACTIF.
 *
 * totalRevenue = somme des PaiementAbonnement CONFIRME (tous temps).
 */
export async function getPlatformKPIs(): Promise<AdminAnalyticsResponse> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 12));

  // Paralleliser toutes les queries independantes
  const [
    sitesActifs,
    sitesSuspendus,
    sitesBlockes,
    sitesCrees30j,
    abonnementsActifs,
    abonnementsGrace,
    abonnementsExpires,
    abonnementsParPlanRaw,
    abonnementsActifsAvecPlan,
    revenusTotal30j,
    revenusTotal12m,
    ingenieursActifs,
    commissionsEnAttente,
  ] = await Promise.all([
    // Sites actifs
    prisma.site.count({
      where: { isActive: true, suspendedAt: null, deletedAt: null },
    }),
    // Sites suspendus
    prisma.site.count({
      where: { suspendedAt: { not: null }, deletedAt: null },
    }),
    // Sites bloques
    prisma.site.count({
      where: { isActive: false, suspendedAt: null, deletedAt: null },
    }),
    // Sites crees dans les 30 derniers jours (non archives)
    prisma.site.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
    }),
    // Abonnements actifs
    prisma.abonnement.count({
      where: { statut: StatutAbonnement.ACTIF },
    }),
    // Abonnements en grace
    prisma.abonnement.count({
      where: { statut: StatutAbonnement.EN_GRACE },
    }),
    // Abonnements expires ou annules
    prisma.abonnement.count({
      where: { statut: { in: [StatutAbonnement.ANNULE, StatutAbonnement.SUSPENDU] } },
    }),
    // Abonnements par type de plan (actifs + grace)
    prisma.abonnement.groupBy({
      by: ["planId"],
      where: {
        statut: { in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE] },
      },
      _count: { id: true },
    }),
    // Abonnements ACTIF avec plan pour calculer le MRR
    prisma.abonnement.findMany({
      where: { statut: StatutAbonnement.ACTIF },
      select: {
        periode: true,
        plan: {
          select: {
            prixMensuel: true,
            prixTrimestriel: true,
            prixAnnuel: true,
          },
        },
      },
    }),
    // Revenus confirmes sur 30 jours
    prisma.paiementAbonnement.aggregate({
      where: {
        statut: StatutPaiementAbo.CONFIRME,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { montant: true },
    }),
    // Revenus confirmes sur 12 mois
    prisma.paiementAbonnement.aggregate({
      where: {
        statut: StatutPaiementAbo.CONFIRME,
        createdAt: { gte: twelveMonthsAgo },
      },
      _sum: { montant: true },
    }),
    // Ingenieurs actifs (utilisateurs avec role INGENIEUR)
    prisma.user.count({
      where: { role: Role.INGENIEUR },
    }),
    // Retraits portefeuille en attente
    prisma.retraitPortefeuille.count({
      where: { statut: StatutPaiementAbo.EN_ATTENTE },
    }),
  ]);

  // ── MRR calcule cote TypeScript ─────────────────────────────────────────
  let mrrEstime = 0;
  for (const abo of abonnementsActifsAvecPlan) {
    const plan = abo.plan;
    if (abo.periode === PeriodeFacturation.MENSUEL && plan.prixMensuel) {
      mrrEstime += toNumber(plan.prixMensuel);
    } else if (abo.periode === PeriodeFacturation.TRIMESTRIEL && plan.prixTrimestriel) {
      mrrEstime += toNumber(plan.prixTrimestriel) / 3;
    } else if (abo.periode === PeriodeFacturation.ANNUEL && plan.prixAnnuel) {
      mrrEstime += toNumber(plan.prixAnnuel) / 12;
    }
  }

  // ── abonnementsParPlan — joindre le typePlan via planIds ─────────────────
  const planIds = abonnementsParPlanRaw.map((r) => r.planId);
  const plans = await prisma.planAbonnement.findMany({
    where: { id: { in: planIds } },
    select: { id: true, typePlan: true },
  });
  const planMap = new Map(plans.map((p) => [p.id, p.typePlan]));

  const abonnementsParPlan = abonnementsParPlanRaw.map((r) => ({
    typePlan: (planMap.get(r.planId) ?? TypePlan.DECOUVERTE) as TypePlan,
    count: r._count.id,
  }));

  // ── Ingenieurs avec au moins un client supervise ──────────────────────────
  const ingenieursAvecClientsRaw = await prisma.commissionIngenieur.groupBy({
    by: ["ingenieurId"],
    _count: { ingenieurId: true },
  });
  const ingenieursAvecClients = ingenieursAvecClientsRaw.length;

  // ── Distribution des modules via $queryRaw avec PostgreSQL unnest() ───────
  const modulesRaw = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
    SELECT unnest("enabledModules") as module, COUNT(*) as count
    FROM "Site"
    WHERE "deletedAt" IS NULL
    GROUP BY module
    ORDER BY count DESC
  `;

  const totalSitesForModules = sitesActifs + sitesSuspendus + sitesBlockes;

  const modulesDistribution = modulesRaw.map((row) => ({
    module: row.module as SiteModule,
    siteCount: Number(row.count),
    pourcentage:
      totalSitesForModules > 0
        ? Math.round((Number(row.count) / totalSitesForModules) * 100)
        : 0,
  }));

  return {
    sitesActifs,
    sitesSuspendus,
    sitesBlockes,
    sitesCrees30j,
    abonnementsActifs,
    abonnementsGrace,
    abonnementsExpires,
    abonnementsParPlan,
    mrrEstime: Math.round(mrrEstime),
    revenusTotal30j: toNumber(revenusTotal30j._sum.montant),
    revenusTotal12m: toNumber(revenusTotal12m._sum.montant),
    ingenieursActifs,
    ingenieursAvecClients,
    commissionsEnAttente,
    modulesDistribution,
  };
}

// ---------------------------------------------------------------------------
// 2. getSitesGrowth — evolution du nombre de sites dans le temps
// ---------------------------------------------------------------------------

/**
 * Retourne l'evolution du nombre de sites dans le temps.
 *
 * Pour 7d/30d/90d : groupe par jour.
 * Pour 12m : groupe par mois.
 *
 * Chaque point contient :
 * - date : ISO date (YYYY-MM-DD)
 * - cumul : total cumulatif de sites non-archives a cette date
 * - nouveaux : sites crees ce jour/mois
 */
export async function getSitesGrowth(
  period: "7d" | "30d" | "90d" | "12m"
): Promise<AdminAnalyticsSitesResponse> {
  const start = periodStart(period);
  const groupByMonth = period === "12m";

  let points: { date: string; cumul: number; nouveaux: number }[];

  if (groupByMonth) {
    // Groupe par mois — SQL via $queryRaw
    const rows = await prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT
        DATE_TRUNC('month', "createdAt") AS month,
        COUNT(*) AS count
      FROM "Site"
      WHERE "createdAt" >= ${start}
        AND "deletedAt" IS NULL
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `;

    // Calculer le cumulatif a partir du total de sites avant la periode
    const baseCount = await prisma.site.count({
      where: {
        createdAt: { lt: start },
        deletedAt: null,
      },
    });

    let runningTotal = baseCount;
    points = rows.map((row) => {
      const nouveaux = Number(row.count);
      runningTotal += nouveaux;
      return {
        date: new Date(row.month).toISOString().slice(0, 10),
        cumul: runningTotal,
        nouveaux,
      };
    });
  } else {
    // Groupe par jour
    const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        COUNT(*) AS count
      FROM "Site"
      WHERE "createdAt" >= ${start}
        AND "deletedAt" IS NULL
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `;

    // Base cumulative avant la periode
    const baseCount = await prisma.site.count({
      where: {
        createdAt: { lt: start },
        deletedAt: null,
      },
    });

    let runningTotal = baseCount;
    points = rows.map((row) => {
      const nouveaux = Number(row.count);
      runningTotal += nouveaux;
      return {
        date: new Date(row.day).toISOString().slice(0, 10),
        cumul: runningTotal,
        nouveaux,
      };
    });
  }

  return { points, periode: period };
}

// ---------------------------------------------------------------------------
// 3. getRevenueAnalytics — revenus mensuels par periode
// ---------------------------------------------------------------------------

/**
 * Retourne la decomposition mensuelle des revenus confirmes.
 *
 * Chaque point : { date (YYYY-MM), montant }
 * Uniquement les PaiementAbonnement avec statut CONFIRME.
 */
export async function getRevenueAnalytics(period: "7d" | "30d" | "90d" | "12m"): Promise<{
  points: { date: string; montant: number }[];
  periode: "7d" | "30d" | "90d" | "12m";
  total: number;
}> {
  const start = periodStart(period);
  const groupByMonth = period === "12m" || period === "90d";

  let points: { date: string; montant: number }[];

  if (groupByMonth) {
    const rows = await prisma.$queryRaw<{ month: Date; total: unknown }[]>`
      SELECT
        DATE_TRUNC('month', "createdAt") AS month,
        SUM("montant") AS total
      FROM "PaiementAbonnement"
      WHERE "statut" = 'CONFIRME'
        AND "createdAt" >= ${start}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `;

    points = rows.map((row) => ({
      date: new Date(row.month).toISOString().slice(0, 7),
      montant: toNumber(row.total),
    }));
  } else {
    const rows = await prisma.$queryRaw<{ day: Date; total: unknown }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        SUM("montant") AS total
      FROM "PaiementAbonnement"
      WHERE "statut" = 'CONFIRME'
        AND "createdAt" >= ${start}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `;

    points = rows.map((row) => ({
      date: new Date(row.day).toISOString().slice(0, 10),
      montant: toNumber(row.total),
    }));
  }

  const total = points.reduce((sum, p) => sum + p.montant, 0);

  return { points, periode: period, total };
}

// ---------------------------------------------------------------------------
// 4. getModulesDistribution — distribution des modules via unnest()
// ---------------------------------------------------------------------------

/**
 * Compte combien de sites ont chaque module active.
 *
 * Utilise PostgreSQL unnest() sur le tableau enabledModules pour eviter
 * de charger tous les sites en memoire.
 *
 * Retourne uniquement les sites non-archives (deletedAt IS NULL).
 */
export async function getModulesDistribution(): Promise<
  { module: SiteModule; count: number }[]
> {
  const rows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
    SELECT unnest("enabledModules") as module, COUNT(*) as count
    FROM "Site"
    WHERE "deletedAt" IS NULL
    GROUP BY module
    ORDER BY count DESC
  `;

  return rows.map((row) => ({
    module: row.module as SiteModule,
    count: Number(row.count),
  }));
}
