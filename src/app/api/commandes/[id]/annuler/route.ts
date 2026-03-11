import { NextRequest, NextResponse } from "next/server";
import { annulerCommande } from "@/lib/queries/commandes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await annulerCommande(id, auth.activeSiteId);
    return NextResponse.json(commande);
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
    if (message.includes("Impossible") || message.includes("deja")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de l'annulation de la commande." },
      { status: 500 }
    );
  }
}
