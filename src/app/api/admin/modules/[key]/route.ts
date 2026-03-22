/**
 * /api/admin/modules/[key] — Detail et modification d'un ModuleDefinition.
 *
 * GET  — retourne un ModuleDefinition par sa cle unique.
 *         Guard : SITES_VOIR + isPlatform
 *         Retourne 404 si introuvable.
 *
 * PUT  — modifie un ModuleDefinition existant.
 *         Guard : SITES_GERER + isPlatform
 *         Body  : label?, description?, iconName?, sortOrder?, category?, isVisible?, isActive?
 *         INTERDIT : changer 'key' ou 'level' → 400 si tente.
 *
 * Story D.3 — ADR-021 Admin Plateforme
 * R2 : enums importes depuis @/types
 * R8 : acces reserve au site plateforme uniquement
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { prisma } from "@/lib/db";
import { Permission } from "@/types";
import type { ModuleDefinitionResponse } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calcule siteCount et planCount pour un module donne.
 * Utilise $queryRaw pour eviter de charger tous les sites en memoire.
 */
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
// GET /api/admin/modules/[key]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // 1. Auth + permission SITES_VOIR
    const session = await requirePermission(request, Permission.SITES_VOIR);

    // 2. Verifier que l'utilisateur opere depuis le site plateforme
    const isPlat = await isPlatformSite(session.activeSiteId);
    if (!isPlat) {
      return NextResponse.json(
        { error: "Accès réservé au site plateforme" },
        { status: 403 }
      );
    }

    // 3. Recuperer la cle depuis les params
    const { key } = await params;

    // 4. Recuperer le ModuleDefinition
    const module = await prisma.moduleDefinition.findUnique({ where: { key } });
    if (!module) {
      return NextResponse.json(
        { error: `Module '${key}' introuvable.` },
        { status: 404 }
      );
    }

    // 5. Enrichir avec les stats
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
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    console.error("[GET /api/admin/modules/[key]]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération du module." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/modules/[key]
// ---------------------------------------------------------------------------

interface UpdateModuleDefinitionBody {
  key?: unknown;     // Interdit — retourne 400 si fourni
  level?: unknown;   // Interdit — retourne 400 si fourni
  label?: string;
  description?: string | null;
  iconName?: string;
  sortOrder?: number;
  category?: string | null;
  isVisible?: boolean;
  isActive?: boolean;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // 1. Auth + permission SITES_GERER
    const session = await requirePermission(request, Permission.SITES_GERER);

    // 2. Verifier que l'utilisateur opere depuis le site plateforme
    const isPlat = await isPlatformSite(session.activeSiteId);
    if (!isPlat) {
      return NextResponse.json(
        { error: "Accès réservé au site plateforme" },
        { status: 403 }
      );
    }

    // 3. Recuperer la cle depuis les params
    const { key } = await params;

    // 4. Parser le body
    let body: UpdateModuleDefinitionBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corps de requête JSON invalide." },
        { status: 400 }
      );
    }

    // 5. Verifier que key et level ne sont pas tentes d'etre modifies
    if ("key" in body && body.key !== undefined) {
      return NextResponse.json(
        { error: "Le champ 'key' est immuable après création et ne peut pas être modifié." },
        { status: 400 }
      );
    }
    if ("level" in body && body.level !== undefined) {
      return NextResponse.json(
        { error: "Le champ 'level' est immuable après création et ne peut pas être modifié." },
        { status: 400 }
      );
    }

    // 6. Verifier que le module existe
    const existing = await prisma.moduleDefinition.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json(
        { error: `Module '${key}' introuvable.` },
        { status: 404 }
      );
    }

    // 7. Construire les donnees de mise a jour (champs modifiables uniquement)
    const updateData: Record<string, unknown> = {};
    if (body.label !== undefined) {
      if (typeof body.label !== "string" || body.label.trim() === "") {
        return NextResponse.json(
          { error: "Le champ 'label' doit être une chaîne non vide." },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: "Le champ 'sortOrder' doit être un nombre." },
          { status: 400 }
        );
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

    // 8. Mettre a jour
    const updated = await prisma.moduleDefinition.update({
      where: { key },
      data: updateData,
    });

    // 9. Enrichir avec les stats
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
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    console.error("[PUT /api/admin/modules/[key]]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la modification du module." },
      { status: 500 }
    );
  }
}
