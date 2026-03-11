import { NextRequest, NextResponse } from "next/server";
import { recevoirCommande } from "@/lib/queries/commandes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    let dateLivraison: string | undefined;
    if (body.dateLivraison && typeof body.dateLivraison === "string") {
      if (isNaN(Date.parse(body.dateLivraison))) {
        return NextResponse.json(
          { status: 400, message: "La date de livraison n'est pas valide." },
          { status: 400 }
        );
      }
      dateLivraison = body.dateLivraison;
    }

    const commande = await recevoirCommande(
      id,
      auth.activeSiteId,
      auth.userId,
      dateLivraison
    );

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
    if (message.includes("Impossible")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la reception de la commande." },
      { status: 500 }
    );
  }
}
