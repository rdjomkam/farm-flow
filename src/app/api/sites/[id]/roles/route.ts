import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission, ForbiddenError, canAssignRole } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getSiteRoles, createSiteRole } from "@/lib/queries/roles";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    // Prisma unique constraint error (duplicate name)
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError(409, "Un role avec ce nom existe deja.");
    }
    return apiError(500, "Erreur serveur lors de la creation du role.");
  }
}
