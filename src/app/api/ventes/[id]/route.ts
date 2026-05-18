import { NextRequest, NextResponse } from "next/server";
import { getVenteById, updateVente } from "@/lib/queries/ventes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateVenteDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { id } = await params;

    const vente = await getVenteById(id, auth.activeSiteId);
    if (!vente) {
      return apiError(404, "Vente introuvable.");
    }

    return NextResponse.json(vente);
  } catch (error) {
    return handleApiError("GET /api/ventes/[id]", error, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;
    const body = (await request.json()) as UpdateVenteDTO;

    if (!body.motif || body.motif.trim().length === 0) {
      return apiError(400, "Le motif de modification est obligatoire.");
    }

    const hasChange =
      body.clientId !== undefined ||
      body.vagueId !== undefined ||
      body.poidsTotalKg !== undefined ||
      body.prixUnitaireKg !== undefined ||
      body.poidsMoyenG !== undefined ||
      body.notes !== undefined;

    if (!hasChange) {
      return apiError(400, "Aucun champ a modifier.");
    }

    const updated = await updateVente(id, auth.activeSiteId, auth.userId, body);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError("PUT /api/ventes/[id]", error, "Erreur serveur.");
  }
}
