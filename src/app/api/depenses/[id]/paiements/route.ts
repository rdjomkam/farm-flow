import { NextRequest, NextResponse } from "next/server";
import { ajouterPaiementDepense } from "@/lib/queries/depenses";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { ModePaiement, Permission } from "@/types";
import type { CreatePaiementDepenseDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const VALID_MODES = Object.values(ModePaiement);

/**
 * POST /api/depenses/[id]/paiements
 * Enregistre un paiement (partiel ou total) sur une depense.
 *
 * Regles metier :
 * - Statut NON_PAYEE ou PAYEE_PARTIELLEMENT requis
 * - Montant ne doit pas depasser le reste a payer
 * - Recalcule automatiquement montantPaye et statut
 *
 * Permission : DEPENSES_PAYER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_PAYER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (
      body.montant === undefined ||
      typeof body.montant !== "number" ||
      body.montant <= 0
    ) {
      errors.push({
        field: "montant",
        message: "Le montant doit etre un nombre positif.",
      });
    }

    if (!body.mode || !VALID_MODES.includes(body.mode as ModePaiement)) {
      errors.push({
        field: "mode",
        message: `Le mode de paiement est obligatoire. Valeurs valides : ${VALID_MODES.join(", ")}`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreatePaiementDepenseDTO = {
      montant: body.montant,
      mode: body.mode as ModePaiement,
      reference: body.reference?.trim() || undefined,
    };

    const result = await ajouterPaiementDepense(
      auth.activeSiteId,
      id,
      auth.userId,
      data
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (
      message.includes("entierement payee") ||
      message.includes("depasse le reste")
    ) {
      return apiError(409, message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de l'enregistrement du paiement.",
      },
      { status: 500 }
    );
  }
}
