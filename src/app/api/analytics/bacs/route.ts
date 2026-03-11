import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonBacs } from "@/lib/queries/analytics";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId");

    if (!vagueId) {
      return NextResponse.json(
        { status: 400, message: "Le parametre 'vagueId' est obligatoire." },
        { status: 400 }
      );
    }

    const comparaison = await getComparaisonBacs(auth.activeSiteId, vagueId);

    if (!comparaison) {
      return NextResponse.json(
        { status: 404, message: "Vague introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(comparaison);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul des analytiques." },
      { status: 500 }
    );
  }
}
