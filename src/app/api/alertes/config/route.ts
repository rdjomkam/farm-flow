import { NextRequest, NextResponse } from "next/server";
import { getConfigAlertes, createConfigAlerte } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeAlerte } from "@/types";

const TYPES_ALERTE_VALIDES = Object.values(TypeAlerte) as string[];

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);
    const configs = await getConfigAlertes(auth.activeSiteId, auth.userId);

    return NextResponse.json({ configs, total: configs.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/alertes/config]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des configurations d'alerte." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_CONFIGURER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.typeAlerte || typeof body.typeAlerte !== "string") {
      errors.push({ field: "typeAlerte", message: "Le type d'alerte est obligatoire." });
    } else if (!TYPES_ALERTE_VALIDES.includes(body.typeAlerte)) {
      errors.push({
        field: "typeAlerte",
        message: `Type d'alerte invalide. Valeurs acceptées : ${TYPES_ALERTE_VALIDES.join(", ")}.`,
      });
    }

    if (body.seuilValeur !== undefined) {
      if (typeof body.seuilValeur !== "number" || body.seuilValeur < 0) {
        errors.push({ field: "seuilValeur", message: "Le seuil de valeur doit être un nombre >= 0." });
      }
    }

    if (body.seuilPourcentage !== undefined) {
      if (
        typeof body.seuilPourcentage !== "number" ||
        body.seuilPourcentage < 0 ||
        body.seuilPourcentage > 100
      ) {
        errors.push({
          field: "seuilPourcentage",
          message: "Le seuil en pourcentage doit être un nombre entre 0 et 100.",
        });
      }
    }

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      errors.push({ field: "enabled", message: "Le champ enabled doit être un booléen." });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const config = await createConfigAlerte(auth.activeSiteId, auth.userId, {
      typeAlerte: body.typeAlerte,
      seuilValeur: body.seuilValeur,
      seuilPourcentage: body.seuilPourcentage,
      enabled: body.enabled,
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[POST /api/alertes/config]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la création de la configuration d'alerte." },
      { status: 500 }
    );
  }
}
