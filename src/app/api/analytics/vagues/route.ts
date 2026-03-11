import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonVagues } from "@/lib/queries/analytics";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const vagueIdsParam = searchParams.get("vagueIds");

    if (!vagueIdsParam) {
      return NextResponse.json(
        { status: 400, message: "Le parametre 'vagueIds' est obligatoire (IDs separes par des virgules)." },
        { status: 400 }
      );
    }

    const vagueIds = vagueIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (vagueIds.length < 2) {
      return NextResponse.json(
        { status: 400, message: "Au moins 2 vagues sont requises pour la comparaison." },
        { status: 400 }
      );
    }

    if (vagueIds.length > 4) {
      return NextResponse.json(
        { status: 400, message: "La comparaison est limitee a 4 vagues maximum." },
        { status: 400 }
      );
    }

    const comparaison = await getComparaisonVagues(auth.activeSiteId, vagueIds);

    return NextResponse.json(comparaison);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la comparaison des vagues." },
      { status: 500 }
    );
  }
}
