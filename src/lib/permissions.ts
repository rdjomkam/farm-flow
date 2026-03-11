import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSiteMember } from "@/lib/queries/sites";
import { Role, Permission } from "@/types";
import type { AuthContext } from "@/types/auth";

// Re-export constants for server-side consumers
export {
  SYSTEM_ROLE_DEFINITIONS,
  canAssignRole,
  PERMISSION_GROUPS,
} from "./permissions-constants";

// Re-export AuthContext type
export type { AuthContext };

// ---------------------------------------------------------------------------
// ForbiddenError — 403 for permission checks
// ---------------------------------------------------------------------------

export class ForbiddenError extends Error {
  public readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// requirePermission — validates auth + site membership + permissions
// ---------------------------------------------------------------------------

export async function requirePermission(
  request: NextRequest,
  ...required: Permission[]
): Promise<AuthContext> {
  const session = await requireAuth(request);

  if (!session.activeSiteId) {
    throw new ForbiddenError("Aucun site actif selectionne.");
  }

  // Global ADMIN has all permissions — bypass membership check
  if (session.role === Role.ADMIN) {
    return {
      userId: session.userId,
      email: session.email,
      phone: session.phone,
      name: session.name,
      globalRole: session.role,
      activeSiteId: session.activeSiteId,
      siteRoleId: "",
      siteRoleName: "Super Admin",
      permissions: Object.values(Permission),
    };
  }

  // Load membership for active site (with siteRole included)
  const member = await getSiteMember(session.activeSiteId, session.userId);
  if (!member || !member.isActive) {
    throw new ForbiddenError("Vous n'etes pas membre de ce site.");
  }

  if (!member.siteRole) {
    throw new ForbiddenError("Role de site introuvable.");
  }

  // Check required permissions against siteRole.permissions
  const memberPermissions = member.siteRole.permissions as Permission[];
  const missing = required.filter((p) => !memberPermissions.includes(p));
  if (missing.length > 0) {
    throw new ForbiddenError("Permission insuffisante.");
  }

  return {
    userId: session.userId,
    email: session.email,
    phone: session.phone,
    name: session.name,
    globalRole: session.role,
    activeSiteId: session.activeSiteId,
    siteRoleId: member.siteRoleId,
    siteRoleName: member.siteRole.name,
    permissions: memberPermissions,
  };
}
