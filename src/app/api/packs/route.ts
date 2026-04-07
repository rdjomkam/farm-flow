import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getPacks, createPack } from "@/lib/queries/packs";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * GET /api/packs
 * Liste tous les packs du site actif.
 * Permission : DASHBOARD_VOIR (lecture pour tous les authentifies)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get("isActive");
    const configElevageId = searchParams.get("configElevageId");

    const filters = {
      ...(isActiveParam !== null && { isActive: isActiveParam === "true" }),
      ...(configElevageId && { configElevageId }),
    };

    const packs = await getPacks(auth.activeSiteId, filters);
    return NextResponse.json({ packs, total: packs.length });
  } catch (error) {
    return handleApiError("GET /api/packs", error, "Erreur serveur lors de la recuperation des packs.");
  }
}

/**
 * POST /api/packs
 * Cree un nouveau Pack.
 * Permission : GERER_PACKS (ADMIN uniquement)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const body = await request.json();

    // Validation business
    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      return apiError(400, "Le nom du pack est requis.");
    }
    if (!body.nombreAlevins || typeof body.nombreAlevins !== "number" || body.nombreAlevins <= 0) {
      return apiError(400, "Le nombre d'alevins doit etre superieur a 0.");
    }
    if (body.prixTotal !== undefined && (typeof body.prixTotal !== "number" || body.prixTotal < 0)) {
      return apiError(400, "Le prix total ne peut pas etre negatif.");
    }
    if (!body.planId || typeof body.planId !== "string" || body.planId.trim() === "") {
      return apiError(400, "L'identifiant du plan d'abonnement est requis.");
    }

    const pack = await createPack({
      nom: body.nom.trim(),
      description: body.description ?? null,
      nombreAlevins: body.nombreAlevins,
      poidsMoyenInitial: body.poidsMoyenInitial,
      prixTotal: body.prixTotal,
      configElevageId: body.configElevageId ?? null,
      isActive: body.isActive ?? true,
      planId: body.planId,
      userId: auth.userId,
      siteId: auth.activeSiteId,
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/packs", error, "Erreur serveur lors de la creation du pack.");
  }
}
