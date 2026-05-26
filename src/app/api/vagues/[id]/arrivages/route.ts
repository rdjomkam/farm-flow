import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { listArrivagesForVague } from "@/lib/queries/arrivages";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id: vagueId } = await params;

    const arrivages = await listArrivagesForVague(auth.activeSiteId, vagueId);

    return cachedJson({ data: arrivages }, "medium");
  } catch (error) {
    return handleApiError(
      "GET /api/vagues/[id]/arrivages",
      error,
      "Erreur lors de la récupération."
    );
  }
}
