import { NextRequest, NextResponse } from "next/server";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import type { Decimal } from "@/lib/previsions/decimal-config";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/** `decimal.js` (moteur) -> `number`, a la frontiere JSON — jamais un Decimal brut dans NextResponse.json. */
function n(value: Decimal): number {
  return value.toNumber();
}

/**
 * GET /api/previsions/scenarios/[id]/calculer — projection complete de
 * l'horizon du scenario (ADR-053 §7.2) : series mensuelles, tresorerie
 * cumulee, point bas et le mois ou il survient.
 *
 * Permission : PREVISIONS_VOIR SEULE (decision explicite du sprint). Cette
 * route est en LECTURE PURE : elle charge (`chargerScenarioPourMoteur`,
 * PR2.1), calcule (`calculerProjectionScenario`, orchestration du moteur pur
 * `src/lib/previsions/*.ts`), renvoie — ELLE NE PERSISTE RIEN. Elle
 * n'appelle en particulier JAMAIS `replaceAlimentsParVaguePrevue` : la
 * persistance des lignes `AlimentParVaguePrevue` reste le role exclusif de
 * `PUT /api/previsions/vagues-prevues/[id]/aliments`, une route separee que
 * l'UI peut appeler avec les valeurs recalculees ici si elle souhaite les
 * enregistrer.
 *
 * Deux gaps de modele documentes explicitement dans
 * `src/lib/previsions/route-orchestration.ts` (composition du tonnage
 * cible, calendrier mensuel de recolte/transport) — voir le rapport de
 * cloture PR2.2 pour le detail.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const scenario = await chargerScenarioPourMoteur(id, auth.activeSiteId);
    const projection = calculerProjectionScenario(scenario);

    return NextResponse.json({
      scenarioId: scenario.id,
      horizonMois: projection.horizonMois,
      mois: projection.mois.map((m) => ({
        moisAbsolu: m.moisAbsolu,
        revenusFCFA: n(m.revenusFCFA),
        coutAlimentsFCFA: n(m.coutAlimentsFCFA),
        coutAlevinsFCFA: n(m.coutAlevinsFCFA),
        baseRepartitionFCFA: n(m.baseRepartitionFCFA),
        investissementsFCFA: n(m.investissementsFCFA),
        depensesFCFA: n(m.depensesFCFA),
        apportsFCFA: n(m.apportsFCFA),
        resultatFCFA: n(m.resultatFCFA),
        epargneFCFA: n(m.epargneFCFA),
        soldeFCFA: n(m.soldeFCFA),
        empoissonneKg: n(m.empoissonneKg),
        ventesKg: n(m.ventesKg),
        alevinsACommanderNb: n(m.alevinsACommanderNb),
        besoinAlimentsTotalKg: n(m.besoinAlimentsTotalKg),
        sacsAlimentsTotal: m.sacsAlimentsTotal,
        sacsParGranulometrie: m.sacsParGranulometrie,
        detailParVagueSacs: m.detailParVagueSacs,
        logistique: {
          voyagesAliments: m.logistique.voyagesAliments,
          voyagesPoissons: m.logistique.voyagesPoissons,
          voyagesAlevins: m.logistique.voyagesAlevins,
          sousTotalFCFA: n(m.logistique.sousTotalFCFA),
        },
      })),
      vagues: projection.vagues.map((v) => ({
        vaguePrevueId: v.vaguePrevueId,
        code: v.code,
        statut: v.statut,
        moisStockageAbsolu: v.moisStockageAbsolu,
        moisRecolteAbsolu: v.moisRecolteAbsolu,
        coutAlimentFCFA: n(v.coutAlimentFCFA),
        coutAlevinsFCFA: n(v.coutAlevinsFCFA),
        quotePartChargesFCFA: n(v.quotePartChargesFCFA),
        coutProductionFCFA: n(v.coutProductionFCFA),
        revenuPrevuFCFA: n(v.revenuPrevuFCFA),
        biomasseKg: n(v.biomasseKg),
        alimentsParMois: v.alimentsParMois.map((a) => ({
          alimentPrevisionId: a.alimentPrevisionId,
          moisCycle: a.moisCycle,
          moisAbsolu: a.moisAbsolu,
          quantiteKg: n(a.quantiteKg),
          sacs: a.sacs,
          montantFCFA: n(a.montantFCFA),
        })),
      })),
      pointBas: projection.pointBas
        ? { pointBasFCFA: n(projection.pointBas.pointBasFCFA), moisAbsolu: projection.pointBas.moisAbsolu }
        : null,
      budget: {
        totalCoutsProductionFCFA: n(projection.budget.totalCoutsProductionFCFA),
        totalChargesHorsProductionFCFA: n(projection.budget.totalChargesHorsProductionFCFA),
        totalApportsFCFA: n(projection.budget.totalApportsFCFA),
        budgetTotalFCFA: n(projection.budget.budgetTotalFCFA),
      },
    });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/calculer",
      error,
      "Erreur serveur lors du calcul de la projection.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
