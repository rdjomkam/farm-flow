import { NextRequest, NextResponse } from "next/server";
import { deleteTraitement } from "@/lib/queries/incubations";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; traitementId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_SUPPRIMER);
    const { traitementId } = await params;

    await deleteTraitement(traitementId, auth.activeSiteId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(
      "DELETE /api/reproduction/incubations/[id]/traitements/[traitementId]",
      error,
      "Erreur serveur lors de la suppression du traitement."
    );
  }
}
