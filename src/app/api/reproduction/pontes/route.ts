import { NextRequest, NextResponse } from "next/server";
import { listPontes, createPonteV2 } from "@/lib/queries/pontes";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutPonte } from "@/types";
import type { CreatePonteV2DTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_STATUTS = Object.values(StatutPonte);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    if (isNaN(limit) || limit < 1) {
      return apiError(400, "Le parametre limit doit etre un entier positif.");
    }
    if (isNaN(offset) || offset < 0) {
      return apiError(400, "Le parametre offset doit etre un entier positif ou nul.");
    }

    // Filters
    const statut = searchParams.get("statut");
    if (statut && !VALID_STATUTS.includes(statut as StatutPonte)) {
      return apiError(400, `Statut invalide. Valeurs acceptees : ${VALID_STATUTS.join(", ")}.`);
    }

    const femelleId = searchParams.get("femelleId") ?? undefined;
    const lotGeniteursFemellId = searchParams.get("lotGeniteursFemellId") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;

    const { data, total } = await listPontes(auth.activeSiteId, {
      statut: statut ?? undefined,
      femelleId,
      lotGeniteursFemellId,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/pontes",
      error,
      "Erreur serveur lors de la recuperation des pontes."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_GERER);
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // datePonte — required
    if (!body.datePonte || typeof body.datePonte !== "string" || isNaN(Date.parse(body.datePonte))) {
      errors.push({
        field: "datePonte",
        message: "La date de ponte est obligatoire (format ISO 8601).",
      });
    }

    // XOR : exactement un des deux champs femelle
    const hasFemelleId = Boolean(body.femelleId);
    const hasLotFemelle = Boolean(body.lotGeniteursFemellId);

    if (!hasFemelleId && !hasLotFemelle) {
      errors.push({
        field: "femelleId",
        message: "Exactement un des deux champs doit etre fourni : femelleId ou lotGeniteursFemellId.",
      });
    } else if (hasFemelleId && hasLotFemelle) {
      errors.push({
        field: "femelleId",
        message: "Seul un des deux champs doit etre fourni : femelleId ou lotGeniteursFemellId (pas les deux).",
      });
    }

    // doseHormone — optionnel, doit etre >= 0 si fourni
    if (
      body.doseHormone !== undefined &&
      body.doseHormone !== null &&
      (typeof body.doseHormone !== "number" || body.doseHormone < 0)
    ) {
      errors.push({
        field: "doseHormone",
        message: "La dose hormonale doit etre un nombre positif ou nul.",
      });
    }

    // coutHormone — optionnel, doit etre >= 0 si fourni
    if (
      body.coutHormone !== undefined &&
      body.coutHormone !== null &&
      (typeof body.coutHormone !== "number" || body.coutHormone < 0)
    ) {
      errors.push({
        field: "coutHormone",
        message: "Le cout hormonal doit etre un nombre positif ou nul.",
      });
    }

    // temperatureEauC — optionnel, doit etre un nombre si fourni
    if (
      body.temperatureEauC !== undefined &&
      body.temperatureEauC !== null &&
      typeof body.temperatureEauC !== "number"
    ) {
      errors.push({
        field: "temperatureEauC",
        message: "La temperature de l'eau doit etre un nombre.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreatePonteV2DTO = {
      datePonte: body.datePonte,
      femelleId: body.femelleId ?? undefined,
      lotGeniteursFemellId: body.lotGeniteursFemellId ?? undefined,
      maleId: body.maleId ?? undefined,
      lotGeniteursMaleId: body.lotGeniteursMaleId ?? undefined,
      typeHormone: body.typeHormone ?? undefined,
      doseHormone: body.doseHormone ?? undefined,
      doseMgKg: body.doseMgKg ?? undefined,
      coutHormone: body.coutHormone ?? undefined,
      heureInjection: body.heureInjection ?? undefined,
      temperatureEauC: body.temperatureEauC ?? undefined,
      notes: body.notes?.trim() ?? undefined,
      code: body.code?.trim() ?? undefined,
    };

    const ponte = await createPonteV2(auth.activeSiteId, dto);

    return NextResponse.json(
      { id: ponte.id, code: ponte.code, statut: ponte.statut },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/pontes",
      error,
      "Erreur serveur lors de la creation de la ponte.",
      {
        statusMap: [
          {
            match: [
              "Exactement un des deux champs",
              "n'appartient pas",
              "doit avoir le statut ACTIF",
              "Aucun reproducteur actif",
            ],
            status: 400,
          },
        ],
      }
    );
  }
}
