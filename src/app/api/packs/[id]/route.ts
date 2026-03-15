import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getPackById, updatePack, deletePack } from "@/lib/queries/packs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/packs/[id]
 * Recupere les details d'un pack.
 * Permission : DASHBOARD_VOIR
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const pack = await getPackById(id, auth.activeSiteId);
    if (!pack) {
      return NextResponse.json({ status: 404, message: "Pack introuvable." }, { status: 404 });
    }

    return NextResponse.json(pack);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du pack." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/packs/[id]
 * Met a jour un Pack.
 * Permission : GERER_PACKS
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const body = await request.json();

    // Validation
    if (body.nombreAlevins !== undefined && (typeof body.nombreAlevins !== "number" || body.nombreAlevins <= 0)) {
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

    const updated = await updatePack(id, auth.activeSiteId, body);
    if (!updated) {
      return NextResponse.json({ status: 404, message: "Pack introuvable." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    if (error instanceof Error && (
      error.message.includes("desactiver") ||
      error.message.includes("alevins") ||
      error.message.includes("negatif")
    )) {
      return NextResponse.json({ status: 409, message: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise a jour du pack." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/packs/[id]
 * Supprime un Pack.
 * Permission : GERER_PACKS
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const deleted = await deletePack(id, auth.activeSiteId);
    if (!deleted) {
      return NextResponse.json({ status: 404, message: "Pack introuvable." }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes("supprimer")) {
      return NextResponse.json({ status: 409, message: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la suppression du pack." },
      { status: 500 }
    );
  }
}
