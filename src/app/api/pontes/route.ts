import { NextRequest, NextResponse } from "next/server";
import { getPontes, createPonte } from "@/lib/queries/pontes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutPonte } from "@/types";
import type { CreatePonteDTO } from "@/lib/queries/pontes";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { searchParams } = new URL(request.url);

    const statutParam = searchParams.get("statut");
    const femelleId = searchParams.get("femelleId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const statut =
      statutParam &&
      Object.values(StatutPonte).includes(statutParam as StatutPonte)
        ? (statutParam as StatutPonte)
        : undefined;

    const pontes = await getPontes(auth.activeSiteId, {
      statut,
      femelleId,
      search,
    });

    return NextResponse.json({
      pontes,
      total: pontes.length,
    });
  } catch (error) {
    console.error("[GET /api/pontes]", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des pontes.");
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

    // Validation : femelleId obligatoire
    if (!body.femelleId || typeof body.femelleId !== "string" || body.femelleId.trim() === "") {
      errors.push({ field: "femelleId", message: "L'identifiant de la femelle est obligatoire." });
    }

    // Validation : datePonte obligatoire (ISO date)
    if (!body.datePonte) {
      errors.push({ field: "datePonte", message: "La date de ponte est obligatoire." });
    } else {
      const d = new Date(body.datePonte);
      if (isNaN(d.getTime())) {
        errors.push({
          field: "datePonte",
          message: "La date de ponte doit etre une date ISO valide.",
        });
      }
    }

    // Validation : nombreOeufs optionnel > 0
    if (body.nombreOeufs !== undefined && body.nombreOeufs !== null) {
      if (!Number.isInteger(body.nombreOeufs) || body.nombreOeufs <= 0) {
        errors.push({
          field: "nombreOeufs",
          message: "Le nombre d'oeufs doit etre un entier superieur a 0.",
        });
      }
    }

    // Validation : tauxFecondation optionnel 0-100
    if (body.tauxFecondation !== undefined && body.tauxFecondation !== null) {
      if (
        typeof body.tauxFecondation !== "number" ||
        body.tauxFecondation < 0 ||
        body.tauxFecondation > 100
      ) {
        errors.push({
          field: "tauxFecondation",
          message: "Le taux de fecondation doit etre un nombre entre 0 et 100.",
        });
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreatePonteDTO = {
      code: body.code.trim(),
      femelleId: body.femelleId.trim(),
      maleId: body.maleId?.trim() || undefined,
      datePonte: body.datePonte,
      nombreOeufs: body.nombreOeufs ?? undefined,
      tauxFecondation: body.tauxFecondation ?? undefined,
      notes: body.notes?.trim() || undefined,
    };

    const ponte = await createPonte(auth.activeSiteId, data);
    return NextResponse.json(ponte, { status: 201 });
  } catch (error) {
    console.error("[POST /api/pontes]", error);
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
    // Ressource introuvable (ex: femelle/male introuvable)
    if (message.includes("n'existe pas") || message.includes("introuvable")) {
      return apiError(404, message);
    }
    // Conflit metier : reproducteur non actif
    if (message.includes("n'est pas ACTIF") || message.includes("statut doit etre")) {
      return apiError(409, message);
    }
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors de la creation de la ponte : ${message}` },
      { status: 500 }
    );
  }
}
