import { NextRequest, NextResponse } from "next/server";
import { ajusterFraisDepense } from "@/lib/queries/depenses";
import { requirePermission } from "@/lib/permissions";
import { Permission, ActionAjustementFrais, MotifFraisSupp } from "@/types";
import type { AjusterFraisDepenseDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/depenses/[id]/ajustements/frais
 * Ajuste un frais supplementaire d'un paiement de depense.
 *
 * Corps :
 * - paiementId: string (obligatoire)
 * - action: ActionAjustementFrais (AJOUTE | MODIFIE | SUPPRIME)
 * - fraisId?: string (obligatoire pour MODIFIE et SUPPRIME)
 * - motif?: MotifFraisSupp (obligatoire pour AJOUTE, optionnel pour MODIFIE)
 * - montant?: number > 0 (obligatoire pour AJOUTE et MODIFIE)
 * - notes?: string | null (optionnel)
 * - raison: string (obligatoire pour l'audit trail)
 *
 * Permission : DEPENSES_MODIFIER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validate paiementId
    if (!body.paiementId || typeof body.paiementId !== "string" || !body.paiementId.trim()) {
      errors.push({ field: "paiementId", message: "paiementId est obligatoire." });
    }

    // Validate action
    const validActions = Object.values(ActionAjustementFrais);
    if (!body.action || !validActions.includes(body.action as ActionAjustementFrais)) {
      errors.push({
        field: "action",
        message: `action doit etre l'une de : ${validActions.join(", ")}.`,
      });
    }

    const action = body.action as ActionAjustementFrais;

    // Validate fraisId for MODIFIE and SUPPRIME
    if (
      action === ActionAjustementFrais.MODIFIE ||
      action === ActionAjustementFrais.SUPPRIME
    ) {
      if (!body.fraisId || typeof body.fraisId !== "string" || !body.fraisId.trim()) {
        errors.push({
          field: "fraisId",
          message: "fraisId est obligatoire pour MODIFIE et SUPPRIME.",
        });
      }
    }

    // Validate motif for AJOUTE
    const validMotifs = Object.values(MotifFraisSupp);
    if (action === ActionAjustementFrais.AJOUTE) {
      if (!body.motif || !validMotifs.includes(body.motif as MotifFraisSupp)) {
        errors.push({
          field: "motif",
          message: `motif est obligatoire pour AJOUTE et doit etre l'un de : ${validMotifs.join(", ")}.`,
        });
      }
    }

    // Validate montant for AJOUTE and MODIFIE
    if (
      action === ActionAjustementFrais.AJOUTE ||
      action === ActionAjustementFrais.MODIFIE
    ) {
      if (
        body.montant === undefined ||
        typeof body.montant !== "number" ||
        body.montant <= 0
      ) {
        errors.push({
          field: "montant",
          message: "montant est obligatoire et doit etre un nombre > 0 pour AJOUTE et MODIFIE.",
        });
      }
    }

    // Validate raison
    if (
      !body.raison ||
      typeof body.raison !== "string" ||
      body.raison.trim() === ""
    ) {
      errors.push({ field: "raison", message: "La raison est obligatoire." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: AjusterFraisDepenseDTO = {
      paiementId: body.paiementId.trim(),
      action,
      ...(body.fraisId && { fraisId: body.fraisId.trim() }),
      ...(body.motif && { motif: body.motif as MotifFraisSupp }),
      ...(body.montant !== undefined && { montant: body.montant }),
      ...(body.notes !== undefined && { notes: body.notes }),
      raison: body.raison.trim(),
    };

    const result = await ajusterFraisDepense(
      id,
      auth.activeSiteId,
      auth.userId,
      dto
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError("POST /api/depenses/[id]/ajustements/frais", error, "Erreur serveur lors de l'ajustement des frais.", {
      statusMap: [{ match: ["deja supprime", "n'appartient pas"], status: 422 }],
    });
  }
}
