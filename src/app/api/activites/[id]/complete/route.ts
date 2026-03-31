import { NextRequest, NextResponse } from "next/server";
import { completeActivite } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CompleteActiviteDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (
      message.includes("requis") ||
      message.includes("deja lie") ||
      message.includes("PLANIFIEE") ||
      message.includes("minimum")
    ) {
      return apiError(400, message);
    }
    console.error("[POST /api/activites/[id]/complete]", error);
    return apiError(500, message);
  }
}
