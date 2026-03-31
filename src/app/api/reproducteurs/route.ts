import { NextRequest, NextResponse } from "next/server";
import {
  getReproducteurs,
  createReproducteur,
} from "@/lib/queries/reproducteurs";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, SexeReproducteur, StatutReproducteur } from "@/types";
import type { CreateReproducteurDTO } from "@/lib/queries/reproducteurs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { searchParams } = new URL(request.url);

    const sexeParam = searchParams.get("sexe");
    const statutParam = searchParams.get("statut");
    const search = searchParams.get("search") ?? undefined;

    const sexe =
      sexeParam && Object.values(SexeReproducteur).includes(sexeParam as SexeReproducteur)
        ? (sexeParam as SexeReproducteur)
        : undefined;

    const statut =
      statutParam &&
      Object.values(StatutReproducteur).includes(statutParam as StatutReproducteur)
        ? (statutParam as StatutReproducteur)
        : undefined;

    const reproducteurs = await getReproducteurs(auth.activeSiteId, {
      sexe,
      statut,
      search,
    });

    return NextResponse.json({
      reproducteurs,
      total: reproducteurs.length,
    });
  } catch (error) {
    console.error("[GET /api/reproducteurs]", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des reproducteurs.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : code obligatoire
    if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
      errors.push({ field: "code", message: "Le code est obligatoire." });
    }

    // Validation : sexe obligatoire et valide
    if (
      !body.sexe ||
      !Object.values(SexeReproducteur).includes(body.sexe as SexeReproducteur)
    ) {
      errors.push({
        field: "sexe",
        message: `Le sexe est obligatoire. Valeurs acceptees : ${Object.values(SexeReproducteur).join(", ")}.`,
      });
    }

    // Validation : poids obligatoire et > 0
    if (body.poids === undefined || body.poids === null) {
      errors.push({ field: "poids", message: "Le poids est obligatoire." });
    } else if (typeof body.poids !== "number" || body.poids <= 0) {
      errors.push({ field: "poids", message: "Le poids doit etre un nombre superieur a 0." });
    }

    // Validation : age optionnel >= 0
    if (body.age !== undefined && body.age !== null) {
      if (!Number.isInteger(body.age) || body.age < 0) {
        errors.push({ field: "age", message: "L'age doit etre un entier positif ou nul." });
      }
    }

    // Validation : dateAcquisition optionnel (ISO date)
    if (body.dateAcquisition !== undefined) {
      const d = new Date(body.dateAcquisition);
      if (isNaN(d.getTime())) {
        errors.push({
          field: "dateAcquisition",
          message: "La date d'acquisition doit etre une date ISO valide.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateReproducteurDTO = {
      code: body.code.trim(),
      sexe: body.sexe as SexeReproducteur,
      poids: body.poids,
      age: body.age ?? undefined,
      origine: body.origine?.trim() || undefined,
      dateAcquisition: body.dateAcquisition || undefined,
      notes: body.notes?.trim() || undefined,
    };

    const reproducteur = await createReproducteur(auth.activeSiteId, data);
    return NextResponse.json(reproducteur, { status: 201 });
  } catch (error) {
    console.error("[POST /api/reproducteurs]", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    // Conflit : code deja utilise
    if (message.includes("deja utilise") || message.includes("déjà utilisé")) {
      return apiError(409, message);
    }
    // Ressource introuvable (ex: femelle/male referencies)
    if (message.includes("n'existe pas") || message.includes("introuvable")) {
      return apiError(404, message);
    }
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors de la creation du reproducteur : ${message}` },
      { status: 500 }
    );
  }
}
