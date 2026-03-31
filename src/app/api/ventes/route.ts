import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getVentes, createVente } from "@/lib/queries/ventes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, parsePaginationQuery } from "@/types";
import type { CreateVenteDTO, VenteFilters } from "@/types";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const filters: VenteFilters = {};
    const clientId = searchParams.get("clientId");
    if (clientId) filters.clientId = clientId;
    const vagueId = searchParams.get("vagueId");
    if (vagueId) filters.vagueId = vagueId;
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const { data, total } = await getVentes(auth.activeSiteId, filters, { limit, offset });

    return cachedJson({ data, total, limit, offset }, "fast");
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des ventes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_CREER);

    // Idempotency check
    const idempotencyKey = request.headers.get("X-Idempotency-Key");
    if (idempotencyKey && auth.activeSiteId) {
      const { checkIdempotency } = await import("@/lib/idempotency");
      const check = await checkIdempotency(idempotencyKey, auth.activeSiteId);
      if (check.isDuplicate) {
        return NextResponse.json(check.response, { status: check.statusCode });
      }
    }

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.clientId || typeof body.clientId !== "string") {
      errors.push({ field: "clientId", message: "Le client est obligatoire." });
    }

    if (!body.vagueId || typeof body.vagueId !== "string") {
      errors.push({ field: "vagueId", message: "La vague est obligatoire." });
    }

    if (typeof body.quantitePoissons !== "number" || body.quantitePoissons <= 0) {
      errors.push({ field: "quantitePoissons", message: "La quantite de poissons doit etre > 0." });
    }

    if (typeof body.poidsTotalKg !== "number" || body.poidsTotalKg <= 0) {
      errors.push({ field: "poidsTotalKg", message: "Le poids total doit etre > 0." });
    }

    if (typeof body.prixUnitaireKg !== "number" || body.prixUnitaireKg <= 0) {
      errors.push({ field: "prixUnitaireKg", message: "Le prix unitaire doit etre > 0." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateVenteDTO = {
      clientId: body.clientId,
      vagueId: body.vagueId,
      quantitePoissons: body.quantitePoissons,
      poidsTotalKg: body.poidsTotalKg,
      prixUnitaireKg: body.prixUnitaireKg,
      notes: body.notes?.trim() || undefined,
    };

    const vente = await createVente(auth.activeSiteId, auth.userId, data);

    // Store idempotency record
    if (idempotencyKey && auth.activeSiteId) {
      const { storeIdempotency } = await import("@/lib/idempotency");
      await storeIdempotency(idempotencyKey, auth.activeSiteId, vente, 201);
    }

    return NextResponse.json(vente, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable") || message.includes("inactif")) {
      return apiError(404, message);
    }
    if (message.includes("insuffisant") || message.includes("annulee")) {
      return apiError(409, message);
    }
    return apiError(500, "Erreur serveur lors de la creation de la vente.");
  }
}
