/**
 * GET /api/previsions/scenarios/[id]/solde-final
 *
 * Retourne le solde final (dernière valeur de `soldeFCFA`) du scénario.
 * Utilisé par le sélecteur "Importer la trésorerie depuis" dans l'onglet
 * Paramètres d'un autre scénario.
 *
 * Permissions : PREVISIONS_VOIR.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { getScenarioById } from "@/lib/queries/previsions-scenarios";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import { Permission } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;
    const siteId = auth.activeSiteId;

    const scenario = await getScenarioById(id, siteId);
    if (!scenario) {
      return NextResponse.json(
        { status: 404, message: "Scénario introuvable." },
        { status: 404 }
      );
    }
    if (!scenario.parametres) {
      return NextResponse.json(
        { status: 409, message: "Le scénario n'a pas de paramètres configurés." },
        { status: 409 }
      );
    }

    const scenarioPourCalcul = await chargerScenarioPourMoteur(id, siteId);
    const projection = calculerProjectionScenario(scenarioPourCalcul);

    if (projection.mois.length === 0) {
      return NextResponse.json({
        scenarioId: id,
        scenarioNom: scenario.nom,
        soldeFinalFCFA: 0,
        horizonMois: 0,
      });
    }

    const dernierMois = projection.mois[projection.mois.length - 1];

    return NextResponse.json({
      scenarioId: id,
      scenarioNom: scenario.nom,
      soldeFinalFCFA: dernierMois.soldeFCFA.toNumber(),
      horizonMois: projection.horizonMois,
    });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/solde-final",
      error,
      "Erreur serveur lors du calcul du solde final."
    );
  }
}
