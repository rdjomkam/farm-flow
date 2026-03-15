import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  getConfigElevageDefaut,
  CONFIG_ELEVAGE_DEFAULTS,
} from "@/lib/queries/config-elevage";

/**
 * GET /api/config-elevage/defaut
 * Retourne le profil par defaut du site actif.
 * Si aucun profil isDefault=true n'existe, retourne les valeurs hardcodees (fallback EC-5.1).
 * Permission : DASHBOARD_VOIR (tous les utilisateurs)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const config = await getConfigElevageDefaut(auth.activeSiteId);

    if (config) {
      return NextResponse.json({ config, isFallback: false });
    }

    // Fallback : retourne les valeurs par defaut hardcodees (EC-5.1)
    return NextResponse.json({
      config: CONFIG_ELEVAGE_DEFAULTS,
      isFallback: true,
      message: "Aucun profil par defaut configure. Utilisation des valeurs FAO standard.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du profil par defaut." },
      { status: 500 }
    );
  }
}
