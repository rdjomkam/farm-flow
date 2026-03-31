import { NextRequest, NextResponse } from "next/server";
import { getActiviteById, updateActivite, deleteActivite, completeActivite } from "@/lib/queries";
import type { UpdateActiviteDTO, CompleteActiviteDTO } from "@/types";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutActivite } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// Statuts valides pour la mise a jour via PUT (hors TERMINEE geree via completion)
const STATUTS_VALIDES = Object.values(StatutActivite) as string[];

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { id } = await params;

    const activite = await getActiviteById(auth.activeSiteId, id);
    if (!activite) {
      return apiError(404, "Activité introuvable.");
    }

    return NextResponse.json(activite);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/activites/[id]]", error);
    return apiError(500, "Erreur serveur lors de la récupération de l'activité.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_GERER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // --- Complétion inline : statut=TERMINEE avec noteCompletion ou releveId ---
    // Le statut ne peut avancer que vers l'avant (PLANIFIEE/EN_RETARD → TERMINEE).
    // ANNULEE est aussi accepté via cette route (pas de complétion requise).
    if (body.statut === StatutActivite.TERMINEE) {
      const completionData: CompleteActiviteDTO = {};
      if (body.releveId) completionData.releveId = body.releveId;
      if (body.noteCompletion) completionData.noteCompletion = body.noteCompletion;

      const activite = await completeActivite(auth.activeSiteId, id, completionData);
      return NextResponse.json(activite);
    }

    // --- Validation pour les autres mises a jour ---
    if (body.titre !== undefined) {
      if (typeof body.titre !== "string" || body.titre.trim() === "") {
        errors.push({ field: "titre", message: "Le titre ne peut pas être vide." });
      }
    }

    if (body.statut !== undefined) {
      if (!STATUTS_VALIDES.includes(body.statut)) {
        errors.push({
          field: "statut",
          message: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}.`,
        });
      }
    }

    if (body.dateDebut !== undefined) {
      const parsed = Date.parse(body.dateDebut);
      if (isNaN(parsed)) {
        errors.push({ field: "dateDebut", message: "La date de début n'est pas une date ISO valide." });
      }
    }

    if (body.dateFin !== undefined && body.dateFin !== null) {
      const parsed = Date.parse(body.dateFin);
      if (isNaN(parsed)) {
        errors.push({ field: "dateFin", message: "La date de fin n'est pas une date ISO valide." });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: UpdateActiviteDTO = {};
    if (body.titre !== undefined) data.titre = body.titre.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || undefined;
    if (body.statut !== undefined) data.statut = body.statut;
    if (body.dateDebut !== undefined) data.dateDebut = body.dateDebut;
    if (body.dateFin !== undefined) data.dateFin = body.dateFin;
    if (body.recurrence !== undefined) data.recurrence = body.recurrence;
    if (body.vagueId !== undefined) data.vagueId = body.vagueId;
    if (body.bacId !== undefined) data.bacId = body.bacId;
    if (body.assigneAId !== undefined) data.assigneAId = body.assigneAId;

    const activite = await updateActivite(auth.activeSiteId, id, data);

    return NextResponse.json(activite);
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
    if (
      message.includes("requis") ||
      message.includes("deja lie") ||
      message.includes("PLANIFIEE") ||
      message.includes("minimum") ||
      message.includes("terminees ou annulees")
    ) {
      return apiError(400, message);
    }
    console.error("[PUT /api/activites/[id]]", error);
    return apiError(500, message);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_GERER);
    const { id } = await params;

    await deleteActivite(auth.activeSiteId, id);
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
    console.error("[DELETE /api/activites/[id]]", error);
    return apiError(500, message);
  }
}
