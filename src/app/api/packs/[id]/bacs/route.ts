import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getPackBacs, replacePackBacs } from "@/lib/queries/packs";
import { apiError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/packs/[id]/bacs
 * Liste les bacs configures d'un Pack.
 * Permission : DASHBOARD_VOIR
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await requirePermission(request, Permission.DASHBOARD_VOIR);

    const bacs = await getPackBacs(id);

    return NextResponse.json({ bacs, total: bacs.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des bacs.");
  }
}

/**
 * PUT /api/packs/[id]/bacs
 * Remplace tous les bacs d'un Pack (batch replace).
 * Invariant : sum(bacs.nombreAlevins) === pack.nombreAlevins
 * Permission : GERER_PACKS
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await requirePermission(request, Permission.GERER_PACKS);

    const body = await request.json();

    if (!Array.isArray(body.bacs)) {
      return apiError(400, "Le champ 'bacs' doit etre un tableau.");
    }

    if (body.bacs.length === 0) {
      return apiError(400, "Au moins un bac est requis.");
    }

    // Validation de chaque bac
    for (const bac of body.bacs) {
      if (!bac.nom || typeof bac.nom !== "string" || bac.nom.trim() === "") {
        return apiError(400, "Le nom du bac est requis.");
      }
      if (!bac.nombreAlevins || typeof bac.nombreAlevins !== "number" || bac.nombreAlevins <= 0) {
        return apiError(400, "Le nombre d'alevins doit etre superieur a 0.");
      }
    }

    // Vérifier noms uniques
    const noms = body.bacs.map((b: { nom: string }) => b.nom.trim().toLowerCase());
    if (new Set(noms).size !== noms.length) {
      return apiError(400, "Les noms de bacs doivent etre uniques.");
    }

    const bacs = await replacePackBacs(
      id,
      body.bacs.map((b: { nom: string; volume?: number | null; nombreAlevins: number; poidsMoyenInitial?: number }) => ({
        nom: b.nom,
        volume: b.volume ?? null,
        nombreAlevins: b.nombreAlevins,
        poidsMoyenInitial: b.poidsMoyenInitial ?? undefined,
      }))
    );

    return NextResponse.json({ bacs, total: bacs.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    if (error instanceof Error) {
      return apiError(400, error.message);
    }
    return apiError(500, "Erreur serveur lors de la mise a jour des bacs.");
  }
}
