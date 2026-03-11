import { NextRequest, NextResponse } from "next/server";
import { getActiviteById, updateActivite, deleteActivite } from "@/lib/queries";
import type { UpdateActiviteDTO } from "@/types";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutActivite } from "@/types";

type Params = { params: Promise<{ id: string }> };

const STATUTS_VALIDES = Object.values(StatutActivite) as string[];

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { id } = await params;

    const activite = await getActiviteById(auth.activeSiteId, id);
    if (!activite) {
      return NextResponse.json(
        { status: 404, message: "Activité introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(activite);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/activites/[id]]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération de l'activité." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_GERER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (body.titre !== undefined) {
      if (typeof body.titre !== "string" || body.titre.trim() === "") {
        errors.push({ field: "titre", message: "Le titre ne peut pas être vide." });
      }
    }

    if (body.statut !== undefined) {
      if (body.statut === StatutActivite.TERMINEE) {
        return NextResponse.json(
          { status: 400, message: "Utilisez POST /api/activites/[id]/complete pour completer une activite." },
          { status: 400 }
        );
      }
      if (!STATUTS_VALIDES.includes(body.statut)) {
        errors.push({
          field: "statut",
          message: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}.`,
        });
      }
    }

    if (body.dateDebut !== undefined) {
      const parsed = Date.parse(body.dateDebut);
      if (isNaN(parsed)) {
        errors.push({ field: "dateDebut", message: "La date de début n'est pas une date ISO valide." });
      }
    }

    if (body.dateFin !== undefined && body.dateFin !== null) {
      const parsed = Date.parse(body.dateFin);
      if (isNaN(parsed)) {
        errors.push({ field: "dateFin", message: "La date de fin n'est pas une date ISO valide." });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: UpdateActiviteDTO = {};
    if (body.titre !== undefined) data.titre = body.titre.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || undefined;
    if (body.statut !== undefined) data.statut = body.statut;
    if (body.dateDebut !== undefined) data.dateDebut = body.dateDebut;
    if (body.dateFin !== undefined) data.dateFin = body.dateFin;
    if (body.recurrence !== undefined) data.recurrence = body.recurrence;
    if (body.vagueId !== undefined) data.vagueId = body.vagueId;
    if (body.bacId !== undefined) data.bacId = body.bacId;
    if (body.assigneAId !== undefined) data.assigneAId = body.assigneAId;

    const activite = await updateActivite(auth.activeSiteId, id, data);

    return NextResponse.json(activite);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    console.error("[PUT /api/activites/[id]]", error);
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_GERER);
    const { id } = await params;

    await deleteActivite(auth.activeSiteId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    console.error("[DELETE /api/activites/[id]]", error);
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
