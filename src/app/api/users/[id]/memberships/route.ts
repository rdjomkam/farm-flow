import { NextRequest, NextResponse } from "next/server";
import { requireHasPermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getUserMemberships } from "@/lib/queries/users-admin";
import { Permission } from "@/types";

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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur." }, { status: 500 });
  }
}
