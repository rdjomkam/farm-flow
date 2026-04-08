import { NextRequest, NextResponse } from "next/server";
import { getPonteById, deletePonte, updateInjection } from "@/lib/queries/pontes";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeHormone } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import type { InjectionStepDTO } from "@/lib/queries/pontes";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_VOIR);
    const { id } = await params;

    const ponte = await getPonteById(id, auth.activeSiteId);
    if (!ponte) {
      return apiError(404, "Ponte introuvable.");
    }

    return NextResponse.json(ponte);
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/pontes/[id]",
      error,
      "Erreur serveur lors de la recuperation de la ponte."
    );
  }
}

/**
 * PATCH /api/reproduction/pontes/[id]
 * Etape 1 (edition) : mise a jour des champs d'injection hormonale.
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

    // Validation : heureInjection doit etre une date valide si fournie
    if (body.heureInjection !== undefined && body.heureInjection !== null) {
      if (typeof body.heureInjection !== "string") {
        return apiError(400, "Erreurs de validation.", {
          errors: [{ field: "heureInjection", message: "Format ISO datetime attendu." }],
        });
      }
      const d = new Date(body.heureInjection);
      if (isNaN(d.getTime())) {
        return apiError(400, "Erreurs de validation.", {
          errors: [{ field: "heureInjection", message: "Date invalide." }],
        });
      }
    }

    // Validation : champs numeriques
    const numericFields = [
      "doseHormone",
      "doseMgKg",
      "coutHormone",
      "temperatureEauC",
      "latenceTheorique",
    ] as const;
    for (const field of numericFields) {
      if (body[field] !== undefined && body[field] !== null) {
        if (typeof body[field] !== "number") {
          return apiError(400, "Erreurs de validation.", {
            errors: [{ field, message: "Valeur numerique attendue." }],
          });
        }
      }
    }

    // Validation : typeHormone doit etre une valeur de l'enum TypeHormone si fournie
    if (body.typeHormone !== undefined && body.typeHormone !== null) {
      if (
        typeof body.typeHormone !== "string" ||
        !Object.values(TypeHormone).includes(body.typeHormone as TypeHormone)
      ) {
        return apiError(400, "Erreurs de validation.", {
          errors: [
            {
              field: "typeHormone",
              message: `Valeur invalide. Valeurs acceptees : ${Object.values(TypeHormone).join(", ")}.`,
            },
          ],
        });
      }
    }

    const dto: InjectionStepDTO = {
      ...(body.typeHormone !== undefined && { typeHormone: body.typeHormone as TypeHormone }),
      ...(body.doseHormone !== undefined && { doseHormone: body.doseHormone as number }),
      ...(body.doseMgKg !== undefined && { doseMgKg: body.doseMgKg as number }),
      ...(body.coutHormone !== undefined && { coutHormone: body.coutHormone as number }),
      ...(body.heureInjection !== undefined && { heureInjection: body.heureInjection as string }),
      ...(body.temperatureEauC !== undefined && { temperatureEauC: body.temperatureEauC as number }),
      ...(body.latenceTheorique !== undefined && { latenceTheorique: body.latenceTheorique as number }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    };

    const ponte = await updateInjection(id, auth.activeSiteId, dto);
    return NextResponse.json(ponte);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/pontes/[id]",
      error,
      "Erreur serveur lors de la mise a jour de l'injection."
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_GERER);
    const { id } = await params;

    await deletePonte(id, auth.activeSiteId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(
      "DELETE /api/reproduction/pontes/[id]",
      error,
      "Erreur serveur lors de la suppression de la ponte.",
      {
        statusMap: [
          {
            match: ["Impossible de supprimer"],
            status: 409,
          },
        ],
      }
    );
  }
}
