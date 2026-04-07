import { NextRequest, NextResponse } from "next/server";
import { getProduitsEnAlerte } from "@/lib/queries/produits";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const produits = await getProduitsEnAlerte(auth.activeSiteId);

    return NextResponse.json({
      produits,
      total: produits.length,
    });
  } catch (error) {
    return handleApiError("GET /api/stock/alertes", error, "Erreur serveur lors de la recuperation des alertes stock.");
  }
}
