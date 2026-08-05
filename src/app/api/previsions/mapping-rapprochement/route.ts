import { NextRequest, NextResponse } from "next/server";
import {
  creerVersionMapping,
  getMappingActif,
  getMappingParVersion,
} from "@/lib/queries/previsions-rapprochement-mapping";
import {
  detecterCiblesOrphelines,
  type LigneMappingPourDetectionOrpheline,
} from "@/lib/queries/previsions-mapping-orphelins";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { creerVersionMappingSchema, mappingRapprochementQuerySchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * GET /api/previsions/mapping-rapprochement — lit le mapping de
 * rapprochement du site actif (ADR-053 §3.9, §15.3, amendement Sprint PR3,
 * story PR3.6 ; augmentation `cibleOrpheline` Sprint PR3-ter, story A.2).
 *
 * Sans query param : le mapping ACTIF courant (`getMappingActif`).
 * Avec `?version=N` : la version PRECISE N (`getMappingParVersion`) — c'est
 * cette forme qu'utilise toute lecture d'un rapprochement deja clos
 * (`ClotureMois.versionMapping`), qui ne doit JAMAIS relire le mapping
 * `actif` du moment (garantie d'immuabilite de l'historique, ADR-053 §15.3).
 *
 * Avec `?scenarioId=X` : chaque ligne renvoyee est augmentee de
 * `cibleOrpheline`/`cibleCleResolue` (`detecterCiblesOrphelines`, story A.1),
 * calcule contre CE scenario precis — filet de securite NON NEGOCIABLE
 * (docs/sprints/SPRINT-PR3-TER.md, story A.3) : un mapping dont la cible
 * n'existe pas dans le scenario COURANT doit se voir, jamais s'evaporer dans
 * un total silencieux. Sans `scenarioId`, le comportement reste EXACTEMENT
 * celui d'avant cette story (retro-compatible avec `MappingFormDialog`, qui
 * relit le mapping actif uniquement pour construire le payload du POST, sans
 * jamais afficher cet etat).
 *
 * Permission : PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { searchParams } = new URL(request.url);

    const parsedQuery = mappingRapprochementQuerySchema.safeParse({
      version: searchParams.get("version") ?? undefined,
      scenarioId: searchParams.get("scenarioId") ?? undefined,
    });
    if (!parsedQuery.success) {
      return apiError(400, "Erreurs de validation.", {
        errors: parsedQuery.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(racine)",
          message: issue.message,
        })),
      });
    }

    const { version, scenarioId } = parsedQuery.data;
    const data =
      version === undefined
        ? await getMappingActif(auth.activeSiteId)
        : await getMappingParVersion(auth.activeSiteId, version);

    const dataAugmentee = scenarioId
      ? detecterCiblesOrphelines(
          data as LigneMappingPourDetectionOrpheline[],
          await chargerScenarioPourMoteur(scenarioId, auth.activeSiteId)
        )
      : data;

    return NextResponse.json({ data: dataAugmentee, version: version ?? (data[0]?.version ?? null) });
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
