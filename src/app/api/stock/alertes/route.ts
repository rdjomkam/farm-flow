import { NextRequest, NextResponse } from "next/server";
import { getProduitsEnAlerte } from "@/lib/queries/produits";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des alertes stock.");
  }
}
