import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { Permission, CategorieProduit } from "@/types";
import { prisma } from "@/lib/db";

/**
 * GET /api/produits/aliment-releve
 *
 * Retourne les produits de categorie ALIMENT qui ont au moins une
 * ReleveConsommation dans le site courant. Utilise pour le selecteur
 * de filtre "Produit alimentaire" dans le filter sheet des releves.
 *
 * Response: { data: [{ id: string; nom: string; unite: string }] }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_VOIR);

    const produits = await prisma.produit.findMany({
      where: {
        siteId: auth.activeSiteId,
        categorie: CategorieProduit.ALIMENT,
        isActive: true,
        consommations: {
          some: { siteId: auth.activeSiteId },
        },
      },
      select: {
        id: true,
        nom: true,
        unite: true,
      },
      orderBy: { nom: "asc" },
    });

    return cachedJson({ data: produits }, "fast");
  } catch (error) {
    return handleApiError("GET /api/produits/aliment-releve", error, "Erreur serveur lors de la recuperation des produits alimentaires.");
  }
}
