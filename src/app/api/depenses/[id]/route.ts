import { NextRequest, NextResponse } from "next/server";
import {
  getDepenseById,
  updateDepense,
  deleteDepense,
} from "@/lib/queries/depenses";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { CategorieDepense, Permission } from "@/types";
import type { UpdateDepenseDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

const VALID_CATEGORIES = Object.values(CategorieDepense);

/**
 * GET /api/depenses/[id]
 * Retourne le detail d'une depense avec ses paiements.
 *
 * Permission : DEPENSES_VOIR
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_VOIR);
    const { id } = await params;

    const depense = await getDepenseById(id, auth.activeSiteId);
    if (!depense) {
      return apiError(404, "Depense introuvable.");
    }

    return NextResponse.json(depense);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation de la depense.",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/depenses/[id]
 * Modifie une depense existante.
 *
 * Permission : DEPENSES_CREER
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (
      body.categorieDepense !== undefined &&
      !VALID_CATEGORIES.includes(body.categorieDepense as CategorieDepense)
    ) {
      errors.push({
        field: "categorieDepense",
        message: `Valeurs valides : ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    if (
      body.montantTotal !== undefined &&
      (typeof body.montantTotal !== "number" || body.montantTotal <= 0)
    ) {
      errors.push({
        field: "montantTotal",
        message: "Le montant total doit etre un nombre positif.",
      });
    }

    if (
      body.date !== undefined &&
      (typeof body.date !== "string" || isNaN(Date.parse(body.date)))
    ) {
      errors.push({ field: "date", message: "Format ISO 8601 attendu." });
    }

    if (
      body.dateEcheance !== undefined &&
      body.dateEcheance !== null &&
      (typeof body.dateEcheance !== "string" ||
        isNaN(Date.parse(body.dateEcheance)))
    ) {
      errors.push({
        field: "dateEcheance",
        message: "Format ISO 8601 attendu ou null.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: UpdateDepenseDTO = {
      ...(body.description !== undefined && {
        description: body.description.trim(),
      }),
      ...(body.categorieDepense !== undefined && {
        categorieDepense: body.categorieDepense as CategorieDepense,
      }),
      ...(body.montantTotal !== undefined && {
        montantTotal: body.montantTotal,
      }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.dateEcheance !== undefined && {
        dateEcheance: body.dateEcheance,
      }),
      ...(body.vagueId !== undefined && { vagueId: body.vagueId }),
      ...(body.notes !== undefined && { notes: body.notes }),
    };

    const depense = await updateDepense(id, auth.activeSiteId, data);
    return NextResponse.json(depense);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la mise a jour de la depense.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/depenses/[id]
 * Supprime une depense (seulement si statut NON_PAYEE).
 *
 * Permission : DEPENSES_CREER
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;

    const result = await deleteDepense(id, auth.activeSiteId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("Impossible")) {
      return apiError(409, message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la suppression de la depense.",
      },
      { status: 500 }
    );
  }
}
