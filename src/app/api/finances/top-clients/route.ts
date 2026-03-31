import { NextRequest, NextResponse } from "next/server";
import { getTopClients } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

const LIMIT_MIN = 1;
const LIMIT_MAX = 50;
const LIMIT_DEFAUT = 5;

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { searchParams } = new URL(request.url);

    const limitParam = searchParams.get("limit");
    let limit = LIMIT_DEFAUT;

    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < LIMIT_MIN || parsed > LIMIT_MAX) {
        return NextResponse.json(
          {
            status: 400,
            message: `Le paramètre limit doit être un entier entre ${LIMIT_MIN} et ${LIMIT_MAX}.`,
          },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    const topClients = await getTopClients(auth.activeSiteId, limit);

    return NextResponse.json(topClients);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/finances/top-clients]", error);
    return apiError(500, "Erreur serveur lors du calcul du top clients.");
  }
}
