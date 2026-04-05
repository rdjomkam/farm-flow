/**
 * Feed period segmentation — pure functions for per-tank, per-product FCR calculation.
 *
 * Implements ADR-028: FCR calculation refactor for feed switching accuracy.
 *
 * Core idea: instead of computing FCR globally for a vague, we segment feeding data
 * into coherent periods (one product, one tank, contiguous dates) and compute FCR
 * per period, then aggregate with weighted sum.
 */

import type { PeriodeAlimentaire, FCRTraceEstimationDetail } from "@/types";
import { StrategieInterpolation } from "@/types";
import { gompertzWeight } from "@/lib/gompertz";

// ---------------------------------------------------------------------------
// Input types (local — not exported; consumers only need PeriodeAlimentaire)
// ---------------------------------------------------------------------------

export interface ReleveAlimPoint {
  releveId: string;
  date: Date;
  /** null for old records without bacId — treated as a single "whole-vague" tank */
  bacId: string | null;
  consommations: { produitId: string; quantiteKg: number }[];
}

export interface BiometriePoint {
  date: Date;
  /** null for old records without bacId */
  bacId: string | null;
  poidsMoyen: number; // grammes
}

export interface VagueContext {
  dateDebut: Date;
  nombreInitial: number;
  poidsMoyenInitial: number; // grammes
  bacs: { id: string; nombreInitial: number | null }[];
}

// ---------------------------------------------------------------------------
// GompertzVagueContext
// ---------------------------------------------------------------------------

/**
 * Contexte Gompertz optionnel pour la strategie GOMPERTZ_VAGUE (ADR-029).
 *
 * Transmis par l'appelant (computeAlimentMetrics) depuis un GompertzVague DB row.
 * Si null ou confidenceLevel insuffisant, le systeme retombe sur LINEAIRE.
 */
export interface GompertzVagueContext {
  /** W∞ — poids asymptotique en grammes */
  wInfinity: number;
  /** k — constante de taux de croissance (1/jour) */
  k: number;
  /** ti — point d'inflexion en jours depuis le debut de la vague */
  ti: number;
  /** R² — coefficient de determination du calibrage */
  r2: number;
  /** Nombre de biometries utilisees pour le calibrage */
  biometrieCount: number;
  /** Niveau de confiance — seuls HIGH et MEDIUM declenchent Gompertz */
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  /** Date de debut de la vague — necessaire pour convertir targetDate en t (jours) */
  vagueDebut: Date;
}

// ---------------------------------------------------------------------------
// GompertzBacContext (ADR-030)
// ---------------------------------------------------------------------------

/**
 * Contexte Gompertz per-tank pour la strategie GOMPERTZ_BAC (ADR-030).
 *
 * Un GompertzBacContext par bac, transmis par l'appelant (computeAlimentMetrics)
 * depuis les enregistrements GompertzBac de la DB.
 * Si null pour un bacId donne, le systeme retombe sur GompertzVagueContext.
 */
export interface GompertzBacContext {
  /** W∞ — poids asymptotique en grammes */
  wInfinity: number;
  /** k — constante de taux de croissance (1/jour) */
  k: number;
  /** ti — point d'inflexion en jours depuis le debut de la vague */
  ti: number;
  /** R² — coefficient de determination du calibrage */
  r2: number;
  /** Nombre de biometries du bac utilisees pour le calibrage */
  biometrieCount: number;
  /** Niveau de confiance — seuls HIGH et MEDIUM declenchent Gompertz */
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  /** Date de debut de la vague — necessaire pour convertir targetDate en t (jours) */
  vagueDebut: Date;
}

// ---------------------------------------------------------------------------
// interpolerPoidsBac
// ---------------------------------------------------------------------------

/**
 * Interpolates or retrieves the average weight of a tank at a given date.
 *
 * Strategy (ADR-028 + ADR-029 + ADR-030):
 *   1. Exact biometry — same calendar day  →  BIOMETRIE_EXACTE
 *   2a. If strategie = GOMPERTZ_BAC and GompertzBacContext valid for this bacId
 *       (HIGH | MEDIUM, r2 >= 0.85, biometrieCount >= gompertzMinPoints):
 *       evaluate gompertzWeight(t, bacParams)  →  GOMPERTZ_BAC
 *   2b. If strategie = GOMPERTZ_BAC or GOMPERTZ_VAGUE, and GompertzVagueContext valid:
 *       evaluate gompertzWeight(t, vagueParams)  →  GOMPERTZ_VAGUE
 *   2c. Linear interpolation between two bracketing biometries  →  INTERPOLATION_LINEAIRE
 *   3. Vague initial weight — fallback final  →  VALEUR_INITIALE
 *
 * @param targetDate         - date for which to estimate weight
 * @param bacId              - tank identifier (null = whole-vague fallback)
 * @param biometries         - time series of biometries for the tank, sorted ascending by date
 * @param poidsInitial       - initial average weight of the vague (fallback)
 * @param options            - optional strategy options (ADR-029 + ADR-030)
 * @returns { poids, methode, detail } or null if no data at all
 */
export function interpolerPoidsBac(
  targetDate: Date,
  bacId: string | null,
  biometries: BiometriePoint[],
  poidsInitial: number,
  options?: {
    strategie?: StrategieInterpolation;
    /** Contexte vague (ADR-029) — utilise par GOMPERTZ_VAGUE et comme fallback de GOMPERTZ_BAC */
    gompertzContext?: GompertzVagueContext;
    /** Contextes per-tank (ADR-030) — utilises uniquement si strategie = GOMPERTZ_BAC */
    gompertzBacContexts?: Map<string, GompertzBacContext>;
    gompertzMinPoints?: number;
  }
): { poids: number; methode: PeriodeAlimentaire["methodeEstimation"]; detail: FCRTraceEstimationDetail } | null {
  // Filter biometries for this tank
  const bacBios = biometries
    .filter((b) => b.bacId === bacId)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (bacBios.length === 0) {
    // No biometry for this tank at all — use initial weight
    return {
      poids: poidsInitial,
      methode: "VALEUR_INITIALE",
      detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
    };
  }

  const targetMs = targetDate.getTime();

  // 1. Exact match (same calendar day) — always primes over any Gompertz strategy
  const exact = bacBios.find(
    (b) =>
      b.date.getFullYear() === targetDate.getFullYear() &&
      b.date.getMonth() === targetDate.getMonth() &&
      b.date.getDate() === targetDate.getDate()
  );
  if (exact) {
    return {
      poids: exact.poidsMoyen,
      methode: "BIOMETRIE_EXACTE",
      detail: { methode: "BIOMETRIE_EXACTE", dateBiometrie: exact.date, poidsMesureG: exact.poidsMoyen },
    };
  }

  const strategie = options?.strategie ?? StrategieInterpolation.LINEAIRE;
  const minPoints = options?.gompertzMinPoints ?? 5;

  // 2a. Gompertz per-tank strategy (ADR-030)
  if (strategie === StrategieInterpolation.GOMPERTZ_BAC && bacId !== null && options?.gompertzBacContexts) {
    const bacCtx = options.gompertzBacContexts.get(bacId);
    if (bacCtx) {
      const isValidLevel =
        bacCtx.confidenceLevel === "HIGH" || bacCtx.confidenceLevel === "MEDIUM";
      if (isValidLevel && bacCtx.r2 >= 0.85 && bacCtx.biometrieCount >= minPoints) {
        const tDays =
          (targetDate.getTime() - bacCtx.vagueDebut.getTime()) / (1000 * 60 * 60 * 24);
        if (tDays >= 0) {
          const poids = gompertzWeight(tDays, {
            wInfinity: bacCtx.wInfinity,
            k: bacCtx.k,
            ti: bacCtx.ti,
          });
          if (poids > 0 && !isNaN(poids)) {
            return {
              poids,
              methode: "GOMPERTZ_BAC",
              detail: {
                methode: "GOMPERTZ_BAC",
                tJours: tDays,
                params: {
                  wInfinity: bacCtx.wInfinity,
                  k: bacCtx.k,
                  ti: bacCtx.ti,
                  r2: bacCtx.r2,
                  biometrieCount: bacCtx.biometrieCount,
                  confidenceLevel: bacCtx.confidenceLevel,
                },
                resultatG: poids,
              },
            };
          }
        }
      }
    }
    // Per-tank context absent or invalid — fall through to GOMPERTZ_VAGUE fallback (2b)
  }

  // 2b. Gompertz vague strategy (ADR-029) — used directly for GOMPERTZ_VAGUE,
  //     or as fallback level when GOMPERTZ_BAC per-tank context is absent/invalid
  if (
    (strategie === StrategieInterpolation.GOMPERTZ_VAGUE ||
      strategie === StrategieInterpolation.GOMPERTZ_BAC) &&
    options?.gompertzContext
  ) {
    const ctx = options.gompertzContext;
    const isValidLevel =
      ctx.confidenceLevel === "HIGH" || ctx.confidenceLevel === "MEDIUM";

    if (isValidLevel && ctx.r2 >= 0.85 && ctx.biometrieCount >= minPoints) {
      const tDays =
        (targetDate.getTime() - ctx.vagueDebut.getTime()) / (1000 * 60 * 60 * 24);

      if (tDays >= 0) {
        const poids = gompertzWeight(tDays, {
          wInfinity: ctx.wInfinity,
          k: ctx.k,
          ti: ctx.ti,
        });

        if (poids > 0 && !isNaN(poids)) {
          return {
            poids,
            methode: "GOMPERTZ_VAGUE",
            detail: {
              methode: "GOMPERTZ_VAGUE",
              tJours: tDays,
              params: {
                wInfinity: ctx.wInfinity,
                k: ctx.k,
                ti: ctx.ti,
                r2: ctx.r2,
                biometrieCount: ctx.biometrieCount,
                confidenceLevel: ctx.confidenceLevel,
              },
              resultatG: poids,
            },
          };
        }
      }
      // If Gompertz result is invalid (t < 0, NaN, poids <= 0), fall through to linear
    }
    // Conditions not met — fall through to linear interpolation
  }

  // 2c. Linear interpolation between bracketing biometries
  const before = [...bacBios].reverse().find((b) => b.date.getTime() < targetMs);
  const after = bacBios.find((b) => b.date.getTime() > targetMs);

  if (before && after) {
    const span = after.date.getTime() - before.date.getTime();
    const elapsed = targetMs - before.date.getTime();
    const ratio = elapsed / span;
    const poids = before.poidsMoyen + (after.poidsMoyen - before.poidsMoyen) * ratio;
    return {
      poids,
      methode: "INTERPOLATION_LINEAIRE",
      detail: {
        methode: "INTERPOLATION_LINEAIRE",
        pointAvant: { date: before.date, poidsMoyenG: before.poidsMoyen },
        pointApres: { date: after.date, poidsMoyenG: after.poidsMoyen },
        ratio,
      },
    };
  }

  // 3. Target date is before all biometries — use initial weight
  if (!before && after) {
    return {
      poids: poidsInitial,
      methode: "VALEUR_INITIALE",
      detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
    };
  }

  // 4. Target date is after all biometries — extrapolate using last known biometry
  if (before && !after) {
    return {
      poids: before.poidsMoyen,
      methode: "INTERPOLATION_LINEAIRE",
      detail: {
        methode: "INTERPOLATION_LINEAIRE",
        pointAvant: { date: before.date, poidsMoyenG: before.poidsMoyen },
        pointApres: null,
        ratio: null,
      },
    };
  }

  // Fallback (should not occur if bacBios.length > 0)
  return {
    poids: poidsInitial,
    methode: "VALEUR_INITIALE",
    detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
  };
}

// ---------------------------------------------------------------------------
// segmenterPeriodesAlimentaires
// ---------------------------------------------------------------------------

/**
 * Returns the principal product of a relevé alimentation:
 * the one with the highest quantiteKg. Returns null if no consommations.
 */
function getProduitPrincipal(
  consommations: { produitId: string; quantiteKg: number }[]
): string | null {
  if (consommations.length === 0) return null;
  return consommations.reduce(
    (max, c) => (c.quantiteKg > max.quantiteKg ? c : max),
    consommations[0]
  ).produitId;
}

/**
 * Estimates the number of living fish for a tank at the start of a period.
 *
 * When bacId is null (old records), falls back to the vague-level nombreInitial.
 * When bacs have their own nombreInitial, uses that for the specific tank.
 * Otherwise distributes vague nombreInitial evenly across bacs.
 */
function estimerNombreVivants(
  bacId: string | null,
  vagueContext: VagueContext
): number | null {
  if (bacId === null) {
    return vagueContext.nombreInitial;
  }

  const bac = vagueContext.bacs.find((b) => b.id === bacId);
  if (!bac) return null;

  if (bac.nombreInitial !== null) {
    return bac.nombreInitial;
  }

  // Distribute evenly across bacs
  const nbBacs = vagueContext.bacs.length;
  if (nbBacs === 0) return null;
  return Math.round(vagueContext.nombreInitial / nbBacs);
}

/**
 * Segments the feeding records of a vague into coherent feeding periods.
 *
 * A period is a contiguous run of ALIMENTATION relevés on the same tank
 * using the same principal product. Each product change or new tank creates
 * a new period.
 *
 * ADR-028, Couche 1 algorithm:
 *   1. For each tank, sort ALIMENTATION relevés by date.
 *   2. Group consecutive relevés with the same principal produitId.
 *   3. Each product change → new period.
 *   4. Estimate poidsMoyenDebut / poidsMoyenFin for each period.
 *   5. Compute gainBiomasseKg.
 *
 * Degrades gracefully:
 *   - Relevés without bacId are grouped under a synthetic "null" tank,
 *     treated as a single whole-vague tank (ADR degradation rule 3).
 *   - If gainBiomasseKg is negative, it is set to null (ADR rule: exclude anti-gain).
 *
 * @param relevsAlim   - ALIMENTATION relevés with consommations, any order
 * @param biometries   - BIOMETRIE relevés with poidsMoyen, any order
 * @param vagueContext - vague data (dateDebut, poidsMoyenInitial, bacs)
 * @returns array of PeriodeAlimentaire
 */
export function segmenterPeriodesAlimentaires(
  relevsAlim: ReleveAlimPoint[],
  biometries: BiometriePoint[],
  vagueContext: VagueContext,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
    /** Contexts per-tank indexes par bacId. Ignores si strategie != GOMPERTZ_BAC. */
    gompertzBacContexts?: Map<string, GompertzBacContext>;
    gompertzMinPoints?: number;
  }
): PeriodeAlimentaire[] {
  // Group relevés by bacId (null counts as its own "tank")
  const bacGroups = new Map<string | null, ReleveAlimPoint[]>();
  for (const r of relevsAlim) {
    const key = r.bacId;
    if (!bacGroups.has(key)) bacGroups.set(key, []);
    bacGroups.get(key)!.push(r);
  }

  const allPeriodes: PeriodeAlimentaire[] = [];

  for (const [bacId, bacReleves] of bacGroups) {
    // Sort by date ascending
    const sorted = [...bacReleves].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Filter biometries for this tank
    const bacBios = biometries
      .filter((b) => b.bacId === bacId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Segment into runs of same principal product
    // Each run: [start, end] inclusive indices in sorted array
    const runs: { produitId: string; releves: ReleveAlimPoint[] }[] = [];
    let currentProduitId: string | null = null;
    let currentRun: ReleveAlimPoint[] = [];

    for (const releve of sorted) {
      const principal = getProduitPrincipal(releve.consommations);
      if (principal === null) continue; // skip relevés with no consommations

      if (principal !== currentProduitId) {
        // Flush current run
        if (currentRun.length > 0 && currentProduitId !== null) {
          runs.push({ produitId: currentProduitId, releves: currentRun });
        }
        currentProduitId = principal;
        currentRun = [releve];
      } else {
        currentRun.push(releve);
      }
    }
    // Flush last run
    if (currentRun.length > 0 && currentProduitId !== null) {
      runs.push({ produitId: currentProduitId, releves: currentRun });
    }

    // Build PeriodeAlimentaire for each run
    for (const run of runs) {
      const dateDebut = run.releves[0].date;
      const dateFin = run.releves.at(-1)!.date;

      // Total aliment consumed in kg for THIS produit in this run
      // (each relevé may have multiple consommations — sum only this produit)
      let quantiteKg = 0;
      for (const r of run.releves) {
        for (const c of r.consommations) {
          if (c.produitId === run.produitId) {
            quantiteKg += c.quantiteKg;
          }
        }
      }

      // Estimate weights at period boundaries
      const debutEstim = interpolerPoidsBac(
        dateDebut,
        bacId,
        bacBios,
        vagueContext.poidsMoyenInitial,
        options
      );
      const finEstim = interpolerPoidsBac(
        dateFin,
        bacId,
        bacBios,
        vagueContext.poidsMoyenInitial,
        options
      );

      const poidsMoyenDebut = debutEstim?.poids ?? null;
      const poidsMoyenFin = finEstim?.poids ?? null;

      // Pick the method that is "least precise"
      // (VALEUR_INITIALE < INTERPOLATION_LINEAIRE < GOMPERTZ_VAGUE < GOMPERTZ_BAC < BIOMETRIE_EXACTE)
      // to give a conservative/honest quality indication for the period (INC-03 fix)
      const methodeRank = (
        m: PeriodeAlimentaire["methodeEstimation"] | undefined
      ): number => {
        if (!m) return 0;
        if (m === "BIOMETRIE_EXACTE") return 4;
        if (m === "GOMPERTZ_BAC") return 3;
        if (m === "GOMPERTZ_VAGUE") return 2;
        if (m === "INTERPOLATION_LINEAIRE") return 1;
        return 0; // VALEUR_INITIALE
      };
      const methodeEstimation: PeriodeAlimentaire["methodeEstimation"] =
        methodeRank(debutEstim?.methode) <= methodeRank(finEstim?.methode)
          ? (debutEstim?.methode ?? "VALEUR_INITIALE")
          : (finEstim?.methode ?? "VALEUR_INITIALE");

      const nombreVivants = estimerNombreVivants(bacId, vagueContext);

      // Gain biomasse: (poidsFin - poidsDebut) * nombreVivants / 1000
      let gainBiomasseKg: number | null = null;
      if (poidsMoyenDebut !== null && poidsMoyenFin !== null && nombreVivants !== null) {
        const rawGain = ((poidsMoyenFin - poidsMoyenDebut) * nombreVivants) / 1000;
        // ADR degradation rule: exclude negative gains
        gainBiomasseKg = rawGain > 0 ? rawGain : null;
      }

      allPeriodes.push({
        bacId: bacId ?? "unknown",
        produitId: run.produitId,
        dateDebut,
        dateFin,
        quantiteKg,
        poidsMoyenDebut,
        poidsMoyenFin,
        nombreVivants,
        gainBiomasseKg,
        methodeEstimation,
      });
    }
  }

  return allPeriodes;
}
