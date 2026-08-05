import { NextRequest, NextResponse } from "next/server";
import { updateAlimentArticlePrevision } from "@/lib/queries/previsions-aliments";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { updateAlimentArticlePrevisionSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * PATCH /api/previsions/aliments/[id]/articles/[articleId] — modifie un
 * article existant (marque, poids de sac, prix, rapprochement produit) —
 * jamais sa part d'approvisionnement (voir POST .../articles, seul point qui
 * l'ecrit, ADR-053 §12.6). PREVISIONS_PARAMETRER.
 *
 * `[id]` (le calibre parent) n'est pas utilise pour l'ecriture elle-meme
 * (l'article est identifie par `articleId`, deja scope par `siteId`), mais
 * fait partie du chemin pour la lisibilite de l'URL — coherent avec la route
 * soeur `.../aliments/[id]/repartitions`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { articleId } = await params;
    const body = await request.json();

    const parsed = parseBody(updateAlimentArticlePrevisionSchema, body);
    if (parsed.error) return parsed.error;

    const aliment = await updateAlimentArticlePrevision(articleId, auth.activeSiteId, parsed.data);
    return NextResponse.json(aliment);
  } catch (error) {
    return handleApiError(
      "PATCH /api/previsions/aliments/[id]/articles/[articleId]",
      error,
      "Erreur serveur lors de la mise a jour de l'article previsionnel."
    );
  }
}
