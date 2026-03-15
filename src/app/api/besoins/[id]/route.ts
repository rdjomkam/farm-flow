import { NextRequest, NextResponse } from "next/server";
import {
  getListeBesoinsById,
  updateListeBesoins,
  deleteListeBesoins,
} from "@/lib/queries/besoins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

/**
 * GET /api/besoins/[id]
 * Recupere une liste de besoins avec toutes ses relations.
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { id } = await params;
    const listeBesoins = await getListeBesoinsById(id, auth.activeSiteId);
    if (!listeBesoins) {
      return NextResponse.json(
        { status: 404, message: "Liste de besoins introuvable." },
        { status: 404 }
      );
    }
    return NextResponse.json(listeBesoins);
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
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/besoins/[id]
 * Modifie une liste de besoins (seulement si statut SOUMISE).
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { id } = await params;
    const body = await request.json();

    const listeBesoins = await updateListeBesoins(id, auth.activeSiteId, {
      titre: body.titre,
      vagueId: body.vagueId,
      notes: body.notes,
      lignes: body.lignes,
    });

    return NextResponse.json(listeBesoins);
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
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (
      message.includes("invalide") ||
      message.includes("Impossible") ||
      message.includes("SOUMISE")
    ) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/besoins/[id]
 * Supprime une liste de besoins (seulement si statut SOUMISE).
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { id } = await params;
    await deleteListeBesoins(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
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
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Impossible") || message.includes("SOUMISE")) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur." },
      { status: 500 }
    );
  }
}
