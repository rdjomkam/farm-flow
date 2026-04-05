/**
 * Feed period segmentation — pure functions for per-tank, per-product FCR calculation.
 *
 * Implements ADR-028: FCR calculation refactor for feed switching accuracy.
 * ADR-032: Calibrage-aware nombreVivants + removal of GOMPERTZ_BAC.
 *
 * Core idea: instead of computing FCR globally for a vague, we segment feeding data
 * into coherent periods (one product, one tank, contiguous dates) and compute FCR
 * per period, then aggregate with weighted sum.
 */

import type { PeriodeAlimentaire, FCRTraceEstimationDetail, MethodeEstimationPoids } from "@/types";
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

/**
 * Representation d'un calibrage pertinente pour le calcul FCR (ADR-032).
 *
 * Transmis par l'appelant (computeAlimentMetrics / getFCRTrace) depuis les
 * enregistrements Calibrage de la DB.
 *
 * Un CalibragePoint par operation de calibrage de la vague, avec uniquement
 * les champs necessaires au calcul de nombreVivants.
 */
export interface CalibragePoint {
  /** Date de l'operation de calibrage */
  date: Date;
  /** Mortalites enregistrees pendant le calibrage */
  nombreMorts: number;
  /**
   * Groupes de redistribution : chaque groupe decrit combien de poissons
   * ont ete envoyes vers quel bac.
   *
   * Note : si un bac source recoit certains de ses propres poissons en retour
   * (tri et remise), il apparaitra aussi comme destinationBacId.
   */
  groupes: Array<{
    destinationBacId: string;
    nombrePoissons: number;
    poidsMoyen: number;
  }>;
}

export interface VagueContext {
  dateDebut: Date;
  nombreInitial: number;
  poidsMoyenInitial: number; // grammes
  bacs: { id: string; nombreInitial: number | null }[];
  /** Calibrages de la vague, tries par date ASC. Vide si aucun calibrage. */
  calibrages?: CalibragePoint[];
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
// interpolerPoidsBac
// ---------------------------------------------------------------------------

/**
 * Interpolates or retrieves the average weight of a tank at a given date.
 *
 * Strategy (ADR-028 + ADR-029 + ADR-032):
 *   1. Exact biometry — same calendar day  ->  BIOMETRIE_EXACTE
 *   2. If strategie = GOMPERTZ_VAGUE and GompertzVagueContext valid:
 *      evaluate gompertzWeight(t, vagueParams)  ->  GOMPERTZ_VAGUE
 *   3. Linear interpolation between two bracketing biometries  ->  INTERPOLATION_LINEAIRE
 *   4. Vague initial weight — fallback final  ->  VALEUR_INITIALE
 *
 * @param targetDate         - date for which to estimate weight
 * @param bacId              - tank identifier (null = whole-vague fallback)
 * @param biometries         - time series of biometries for the tank, sorted ascending by date
 * @param poidsInitial       - initial average weight of the vague (fallback)
 * @param options            - optional strategy options (ADR-029)
 * @returns { poids, methode, detail } or null if no data at all
 */
export function interpolerPoidsBac(
  targetDate: Date,
  bacId: string | null,
  biometries: BiometriePoint[],
  poidsInitial: number,
  options?: {
    strategie?: StrategieInterpolation;
    /** Contexte vague (ADR-029) — utilise par GOMPERTZ_VAGUE */
    gompertzContext?: GompertzVagueContext;
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

  // 2. Gompertz vague strategy (ADR-029)
  if (strategie === StrategieInterpolation.GOMPERTZ_VAGUE && options?.gompertzContext) {
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

  // 3. Linear interpolation between bracketing biometries
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

  // 4. Target date is before all biometries — use initial weight
  if (!before && after) {
    return {
      poids: poidsInitial,
      methode: "VALEUR_INITIALE",
      detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
    };
  }

  // 5. Target date is after all biometries — extrapolate using last known biometry
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
// interpolerPoidsVague (ADR-033)
// ---------------------------------------------------------------------------

/**
 * Interpolates or retrieves the average weight of the whole vague at a given
 * date. Unlike interpolerPoidsBac, this function does NOT filter biometries
 * by bacId — it uses ALL biometries from the vague to represent the vague-level
 * growth curve.
 *
 * Priority chain (ADR-033 §7):
 *   1. BIOMETRIE_EXACTE — exact calendar-day match in ANY biometry
 *   2. GOMPERTZ_VAGUE — if gompertzContext is valid (HIGH or MEDIUM, R² ≥ 0.85,
 *      biometrieCount ≥ minPoints), ALWAYS evaluated even when biometries are
 *      available or when the target date is beyond all biometries
 *   3. INTERPOLATION_LINEAIRE — linear interpolation between two bracketing
 *      biometries (only when Gompertz is not available)
 *   4. VALEUR_INITIALE — fallback when nothing else is possible
 *
 * @param targetDate     - date for which to estimate weight
 * @param biometries     - ALL biometries of the vague (NOT filtered by bacId)
 * @param poidsInitial   - initial average weight of the vague (fallback)
 * @param options        - optional options including gompertzContext (no strategie — Gompertz
 *                         is evaluated unconditionally whenever a valid context is provided)
 * @returns { poids, methode, detail }
 */
export function interpolerPoidsVague(
  targetDate: Date,
  biometries: BiometriePoint[],
  poidsInitial: number,
  options?: {
    gompertzContext?: GompertzVagueContext;
    gompertzMinPoints?: number;
  }
): { poids: number; methode: MethodeEstimationPoids; detail: FCRTraceEstimationDetail } {
  // Sort all biometries (vague-level, not filtered by bacId)
  const sortedBios = [...biometries].sort((a, b) => a.date.getTime() - b.date.getTime());

  const targetMs = targetDate.getTime();

  // 1. Exact match (same calendar day) — primes over Gompertz
  const exact = sortedBios.find(
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

  // 2. Gompertz VAGUE — evaluated whenever valid context is provided, regardless of
  //    interpolStrategy and regardless of whether biometries are available.
  //    This is the core ADR-033 change: Gompertz is a time-only function and
  //    does not require per-bac data.
  const ctx = options?.gompertzContext;
  if (ctx) {
    const minPoints = options?.gompertzMinPoints ?? 5;
    const isValidLevel = ctx.confidenceLevel === "HIGH" || ctx.confidenceLevel === "MEDIUM";
    if (isValidLevel && ctx.r2 >= 0.85 && ctx.biometrieCount >= minPoints) {
      const tDays = (targetDate.getTime() - ctx.vagueDebut.getTime()) / (1000 * 60 * 60 * 24);
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
    }
  }

  // 3. Linear interpolation between two bracketing biometries
  if (sortedBios.length >= 2) {
    const before = [...sortedBios].reverse().find((b) => b.date.getTime() < targetMs);
    const after = sortedBios.find((b) => b.date.getTime() > targetMs);

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

    // Target before all biometries
    if (sortedBios.length > 0) {
      const firstBio = sortedBios[0];
      if (firstBio.date.getTime() > targetMs) {
        return {
          poids: poidsInitial,
          methode: "VALEUR_INITIALE",
          detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
        };
      }

      // Target after all biometries — flat extrapolation from last known
      const lastBio = sortedBios[sortedBios.length - 1];
      if (lastBio.date.getTime() < targetMs) {
        return {
          poids: lastBio.poidsMoyen,
          methode: "INTERPOLATION_LINEAIRE",
          detail: {
            methode: "INTERPOLATION_LINEAIRE",
            pointAvant: { date: lastBio.date, poidsMoyenG: lastBio.poidsMoyen },
            pointApres: null,
            ratio: null,
          },
        };
      }
    }
  } else if (sortedBios.length === 1) {
    const bio = sortedBios[0];
    if (bio.date.getTime() === targetMs) {
      // Already checked exact match above, but just in case
      return {
        poids: bio.poidsMoyen,
        methode: "BIOMETRIE_EXACTE",
        detail: { methode: "BIOMETRIE_EXACTE", dateBiometrie: bio.date, poidsMesureG: bio.poidsMoyen },
      };
    }
  }

  // 4. Fallback — vague initial weight
  return {
    poids: poidsInitial,
    methode: "VALEUR_INITIALE",
    detail: { methode: "VALEUR_INITIALE", poidsMoyenInitialG: poidsInitial },
  };
}

// ---------------------------------------------------------------------------
// estimerNombreVivantsADate (ADR-032)
// ---------------------------------------------------------------------------

/**
 * Estime le nombre de poissons vivants dans un bac a une date donnee,
 * en tenant compte des operations de calibrage (ADR-032).
 *
 * Algorithme :
 * 1. Chercher le dernier CalibrageGroupe dont destinationBacId = bacId
 *    et calibrage.date <= targetDate. Si trouve, partir de groupe.nombrePoissons.
 * 2. Sinon, partir de bac.nombreInitial ?? round(vague.nombreInitial / nbBacs).
 * 3. Soustraire les mortalites enregistrees pour ce bac entre la date de base
 *    (calibrage ou debut de vague) et targetDate.
 *
 * @param bacId            - identifiant du bac (null = vague entiere, fallback legacy)
 * @param targetDate       - date de debut de la periode
 * @param vagueContext     - contexte vague avec calibrages (ADR-032)
 * @param mortalitesParBac - Map<bacId, {nombreMorts, date}[]> pre-calculee
 * @returns nombre de vivants estime, ou null si impossible
 */
export function estimerNombreVivantsADate(
  bacId: string | null,
  targetDate: Date,
  vagueContext: VagueContext,
  mortalitesParBac?: Map<string, Array<{ nombreMorts: number; date: Date }>>
): number | null {
  if (bacId === null) {
    return vagueContext.nombreInitial;
  }

  const bac = vagueContext.bacs.find((b) => b.id === bacId);
  if (!bac) return null;

  const calibrages = vagueContext.calibrages ?? [];

  // Find the last calibrage whose date <= targetDate that has a group for this bacId
  let lastCalibrageDate: Date | null = null;
  let basePopulation: number | null = null;

  for (const calibrage of calibrages) {
    if (calibrage.date.getTime() > targetDate.getTime()) break;
    const groupe = calibrage.groupes.find((g) => g.destinationBacId === bacId);
    if (groupe) {
      lastCalibrageDate = calibrage.date;
      basePopulation = groupe.nombrePoissons;
    }
  }

  // If no calibrage found for this bac, use initial population
  if (basePopulation === null) {
    if (bac.nombreInitial !== null) {
      basePopulation = bac.nombreInitial;
    } else {
      const nbBacs = vagueContext.bacs.length;
      if (nbBacs === 0) return null;
      basePopulation = Math.round(vagueContext.nombreInitial / nbBacs);
    }
  }

  // Subtract mortalities between base date and targetDate for this bac
  if (mortalitesParBac) {
    const mortsBac = mortalitesParBac.get(bacId) ?? [];
    const baseMs = lastCalibrageDate
      ? lastCalibrageDate.getTime()
      : vagueContext.dateDebut.getTime();
    const targetMs = targetDate.getTime();
    for (const mort of mortsBac) {
      const mortMs = mort.date.getTime();
      if (mortMs > baseMs && mortMs <= targetMs) {
        basePopulation = Math.max(0, basePopulation - mort.nombreMorts);
      }
    }
  }

  return basePopulation;
}

// ---------------------------------------------------------------------------
// segmenterPeriodesAlimentaires
// ---------------------------------------------------------------------------

/**
 * Returns the principal product of a releve alimentation:
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
 * Segments the feeding records of a vague into coherent feeding periods.
 *
 * A period is a contiguous run of ALIMENTATION releves on the same tank
 * using the same principal product. Each product change or new tank creates
 * a new period.
 *
 * ADR-028 + ADR-033 algorithm:
 *   1. Segmentation is performed PER TANK (per bacId) — each bac has its own
 *      independent set of periods (correct per ADR-033).
 *   2. Weight estimation uses the VAGUE-LEVEL Gompertz curve via
 *      interpolerPoidsVague (ALL biometries, NOT filtered by bacId), so that
 *      the Gompertz model is always available regardless of per-tank biometry.
 *   3. nombreVivants for gainBiomasseKg is PER TANK (calibrage-aware, ADR-032).
 *   4. FCR aggregation is then computed from the per-tank periods by the caller.
 *
 * Degrades gracefully:
 *   - Releves without bacId are grouped under a synthetic "null" tank,
 *     treated as a single whole-vague tank (ADR degradation rule 3).
 *   - If gainBiomasseKg is negative, it is set to null (ADR rule: exclude anti-gain).
 *
 * @param relevsAlim   - ALIMENTATION releves with consommations, any order
 * @param biometries   - ALL BIOMETRIE releves of the vague (not filtered by bacId)
 * @param vagueContext - vague data (dateDebut, poidsMoyenInitial, bacs, calibrages)
 * @param options      - optional Gompertz context, strategy, and mortalitesParBac map
 * @returns array of PeriodeAlimentaire (one entry per tank-product run)
 */
export function segmenterPeriodesAlimentaires(
  relevsAlim: ReleveAlimPoint[],
  biometries: BiometriePoint[],
  vagueContext: VagueContext,
  options?: {
    strategie?: StrategieInterpolation;
    gompertzContext?: GompertzVagueContext;
    gompertzMinPoints?: number;
    /** Pre-computed mortalities per bac for calibrage-aware nombreVivants (ADR-032) */
    mortalitesParBac?: Map<string, Array<{ nombreMorts: number; date: Date }>>;
  }
): PeriodeAlimentaire[] {
  // Group releves by bacId (null counts as its own "tank")
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

    // Note: biometries are NOT filtered by bacId here — weight estimation uses
    // ALL vague biometries via interpolerPoidsVague (ADR-033 fix).

    // Segment into runs of same principal product
    // Each run: [start, end] inclusive indices in sorted array
    const runs: { produitId: string; releves: ReleveAlimPoint[] }[] = [];
    let currentProduitId: string | null = null;
    let currentRun: ReleveAlimPoint[] = [];

    for (const releve of sorted) {
      const principal = getProduitPrincipal(releve.consommations);
      if (principal === null) continue; // skip releves with no consommations

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
      // (each releve may have multiple consommations — sum only this produit)
      let quantiteKg = 0;
      for (const r of run.releves) {
        for (const c of r.consommations) {
          if (c.produitId === run.produitId) {
            quantiteKg += c.quantiteKg;
          }
        }
      }

      // Estimate weights at period boundaries using vague-level Gompertz (ADR-033).
      // ALL biometries are passed (not filtered by bacId) so the vague-level
      // Gompertz curve is always evaluated when available. No strategie option —
      // interpolerPoidsVague evaluates Gompertz unconditionally when context is valid.
      const interpolOpts = {
        gompertzContext: options?.gompertzContext,
        gompertzMinPoints: options?.gompertzMinPoints,
      };
      const debutEstim = interpolerPoidsVague(
        dateDebut,
        biometries, // ALL biometries, not bacBios
        vagueContext.poidsMoyenInitial,
        interpolOpts
      );
      const finEstim = interpolerPoidsVague(
        dateFin,
        biometries, // ALL biometries, not bacBios
        vagueContext.poidsMoyenInitial,
        interpolOpts
      );

      const poidsMoyenDebut = debutEstim?.poids ?? null;
      const poidsMoyenFin = finEstim?.poids ?? null;

      // Pick the method that is "least precise"
      // (VALEUR_INITIALE < INTERPOLATION_LINEAIRE < GOMPERTZ_VAGUE < BIOMETRIE_EXACTE)
      // to give a conservative/honest quality indication for the period (INC-03 fix)
      const methodeRank = (
        m: PeriodeAlimentaire["methodeEstimation"] | undefined
      ): number => {
        if (!m) return 0;
        if (m === "BIOMETRIE_EXACTE") return 3;
        if (m === "GOMPERTZ_VAGUE") return 2;
        if (m === "INTERPOLATION_LINEAIRE") return 1;
        return 0; // VALEUR_INITIALE
      };
      const methodeEstimation: PeriodeAlimentaire["methodeEstimation"] =
        methodeRank(debutEstim?.methode) <= methodeRank(finEstim?.methode)
          ? (debutEstim?.methode ?? "VALEUR_INITIALE")
          : (finEstim?.methode ?? "VALEUR_INITIALE");

      // ADR-032: calibrage-aware nombreVivants using dateDebut of the period
      const nombreVivants = estimerNombreVivantsADate(
        bacId,
        dateDebut,
        vagueContext,
        options?.mortalitesParBac
      );

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
