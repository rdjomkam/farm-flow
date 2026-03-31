import { NextRequest, NextResponse } from "next/server";
import {
  getProduitById,
  updateProduit,
  deleteProduit,
} from "@/lib/queries/produits";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, CategorieProduit, UniteStock, TailleGranule, FormeAliment, PhaseElevage } from "@/types";
import type { UpdateProduitDTO } from "@/types";

const VALID_CATEGORIES = Object.values(CategorieProduit);
const VALID_UNITES = Object.values(UniteStock);
const VALID_TAILLE_GRANULE = Object.values(TailleGranule);
const VALID_FORME_ALIMENT = Object.values(FormeAliment);
const VALID_PHASES_ELEVAGE = Object.values(PhaseElevage);

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { id } = await params;

    const produit = await getProduitById(id, auth.activeSiteId);
    if (!produit) {
      return apiError(404, "Produit introuvable.");
    }

    return NextResponse.json(produit);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
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

    // Validation champs analytiques aliment (optionnels)
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

    const data: UpdateProduitDTO = {};
    if (body.nom !== undefined) data.nom = body.nom.trim();
    if (body.categorie !== undefined) data.categorie = body.categorie;
    if (body.unite !== undefined) data.unite = body.unite;
    if (body.prixUnitaire !== undefined) data.prixUnitaire = body.prixUnitaire;
    if (body.seuilAlerte !== undefined) data.seuilAlerte = body.seuilAlerte;
    if (body.fournisseurId !== undefined) data.fournisseurId = body.fournisseurId;
    if (body.uniteAchat !== undefined) data.uniteAchat = body.uniteAchat;
    if (body.contenance !== undefined) data.contenance = body.contenance;
    if (body.tailleGranule !== undefined) data.tailleGranule = body.tailleGranule;
    if (body.formeAliment !== undefined) data.formeAliment = body.formeAliment;
    if (body.tauxProteines !== undefined) data.tauxProteines = body.tauxProteines;
    if (body.tauxLipides !== undefined) data.tauxLipides = body.tauxLipides;
    if (body.tauxFibres !== undefined) data.tauxFibres = body.tauxFibres;
    if (body.phasesCibles !== undefined) data.phasesCibles = body.phasesCibles;

    const produit = await updateProduit(id, auth.activeSiteId, data);
    return NextResponse.json(produit);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("contenance non modifiable")) {
      return apiError(409, message);
    }
    return apiError(500, message);
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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    return apiError(500, message);
  }
}
