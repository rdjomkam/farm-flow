/**
 * POST /api/previsions/scenarios/[id]/chainer
 *
 * Crée un nouveau scénario chaîné : la trésorerie initiale du nouveau
 * scénario est le solde final (dernière valeur de `soldeFCFA`) du
 * scénario parent, et `dateDebutPlan` est le mois suivant la fin du
 * parent. Le lien `scenarioParentId` est persisté.
 *
 * Permissions : PREVISIONS_GERER (création de scénario).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { getScenarioById, createScenario } from "@/lib/queries/previsions-scenarios";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import { Permission } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const siteId = auth.activeSiteId;

    const parent = await getScenarioById(id, siteId);
    if (!parent) {
      return NextResponse.json(
        { status: 404, message: "Scénario parent introuvable." },
        { status: 404 }
      );
    }
    if (!parent.parametres) {
      return NextResponse.json(
        { status: 409, message: "Le scénario parent n'a pas de paramètres configurés." },
        { status: 409 }
      );
    }

    const scenarioPourCalcul = await chargerScenarioPourMoteur(id, siteId);
    const projection = calculerProjectionScenario(scenarioPourCalcul);

    if (projection.mois.length === 0) {
      return NextResponse.json(
        { status: 409, message: "Le scénario parent n'a aucune projection (pas de vagues)." },
        { status: 409 }
      );
    }

    const dernierMois = projection.mois[projection.mois.length - 1];
    const soldeFinal = dernierMois.soldeFCFA.toNumber();

    const dateDebutParent = new Date(parent.dateDebutPlan);
    const dateDebutSuivant = new Date(
      dateDebutParent.getFullYear(),
      dateDebutParent.getMonth() + projection.horizonMois,
      1
    );

    const body = await request.json().catch(() => ({}));
    const code = body.code || `${parent.code}-S`;
    const nom = body.nom || `Suite de ${parent.nom}`;

    const scenario = await createScenario(siteId, {
      code,
      nom,
      description: `Chaîné depuis ${parent.nom} (${parent.code}). Solde final repris : ${Math.round(soldeFinal).toLocaleString("fr-FR")} FCFA.`,
      dureeCycleMois: parent.dureeCycleMois,
      dateDebutPlan: dateDebutSuivant.toISOString(),
      userId: auth.userId,
      scenarioParentId: parent.id,
      parametres: {
        effectifAlevinsParVague: parent.parametres.effectifAlevinsParVague,
        margeSecuriteAlevinsPct: Number(parent.parametres.margeSecuriteAlevinsPct),
        poidsMoyenInitialG: Number(parent.parametres.poidsMoyenInitialG),
        poidsObjectifG: Number(parent.parametres.poidsObjectifG),
        prixAlevinUnitaireFCFA: Number(parent.parametres.prixAlevinUnitaireFCFA),
        prixVenteKgFCFA: Number(parent.parametres.prixVenteKgFCFA),
        nombreBacsSimultanesCible: parent.parametres.nombreBacsSimultanesCible,
        frequenceStockageMois: Number(parent.parametres.frequenceStockageMois),
        capaciteTransportAlimentsSacs: parent.parametres.capaciteTransportAlimentsSacs ?? undefined,
        coutTransportAlimentsFCFA: parent.parametres.coutTransportAlimentsFCFA ? Number(parent.parametres.coutTransportAlimentsFCFA) : undefined,
        capaciteTransportPoissonsKg: parent.parametres.capaciteTransportPoissonsKg ?? undefined,
        coutTransportPoissonsFCFA: parent.parametres.coutTransportPoissonsFCFA ? Number(parent.parametres.coutTransportPoissonsFCFA) : undefined,
        capaciteTransportAlevinsNb: parent.parametres.capaciteTransportAlevinsNb ?? undefined,
        coutTransportAlevinsFCFA: parent.parametres.coutTransportAlevinsFCFA ? Number(parent.parametres.coutTransportAlevinsFCFA) : undefined,
        tauxEpargnePct: Number(parent.parametres.tauxEpargnePct),
        alevinsAchetesParDefaut: parent.parametres.alevinsAchetesParDefaut,
        tresorerieInitialeFCFA: soldeFinal,
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/chainer",
      error,
      "Erreur serveur lors du chaînage du scénario."
    );
  }
}
