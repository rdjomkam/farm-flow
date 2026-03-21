/**
 * src/app/api/remises/route.ts
 *
 * GET  /api/remises  — liste des remises du site actif + globales (auth + REMISES_GERER)
 * POST /api/remises  — créer une remise (auth + REMISES_GERER)
 *
 * Story 35.1 — Sprint 35
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques via les fonctions query
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllRemises, createRemise, getRemiseByCode } from "@/lib/queries/remises";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission, TypeRemise } from "@/types";
import type { CreateRemiseDTO } from "@/types";

const VALID_TYPES = Object.values(TypeRemise);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.REMISES_GERER);
    const { searchParams } = new URL(request.url);

    // Les admins peuvent voir les remises d'un site spécifique
    let targetSiteId = auth.activeSiteId;
    const siteIdParam = searchParams.get("siteId");
    if (siteIdParam && auth.permissions.includes(Permission.ABONNEMENTS_GERER)) {
      targetSiteId = siteIdParam;
    }

    const remises = await getAllRemises(targetSiteId);
    return NextResponse.json({ remises, total: remises.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des remises." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.REMISES_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation du nom
    if (!body.nom || typeof body.nom !== "string" || body.nom.trim().length === 0) {
      errors.push({ field: "nom", message: "Le nom est obligatoire." });
    }

    // Validation du code : alphanumérique + tirets, trim + toUpperCase
    if (!body.code || typeof body.code !== "string") {
      errors.push({ field: "code", message: "Le code promo est obligatoire." });
    } else {
      const codeNormalized = body.code.trim().toUpperCase();
      if (!/^[A-Z0-9-]+$/.test(codeNormalized)) {
        errors.push({
          field: "code",
          message: "Le code promo ne peut contenir que des lettres, chiffres et tirets.",
        });
      }
    }

    // Validation du type
    if (!body.type || !VALID_TYPES.includes(body.type as TypeRemise)) {
      errors.push({
        field: "type",
        message: `Le type est obligatoire. Valeurs acceptées : ${VALID_TYPES.join(", ")}`,
      });
    }

    // Validation de la valeur
    if (body.valeur === undefined || typeof body.valeur !== "number" || body.valeur <= 0) {
      errors.push({ field: "valeur", message: "La valeur doit être un nombre positif." });
    }

    // Validation estPourcentage
    if (body.estPourcentage === undefined || typeof body.estPourcentage !== "boolean") {
      errors.push({ field: "estPourcentage", message: "estPourcentage est obligatoire (true/false)." });
    }

    // Validation dateDebut
    if (!body.dateDebut || typeof body.dateDebut !== "string") {
      errors.push({ field: "dateDebut", message: "La date de début est obligatoire." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    // Normaliser le code
    const codeNormalized = (body.code as string).trim().toUpperCase();

    // Vérifier l'unicité du code — retourner 409 si doublon
    const existing = await getRemiseByCode(codeNormalized);
    if (existing) {
      return NextResponse.json(
        { status: 409, message: `Le code promo "${codeNormalized}" existe déjà.` },
        { status: 409 }
      );
    }

    const data: CreateRemiseDTO = {
      nom: body.nom.trim(),
      code: codeNormalized,
      type: body.type as TypeRemise,
      valeur: body.valeur,
      estPourcentage: body.estPourcentage,
      dateDebut: body.dateDebut,
      dateFin: body.dateFin,
      limiteUtilisations: body.limiteUtilisations,
      planId: body.planId,
    };

    // siteId : si ABONNEMENTS_GERER et siteId fourni → utiliser ce siteId, sinon activeSiteId, sinon null (globale)
    let siteId: string | undefined;
    if (body.isGlobale === true && auth.permissions.includes(Permission.ABONNEMENTS_GERER)) {
      siteId = undefined; // globale
    } else {
      siteId = auth.activeSiteId;
    }

    const remise = await createRemise(auth.userId, data, siteId);
    return NextResponse.json({ remise }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors de la creation de la remise. ${message}` },
      { status: 500 }
    );
  }
}
