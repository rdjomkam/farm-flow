import { NextRequest, NextResponse } from "next/server";
import {
  getDepenseRecurrenteById,
  updateDepenseRecurrente,
  deleteDepenseRecurrente,
} from "@/lib/queries/depenses-recurrentes";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { CategorieDepense, FrequenceRecurrence, Permission } from "@/types";
import type { UpdateDepenseRecurrenteDTO } from "@/types";

const VALID_CATEGORIES = Object.values(CategorieDepense);
const VALID_FREQUENCES = Object.values(FrequenceRecurrence);

/**
 * GET /api/depenses-recurrentes/[id]
 * Récupère un template par ID.
 * Permission : DEPENSES_VOIR
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_VOIR);
    const { id } = await params;

    const template = await getDepenseRecurrenteById(id, auth.activeSiteId);
    if (!template) {
      return apiError(404, "Template introuvable.");
    }

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

/**
 * PUT /api/depenses-recurrentes/[id]
 * Met à jour un template.
 * Permission : DEPENSES_CREER
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;
    const body = await request.json();

    // Validation optionnelle
    if (
      body.categorieDepense !== undefined &&
      !VALID_CATEGORIES.includes(body.categorieDepense)
    ) {
      return apiError(400, "categorieDepense invalide.");
    }
    if (
      body.frequence !== undefined &&
      !VALID_FREQUENCES.includes(body.frequence)
    ) {
      return apiError(400, "frequence invalide.");
    }
    if (
      body.jourDuMois !== undefined &&
      (typeof body.jourDuMois !== "number" || body.jourDuMois < 1 || body.jourDuMois > 28)
    ) {
      return apiError(400, "jourDuMois doit etre compris entre 1 et 28.");
    }
    if (
      body.montantEstime !== undefined &&
      (typeof body.montantEstime !== "number" || body.montantEstime <= 0)
    ) {
      return apiError(400, "montantEstime doit etre un nombre positif.");
    }

    const dto: UpdateDepenseRecurrenteDTO = {
      ...(body.description !== undefined && { description: body.description }),
      ...(body.categorieDepense !== undefined && { categorieDepense: body.categorieDepense as CategorieDepense }),
      ...(body.montantEstime !== undefined && { montantEstime: body.montantEstime }),
      ...(body.frequence !== undefined && { frequence: body.frequence as FrequenceRecurrence }),
      ...(body.jourDuMois !== undefined && { jourDuMois: body.jourDuMois }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    };

    const updated = await updateDepenseRecurrente(id, auth.activeSiteId, dto);
    return NextResponse.json(updated);
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
    return apiError(500, message);
  }
}

/**
 * DELETE /api/depenses-recurrentes/[id]
 * Supprime un template.
 * Permission : DEPENSES_CREER
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;

    await deleteDepenseRecurrente(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
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
    return apiError(500, message);
  }
}
