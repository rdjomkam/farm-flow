import { NextRequest, NextResponse } from "next/server";
import { ajouterPaiement } from "@/lib/queries/factures";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, ModePaiement } from "@/types";
import type { CreatePaiementDTO } from "@/types";

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
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Impossible") || message.includes("depasse") || message.includes("deja")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de l'enregistrement du paiement." },
      { status: 500 }
    );
  }
}
