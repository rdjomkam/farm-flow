import { NextRequest, NextResponse } from "next/server";
import { updateTransfertGroupe } from "@/lib/queries/transferts";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateTransfertGroupeDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; groupeId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_MODIFIER);
    const { groupeId } = await params;

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Raison obligatoire
    if (!body.raison || typeof body.raison !== "string") {
      errors.push({ field: "raison", message: "La raison de modification est obligatoire." });
    } else {
      const raisonTrimmed = body.raison.trim();
      if (raisonTrimmed.length === 0) {
        errors.push({ field: "raison", message: "La raison de modification ne peut pas etre vide." });
      } else if (raisonTrimmed.length < 5) {
        errors.push({ field: "raison", message: "La raison doit contenir au moins 5 caracteres." });
      } else if (raisonTrimmed.length > 500) {
        errors.push({ field: "raison", message: "La raison ne peut pas depasser 500 caracteres." });
      }
    }

    // Champs optionnels — valider s'ils sont fournis
    if (body.nombrePoissons !== undefined) {
      if (typeof body.nombrePoissons !== "number" || !Number.isInteger(body.nombrePoissons) || body.nombrePoissons <= 0) {
        errors.push({ field: "nombrePoissons", message: "nombrePoissons doit etre un entier > 0." });
      }
    }

    if (body.poidsMoyenG !== undefined) {
      if (typeof body.poidsMoyenG !== "number" || body.poidsMoyenG <= 0) {
        errors.push({ field: "poidsMoyenG", message: "poidsMoyenG doit etre un nombre > 0." });
      }
    }

    if (body.nombreMorts !== undefined) {
      if (typeof body.nombreMorts !== "number" || !Number.isInteger(body.nombreMorts) || body.nombreMorts < 0) {
        errors.push({ field: "nombreMorts", message: "nombreMorts doit etre un entier >= 0." });
      }
    }

    if (body.bacSourceId !== undefined && body.bacSourceId !== null) {
      if (typeof body.bacSourceId !== "string" || body.bacSourceId.trim() === "") {
        errors.push({ field: "bacSourceId", message: "bacSourceId doit etre une chaine non vide ou null." });
      }
    }

    if (body.bacDestId !== undefined && body.bacDestId !== null) {
      if (typeof body.bacDestId !== "string" || body.bacDestId.trim() === "") {
        errors.push({ field: "bacDestId", message: "bacDestId doit etre une chaine non vide ou null." });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: UpdateTransfertGroupeDTO = {
      raison: body.raison.trim(),
      ...(body.nombrePoissons !== undefined && { nombrePoissons: body.nombrePoissons }),
      ...(body.poidsMoyenG !== undefined && { poidsMoyenG: body.poidsMoyenG }),
      ...(body.nombreMorts !== undefined && { nombreMorts: body.nombreMorts }),
      ...(body.bacSourceId !== undefined && { bacSourceId: body.bacSourceId }),
      ...(body.bacDestId !== undefined && { bacDestId: body.bacDestId }),
    };

    const result = await updateTransfertGroupe(auth.activeSiteId, auth.userId, groupeId, dto);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(
      "PATCH /api/transferts/[id]/groupes/[groupeId]",
      error,
      "Erreur serveur lors de la modification du groupe de transfert.",
      {
        statusMap: [
          { match: ["Conservation violée", "Modification impossible", "Annulation impossible"], status: 409 },
          { match: ["introuvable", "Acces refuse"], status: 400 },
        ],
      }
    );
  }
}
