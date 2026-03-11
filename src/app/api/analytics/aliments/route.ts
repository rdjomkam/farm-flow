import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonAliments } from "@/lib/queries/analytics";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { searchParams } = new URL(request.url);
    const fournisseurId = searchParams.get("fournisseurId") ?? undefined;

    const comparaison = await getComparaisonAliments(auth.activeSiteId, {
      fournisseurId,
    });

    return NextResponse.json(comparaison);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul des analytiques aliments." },
      { status: 500 }
    );
  }
}
