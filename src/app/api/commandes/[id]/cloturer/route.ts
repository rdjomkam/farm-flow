import { NextRequest, NextResponse } from "next/server";
import { cloturerCommande } from "@/lib/queries/commandes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await cloturerCommande(id, auth.activeSiteId);
    return NextResponse.json(commande);
  } catch (error) {
    return handleApiError("POST /api/commandes/[id]/cloturer", error, "Erreur serveur lors de la cloture de la commande.");
  }
}
