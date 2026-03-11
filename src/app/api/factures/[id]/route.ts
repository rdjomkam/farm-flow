import { NextRequest, NextResponse } from "next/server";
import { getFactureById, updateFacture } from "@/lib/queries/factures";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutFacture } from "@/types";
import type { UpdateFactureDTO } from "@/types";

const VALID_STATUTS = Object.values(StatutFacture);

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.FACTURES_VOIR);
    const { id } = await params;

    const facture = await getFactureById(id, auth.activeSiteId);
    if (!facture) {
      return NextResponse.json(
        { status: 404, message: "Facture introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(facture);
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
    const auth = await requirePermission(request, Permission.FACTURES_GERER);
    const { id } = await params;
    const body = await request.json();

    const data: UpdateFactureDTO = {};

    if (body.statut !== undefined) {
      if (!VALID_STATUTS.includes(body.statut as StatutFacture)) {
        return NextResponse.json(
          { status: 400, message: `Statut invalide. Valeurs possibles : ${VALID_STATUTS.join(", ")}` },
          { status: 400 }
        );
      }
      data.statut = body.statut as StatutFacture;
    }

    if (body.dateEcheance !== undefined) {
      if (body.dateEcheance && isNaN(Date.parse(body.dateEcheance))) {
        return NextResponse.json(
          { status: 400, message: "La date d'echeance n'est pas valide." },
          { status: 400 }
        );
      }
      data.dateEcheance = body.dateEcheance || undefined;
    }

    if (body.notes !== undefined) data.notes = body.notes?.trim() || undefined;

    const facture = await updateFacture(id, auth.activeSiteId, data);
    return NextResponse.json(facture);
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
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
