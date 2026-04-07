import { NextRequest, NextResponse } from "next/server";
import { getPontes, createPonte } from "@/lib/queries/pontes";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutPonte } from "@/types";
import type { CreatePonteDTO } from "@/lib/queries/pontes";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_VOIR);
    const { searchParams } = new URL(request.url);

    const statutParam = searchParams.get("statut");
    const femelleId = searchParams.get("femelleId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const statut =
      statutParam &&
      Object.values(StatutPonte).includes(statutParam as StatutPonte)
        ? (statutParam as StatutPonte)
        : undefined;

    const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? 50 : limitParam, 200);
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

    const result = await getPontes(
      auth.activeSiteId,
      { statut, femelleId, search },
      { limit, offset }
    );

    return NextResponse.json({
      data: result.data,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError("GET /api/pontes", error, "Erreur serveur lors de la recuperation des pontes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : code obligatoire
    if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
      errors.push({ field: "code", message: "Le code est obligatoire." });
    }

    // Validation : femelleId obligatoire
    if (!body.femelleId || typeof body.femelleId !== "string" || body.femelleId.trim() === "") {
      errors.push({ field: "femelleId", message: "L'identifiant de la femelle est obligatoire." });
    }

    // Validation : datePonte obligatoire (ISO date)
    if (!body.datePonte) {
      errors.push({ field: "datePonte", message: "La date de ponte est obligatoire." });
    } else {
      const d = new Date(body.datePonte);
      if (isNaN(d.getTime())) {
        errors.push({
          field: "datePonte",
          message: "La date de ponte doit etre une date ISO valide.",
        });
      }
    }

    // Validation : nombreOeufs optionnel > 0
    if (body.nombreOeufs !== undefined && body.nombreOeufs !== null) {
      if (!Number.isInteger(body.nombreOeufs) || body.nombreOeufs <= 0) {
        errors.push({
          field: "nombreOeufs",
          message: "Le nombre d'oeufs doit etre un entier superieur a 0.",
        });
      }
    }

    // Validation : tauxFecondation optionnel 0-100
    if (body.tauxFecondation !== undefined && body.tauxFecondation !== null) {
      if (
        typeof body.tauxFecondation !== "number" ||
        body.tauxFecondation < 0 ||
        body.tauxFecondation > 100
      ) {
        errors.push({
          field: "tauxFecondation",
          message: "Le taux de fecondation doit etre un nombre entre 0 et 100.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreatePonteDTO = {
      code: body.code.trim(),
      femelleId: body.femelleId.trim(),
      maleId: body.maleId?.trim() || undefined,
      datePonte: body.datePonte,
      nombreOeufs: body.nombreOeufs ?? undefined,
      tauxFecondation: body.tauxFecondation ?? undefined,
      notes: body.notes?.trim() || undefined,
    };

    const ponte = await createPonte(auth.activeSiteId, data);
    return NextResponse.json(ponte, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/pontes", error, "Erreur serveur lors de la creation de la ponte.");
  }
}
