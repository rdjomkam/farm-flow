/**
 * /api/backoffice/modules/[key] — Detail et modification d'un ModuleDefinition.
 *
 * GET  — retourne un ModuleDefinition par sa cle unique.
 *         Guard : requireSuperAdmin
 *
 * PATCH — modifie un ModuleDefinition existant.
 *         Guard : requireSuperAdmin
 *         Body  : label?, description?, iconName?, sortOrder?, category?, isVisible?, isActive?
 *         INTERDIT : changer 'key' ou 'level' → 400 si tente.
 *
 * Story C.4 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import type { ModuleDefinitionResponse } from "@/types";
import { apiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// Helper — siteCount + planCount for a given module key
// ---------------------------------------------------------------------------

async function getModuleStats(moduleKey: string): Promise<{ siteCount: number; planCount: number }> {
  const [siteRows, planRows] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Site"
      WHERE "deletedAt" IS NULL
        AND ${moduleKey}::text = ANY("enabledModules"::text[])
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "PlanAbonnement"
      WHERE "isActif" = true
        AND ${moduleKey}::text = ANY("modulesInclus"::text[])
    `,
  ]);

  return {
    siteCount: Number(siteRows[0]?.count ?? 0),
    planCount: Number(planRows[0]?.count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// GET /api/backoffice/modules/[key]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireSuperAdmin(request);

    const { key } = await params;

    const module = await prisma.moduleDefinition.findUnique({ where: { key } });
    if (!module) {
      return apiError(404, `Module '${key}' introuvable.`);
    }

    const stats = await getModuleStats(key);

    const response: ModuleDefinitionResponse = {
      id: module.id,
      key: module.key,
      label: module.label,
      description: module.description,
      iconName: module.iconName,
      sortOrder: module.sortOrder,
      level: module.level as "site" | "platform",
      dependsOn: module.dependsOn,
      isVisible: module.isVisible,
      isActive: module.isActive,
      category: module.category,
      siteCount: stats.siteCount,
      planCount: stats.planCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/backoffice/modules/[key]]", error);
    return apiError(500, "Erreur serveur lors de la recuperation du module.");
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/backoffice/modules/[key]
// ---------------------------------------------------------------------------

interface UpdateModuleDefinitionBody {
  key?: unknown;    // Interdit — retourne 400 si fourni
  level?: unknown;  // Interdit — retourne 400 si fourni
  label?: string;
  description?: string | null;
  iconName?: string;
  sortOrder?: number;
  category?: string | null;
  isVisible?: boolean;
  isActive?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireSuperAdmin(request);

    const { key } = await params;

    let body: UpdateModuleDefinitionBody;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Corps de requete JSON invalide.");
    }

    if ("key" in body && body.key !== undefined) {
      return apiError(400, "Le champ 'key' est immuable apres creation et ne peut pas etre modifie.");
    }
    if ("level" in body && body.level !== undefined) {
      return apiError(400, "Le champ 'level' est immuable apres creation et ne peut pas etre modifie.");
    }

    const existing = await prisma.moduleDefinition.findUnique({ where: { key } });
    if (!existing) {
      return apiError(404, `Module '${key}' introuvable.`);
    }

    const updateData: Record<string, unknown> = {};
    if (body.label !== undefined) {
      if (typeof body.label !== "string" || body.label.trim() === "") {
        return apiError(400, "Le champ 'label' doit etre une chaine non vide.");
      }
      updateData.label = body.label.trim();
    }
    if ("description" in body) {
      updateData.description = body.description ?? null;
    }
    if (body.iconName !== undefined) {
      updateData.iconName = body.iconName;
    }
    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== "number") {
        return apiError(400, "Le champ 'sortOrder' doit etre un nombre.");
      }
      updateData.sortOrder = body.sortOrder;
    }
    if ("category" in body) {
      updateData.category = body.category ?? null;
    }
    if (body.isVisible !== undefined) {
      updateData.isVisible = Boolean(body.isVisible);
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.moduleDefinition.update({
      where: { key },
      data: updateData,
    });

    const stats = await getModuleStats(key);

    const response: ModuleDefinitionResponse = {
      id: updated.id,
      key: updated.key,
      label: updated.label,
      description: updated.description,
      iconName: updated.iconName,
      sortOrder: updated.sortOrder,
      level: updated.level as "site" | "platform",
      dependsOn: updated.dependsOn,
      isVisible: updated.isVisible,
      isActive: updated.isActive,
      category: updated.category,
      siteCount: stats.siteCount,
      planCount: stats.planCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[PATCH /api/backoffice/modules/[key]]", error);
    return apiError(500, "Erreur serveur lors de la modification du module.");
  }
}
