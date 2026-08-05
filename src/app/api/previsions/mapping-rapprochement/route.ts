import { NextRequest, NextResponse } from "next/server";
import {
  creerVersionMapping,
  getMappingActif,
  getMappingParVersion,
} from "@/lib/queries/previsions-rapprochement-mapping";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { creerVersionMappingSchema, mappingRapprochementQuerySchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * GET /api/previsions/mapping-rapprochement — lit le mapping de
 * rapprochement du site actif (ADR-053 §3.9, §15.3, amendement Sprint PR3,
 * story PR3.6).
 *
 * Sans query param : le mapping ACTIF courant (`getMappingActif`).
 * Avec `?version=N` : la version PRECISE N (`getMappingParVersion`) — c'est
 * cette forme qu'utilise toute lecture d'un rapprochement deja clos
 * (`ClotureMois.versionMapping`), qui ne doit JAMAIS relire le mapping
 * `actif` du moment (garantie d'immuabilite de l'historique, ADR-053 §15.3).
 *
 * Permission : PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { searchParams } = new URL(request.url);

    const parsedQuery = mappingRapprochementQuerySchema.safeParse({
      version: searchParams.get("version") ?? undefined,
    });
    if (!parsedQuery.success) {
      return apiError(400, "Erreurs de validation.", {
        errors: parsedQuery.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(racine)",
          message: issue.message,
        })),
      });
    }

    const { version } = parsedQuery.data;
    const data =
      version === undefined
        ? await getMappingActif(auth.activeSiteId)
        : await getMappingParVersion(auth.activeSiteId, version);

    return NextResponse.json({ data, version: version ?? (data[0]?.version ?? null) });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/mapping-rapprochement",
      error,
      "Erreur serveur lors de la recuperation du mapping de rapprochement."
    );
  }
}

/**
 * POST /api/previsions/mapping-rapprochement — cree une NOUVELLE VERSION du
 * mapping du site (remplacement en bloc), JAMAIS un UPDATE en place d'une
 * ligne active (ADR-053 §3.9 : garantie d'auditabilite — un rapprochement
 * deja affiche pour un mois passe reste explicable meme si le mapping
 * evolue ensuite).
 *
 * Permission : PREVISIONS_PARAMETRER (parametrage du mapping, distinct de
 * PREVISIONS_GERER — reserve a l'Administrateur, ADR-053 §6 tableau des roles).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const body = await request.json();

    const parsed = parseBody(creerVersionMappingSchema, body);
    if (parsed.error) return parsed.error;

    const lignes = await creerVersionMapping(auth.activeSiteId, parsed.data.lignes);
    return NextResponse.json({ data: lignes }, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/mapping-rapprochement",
      error,
      "Erreur serveur lors de la creation d'une nouvelle version du mapping de rapprochement."
    );
  }
}
