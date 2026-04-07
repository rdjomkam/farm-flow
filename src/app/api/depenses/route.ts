import { NextRequest, NextResponse } from "next/server";
import { getDepenses, createDepense } from "@/lib/queries/depenses";
import { requirePermission } from "@/lib/permissions";
import {
  CategorieDepense,
  Permission,
  StatutDepense,
  parsePaginationQuery,
} from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import type { CreateDepenseDTO, DepenseFilters } from "@/types";

const VALID_CATEGORIES = Object.values(CategorieDepense);
const VALID_STATUTS = Object.values(StatutDepense);

/**
 * GET /api/depenses
 * Liste les depenses du site actif avec filtres optionnels.
 *
 * Query params : categorieDepense, statut, dateFrom, dateTo, vagueId, commandeId
 * Permission : DEPENSES_VOIR
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: DepenseFilters = {};

    const categorieDepense = searchParams.get("categorieDepense");
    if (
      categorieDepense &&
      VALID_CATEGORIES.includes(categorieDepense as CategorieDepense)
    ) {
      filters.categorieDepense = categorieDepense as CategorieDepense;
    }

    const statut = searchParams.get("statut");
    if (statut && VALID_STATUTS.includes(statut as StatutDepense)) {
      filters.statut = statut as StatutDepense;
    }

    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const vagueId = searchParams.get("vagueId");
    if (vagueId) filters.vagueId = vagueId;

    const commandeId = searchParams.get("commandeId");
    if (commandeId) filters.commandeId = commandeId;

    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const { data, total } = await getDepenses(auth.activeSiteId, filters, { limit, offset });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    return handleApiError("GET /api/depenses", error, "Erreur serveur lors de la recuperation des depenses.");
  }
}

/**
 * POST /api/depenses
 * Cree une nouvelle depense.
 *
 * Permission : DEPENSES_CREER
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);

    // Idempotency check
    const idempotencyKey = request.headers.get("X-Idempotency-Key");
    if (idempotencyKey && auth.activeSiteId) {
      const { checkIdempotency } = await import("@/lib/idempotency");
      const check = await checkIdempotency(idempotencyKey, auth.activeSiteId);
      if ("isConflict" in check) {
        return NextResponse.json({ status: 409, message: "Cle d'idempotence deja utilisee avec un corps de requete different." }, { status: 409 });
      } else if (check.isDuplicate) {
        return NextResponse.json(check.response, { status: check.statusCode });
      }
    }

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.description || typeof body.description !== "string") {
      errors.push({
        field: "description",
        message: "La description est obligatoire.",
      });
    }

    if (
      !body.categorieDepense ||
      !VALID_CATEGORIES.includes(body.categorieDepense as CategorieDepense)
    ) {
      errors.push({
        field: "categorieDepense",
        message: `La categorie est obligatoire. Valeurs valides : ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    if (
      body.montantTotal === undefined ||
      typeof body.montantTotal !== "number" ||
      body.montantTotal <= 0
    ) {
      errors.push({
        field: "montantTotal",
        message: "Le montant total doit etre un nombre positif.",
      });
    }

    if (
      !body.date ||
      typeof body.date !== "string" ||
      isNaN(Date.parse(body.date))
    ) {
      errors.push({
        field: "date",
        message: "La date est obligatoire (format ISO 8601).",
      });
    }

    if (
      body.dateEcheance &&
      (typeof body.dateEcheance !== "string" ||
        isNaN(Date.parse(body.dateEcheance)))
    ) {
      errors.push({
        field: "dateEcheance",
        message: "La date d'echeance n'est pas valide (format ISO 8601).",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateDepenseDTO = {
      description: body.description.trim(),
      categorieDepense: body.categorieDepense as CategorieDepense,
      montantTotal: body.montantTotal,
      date: body.date,
      dateEcheance: body.dateEcheance || undefined,
      vagueId: body.vagueId || undefined,
      commandeId: body.commandeId || undefined,
      notes: body.notes?.trim() || undefined,
    };

    const depense = await createDepense(auth.activeSiteId, auth.userId, data);

    // Store idempotency record
    if (idempotencyKey && auth.activeSiteId) {
      const { storeIdempotency } = await import("@/lib/idempotency");
      await storeIdempotency(idempotencyKey, auth.activeSiteId, depense, 201);
    }

    return NextResponse.json(depense, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/depenses", error, "Erreur serveur lors de la creation de la depense.");
  }
}
