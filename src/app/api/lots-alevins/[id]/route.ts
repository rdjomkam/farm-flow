import { NextRequest, NextResponse } from "next/server";
import {
  getLotAlevinsById,
  updateLotAlevins,
} from "@/lib/queries/lots-alevins";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutLotAlevins } from "@/types";
import type { UpdateLotAlevinsDTO } from "@/lib/queries/lots-alevins";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { id } = await params;

    const lot = await getLotAlevinsById(id, auth.activeSiteId);
    if (!lot) {
      return apiError(404, "Lot d'alevins introuvable.");
    }

    return NextResponse.json(lot);
  } catch (error) {
    console.error("[GET /api/lots-alevins/[id]]", error);
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

    // Validation : statut optionnel
    if (
      body.statut !== undefined &&
      !Object.values(StatutLotAlevins).includes(body.statut as StatutLotAlevins)
    ) {
      errors.push({
        field: "statut",
        message: `Statut invalide. Valeurs acceptees : ${Object.values(StatutLotAlevins).join(", ")}.`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: UpdateLotAlevinsDTO = {};
    if (body.nombreActuel !== undefined) data.nombreActuel = body.nombreActuel;
    if (body.ageJours !== undefined) data.ageJours = body.ageJours;
    if (body.poidsMoyen !== undefined) data.poidsMoyen = body.poidsMoyen ?? null;
    if (body.statut !== undefined) data.statut = body.statut as StatutLotAlevins;
    if (body.bacId !== undefined) data.bacId = body.bacId ?? null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || undefined;
    if (body.code !== undefined) data.code = body.code?.trim();

    const lot = await updateLotAlevins(id, auth.activeSiteId, data);
    return NextResponse.json(lot);
  } catch (error) {
    console.error("[PUT /api/lots-alevins/[id]]", error);
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
    // Conflit : code deja utilise, bac occupe ou statut invalide
    if (
      message.includes("deja utilise") ||
      message.includes("déjà utilisé") ||
      message.includes("occupe") ||
      message.includes("deja assigne") ||
      message.includes("déjà assigné") ||
      message.includes("n'est pas ACTIF") ||
      message.includes("statut doit etre")
    ) {
      return apiError(409, message);
    }
    return apiError(500, message);
  }
}
