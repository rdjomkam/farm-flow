/**
 * /api/admin/modules — Registre des ModuleDefinition (ADR-021).
 *
 * GET  — liste tous les ModuleDefinition avec stats calculees.
 *         Guard : SITES_VOIR + isPlatform
 *
 * POST — cree un nouveau ModuleDefinition.
 *         Guard : SITES_GERER + isPlatform
 *         Body  : label, description?, iconName?, sortOrder?, level, category?, isVisible?, isActive?
 *         Note  : key est derive du label (uppercase, underscore) et doit etre unique.
 *                 key et level sont IMMUTABLES apres creation.
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
import { Permission, SiteModule } from "@/types";
import type { AdminModulesListResponse, ModuleDefinitionResponse } from "@/types";

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
 * Utilise $queryRaw pour le siteCount (unnest sur enabledModules).
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

  // siteCount via unnest()
  const siteCountRows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
    SELECT unnest("enabledModules") as module, COUNT(*) as count
    FROM "Site"
    WHERE "deletedAt" IS NULL
    GROUP BY module
  `;
  const siteCountMap = new Map(
    siteCountRows.map((r) => [r.module, Number(r.count)])
  );

  // planCount : compter les plans ou le module apparait dans modulesInclus
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
// GET /api/admin/modules
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
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

    // 3. Recuperer tous les ModuleDefinition
    const rawModules = await prisma.moduleDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    // 4. Enrichir avec les stats calculees
    const modules = await enrichModulesWithStats(rawModules);

    const response: AdminModulesListResponse = { modules };
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
    console.error("[GET /api/admin/modules]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des modules." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/modules
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

    // 3. Parser et valider le body
    let body: CreateModuleDefinitionBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corps de requête JSON invalide." },
        { status: 400 }
      );
    }

    if (!body.label || typeof body.label !== "string" || body.label.trim() === "") {
      return NextResponse.json(
        { error: "Le champ 'label' est obligatoire." },
        { status: 400 }
      );
    }

    if (!body.level || !["site", "platform"].includes(body.level)) {
      return NextResponse.json(
        { error: "Le champ 'level' est obligatoire et doit être 'site' ou 'platform'." },
        { status: 400 }
      );
    }

    // 4. Deriver la cle depuis le label
    const key = deriveKey(body.label);

    if (!key) {
      return NextResponse.json(
        { error: "Impossible de dériver une clé valide depuis le label fourni." },
        { status: 400 }
      );
    }

    // 5. Verifier l'unicite de la cle
    const existing = await prisma.moduleDefinition.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json(
        { error: `Une définition de module avec la clé '${key}' existe déjà.` },
        { status: 409 }
      );
    }

    // 6. Verifier que la cle correspond a une valeur de l'enum SiteModule (si applicable)
    // Note : le registre peut contenir des modules en attente de migration d'enum.
    // On accepte toutes les cles mais on indique si elle correspond a l'enum.
    const isKnownModule = Object.values(SiteModule).includes(key as SiteModule);

    // 7. Creer le ModuleDefinition
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
    console.error("[POST /api/admin/modules]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la création du module." },
      { status: 500 }
    );
  }
}
