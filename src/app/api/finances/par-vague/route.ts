import { NextRequest, NextResponse } from "next/server";
import { getRentabiliteParVague } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);

    const rentabilite = await getRentabiliteParVague(auth.activeSiteId);

    return NextResponse.json(rentabilite);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/finances/par-vague]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul de la rentabilité par vague." },
      { status: 500 }
    );
  }
}
