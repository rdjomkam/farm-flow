import { NextRequest, NextResponse } from "next/server";
import { getPonteById, deletePonte } from "@/lib/queries/pontes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
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

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_SUPPRIMER);
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
