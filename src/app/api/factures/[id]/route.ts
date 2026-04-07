import { NextRequest, NextResponse } from "next/server";
import { getFactureById, updateFacture } from "@/lib/queries/factures";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutFacture } from "@/types";
import type { UpdateFactureDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_STATUTS = Object.values(StatutFacture);

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.FACTURES_VOIR);
    const { id } = await params;

    const facture = await getFactureById(id, auth.activeSiteId);
    if (!facture) {
      return apiError(404, "Facture introuvable.");
    }

    return NextResponse.json(facture);
  } catch (error) {
    return handleApiError("GET /api/factures/[id]", error, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.FACTURES_GERER);
    const { id } = await params;
    const body = await request.json();

    const data: UpdateFactureDTO = {};

    if (body.statut !== undefined) {
      if (!VALID_STATUTS.includes(body.statut as StatutFacture)) {
        return NextResponse.json(
          { status: 400, message: `Statut invalide. Valeurs possibles : ${VALID_STATUTS.join(", ")}` },
          { status: 400 }
        );
      }
      data.statut = body.statut as StatutFacture;
    }

    if (body.dateEcheance !== undefined) {
      if (body.dateEcheance && isNaN(Date.parse(body.dateEcheance))) {
        return apiError(400, "La date d'echeance n'est pas valide.");
      }
      data.dateEcheance = body.dateEcheance || undefined;
    }

    if (body.notes !== undefined) data.notes = body.notes?.trim() || undefined;

    const facture = await updateFacture(id, auth.activeSiteId, data);
    return NextResponse.json(facture);
  } catch (error) {
    return handleApiError("PUT /api/factures/[id]", error, "Erreur serveur.");
  }
}
