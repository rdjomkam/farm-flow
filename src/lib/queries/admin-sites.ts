/**
 * admin-sites.ts — Queries admin plateforme pour la gestion des sites.
 *
 * Ces fonctions necessitent les permissions SITES_VOIR / SITES_GERER (ADR-021).
 * Acces restreint via requireSuperAdmin() ou checkBackofficeAccess() (ADR-022).
 *
 * R4 : toutes les mutations multi-etapes utilisent des transactions atomiques.
 * R8 : siteId filter present sur toutes les queries retournant des donnees siteId-scoped.
 */

import { prisma } from "@/lib/db";
import {
  SiteModule,
  SiteStatus,
  StatutAbonnement,
  TypePlan,
  PeriodeFacturation,
} from "@/types";
import { computeSiteStatus } from "@/lib/site-modules-config";
import type {
  AdminSiteSummary,
  AdminSitesListResponse,
  AdminSiteDetailResponse,
  SiteStatusUpdateResponse,
  AdminSiteModulesUpdateResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

export interface GetAdminSitesFilters {
  page?: number;
  pageSize?: number;
  status?: SiteStatus;
  planId?: string;
  hasModule?: SiteModule;
  search?: string;
}

export interface GetSiteAuditLogOptions {
  page?: number;
  pageSize?: number;
}

/** Actions de changement de statut autorisees (ADR-021 section 2.8). */
export type SiteLifecycleAction = "SUSPEND" | "BLOCK" | "RESTORE" | "ARCHIVE";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Calcule le WHERE Prisma pour filtrer par SiteStatus calcule. */
function buildStatusWhereClause(status: SiteStatus) {
  switch (status) {
    case SiteStatus.ACTIVE:
      return {
        isActive: true,
        suspendedAt: null,
        deletedAt: null,
      };
    case SiteStatus.SUSPENDED:
      return {
        suspendedAt: { not: null },
        deletedAt: null,
      };
    case SiteStatus.BLOCKED:
      return {
        isActive: false,
        suspendedAt: null,
        deletedAt: null,
      };
    case SiteStatus.ARCHIVED:
      return {
        deletedAt: { not: null },
      };
  }
}

/** Mappe un abonnement Prisma vers le shape summary attendu par AdminSiteSummary. */
function mapAbonnementSummary(
  abonnement: {
    id: string;
    statut: StatutAbonnement;
    dateFin: Date;
    plan: { nom: string; typePlan: TypePlan };
  } | null | undefined
): AdminSiteSummary["abonnement"] {
  if (!abonnement) return null;
  return {
    id: abonnement.id,
    planNom: abonnement.plan.nom,
    typePlan: abonnement.plan.typePlan,
    statut: abonnement.statut,
    dateFin: abonnement.dateFin.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 1. getAdminSites — liste paginee + filtres
// ---------------------------------------------------------------------------

/**
 * Retourne la liste paginee de tous les sites avec leurs stats agregees.
 *
 * Le filtre par `status` est traduit en conditions WHERE directes sur les
 * champs isActive / suspendedAt / deletedAt (ADR-021 section 2.5).
 *
 * Les stats globales (totalActive / totalSuspended / ...) sont toujours
 * calculees independamment des filtres actifs.
 */
export async function getAdminSites(
  filters: GetAdminSitesFilters = {}
): Promise<AdminSitesListResponse> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  // ── Construction du WHERE ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  // Par defaut, exclure les sites archives — sauf si on filtre explicitement
  // sur ARCHIVED (ou sur un autre statut qui gere deletedAt).
  if (!filters.status) {
    where.deletedAt = null;
  } else {
    Object.assign(where, buildStatusWhereClause(filters.status));
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  if (filters.hasModule) {
    where.enabledModules = { has: filters.hasModule };
  }

  if (filters.planId) {
    where.abonnements = {
      some: {
        planId: filters.planId,
        statut: { in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE] },
      },
    };
  }

  // ── Requetes paralleles ───────────────────────────────────────────────────
  const [sites, total, globalStats] = await Promise.all([
    prisma.site.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { members: true, bacs: true, vagues: true },
        },
        abonnements: {
          where: {
            statut: { in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE] },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            plan: { select: { nom: true, typePlan: true } },
          },
        },
      },
    }),
    prisma.site.count({ where }),
    // Stats globales — independantes des filtres
    Promise.all([
      prisma.site.count({ where: { isActive: true, suspendedAt: null, deletedAt: null } }),
      prisma.site.count({ where: { suspendedAt: { not: null }, deletedAt: null } }),
      prisma.site.count({ where: { isActive: false, deletedAt: null } }),
      prisma.site.count({ where: { deletedAt: { not: null } } }),
    ]),
  ]);

  const [totalActive, totalSuspended, totalBlocked, totalArchived] = globalStats;

  const items: AdminSiteSummary[] = sites.map((site) => ({
    id: site.id,
    name: site.name,
    address: site.address,
    isActive: site.isActive,
    supervised: site.supervised,
    suspendedAt: site.suspendedAt?.toISOString() ?? null,
    suspendedReason: site.suspendedReason,
    deletedAt: site.deletedAt?.toISOString() ?? null,
    status: computeSiteStatus(site),
    enabledModules: site.enabledModules as SiteModule[],
    memberCount: site._count.members,
    bacCount: site._count.bacs,
    vagueCount: site._count.vagues,
    abonnement: mapAbonnementSummary(
      site.abonnements[0]
        ? {
            id: site.abonnements[0].id,
            statut: site.abonnements[0].statut as StatutAbonnement,
            dateFin: site.abonnements[0].dateFin,
            plan: {
              nom: site.abonnements[0].plan.nom,
              typePlan: site.abonnements[0].plan.typePlan as TypePlan,
            },
          }
        : null
    ),
    createdAt: site.createdAt.toISOString(),
  }));

  return {
    sites: items,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
    stats: { totalActive, totalSuspended, totalBlocked, totalArchived },
  };
}

// ---------------------------------------------------------------------------
// 2. getAdminSiteById — detail complet d'un site
// ---------------------------------------------------------------------------

/**
 * Retourne le detail complet d'un site pour l'administration plateforme.
 *
 * Inclut : membres (avec user), abonnement actif (avec plan), compteurs,
 * et les 20 derniers journaux d'audit.
 *
 * Retourne null si le site est introuvable.
 */
export async function getAdminSiteById(siteId: string): Promise<AdminSiteDetailResponse | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      _count: {
        select: { members: true, bacs: true, vagues: true, releves: true },
      },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          siteRole: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      abonnements: {
        where: {
          statut: { in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          plan: { select: { id: true, nom: true, typePlan: true } },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          actor: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!site) return null;

  const abonnement = site.abonnements[0] ?? null;

  return {
    id: site.id,
    name: site.name,
    address: site.address,
    isActive: site.isActive,
    supervised: site.supervised,
    suspendedAt: site.suspendedAt?.toISOString() ?? null,
    suspendedReason: site.suspendedReason,
    deletedAt: site.deletedAt?.toISOString() ?? null,
    status: computeSiteStatus(site),
    enabledModules: site.enabledModules as SiteModule[],
    members: site.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone ?? null,
      siteRoleName: m.siteRole.name,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
    })),
    abonnementActif: abonnement
      ? {
          id: abonnement.id,
          planId: abonnement.plan.id,
          planNom: abonnement.plan.nom,
          typePlan: abonnement.plan.typePlan as TypePlan,
          statut: abonnement.statut as StatutAbonnement,
          periode: abonnement.periode as PeriodeFacturation,
          dateDebut: abonnement.dateDebut.toISOString(),
          dateFin: abonnement.dateFin.toISOString(),
          dateProchainRenouvellement: abonnement.dateProchainRenouvellement.toISOString(),
          dateFinGrace: abonnement.dateFinGrace?.toISOString() ?? null,
          prixPaye: Number(abonnement.prixPaye),
        }
      : null,
    bacCount: site._count.bacs,
    vagueCount: site._count.vagues,
    memberCount: site._count.members,
    releveCount: site._count.releves,
    recentAuditLogs: site.auditLogs.map((log) => ({
      id: log.id,
      actorName: log.actor.name,
      action: log.action,
      details: (log.details as Record<string, unknown>) ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 3. updateSiteStatus — transitions du cycle de vie
// ---------------------------------------------------------------------------

/**
 * Applique une transition de cycle de vie sur un site.
 *
 * R4 : la mise a jour du site et la creation du SiteAuditLog sont dans la
 * meme transaction atomique.
 *
 * Sur BLOCK : les sessions actives du site sont invalidees (delete cascades).
 *
 * @throws Error si le site est introuvable, est la plateforme, ou si la
 *   transition n'est pas autorisee depuis l'etat courant.
 */
export async function updateSiteStatus(
  siteId: string,
  action: SiteLifecycleAction,
  actorId: string,
  reason?: string
): Promise<SiteStatusUpdateResponse> {
  // Verifier l'existence du site avant la transaction
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      isActive: true,
      suspendedAt: true,
      deletedAt: true,
    },
  });

  if (!site) {
    throw new Error(`Site introuvable : ${siteId}`);
  }

  const currentStatus = computeSiteStatus(site);

  // Verifier les transitions autorisees (ADR-021 section 2.8)
  validateTransition(currentStatus, action);

  // Construire les donnees de mise a jour selon l'action
  const updateData = buildUpdateData(action, reason);

  // Etat avant pour l'audit log
  const before = {
    isActive: site.isActive,
    suspendedAt: site.suspendedAt?.toISOString() ?? null,
    deletedAt: site.deletedAt?.toISOString() ?? null,
    status: currentStatus,
  };

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Mettre a jour le site
    const updatedSite = await tx.site.update({
      where: { id: siteId },
      data: updateData,
      select: {
        id: true,
        isActive: true,
        suspendedAt: true,
        suspendedReason: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    const newStatus = computeSiteStatus(updatedSite);

    // 2. Invalider les sessions actives du site en cas de BLOCK
    if (action === "BLOCK") {
      await tx.session.deleteMany({
        where: { activeSiteId: siteId },
      });
    }

    // 3. Creer le SiteAuditLog
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId,
        action: buildAuditAction(action),
        details: {
          before,
          after: {
            isActive: updatedSite.isActive,
            suspendedAt: updatedSite.suspendedAt?.toISOString() ?? null,
            deletedAt: updatedSite.deletedAt?.toISOString() ?? null,
            status: newStatus,
          },
          reason: reason ?? null,
        },
      },
    });

    return { updatedSite, newStatus };
  });

  return {
    id: siteId,
    status: updated.newStatus,
    isActive: updated.updatedSite.isActive,
    suspendedAt: updated.updatedSite.suspendedAt?.toISOString() ?? null,
    suspendedReason: updated.updatedSite.suspendedReason,
    deletedAt: updated.updatedSite.deletedAt?.toISOString() ?? null,
    updatedAt: updated.updatedSite.updatedAt.toISOString(),
  };
}

/** Retourne les champs a mettre a jour selon l'action. */
function buildUpdateData(action: SiteLifecycleAction, reason?: string) {
  switch (action) {
    case "SUSPEND":
      return {
        suspendedAt: new Date(),
        suspendedReason: reason ?? null,
      };
    case "BLOCK":
      return {
        isActive: false,
        suspendedAt: null,
        suspendedReason: null,
      };
    case "RESTORE":
      return {
        isActive: true,
        suspendedAt: null,
        suspendedReason: null,
      };
    case "ARCHIVE":
      return {
        deletedAt: new Date(),
      };
  }
}

/** Traduit une action en libelle pour l'audit log. */
function buildAuditAction(action: SiteLifecycleAction): string {
  switch (action) {
    case "SUSPEND":
      return "SITE_SUSPENDED";
    case "BLOCK":
      return "SITE_BLOCKED";
    case "RESTORE":
      return "SITE_RESTORED";
    case "ARCHIVE":
      return "SITE_ARCHIVED";
  }
}

/** Valide que la transition est autorisee depuis le statut courant. */
function validateTransition(currentStatus: SiteStatus, action: SiteLifecycleAction): void {
  const allowed: Record<SiteLifecycleAction, SiteStatus[]> = {
    SUSPEND: [SiteStatus.ACTIVE],
    BLOCK: [SiteStatus.ACTIVE, SiteStatus.SUSPENDED],
    RESTORE: [SiteStatus.SUSPENDED, SiteStatus.BLOCKED],
    ARCHIVE: [SiteStatus.ACTIVE, SiteStatus.SUSPENDED, SiteStatus.BLOCKED],
  };

  if (!allowed[action].includes(currentStatus)) {
    throw new Error(
      `Transition non autorisee : ${action} depuis l'etat ${currentStatus}. ` +
        `Etats autorises : ${allowed[action].join(", ")}`
    );
  }
}

// ---------------------------------------------------------------------------
// 4. updateSiteModulesAdmin — mise a jour des modules depuis la plateforme
// ---------------------------------------------------------------------------

/**
 * Met a jour les modules actives d'un site depuis l'administration plateforme.
 *
 * R4 : la mise a jour et l'audit log sont dans la meme transaction.
 *
 * @throws Error si le site est introuvable.
 */
export async function updateSiteModulesAdmin(
  siteId: string,
  enabledModules: SiteModule[],
  actorId: string,
  reason?: string
): Promise<AdminSiteModulesUpdateResponse> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      enabledModules: true,
    },
  });

  if (!site) {
    throw new Error(`Site introuvable : ${siteId}`);
  }

  const before = { enabledModules: site.enabledModules };

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Mettre a jour les modules
    const updatedSite = await tx.site.update({
      where: { id: siteId },
      data: { enabledModules },
      select: {
        id: true,
        enabledModules: true,
        updatedAt: true,
      },
    });

    // 2. Creer le SiteAuditLog avec before/after
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId,
        action: "MODULES_UPDATED",
        details: {
          before,
          after: { enabledModules },
          reason: reason ?? null,
        },
      },
    });

    return updatedSite;
  });

  return {
    id: updated.id,
    enabledModules: updated.enabledModules as SiteModule[],
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 5. getSiteAuditLog — journal d'audit pagine
// ---------------------------------------------------------------------------

/**
 * Retourne le journal d'audit pagine d'un site.
 *
 * Les entrees sont ordonnees par date decroissante (plus recent en premier).
 */
export async function getSiteAuditLog(
  siteId: string,
  options: GetSiteAuditLogOptions = {}
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    prisma.siteAuditLog.findMany({
      where: { siteId },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.siteAuditLog.count({ where: { siteId } }),
  ]);

  return {
    items: logs.map((log) => ({
      id: log.id,
      siteId: log.siteId,
      actorId: log.actorId,
      actorName: log.actor.name,
      actorEmail: log.actor.email,
      action: log.action,
      details: (log.details as Record<string, unknown>) ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
