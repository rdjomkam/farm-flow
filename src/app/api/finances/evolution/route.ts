import { NextRequest, NextResponse } from "next/server";
import { getEvolutionFinanciere } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/finances/evolution]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul de l'évolution financière." },
      { status: 500 }
    );
  }
}
