import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getProduits, createProduit } from "@/lib/queries/produits";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, CategorieProduit, UniteStock } from "@/types";
import type { CreateProduitDTO, ProduitFilters } from "@/types";

const VALID_CATEGORIES = Object.values(CategorieProduit);
const VALID_UNITES = Object.values(UniteStock);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: ProduitFilters = {};
    const categorie = searchParams.get("categorie");
    if (categorie && VALID_CATEGORIES.includes(categorie as CategorieProduit)) {
      filters.categorie = categorie as CategorieProduit;
    }
    const fournisseurId = searchParams.get("fournisseurId");
    if (fournisseurId) filters.fournisseurId = fournisseurId;

    const produits = await getProduits(auth.activeSiteId, filters);

    return cachedJson({ produits, total: produits.length }, "medium");
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le nom est obligatoire." });
    }

    if (!body.categorie || !VALID_CATEGORIES.includes(body.categorie)) {
      errors.push({
        field: "categorie",
        message: `La categorie doit etre : ${VALID_CATEGORIES.join(", ")}.`,
      });
    }

    if (!body.unite || !VALID_UNITES.includes(body.unite)) {
      errors.push({
        field: "unite",
        message: `L'unite doit etre : ${VALID_UNITES.join(", ")}.`,
      });
    }

    if (body.prixUnitaire == null || typeof body.prixUnitaire !== "number" || body.prixUnitaire < 0) {
      errors.push({ field: "prixUnitaire", message: "Le prix unitaire doit etre un nombre >= 0." });
    }

    if (body.seuilAlerte !== undefined && (typeof body.seuilAlerte !== "number" || body.seuilAlerte < 0)) {
      errors.push({ field: "seuilAlerte", message: "Le seuil d'alerte doit etre un nombre >= 0." });
    }

    // Validation uniteAchat + contenance (doivent etre fournis ensemble)
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
      if (body.uniteAchat === body.unite) {
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

    const data: CreateProduitDTO = {
      nom: body.nom.trim(),
      categorie: body.categorie,
      unite: body.unite,
      prixUnitaire: body.prixUnitaire,
      seuilAlerte: body.seuilAlerte,
      fournisseurId: body.fournisseurId || undefined,
      uniteAchat: body.uniteAchat || undefined,
      contenance: body.contenance || undefined,
    };

    const produit = await createProduit(auth.activeSiteId, data);
    return NextResponse.json(produit, { status: 201 });
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
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du produit." },
      { status: 500 }
    );
  }
}
