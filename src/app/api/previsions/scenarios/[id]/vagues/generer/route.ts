import { NextRequest, NextResponse } from "next/server";
import { apercuGenerationPlan, genererPlanVaguesPrevues } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import {
  apercuGenerationPlanQuerySchema,
  genererPlanVaguesPrevuesSchema,
} from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * GET /api/previsions/scenarios/[id]/vagues/generer — apercu (dry-run,
 * AUCUNE ecriture) du plan qui serait genere par le POST ci-dessous, pour le
 * meme horizon/mode. PREVISIONS_VOIR suffit : c'est une lecture pure,
 * exactement comme `GET .../calculer` (route-orchestration).
 *
 * Story PR2bis.2 (ADR-053 section 4, `genererPlanEmpoissonnement`) : cable
 * enfin le moteur de plan, jusqu'ici teste unitairement mais jamais appele
 * depuis une route. L'UI affiche ce decompte AVANT toute confirmation
 * (arbitrage PM, pas une case a cocher silencieuse).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const parsed = apercuGenerationPlanQuerySchema.safeParse({
      horizonMois: searchParams.get("horizonMois"),
      mode: searchParams.get("mode") ?? undefined,
    });
    if (!parsed.success) {
      return apiError(400, "Erreurs de validation.", {
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(racine)",
          message: issue.message,
        })),
      });
    }

    const apercu = await apercuGenerationPlan(
      id,
      auth.activeSiteId,
      parsed.data.horizonMois,
      parsed.data.mode
    );
    return NextResponse.json(apercu);
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/vagues/generer",
      error,
      "Erreur serveur lors du calcul de l'apercu du plan."
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/vagues/generer — genere en masse le
 * plan d'empoissonnement (ADR-053 section 4). PREVISIONS_GERER — meme
 * permission que la creation unitaire (`POST .../vagues`, ADR-053 section 6).
 *
 * Ne demande QUE `horizonMois` (+ `mode`) : `dateDebutPlan`, `dureeCycleMois`,
 * `effectifAlevinsParVague`, `poidsMoyenInitialG`, `frequenceStockageMois`
 * sont relus depuis `ScenarioPrevision`/`ParametresPrevision` cote serveur,
 * jamais depuis le payload client (pre-analyse PR2bis.2 section 2).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(genererPlanVaguesPrevuesSchema, body);
    if (parsed.error) return parsed.error;

    const vaguesCreees = await genererPlanVaguesPrevues(
      id,
      auth.activeSiteId,
      parsed.data.horizonMois,
      parsed.data.mode
    );
    return NextResponse.json({ data: vaguesCreees }, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/vagues/generer",
      error,
      "Erreur serveur lors de la generation du plan d'empoissonnement."
    );
  }
}
