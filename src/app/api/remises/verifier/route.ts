/**
 * src/app/api/remises/verifier/route.ts
 *
 * GET /api/remises/verifier?code=XXX — vérifier la validité d'un code promo
 *
 * Story 33.2 — Sprint 33
 * R2 : enums importés depuis @/types
 * Accessible avec auth (ABONNEMENTS_VOIR) — pour le checkout uniquement
 */
import { NextRequest, NextResponse } from "next/server";
import { verifierRemiseApplicable } from "@/lib/queries/remises";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code || typeof code !== "string" || code.trim() === "") {
      return NextResponse.json(
        { status: 400, message: "Le paramètre 'code' est obligatoire." },
        { status: 400 }
      );
    }

    const result = await verifierRemiseApplicable(code.trim().toUpperCase(), auth.activeSiteId);

    if (!result.remise) {
      return NextResponse.json(
        { valide: false, message: result.erreur ?? "Code promo invalide." },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valide: true,
      remise: {
        id: result.remise.id,
        nom: result.remise.nom,
        code: result.remise.code,
        valeur: Number(result.remise.valeur),
        estPourcentage: result.remise.estPourcentage,
        type: result.remise.type,
      },
    });
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
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}
