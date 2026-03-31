import { NextRequest, NextResponse } from "next/server";
import {
  getPonteById,
  updatePonte,
  deletePonte,
} from "@/lib/queries/pontes";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutPonte } from "@/types";
import type { UpdatePonteDTO } from "@/lib/queries/pontes";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { id } = await params;

    const ponte = await getPonteById(id, auth.activeSiteId);
    if (!ponte) {
      return apiError(404, "Ponte introuvable.");
    }

    return NextResponse.json(ponte);
  } catch (error) {
    console.error("[GET /api/pontes/[id]]", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

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

    // Validation : statut optionnel
    if (
      body.statut !== undefined &&
      !Object.values(StatutPonte).includes(body.statut as StatutPonte)
    ) {
      errors.push({
        field: "statut",
        message: `Statut invalide. Valeurs acceptees : ${Object.values(StatutPonte).join(", ")}.`,
      });
    }

    // Validation : datePonte optionnel (ISO date)
    if (body.datePonte !== undefined) {
      const d = new Date(body.datePonte);
      if (isNaN(d.getTime())) {
        errors.push({
          field: "datePonte",
          message: "La date de ponte doit etre une date ISO valide.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: UpdatePonteDTO = {};
    if (body.nombreOeufs !== undefined) data.nombreOeufs = body.nombreOeufs;
    if (body.tauxFecondation !== undefined) data.tauxFecondation = body.tauxFecondation;
    if (body.statut !== undefined) data.statut = body.statut as StatutPonte;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || undefined;
    if (body.maleId !== undefined) data.maleId = body.maleId ?? null;
    if (body.datePonte !== undefined) data.datePonte = body.datePonte;
    if (body.code !== undefined) data.code = body.code?.trim();

    const ponte = await updatePonte(id, auth.activeSiteId, data);
    return NextResponse.json(ponte);
  } catch (error) {
    console.error("[PUT /api/pontes/[id]]", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable") || message.includes("n'existe pas")) {
      return apiError(404, message);
    }
    // Conflit : code deja utilise ou statut invalide
    if (
      message.includes("deja utilise") ||
      message.includes("déjà utilisé") ||
      message.includes("n'est pas ACTIF") ||
      message.includes("statut doit etre")
    ) {
      return apiError(409, message);
    }
    return apiError(500, message);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_SUPPRIMER);
    const { id } = await params;

    await deletePonte(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/pontes/[id]]", error);
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
    // lots liés → 409
    if (message.includes("lot")) {
      return apiError(409, message);
    }
    return apiError(500, message);
  }
}
