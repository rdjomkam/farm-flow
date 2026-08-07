import { NextRequest, NextResponse } from "next/server";
import { updateApportCapital, deleteApportCapital } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { updateApportCapitalSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * PUT /api/previsions/apports/[id] — met a jour partiellement un
 * ApportCapital (date/libelle/montant/type/actif). PREVISIONS_GERER, meme
 * niveau que la creation (`createApportCapital`).
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(updateApportCapitalSchema, body);
    if (parsed.error) return parsed.error;

    const apport = await updateApportCapital(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(apport);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/apports/[id]",
      error,
      "Erreur serveur lors de la mise a jour de l'apport."
    );
  }
}

/**
 * DELETE /api/previsions/apports/[id] — supprime un ApportCapital.
 * PREVISIONS_GERER.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;

    await deleteApportCapital(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(
      "DELETE /api/previsions/apports/[id]",
      error,
      "Erreur serveur lors de la suppression de l'apport."
    );
  }
}
