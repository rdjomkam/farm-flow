import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getHistoriqueBac } from "@/lib/queries/analytics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bacId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { bacId } = await params;

    const historique = await getHistoriqueBac(auth.activeSiteId, bacId);

    if (!historique) {
      return NextResponse.json(
        { status: 404, message: "Bac introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(historique);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul de l'historique du bac." },
      { status: 500 }
    );
  }
}
