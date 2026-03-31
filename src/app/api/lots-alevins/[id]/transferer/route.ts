import { NextRequest, NextResponse } from "next/server";
import { transfererLotVersVague } from "@/lib/queries/lots-alevins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : nom de la vague obligatoire
    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le nom de la vague de destination est obligatoire." });
    }

    // Validation : bacIds obligatoire et non vide
    if (!body.bacIds || !Array.isArray(body.bacIds) || body.bacIds.length === 0) {
      errors.push({
        field: "bacIds",
        message: "Au moins un bac doit etre selectionne pour la vague de destination.",
      });
    } else {
      const allStrings = body.bacIds.every(
        (b: unknown) => typeof b === "string" && b.trim() !== ""
      );
      if (!allStrings) {
        errors.push({
          field: "bacIds",
          message: "Tous les identifiants de bacs doivent etre des chaines de caracteres valides.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const lot = await transfererLotVersVague(auth.activeSiteId, id, {
      nom: body.nom.trim(),
      bacIds: body.bacIds as string[],
      userId: auth.userId,
    });

    return NextResponse.json(
      {
        lot,
        vague: lot.vagueDestination,
        message: "Lot transfere avec succes vers la nouvelle vague.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/lots-alevins/[id]/transferer]", error);
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
    // Erreurs metier : statut invalide, bacs occupes → 409
    if (
      message.includes("non transferable") ||
      message.includes("deja assigne") ||
      message.includes("Bacs deja") ||
      message.includes("statut")
    ) {
      return apiError(409, message);
    }
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors du transfert : ${message}` },
      { status: 500 }
    );
  }
}
