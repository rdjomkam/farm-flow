import { NextRequest, NextResponse } from "next/server";
import { annulerCommande } from "@/lib/queries/commandes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await annulerCommande(id, auth.activeSiteId);
    return NextResponse.json(commande);
  } catch (error) {
    return handleApiError("POST /api/commandes/[id]/annuler", error, "Erreur serveur lors de l'annulation de la commande.", {
      statusMap: [
        { match: "deja", status: 409 },
      ],
    });
  }
}
