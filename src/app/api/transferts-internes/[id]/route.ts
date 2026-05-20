import { NextRequest, NextResponse } from "next/server";
import { getTransfertInterneById } from "@/lib/queries/transferts-internes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { id } = await context.params;

    const transfert = await getTransfertInterneById(id, auth.activeSiteId);
    if (!transfert) {
      return apiError(404, "Transfert interne introuvable");
    }

    return NextResponse.json(transfert);
  } catch (error) {
    return handleApiError(
      "GET /api/transferts-internes/[id]",
      error,
      "Erreur lors de la recuperation du transfert interne."
    );
  }
}
