import { NextRequest, NextResponse } from "next/server";
import { getEvolutionFinanciere } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

const MOIS_MIN = 1;
const MOIS_MAX = 36;
const MOIS_DEFAUT = 12;

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { searchParams } = new URL(request.url);

    const moisParam = searchParams.get("mois");
    let moisCount = MOIS_DEFAUT;

    if (moisParam !== null) {
      const parsed = parseInt(moisParam, 10);
      if (isNaN(parsed) || parsed < MOIS_MIN || parsed > MOIS_MAX) {
        return NextResponse.json(
          {
            status: 400,
            message: `Le paramètre mois doit être un entier entre ${MOIS_MIN} et ${MOIS_MAX}.`,
          },
          { status: 400 }
        );
      }
      moisCount = parsed;
    }

    const evolution = await getEvolutionFinanciere(auth.activeSiteId, moisCount);

    return NextResponse.json(evolution);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/finances/evolution]", error);
    return apiError(500, "Erreur serveur lors du calcul de l'évolution financière.");
  }
}
