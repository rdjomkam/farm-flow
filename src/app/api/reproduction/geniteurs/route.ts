/**
 * GET  /api/reproduction/geniteurs — Liste lots de géniteurs ou reproducteurs
 * POST /api/reproduction/geniteurs — Crée un lot de géniteurs (mode GROUPE)
 *                                    ou un reproducteur (mode INDIVIDUEL)
 *
 * Query params (GET) :
 *   mode    : "GROUPE" | "INDIVIDUEL"  (défaut : "GROUPE")
 *   sexe    : SexeReproducteur
 *   statut  : StatutReproducteur
 *   bacId   : string (filtrage sur bac — GROUPE uniquement)
 *   limit   : number (défaut 50, max 200)
 *   offset  : number (défaut 0)
 *
 * Body (POST) :
 *   mode    : "GROUPE" | "INDIVIDUEL"  (obligatoire)
 *   ...champs CreateLotGeniteurDTO ou CreateReproducteurDTO
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listLotGeniteurs,
  createLotGeniteurs,
  listReproducteurs,
} from "@/lib/queries/geniteurs";
import { createReproducteur } from "@/lib/queries/reproducteurs";
import { requirePermission } from "@/lib/permissions";
import {
  Permission,
  SexeReproducteur,
  StatutReproducteur,
} from "@/types";
import type { CreateLotGeniteurDTO } from "@/types";
import type { CreateReproducteurDTO } from "@/lib/queries/reproducteurs";
import { apiError, handleApiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/reproduction/geniteurs
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("mode") ?? "GROUPE";

    // Validation de mode
    if (mode !== "GROUPE" && mode !== "INDIVIDUEL") {
      return apiError(400, "Le paramètre 'mode' doit être 'GROUPE' ou 'INDIVIDUEL'.");
    }

    // Pagination commune
    const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? 50 : limitParam, 200);
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

    // Filtre sexe (commun)
    const sexeParam = searchParams.get("sexe");
    const sexe =
      sexeParam &&
      Object.values(SexeReproducteur).includes(sexeParam as SexeReproducteur)
        ? (sexeParam as SexeReproducteur)
        : undefined;

    // Filtre statut (commun)
    const statutParam = searchParams.get("statut");
    const statut =
      statutParam &&
      Object.values(StatutReproducteur).includes(statutParam as StatutReproducteur)
        ? (statutParam as StatutReproducteur)
        : undefined;

    if (mode === "GROUPE") {
      const bacId = searchParams.get("bacId") ?? undefined;

      const result = await listLotGeniteurs(auth.activeSiteId, {
        sexe,
        statut,
        bacId,
        limit,
        offset,
      });

      return NextResponse.json({
        data: result.data,
        total: result.total,
        limit,
        offset,
      });
    } else {
      // mode === "INDIVIDUEL"
      const result = await listReproducteurs(auth.activeSiteId, {
        sexe,
        statut,
        limit,
        offset,
      });

      return NextResponse.json({
        data: result.data,
        total: result.total,
        limit,
        offset,
      });
    }
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/geniteurs",
      error,
      "Erreur serveur lors de la récupération des géniteurs."
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/reproduction/geniteurs
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : mode obligatoire
    if (!body.mode || (body.mode !== "GROUPE" && body.mode !== "INDIVIDUEL")) {
      return apiError(400, "Le champ 'mode' est obligatoire et doit être 'GROUPE' ou 'INDIVIDUEL'.");
    }

    const mode: "GROUPE" | "INDIVIDUEL" = body.mode;

    if (mode === "GROUPE") {
      // -----------------------------------------------------------------------
      // Validation pour CreateLotGeniteurDTO
      // -----------------------------------------------------------------------

      // nom obligatoire
      if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
        errors.push({ field: "nom", message: "Le nom est obligatoire." });
      }

      // sexe obligatoire
      if (
        !body.sexe ||
        !Object.values(SexeReproducteur).includes(body.sexe as SexeReproducteur)
      ) {
        errors.push({
          field: "sexe",
          message: `Le sexe est obligatoire. Valeurs acceptées : ${Object.values(SexeReproducteur).join(", ")}.`,
        });
      }

      // nombrePoissons obligatoire > 0
      if (body.nombrePoissons === undefined || body.nombrePoissons === null) {
        errors.push({ field: "nombrePoissons", message: "Le nombre de poissons est obligatoire." });
      } else if (!Number.isInteger(body.nombrePoissons) || body.nombrePoissons <= 0) {
        errors.push({
          field: "nombrePoissons",
          message: "Le nombre de poissons doit être un entier supérieur à 0.",
        });
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

      // dateAcquisition optionnel (ISO date)
      if (body.dateAcquisition !== undefined) {
        const d = new Date(body.dateAcquisition);
        if (isNaN(d.getTime())) {
          errors.push({
            field: "dateAcquisition",
            message: "La date d'acquisition doit être une date ISO valide.",
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

      const dto: CreateLotGeniteurDTO = {
        code: body.code?.trim() || undefined,
        nom: body.nom.trim(),
        sexe: body.sexe as SexeReproducteur,
        nombrePoissons: body.nombrePoissons,
        poidsMoyenG: body.poidsMoyenG ?? null,
        poidsMinG: body.poidsMinG ?? null,
        poidsMaxG: body.poidsMaxG ?? null,
        origine: body.origine?.trim() || null,
        sourcing: body.sourcing || undefined,
        generation: body.generation || undefined,
        dateAcquisition: body.dateAcquisition || undefined,
        nombreMalesDisponibles: body.nombreMalesDisponibles ?? null,
        seuilAlerteMales: body.seuilAlerteMales ?? null,
        dateRenouvellementGenetique: body.dateRenouvellementGenetique || null,
        bacId: body.bacId || null,
        statut: body.statut || undefined,
        notes: body.notes?.trim() || null,
      };

      const lot = await createLotGeniteurs(auth.activeSiteId, dto);
      return NextResponse.json(lot, { status: 201 });
    } else {
      // mode === "INDIVIDUEL"
      // -----------------------------------------------------------------------
      // Validation pour CreateReproducteurDTO
      // -----------------------------------------------------------------------

      // code obligatoire
      if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
        errors.push({ field: "code", message: "Le code est obligatoire." });
      }

      // sexe obligatoire
      if (
        !body.sexe ||
        !Object.values(SexeReproducteur).includes(body.sexe as SexeReproducteur)
      ) {
        errors.push({
          field: "sexe",
          message: `Le sexe est obligatoire. Valeurs acceptées : ${Object.values(SexeReproducteur).join(", ")}.`,
        });
      }

      // poids obligatoire > 0
      if (body.poids === undefined || body.poids === null) {
        errors.push({ field: "poids", message: "Le poids est obligatoire." });
      } else if (typeof body.poids !== "number" || body.poids <= 0) {
        errors.push({
          field: "poids",
          message: "Le poids doit être un nombre supérieur à 0.",
        });
      }

      // age optionnel >= 0
      if (body.age !== undefined && body.age !== null) {
        if (!Number.isInteger(body.age) || body.age < 0) {
          errors.push({ field: "age", message: "L'âge doit être un entier positif ou nul." });
        }
      }

      // dateAcquisition optionnel (ISO date)
      if (body.dateAcquisition !== undefined) {
        const d = new Date(body.dateAcquisition);
        if (isNaN(d.getTime())) {
          errors.push({
            field: "dateAcquisition",
            message: "La date d'acquisition doit être une date ISO valide.",
          });
        }
      }

      if (errors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors });
      }

      const dto: CreateReproducteurDTO = {
        code: body.code.trim(),
        sexe: body.sexe as SexeReproducteur,
        poids: body.poids,
        age: body.age ?? undefined,
        origine: body.origine?.trim() || undefined,
        dateAcquisition: body.dateAcquisition || undefined,
        notes: body.notes?.trim() || undefined,
      };

      const reproducteur = await createReproducteur(auth.activeSiteId, dto);
      return NextResponse.json(reproducteur, { status: 201 });
    }
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/geniteurs",
      error,
      "Erreur serveur lors de la création du géniteur."
    );
  }
}
