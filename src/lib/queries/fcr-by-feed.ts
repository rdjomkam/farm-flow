/**
 * FCR par aliment — algorithme ADR-036.
 *
 * Remplace computeAlimentMetrics (ADR-033) en partant des ReleveConsommation
 * (pas de Bac.vagueId) pour inclure les bacs desassignes apres un calibrage.
 *
 * Etapes :
 *   Step 4 : buildDailyGainTable       — table journaliere (poids, gain)
 *   Step 5 : segmenterPeriodesParBac   — periodes de consommation par bac
 *   Step 6 : estimerPopulationBac      — estimation population par bac/periode
 *   Step 7 : calculerFCRPeriodeBac     — FCR pour une periode dans un bac
 *   Step 8 : aggregerFCRVague          — agregation FCR vague
 *
 * Reference : docs/decisions/ADR-036-fcr-by-feed-algorithm.md
 */

import { gompertzWeight, calibrerGompertz } from "@/lib/gompertz";
import type { GompertzParams } from "@/lib/gompertz";
import type { CalibragePoint } from "@/lib/feed-periods";
import type {
  FCRByFeedParams,
  PeriodeBacFCR,
  EstimationPopulationBac,
  FCRBacPeriode,
  FCRByFeedVague,
  FCRByFeedResult,
} from "@/types/fcr-by-feed";
import { CategorieProduit, TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Calibrage data enriched with source bac identifiers.
 * Used by estimerPopulationBac to detect bacs emptied during a calibrage.
 * All sourceBacIds are tracked (not just the first one — BUG-MULTI-SOURCE fix).
 */
type CalibrageForBac = CalibragePoint & {
  sourceBacIds: string[];
  nombreTransfere: number;
};

// ---------------------------------------------------------------------------
// Step 4 — buildDailyGainTable
// ---------------------------------------------------------------------------

/**
 * Step 4 — Table journaliere (poids, gain) entre deux jours relatifs a la vague.
 * gain(t) = weight(t) - weight(t-1)
 *
 * @param params  - Parametres Gompertz calibres
 * @param dayFrom - Jour de debut (relatif a la vague, inclusif)
 * @param dayTo   - Jour de fin (relatif a la vague, inclusif)
 * @returns Map<jour, { poids, gain }>
 */
export function buildDailyGainTable(
  params: GompertzParams,
  dayFrom: number,
  dayTo: number
): Map<number, { poids: number; gain: number }> {
  const table = new Map<number, { poids: number; gain: number }>();

  for (let t = dayFrom; t <= dayTo; t++) {
    const poids = gompertzWeight(t, params);
    const poidsPrev = gompertzWeight(t - 1, params);
    const gain = poids - poidsPrev;
    table.set(t, { poids, gain });
  }

  return table;
}

// ---------------------------------------------------------------------------
// Step 5 — segmenterPeriodesParBac
// ---------------------------------------------------------------------------

/**
 * Step 5 — Segmente les jours de consommation d'un bac en periodes.
 *
 * Regles :
 * - Jours exclusifs consecutifs = une periode
 * - Jours mixtes rattaches a la periode exclusive adjacente la plus proche
 * - Gaps >= 1 jour = rupture de periode
 * - Jours mixtes isoles (aucune periode exclusive adjacente) = micro-periode autonome
 *
 * Invariant : sum(qtyTargetKg) over periodes = total conso bac.
 *
 * @param consoByDay - Map<dateStr YYYY-MM-DD, { qtyTargetKg, autresProduits }>
 * @param bacId      - Identifiant du bac
 * @param bacNom     - Nom du bac
 * @returns Liste de periodes pour ce bac
 */
export function segmenterPeriodesParBac(
  consoByDay: Map<string, {
    qtyTargetKg: number;
    autresProduits: { produitId: string; quantiteKg: number }[];
  }>,
  bacId: string,
  bacNom: string
): PeriodeBacFCR[] {
  if (consoByDay.size === 0) return [];

  // Sort dates ascending
  const sortedDates = Array.from(consoByDay.keys()).sort();

  // Classify each day
  type DayEntry = {
    dateStr: string;
    date: Date;
    qtyTargetKg: number;
    isMixed: boolean;
  };

  const days: DayEntry[] = sortedDates.map((dateStr) => {
    const entry = consoByDay.get(dateStr)!;
    return {
      dateStr,
      date: new Date(dateStr),
      qtyTargetKg: entry.qtyTargetKg,
      isMixed: entry.autresProduits.length > 0,
    };
  });

  // Build the final periods: group consecutive exclusive days, then attach adjacent mixed days.
  return buildPeriods(days, bacId, bacNom);
}

/**
 * Core period building algorithm.
 *
 * 1. Find all consecutive runs of exclusive days (gaps break runs).
 * 2. For each mixed day, find the nearest adjacent exclusive run endpoint.
 * 3. Attach mixed days to nearest exclusive run (extending it).
 * 4. Remaining mixed days (isolated) become standalone micro-periods.
 */
function buildPeriods(
  days: Array<{
    dateStr: string;
    date: Date;
    qtyTargetKg: number;
    isMixed: boolean;
  }>,
  bacId: string,
  bacNom: string
): PeriodeBacFCR[] {
  if (days.length === 0) return [];

  // Step A: identify exclusive-run segments
  // Each segment: start index, end index (in days array), contiguous exclusive days
  type Segment = { startIdx: number; endIdx: number };
  const segments: Segment[] = [];

  let segStart: number | null = null;

  for (let i = 0; i < days.length; i++) {
    if (days[i].isMixed) {
      if (segStart !== null) {
        // Check if there's a gap since last exclusive day
        // Find last exclusive day before i
        let lastExcl = i - 1;
        while (lastExcl >= segStart && days[lastExcl].isMixed) lastExcl--;

        if (lastExcl >= segStart) {
          segments.push({ startIdx: segStart, endIdx: lastExcl });
        }
        segStart = null;
      }
    } else {
      // Exclusive day
      if (segStart === null) {
        segStart = i;
      } else {
        // Check for calendar gap from previous exclusive day
        // Find previous exclusive day
        let prevExcl = i - 1;
        while (prevExcl >= 0 && days[prevExcl].isMixed) prevExcl--;

        if (prevExcl >= segStart) {
          const diffDays = Math.round(
            (days[i].date.getTime() - days[prevExcl].date.getTime()) / 86400000
          );
          if (diffDays > 1) {
            // Gap found: close segment at prevExcl, start new one at i
            segments.push({ startIdx: segStart, endIdx: prevExcl });
            segStart = i;
          }
        }
      }
    }
  }

  // Close last segment
  if (segStart !== null) {
    let lastExcl = days.length - 1;
    while (lastExcl >= segStart && days[lastExcl].isMixed) lastExcl--;
    if (lastExcl >= segStart) {
      segments.push({ startIdx: segStart, endIdx: lastExcl });
    }
  }

  // Step B: for each mixed day, find nearest segment endpoint
  // and assign it; unassigned mixed days become micro-periods
  // Track which mixed days are assigned
  const mixedAssigned = new Set<number>();

  // For each segment, find adjacent mixed days
  // Extended segments: { segment, preMixed: number[], postMixed: number[] }
  type ExtendedSegment = {
    segment: Segment;
    preMixed: number[]; // indices of mixed days before segment (closest first from segment)
    postMixed: number[]; // indices of mixed days after segment (closest first from segment)
  };

  const extSegments: ExtendedSegment[] = segments.map((seg) => ({
    segment: seg,
    preMixed: [],
    postMixed: [],
  }));

  // For each mixed day, determine which segment it belongs to (nearest endpoint)
  for (let i = 0; i < days.length; i++) {
    if (!days[i].isMixed) continue;

    // Find nearest segment endpoint (by calendar distance)
    let bestSegIdx = -1;
    let bestDist = Infinity;
    let bestSide: "pre" | "post" = "post";

    for (let s = 0; s < extSegments.length; s++) {
      const seg = extSegments[s].segment;

      // Distance to end of segment (mixed after)
      if (i > seg.endIdx) {
        // Check that there's no gap (mixed day must be adjacent = directly after)
        const distDays = Math.round(
          (days[i].date.getTime() - days[seg.endIdx].date.getTime()) / 86400000
        );
        // Must be adjacent: no exclusive day between segment end and this mixed day
        let hasExclBetween = false;
        for (let k = seg.endIdx + 1; k < i; k++) {
          if (!days[k].isMixed) { hasExclBetween = true; break; }
        }
        if (!hasExclBetween && distDays < bestDist) {
          bestDist = distDays;
          bestSegIdx = s;
          bestSide = "post";
        }
      }

      // Distance to start of segment (mixed before)
      if (i < seg.startIdx) {
        const distDays = Math.round(
          (days[seg.startIdx].date.getTime() - days[i].date.getTime()) / 86400000
        );
        // Must be adjacent: no exclusive day between this mixed day and segment start
        let hasExclBetween = false;
        for (let k = i + 1; k < seg.startIdx; k++) {
          if (!days[k].isMixed) { hasExclBetween = true; break; }
        }
        if (!hasExclBetween && distDays < bestDist) {
          bestDist = distDays;
          bestSegIdx = s;
          bestSide = "pre";
        }
      }
    }

    if (bestSegIdx >= 0) {
      if (bestSide === "post") {
        extSegments[bestSegIdx].postMixed.push(i);
      } else {
        extSegments[bestSegIdx].preMixed.push(i);
      }
      mixedAssigned.add(i);
    }
  }

  // Step C: build final PeriodeBacFCR[] from extended segments
  const result: PeriodeBacFCR[] = [];

  for (const extSeg of extSegments) {
    const { segment, preMixed, postMixed } = extSeg;

    // Collect all day indices for this period
    const allIndices = [
      ...preMixed,
      ...range(segment.startIdx, segment.endIdx + 1),
      ...postMixed,
    ].sort((a, b) => a - b);

    const periodDays = allIndices.map((i) => days[i]);
    if (periodDays.length === 0) continue;

    const dateDebut = periodDays[0].date;
    const dateFin = periodDays[periodDays.length - 1].date;
    const dureeJours = Math.round((dateFin.getTime() - dateDebut.getTime()) / 86400000) + 1;
    const qtyTargetKg = periodDays.reduce((s, d) => s + d.qtyTargetKg, 0);
    const joursExclusifs = periodDays.filter((d) => !d.isMixed).length;
    const joursMixtes = periodDays.filter((d) => d.isMixed).length;

    result.push({
      bacId,
      bacNom,
      dateDebut,
      dateFin,
      dureeJours,
      qtyTargetKg,
      joursExclusifs,
      joursMixtes,
    });
  }

  // Step D: isolated mixed days (unassigned) become micro-periods
  for (let i = 0; i < days.length; i++) {
    if (!days[i].isMixed) continue;
    if (mixedAssigned.has(i)) continue;

    const d = days[i];
    result.push({
      bacId,
      bacNom,
      dateDebut: d.date,
      dateFin: d.date,
      dureeJours: 1,
      qtyTargetKg: d.qtyTargetKg,
      joursExclusifs: 0,
      joursMixtes: 1,
    });
  }

  // Sort by dateDebut
  result.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());

  return result;
}

/** Helper: range [start, end) */
function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i++) result.push(i);
  return result;
}

// ---------------------------------------------------------------------------
// Step 6 — estimerPopulationBac
// ---------------------------------------------------------------------------

/**
 * Step 6 — Estime {countDebut, countFin, avgCount} pour un bac sur une periode.
 *
 * Methode principale (COMPTAGE_ANCRAGE) :
 *   1. Anchor = dernier COMPTAGE dont date <= dateFin du bac
 *   2. Ajuster vers l'avant : soustraire mortalites apres comptage et avant dateFin
 *   3. Ajuster vers l'arriere : ajouter mortalites entre dateDebut et comptage
 *
 * Cas special "bac vide" (comptage = 0) :
 *   Reconstituer depuis calibrage destination + mortalites dans la periode
 *
 * Fallback (PROPORTIONNEL_INITIAL) :
 *   Si aucun COMPTAGE disponible, repartition proportionnelle de vague.nombreInitial / nbBacs
 *
 * @param bacId              - Identifiant du bac
 * @param dateDebut          - Debut de la periode
 * @param dateFin            - Fin de la periode
 * @param comptages          - Relevés de comptage pour ce bac (COMPTAGE)
 * @param mortalitesBac      - Mortalites pour ce bac dans la periode
 * @param calibrages         - Calibrages de la vague (pour bac vide)
 * @param vagueNombreInit    - Nombre initial de poissons de la vague
 * @param nbBacsVague        - Nombre de bacs de la vague
 * @returns EstimationPopulationBac
 */
export function estimerPopulationBac(
  bacId: string,
  dateDebut: Date,
  dateFin: Date,
  comptages: Array<{ date: Date; nombreCompte: number }>,
  mortalitesBac: Array<{ date: Date; nombreMorts: number }>,
  calibrages: CalibrageForBac[],
  vagueNombreInit: number,
  nbBacsVague: number
): EstimationPopulationBac {
  // Find anchor: most recent COMPTAGE (any date — can be before or after the period)
  // We prefer a comptage closest to the period, but any comptage is better than none
  const comptagesSorted = [...comptages].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const anchor = comptagesSorted[0] ?? null;

  if (anchor !== null) {
    const anchorMs = anchor.date.getTime();
    const debutMs = dateDebut.getTime();
    const finMs = dateFin.getTime();

    // Special case: bac vide (comptage = 0)
    // Reconstruct from calibrage: find calibrage where bacId is source (transferred out)
    if (anchor.nombreCompte === 0) {
      // Look for calibrage that transferred fish OUT of this bac
      // A calibrage where bacId is a source (has grupos with destinationBacId != bacId)
      // We need to reconstruct: nbTransferred + mortalitesDansPeriode
      let reconstructed: number | null = null;

      // Try to find calibrage that happened after/at anchor date where this bac
      // is listed as a source (i.e. fish were transferred OUT of it).
      // sourceBacIds is an array — all elements are checked (BUG-MULTI-SOURCE fix).
      const relevantCalibrages = calibrages.filter(
        (c) => c.date.getTime() >= anchorMs
      );

      for (const cal of relevantCalibrages) {
        if (cal.sourceBacIds.includes(bacId)) {
          // Check if this bac is the sole source — then total transferred is exact.
          // If multiple sources, we cannot determine per-source contributions.
          // Fall back to proportional initial (nombreInitial / nbBacsVague)
          // minus cumulative deaths for this bac before the calibrage.
          if (cal.sourceBacIds.length === 1) {
            const transferred = cal.nombreTransfere;
            const mortsAvantCal = mortalitesBac
              .filter((m) => {
                const mMs = m.date.getTime();
                return mMs >= debutMs && mMs < cal.date.getTime();
              })
              .reduce((s, m) => s + m.nombreMorts, 0);
            const mortsAuCal = mortalitesBac
              .filter((m) => m.date.getTime() === cal.date.getTime())
              .reduce((s, m) => s + m.nombreMorts, 0);
            reconstructed = transferred + mortsAvantCal + mortsAuCal;
          } else {
            // Multi-source calibrage: use proportional initial minus all deaths
            const baseCount = Math.round(vagueNombreInit / Math.max(1, nbBacsVague));
            const allMorts = mortalitesBac.reduce((s, m) => s + m.nombreMorts, 0);
            reconstructed = Math.max(0, baseCount - allMorts);
          }
          break;
        }
      }

      if (reconstructed !== null) {
        const mortsInPeriod = mortalitesBac
          .filter((m) => {
            const mMs = m.date.getTime();
            return mMs >= debutMs && mMs <= finMs;
          })
          .reduce((s, m) => s + m.nombreMorts, 0);

        const countDebut = reconstructed;
        const countFin = Math.max(0, reconstructed - mortsInPeriod);
        const avgCount = (countDebut + countFin) / 2;

        return {
          bacId,
          countDebut,
          countFin,
          avgCount,
          methode: "COMPTAGE_ANCRAGE",
        };
      }
    }

    // Normal anchor case
    // Determine countDebut and countFin by walking from anchor date to period boundaries.
    //
    // Key idea: deaths between two dates must be added (if going backward) or subtracted
    // (if going forward) relative to the anchor count.
    //
    // Deaths strictly between anchor and a date T:
    //   - if T > anchor: subtract deaths in (anchor, T] to get count at T
    //   - if T < anchor: add deaths in (T, anchor] to get count at T

    const countAtDate = (targetMs: number): number => {
      if (targetMs >= anchorMs) {
        // Forward: subtract deaths between (anchor, target]
        const morts = mortalitesBac
          .filter((m) => m.date.getTime() > anchorMs && m.date.getTime() <= targetMs)
          .reduce((s, m) => s + m.nombreMorts, 0);
        return Math.max(0, anchor.nombreCompte - morts);
      } else {
        // Backward: add deaths between (target, anchor]
        const morts = mortalitesBac
          .filter((m) => m.date.getTime() > targetMs && m.date.getTime() <= anchorMs)
          .reduce((s, m) => s + m.nombreMorts, 0);
        return anchor.nombreCompte + morts;
      }
    };

    const countDebut = countAtDate(debutMs);
    const countFin = countAtDate(finMs);
    const avgCount = (countDebut + countFin) / 2;

    return {
      bacId,
      countDebut,
      countFin,
      avgCount,
      methode: "COMPTAGE_ANCRAGE",
    };
  }

  // Fallback: proportional distribution
  const baseCount = Math.round(vagueNombreInit / Math.max(1, nbBacsVague));
  const debutMs = dateDebut.getTime();
  const finMs = dateFin.getTime();

  const mortsInPeriod = mortalitesBac
    .filter((m) => {
      const mMs = m.date.getTime();
      return mMs >= debutMs && mMs <= finMs;
    })
    .reduce((s, m) => s + m.nombreMorts, 0);

  const countDebut = baseCount;
  const countFin = Math.max(0, baseCount - mortsInPeriod);
  const avgCount = (countDebut + countFin) / 2;

  return {
    bacId,
    countDebut,
    countFin,
    avgCount,
    methode: "PROPORTIONNEL_INITIAL",
  };
}

// ---------------------------------------------------------------------------
// Step 7 — calculerFCRPeriodeBac
// ---------------------------------------------------------------------------

/**
 * Step 7 — FCR pour une periode dans un bac.
 *
 * gainParPoissonG = Σ dailyGain(t) pour t in [debut, fin] (jours relatifs vague)
 * gainBiomasseKg = gainParPoissonG × avgFishCount / 1000
 * fcr = qtyAlimentKg / gainBiomasseKg (null si gain <= 0)
 *
 * @param periode    - Periode de consommation du bac
 * @param dailyGain  - Table journaliere des gains (par jour relatif vague)
 * @param population - Estimation de la population du bac
 * @param vagueDebut - Date de debut de la vague (pour convertir dates en jours relatifs)
 * @returns FCRBacPeriode
 */
export function calculerFCRPeriodeBac(
  periode: PeriodeBacFCR,
  dailyGain: Map<number, { poids: number; gain: number }>,
  population: EstimationPopulationBac,
  vagueDebut: Date
): FCRBacPeriode {
  // Convert period dates to day indices relative to vague start
  const debutDayIdx = Math.round(
    (periode.dateDebut.getTime() - vagueDebut.getTime()) / 86400000
  );
  const finDayIdx = Math.round(
    (periode.dateFin.getTime() - vagueDebut.getTime()) / 86400000
  );

  // Sum daily gains over the period
  let gainParPoissonG = 0;
  for (let t = debutDayIdx; t <= finDayIdx; t++) {
    const entry = dailyGain.get(t);
    if (entry) {
      gainParPoissonG += entry.gain;
    } else {
      // If not in table, compute directly (edge case)
      const poids = gompertzWeight(t, { wInfinity: 0, k: 0, ti: 0 }); // fallback 0
      const poidsPrev = gompertzWeight(t - 1, { wInfinity: 0, k: 0, ti: 0 });
      gainParPoissonG += poids - poidsPrev;
    }
  }

  const avgFishCount = population.avgCount;
  const gainBiomasseKg = (gainParPoissonG * avgFishCount) / 1000;

  let fcr: number | null = null;
  let flagHighFCR: boolean | null = null;

  if (gainBiomasseKg > 0) {
    fcr = periode.qtyTargetKg / gainBiomasseKg;
    flagHighFCR = fcr > 3.0;
  }

  return {
    bacId: periode.bacId,
    bacNom: periode.bacNom,
    dateDebut: periode.dateDebut,
    dateFin: periode.dateFin,
    dureeJours: periode.dureeJours,
    qtyAlimentKg: periode.qtyTargetKg,
    gainParPoissonG,
    avgFishCount,
    gainBiomasseKg,
    fcr,
    flagHighFCR,
  };
}

// ---------------------------------------------------------------------------
// Step 8 — aggregerFCRVague
// ---------------------------------------------------------------------------

/**
 * Step 8 — Agrege les FCR de toutes les periodes d'une vague.
 *
 * FCR_vague = sum(qtyAlimentKg valide) / sum(gainBiomasseKg valide)
 * Une periode est valide si gainBiomasseKg > 0 (coherent avec ADR-033 DISC-16).
 *
 * @param periodes - Liste des FCRBacPeriode d'une vague
 * @returns { totalAlimentKg, totalGainBiomasseKg, fcrVague }
 */
export function aggregerFCRVague(
  periodes: FCRBacPeriode[]
): { totalAlimentKg: number; totalGainBiomasseKg: number; fcrVague: number | null } {
  let totalAlimentKg = 0;
  let totalGainBiomasseKg = 0;

  for (const periode of periodes) {
    // Only include periods with positive biomass gain
    if (periode.gainBiomasseKg > 0) {
      totalAlimentKg += periode.qtyAlimentKg;
      totalGainBiomasseKg += periode.gainBiomasseKg;
    }
  }

  const fcrVague =
    totalGainBiomasseKg > 0 ? totalAlimentKg / totalGainBiomasseKg : null;

  return { totalAlimentKg, totalGainBiomasseKg, fcrVague };
}

// ---------------------------------------------------------------------------
// Main function — getFCRByFeed
// ---------------------------------------------------------------------------

/**
 * Calcule le FCR pour un produit aliment en utilisant l'algorithme ADR-036.
 *
 * Contrairement a computeAlimentMetrics (ADR-033) :
 * - Demarre des ReleveConsommation (pas de Bac.vagueId) → inclut bacs desassignes
 * - Calcule gain/poisson via table journaliere Gompertz (pas gain biomasse endpoints)
 * - Produit le detail bac × periode pour l'audit de transparence
 *
 * @param siteId    - ID du site (multi-tenancy)
 * @param produitId - ID du produit aliment
 * @param params    - minPoints (defaut: 5), wInfinity optionnel
 * @returns FCRByFeedResult ou null si produit introuvable
 */
// ---------------------------------------------------------------------------
// Saison filter helpers
// ---------------------------------------------------------------------------

/** Mois (1-12) de la saison seche au Cameroun : novembre, decembre, janvier, fevrier, mars */
const MOIS_SECHE = new Set([11, 12, 1, 2, 3]);

/**
 * Filtre une date selon le saisonFilter.
 * @returns true si la date est dans la saison demandee (ou si aucun filtre)
 */
function dateMatchesSaison(date: Date, saisonFilter?: "SECHE" | "PLUIES"): boolean {
  if (!saisonFilter) return true;
  const mois = date.getUTCMonth() + 1; // 1-12
  if (saisonFilter === "SECHE") return MOIS_SECHE.has(mois);
  return !MOIS_SECHE.has(mois); // PLUIES
}

export async function getFCRByFeed(
  siteId: string,
  produitId: string,
  params?: FCRByFeedParams
): Promise<FCRByFeedResult | null> {
  const minPoints = params?.minPoints ?? 5;
  const wInfinityOverride = params?.wInfinity ?? null;
  const saisonFilter = params?.saisonFilter ?? undefined;

  // Lazy import to avoid DB connection at module load time (allows unit testing of pure functions)
  const { prisma } = await import("@/lib/db");

  // Load the product
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, siteId, categorie: CategorieProduit.ALIMENT },
    include: { fournisseur: true },
  });

  if (!produit) return null;

  // Step 1: Find all vagues with ReleveConsommation for this product
  const vaguesRaw = await prisma.vague.findMany({
    where: {
      siteId,
      releves: {
        some: {
          consommations: {
            some: { produitId },
          },
        },
      },
    },
    include: {
      bacs: true,
    },
  });

  if (vaguesRaw.length === 0) {
    return {
      produitId,
      produitNom: produit.nom,
      fournisseurNom: produit.fournisseur?.nom ?? null,
      prixUnitaire: produit.prixUnitaire,
      params: { minPoints, wInfinity: wInfinityOverride },
      fcrGlobal: null,
      totalAlimentKg: 0,
      totalGainBiomasseKg: 0,
      nombreVaguesIncluses: 0,
      nombreVaguesIgnorees: 0,
      parVague: [],
    };
  }

  const parVague: FCRByFeedVague[] = [];
  let globalTotalAlimentKg = 0;
  let globalTotalGainBiomasseKg = 0;
  let nombreVaguesIncluses = 0;
  let nombreVaguesIgnorees = 0;

  for (const vague of vaguesRaw) {
    // Step 2: Collect biometric data for Gompertz calibration
    const biometries = await prisma.releve.findMany({
      where: {
        vagueId: vague.id,
        typeReleve: TypeReleve.BIOMETRIE,
        poidsMoyen: { not: null },
      },
      orderBy: { date: "asc" },
      select: { date: true, poidsMoyen: true },
    });

    // Average biometries by day
    const bioByDay = new Map<number, number[]>();
    for (const bio of biometries) {
      const dayIdx = Math.round(
        (bio.date.getTime() - vague.dateDebut.getTime()) / 86400000
      );
      if (!bioByDay.has(dayIdx)) bioByDay.set(dayIdx, []);
      bioByDay.get(dayIdx)!.push(bio.poidsMoyen!);
    }

    const biometriePoints = Array.from(bioByDay.entries()).map(
      ([jour, poids]) => ({
        jour,
        poidsMoyen: poids.reduce((s, p) => s + p, 0) / poids.length,
      })
    );

    // Step 3: Gompertz calibration
    const calibrationInput = {
      points: biometriePoints,
      initialGuess: wInfinityOverride ? { wInfinity: wInfinityOverride } : undefined,
    };

    const calibration = calibrerGompertz(calibrationInput, minPoints);

    if (!calibration) {
      // Insufficient data — mark vague as ignored
      const consommationsVague = await prisma.releveConsommation.aggregate({
        where: {
          produitId,
          releve: { vagueId: vague.id },
        },
        _sum: { quantite: true },
      });

      parVague.push({
        vagueId: vague.id,
        vagueCode: vague.code,
        dateDebut: vague.dateDebut,
        dateFin: vague.dateFin,
        gompertz: null,
        flagLowConfidence: false,
        insufficientData: true,
        totalAlimentKg: consommationsVague._sum.quantite ?? 0,
        totalGainBiomasseKg: 0,
        fcrVague: null,
        periodesBac: [],
      });
      nombreVaguesIgnorees++;
      continue;
    }

    const gompertzParams: GompertzParams = calibration.params;
    const flagLowConfidence = calibration.r2 < 0.85;

    // Step 4: Daily gain table
    // First find the range of consumption days
    const consommationsAllRaw = await prisma.releveConsommation.findMany({
      where: {
        produitId,
        releve: { vagueId: vague.id },
      },
      include: {
        releve: {
          include: { bac: true },
        },
      },
      orderBy: { releve: { date: "asc" } },
    });

    // Apply saisonFilter: keep only consommations whose releve date matches the season
    const consommationsAll = saisonFilter
      ? consommationsAllRaw.filter((c) => dateMatchesSaison(c.releve.date, saisonFilter))
      : consommationsAllRaw;

    if (consommationsAll.length === 0) {
      parVague.push({
        vagueId: vague.id,
        vagueCode: vague.code,
        dateDebut: vague.dateDebut,
        dateFin: vague.dateFin,
        gompertz: {
          wInfinity: calibration.params.wInfinity,
          k: calibration.params.k,
          ti: calibration.params.ti,
          r2: calibration.r2,
          biometrieCount: calibration.biometrieCount,
          confidenceLevel: calibration.confidenceLevel,
        },
        flagLowConfidence,
        insufficientData: false,
        totalAlimentKg: 0,
        totalGainBiomasseKg: 0,
        fcrVague: null,
        periodesBac: [],
      });
      nombreVaguesIncluses++;
      continue;
    }

    // Find consumption day range
    const consoDateMs = consommationsAll.map((c) => c.releve.date.getTime());
    const minConsoDate = new Date(Math.min(...consoDateMs));
    const maxConsoDate = new Date(Math.max(...consoDateMs));

    const dayFrom = Math.round(
      (minConsoDate.getTime() - vague.dateDebut.getTime()) / 86400000
    );
    const dayTo = Math.round(
      (maxConsoDate.getTime() - vague.dateDebut.getTime()) / 86400000
    );

    const dailyGainTable = buildDailyGainTable(gompertzParams, dayFrom, dayTo);

    // Step 5: Segment by bac
    // Group consumptions by bac
    type BacConsoDay = {
      qtyTargetKg: number;
      autresProduits: { produitId: string; quantiteKg: number }[];
    };

    const bacConsoMap = new Map<string, { bacNom: string; days: Map<string, BacConsoDay> }>();

    // Also load all releveConsommations for the same releve (to detect mixed days)
    // For each releve that has the target product, check if it also has other products
    const releveIdsWithTarget = new Set(
      consommationsAll.map((c) => c.releveId)
    );

    // Load all consommations for those releves
    const allConsosByReleve = await prisma.releveConsommation.findMany({
      where: { releveId: { in: Array.from(releveIdsWithTarget) } },
      include: { produit: { select: { id: true } } },
    });

    // Group by releveId
    const releveConsoMap = new Map<
      string,
      { produitId: string; quantite: number }[]
    >();
    for (const conso of allConsosByReleve) {
      if (!releveConsoMap.has(conso.releveId)) {
        releveConsoMap.set(conso.releveId, []);
      }
      releveConsoMap.get(conso.releveId)!.push({
        produitId: conso.produitId,
        quantite: conso.quantite,
      });
    }

    // Build per-bac consumption maps
    for (const conso of consommationsAll) {
      const releve = conso.releve;
      const bacId = releve.bacId ?? "unknown";
      const bacNom = releve.bac?.nom ?? "Inconnu";
      const dateStr = formatDateStr(releve.date);

      if (!bacConsoMap.has(bacId)) {
        bacConsoMap.set(bacId, { bacNom, days: new Map() });
      }

      const bacDays = bacConsoMap.get(bacId)!.days;

      // Get other products in this releve
      const releveConsos = releveConsoMap.get(releve.id) ?? [];
      const autresProduits = releveConsos
        .filter((c) => c.produitId !== produitId)
        .map((c) => ({ produitId: c.produitId, quantiteKg: c.quantite }));

      if (!bacDays.has(dateStr)) {
        bacDays.set(dateStr, { qtyTargetKg: 0, autresProduits: [] });
      }

      const day = bacDays.get(dateStr)!;
      day.qtyTargetKg += conso.quantite;
      // Merge autresProduits (deduplicate)
      for (const ap of autresProduits) {
        if (!day.autresProduits.find((x) => x.produitId === ap.produitId)) {
          day.autresProduits.push(ap);
        }
      }
    }

    // Step 5 continued: segment periods per bac
    const periodesBac: FCRBacPeriode[] = [];

    // Load population data for Step 6
    const comptagesVague = await prisma.releve.findMany({
      where: { vagueId: vague.id, typeReleve: TypeReleve.COMPTAGE, nombreCompte: { not: null } },
      select: { bacId: true, date: true, nombreCompte: true },
    });

    const mortalitesVague = await prisma.releve.findMany({
      where: { vagueId: vague.id, typeReleve: TypeReleve.MORTALITE, nombreMorts: { not: null } },
      select: { bacId: true, date: true, nombreMorts: true },
    });

    // Load calibrages for the vague
    const calibrageVague = await prisma.calibrage.findMany({
      where: {
        vagueId: vague.id,
      },
      include: {
        groupes: {
          select: {
            destinationBacId: true,
            nombrePoissons: true,
            poidsMoyen: true,
          },
        },
      },
    });

    // Build CalibragePoint[] for the helpers
    const calibragePoints: CalibragePoint[] = calibrageVague.map((cal) => ({
      date: cal.date,
      nombreMorts: cal.nombreMorts ?? 0,
      groupes: cal.groupes.map((g) => ({
        destinationBacId: g.destinationBacId,
        nombrePoissons: g.nombrePoissons,
        poidsMoyen: g.poidsMoyen,
      })),
    }));

    // Also build per-calibrage bac info for empty-bac detection
    // We need to know which calibrage transferred FROM a specific bac.
    // sourceBacIds is an array — all source bacs must be tracked (BUG-MULTI-SOURCE fix).
    type CalibrageWithSources = CalibragePoint & {
      sourceBacIds: string[];
      totalTransfered: number;
    };

    const calibrageWithSources: CalibrageWithSources[] = calibrageVague.map((cal) => ({
      date: cal.date,
      nombreMorts: cal.nombreMorts ?? 0,
      groupes: cal.groupes.map((g) => ({
        destinationBacId: g.destinationBacId,
        nombrePoissons: g.nombrePoissons,
        poidsMoyen: g.poidsMoyen,
      })),
      sourceBacIds: cal.sourceBacIds,
      totalTransfered: cal.groupes.reduce(
        (s, g) => s + g.nombrePoissons,
        0
      ),
    }));

    const nbBacs = vague.bacs.length || 1;

    for (const [bacId, { bacNom, days }] of bacConsoMap) {
      const periodes = segmenterPeriodesParBac(days, bacId, bacNom);

      // Step 6 + 7: estimate population and calculate FCR per period
      const comptagesBac = comptagesVague
        .filter((c) => c.bacId === bacId && c.nombreCompte !== null)
        .map((c) => ({ date: c.date, nombreCompte: c.nombreCompte! }));

      const mortalitesBac = mortalitesVague
        .filter((m) => m.bacId === bacId && m.nombreMorts !== null)
        .map((m) => ({ date: m.date, nombreMorts: m.nombreMorts! }));

      // Build calibrage list for this specific bac.
      // Each entry exposes all sourceBacIds so estimerPopulationBac can detect
      // whether this bac was emptied by the calibrage (BUG-MULTI-SOURCE fix).
      const calibragesForBac: CalibrageForBac[] = calibrageWithSources.map((c) => ({
        date: c.date,
        nombreMorts: c.nombreMorts,
        groupes: c.groupes,
        sourceBacIds: c.sourceBacIds,
        nombreTransfere: c.totalTransfered,
      }));

      for (const periode of periodes) {
        const population = estimerPopulationBac(
          bacId,
          periode.dateDebut,
          periode.dateFin,
          comptagesBac,
          mortalitesBac,
          calibragesForBac,
          vague.nombreInitial,
          nbBacs
        );

        const fcrPeriode = calculerFCRPeriodeBac(
          periode,
          dailyGainTable,
          population,
          vague.dateDebut
        );

        periodesBac.push(fcrPeriode);
      }
    }

    // Step 8: aggregate
    const { totalAlimentKg, totalGainBiomasseKg, fcrVague } = aggregerFCRVague(periodesBac);

    parVague.push({
      vagueId: vague.id,
      vagueCode: vague.code,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      gompertz: {
        wInfinity: calibration.params.wInfinity,
        k: calibration.params.k,
        ti: calibration.params.ti,
        r2: calibration.r2,
        biometrieCount: calibration.biometrieCount,
        confidenceLevel: calibration.confidenceLevel,
      },
      flagLowConfidence,
      insufficientData: false,
      totalAlimentKg,
      totalGainBiomasseKg,
      fcrVague,
      periodesBac,
    });

    if (!flagLowConfidence) {
      globalTotalAlimentKg += totalAlimentKg;
      globalTotalGainBiomasseKg += totalGainBiomasseKg;
      nombreVaguesIncluses++;
    } else {
      nombreVaguesIgnorees++;
    }
  }

  const fcrGlobal =
    globalTotalGainBiomasseKg > 0
      ? globalTotalAlimentKg / globalTotalGainBiomasseKg
      : null;

  return {
    produitId,
    produitNom: produit.nom,
    fournisseurNom: produit.fournisseur?.nom ?? null,
    prixUnitaire: produit.prixUnitaire,
    params: { minPoints, wInfinity: wInfinityOverride },
    fcrGlobal,
    totalAlimentKg: globalTotalAlimentKg,
    totalGainBiomasseKg: globalTotalGainBiomasseKg,
    nombreVaguesIncluses,
    nombreVaguesIgnorees,
    parVague,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD string (UTC) */
function formatDateStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
