import { NextRequest, NextResponse } from "next/server";
import { completeActivite } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CompleteActiviteDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_GERER);
    const { id } = await params;
    const body = await request.json();

    const data: CompleteActiviteDTO = {};
    if (body.releveId) data.releveId = body.releveId;
    if (body.noteCompletion) data.noteCompletion = body.noteCompletion;

    const activite = await completeActivite(auth.activeSiteId, id, data);

    return NextResponse.json(activite);
  } catch (error) {
    return handleApiError("POST /api/activites/[id]/complete", error, "Erreur serveur.", {
      statusMap: [
        { match: ["requis", "deja lie", "PLANIFIEE", "minimum"], status: 400 },
      ],
    });
  }
}
