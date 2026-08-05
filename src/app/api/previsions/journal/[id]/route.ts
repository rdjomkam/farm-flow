import { NextRequest, NextResponse } from "next/server";
import { updateJournalDepensePrevue, deleteJournalDepensePrevue } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { updateJournalDepensePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/** PUT /api/previsions/journal/[id] — met a jour une ligne de journal de depenses prevues. PREVISIONS_GERER. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(updateJournalDepensePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const ligne = await updateJournalDepensePrevue(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(ligne);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/journal/[id]",
      error,
      "Erreur serveur lors de la mise a jour de la ligne de journal."
    );
  }
}

/** DELETE /api/previsions/journal/[id] — supprime une ligne de journal de depenses prevues. PREVISIONS_GERER. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;

    await deleteJournalDepensePrevue(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(
      "DELETE /api/previsions/journal/[id]",
      error,
      "Erreur serveur lors de la suppression de la ligne de journal."
    );
  }
}
