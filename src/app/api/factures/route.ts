import { NextRequest, NextResponse } from "next/server";
import { getFactures, createFacture } from "@/lib/queries/factures";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutFacture, parsePaginationQuery } from "@/types";
import type { CreateFactureDTO, FactureFilters } from "@/types";
import { apiError } from "@/lib/api-utils";

const VALID_STATUTS = Object.values(StatutFacture);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FACTURES_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const filters: FactureFilters = {};
    const statut = searchParams.get("statut");
    if (statut && VALID_STATUTS.includes(statut as StatutFacture)) {
      filters.statut = statut as StatutFacture;
    }
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const { data, total } = await getFactures(auth.activeSiteId, filters, { limit, offset });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des factures.");
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
      return apiError(400, "Erreurs de validation", { errors });
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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("deja une facture")) {
      return apiError(409, message);
    }
    return apiError(500, "Erreur serveur lors de la creation de la facture.");
  }
}
