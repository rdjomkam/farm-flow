import { NextRequest, NextResponse } from "next/server";
import { createVenteAlevinsDepuisVague } from "@/lib/queries/ventes";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, CategorieDepense } from "@/types";
import type {
  CreateVenteAlevinsDepuisVagueDTO,
  CreateLigneVenteAlevinsPGDTO,
  DepenseVenteInput,
} from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { ConservationError, ValidationError } from "@/lib/errors";

const VALID_CATEGORIES = new Set(Object.values(CategorieDepense));

/**
 * POST /api/vagues/[id]/vente-alevins
 *
 * Cree une vente d'alevins depuis une vague PRE_GROSSISSEMENT — les poissons
 * restants d'une vague de pre-grossissement sont vendus comme alevins.
 * Reutilise l'infrastructure Vente/LigneVente (origineType = ALEVINS_PG).
 *
 * Permission : VENTES_CREER (+ VAGUES_MODIFIER si autoCloture demande)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_CREER);
    const { id: vagueId } = await params;

    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    if (!body.clientId || typeof body.clientId !== "string") {
      errors.push({ field: "clientId", message: "Le client est obligatoire." });
    }

    if (
      !body.dateCommande ||
      typeof body.dateCommande !== "string" ||
      isNaN(Date.parse(body.dateCommande))
    ) {
      errors.push({ field: "dateCommande", message: "La date de commande est obligatoire (format ISO 8601)." });
    }

    if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
      errors.push({ field: "lignes", message: "Au moins une ligne de vente est requise." });
    } else {
      for (let i = 0; i < body.lignes.length; i++) {
        const ligne = body.lignes[i];
        if (!ligne || typeof ligne.bacId !== "string" || !ligne.bacId) {
          errors.push({ field: `lignes[${i}].bacId`, message: "bacId est obligatoire." });
        }
        if (!ligne || typeof ligne.nombrePoissons !== "number" || ligne.nombrePoissons <= 0) {
          errors.push({ field: `lignes[${i}].nombrePoissons`, message: "nombrePoissons doit etre > 0." });
        }
        if (!ligne || typeof ligne.poidsMoyenG !== "number" || ligne.poidsMoyenG <= 0) {
          errors.push({ field: `lignes[${i}].poidsMoyenG`, message: "poidsMoyenG doit etre > 0." });
        }
        if (!ligne || typeof ligne.prixUnitaireKg !== "number" || ligne.prixUnitaireKg < 0) {
          errors.push({ field: `lignes[${i}].prixUnitaireKg`, message: "prixUnitaireKg doit etre >= 0." });
        }
      }
    }

    let depenses: DepenseVenteInput[] | undefined;
    if (body.depenses !== undefined) {
      if (!Array.isArray(body.depenses)) {
        errors.push({ field: "depenses", message: "depenses doit etre un tableau." });
      } else {
        depenses = [];
        for (let i = 0; i < body.depenses.length; i++) {
          const dep = body.depenses[i];
          if (!dep || typeof dep.description !== "string" || dep.description.trim() === "") {
            errors.push({ field: `depenses[${i}].description`, message: "La description est obligatoire." });
          }
          if (!dep || !VALID_CATEGORIES.has(dep.categorieDepense)) {
            errors.push({ field: `depenses[${i}].categorieDepense`, message: "La categorie est invalide." });
          }
          if (!dep || typeof dep.montantTotal !== "number" || dep.montantTotal <= 0) {
            errors.push({ field: `depenses[${i}].montantTotal`, message: "montantTotal doit etre > 0." });
          }
          if (dep) {
            depenses.push({
              description: dep.description?.trim() ?? "",
              categorieDepense: dep.categorieDepense as CategorieDepense,
              montantTotal: dep.montantTotal,
              montantPaye: typeof dep.montantPaye === "number" ? dep.montantPaye : undefined,
              notes: dep.notes?.trim() || undefined,
            });
          }
        }
      }
    }

    if (body.autoCloture !== undefined && typeof body.autoCloture !== "boolean") {
      errors.push({ field: "autoCloture", message: "autoCloture doit etre un booleen." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // VAGUES_MODIFIER requis si autoCloture demande (la vente peut cloturer la vague)
    if (body.autoCloture === true && !auth.permissions.includes(Permission.VAGUES_MODIFIER)) {
      throw new ForbiddenError(
        "Permission VAGUES_MODIFIER requise pour cloturer automatiquement la vague."
      );
    }

    const lignes: CreateLigneVenteAlevinsPGDTO[] = (
      body.lignes as Array<{
        bacId: string;
        nombrePoissons: number;
        poidsMoyenG: number;
        prixUnitaireKg: number;
      }>
    ).map((l) => ({
      bacId: l.bacId,
      nombrePoissons: l.nombrePoissons,
      poidsMoyenG: l.poidsMoyenG,
      prixUnitaireKg: l.prixUnitaireKg,
    }));

    const data: CreateVenteAlevinsDepuisVagueDTO = {
      vagueId,
      clientId: body.clientId,
      dateCommande: body.dateCommande,
      lignes,
      depenses,
      autoCloture: body.autoCloture === true,
      notes: body.notes?.trim() || undefined,
    };

    const vente = await createVenteAlevinsDepuisVague(auth.activeSiteId, auth.userId, data);

    return NextResponse.json(vente, { status: 201 });
  } catch (error) {
    if (error instanceof ConservationError) {
      return NextResponse.json(
        {
          status: 422,
          message: error.message,
          details: {
            sources: error.sourcesTotal,
            saisi: error.saisiTotal,
            ecart: error.ecart,
            morts: error.nombreMorts,
          },
        },
        { status: 422 }
      );
    }
    if (error instanceof ValidationError) {
      return apiError(400, error.message);
    }
    return handleApiError(
      "POST /api/vagues/[id]/vente-alevins",
      error,
      "Erreur serveur lors de la creation de la vente d'alevins.",
      {
        statusMap: [
          { match: "inactif", status: 404 },
          { match: "introuvable", status: 404 },
          { match: ["insuffisant", "disponible"], status: 409 },
        ],
      }
    );
  }
}
