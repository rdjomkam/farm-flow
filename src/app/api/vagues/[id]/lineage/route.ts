import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getLineage } from "@/lib/queries/transferts";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id: vagueId } = await params;

    const lineage = await getLineage(auth.activeSiteId, vagueId);

    return cachedJson(lineage, "medium");
  } catch (error) {
    return handleApiError(
      "GET /api/vagues/[id]/lineage",
      error,
      "Erreur serveur lors de la recuperation du lineage de la vague."
    );
  }
}
