import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission, ForbiddenError, canAssignRole } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { getSiteRoles, createSiteRole } from "@/lib/queries/roles";
import { Permission } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/sites/[id]/roles — list roles for a site */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id: siteId } = await params;

    if (auth.activeSiteId !== siteId) {
      return NextResponse.json({ status: 403, message: "Site actif different." }, { status: 403 });
    }

    const roles = await getSiteRoles(siteId);
    return NextResponse.json({ roles, total: roles.length });
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

/** POST /api/sites/[id]/roles — create a custom role */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER, Permission.MEMBRES_GERER);
    const { id: siteId } = await params;

    if (auth.activeSiteId !== siteId) {
      return NextResponse.json({ status: 403, message: "Site actif different." }, { status: 403 });
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
      return NextResponse.json({ status: 400, message: "Erreurs de validation", errors }, { status: 400 });
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    // Prisma unique constraint error (duplicate name)
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ status: 409, message: "Un role avec ce nom existe deja." }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message: "Erreur serveur lors de la creation du role." }, { status: 500 });
  }
}
