import { NextRequest, NextResponse } from "next/server";
import { addTraitement } from "@/lib/queries/incubations";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateTraitementIncubationDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.INCUBATIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // produit — required
    if (!body.produit || typeof body.produit !== "string" || !body.produit.trim()) {
      errors.push({
        field: "produit",
        message: "Le nom du produit est obligatoire.",
      });
    }

    // concentration — required
    if (
      !body.concentration ||
      typeof body.concentration !== "string" ||
      !body.concentration.trim()
    ) {
      errors.push({
        field: "concentration",
        message: "La concentration est obligatoire.",
      });
    }

    // dureeMinutes — required, entier positif
    if (
      body.dureeMinutes === undefined ||
      body.dureeMinutes === null ||
      typeof body.dureeMinutes !== "number" ||
      body.dureeMinutes <= 0 ||
      !Number.isInteger(body.dureeMinutes)
    ) {
      errors.push({
        field: "dureeMinutes",
        message: "La duree en minutes est obligatoire et doit etre un entier positif.",
      });
    }

    // heure — optionnel, doit etre une date valide si fourni
    if (
      body.heure !== undefined &&
      body.heure !== null &&
      (typeof body.heure !== "string" || isNaN(Date.parse(body.heure)))
    ) {
      errors.push({
        field: "heure",
        message: "L'heure du traitement doit etre au format ISO 8601.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreateTraitementIncubationDTO = {
      produit: body.produit.trim(),
      concentration: body.concentration.trim(),
      dureeMinutes: body.dureeMinutes,
      heure: body.heure ?? undefined,
      notes: body.notes?.trim() ?? undefined,
    };

    const traitement = await addTraitement(id, auth.activeSiteId, dto);

    return NextResponse.json(traitement, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/incubations/[id]/traitements",
      error,
      "Erreur serveur lors de l'ajout du traitement."
    );
  }
}
