import { NextRequest, NextResponse } from "next/server";
import { getCalibrageById, patchCalibrage } from "@/lib/queries/calibrages";
import { requirePermission } from "@/lib/permissions";
import { Permission, CategorieCalibrage } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/** Champs structurels non modifiables via PATCH */
const NON_MODIFIABLE_FIELDS = ["id", "vagueId", "sourceBacIds", "siteId", "userId", "createdAt", "updatedAt"];

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.CALIBRAGES_VOIR);
    const { id } = await params;

    const calibrage = await getCalibrageById(id, auth.activeSiteId);
    if (!calibrage) {
      return apiError(404, "Calibrage introuvable.");
    }

    return NextResponse.json(calibrage);
  } catch (error) {
    return handleApiError("GET /api/calibrages/[id]", error, "Erreur serveur.");
  }
}

// ---------------------------------------------------------------------------
// PATCH — Modification de calibrage avec raison obligatoire et traçabilite (ADR-015)
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    // 1. Permission — CALIBRAGES_MODIFIER
    const auth = await requirePermission(request, Permission.CALIBRAGES_MODIFIER);

    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // 2. Validation de la raison (obligatoire, min 5, max 500)
    if (!body.raison || typeof body.raison !== "string") {
      errors.push({ field: "raison", message: "La raison de modification est obligatoire." });
    } else {
      const raisonTrimmed = body.raison.trim();
      if (raisonTrimmed.length < 5) {
        errors.push({ field: "raison", message: "La raison doit contenir au moins 5 caracteres." });
      } else if (raisonTrimmed.length > 500) {
        errors.push({ field: "raison", message: "La raison ne peut pas depasser 500 caracteres." });
      }
    }

    // 3. Rejeter les champs non modifiables
    for (const field of NON_MODIFIABLE_FIELDS) {
      if (body[field] !== undefined) {
        errors.push({ field, message: `Le champ '${field}' ne peut pas etre modifie.` });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // 4. Verification qu'au moins un champ metier est fourni
    const hasNombreMorts = body.nombreMorts !== undefined;
    const hasNotes = body.notes !== undefined;
    const hasGroupes = body.groupes !== undefined;
    const hasDate = body.date !== undefined;

    if (!hasNombreMorts && !hasNotes && !hasGroupes && !hasDate) {
      return NextResponse.json(
        { status: 400, message: "Au moins un champ metier doit etre fourni : nombreMorts, notes, date ou groupes." },
        { status: 400 }
      );
    }

    // 5. Validation des champs metier
    if (hasDate) {
      if (typeof body.date !== "string" || isNaN(Date.parse(body.date))) {
        errors.push({ field: "date", message: "La date doit etre une chaine ISO 8601 valide." });
      }
    }

    if (hasNombreMorts) {
      if (typeof body.nombreMorts !== "number" || !Number.isInteger(body.nombreMorts) || body.nombreMorts < 0) {
        errors.push({ field: "nombreMorts", message: "Le nombre de morts doit etre un entier positif ou nul." });
      }
    }

    if (hasGroupes) {
      if (!Array.isArray(body.groupes) || body.groupes.length === 0) {
        errors.push({ field: "groupes", message: "Les groupes doivent etre un tableau non vide." });
      } else {
        for (let i = 0; i < body.groupes.length; i++) {
          const g = body.groupes[i];
          if (!g.categorie || !Object.values(CategorieCalibrage).includes(g.categorie)) {
            errors.push({ field: `groupes[${i}].categorie`, message: `Categorie invalide. Valeurs : ${Object.values(CategorieCalibrage).join(", ")}.` });
          }
          if (!g.destinationBacId || typeof g.destinationBacId !== "string") {
            errors.push({ field: `groupes[${i}].destinationBacId`, message: "destinationBacId est requis." });
          }
          if (typeof g.nombrePoissons !== "number" || !Number.isInteger(g.nombrePoissons) || g.nombrePoissons <= 0) {
            errors.push({ field: `groupes[${i}].nombrePoissons`, message: "nombrePoissons doit etre un entier superieur a 0." });
          }
          if (typeof g.poidsMoyen !== "number" || g.poidsMoyen <= 0) {
            errors.push({ field: `groupes[${i}].poidsMoyen`, message: "poidsMoyen doit etre superieur a 0." });
          }
        }
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // 6. Appeler patchCalibrage
    const raison = body.raison.trim();
    const data = {
      ...(hasNombreMorts && { nombreMorts: body.nombreMorts }),
      ...(hasNotes && { notes: body.notes }),
      ...(hasDate && { date: body.date }),
      ...(hasGroupes && { groupes: body.groupes }),
    };

    const result = await patchCalibrage(auth.activeSiteId, auth.userId, id, data, raison);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError("PATCH /api/calibrages/[id]", error, "Erreur serveur lors de la modification du calibrage.", {
      statusMap: [
        { match: "cloturee", status: 409 },
        { match: ["Conservation non respectee", "bacs de destination", "Aucun champ"], status: 400 },
      ],
    });
  }
}
