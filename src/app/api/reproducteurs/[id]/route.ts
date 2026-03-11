import { NextRequest, NextResponse } from "next/server";
import {
  getReproducteurById,
  updateReproducteur,
  deleteReproducteur,
} from "@/lib/queries/reproducteurs";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, SexeReproducteur, StatutReproducteur } from "@/types";
import type { UpdateReproducteurDTO } from "@/lib/queries/reproducteurs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { id } = await params;

    const reproducteur = await getReproducteurById(id, auth.activeSiteId);
    if (!reproducteur) {
      return NextResponse.json(
        { status: 404, message: "Reproducteur introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(reproducteur);
  } catch (error) {
    console.error("[GET /api/reproducteurs/[id]]", error);
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

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : code optionnel
    if (body.code !== undefined) {
      if (typeof body.code !== "string" || body.code.trim() === "") {
        errors.push({ field: "code", message: "Le code ne peut pas etre vide." });
      }
    }

    // Validation : sexe optionnel
    if (
      body.sexe !== undefined &&
      !Object.values(SexeReproducteur).includes(body.sexe as SexeReproducteur)
    ) {
      errors.push({
        field: "sexe",
        message: `Sexe invalide. Valeurs acceptees : ${Object.values(SexeReproducteur).join(", ")}.`,
      });
    }

    // Validation : poids optionnel > 0
    if (body.poids !== undefined) {
      if (typeof body.poids !== "number" || body.poids <= 0) {
        errors.push({ field: "poids", message: "Le poids doit etre un nombre superieur a 0." });
      }
    }

    // Validation : age optionnel >= 0
    if (body.age !== undefined && body.age !== null) {
      if (!Number.isInteger(body.age) || body.age < 0) {
        errors.push({ field: "age", message: "L'age doit etre un entier positif ou nul." });
      }
    }

    // Validation : statut optionnel
    if (
      body.statut !== undefined &&
      !Object.values(StatutReproducteur).includes(body.statut as StatutReproducteur)
    ) {
      errors.push({
        field: "statut",
        message: `Statut invalide. Valeurs acceptees : ${Object.values(StatutReproducteur).join(", ")}.`,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: UpdateReproducteurDTO = {};
    if (body.code !== undefined) data.code = body.code.trim();
    if (body.poids !== undefined) data.poids = body.poids;
    if (body.age !== undefined) data.age = body.age;
    if (body.origine !== undefined) data.origine = body.origine?.trim() || undefined;
    if (body.statut !== undefined) data.statut = body.statut as StatutReproducteur;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || undefined;

    const reproducteur = await updateReproducteur(id, auth.activeSiteId, data);
    return NextResponse.json(reproducteur);
  } catch (error) {
    console.error("[PUT /api/reproducteurs/[id]]", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable") || message.includes("n'existe pas")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    // Conflit : code deja utilise ou statut invalide
    if (
      message.includes("deja utilise") ||
      message.includes("déjà utilisé") ||
      message.includes("n'est pas ACTIF") ||
      message.includes("statut doit etre")
    ) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_SUPPRIMER);
    const { id } = await params;

    await deleteReproducteur(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/reproducteurs/[id]]", error);
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
    // pontes liées → 409
    if (message.includes("ponte")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
