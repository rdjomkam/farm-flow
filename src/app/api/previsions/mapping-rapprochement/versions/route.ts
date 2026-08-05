import { NextRequest, NextResponse } from "next/server";
import { getVersionsDisponibles } from "@/lib/queries/previsions-rapprochement-mapping";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * GET /api/previsions/mapping-rapprochement/versions — liste les versions
 * DISTINCTES de `MappingRapprochement` deja creees pour le site actif,
 * triees decroissant (Sprint PR3-ter, story C.3).
 *
 * Alimente le selecteur de version de l'ecran d'administration du mapping
 * (`RapprochementMappingTab`) : `GET /api/previsions/mapping-rapprochement
 * ?version=N` existait deja (Sprint PR3, story PR3.6) mais restait
 * INUTILISE faute de savoir quelles valeurs de N proposer — cette route
 * comble ce manque (ADR-053 §6.2/§15.3 : le mapping est versionne, consulter
 * une version passee a du sens).
 *
 * Permission : PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const data = await getVersionsDisponibles(auth.activeSiteId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/mapping-rapprochement/versions",
      error,
      "Erreur serveur lors de la recuperation des versions du mapping de rapprochement."
    );
  }
}
