import { NextRequest, NextResponse } from "next/server";
import {
  getCommandeById,
  envoyerCommande,
  annulerCommande,
} from "@/lib/queries/commandes";
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
      return NextResponse.json(
        { status: 404, message: "Commande introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(commande);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;
    const body = await request.json();

    if (!body.action || typeof body.action !== "string") {
      return NextResponse.json(
        { status: 400, message: "L'action est obligatoire (envoyer | annuler)." },
        { status: 400 }
      );
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Impossible")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
