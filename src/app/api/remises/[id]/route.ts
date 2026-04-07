/**
 * src/app/api/remises/[id]/route.ts
 *
 * GET    /api/remises/[id]  — détail (auth + REMISES_GERER)
 * PUT    /api/remises/[id]  — modifier (auth + REMISES_GERER) — code et type immutables
 * DELETE /api/remises/[id]  — supprimer si nombreUtilisations=0, sinon désactiver
 *
 * Story 35.1 — Sprint 35
 * R2 : enums importés depuis @/types
 * R4 : desactiverRemise via updateMany (atomique)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getRemiseById,
  updateRemise,
  deleteRemise,
  desactiverRemise,
} from "@/lib/queries/remises";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateRemiseDTO } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, Permission.REMISES_GERER);
    const { id } = await params;

    const remise = await getRemiseById(id);
    if (!remise) {
      return apiError(404, "Remise introuvable.");
    }

    return NextResponse.json({ remise });
  } catch (error) {
    return handleApiError("GET /api/remises/[id]", error, "Erreur serveur lors de la recuperation de la remise.");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, Permission.REMISES_GERER);
    const { id } = await params;
    const body = await request.json();

    // Vérifier que la remise existe
    const existing = await getRemiseById(id);
    if (!existing) {
      return apiError(404, "Remise introuvable.");
    }

    // Construire le DTO de mise à jour — ignorer silencieusement code et type
    const data: UpdateRemiseDTO = {};
    if (body.nom !== undefined) data.nom = body.nom;
    if (body.valeur !== undefined) data.valeur = body.valeur;
    if (body.estPourcentage !== undefined) data.estPourcentage = body.estPourcentage;
    if (body.dateDebut !== undefined) data.dateDebut = body.dateDebut;
    if (body.dateFin !== undefined) data.dateFin = body.dateFin;
    if (body.limiteUtilisations !== undefined) data.limiteUtilisations = body.limiteUtilisations;
    if (body.isActif !== undefined) data.isActif = body.isActif;

    // Validation basique
    const errors: { field: string; message: string }[] = [];
    if (data.valeur !== undefined && (typeof data.valeur !== "number" || data.valeur <= 0)) {
      errors.push({ field: "valeur", message: "La valeur doit être un nombre positif." });
    }
    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const remise = await updateRemise(id, data);
    return NextResponse.json({ remise });
  } catch (error) {
    return handleApiError("PUT /api/remises/[id]", error, "Erreur serveur lors de la mise a jour de la remise.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, Permission.REMISES_GERER);
    const { id } = await params;

    const existing = await getRemiseById(id);
    if (!existing) {
      return apiError(404, "Remise introuvable.");
    }

    // Supprimer si jamais utilisée, sinon désactiver — R4 : desactiverRemise via updateMany
    if (existing.nombreUtilisations === 0) {
      await deleteRemise(id);
      return NextResponse.json({ message: "Remise supprimée.", deleted: true });
    } else {
      await desactiverRemise(id);
      return NextResponse.json({
        message: "Remise désactivée (déjà utilisée, suppression impossible).",
        deleted: false,
        nombreUtilisations: existing.nombreUtilisations,
      });
    }
  } catch (error) {
    return handleApiError("DELETE /api/remises/[id]", error, "Erreur serveur lors de la suppression de la remise.");
  }
}
