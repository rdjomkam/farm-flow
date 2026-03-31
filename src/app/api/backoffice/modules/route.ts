/**
 * /api/backoffice/modules — Registre des ModuleDefinition.
 *
 * GET  — liste tous les ModuleDefinition avec stats calculees.
 *         Guard : requireSuperAdmin
 *
 * POST — cree un nouveau ModuleDefinition.
 *         Guard : requireSuperAdmin
 *         Body  : label, description?, iconName?, sortOrder?, level, category?, isVisible?, isActive?
 *         Note  : key est derive du label (uppercase, underscore) et doit etre unique.
 *                 key et level sont IMMUTABLES apres creation.
 *
 * Story C.4 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { SiteModule } from "@/types";
import type { AdminModulesListResponse, ModuleDefinitionResponse } from "@/types";
import { apiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive la cle du module depuis son label (uppercase + underscore). */
function deriveKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Calcule les stats (siteCount, planCount) pour un ensemble de modules.
 */
async function enrichModulesWithStats(
  modules: {
    id: string;
    key: string;
    label: string;
    description: string | null;
    iconName: string;
    sortOrder: number;
    level: string;
    dependsOn: string[];
    isVisible: boolean;
    isActive: boolean;
    category: string | null;
  }[]
): Promise<ModuleDefinitionResponse[]> {
  if (modules.length === 0) return [];

  const siteCountRows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
    SELECT unnest("enabledModules") as module, COUNT(*) as count
    FROM "Site"
    WHERE "deletedAt" IS NULL
    GROUP BY module
  `;
  const siteCountMap = new Map(
    siteCountRows.map((r) => [r.module, Number(r.count)])
  );

  const planCountRows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
    SELECT unnest("modulesInclus") as module, COUNT(*) as count
    FROM "PlanAbonnement"
    WHERE "isActif" = true
    GROUP BY module
  `;
  const planCountMap = new Map(
    planCountRows.map((r) => [r.module, Number(r.count)])
  );

  return modules.map((m) => ({
    id: m.id,
    key: m.key,
    label: m.label,
    description: m.description,
    iconName: m.iconName,
    sortOrder: m.sortOrder,
    level: m.level as "site" | "platform",
    dependsOn: m.dependsOn,
    isVisible: m.isVisible,
    isActive: m.isActive,
    category: m.category,
    siteCount: siteCountMap.get(m.key) ?? 0,
    planCount: planCountMap.get(m.key) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// GET /api/backoffice/modules
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const rawModules = await prisma.moduleDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    const modules = await enrichModulesWithStats(rawModules);

    const response: AdminModulesListResponse = { modules };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/backoffice/modules]", error);
    return apiError(500, "Erreur serveur lors de la recuperation des modules.");
  }
}

// ---------------------------------------------------------------------------
// POST /api/backoffice/modules
// ---------------------------------------------------------------------------

interface CreateModuleDefinitionBody {
  label: string;
  description?: string;
  iconName?: string;
  sortOrder?: number;
  level: "site" | "platform";
  category?: string;
  isVisible?: boolean;
  isActive?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    let body: CreateModuleDefinitionBody;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Corps de requete JSON invalide.");
    }

    if (!body.label || typeof body.label !== "string" || body.label.trim() === "") {
      return apiError(400, "Le champ 'label' est obligatoire.");
    }

    if (!body.level || !["site", "platform"].includes(body.level)) {
      return apiError(400, "Le champ 'level' est obligatoire et doit etre 'site' ou 'platform'.");
    }

    const key = deriveKey(body.label);

    if (!key) {
      return apiError(400, "Impossible de deriver une cle valide depuis le label fourni.");
    }

    const existing = await prisma.moduleDefinition.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json(
        { error: `Une definition de module avec la cle '${key}' existe deja.` },
        { status: 409 }
      );
    }

    const isKnownModule = Object.values(SiteModule).includes(key as SiteModule);

    const created = await prisma.moduleDefinition.create({
      data: {
        key,
        label: body.label.trim(),
        description: body.description ?? null,
        iconName: body.iconName ?? "Package",
        sortOrder: body.sortOrder ?? 0,
        level: body.level,
        category: body.category ?? null,
        isVisible: body.isVisible ?? true,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        key: created.key,
        label: created.label,
        description: created.description,
        iconName: created.iconName,
        sortOrder: created.sortOrder,
        level: created.level as "site" | "platform",
        dependsOn: created.dependsOn,
        isVisible: created.isVisible,
        isActive: created.isActive,
        category: created.category,
        siteCount: 0,
        planCount: 0,
        isKnownSiteModule: isKnownModule,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[POST /api/backoffice/modules]", error);
    return apiError(500, "Erreur serveur lors de la creation du module.");
  }
}
