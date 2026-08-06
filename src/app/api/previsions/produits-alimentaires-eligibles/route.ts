import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getProduitsAlimentairesEligibles } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * GET /api/previsions/produits-alimentaires-eligibles — ADR-053 §18.
 *
 * Gardee par `Permission.PREVISIONS_GERER` (la meme permission que
 * `POST /api/previsions/scenarios`), PAS `Permission.STOCK_VOIR` :
 * `SiteRole.permissions` est un tableau libre par site, un Gestionnaire
 * Previsions n'a aucune garantie d'avoir aussi des droits Stock (§18.1).
 *
 * Retourne TOUS les `Produit` ALIMENT actifs du site, SANS AUCUN filtrage
 * sur l'eligibilite (ERR-173/ERR-185 : une liste filtree ne peut pas servir
 * de base a une conclusion sur ce qu'elle cache) — chacun porte
 * `eligible`/`raisonsInvalidite` calcules cote serveur par l'unique
 * definition `evaluerEligibiliteProduitAlimentairePrevision`
 * (`src/types/api.ts`). `data: []` est deja un signal non ambigu pour cet
 * endpoint precis (pas de pagination, pas de filtre variable) : "aucun
 * produit ALIMENT actif sur ce site" — a l'UI de le rendre visible via un
 * etat vide dedie.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);

    const data = await getProduitsAlimentairesEligibles(auth.activeSiteId);

    return cachedJson({ data }, "medium");
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/produits-alimentaires-eligibles",
      error,
      "Erreur serveur lors de la recuperation des produits alimentaires eligibles."
    );
  }
}
