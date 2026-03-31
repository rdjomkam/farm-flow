import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission, ForbiddenError, canAssignRole } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getSiteRoleById, updateSiteRole, deleteSiteRole } from "@/lib/queries/roles";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; roleId: string }> };

/** GET /api/sites/[id]/roles/[roleId] — get a single role */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id: siteId, roleId } = await params;

    if (auth.activeSiteId !== siteId) {
      return apiError(403, "Site actif different.");
    }

    const role = await getSiteRoleById(roleId, siteId);
    if (!role) {
      return apiError(404, "Role introuvable.");
    }

    return NextResponse.json(role);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

/** PUT /api/sites/[id]/roles/[roleId] — update role name/description/permissions */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER, Permission.MEMBRES_GERER);
    const { id: siteId, roleId } = await params;

    if (auth.activeSiteId !== siteId) {
      return apiError(403, "Site actif different.");
    }

    const role = await getSiteRoleById(roleId, siteId);
    if (!role) {
      return apiError(404, "Role introuvable.");
    }

    const body = await request.json();

    // System roles: name cannot be changed
    if (role.isSystem && body.name !== undefined && body.name !== role.name) {
      return apiError(400, "Le nom d'un role systeme ne peut pas etre modifie.");
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

    revalidatePath(`/settings/sites/${siteId}`);
    revalidatePath(`/settings/sites/${siteId}/roles`);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError(409, "Un role avec ce nom existe deja.");
    }
    return apiError(500, "Erreur serveur lors de la modification du role.");
  }
}

/** DELETE /api/sites/[id]/roles/[roleId] — delete a custom role */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER, Permission.MEMBRES_GERER);
    const { id: siteId, roleId } = await params;

    if (auth.activeSiteId !== siteId) {
      return apiError(403, "Site actif different.");
    }

    const role = await getSiteRoleById(roleId, siteId);
    if (!role) {
      return apiError(404, "Role introuvable.");
    }

    // System roles cannot be deleted
    if (role.isSystem) {
      return apiError(409, "Les roles systeme ne peuvent pas etre supprimes.");
    }

    await deleteSiteRole(roleId, siteId);

    revalidatePath(`/settings/sites/${siteId}`);
    revalidatePath(`/settings/sites/${siteId}/roles`);
    return NextResponse.json({ success: true, reassignedMembers: role._count.members });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la suppression du role.");
  }
}
