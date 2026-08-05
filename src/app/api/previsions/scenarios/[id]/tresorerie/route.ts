import { NextRequest, NextResponse } from "next/server";
import { getTresorerieTroisSeries } from "@/lib/queries/previsions-tresorerie-trois-series";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import type { Decimal } from "@/lib/previsions/decimal-config";

/** `decimal.js` -> `number`, a la frontiere JSON — meme convention que `GET .../calculer`. */
function n(value: Decimal): number {
  return value.toNumber();
}
function nOrNull(value: Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

/**
 * GET /api/previsions/scenarios/[id]/tresorerie — vue tresorerie a TROIS
 * SERIES (ADR-053 §6.5 des exigences fonctionnelles, amendement §15.1(b)/
 * §15.2, Sprint PR3-ter, story B.3) : BUDGET INITIAL (fige, LU depuis
 * `SnapshotBudgetInitial`, jamais recalcule) / PRÉVISION ACTUALISÉE
 * (`calculerProjectionScenario`, recalculee a la demande) / RÉEL
 * (rapprochement nette et cumule), plus la Reprevision glissante (story
 * B.2, DISTINCTE de PRÉVISION ACTUALISÉE).
 *
 * Permission : PREVISIONS_VOIR SEULE — route en LECTURE PURE (elle ne
 * persiste rien, meme patron que `GET .../calculer` et
 * `GET .../clotures`).
 *
 * Caveat propage tel quel (JAMAIS avale dans cette serialisation, ADR-053
 * §15.1(b)) : `caveatApportsReelsNonModelises`/`caveatSerieReelleIncomplete`
 * restent des litteraux `true` dans la reponse JSON — a la charge de l'UI
 * (story B.5, hors perimetre de cette route) de les afficher.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const resultat = await getTresorerieTroisSeries(id, auth.activeSiteId);

    return NextResponse.json({
      scenarioId: resultat.scenarioId,
      horizonMois: resultat.horizonMois,
      budgetInitialDisponible: resultat.budgetInitialDisponible,
      series: resultat.series.map((m) => ({
        moisAbsolu: m.moisAbsolu,
        budgetInitialFCFA: nOrNull(m.budgetInitialFCFA),
        previsionActualiseeFCFA: n(m.previsionActualiseeFCFA),
        reelFCFA: n(m.reelFCFA),
        caveatApportsReelsNonModelises: m.caveatApportsReelsNonModelises,
      })),
      reprevisionGlissante: resultat.reprevisionGlissante.map((m) => ({
        moisAbsolu: m.moisAbsolu,
        source: m.source,
        soldeMensuelFCFA: n(m.soldeMensuelFCFA),
        soldeCumuleFCFA: n(m.soldeCumuleFCFA),
        caveatSerieReelleIncomplete: m.caveatSerieReelleIncomplete,
      })),
      caveatSerieReelleIncomplete: resultat.caveatSerieReelleIncomplete,
      calculeLe: resultat.calculeLe.toISOString(),
    });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/tresorerie",
      error,
      "Erreur serveur lors du calcul de la vue tresorerie a trois series."
    );
  }
}
