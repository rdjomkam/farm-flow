import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getBacById, updateBac } from "@/lib/queries/bacs";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeSystemeBac } from "@/types";
import type { UpdateBacDTO } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { id } = await params;
    const bac = await getBacById(id, auth.activeSiteId);

    if (!bac) {
      return apiError(404, "Bac introuvable.", { code: ErrorKeys.NOT_FOUND_BAC });
    }

    return NextResponse.json({
      id: bac.id,
      nom: bac.nom,
      volume: bac.volume,
      nombrePoissons: bac.nombrePoissons,
      nombreInitial: bac.nombreInitial,
      poidsMoyenInitial: bac.poidsMoyenInitial,
      typeSysteme: bac.typeSysteme ?? null,
      vagueId: bac.vagueId,
      vagueCode: bac.vagueCode ?? null,
      siteId: bac.siteId,
      createdAt: bac.createdAt,
      updatedAt: bac.updatedAt,
    });
  } catch (error) {
    return handleApiError("GET /api/bacs/[id]", error, "Erreur serveur lors de la recuperation du bac.", {
      code: ErrorKeys.SERVER_GET_BAC,
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (body.nom !== undefined) {
      if (typeof body.nom !== "string" || body.nom.trim() === "") {
        errors.push({ field: "nom", message: "Le nom ne peut pas etre vide." });
      }
    }

    if (body.volume !== undefined) {
      if (typeof body.volume !== "number" || body.volume <= 0) {
        errors.push({ field: "volume", message: "Le volume doit etre superieur a 0." });
      }
    }

    if (body.typeSysteme !== undefined && body.typeSysteme !== null) {
      if (!Object.values(TypeSystemeBac).includes(body.typeSysteme as TypeSystemeBac)) {
        errors.push({
          field: "typeSysteme",
          message: `Type de systeme invalide. Valeurs acceptees : ${Object.values(TypeSystemeBac).join(", ")}.`,
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // ADR-043 Phase 3: Bac PATCH ne gère que les champs physiques du bac
    const data: UpdateBacDTO = {};
    if (body.nom !== undefined) data.nom = body.nom.trim();
    if (body.volume !== undefined) data.volume = body.volume;
    if (body.typeSysteme !== undefined) data.typeSysteme = body.typeSysteme ?? null;

    if (Object.keys(data).length === 0) {
      return apiError(400, "Aucun champ a modifier.");
    }

    const bac = await updateBac(id, auth.activeSiteId, data);
    revalidatePath("/vagues");
    return NextResponse.json(bac);
  } catch (error) {
    return handleApiError("PUT /api/bacs/[id]", error, "Erreur serveur lors de la mise a jour du bac.", {
      code: ErrorKeys.SERVER_UPDATE_BAC,
    });
  }
}
