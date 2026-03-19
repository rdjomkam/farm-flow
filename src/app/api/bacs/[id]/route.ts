import { NextRequest, NextResponse } from "next/server";
import { getBacById, updateBac } from "@/lib/queries/bacs";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateBacDTO } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { id } = await params;
    const bac = await getBacById(id, auth.activeSiteId);

    if (!bac) {
      return NextResponse.json(
        { status: 404, message: "Bac introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: bac.id,
      nom: bac.nom,
      volume: bac.volume,
      nombrePoissons: bac.nombrePoissons,
      nombreInitial: bac.nombreInitial,
      poidsMoyenInitial: bac.poidsMoyenInitial,
      vagueId: bac.vagueId,
      vagueCode: bac.vague?.code ?? null,
      siteId: bac.siteId,
      createdAt: bac.createdAt,
      updatedAt: bac.updatedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du bac." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (body.nom !== undefined) {
      if (typeof body.nom !== "string" || body.nom.trim() === "") {
        errors.push({ field: "nom", message: "Le nom ne peut pas etre vide." });
      }
    }

    if (body.volume !== undefined) {
      if (typeof body.volume !== "number" || body.volume <= 0) {
        errors.push({ field: "volume", message: "Le volume doit etre superieur a 0." });
      }
    }

    if (body.nombrePoissons !== undefined) {
      if (typeof body.nombrePoissons !== "number" || !Number.isInteger(body.nombrePoissons) || body.nombrePoissons < 0) {
        errors.push({ field: "nombrePoissons", message: "Le nombre de poissons doit etre un entier >= 0." });
      }
    }

    if (body.nombreInitial !== undefined) {
      if (typeof body.nombreInitial !== "number" || !Number.isInteger(body.nombreInitial) || body.nombreInitial < 0) {
        errors.push({ field: "nombreInitial", message: "Le nombre initial doit etre un entier >= 0." });
      }
    }

    if (body.poidsMoyenInitial !== undefined) {
      if (typeof body.poidsMoyenInitial !== "number" || body.poidsMoyenInitial <= 0) {
        errors.push({ field: "poidsMoyenInitial", message: "Le poids moyen initial doit etre superieur a 0." });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: UpdateBacDTO = {};
    if (body.nom !== undefined) data.nom = body.nom.trim();
    if (body.volume !== undefined) data.volume = body.volume;
    if (body.nombrePoissons !== undefined) data.nombrePoissons = body.nombrePoissons;
    if (body.nombreInitial !== undefined) data.nombreInitial = body.nombreInitial;
    if (body.poidsMoyenInitial !== undefined) data.poidsMoyenInitial = body.poidsMoyenInitial;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { status: 400, message: "Aucun champ a modifier." },
        { status: 400 }
      );
    }

    const bac = await updateBac(id, auth.activeSiteId, data);
    return NextResponse.json(bac);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise a jour du bac." },
      { status: 500 }
    );
  }
}
