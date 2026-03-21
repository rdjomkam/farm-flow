import { cache } from "react";
import { Permission, Role, SiteModule } from "@/types";
import { getSiteMember, isPlatformSite } from "@/lib/queries/sites";
import { prisma } from "@/lib/db";
import type { UserSession } from "@/types";
import { PLATFORM_MODULES } from "@/lib/site-modules-config";
import { PLATFORM_PERMISSIONS } from "@/lib/permissions-constants";

/** Load effective permissions for active site. Uses React cache() for dedup within a request. */
export const getServerPermissions = cache(async (session: UserSession): Promise<Permission[]> => {
  if (!session.activeSiteId) return [];
  // Check once whether this is the platform site (determines permission scope)
  const isPlat = await isPlatformSite(session.activeSiteId);
  if (session.role === Role.ADMIN) {
    // ADMIN gets all permissions, but platform-only permissions are stripped on non-platform sites
    if (isPlat) return Object.values(Permission);
    return Object.values(Permission).filter((p) => !PLATFORM_PERMISSIONS.includes(p));
  }
  const member = await getSiteMember(session.activeSiteId, session.userId);
  if (!member?.siteRole) return [];
  const rawPermissions = member.siteRole.permissions as Permission[];
  // Strip platform-only permissions when the active site is not the platform site
  if (isPlat) return rawPermissions;
  return rawPermissions.filter((p) => !PLATFORM_PERMISSIONS.includes(p));
});

/** Load enabled modules for active site. Empty array = all modules (backward compat). */
export const getServerSiteModules = cache(async (activeSiteId: string | null): Promise<SiteModule[]> => {
  if (!activeSiteId) return [];
  const site = await prisma.site.findUnique({
    where: { id: activeSiteId },
    select: { enabledModules: true, isPlatform: true },
  });
  if (!site) return [];
  const platformModuleValues = PLATFORM_MODULES.map((m) => m.value);
  // Platform site: always include platform modules in addition to enabled ones
  if (site.isPlatform) {
    if (site.enabledModules.length === 0) return Object.values(SiteModule);
    return [...new Set([...(site.enabledModules as SiteModule[]), ...platformModuleValues])];
  }
  // Non-platform site: never expose platform modules
  const nonPlatformModules = (site.enabledModules as SiteModule[]).filter(
    (m) => !platformModuleValues.includes(m)
  );
  // Empty = all non-platform modules (backward compat for non-supervised sites)
  if (nonPlatformModules.length === 0 && site.enabledModules.length === 0) {
    return Object.values(SiteModule).filter((m) => !platformModuleValues.includes(m));
  }
  return nonPlatformModules;
});

/** Check page-level permission. Returns permissions if OK, null if denied. */
export async function checkPagePermission(
  session: UserSession,
  ...required: Permission[]
): Promise<Permission[] | null> {
  const permissions = await getServerPermissions(session);
  return required.every((p) => permissions.includes(p)) ? permissions : null;
}
