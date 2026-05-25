import { NextRequest, NextResponse } from "next/server";
import { getTransfertById } from "@/lib/queries/transferts";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id } = await params;

    const transfert = await getTransfertById(auth.activeSiteId, id);
    if (!transfert) {
      return apiError(404, "Transfert introuvable.");
    }

    return NextResponse.json(transfert);
  } catch (error) {
    return handleApiError("GET /api/transferts/[id]", error, "Erreur serveur lors de la recuperation du transfert.");
  }
}
