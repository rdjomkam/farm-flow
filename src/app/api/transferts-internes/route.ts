import { NextRequest, NextResponse } from "next/server";
import {
  getTransfertsInternes,
  createTransfertInterne,
} from "@/lib/queries/transferts-internes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateTransfertInterneDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { parsePaginationQuery } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { searchParams } = new URL(request.url);
    const uniteProductionId = searchParams.get("uniteProductionId") ?? undefined;
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }

    const result = await getTransfertsInternes(
      auth.activeSiteId,
      { uniteProductionId },
      paginationResult.params
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(
      "GET /api/transferts-internes",
      error,
      "Erreur lors de la recuperation des transferts internes."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.uniteSourceId || typeof body.uniteSourceId !== "string") {
      errors.push({ field: "uniteSourceId", message: "L'unite source est obligatoire." });
    }
    if (!body.uniteDestinationId || typeof body.uniteDestinationId !== "string") {
      errors.push({ field: "uniteDestinationId", message: "L'unite destination est obligatoire." });
    }
    if (!body.nombrePoissons || typeof body.nombrePoissons !== "number" || body.nombrePoissons <= 0) {
      errors.push({ field: "nombrePoissons", message: "Le nombre de poissons doit etre positif." });
    }
    if (!body.prixUnitaire || typeof body.prixUnitaire !== "number" || body.prixUnitaire <= 0) {
      errors.push({ field: "prixUnitaire", message: "Le prix unitaire doit etre positif." });
    }
    if (body.prixBase && !["PAR_POISSON", "PAR_KG"].includes(body.prixBase)) {
      errors.push({ field: "prixBase", message: "La base de prix doit etre PAR_POISSON ou PAR_KG." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreateTransfertInterneDTO = {
      uniteSourceId: body.uniteSourceId,
      uniteDestinationId: body.uniteDestinationId,
      lotAlevinsId: body.lotAlevinsId || undefined,
      vagueDestinationId: body.vagueDestinationId || undefined,
      nombrePoissons: body.nombrePoissons,
      poidsMoyenG: body.poidsMoyenG || undefined,
      prixUnitaire: body.prixUnitaire,
      prixBase: body.prixBase || undefined,
      date: body.date || undefined,
      description: body.description?.trim() || undefined,
    };

    const transfert = await createTransfertInterne(
      auth.activeSiteId,
      auth.userId,
      dto
    );
    return NextResponse.json(transfert, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/transferts-internes",
      error,
      "Erreur lors de la creation du transfert interne."
    );
  }
}
