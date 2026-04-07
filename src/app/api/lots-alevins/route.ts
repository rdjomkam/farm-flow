import { NextRequest, NextResponse } from "next/server";
import { getLotsAlevins, createLotAlevins } from "@/lib/queries/lots-alevins";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutLotAlevins } from "@/types";
import type { CreateLotAlevinsDTO } from "@/lib/queries/lots-alevins";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_VOIR);
    const { searchParams } = new URL(request.url);

    const statutParam = searchParams.get("statut");
    const ponteId = searchParams.get("ponteId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const statut =
      statutParam &&
      Object.values(StatutLotAlevins).includes(statutParam as StatutLotAlevins)
        ? (statutParam as StatutLotAlevins)
        : undefined;

    const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? 50 : limitParam, 200);
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

    const result = await getLotsAlevins(
      auth.activeSiteId,
      { statut, ponteId, search },
      { limit, offset }
    );

    return NextResponse.json({
      data: result.data,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError("GET /api/lots-alevins", error, "Erreur serveur lors de la recuperation des lots d'alevins.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : code obligatoire
    if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
      errors.push({ field: "code", message: "Le code est obligatoire." });
    }

    // Validation : ponteId obligatoire
    if (!body.ponteId || typeof body.ponteId !== "string" || body.ponteId.trim() === "") {
      errors.push({ field: "ponteId", message: "L'identifiant de la ponte est obligatoire." });
    }

    // Validation : nombreInitial obligatoire > 0
    if (body.nombreInitial === undefined || body.nombreInitial === null) {
      errors.push({ field: "nombreInitial", message: "Le nombre initial est obligatoire." });
    } else if (!Number.isInteger(body.nombreInitial) || body.nombreInitial <= 0) {
      errors.push({
        field: "nombreInitial",
        message: "Le nombre initial doit etre un entier superieur a 0.",
      });
    }

    // Validation : nombreActuel optionnel >= 0
    if (body.nombreActuel !== undefined && body.nombreActuel !== null) {
      if (!Number.isInteger(body.nombreActuel) || body.nombreActuel < 0) {
        errors.push({
          field: "nombreActuel",
          message: "Le nombre actuel doit etre un entier positif ou nul.",
        });
      }
    }

    // Validation : ageJours optionnel >= 0
    if (body.ageJours !== undefined && body.ageJours !== null) {
      if (!Number.isInteger(body.ageJours) || body.ageJours < 0) {
        errors.push({
          field: "ageJours",
          message: "L'age en jours doit etre un entier positif ou nul.",
        });
      }
    }

    // Validation : poidsMoyen optionnel > 0
    if (body.poidsMoyen !== undefined && body.poidsMoyen !== null) {
      if (typeof body.poidsMoyen !== "number" || body.poidsMoyen <= 0) {
        errors.push({
          field: "poidsMoyen",
          message: "Le poids moyen doit etre un nombre superieur a 0.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // nombreActuel par defaut = nombreInitial si non fourni
    const nombreActuel =
      body.nombreActuel !== undefined ? body.nombreActuel : body.nombreInitial;

    const data: CreateLotAlevinsDTO = {
      code: body.code.trim(),
      ponteId: body.ponteId.trim(),
      nombreInitial: body.nombreInitial,
      nombreActuel,
      ageJours: body.ageJours ?? undefined,
      poidsMoyen: body.poidsMoyen ?? undefined,
      bacId: body.bacId?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
    };

    const lot = await createLotAlevins(auth.activeSiteId, data);
    return NextResponse.json(lot, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/lots-alevins", error, "Erreur serveur lors de la creation du lot d'alevins.", {
      statusMap: [{ match: "occupe", status: 409 }],
    });
  }
}
