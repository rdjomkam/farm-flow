import { NextRequest, NextResponse } from "next/server";
import { approuverBesoins } from "@/lib/queries/besoins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * POST /api/besoins/[id]/approuver
 * Approuve une liste de besoins (SOUMISE → APPROUVEE).
 *
 * Permission : BESOINS_APPROUVER
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_APPROUVER
    );
    const { id } = await params;
    const listeBesoins = await approuverBesoins(
      id,
      auth.activeSiteId,
      auth.userId
    );
    return NextResponse.json(listeBesoins);
  } catch (error) {
    return handleApiError("POST /api/besoins/[id]/approuver", error, "Erreur serveur.", {
      statusMap: [
        { match: "Transition invalide", status: 400 },
      ],
    });
  }
}
