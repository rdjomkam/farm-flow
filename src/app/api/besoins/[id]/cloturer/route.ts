import { NextRequest, NextResponse } from "next/server";
import { cloturerBesoins } from "@/lib/queries/besoins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CloturerBesoinsDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("Transition invalide")) {
      return apiError(400, message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: `Erreur serveur lors de la cloture : ${message}`,
      },
      { status: 500 }
    );
  }
}
