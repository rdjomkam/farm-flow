import { NextRequest, NextResponse } from "next/server";
import {
  getCommandeById,
  envoyerCommande,
  annulerCommande,
} from "@/lib/queries/commandes";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_VOIR);
    const { id } = await params;

    const commande = await getCommandeById(id, auth.activeSiteId);
    if (!commande) {
      return apiError(404, "Commande introuvable.");
    }

    return NextResponse.json(commande);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;
    const body = await request.json();

    if (!body.action || typeof body.action !== "string") {
      return apiError(400, "L'action est obligatoire (envoyer | annuler).");
    }

    let result;

    switch (body.action) {
      case "envoyer":
        result = await envoyerCommande(id, auth.activeSiteId);
        break;
      case "annuler":
        result = await annulerCommande(id, auth.activeSiteId);
        break;
      default:
        return NextResponse.json(
          { status: 400, message: "Action invalide. Actions possibles : envoyer, annuler." },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
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
    if (message.includes("Impossible")) {
      return apiError(409, message);
    }
    return apiError(500, message);
  }
}
