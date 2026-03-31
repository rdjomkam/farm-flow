import { NextRequest, NextResponse } from "next/server";
import { annulerCommande } from "@/lib/queries/commandes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await annulerCommande(id, auth.activeSiteId);
    return NextResponse.json(commande);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("Impossible") || message.includes("deja")) {
      return apiError(409, message);
    }
    return apiError(500, "Erreur serveur lors de l'annulation de la commande.");
  }
}
