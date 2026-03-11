import { NextRequest, NextResponse } from "next/server";
import { getVentes, createVente } from "@/lib/queries/ventes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateVenteDTO, VenteFilters } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: VenteFilters = {};
    const clientId = searchParams.get("clientId");
    if (clientId) filters.clientId = clientId;
    const vagueId = searchParams.get("vagueId");
    if (vagueId) filters.vagueId = vagueId;
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const ventes = await getVentes(auth.activeSiteId, filters);

    return NextResponse.json({
      ventes,
      total: ventes.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des ventes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.clientId || typeof body.clientId !== "string") {
      errors.push({ field: "clientId", message: "Le client est obligatoire." });
    }

    if (!body.vagueId || typeof body.vagueId !== "string") {
      errors.push({ field: "vagueId", message: "La vague est obligatoire." });
    }

    if (typeof body.quantitePoissons !== "number" || body.quantitePoissons <= 0) {
      errors.push({ field: "quantitePoissons", message: "La quantite de poissons doit etre > 0." });
    }

    if (typeof body.poidsTotalKg !== "number" || body.poidsTotalKg <= 0) {
      errors.push({ field: "poidsTotalKg", message: "Le poids total doit etre > 0." });
    }

    if (typeof body.prixUnitaireKg !== "number" || body.prixUnitaireKg <= 0) {
      errors.push({ field: "prixUnitaireKg", message: "Le prix unitaire doit etre > 0." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateVenteDTO = {
      clientId: body.clientId,
      vagueId: body.vagueId,
      quantitePoissons: body.quantitePoissons,
      poidsTotalKg: body.poidsTotalKg,
      prixUnitaireKg: body.prixUnitaireKg,
      notes: body.notes?.trim() || undefined,
    };

    const vente = await createVente(auth.activeSiteId, auth.userId, data);
    return NextResponse.json(vente, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable") || message.includes("inactif")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("insuffisant") || message.includes("annulee")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation de la vente." },
      { status: 500 }
    );
  }
}
