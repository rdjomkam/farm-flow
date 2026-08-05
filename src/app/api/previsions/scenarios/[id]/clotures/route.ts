import { NextRequest, NextResponse } from "next/server";
import { cloturerMois, getCloturesMois } from "@/lib/queries/previsions-cloture";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { cloturerMoisSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * GET /api/previsions/scenarios/[id]/clotures — liste les mois clotures
 * d'un scenario (ADR-053 §3.10, Sprint PR3 story PR3.6).
 *
 * Permission : PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const data = await getCloturesMois(id, auth.activeSiteId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/clotures",
      error,
      "Erreur serveur lors de la recuperation des clotures de mois."
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/clotures — cloture un mois d'un
 * scenario (ADR-053 §3.10/§15.3, Sprint PR3 story PR3.6). Fige
 * `versionMapping` (la version ACTIVE du mapping du site) dans LA MEME
 * transaction que la creation de `ClotureMois` (R4) — voir la JSDoc de
 * `cloturerMois` (`src/lib/queries/previsions-cloture.ts`) pour le detail
 * complet des regles metier appliquees (refus d'une double cloture, refus
 * hors horizon du plan) et la decision explicite de NE PAS exposer de
 * decloture.
 *
 * Permission : PREVISIONS_CLOTURER — distincte de PREVISIONS_GERER/
 * PREVISIONS_PARAMETRER, reservee a l'Administrateur (ADR-053 §6 tableau
 * des roles).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_CLOTURER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(cloturerMoisSchema, body);
    if (parsed.error) return parsed.error;

    const cloture = await cloturerMois(id, auth.activeSiteId, parsed.data.moisAbsolu, auth.userId);
    return NextResponse.json(cloture, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/clotures",
      error,
      "Erreur serveur lors de la cloture du mois."
    );
  }
}
