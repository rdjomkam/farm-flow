import { NextRequest, NextResponse } from "next/server";
import {
  getAlimentPrevisionById,
  deleteAlimentPrevision,
  updateAlimentPrevision,
} from "@/lib/queries/previsions-aliments";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { updateAlimentPrevisionSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/** GET /api/previsions/aliments/[id] — detail d'un AlimentPrevision avec ses repartitions. PREVISIONS_VOIR. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const aliment = await getAlimentPrevisionById(id, auth.activeSiteId);
    if (!aliment) {
      return apiError(404, "Aliment previsionnel introuvable.");
    }

    return NextResponse.json(aliment);
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/aliments/[id]",
      error,
      "Erreur serveur lors de la recuperation de l'aliment previsionnel."
    );
  }
}

/**
 * PATCH /api/previsions/aliments/[id] — modifie les champs du CALIBRE
 * (`sacsParTonneStandard`, `ordre`, champs article : `libelle`, `poidsSacKg`,
 * `prixSacFCFA`, `produitId`) — jamais `tailleGranule` (identite du calibre).
 * PREVISIONS_PARAMETRER.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(updateAlimentPrevisionSchema, body);
    if (parsed.error) return parsed.error;

    const aliment = await updateAlimentPrevision(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(aliment);
  } catch (error) {
    return handleApiError(
      "PATCH /api/previsions/aliments/[id]",
      error,
      "Erreur serveur lors de la mise a jour de l'aliment previsionnel."
    );
  }
}

/**
 * DELETE /api/previsions/aliments/[id] — supprime un AlimentPrevision
 * (referentiel). PREVISIONS_PARAMETRER.
 *
 * Le cascade DB (`onDelete: Restrict` sur `AlimentParVaguePrevue.alimentPrevisionId`,
 * ADR-053 section 3.6) fait echouer la suppression si des lignes de besoin
 * par vague existent deja pour cet aliment — remonte ici comme un P2003
 * generique via `handleApiError`, aucune verification prealable dupliquee.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;

    await deleteAlimentPrevision(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(
      "DELETE /api/previsions/aliments/[id]",
      error,
      "Erreur serveur lors de la suppression de l'aliment previsionnel."
    );
  }
}
