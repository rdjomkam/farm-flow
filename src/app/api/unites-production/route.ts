import { NextRequest, NextResponse } from "next/server";
import {
  getUnitesProduction,
  createUniteProduction,
} from "@/lib/queries/unites-production";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeUniteProduction } from "@/types";
import type { CreateUniteProductionDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const isActive = searchParams.get("isActive");

    const data = await getUnitesProduction(auth.activeSiteId, {
      type,
      isActive: isActive !== null ? isActive === "true" : undefined,
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return handleApiError(
      "GET /api/unites-production",
      error,
      "Erreur lors de la recuperation des unites de production."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
      errors.push({ field: "code", message: "Le code est obligatoire." });
    }
    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le nom est obligatoire." });
    }
    if (
      !body.type ||
      !Object.values(TypeUniteProduction).includes(body.type)
    ) {
      errors.push({
        field: "type",
        message: `Le type doit etre ${Object.values(TypeUniteProduction).join(" ou ")}.`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreateUniteProductionDTO = {
      code: body.code.trim(),
      nom: body.nom.trim(),
      type: body.type,
      description: body.description?.trim() || undefined,
    };

    const unite = await createUniteProduction(auth.activeSiteId, dto);
    return NextResponse.json(unite, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/unites-production",
      error,
      "Erreur lors de la creation de l'unite de production."
    );
  }
}
