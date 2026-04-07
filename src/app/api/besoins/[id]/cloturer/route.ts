import { NextRequest, NextResponse } from "next/server";
import { cloturerBesoins } from "@/lib/queries/besoins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CloturerBesoinsDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * POST /api/besoins/[id]/cloturer
 * Cloture une liste de besoins (TRAITEE → CLOTUREE).
 * Met a jour les prix reels par ligne et calcule montantReel.
 *
 * Permission : BESOINS_TRAITER
 * Body : CloturerBesoinsDTO
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

    if (!Array.isArray(body.lignesReelles)) {
      errors.push({
        field: "lignesReelles",
        message: "lignesReelles doit etre un tableau.",
      });
    } else {
      body.lignesReelles.forEach(
        (lr: { ligneBesoinId?: unknown; prixReel?: unknown }, i: number) => {
          if (!lr.ligneBesoinId || typeof lr.ligneBesoinId !== "string") {
            errors.push({
              field: `lignesReelles[${i}].ligneBesoinId`,
              message: `ligneBesoinId est obligatoire pour l'entree ${i + 1}.`,
            });
          }
          if (
            lr.prixReel === undefined ||
            typeof lr.prixReel !== "number" ||
            (lr.prixReel as number) < 0
          ) {
            errors.push({
              field: `lignesReelles[${i}].prixReel`,
              message: `prixReel doit etre un nombre positif ou zero pour l'entree ${i + 1}.`,
            });
          }
        }
      );
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CloturerBesoinsDTO = {
      lignesReelles: body.lignesReelles,
    };

    const listeBesoins = await cloturerBesoins(id, auth.activeSiteId, dto);
    return NextResponse.json(listeBesoins);
  } catch (error) {
    return handleApiError("POST /api/besoins/[id]/cloturer", error, "Erreur serveur lors de la cloture.");
  }
}
