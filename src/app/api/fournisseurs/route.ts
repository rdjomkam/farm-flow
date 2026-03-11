import { NextRequest, NextResponse } from "next/server";
import { getFournisseurs, createFournisseur } from "@/lib/queries/fournisseurs";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateFournisseurDTO } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_VOIR);
    const fournisseurs = await getFournisseurs(auth.activeSiteId);

    return NextResponse.json({
      fournisseurs,
      total: fournisseurs.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des fournisseurs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le nom est obligatoire." });
    }

    if (body.email && typeof body.email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        errors.push({ field: "email", message: "L'email n'est pas valide." });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateFournisseurDTO = {
      nom: body.nom.trim(),
      telephone: body.telephone?.trim() || undefined,
      email: body.email?.trim() || undefined,
      adresse: body.adresse?.trim() || undefined,
    };

    const fournisseur = await createFournisseur(auth.activeSiteId, data);
    return NextResponse.json(fournisseur, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du fournisseur." },
      { status: 500 }
    );
  }
}
