import { NextRequest, NextResponse } from "next/server";
import {
  getDepenseRecurrenteById,
  updateDepenseRecurrente,
  deleteDepenseRecurrente,
} from "@/lib/queries/depenses-recurrentes";
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
      return NextResponse.json(
        { status: 404, message: "Template introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { status: 400, message: "categorieDepense invalide." },
        { status: 400 }
      );
    }
    if (
      body.frequence !== undefined &&
      !VALID_FREQUENCES.includes(body.frequence)
    ) {
      return NextResponse.json(
        { status: 400, message: "frequence invalide." },
        { status: 400 }
      );
    }
    if (
      body.jourDuMois !== undefined &&
      (typeof body.jourDuMois !== "number" || body.jourDuMois < 1 || body.jourDuMois > 28)
    ) {
      return NextResponse.json(
        { status: 400, message: "jourDuMois doit etre compris entre 1 et 28." },
        { status: 400 }
      );
    }
    if (
      body.montantEstime !== undefined &&
      (typeof body.montantEstime !== "number" || body.montantEstime <= 0)
    ) {
      return NextResponse.json(
        { status: 400, message: "montantEstime doit etre un nombre positif." },
        { status: 400 }
      );
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
