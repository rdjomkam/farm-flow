import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, UniteStock } from "@/types";
import { getPackProduits, addPackProduit, removePackProduit } from "@/lib/queries/packs";

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
      return NextResponse.json({ status: 404, message: "Pack introuvable." }, { status: 404 });
    }

    return NextResponse.json({ produits, total: produits.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des produits." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { status: 400, message: "L'identifiant du produit est requis." },
        { status: 400 }
      );
    }
    if (!body.quantite || typeof body.quantite !== "number" || body.quantite <= 0) {
      return NextResponse.json(
        { status: 400, message: "La quantite doit etre superieure a 0." },
        { status: 400 }
      );
    }

    // Validate unite if provided
    if (body.unite !== undefined && body.unite !== null) {
      const validUnites = Object.values(UniteStock);
      if (!validUnites.includes(body.unite)) {
        return NextResponse.json(
          { status: 400, message: "Unite invalide." },
          { status: 400 }
        );
      }
    }

    const packProduit = await addPackProduit(id, auth.activeSiteId, {
      produitId: body.produitId,
      quantite: body.quantite,
      unite: body.unite || undefined,
    });

    if (packProduit === null) {
      return NextResponse.json({ status: 404, message: "Pack introuvable." }, { status: 404 });
    }

    return NextResponse.json(packProduit, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    // Contrainte unique violee (packId + produitId)
    if (error instanceof Error && (
      error.message.includes("Unique constraint") ||
      error.message.includes("unique")
    )) {
      return NextResponse.json(
        { status: 409, message: "Ce produit est deja dans le pack." },
        { status: 409 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ status: 400, message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de l'ajout du produit." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { status: 400, message: "L'identifiant du produit est requis." },
        { status: 400 }
      );
    }

    const deleted = await removePackProduit(id, produitId, auth.activeSiteId);
    if (!deleted) {
      return NextResponse.json(
        { status: 404, message: "Produit ou Pack introuvable." },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la suppression du produit." },
      { status: 500 }
    );
  }
}
