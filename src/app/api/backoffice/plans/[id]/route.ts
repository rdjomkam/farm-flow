/**
 * src/app/api/backoffice/plans/[id]/route.ts
 *
 * GET    /api/backoffice/plans/[id]  — détail d'un plan
 * PUT    /api/backoffice/plans/[id]  — modifier un plan
 * DELETE /api/backoffice/plans/[id]  — désactiver un plan (409 si abonnés actifs)
 *
 * Guard : requireSuperAdmin (isSuperAdmin vérifié depuis DB, ADR-022)
 * Les plans sont des entités platform-globales sans siteId.
 *
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques via les fonctions query
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getPlanAbonnementById,
  updatePlanAbonnement,
} from "@/lib/queries/plans-abonnements";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { SiteModule } from "@/types";
import type { UpdatePlanAbonnementDTO } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { SITE_TOGGLEABLE_MODULES } from "@/lib/site-modules-config";

const VALID_SITE_MODULES = SITE_TOGGLEABLE_MODULES.map((m) => m.value);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request);
    const { id } = await params;
    const plan = await getPlanAbonnementById(id);

    if (!plan) {
      return NextResponse.json(
        { status: 404, message: "Plan introuvable.", errorKey: ErrorKeys.NOT_FOUND_PLAN },
        { status: 404 }
      );
    }

    return NextResponse.json(plan);
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
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation du plan.",
        errorKey: ErrorKeys.SERVER_GET_PLAN,
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request);
    const { id } = await params;

    const plan = await getPlanAbonnementById(id);
    if (!plan) {
      return NextResponse.json(
        { status: 404, message: "Plan introuvable.", errorKey: ErrorKeys.NOT_FOUND_PLAN },
        { status: 404 }
      );
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
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
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
      {
        status: 500,
        message: "Erreur serveur lors de la modification du plan.",
        errorKey: ErrorKeys.SERVER_UPDATE_PLAN,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request);
    const { id } = await params;

    const plan = await getPlanAbonnementById(id);
    if (!plan) {
      return NextResponse.json(
        { status: 404, message: "Plan introuvable.", errorKey: ErrorKeys.NOT_FOUND_PLAN },
        { status: 404 }
      );
    }

    // Vérifier s'il y a des abonnés actifs — R4 : pas de suppression si abonnés actifs
    if (plan._count.abonnements > 0) {
      return NextResponse.json(
        {
          status: 409,
          message: "Impossible de desactiver un plan avec des abonnes actifs.",
          errorKey: ErrorKeys.CONFLICT_CANNOT_DEACTIVATE_WITH_SUBSCRIBERS,
        },
        { status: 409 }
      );
    }

    // Soft delete : désactiver le plan (jamais de suppression physique)
    await updatePlanAbonnement(id, { isActif: false });
    return NextResponse.json({ message: "Plan desactive avec succes." });
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
      {
        status: 500,
        message: "Erreur serveur lors de la desactivation du plan.",
        errorKey: ErrorKeys.SERVER_DELETE_PLAN,
      },
      { status: 500 }
    );
  }
}
