import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getVentes, createVente } from "@/lib/queries/ventes";
import { requirePermission } from "@/lib/permissions";
import { Permission, parsePaginationQuery } from "@/types";
import type { CreateVenteDTO, VenteFilters } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { checkIdempotency, storeIdempotency, hashBody } from "@/lib/idempotency";

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
    return handleApiError("GET /api/ventes", error, "Erreur serveur lors de la recuperation des ventes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_CREER);

    // Parse body once (needed before idempotency check for body hash)
    const body = await request.json();

    // Idempotency check
    const idempotencyKey = request.headers.get("X-Idempotency-Key");
    if (idempotencyKey) {
      const bHash = hashBody(body);
      const check = await checkIdempotency(idempotencyKey, auth.activeSiteId, bHash);
      if ("isConflict" in check) {
        return apiError(409, "Cle d'idempotence deja utilisee avec un corps de requete different.");
      } else if (check.isDuplicate) {
        return NextResponse.json(check.response, { status: check.statusCode });
      }
    }

    const errors: { field: string; message: string }[] = [];

    if (!body.clientId || typeof body.clientId !== "string") {
      errors.push({ field: "clientId", message: "Le client est obligatoire." });
    }

    if (!body.vagueId || typeof body.vagueId !== "string") {
      errors.push({ field: "vagueId", message: "La vague est obligatoire." });
    }

    if (typeof body.poidsTotalKg !== "number" || body.poidsTotalKg <= 0) {
      errors.push({ field: "poidsTotalKg", message: "Le poids total doit etre > 0." });
    }

    if (typeof body.prixUnitaireKg !== "number" || body.prixUnitaireKg <= 0) {
      errors.push({ field: "prixUnitaireKg", message: "Le prix unitaire doit etre > 0." });
    }

    if (
      body.poidsMoyenG !== undefined &&
      body.poidsMoyenG !== null &&
      (typeof body.poidsMoyenG !== "number" || body.poidsMoyenG <= 0)
    ) {
      errors.push({ field: "poidsMoyenG", message: "Le poids moyen doit etre > 0." });
    }

    // Validate bacDeductions if provided
    if (body.bacDeductions !== undefined && body.bacDeductions !== null) {
      if (!Array.isArray(body.bacDeductions)) {
        errors.push({ field: "bacDeductions", message: "bacDeductions doit etre un tableau." });
      } else {
        for (let i = 0; i < body.bacDeductions.length; i++) {
          const d = body.bacDeductions[i];
          if (!d || typeof d.bacId !== "string" || !d.bacId) {
            errors.push({ field: `bacDeductions[${i}].bacId`, message: "bacId est obligatoire." });
          }
          if (typeof d?.quantite !== "number" || !Number.isInteger(d.quantite) || d.quantite <= 0) {
            errors.push({ field: `bacDeductions[${i}].quantite`, message: "quantite doit etre un entier positif." });
          }
        }
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateVenteDTO = {
      clientId: body.clientId,
      vagueId: body.vagueId,
      poidsTotalKg: body.poidsTotalKg,
      prixUnitaireKg: body.prixUnitaireKg,
      poidsMoyenG:
        typeof body.poidsMoyenG === "number" && body.poidsMoyenG > 0
          ? body.poidsMoyenG
          : undefined,
      notes: body.notes?.trim() || undefined,
      bacDeductions:
        Array.isArray(body.bacDeductions) && body.bacDeductions.length > 0
          ? body.bacDeductions
          : undefined,
    };

    const vente = await createVente(auth.activeSiteId, auth.userId, data);

    // Store idempotency record
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, auth.activeSiteId, vente, 201, hashBody(body));
    }

    return NextResponse.json(vente, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/ventes", error, "Erreur serveur lors de la creation de la vente.", {
      statusMap: [
        { match: "inactif", status: 404 },
        { match: ["insuffisant", "annulee"], status: 409 },
        { match: "poids moyen", status: 400 },
      ],
    });
  }
}
