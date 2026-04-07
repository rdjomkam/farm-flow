import { NextRequest, NextResponse } from "next/server";
import { updateResultat } from "@/lib/queries/pontes";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { ResultatPonteDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/reproduction/pontes/[id]/resultat
 * Etape 3 : enregistrement des resultats finaux de la ponte.
 * Fait passer le statut a TERMINEE.
 *
 * Body : ResultatPonteDTO
 * Permission : PONTES_GERER
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_GERER);
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Corps de la requete invalide.");
    }

    const errors: { field: string; message: string }[] = [];

    // Validation : tauxFecondation optionnel 0-100
    if (body.tauxFecondation !== undefined && body.tauxFecondation !== null) {
      if (
        typeof body.tauxFecondation !== "number" ||
        body.tauxFecondation < 0 ||
        body.tauxFecondation > 100
      ) {
        errors.push({
          field: "tauxFecondation",
          message: "Le taux de fecondation doit etre un nombre entre 0 et 100.",
        });
      }
    }

    // Validation : tauxEclosion optionnel 0-100
    if (body.tauxEclosion !== undefined && body.tauxEclosion !== null) {
      if (
        typeof body.tauxEclosion !== "number" ||
        body.tauxEclosion < 0 ||
        body.tauxEclosion > 100
      ) {
        errors.push({
          field: "tauxEclosion",
          message: "Le taux d'eclosion doit etre un nombre entre 0 et 100.",
        });
      }
    }

    // Validation : nombreLarvesViables optionnel > 0
    if (body.nombreLarvesViables !== undefined && body.nombreLarvesViables !== null) {
      if (
        !Number.isInteger(body.nombreLarvesViables) ||
        (body.nombreLarvesViables as number) <= 0
      ) {
        errors.push({
          field: "nombreLarvesViables",
          message: "Le nombre de larves viables doit etre un entier superieur a 0.",
        });
      }
    }

    // Validation : coutTotal optionnel >= 0
    if (body.coutTotal !== undefined && body.coutTotal !== null) {
      if (typeof body.coutTotal !== "number" || (body.coutTotal as number) < 0) {
        errors.push({
          field: "coutTotal",
          message: "Le cout total doit etre un nombre superieur ou egal a 0.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation.", { errors });
    }

    const dto: ResultatPonteDTO = {
      ...(body.tauxFecondation !== undefined && {
        tauxFecondation: body.tauxFecondation as number,
      }),
      ...(body.tauxEclosion !== undefined && {
        tauxEclosion: body.tauxEclosion as number,
      }),
      ...(body.nombreLarvesViables !== undefined && {
        nombreLarvesViables: body.nombreLarvesViables as number,
      }),
      ...(body.coutTotal !== undefined && {
        coutTotal: body.coutTotal as number,
      }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    };

    const ponte = await updateResultat(id, auth.activeSiteId, dto);

    return NextResponse.json(ponte);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/pontes/[id]/resultat",
      error,
      "Erreur serveur lors de la mise a jour des resultats de la ponte."
    );
  }
}
