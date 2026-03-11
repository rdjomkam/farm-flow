import { NextRequest, NextResponse } from "next/server";
import { completeActivite } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CompleteActiviteDTO } from "@/types";

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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (
      message.includes("requis") ||
      message.includes("deja lie") ||
      message.includes("PLANIFIEE") ||
      message.includes("minimum")
    ) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    console.error("[POST /api/activites/[id]/complete]", error);
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
