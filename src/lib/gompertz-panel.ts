/**
 * gompertz-panel.ts
 *
 * Pure utility functions to build the data structure for the Gompertz info panel.
 * No React, no DB, no side effects — all computations are deterministic.
 */

import { gompertzWeight, projeterDateRecolte } from "@/lib/gompertz";
import type { GompertzConfidenceLevel, GompertzParams } from "@/lib/gompertz";
import type { EvolutionPoidsPoint } from "@/types/calculs";

export interface GompertzComparaisonRow {
  /** Formatted date string for display (ISO date, e.g. "2026-01-15") */
  date: string;
  /** Day index since vague start */
  jour: number;
  /** Observed weighted-average weight (g) */
  poidsReel: number;
  /** Gompertz model prediction for that day (g) */
  poidsPredits: number;
  /** poidsReel - poidsPredits (g), positive = heavier than predicted */
  ecartG: number;
  /** Percentage deviation: (ecartG / poidsPredits) * 100 */
  ecartPct: number;
}

export interface GompertzPanelData {
  // Model quality
  confidenceLevel: GompertzConfidenceLevel;
  r2: number;
  rmse: number;
  biometrieCount: number;

  // Model parameters
  params: GompertzParams;

  // Per-date comparison: predicted vs actual
  comparaison: GompertzComparaisonRow[];

  // Short-term projections from current day
  projections: {
    jourActuel: number;
    poidsActuel: number;
    j7: number;
    j14: number;
    j30: number;
  };

  // Target weight projection
  poidsObjectif: number;
  /** Remaining days until objective weight; null if unreachable */
  joursAvantObjectif: number | null;
  /** ISO date string of projected harvest date; null if unreachable */
  dateObjectif: string | null;
}

/**
 * Build the panel data from available inputs.
 * All computation is pure — no DB, no side effects.
 */
export function buildGompertzPanelData(opts: {
  data: EvolutionPoidsPoint[];
  confidenceLevel: GompertzConfidenceLevel;
  r2: number;
  rmse: number;
  biometrieCount: number;
  wInfinity: number;
  k: number;
  ti: number;
  poidsObjectif: number;
  joursActuels: number;
  dateDebut: Date;
}): GompertzPanelData {
  const {
    data,
    confidenceLevel,
    r2,
    rmse,
    biometrieCount,
    wInfinity,
    k,
    ti,
    poidsObjectif,
    joursActuels,
    dateDebut,
  } = opts;

  const params: GompertzParams = { wInfinity, k, ti };

  // Build comparison rows — only for points that have real biometry data (poidsMoyen > 0)
  const comparaison: GompertzComparaisonRow[] = data
    .filter((d) => d.poidsMoyen != null && d.poidsMoyen > 0)
    .map((d) => {
      const poidsPredits = gompertzWeight(d.jour, params);
      const ecartG = (d.poidsMoyen ?? 0) - poidsPredits;
      const ecartPct = poidsPredits > 0 ? (ecartG / poidsPredits) * 100 : 0;
      return {
        date: d.date,
        jour: d.jour,
        poidsReel: Math.round(d.poidsMoyen ?? 0),
        poidsPredits: Math.round(poidsPredits),
        ecartG: Math.round(ecartG),
        ecartPct: Math.round(ecartPct * 10) / 10,
      };
    });

  // Projections
  const poidsActuel = gompertzWeight(joursActuels, params);
  const j7 = gompertzWeight(joursActuels + 7, params);
  const j14 = gompertzWeight(joursActuels + 14, params);
  const j30 = gompertzWeight(joursActuels + 30, params);

  // Target weight date estimation
  // projeterDateRecolte returns days remaining (number | null), not a Date
  const joursRestants = projeterDateRecolte(params, poidsObjectif, joursActuels);
  let joursAvantObjectif: number | null = null;
  let dateObjectif: string | null = null;

  if (joursRestants !== null) {
    joursAvantObjectif = Math.ceil(joursRestants);
    // Compute the projected harvest date from today + days remaining
    const msPerDay = 86400000;
    const dateRecolte = new Date(Date.now() + joursAvantObjectif * msPerDay);
    dateObjectif = dateRecolte.toISOString();
  }

  // Suppress unused variable warning — dateDebut kept for API consistency
  void dateDebut;

  return {
    confidenceLevel,
    r2,
    rmse,
    biometrieCount,
    params,
    comparaison,
    projections: {
      jourActuel: joursActuels,
      poidsActuel: Math.round(poidsActuel),
      j7: Math.round(j7),
      j14: Math.round(j14),
      j30: Math.round(j30),
    },
    poidsObjectif,
    joursAvantObjectif,
    dateObjectif,
  };
}
