import { NextRequest, NextResponse } from "next/server";
import { creerCommandeDepuisBesoin } from "@/lib/queries/besoins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreerCommandeDepuisBesoinDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * POST /api/besoins/[id]/commandes
 * Cree une (ou plusieurs) Commande BROUILLON pour des lignes de besoin orphelines
 * (commandeId IS NULL) sur un besoin TRAITEE ou CLOTUREE.
 *
 * Permission : BESOINS_TRAITER
 * Body : CreerCommandeDepuisBesoinDTO
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BESOINS_TRAITER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (
      !Array.isArray(body.ligneBesoinIds) ||
      body.ligneBesoinIds.length === 0
    ) {
      errors.push({
        field: "ligneBesoinIds",
        message: "ligneBesoinIds doit etre un tableau non vide.",
      });
    } else {
      body.ligneBesoinIds.forEach((idLigne: unknown, i: number) => {
        if (!idLigne || typeof idLigne !== "string") {
          errors.push({
            field: `ligneBesoinIds[${i}]`,
            message: `ligneBesoinIds[${i}] doit etre une chaine.`,
          });
        }
      });
    }

    if (
      body.fournisseurId !== undefined &&
      body.fournisseurId !== null &&
      typeof body.fournisseurId !== "string"
    ) {
      errors.push({
        field: "fournisseurId",
        message: "fournisseurId doit etre une chaine.",
      });
    }

    if (
      body.dateCommande !== undefined &&
      body.dateCommande !== null &&
      typeof body.dateCommande !== "string"
    ) {
      errors.push({
        field: "dateCommande",
        message: "dateCommande doit etre une chaine ISO 8601.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreerCommandeDepuisBesoinDTO = {
      ligneBesoinIds: body.ligneBesoinIds,
      fournisseurId: body.fournisseurId || undefined,
      dateCommande: body.dateCommande || undefined,
    };

    const listeBesoins = await creerCommandeDepuisBesoin(
      id,
      auth.activeSiteId,
      auth.userId,
      dto
    );
    return NextResponse.json(listeBesoins, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/besoins/[id]/commandes",
      error,
      "Erreur serveur lors de la creation de la commande."
    );
  }
}
