import { NextRequest, NextResponse } from "next/server";
import { ajusterDepense } from "@/lib/queries/depenses";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { AjusterDepenseDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/depenses/[id]/ajustements
 * Ajuste le montant total d'une depense et cree un enregistrement d'audit.
 *
 * Corps : { montantTotal: number, raison: string, description?: string,
 *           dateEcheance?: string | null, notes?: string }
 *
 * Regles metier :
 * - Le nouveau montantTotal ne peut pas etre inferieur au montantPaye existant
 * - Cree un enregistrement AjustementDepense immuable (audit trail)
 * - Recalcule automatiquement le statut
 *
 * Permission : DEPENSES_MODIFIER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validate montantTotal
    if (
      body.montantTotal === undefined ||
      typeof body.montantTotal !== "number" ||
      body.montantTotal <= 0
    ) {
      errors.push({
        field: "montantTotal",
        message: "Le montant total doit être un nombre positif.",
      });
    }

    // Validate raison
    if (
      !body.raison ||
      typeof body.raison !== "string" ||
      body.raison.trim() === ""
    ) {
      errors.push({
        field: "raison",
        message: "La raison de l'ajustement est obligatoire.",
      });
    }

    // Validate dateEcheance if provided
    if (
      body.dateEcheance !== undefined &&
      body.dateEcheance !== null &&
      (typeof body.dateEcheance !== "string" ||
        isNaN(Date.parse(body.dateEcheance)))
    ) {
      errors.push({
        field: "dateEcheance",
        message: "Format ISO 8601 attendu ou null.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: AjusterDepenseDTO = {
      montantTotal: body.montantTotal,
      raison: body.raison.trim(),
      ...(body.description !== undefined && {
        description: body.description?.trim(),
      }),
      ...(body.dateEcheance !== undefined && {
        dateEcheance: body.dateEcheance,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
    };

    const result = await ajusterDepense(
      id,
      auth.activeSiteId,
      auth.userId,
      data
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/depenses/[id]/ajustements", error, "Erreur serveur lors de l'ajustement de la depense.", {
      statusMap: [{ match: "inférieur au montant déjà payé", status: 422 }],
    });
  }
}
