/**
 * src/app/api/plans/[id]/route.ts
 *
 * GET    /api/plans/[id]   — détail d'un plan (auth optionnelle)
 * PUT    /api/plans/[id]   — modifier un plan (auth + PLANS_GERER)
 * DELETE /api/plans/[id]   — désactiver un plan (auth + PLANS_GERER, 409 si abonnés actifs)
 *
 * Story 32.1 — Sprint 32
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques via les fonctions query
 */
import { NextRequest, NextResponse } from "next/server";
import { getPlanAbonnementById,
  updatePlanAbonnement } from "@/lib/queries/plans-abonnements";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission, SiteModule } from "@/types";
import type { UpdatePlanAbonnementDTO } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";

const VALID_SITE_MODULES = SITE_TOGGLEABLE_MODULES.map((m) => m.value);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const plan = await getPlanAbonnementById(id);

    if (!plan) {
      return apiError(404, "Plan introuvable.", { code: ErrorKeys.NOT_FOUND_PLAN });
    }

    // Plan non public ou inactif : exiger PLANS_GERER
    if (!plan.isActif || !plan.isPublic) {
      await requirePermission(request, Permission.PLANS_GERER);
    }

    return NextResponse.json(plan);
  } catch (error) {
    return handleApiError("GET /api/plans/[id]", error, "Erreur serveur lors de la recuperation du plan.", {
      code: ErrorKeys.SERVER_GET_PLAN,
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(request, Permission.PLANS_GERER);

    const plan = await getPlanAbonnementById(id);
    if (!plan) {
      return apiError(404, "Plan introuvable.", { code: ErrorKeys.NOT_FOUND_PLAN });
    }

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

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

    const data: UpdatePlanAbonnementDTO = {
      ...(body.nom !== undefined && { nom: body.nom }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.prixMensuel !== undefined && { prixMensuel: body.prixMensuel }),
      ...(body.prixTrimestriel !== undefined && {
        prixTrimestriel: body.prixTrimestriel,
      }),
      ...(body.prixAnnuel !== undefined && { prixAnnuel: body.prixAnnuel }),
      ...(body.limitesSites !== undefined && { limitesSites: body.limitesSites }),
      ...(body.limitesBacs !== undefined && { limitesBacs: body.limitesBacs }),
      ...(body.limitesVagues !== undefined && { limitesVagues: body.limitesVagues }),
      ...(body.limitesIngFermes !== undefined && {
        limitesIngFermes: body.limitesIngFermes,
      }),
      ...(body.isActif !== undefined && { isActif: body.isActif }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      ...(modulesInclus !== undefined && { modulesInclus }),
    };

    const updated = await updatePlanAbonnement(id, data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError("PUT /api/plans/[id]", error, "Erreur serveur lors de la modification du plan.", {
      code: ErrorKeys.SERVER_UPDATE_PLAN,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(request, Permission.PLANS_GERER);

    const plan = await getPlanAbonnementById(id);
    if (!plan) {
      return apiError(404, "Plan introuvable.", { code: ErrorKeys.NOT_FOUND_PLAN });
    }

    // Vérifier s'il y a des abonnés actifs — R4 : pas de suppression si abonnés actifs
    if (plan._count.abonnements > 0) {
      return apiError(409, "Impossible de desactiver un plan avec des abonnes actifs.", { code: ErrorKeys.CONFLICT_CANNOT_DEACTIVATE_WITH_SUBSCRIBERS, });
    }

    // Soft delete : désactiver le plan (jamais de suppression physique)
    await updatePlanAbonnement(id, { isActif: false });
    return NextResponse.json({ message: "Plan desactive avec succes." });
  } catch (error) {
    return handleApiError("DELETE /api/plans/[id]", error, "Erreur serveur lors de la desactivation du plan.", {
      code: ErrorKeys.SERVER_DELETE_PLAN,
    });
  }
}
