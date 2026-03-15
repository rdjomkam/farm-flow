import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getClientsIngenieur } from "@/lib/queries/ingenieur";

/**
 * GET /api/ingenieur/clients
 *
 * Retourne la liste paginee des clients actives par l'ingenieur.
 * Tri par urgence : clients avec alertes ou survie insuffisante en premier.
 *
 * Query params :
 * - page  : numero de page (defaut : 1)
 * - limit : nombre d'elements par page (defaut : 10, max : 100)
 *
 * Permission requise : MONITORING_CLIENTS
 * Role : INGENIEUR (lecture seule)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.MONITORING_CLIENTS);

    const { searchParams } = new URL(request.url);

    // Validation et parsing des query params de pagination
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { status: 400, message: "Le parametre 'page' doit etre un entier >= 1." },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { status: 400, message: "Le parametre 'limit' doit etre un entier entre 1 et 100." },
        { status: 400 }
      );
    }

    const result = await getClientsIngenieur(auth.activeSiteId, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du chargement de la liste clients." },
      { status: 500 }
    );
  }
}
