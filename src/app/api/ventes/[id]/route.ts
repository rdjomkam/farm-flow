import { NextRequest, NextResponse } from "next/server";
import { getVenteById } from "@/lib/queries/ventes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { id } = await params;

    const vente = await getVenteById(id, auth.activeSiteId);
    if (!vente) {
      return apiError(404, "Vente introuvable.");
    }

    return NextResponse.json(vente);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}
