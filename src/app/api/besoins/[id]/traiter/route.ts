import { NextRequest, NextResponse } from "next/server";
import { traiterBesoins } from "@/lib/queries/besoins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { TraiterBesoinsDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * POST /api/besoins/[id]/traiter
 * Traite une liste de besoins (APPROUVEE → TRAITEE).
 * Genere des commandes BROUILLON par fournisseur pour les lignes COMMANDE.
 * Cree une depense liee a la liste.
 *
 * Permission : BESOINS_TRAITER
 * Body : TraiterBesoinsDTO
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_TRAITER
    );
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!Array.isArray(body.ligneActions)) {
      errors.push({
        field: "ligneActions",
        message: "ligneActions doit etre un tableau.",
      });
    } else {
      body.ligneActions.forEach(
        (a: { ligneBesoinId?: unknown; action?: unknown }, i: number) => {
          if (!a.ligneBesoinId || typeof a.ligneBesoinId !== "string") {
            errors.push({
              field: `ligneActions[${i}].ligneBesoinId`,
              message: `ligneBesoinId est obligatoire pour l'action ${i + 1}.`,
            });
          }
          if (!a.action || !["COMMANDE", "LIBRE"].includes(a.action as string)) {
            errors.push({
              field: `ligneActions[${i}].action`,
              message: `action doit etre COMMANDE ou LIBRE pour l'action ${i + 1}.`,
            });
          }
        }
      );
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: TraiterBesoinsDTO = {
      ligneActions: body.ligneActions,
      fournisseurId: body.fournisseurId || undefined,
    };

    const listeBesoins = await traiterBesoins(
      id,
      auth.activeSiteId,
      auth.userId,
      dto
    );
    return NextResponse.json(listeBesoins);
  } catch (error) {
    return handleApiError("POST /api/besoins/[id]/traiter", error, "Erreur serveur lors du traitement.");
  }
}
