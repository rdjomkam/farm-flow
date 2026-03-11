import { NextRequest, NextResponse } from "next/server";
import { getProduitsEnAlerte } from "@/lib/queries/produits";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const produits = await getProduitsEnAlerte(auth.activeSiteId);

    return NextResponse.json({
      produits,
      total: produits.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des alertes stock." },
      { status: 500 }
    );
  }
}
