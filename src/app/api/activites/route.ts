import { NextRequest, NextResponse } from "next/server";
import { getActivites, createActivite } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutActivite, TypeActivite } from "@/types";
import type { ActiviteFilters } from "@/types";

const TYPES_ACTIVITE_VALIDES = Object.values(TypeActivite) as string[];
const STATUTS_ACTIVITE_VALIDES = Object.values(StatutActivite) as string[];

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { searchParams } = new URL(request.url);

    const rawStatut = searchParams.get("statut");
    const rawTypeActivite = searchParams.get("typeActivite");

    const filters: ActiviteFilters = {
      dateDebut: searchParams.get("dateDebut") ?? undefined,
      dateFin: searchParams.get("dateFin") ?? undefined,
      statut: rawStatut && STATUTS_ACTIVITE_VALIDES.includes(rawStatut)
        ? (rawStatut as StatutActivite)
        : undefined,
      typeActivite: rawTypeActivite && TYPES_ACTIVITE_VALIDES.includes(rawTypeActivite)
        ? (rawTypeActivite as TypeActivite)
        : undefined,
      vagueId: searchParams.get("vagueId") ?? undefined,
      assigneAId: searchParams.get("assigneAId") ?? undefined,
    };

    const activites = await getActivites(auth.activeSiteId, filters);

    return NextResponse.json({ activites, total: activites.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/activites]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des activités." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.titre || typeof body.titre !== "string" || body.titre.trim() === "") {
      errors.push({ field: "titre", message: "Le titre est obligatoire." });
    }

    if (!body.typeActivite || typeof body.typeActivite !== "string") {
      errors.push({ field: "typeActivite", message: "Le type d'activité est obligatoire." });
    } else if (!TYPES_ACTIVITE_VALIDES.includes(body.typeActivite)) {
      errors.push({
        field: "typeActivite",
        message: `Type d'activité invalide. Valeurs acceptées : ${TYPES_ACTIVITE_VALIDES.join(", ")}.`,
      });
    }

    if (!body.dateDebut || typeof body.dateDebut !== "string") {
      errors.push({ field: "dateDebut", message: "La date de début est obligatoire (format ISO)." });
    } else {
      const parsed = Date.parse(body.dateDebut);
      if (isNaN(parsed)) {
        errors.push({ field: "dateDebut", message: "La date de début n'est pas une date ISO valide." });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const activite = await createActivite(auth.activeSiteId, auth.userId, {
      titre: body.titre.trim(),
      description: body.description?.trim() || undefined,
      typeActivite: body.typeActivite,
      dateDebut: body.dateDebut,
      dateFin: body.dateFin || undefined,
      recurrence: body.recurrence || undefined,
      vagueId: body.vagueId || undefined,
      bacId: body.bacId || undefined,
      assigneAId: body.assigneAId || undefined,
    });

    return NextResponse.json(activite, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    console.error("[POST /api/activites]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la création de l'activité." },
      { status: 500 }
    );
  }
}
