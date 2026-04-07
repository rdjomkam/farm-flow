import { NextRequest, NextResponse } from "next/server";
import { rejeterBesoins } from "@/lib/queries/besoins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * POST /api/besoins/[id]/rejeter
 * Rejette une liste de besoins (SOUMISE → REJETEE).
 *
 * Permission : BESOINS_APPROUVER
 * Body : { motif?: string }
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
    const body = await request.json().catch(() => ({}));
    const motif = body.motif as string | undefined;

    const listeBesoins = await rejeterBesoins(
      id,
      auth.activeSiteId,
      auth.userId,
      motif
    );
    return NextResponse.json(listeBesoins);
  } catch (error) {
    return handleApiError("POST /api/besoins/[id]/rejeter", error, "Erreur serveur.", {
      statusMap: [
        { match: "Transition invalide", status: 400 },
      ],
    });
  }
}
