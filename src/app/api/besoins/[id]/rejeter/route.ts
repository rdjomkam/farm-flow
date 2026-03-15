import { NextRequest, NextResponse } from "next/server";
import { rejeterBesoins } from "@/lib/queries/besoins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Transition invalide")) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}
