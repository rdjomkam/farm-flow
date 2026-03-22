/**
 * src/app/api/plans/route.ts
 *
 * GET  /api/plans          — liste des plans (publique si ?public=true, sinon auth + PLANS_GERER)
 * POST /api/plans          — créer un plan (auth + PLANS_GERER)
 *
 * Story 32.1 — Sprint 32
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques via les fonctions query
 */
import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import {
  getPlansAbonnements,
  createPlanAbonnement,
} from "@/lib/queries/plans-abonnements";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { getSession, AuthError } from "@/lib/auth";
import { Permission, TypePlan, SiteModule } from "@/types";
import type { CreatePlanAbonnementDTO } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";

const VALID_TYPE_PLANS = Object.values(TypePlan);
const VALID_SITE_MODULES = SITE_TOGGLEABLE_MODULES.map((m) => m.value);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get("public") === "true";

    if (isPublic) {
      // Liste publique : sans auth, uniquement les plans actifs+publics
      const plans = await getPlansAbonnements(false);
      return cachedJson({ plans, total: plans.length }, "static");
    }

    // Liste complète (y compris inactifs) : auth + PLANS_GERER
    await requirePermission(request, Permission.PLANS_GERER);
    const plans = await getPlansAbonnements(true);
    return cachedJson({ plans, total: plans.length }, "static");
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
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des plans.", errorKey: ErrorKeys.SERVER_GET_PLANS },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, Permission.PLANS_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le nom du plan est obligatoire." });
    }

    if (!body.typePlan || !VALID_TYPE_PLANS.includes(body.typePlan as TypePlan)) {
      errors.push({
        field: "typePlan",
        message: `Le type de plan est obligatoire. Valeurs acceptees : ${VALID_TYPE_PLANS.join(", ")}`,
      });
    }

    if (
      body.prixMensuel !== undefined &&
      body.prixMensuel !== null &&
      (typeof body.prixMensuel !== "number" || body.prixMensuel < 0)
    ) {
      errors.push({
        field: "prixMensuel",
        message: "Le prix mensuel doit etre un nombre >= 0.",
      });
    }

    if (
      body.prixTrimestriel !== undefined &&
      body.prixTrimestriel !== null &&
      (typeof body.prixTrimestriel !== "number" || body.prixTrimestriel < 0)
    ) {
      errors.push({
        field: "prixTrimestriel",
        message: "Le prix trimestriel doit etre un nombre >= 0.",
      });
    }

    if (
      body.prixAnnuel !== undefined &&
      body.prixAnnuel !== null &&
      (typeof body.prixAnnuel !== "number" || body.prixAnnuel < 0)
    ) {
      errors.push({
        field: "prixAnnuel",
        message: "Le prix annuel doit etre un nombre >= 0.",
      });
    }

    // Valider modulesInclus : uniquement les modules site-level (pas les modules platform)
    let modulesInclus: SiteModule[] | undefined;
    if (body.modulesInclus !== undefined) {
      if (!Array.isArray(body.modulesInclus)) {
        errors.push({
          field: "modulesInclus",
          message: "modulesInclus doit etre un tableau.",
        });
      } else {
        const invalidModules = (body.modulesInclus as string[]).filter(
          (m) => !VALID_SITE_MODULES.includes(m as SiteModule)
        );
        if (invalidModules.length > 0) {
          return NextResponse.json(
            {
              status: 400,
              message: `Modules non autorises (platform ou inconnus) : ${invalidModules.join(", ")}. Seuls les modules site-level sont acceptes : ${VALID_SITE_MODULES.join(", ")}`,
              errorKey: ErrorKeys.INVALID_PLATFORM_MODULE,
            },
            { status: 400 }
          );
        }
        modulesInclus = body.modulesInclus as SiteModule[];
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreatePlanAbonnementDTO = {
      nom: body.nom.trim(),
      typePlan: body.typePlan as TypePlan,
      description: body.description?.trim() || undefined,
      prixMensuel: body.prixMensuel ?? undefined,
      prixTrimestriel: body.prixTrimestriel ?? undefined,
      prixAnnuel: body.prixAnnuel ?? undefined,
      limitesSites: body.limitesSites ?? undefined,
      limitesBacs: body.limitesBacs ?? undefined,
      limitesVagues: body.limitesVagues ?? undefined,
      limitesIngFermes: body.limitesIngFermes ?? undefined,
      isActif: body.isActif ?? undefined,
      isPublic: body.isPublic ?? undefined,
      modulesInclus: modulesInclus ?? [],
    };

    const plan = await createPlanAbonnement(data);
    return NextResponse.json(plan, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json(
        {
          status: 409,
          message: "Un plan avec ce type existe deja.",
          errorKey: ErrorKeys.CONFLICT_PLAN_TYPE_EXISTS,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du plan.", errorKey: ErrorKeys.SERVER_CREATE_PLAN },
      { status: 500 }
    );
  }
}
