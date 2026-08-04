import { NextRequest, NextResponse } from "next/server";
import { getVaguePrevueById, updateVaguePrevue } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { updateVaguePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * GET /api/previsions/vagues-prevues/[id] — detail d'une VaguePrevue (aliments
 * par mois, journal affecte, vague reelle liee, enfants de scission).
 * PREVISIONS_VOIR.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const vaguePrevue = await getVaguePrevueById(id, auth.activeSiteId);
    if (!vaguePrevue) {
      return apiError(404, "VaguePrevue introuvable.");
    }

    return NextResponse.json(vaguePrevue);
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/vagues-prevues/[id]",
      error,
      "Erreur serveur lors de la recuperation de la vague prevue.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}

/**
 * PUT /api/previsions/vagues-prevues/[id] — met a jour une VaguePrevue
 * (champs editables uniquement, `dureeCycleMoisFigee` reste gelee — ADR-053
 * decision 1). PREVISIONS_GERER.
 *
 * AUCUNE route DELETE n'existe sur cette collection, VOLONTAIREMENT :
 * la suppression d'une VaguePrevue rattachee a une vague reelle est
 * interdite par l'ADR-053 decision 2 — aucune fonction query
 * `deleteVaguePrevue` n'existe (`src/lib/queries/previsions-vagues.ts`),
 * ce qui rend ce contournement structurellement impossible depuis cette
 * couche. Utiliser `POST /vagues-prevues/[id]/annuler` (statut -> ANNULEE)
 * a la place.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(updateVaguePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const vaguePrevue = await updateVaguePrevue(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(vaguePrevue);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/vagues-prevues/[id]",
      error,
      "Erreur serveur lors de la mise a jour de la vague prevue.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
