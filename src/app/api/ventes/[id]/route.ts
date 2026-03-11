import { NextRequest, NextResponse } from "next/server";
import { getVenteById } from "@/lib/queries/ventes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { id } = await params;

    const vente = await getVenteById(id, auth.activeSiteId);
    if (!vente) {
      return NextResponse.json(
        { status: 404, message: "Vente introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(vente);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}
