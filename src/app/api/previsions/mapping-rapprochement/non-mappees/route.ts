import { NextRequest, NextResponse } from "next/server";
import { getCategoriesReellesNonMappees } from "@/lib/queries/previsions-rapprochement-mapping";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * GET /api/previsions/mapping-rapprochement/non-mappees — liste les cles
 * reelles (`Depense.categorieDepense`, `Produit.categorie`, `Vente`,
 * granulometrie `MouvementStock`) REELLEMENT PRESENTES dans les donnees du
 * site actif mais sans entree `MappingRapprochement` ACTIVE correspondante
 * (ADR-053 section 5, Sprint PR3 story PR3.6 ; couverture MOUVEMENT_STOCK
 * comblee suite a la review du sprint PR3, Moyenne #2) — alimente l'ecran
 * d'administration « categories a mapper ».
 *
 * Voir la JSDoc de `getCategoriesReellesNonMappees`
 * (`src/lib/queries/previsions-rapprochement-mapping.ts`) pour le perimetre
 * exact couvert (DEPENSE_CATEGORIE, PRODUIT_CATEGORIE, VENTE,
 * MOUVEMENT_STOCK).
 *
 * Permission : PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const data = await getCategoriesReellesNonMappees(auth.activeSiteId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/mapping-rapprochement/non-mappees",
      error,
      "Erreur serveur lors de la recuperation des categories reelles non mappees."
    );
  }
}
