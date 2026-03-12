import { NextRequest, NextResponse } from "next/server";
import {
  getProduitById,
  updateProduit,
  deleteProduit,
} from "@/lib/queries/produits";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, CategorieProduit, UniteStock } from "@/types";
import type { UpdateProduitDTO } from "@/types";

const VALID_CATEGORIES = Object.values(CategorieProduit);
const VALID_UNITES = Object.values(UniteStock);

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { id } = await params;

    const produit = await getProduitById(id, auth.activeSiteId);
    if (!produit) {
      return NextResponse.json(
        { status: 404, message: "Produit introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(produit);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_GERER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (body.categorie !== undefined && !VALID_CATEGORIES.includes(body.categorie)) {
      errors.push({
        field: "categorie",
        message: `La categorie doit etre : ${VALID_CATEGORIES.join(", ")}.`,
      });
    }

    if (body.unite !== undefined && !VALID_UNITES.includes(body.unite)) {
      errors.push({
        field: "unite",
        message: `L'unite doit etre : ${VALID_UNITES.join(", ")}.`,
      });
    }

    if (body.prixUnitaire !== undefined && (typeof body.prixUnitaire !== "number" || body.prixUnitaire < 0)) {
      errors.push({ field: "prixUnitaire", message: "Le prix unitaire doit etre un nombre >= 0." });
    }

    if (body.seuilAlerte !== undefined && (typeof body.seuilAlerte !== "number" || body.seuilAlerte < 0)) {
      errors.push({ field: "seuilAlerte", message: "Le seuil d'alerte doit etre un nombre >= 0." });
    }

    // Validation uniteAchat + contenance
    const hasUniteAchat = body.uniteAchat !== undefined && body.uniteAchat !== null;
    const hasContenance = body.contenance !== undefined && body.contenance !== null;

    if (hasUniteAchat !== hasContenance) {
      errors.push({
        field: hasUniteAchat ? "contenance" : "uniteAchat",
        message: "L'unite d'achat et la contenance doivent etre fournies ensemble.",
      });
    }

    if (hasUniteAchat) {
      if (!VALID_UNITES.includes(body.uniteAchat)) {
        errors.push({
          field: "uniteAchat",
          message: `L'unite d'achat doit etre : ${VALID_UNITES.join(", ")}.`,
        });
      }
      const effectiveUnite = body.unite ?? undefined;
      if (body.uniteAchat === effectiveUnite) {
        errors.push({
          field: "uniteAchat",
          message: "L'unite d'achat ne peut pas etre identique a l'unite de base.",
        });
      }
    }

    if (hasContenance) {
      if (typeof body.contenance !== "number" || body.contenance <= 0) {
        errors.push({
          field: "contenance",
          message: "La contenance doit etre un nombre > 0.",
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: UpdateProduitDTO = {};
    if (body.nom !== undefined) data.nom = body.nom.trim();
    if (body.categorie !== undefined) data.categorie = body.categorie;
    if (body.unite !== undefined) data.unite = body.unite;
    if (body.prixUnitaire !== undefined) data.prixUnitaire = body.prixUnitaire;
    if (body.seuilAlerte !== undefined) data.seuilAlerte = body.seuilAlerte;
    if (body.fournisseurId !== undefined) data.fournisseurId = body.fournisseurId;
    if (body.uniteAchat !== undefined) data.uniteAchat = body.uniteAchat;
    if (body.contenance !== undefined) data.contenance = body.contenance;

    const produit = await updateProduit(id, auth.activeSiteId, data);
    return NextResponse.json(produit);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("contenance non modifiable")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_GERER);
    const { id } = await params;

    await deleteProduit(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
