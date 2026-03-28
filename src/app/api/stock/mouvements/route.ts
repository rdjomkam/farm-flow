import { NextRequest, NextResponse } from "next/server";
import { getMouvements, createMouvement } from "@/lib/queries/mouvements";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeMouvement } from "@/types";
import type { CreateMouvementDTO, MouvementFilters } from "@/types";

const VALID_TYPES = Object.values(TypeMouvement);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: MouvementFilters = {};
    const produitId = searchParams.get("produitId");
    if (produitId) filters.produitId = produitId;
    const type = searchParams.get("type");
    if (type && VALID_TYPES.includes(type as TypeMouvement)) {
      filters.type = type as TypeMouvement;
    }
    const vagueId = searchParams.get("vagueId");
    if (vagueId) filters.vagueId = vagueId;
    const commandeId = searchParams.get("commandeId");
    if (commandeId) filters.commandeId = commandeId;
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const mouvements = await getMouvements(auth.activeSiteId, filters);

    return NextResponse.json({
      mouvements,
      total: mouvements.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des mouvements." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.produitId || typeof body.produitId !== "string") {
      errors.push({ field: "produitId", message: "Le produit est obligatoire." });
    }

    if (!body.type || !VALID_TYPES.includes(body.type)) {
      errors.push({
        field: "type",
        message: `Le type doit etre : ${VALID_TYPES.join(", ")}.`,
      });
    }

    if (body.quantite == null || typeof body.quantite !== "number" || body.quantite <= 0) {
      errors.push({ field: "quantite", message: "La quantite doit etre un nombre > 0." });
    }

    if (!body.date || typeof body.date !== "string" || isNaN(Date.parse(body.date))) {
      errors.push({ field: "date", message: "La date est obligatoire (format ISO 8601)." });
    }

    if (body.prixTotal !== undefined && (typeof body.prixTotal !== "number" || body.prixTotal < 0)) {
      errors.push({ field: "prixTotal", message: "Le prix total doit etre un nombre >= 0." });
    }

    // Validation datePeremption (optionnel, pertinent uniquement pour ENTREE)
    let datePeremption: Date | undefined;
    if (body.datePeremption !== undefined && body.datePeremption !== null) {
      const parsed = new Date(body.datePeremption);
      if (isNaN(parsed.getTime())) {
        errors.push({
          field: "datePeremption",
          message: "La date de peremption est invalide (format ISO 8601 attendu).",
        });
      } else {
        datePeremption = parsed;
      }
    }

    // Validation lotFabrication (optionnel, pertinent uniquement pour ENTREE)
    if (body.lotFabrication !== undefined && body.lotFabrication !== null) {
      if (typeof body.lotFabrication !== "string" || body.lotFabrication.trim() === "") {
        errors.push({
          field: "lotFabrication",
          message: "Le numero de lot de fabrication doit etre une chaine non vide.",
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateMouvementDTO = {
      produitId: body.produitId,
      type: body.type,
      quantite: body.quantite,
      date: body.date,
      prixTotal: body.prixTotal,
      vagueId: body.vagueId || undefined,
      commandeId: body.commandeId || undefined,
      notes: body.notes?.trim() || undefined,
      ...(datePeremption !== undefined && { datePeremption: datePeremption.toISOString() }),
      ...(body.lotFabrication !== undefined && body.lotFabrication !== null && { lotFabrication: body.lotFabrication.trim() }),
    };

    const mouvement = await createMouvement(auth.activeSiteId, auth.userId, data);
    return NextResponse.json(mouvement, { status: 201 });
  } catch (error) {
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
    if (message.includes("Stock insuffisant")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du mouvement." },
      { status: 500 }
    );
  }
}
