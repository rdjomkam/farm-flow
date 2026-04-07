/**
 * src/app/api/portefeuille/route.ts
 *
 * GET /api/portefeuille — solde + commissions récentes + retraits en cours.
 *
 * - Auth + Permission.PORTEFEUILLE_VOIR
 * - Retourne le portefeuille de l'utilisateur connecté
 *
 * Story 34.2 — Sprint 34
 * R2 : enums importés depuis @/types
 * R8 : isolation par ingenieurId
 */
import { NextRequest, NextResponse } from "next/server";
import { getPortefeuille } from "@/lib/queries/commissions";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PORTEFEUILLE_VOIR);

    const data = await getPortefeuille(auth.userId);

    if (!data.portefeuille) {
      // Pas encore de portefeuille — retourner un portefeuille vide
      return NextResponse.json({
        portefeuille: {
          solde: 0,
          soldePending: 0,
          totalGagne: 0,
          totalPaye: 0,
          retraits: [],
        },
        commissionsRecentes: [],
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError("GET /api/portefeuille", error, "Erreur serveur lors de la recuperation du portefeuille.");
  }
}
