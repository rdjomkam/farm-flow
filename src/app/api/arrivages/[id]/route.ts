import { NextRequest, NextResponse } from "next/server";
import { getArrivageById } from "@/lib/queries/arrivages";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id } = await params;

    const arrivage = await getArrivageById(auth.activeSiteId, id);
    if (!arrivage) {
      return apiError(404, "Arrivage introuvable");
    }

    return NextResponse.json(arrivage);
  } catch (error) {
    return handleApiError("GET /api/arrivages/[id]", error, "Erreur lors de la récupération.");
  }
}
