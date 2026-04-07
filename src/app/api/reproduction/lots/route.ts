import { NextRequest, NextResponse } from "next/server";
import { listLots, createLot } from "@/lib/queries/lots-alevins";
import { requirePermission } from "@/lib/permissions";
import { Permission, PhaseLot, StatutLotAlevins } from "@/types";
import type { CreateLotAlevinsDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_PHASES = Object.values(PhaseLot);
const VALID_STATUTS = Object.values(StatutLotAlevins);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_VOIR);
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
      return apiError(
        400,
        "Le parametre offset doit etre un entier positif ou nul."
      );
    }

    // Filters
    const phase = searchParams.get("phase");
    if (phase && !VALID_PHASES.includes(phase as PhaseLot)) {
      return apiError(
        400,
        `Phase invalide. Valeurs acceptees : ${VALID_PHASES.join(", ")}.`
      );
    }

    const statut = searchParams.get("statut");
    if (statut && !VALID_STATUTS.includes(statut as StatutLotAlevins)) {
      return apiError(
        400,
        `Statut invalide. Valeurs acceptees : ${VALID_STATUTS.join(", ")}.`
      );
    }

    const ponteId = searchParams.get("ponteId") ?? undefined;
    const bacId = searchParams.get("bacId") ?? undefined;

    const { data, total } = await listLots(auth.activeSiteId, {
      phase: phase ?? undefined,
      statut: statut ?? undefined,
      ponteId,
      bacId,
      limit,
      offset,
    });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/lots",
      error,
      "Erreur serveur lors de la recuperation des lots d'alevins."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_GERER);
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // code — required
    if (!body.code || typeof body.code !== "string" || !body.code.trim()) {
      errors.push({
        field: "code",
        message: "Le code du lot est obligatoire.",
      });
    }

    // ponteId — required
    if (!body.ponteId || typeof body.ponteId !== "string") {
      errors.push({
        field: "ponteId",
        message: "L'identifiant de la ponte est obligatoire.",
      });
    }

    // nombreInitial — required, integer > 0
    if (
      body.nombreInitial === undefined ||
      body.nombreInitial === null ||
      typeof body.nombreInitial !== "number" ||
      !Number.isInteger(body.nombreInitial) ||
      body.nombreInitial <= 0
    ) {
      errors.push({
        field: "nombreInitial",
        message: "Le nombre initial de poissons est obligatoire et doit etre un entier positif.",
      });
    }

    // nombreActuel — optional, integer >= 0 if provided
    if (
      body.nombreActuel !== undefined &&
      body.nombreActuel !== null &&
      (typeof body.nombreActuel !== "number" ||
        !Number.isInteger(body.nombreActuel) ||
        body.nombreActuel < 0)
    ) {
      errors.push({
        field: "nombreActuel",
        message: "Le nombre actuel de poissons doit etre un entier positif ou nul.",
      });
    }

    // ageJours — optional, integer >= 0
    if (
      body.ageJours !== undefined &&
      body.ageJours !== null &&
      (typeof body.ageJours !== "number" ||
        !Number.isInteger(body.ageJours) ||
        body.ageJours < 0)
    ) {
      errors.push({
        field: "ageJours",
        message: "L'age en jours doit etre un entier positif ou nul.",
      });
    }

    // poidsMoyen — optional, number >= 0
    if (
      body.poidsMoyen !== undefined &&
      body.poidsMoyen !== null &&
      (typeof body.poidsMoyen !== "number" || body.poidsMoyen < 0)
    ) {
      errors.push({
        field: "poidsMoyen",
        message: "Le poids moyen doit etre un nombre positif ou nul.",
      });
    }

    // phase — optional, must be a valid PhaseLot if provided
    if (
      body.phase !== undefined &&
      !VALID_PHASES.includes(body.phase as PhaseLot)
    ) {
      errors.push({
        field: "phase",
        message: `Phase invalide. Valeurs acceptees : ${VALID_PHASES.join(", ")}.`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreateLotAlevinsDTO = {
      code: body.code.trim(),
      ponteId: body.ponteId,
      nombreInitial: body.nombreInitial,
      nombreActuel: body.nombreActuel ?? undefined,
      ageJours: body.ageJours ?? undefined,
      poidsMoyen: body.poidsMoyen ?? undefined,
      statut: body.statut ?? undefined,
      phase: body.phase ?? undefined,
      bacId: body.bacId ?? undefined,
      incubationId: body.incubationId ?? undefined,
      dateDebutPhase: body.dateDebutPhase ?? undefined,
      poidsObjectifG: body.poidsObjectifG ?? undefined,
      notes: body.notes?.trim() ?? undefined,
    };

    const lot = await createLot(auth.activeSiteId, dto);

    return NextResponse.json(lot, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/lots",
      error,
      "Erreur serveur lors de la creation du lot d'alevins.",
      {
        statusMap: [
          {
            match: ["deja utilise", "introuvable"],
            status: 409,
          },
        ],
      }
    );
  }
}
