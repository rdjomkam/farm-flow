import { NextRequest, NextResponse } from "next/server";
import { requirePermission, ForbiddenError, canAssignRole } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getSiteRoleById, updateSiteRole, deleteSiteRole } from "@/lib/queries/roles";
import { Permission } from "@/types";

type RouteParams = { params: Promise<{ id: string; roleId: string }> };

/** GET /api/sites/[id]/roles/[roleId] — get a single role */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id: siteId, roleId } = await params;

    if (auth.activeSiteId !== siteId) {
      return NextResponse.json({ status: 403, message: "Site actif different." }, { status: 403 });
    }

    const role = await getSiteRoleById(roleId, siteId);
    if (!role) {
      return NextResponse.json({ status: 404, message: "Role introuvable." }, { status: 404 });
    }

    return NextResponse.json(role);
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

/** PUT /api/sites/[id]/roles/[roleId] — update role name/description/permissions */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER, Permission.MEMBRES_GERER);
    const { id: siteId, roleId } = await params;

    if (auth.activeSiteId !== siteId) {
      return NextResponse.json({ status: 403, message: "Site actif different." }, { status: 403 });
    }

    const role = await getSiteRoleById(roleId, siteId);
    if (!role) {
      return NextResponse.json({ status: 404, message: "Role introuvable." }, { status: 404 });
    }

    const body = await request.json();

    // System roles: name cannot be changed
    if (role.isSystem && body.name !== undefined && body.name !== role.name) {
      return NextResponse.json({ status: 400, message: "Le nom d'un role systeme ne peut pas etre modifie." }, { status: 400 });
    }

    // Anti-escalation: can only set permissions the caller has
    if (body.permissions && !canAssignRole(auth.permissions, body.permissions)) {
      throw new ForbiddenError("Vous ne pouvez accorder que des permissions que vous possedez.");
    }

    const updated = await updateSiteRole(roleId, siteId, {
      name: body.name?.trim(),
      description: body.description?.trim(),
      permissions: body.permissions,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ status: 409, message: "Un role avec ce nom existe deja." }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur lors de la modification du role." }, { status: 500 });
  }
}

/** DELETE /api/sites/[id]/roles/[roleId] — delete a custom role */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER, Permission.MEMBRES_GERER);
    const { id: siteId, roleId } = await params;

    if (auth.activeSiteId !== siteId) {
      return NextResponse.json({ status: 403, message: "Site actif different." }, { status: 403 });
    }

    const role = await getSiteRoleById(roleId, siteId);
    if (!role) {
      return NextResponse.json({ status: 404, message: "Role introuvable." }, { status: 404 });
    }

    // System roles cannot be deleted
    if (role.isSystem) {
      return NextResponse.json({ status: 409, message: "Les roles systeme ne peuvent pas etre supprimes." }, { status: 409 });
    }

    await deleteSiteRole(roleId, siteId);

    return NextResponse.json({ success: true, reassignedMembers: role._count.members });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur lors de la suppression du role." }, { status: 500 });
  }
}
