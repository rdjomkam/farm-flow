/**
 * src/app/api/backoffice/plans/route.ts
 *
 * GET  /api/backoffice/plans  — liste de tous les plans (y compris inactifs)
 * POST /api/backoffice/plans  — créer un plan
 *
 * Guard : requireSuperAdmin (isSuperAdmin vérifié depuis DB, ADR-022)
 * Les plans sont des entités platform-globales sans siteId.
 *
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques via les fonctions query
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  getPlansAbonnements,
  createPlanAbonnement,
} from "@/lib/queries/plans-abonnements";
import { apiError } from "@/lib/api-utils";
import { TypePlan, SiteModule } from "@/types";
import type { CreatePlanAbonnementDTO } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";

const VALID_TYPE_PLANS = Object.values(TypePlan);
const VALID_SITE_MODULES = SITE_TOGGLEABLE_MODULES.map((m) => m.value);

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    // Liste complète incluant les inactifs pour l'administration
    const plans = await getPlansAbonnements(true);
    return NextResponse.json({ plans, total: plans.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des plans.", { code: ErrorKeys.SERVER_GET_PLANS, });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
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
      return apiError(400, "Erreurs de validation", { errors });
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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return apiError(409, "Un plan avec ce type existe deja.", { code: ErrorKeys.CONFLICT_PLAN_TYPE_EXISTS, });
    }
    return apiError(500, "Erreur serveur lors de la creation du plan.", { code: ErrorKeys.SERVER_CREATE_PLAN, });
  }
}
