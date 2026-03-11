import { cache } from "react";
import { Permission, Role } from "@/types";
import { getSiteMember } from "@/lib/queries/sites";
import type { UserSession } from "@/types";

/** Load effective permissions for active site. Uses React cache() for dedup within a request. */
export const getServerPermissions = cache(async (session: UserSession): Promise<Permission[]> => {
  if (!session.activeSiteId) return [];
  if (session.role === Role.ADMIN) return Object.values(Permission);
  const member = await getSiteMember(session.activeSiteId, session.userId);
  if (!member?.siteRole) return [];
  return member.siteRole.permissions as Permission[];
});

/** Check page-level permission. Returns permissions if OK, null if denied. */
export async function checkPagePermission(
  session: UserSession,
  ...required: Permission[]
): Promise<Permission[] | null> {
  const permissions = await getServerPermissions(session);
  return required.every((p) => permissions.includes(p)) ? permissions : null;
}
