import { NextRequest, NextResponse } from "next/server";
import { annulerVaguePrevue } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * POST /api/previsions/vagues-prevues/[id]/annuler — statut -> ANNULEE.
 * PREVISIONS_GERER.
 *
 * Remplace toute suppression physique (ADR-053 decision 2) : la query
 * `annulerVaguePrevue` verifie elle-meme qu'aucune vague reelle n'est
 * rattachee avant d'ecrire, sinon leve "Impossible d'annuler ..." — deja
 * mappe a 409 par le pattern generique de `handleApiError`
 * (`message.includes("Impossible")`), aucun traitement supplementaire requis.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;

    const vaguePrevue = await annulerVaguePrevue(id, auth.activeSiteId);
    return NextResponse.json(vaguePrevue);
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/vagues-prevues/[id]/annuler",
      error,
      "Erreur serveur lors de l'annulation de la vague prevue."
    );
  }
}
