import { NextRequest, NextResponse } from "next/server";
import { cloturerBesoins } from "@/lib/queries/besoins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CloturerBesoinsDTO } from "@/types";

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
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const dto: CloturerBesoinsDTO = {
      lignesReelles: body.lignesReelles,
    };

    const listeBesoins = await cloturerBesoins(id, auth.activeSiteId, dto);
    return NextResponse.json(listeBesoins);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Transition invalide")) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
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
