import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission, ForbiddenError, canAssignRole } from "@/lib/permissions";
import { getSiteRoleById, updateSiteRole, deleteSiteRole } from "@/lib/queries/roles";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

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
    return handleApiError("GET /api/sites/[id]/roles/[roleId]", error, "Erreur serveur.");
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
    return handleApiError("PUT /api/sites/[id]/roles/[roleId]", error, "Erreur serveur lors de la modification du role.");
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
    return handleApiError("DELETE /api/sites/[id]/roles/[roleId]", error, "Erreur serveur lors de la suppression du role.");
  }
}
