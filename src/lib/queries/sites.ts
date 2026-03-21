import { prisma } from "@/lib/db";
import { SYSTEM_ROLE_DEFINITIONS } from "@/lib/permissions-constants";
import { SiteModule } from "@/types";

/** Liste les sites dont un utilisateur est membre actif */
export async function getUserSites(userId: string) {
  return prisma.site.findMany({
    where: {
      members: {
        some: { userId, isActive: true },
      },
      isActive: true,
    },
    include: {
      _count: { select: { members: true, bacs: true, vagues: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Recupere un site par ID (verifie que l'utilisateur est membre) */
export async function getSiteById(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: {
      id: siteId,
      members: { some: { userId, isActive: true } },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          siteRole: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { bacs: true, vagues: true } },
    },
  });
}

/** Cree un nouveau site, ses roles systeme, et ajoute le createur comme Administrateur */
export async function createSite(
  data: { name: string; address?: string },
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.create({
      data: {
        name: data.name,
        address: data.address ?? null,
      },
    });

    // Creer les roles systeme definis dans SYSTEM_ROLE_DEFINITIONS
    const roles = await Promise.all(
      SYSTEM_ROLE_DEFINITIONS.map((def) =>
        tx.siteRole.create({
          data: {
            name: def.name,
            description: def.description,
            permissions: [...def.permissions],
            isSystem: true,
            siteId: site.id,
          },
        })
      )
    );

    // Assigner le createur comme Administrateur
    const adminRole = roles.find((r) => r.name === "Administrateur")!;
    await tx.siteMember.create({
      data: {
        userId,
        siteId: site.id,
        siteRoleId: adminRole.id,
      },
    });

    return site;
  });
}

/** Met a jour un site */
export async function updateSite(
  siteId: string,
  data: { name?: string; address?: string; enabledModules?: SiteModule[] }
) {
  return prisma.site.update({
    where: { id: siteId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.enabledModules !== undefined && { enabledModules: data.enabledModules }),
    },
  });
}

/** Ajoute un membre a un site avec un role de site specifique */
export async function addMember(siteId: string, userId: string, siteRoleId: string) {
  return prisma.siteMember.create({
    data: { userId, siteId, siteRoleId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      siteRole: true,
    },
  });
}

/** Retire un membre d'un site */
export async function removeMember(siteId: string, userId: string) {
  return prisma.siteMember.deleteMany({
    where: { siteId, userId },
  });
}

/** Change le role de site d'un membre */
export async function updateMemberSiteRole(siteId: string, userId: string, siteRoleId: string) {
  return prisma.siteMember.updateMany({
    where: { siteId, userId },
    data: { siteRoleId },
  });
}

/** Liste les membres d'un site (id + name pour les selects assignee) */
export async function getSiteMembers(siteId: string) {
  return prisma.siteMember.findMany({
    where: { siteId, isActive: true },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
}

// ──────────────────────────────────────────
// Helpers — Platform site (BUG-025)
// ──────────────────────────────────────────

/** Recupere le site plateforme (DKFarm). Il ne peut en exister qu'un seul (index partiel unique). */
export async function getPlatformSite() {
  return prisma.site.findFirst({ where: { isPlatform: true } });
}

/** Retourne true si le site donne est le site plateforme. */
export async function isPlatformSite(siteId: string): Promise<boolean> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { isPlatform: true },
  });
  return site?.isPlatform === true;
}

/** Recupere le membership d'un utilisateur pour un site (avec siteRole inclus) */
export async function getSiteMember(siteId: string, userId: string) {
  return prisma.siteMember.findUnique({
    where: { userId_siteId: { userId, siteId } },
    include: { siteRole: true },
  });
}
