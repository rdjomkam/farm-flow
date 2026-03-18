import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getPacks, createPack } from "@/lib/queries/packs";

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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des packs." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { status: 400, message: "Le nom du pack est requis." },
        { status: 400 }
      );
    }
    if (!body.nombreAlevins || typeof body.nombreAlevins !== "number" || body.nombreAlevins <= 0) {
      return NextResponse.json(
        { status: 400, message: "Le nombre d'alevins doit etre superieur a 0." },
        { status: 400 }
      );
    }
    if (body.prixTotal !== undefined && (typeof body.prixTotal !== "number" || body.prixTotal < 0)) {
      return NextResponse.json(
        { status: 400, message: "Le prix total ne peut pas etre negatif." },
        { status: 400 }
      );
    }

    const pack = await createPack({
      nom: body.nom.trim(),
      description: body.description ?? null,
      nombreAlevins: body.nombreAlevins,
      poidsMoyenInitial: body.poidsMoyenInitial,
      prixTotal: body.prixTotal,
      configElevageId: body.configElevageId ?? null,
      isActive: body.isActive ?? true,
      enabledModules: body.enabledModules ?? [],
      userId: auth.userId,
      siteId: auth.activeSiteId,
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ status: 400, message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du pack." },
      { status: 500 }
    );
  }
}
