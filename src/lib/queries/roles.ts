import { prisma } from "@/lib/db";
import type { Permission } from "@/types";
import { SYSTEM_ROLE_DEFINITIONS } from "@/lib/permissions-constants";

/** Synchronise les permissions des roles systeme avec les definitions courantes */
export async function syncSystemRolePermissions(siteId: string) {
  for (const def of SYSTEM_ROLE_DEFINITIONS) {
    await prisma.siteRole.updateMany({
      where: { siteId, name: def.name, isSystem: true },
      data: { permissions: [...def.permissions] },
    });
  }
}

/** Liste les roles d'un site avec compteur de membres */
export async function getSiteRoles(siteId: string) {
  return prisma.siteRole.findMany({
    where: { siteId },
    include: { _count: { select: { members: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

/** Recupere un role par ID (verifie qu'il appartient au site) */
export async function getSiteRoleById(roleId: string, siteId: string) {
  return prisma.siteRole.findFirst({
    where: { id: roleId, siteId },
    include: { _count: { select: { members: true } } },
  });
}

/** Cree un role personnalise */
export async function createSiteRole(
  siteId: string,
  data: { name: string; description?: string; permissions: Permission[] }
) {
  return prisma.siteRole.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
      isSystem: false,
      siteId,
    },
    include: { _count: { select: { members: true } } },
  });
}

/** Met a jour un role (nom, description, permissions) */
export async function updateSiteRole(
  roleId: string,
  siteId: string,
  data: { name?: string; description?: string; permissions?: Permission[] }
) {
  return prisma.siteRole.update({
    where: { id: roleId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.permissions !== undefined && { permissions: data.permissions }),
    },
    include: { _count: { select: { members: true } } },
  });
}

/** Supprime un role personnalise et reassigne ses membres au role systeme le moins privilegie */
export async function deleteSiteRole(roleId: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    // Trouver le role systeme le moins privilegie (par nombre de permissions)
    const systemRoles = await tx.siteRole.findMany({
      where: { siteId, isSystem: true },
    });
    if (systemRoles.length === 0) {
      throw new Error("Aucun role systeme trouve pour ce site.");
    }
    const fallbackRole = systemRoles.reduce((min, r) =>
      r.permissions.length < min.permissions.length ? r : min
    );
    const pisciculteurRole = fallbackRole;

    // Reassigner tous les membres de ce role vers Pisciculteur
    await tx.siteMember.updateMany({
      where: { siteRoleId: roleId },
      data: { siteRoleId: pisciculteurRole.id },
    });

    // Supprimer le role
    return tx.siteRole.delete({
      where: { id: roleId },
    });
  });
}
