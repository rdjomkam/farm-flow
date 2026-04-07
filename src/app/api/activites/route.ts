import { NextRequest, NextResponse } from "next/server";
import { getActivites, createActivite } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutActivite, TypeActivite, parsePaginationQuery } from "@/types";
import type { ActiviteFilters } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const TYPES_ACTIVITE_VALIDES = Object.values(TypeActivite) as string[];
const STATUTS_ACTIVITE_VALIDES = Object.values(StatutActivite) as string[];

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

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

    const { data, total } = await getActivites(auth.activeSiteId, filters, { limit, offset });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    return handleApiError("GET /api/activites", error, "Erreur serveur lors de la récupération des activités.");
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
      return apiError(400, "Erreurs de validation", { errors });
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
    return handleApiError("POST /api/activites", error, "Erreur serveur lors de la création de l'activité.", {
      statusMap: [
        { match: "introuvable", status: 409 },
      ],
    });
  }
}
