import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, UniteStock } from "@/types";
import { getPackProduits, addPackProduit, removePackProduit } from "@/lib/queries/packs";
import { apiError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/packs/[id]/produits
 * Liste les produits d'un Pack.
 * Permission : DASHBOARD_VOIR
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const produits = await getPackProduits(id, auth.activeSiteId);
    if (produits === null) {
      return apiError(404, "Pack introuvable.");
    }

    return NextResponse.json({ produits, total: produits.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des produits.");
  }
}

/**
 * POST /api/packs/[id]/produits
 * Ajoute un produit dans un Pack.
 * Permission : GERER_PACKS
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const body = await request.json();

    if (!body.produitId || typeof body.produitId !== "string") {
      return apiError(400, "L'identifiant du produit est requis.");
    }
    if (!body.quantite || typeof body.quantite !== "number" || body.quantite <= 0) {
      return apiError(400, "La quantite doit etre superieure a 0.");
    }

    // Validate unite if provided
    if (body.unite !== undefined && body.unite !== null) {
      const validUnites = Object.values(UniteStock);
      if (!validUnites.includes(body.unite)) {
        return apiError(400, "Unite invalide.");
      }
    }

    const packProduit = await addPackProduit(id, auth.activeSiteId, {
      produitId: body.produitId,
      quantite: body.quantite,
      unite: body.unite || undefined,
    });

    if (packProduit === null) {
      return apiError(404, "Pack introuvable.");
    }

    return NextResponse.json(packProduit, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    // Contrainte unique violee (packId + produitId)
    if (error instanceof Error && (
      error.message.includes("Unique constraint") ||
      error.message.includes("unique")
    )) {
      return apiError(409, "Ce produit est deja dans le pack.");
    }
    if (error instanceof Error) {
      return apiError(400, error.message);
    }
    return apiError(500, "Erreur serveur lors de l'ajout du produit.");
  }
}

/**
 * DELETE /api/packs/[id]/produits?produitId=xxx
 * Supprime un produit d'un Pack.
 * Permission : GERER_PACKS
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const { searchParams } = new URL(request.url);
    const produitId = searchParams.get("produitId");

    if (!produitId) {
      return apiError(400, "L'identifiant du produit est requis.");
    }

    const deleted = await removePackProduit(id, produitId, auth.activeSiteId);
    if (!deleted) {
      return apiError(404, "Produit ou Pack introuvable.");
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la suppression du produit.");
  }
}
