import { NextRequest, NextResponse } from "next/server";
import { ajouterPaiement } from "@/lib/queries/factures";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, ModePaiement } from "@/types";
import type { CreatePaiementDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

const VALID_MODES = Object.values(ModePaiement);

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PAIEMENTS_CREER);
    const { id: factureId } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (typeof body.montant !== "number" || body.montant <= 0) {
      errors.push({ field: "montant", message: "Le montant doit etre > 0." });
    }

    if (!body.mode || !VALID_MODES.includes(body.mode as ModePaiement)) {
      errors.push({
        field: "mode",
        message: `Le mode de paiement est obligatoire. Valeurs possibles : ${VALID_MODES.join(", ")}`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreatePaiementDTO = {
      montant: body.montant,
      mode: body.mode as ModePaiement,
      reference: body.reference?.trim() || undefined,
    };

    const paiement = await ajouterPaiement(
      auth.activeSiteId,
      factureId,
      auth.userId,
      data
    );
    return NextResponse.json(paiement, { status: 201 });
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
    if (message.includes("Impossible") || message.includes("depasse") || message.includes("deja")) {
      return apiError(409, message);
    }
    return apiError(500, "Erreur serveur lors de l'enregistrement du paiement.");
  }
}
