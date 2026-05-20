import { NextRequest, NextResponse } from "next/server";
import {
  getUniteProductionById,
  updateUniteProduction,
} from "@/lib/queries/unites-production";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateUniteProductionDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { id } = await context.params;

    const unite = await getUniteProductionById(id, auth.activeSiteId);
    if (!unite) {
      return apiError(404, "Unite de production introuvable");
    }

    return NextResponse.json(unite);
  } catch (error) {
    return handleApiError(
      "GET /api/unites-production/[id]",
      error,
      "Erreur lors de la recuperation de l'unite de production."
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_GERER);
    const { id } = await context.params;
    const body = await request.json();

    const dto: UpdateUniteProductionDTO = {};
    if (body.nom !== undefined) dto.nom = body.nom?.trim() || undefined;
    if (body.description !== undefined) dto.description = body.description?.trim() || undefined;
    if (body.isActive !== undefined) dto.isActive = Boolean(body.isActive);

    const updated = await updateUniteProduction(id, auth.activeSiteId, dto);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(
      "PATCH /api/unites-production/[id]",
      error,
      "Erreur lors de la modification de l'unite de production."
    );
  }
}
