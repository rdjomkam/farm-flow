import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { listTransfertsForVague } from "@/lib/queries/transferts";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id: vagueId } = await params;
    const { searchParams } = new URL(request.url);

    const directionRaw = searchParams.get("direction");

    // direction est obligatoire pour cette route
    if (!directionRaw) {
      return apiError(400, "Le parametre 'direction' est obligatoire. Valeurs acceptees : source, destination.");
    }
    if (directionRaw !== "source" && directionRaw !== "destination") {
      return apiError(400, "Le parametre 'direction' doit etre 'source' ou 'destination'.");
    }

    const direction = directionRaw as "source" | "destination";

    const groupes = await listTransfertsForVague(auth.activeSiteId, vagueId, direction);

    return cachedJson({ groupes, total: groupes.length }, "medium");
  } catch (error) {
    return handleApiError(
      "GET /api/vagues/[id]/transferts",
      error,
      "Erreur serveur lors de la recuperation des transferts de la vague."
    );
  }
}
