import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission } from "@/lib/permissions";
import { getUserMemberships } from "@/lib/queries/users-admin";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/users/[id]/memberships — lister les sites membres d'un utilisateur */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireHasPermission(request, Permission.UTILISATEURS_VOIR, Permission.UTILISATEURS_GERER);
    const { id } = await params;

    const memberships = await getUserMemberships(id);

    const result = memberships.map((m) => ({
      id: m.id,
      siteId: m.siteId,
      siteName: m.siteName,
      siteRoleId: m.siteRoleId,
      siteRoleName: m.siteRoleName,
      isActive: m.isActive,
      joinedAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ memberships: result, total: result.length });
  } catch (error) {
    return handleApiError("GET /api/users/[id]/memberships", error, "Erreur serveur.");
  }
}
