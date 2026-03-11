import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getIndicateursBac } from "@/lib/queries/analytics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bacId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { bacId } = await params;
    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId");

    if (!vagueId) {
      return NextResponse.json(
        { status: 400, message: "Le parametre 'vagueId' est obligatoire." },
        { status: 400 }
      );
    }

    const indicateurs = await getIndicateursBac(auth.activeSiteId, vagueId, bacId);

    if (!indicateurs) {
      return NextResponse.json(
        { status: 404, message: "Bac ou vague introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(indicateurs);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul des indicateurs du bac." },
      { status: 500 }
    );
  }
}
