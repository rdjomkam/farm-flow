import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getProduits, createProduit } from "@/lib/queries/produits";
import { requirePermission } from "@/lib/permissions";
import { Permission, CategorieProduit, UniteStock, TailleGranule, FormeAliment, PhaseElevage } from "@/types";
import type { CreateProduitDTO, ProduitFilters } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_CATEGORIES = Object.values(CategorieProduit);
const VALID_UNITES = Object.values(UniteStock);
const VALID_TAILLE_GRANULE = Object.values(TailleGranule);
const VALID_FORME_ALIMENT = Object.values(FormeAliment);
const VALID_PHASES_ELEVAGE = Object.values(PhaseElevage);

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

    const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? 50 : limitParam, 200);
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

    const result = await getProduits(auth.activeSiteId, filters, { limit, offset });

    return cachedJson({ data: result.data, total: result.total, limit, offset }, "medium");
  } catch (error) {
    return handleApiError("GET /api/produits", error, "Erreur serveur lors de la recuperation des produits.");
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

    // Validation champs analytiques aliment (optionnels, valides uniquement si categorie === ALIMENT)
    if (body.tailleGranule !== undefined && body.tailleGranule !== null) {
      if (!VALID_TAILLE_GRANULE.includes(body.tailleGranule)) {
        errors.push({
          field: "tailleGranule",
          message: `La taille de granule doit etre : ${VALID_TAILLE_GRANULE.join(", ")}.`,
        });
      }
    }

    if (body.formeAliment !== undefined && body.formeAliment !== null) {
      if (!VALID_FORME_ALIMENT.includes(body.formeAliment)) {
        errors.push({
          field: "formeAliment",
          message: `La forme de l'aliment doit etre : ${VALID_FORME_ALIMENT.join(", ")}.`,
        });
      }
    }

    if (body.tauxProteines !== undefined && body.tauxProteines !== null) {
      if (typeof body.tauxProteines !== "number" || body.tauxProteines < 0 || body.tauxProteines > 100) {
        errors.push({ field: "tauxProteines", message: "Le taux de proteines doit etre un nombre entre 0 et 100." });
      }
    }

    if (body.tauxLipides !== undefined && body.tauxLipides !== null) {
      if (typeof body.tauxLipides !== "number" || body.tauxLipides < 0 || body.tauxLipides > 100) {
        errors.push({ field: "tauxLipides", message: "Le taux de lipides doit etre un nombre entre 0 et 100." });
      }
    }

    if (body.tauxFibres !== undefined && body.tauxFibres !== null) {
      if (typeof body.tauxFibres !== "number" || body.tauxFibres < 0 || body.tauxFibres > 100) {
        errors.push({ field: "tauxFibres", message: "Le taux de fibres doit etre un nombre entre 0 et 100." });
      }
    }

    if (body.phasesCibles !== undefined && body.phasesCibles !== null) {
      if (!Array.isArray(body.phasesCibles)) {
        errors.push({ field: "phasesCibles", message: "Les phases cibles doivent etre un tableau." });
      } else {
        const invalidPhases = body.phasesCibles.filter(
          (p: unknown) => !VALID_PHASES_ELEVAGE.includes(p as PhaseElevage)
        );
        if (invalidPhases.length > 0) {
          errors.push({
            field: "phasesCibles",
            message: `Phases invalides : ${invalidPhases.join(", ")}. Valeurs acceptees : ${VALID_PHASES_ELEVAGE.join(", ")}.`,
          });
        }
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
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
      ...(body.tailleGranule !== undefined && { tailleGranule: body.tailleGranule ?? undefined }),
      ...(body.formeAliment !== undefined && { formeAliment: body.formeAliment ?? undefined }),
      ...(body.tauxProteines !== undefined && { tauxProteines: body.tauxProteines ?? undefined }),
      ...(body.tauxLipides !== undefined && { tauxLipides: body.tauxLipides ?? undefined }),
      ...(body.tauxFibres !== undefined && { tauxFibres: body.tauxFibres ?? undefined }),
      ...(body.phasesCibles !== undefined && { phasesCibles: body.phasesCibles }),
    };

    const produit = await createProduit(auth.activeSiteId, data);
    return NextResponse.json(produit, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/produits", error, "Erreur serveur lors de la creation du produit.");
  }
}
