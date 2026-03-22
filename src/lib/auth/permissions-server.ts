import { cache } from "react";
import { Permission, Role, SiteModule } from "@/types";
import { getSiteMember } from "@/lib/queries/sites";
import { prisma } from "@/lib/db";
import type { UserSession } from "@/types";

/** Load effective permissions for active site. Uses React cache() for dedup within a request. */
export const getServerPermissions = cache(async (session: UserSession): Promise<Permission[]> => {
  if (!session.activeSiteId) return [];
  // ADR-022: isPlatform removed. ADMIN gets all permissions on any site.
  if (session.role === Role.ADMIN) {
    return Object.values(Permission);
  }
  const member = await getSiteMember(session.activeSiteId, session.userId);
  if (!member?.siteRole) return [];
  return member.siteRole.permissions as Permission[];
});

/** Load enabled modules for active site. Empty array = all modules (backward compat). */
export const getServerSiteModules = cache(async (activeSiteId: string | null): Promise<SiteModule[]> => {
  if (!activeSiteId) return [];
  const site = await prisma.site.findUnique({
    where: { id: activeSiteId },
    select: { enabledModules: true },
  });
  if (!site) return [];
  // ADR-022: no more platform modules logic. Simple: enabled modules or all if empty.
  if (site.enabledModules.length === 0) return Object.values(SiteModule);
  return site.enabledModules as SiteModule[];
});

/** Check page-level permission. Returns permissions if OK, null if denied. */
export async function checkPagePermission(
  session: UserSession,
  ...required: Permission[]
): Promise<Permission[] | null> {
  const permissions = await getServerPermissions(session);
  return required.every((p) => permissions.includes(p)) ? permissions : null;
}
