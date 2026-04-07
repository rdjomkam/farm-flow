import { NextRequest, NextResponse } from "next/server";
import { envoyerCommande } from "@/lib/queries/commandes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await envoyerCommande(id, auth.activeSiteId);
    return NextResponse.json(commande);
  } catch (error) {
    return handleApiError("POST /api/commandes/[id]/envoyer", error, "Erreur serveur lors de l'envoi de la commande.");
  }
}
