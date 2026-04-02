import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSiteMember } from "@/lib/queries/sites";
import { Role, Permission } from "@/types";
import type { AuthContext, UserSession } from "@/types/auth";
import { prisma } from "@/lib/db";

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

/**
 * requireHasPermission — validates auth and checks that the user has at least one of the given permissions.
 *
 * Unlike requirePermission (which requires ALL listed permissions on the active site),
 * this helper passes if the user has ANY one of the given permissions.
 * Global ADMIN role always passes.
 *
 * Used for platform-level user management routes that don't need an active site.
 */
export async function requireHasPermission(
  request: NextRequest,
  ...anyOf: Permission[]
): Promise<UserSession> {
  const session = await requireAuth(request);

  // Global ADMIN always passes
  if (session.role === Role.ADMIN) {
    return session;
  }

  if (!session.activeSiteId) {
    throw new ForbiddenError("Aucun site actif selectionne.");
  }

  const member = await getSiteMember(session.activeSiteId, session.userId);
  if (!member || !member.isActive) {
    throw new ForbiddenError("Vous n'etes pas membre de ce site.");
  }

  if (!member.siteRole) {
    throw new ForbiddenError("Role de site introuvable.");
  }

  const memberPermissions = member.siteRole.permissions as Permission[];
  const hasAny = anyOf.some((p) => memberPermissions.includes(p));
  if (!hasAny) {
    throw new ForbiddenError("Permission insuffisante.");
  }

  return session;
}

export async function requirePermission(
  request: NextRequest,
  ...required: Permission[]
): Promise<AuthContext> {
  const session = await requireAuth(request);

  // Global ADMIN has all permissions — bypass membership and activeSiteId check
  if (session.role === Role.ADMIN) {
    const activeSiteId = session.activeSiteId ?? "";
    // Load isSuperAdmin from DB for accurate AuthContext
    const userRow = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isSuperAdmin: true },
    });
    return {
      userId: session.userId,
      email: session.email,
      phone: session.phone,
      name: session.name,
      globalRole: session.role,
      isSuperAdmin: userRow?.isSuperAdmin ?? false,
      activeSiteId,
      siteRoleId: "",
      siteRoleName: "Super Admin",
      permissions: Object.values(Permission),
    };
  }

  if (!session.activeSiteId) {
    throw new ForbiddenError("Aucun site actif selectionne.");
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
    isSuperAdmin: false,
    activeSiteId: session.activeSiteId,
    siteRoleId: member.siteRoleId,
    siteRoleName: member.siteRole.name,
    permissions: memberPermissions,
  };
}
