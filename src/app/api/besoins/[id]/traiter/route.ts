import { NextRequest, NextResponse } from "next/server";
import { traiterBesoins } from "@/lib/queries/besoins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { TraiterBesoinsDTO } from "@/types";

/**
 * POST /api/besoins/[id]/traiter
 * Traite une liste de besoins (APPROUVEE → TRAITEE).
 * Genere des commandes BROUILLON par fournisseur pour les lignes COMMANDE.
 * Cree une depense liee a la liste.
 *
 * Permission : BESOINS_TRAITER
 * Body : TraiterBesoinsDTO
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_TRAITER
    );
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!Array.isArray(body.ligneActions)) {
      errors.push({
        field: "ligneActions",
        message: "ligneActions doit etre un tableau.",
      });
    } else {
      body.ligneActions.forEach(
        (a: { ligneBesoinId?: unknown; action?: unknown }, i: number) => {
          if (!a.ligneBesoinId || typeof a.ligneBesoinId !== "string") {
            errors.push({
              field: `ligneActions[${i}].ligneBesoinId`,
              message: `ligneBesoinId est obligatoire pour l'action ${i + 1}.`,
            });
          }
          if (!a.action || !["COMMANDE", "LIBRE"].includes(a.action as string)) {
            errors.push({
              field: `ligneActions[${i}].action`,
              message: `action doit etre COMMANDE ou LIBRE pour l'action ${i + 1}.`,
            });
          }
        }
      );
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const dto: TraiterBesoinsDTO = {
      ligneActions: body.ligneActions,
      fournisseurId: body.fournisseurId || undefined,
    };

    const listeBesoins = await traiterBesoins(
      id,
      auth.activeSiteId,
      auth.userId,
      dto
    );
    return NextResponse.json(listeBesoins);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Transition invalide")) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    return NextResponse.json(
      {
        status: 500,
        message: `Erreur serveur lors du traitement : ${message}`,
      },
      { status: 500 }
    );
  }
}
