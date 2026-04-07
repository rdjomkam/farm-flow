import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission, ForbiddenError, canAssignRole } from "@/lib/permissions";
import { getSiteRoles, createSiteRole } from "@/lib/queries/roles";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/sites/[id]/roles — list roles for a site */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id: siteId } = await params;

    if (auth.activeSiteId !== siteId) {
      return apiError(403, "Site actif different.");
    }

    const roles = await getSiteRoles(siteId);
    return NextResponse.json({ roles, total: roles.length });
  } catch (error) {
    return handleApiError("GET /api/sites/[id]/roles", error, "Erreur serveur.");
  }
}

/** POST /api/sites/[id]/roles — create a custom role */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER, Permission.MEMBRES_GERER);
    const { id: siteId } = await params;

    if (auth.activeSiteId !== siteId) {
      return apiError(403, "Site actif different.");
    }

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      errors.push({ field: "name", message: "Le nom du role est obligatoire." });
    }
    if (!Array.isArray(body.permissions) || body.permissions.length === 0) {
      errors.push({ field: "permissions", message: "Au moins une permission est requise." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Anti-escalation: caller can only create roles with permissions they have
    if (!canAssignRole(auth.permissions, body.permissions)) {
      throw new ForbiddenError("Vous ne pouvez accorder que des permissions que vous possedez.");
    }

    const role = await createSiteRole(siteId, {
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      permissions: body.permissions,
    });

    revalidatePath(`/settings/sites/${siteId}`);
    revalidatePath(`/settings/sites/${siteId}/roles`);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/sites/[id]/roles", error, "Erreur serveur lors de la creation du role.");
  }
}
