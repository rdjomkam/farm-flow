import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSiteById, updateSite, getSiteMember } from "@/lib/queries/sites";
import { ForbiddenError } from "@/lib/permissions";
import { Permission, SiteModule } from "@/types";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";
import { apiError, handleApiError } from "@/lib/api-utils";
import { base64ImageOptionalSchema } from "@/lib/validation/common.schema";

const VALID_MODULES = SITE_TOGGLEABLE_MODULES.map((m) => m.value);

/** Schema Zod pour les champs image du site (signature promoteur + cachet) — Sprint BL */
const updateSiteImagesSchema = z.object({
  signaturePromoteur: base64ImageOptionalSchema,
  cachet: base64ImageOptionalSchema,
});

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/sites/[id] — site detail (requires membership) */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    const site = await getSiteById(id, session.userId);
    if (!site) {
      return apiError(404, "Site introuvable.");
    }

    return NextResponse.json({
      id: site.id,
      name: site.name,
      address: site.address,
      isActive: site.isActive,
      enabledModules: site.enabledModules,
      signaturePromoteur: site.signaturePromoteur,
      cachet: site.cachet,
      bacCount: site._count.bacs,
      vagueCount: site._count.vagues,
      members: site.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        siteRoleId: m.siteRoleId,
        siteRoleName: m.siteRole.name,
        permissions: m.siteRole.permissions,
        isActive: m.isActive,
        createdAt: m.createdAt,
      })),
      createdAt: site.createdAt,
    });
  } catch (error) {
    return handleApiError("GET /api/sites/[id]", error, "Erreur serveur lors de la recuperation du site.");
  }
}

/** PUT /api/sites/[id] — update site (requires SITE_GERER permission) */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    // Check membership and permission
    const member = await getSiteMember(id, session.userId);
    if (!member || !member.isActive) {
      return apiError(403, "Vous n'etes pas membre de ce site.");
    }

    if (!(member.siteRole.permissions as Permission[]).includes(Permission.SITE_GERER)) {
      throw new ForbiddenError("Permission insuffisante pour modifier ce site.");
    }

    const body = await request.json();

    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
      return apiError(400, "Le nom du site ne peut pas etre vide.");
    }

    if (body.enabledModules !== undefined) {
      if (!Array.isArray(body.enabledModules)) {
        return apiError(400, "enabledModules doit etre un tableau.");
      }
      const invalid = (body.enabledModules as unknown[]).filter(
        (m) => !VALID_MODULES.includes(m as SiteModule)
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { status: 400, message: `Modules invalides : ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validation Zod des champs image (signature promoteur + cachet)
    const imagesParse = updateSiteImagesSchema.safeParse({
      signaturePromoteur: body.signaturePromoteur,
      cachet: body.cachet,
    });
    if (!imagesParse.success) {
      return apiError(400, "Donnees d'image invalides.", {
        errors: imagesParse.error.issues.map((issue) => ({
          field: String(issue.path[0] ?? "image"),
          message: issue.message,
        })),
      });
    }

    const updated = await updateSite(id, {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.address !== undefined && { address: body.address?.trim() ?? null }),
      ...(body.enabledModules !== undefined && {
        enabledModules: body.enabledModules as SiteModule[],
      }),
      ...(body.signaturePromoteur !== undefined && {
        signaturePromoteur: imagesParse.data.signaturePromoteur ?? null,
      }),
      ...(body.cachet !== undefined && {
        cachet: imagesParse.data.cachet ?? null,
      }),
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      address: updated.address,
      isActive: updated.isActive,
      enabledModules: updated.enabledModules,
      signaturePromoteur: updated.signaturePromoteur,
      cachet: updated.cachet,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return handleApiError("PUT /api/sites/[id]", error, "Erreur serveur lors de la modification du site.");
  }
}
