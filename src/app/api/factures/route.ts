import { NextRequest, NextResponse } from "next/server";
import { getFactures, createFacture } from "@/lib/queries/factures";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutFacture } from "@/types";
import type { CreateFactureDTO, FactureFilters } from "@/types";

const VALID_STATUTS = Object.values(StatutFacture);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FACTURES_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: FactureFilters = {};
    const statut = searchParams.get("statut");
    if (statut && VALID_STATUTS.includes(statut as StatutFacture)) {
      filters.statut = statut as StatutFacture;
    }
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const factures = await getFactures(auth.activeSiteId, filters);

    return NextResponse.json({
      factures,
      total: factures.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des factures." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FACTURES_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.venteId || typeof body.venteId !== "string") {
      errors.push({ field: "venteId", message: "La vente est obligatoire." });
    }

    if (body.dateEcheance && (typeof body.dateEcheance !== "string" || isNaN(Date.parse(body.dateEcheance)))) {
      errors.push({ field: "dateEcheance", message: "La date d'echeance n'est pas valide (format ISO 8601)." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateFactureDTO = {
      venteId: body.venteId,
      dateEcheance: body.dateEcheance || undefined,
      notes: body.notes?.trim() || undefined,
    };

    const facture = await createFacture(auth.activeSiteId, auth.userId, data);
    return NextResponse.json(facture, { status: 201 });
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
    if (message.includes("deja une facture")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation de la facture." },
      { status: 500 }
    );
  }
}
