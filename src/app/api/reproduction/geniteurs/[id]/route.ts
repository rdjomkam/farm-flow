/**
 * GET    /api/reproduction/geniteurs/[id] — Détail d'un lot de géniteurs ou reproducteur
 * PATCH  /api/reproduction/geniteurs/[id] — Met à jour un lot de géniteurs ou reproducteur
 * DELETE /api/reproduction/geniteurs/[id] — Supprime un lot de géniteurs ou reproducteur
 *
 * Le type (GROUPE ou INDIVIDUEL) est déterminé via le query param `mode`
 * (défaut : GROUPE). Pour PATCH, il peut aussi être fourni dans le body.
 *
 * Règle DELETE — refus si des pontes actives sont liées (non terminées/échouées).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getLotGeniteursById,
  updateLotGeniteurs,
  deleteLotGeniteurs,
} from "@/lib/queries/geniteurs";
import {
  getReproducteurById,
  updateReproducteur,
  deleteReproducteur,
} from "@/lib/queries/reproducteurs";
import { requirePermission } from "@/lib/permissions";
import {
  Permission,
  SexeReproducteur,
  StatutReproducteur,
} from "@/types";
import type { UpdateLotGeniteurDTO } from "@/types";
import type { UpdateReproducteurDTO } from "@/lib/queries/reproducteurs";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/reproduction/geniteurs/[id]
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "GROUPE";

    if (mode === "INDIVIDUEL") {
      const reproducteur = await getReproducteurById(id, auth.activeSiteId);
      if (!reproducteur) {
        return apiError(404, "Reproducteur introuvable.");
      }
      return NextResponse.json(reproducteur);
    }

    // Défaut : mode GROUPE — chercher d'abord en tant que LotGeniteurs
    const lot = await getLotGeniteursById(id, auth.activeSiteId);
    if (lot) {
      return NextResponse.json(lot);
    }

    // Fallback : essayer en tant que Reproducteur individuel
    const reproducteur = await getReproducteurById(id, auth.activeSiteId);
    if (reproducteur) {
      return NextResponse.json(reproducteur);
    }

    return apiError(404, "Géniteur introuvable.");
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/geniteurs/[id]",
      error,
      "Erreur serveur lors de la récupération du géniteur."
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/geniteurs/[id]
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Déterminer le mode : depuis le body en priorité, sinon depuis query param
    const { searchParams } = new URL(request.url);
    const mode = body.mode ?? searchParams.get("mode") ?? "GROUPE";

    if (mode !== "GROUPE" && mode !== "INDIVIDUEL") {
      return apiError(400, "Le paramètre 'mode' doit être 'GROUPE' ou 'INDIVIDUEL'.");
    }

    if (mode === "GROUPE") {
      // -----------------------------------------------------------------------
      // Validation pour UpdateLotGeniteurDTO
      // -----------------------------------------------------------------------

      // nom optionnel non vide
      if (body.nom !== undefined) {
        if (typeof body.nom !== "string" || body.nom.trim() === "") {
          errors.push({ field: "nom", message: "Le nom ne peut pas être vide." });
        }
      }

      // nombrePoissons optionnel > 0
      if (body.nombrePoissons !== undefined) {
        if (!Number.isInteger(body.nombrePoissons) || body.nombrePoissons <= 0) {
          errors.push({
            field: "nombrePoissons",
            message: "Le nombre de poissons doit être un entier supérieur à 0.",
          });
        }
      }

      // poidsMoyenG optionnel > 0
      if (body.poidsMoyenG !== undefined && body.poidsMoyenG !== null) {
        if (typeof body.poidsMoyenG !== "number" || body.poidsMoyenG <= 0) {
          errors.push({
            field: "poidsMoyenG",
            message: "Le poids moyen doit être un nombre supérieur à 0.",
          });
        }
      }

      // statut optionnel
      if (
        body.statut !== undefined &&
        !Object.values(StatutReproducteur).includes(body.statut as StatutReproducteur)
      ) {
        errors.push({
          field: "statut",
          message: `Statut invalide. Valeurs acceptées : ${Object.values(StatutReproducteur).join(", ")}.`,
        });
      }

      if (errors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors });
      }

      const dto: UpdateLotGeniteurDTO = {};
      if (body.nom !== undefined) dto.nom = body.nom.trim();
      if (body.nombrePoissons !== undefined) dto.nombrePoissons = body.nombrePoissons;
      if (body.poidsMoyenG !== undefined) dto.poidsMoyenG = body.poidsMoyenG;
      if (body.poidsMinG !== undefined) dto.poidsMinG = body.poidsMinG;
      if (body.poidsMaxG !== undefined) dto.poidsMaxG = body.poidsMaxG;
      if (body.origine !== undefined) dto.origine = body.origine?.trim() || null;
      if (body.sourcing !== undefined) dto.sourcing = body.sourcing;
      if (body.generation !== undefined) dto.generation = body.generation;
      if (body.nombreMalesDisponibles !== undefined)
        dto.nombreMalesDisponibles = body.nombreMalesDisponibles;
      if (body.seuilAlerteMales !== undefined) dto.seuilAlerteMales = body.seuilAlerteMales;
      if (body.dateRenouvellementGenetique !== undefined)
        dto.dateRenouvellementGenetique = body.dateRenouvellementGenetique;
      if (body.bacId !== undefined) dto.bacId = body.bacId;
      if (body.statut !== undefined) dto.statut = body.statut as StatutReproducteur;
      if (body.notes !== undefined) dto.notes = body.notes?.trim() || null;

      const lot = await updateLotGeniteurs(id, auth.activeSiteId, dto);
      return NextResponse.json(lot);
    } else {
      // mode === "INDIVIDUEL"
      // -----------------------------------------------------------------------
      // Validation pour UpdateReproducteurDTO
      // -----------------------------------------------------------------------

      // code optionnel non vide
      if (body.code !== undefined) {
        if (typeof body.code !== "string" || body.code.trim() === "") {
          errors.push({ field: "code", message: "Le code ne peut pas être vide." });
        }
      }

      // sexe optionnel
      if (
        body.sexe !== undefined &&
        !Object.values(SexeReproducteur).includes(body.sexe as SexeReproducteur)
      ) {
        errors.push({
          field: "sexe",
          message: `Sexe invalide. Valeurs acceptées : ${Object.values(SexeReproducteur).join(", ")}.`,
        });
      }

      // poids optionnel > 0
      if (body.poids !== undefined) {
        if (typeof body.poids !== "number" || body.poids <= 0) {
          errors.push({
            field: "poids",
            message: "Le poids doit être un nombre supérieur à 0.",
          });
        }
      }

      // age optionnel >= 0
      if (body.age !== undefined && body.age !== null) {
        if (!Number.isInteger(body.age) || body.age < 0) {
          errors.push({ field: "age", message: "L'âge doit être un entier positif ou nul." });
        }
      }

      // statut optionnel
      if (
        body.statut !== undefined &&
        !Object.values(StatutReproducteur).includes(body.statut as StatutReproducteur)
      ) {
        errors.push({
          field: "statut",
          message: `Statut invalide. Valeurs acceptées : ${Object.values(StatutReproducteur).join(", ")}.`,
        });
      }

      if (errors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors });
      }

      const dto: UpdateReproducteurDTO = {};
      if (body.code !== undefined) dto.code = body.code.trim();
      if (body.sexe !== undefined) dto.sexe = body.sexe as SexeReproducteur;
      if (body.poids !== undefined) dto.poids = body.poids;
      if (body.age !== undefined) dto.age = body.age;
      if (body.origine !== undefined) dto.origine = body.origine?.trim() || undefined;
      if (body.statut !== undefined) dto.statut = body.statut as StatutReproducteur;
      if (body.notes !== undefined) dto.notes = body.notes?.trim() || undefined;

      const reproducteur = await updateReproducteur(id, auth.activeSiteId, dto);
      return NextResponse.json(reproducteur);
    }
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/geniteurs/[id]",
      error,
      "Erreur serveur lors de la mise à jour du géniteur.",
      {
        statusMap: [
          { match: ["n'est pas ACTIF", "statut doit etre"], status: 409 },
          { match: "déjà utilisé", status: 409 },
        ],
      }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/reproduction/geniteurs/[id]
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_SUPPRIMER);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "GROUPE";

    if (mode !== "GROUPE" && mode !== "INDIVIDUEL") {
      return apiError(400, "Le paramètre 'mode' doit être 'GROUPE' ou 'INDIVIDUEL'.");
    }

    if (mode === "INDIVIDUEL") {
      await deleteReproducteur(id, auth.activeSiteId);
      return NextResponse.json({ success: true });
    }

    // Défaut : mode GROUPE — tenter deleteLotGeniteurs
    // Si introuvable, essayer deleteReproducteur comme fallback
    try {
      await deleteLotGeniteurs(id, auth.activeSiteId);
      return NextResponse.json({ success: true });
    } catch (err) {
      // Si l'erreur contient "ponte" → c'est un refus métier → propager
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("ponte")) {
        return apiError(409, msg);
      }
      // Si introuvable dans LotGeniteurs, essayer Reproducteur
      if (msg.includes("introuvable")) {
        await deleteReproducteur(id, auth.activeSiteId);
        return NextResponse.json({ success: true });
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(
      "DELETE /api/reproduction/geniteurs/[id]",
      error,
      "Erreur serveur lors de la suppression du géniteur.",
      {
        statusMap: [
          { match: "ponte", status: 409 },
        ],
      }
    );
  }
}
