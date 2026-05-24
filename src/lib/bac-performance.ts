/**
 * src/lib/bac-performance.ts
 *
 * Pure calculation functions for per-bac growth and cost performance metrics.
 * All functions are side-effect-free and testable.
 *
 * Sprint 12 — Story: Performance par Bac section on Vague Detail Page
 *
 * Fixes applied:
 * - Cost uses getPrixParUniteBase() + convertirUniteStock() for correct unit handling
 * - FCR accounts for sold fish biomass: totalFeedKg / (biomasse + soldBiomasse - initialBiomasse)
 * - Biometry period snapshots for long-term evaluation
 * - rankLabel no longer hardcodes French — component handles i18n
 */

import { computeVivantsByBac, getPrixParUniteBase, convertirUniteStock } from "@/lib/calculs";

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface BiometryPeriodSnapshot {
  periodIndex: number;           // 0-based
  dateDebut: string;             // ISO date (start biometry)
  dateFin: string;               // ISO date (end biometry or today if enCours)
  dureeJours: number;
  enCours: boolean;              // true = open period (last biometry → today)
  hasCalibrage: boolean;         // true = a calibrage/comptage reset occurred at start of this period
  poidsMoyenDebut: number;       // g
  poidsMoyenFin: number | null;  // g — null when enCours (no closing biometry yet)
  croissanceG: number | null;    // weight gain in grams — null when enCours
  gmq: number | null;            // g/day for this period — null when enCours
  alimentKg: number;             // feed consumed during this period
  coutAlimentPeriode: number;    // feed cost during this period
  mortalites: number;            // deaths during this period
  vivantsDebut: number;
  vivantsFin: number;
  biomasseDebut: number;         // kg
  biomasseFin: number | null;    // kg — null when enCours (no poidsMoyenFin)
  fcrPeriode: number | null;     // period-specific FCR/ICA
}

export interface BacPerformanceData {
  bacId: string;
  bacNom: string;
  // Growth metrics
  poidsMoyenActuel: number | null; // latest biometrie poidsMoyen
  poidsMoyenPrecedent: number | null; // previous biometrie poidsMoyen
  gmq: number | null; // (current - previous) / days between, in g/day
  nombreVivants: number;
  nombreInitial: number;
  biomasse: number; // poidsMoyenActuel * vivants / 1000 in kg
  tauxSurvie: number; // vivants / nombreInitial * 100
  // Feed metrics
  totalAlimentKg: number; // SUM of feed from ReleveConsommation converted to KG
  fcr: number | null; // totalAlimentKg / totalGainBiomasseKg (includes sold fish)
  // Cost metrics
  coutAliment: number; // SUM of ReleveConsommation quantities × getPrixParUniteBase
  coutParKgProduit: number | null; // coutAliment / totalGainBiomasseKg
  gainBiomasseKg: number; // (biomasse + soldBiomasseKg) - initialBiomasse
  soldBiomasseKg: number; // biomass of sold fish
  // Sparkline
  sparklineData: { jour: number; poidsMoyen: number }[]; // all biometrie points chronologically
  // Biometry period snapshots
  periodSnapshots: BiometryPeriodSnapshot[];
  // Meta
  derniereBiometrieDate: string | null; // ISO string (serializable across RSC boundary)
  rank: number; // 1 = best FCR
  rankLabel: string; // "#1" or "#2" etc. (no hardcoded French — component handles i18n)
}

export interface ConsommationInput {
  quantite: number;
  produit: {
    prixUnitaire: number;
    unite: string; // UniteStock
    uniteAchat?: string | null;
    contenance?: number | null;
  };
}

export interface ReleveInput {
  bacId: string | null;
  typeReleve: string;
  date: Date | string;
  poidsMoyen: number | null;
  nombreMorts: number | null;
  nombreCompte: number | null;
  nombreVendus: number | null;
  quantiteAliment: number | null;
  consommations: ConsommationInput[];
}

export interface VenteInput {
  poidsTotalKg: number;
  /** Per-bac VENTE relevés linked to this vente, with nombreVendus per bac */
  releveBacIds?: { bacId: string; nombreVendus: number }[];
}

export interface BacPerformanceInput {
  bacs: { id: string; nom: string; nombreInitial: number | null }[];
  releves: ReleveInput[];
  ventes: VenteInput[];
  nombreInitialVague: number;
  dateDebutVague: Date;
  poidsMoyenInitial: number;
  /** Override "now" for period snapshots (defaults to Date.now()). Useful for testing. */
  now?: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the feed cost for a single ReleveConsommation line.
 * Uses getPrixParUniteBase for correct price and convertirUniteStock for quantity.
 */
function computeConsommationCost(c: ConsommationInput): { costFcfa: number; quantiteKg: number } {
  const prixBase = getPrixParUniteBase(c.produit); // price per base unit
  const quantiteKg = convertirUniteStock(c.quantite, c.produit.unite, "KG", c.produit.contenance ?? 25);
  const quantiteKgSafe = quantiteKg ?? 0;
  // Cost = quantity in base unit × price per base unit
  // getPrixParUniteBase returns price per base unit (e.g. per KG)
  // We need quantity in base unit (the product's own unit) for cost
  // But for totalAlimentKg we need KG specifically
  const quantiteBase = c.quantite; // already in product's base unit
  const costFcfa = quantiteBase * prixBase;
  return { costFcfa, quantiteKg: quantiteKgSafe };
}

/**
 * Estimate weight of sold fish per bac using biometry data.
 * For each VENTE type releve on a bac, finds the latest biometry at or before the sale date.
 */
function computeSoldBiomassePerBac(
  bacId: string,
  releves: ReleveInput[],
  biometries: ReleveInput[],
  poidsMoyenInitial: number
): number {
  const venteReleves = releves.filter(
    (r) => r.bacId === bacId && r.typeReleve === "VENTE" && r.nombreVendus != null && r.nombreVendus > 0
  );

  if (venteReleves.length === 0) return 0;

  let totalSoldKg = 0;
  for (const vr of venteReleves) {
    const saleDateMs = new Date(vr.date).getTime();
    // Find the latest biometry at or before the sale date
    let weightAtSale = poidsMoyenInitial;
    for (const bio of biometries) {
      const bioDateMs = new Date(bio.date).getTime();
      if (bioDateMs <= saleDateMs && bio.poidsMoyen !== null) {
        weightAtSale = bio.poidsMoyen;
      }
    }
    totalSoldKg += ((vr.nombreVendus as number) * weightAtSale) / 1000;
  }

  return Math.round(totalSoldKg * 100) / 100;
}

// ── Main computation ─────────────────────────────────────────────────────────

/**
 * Compute per-bac performance metrics from a vague's releves.
 * Returns an array sorted by FCR ascending (null FCR goes last), with ranks assigned.
 */
export function computeBacPerformance(
  input: BacPerformanceInput
): BacPerformanceData[] {
  const { bacs, releves, nombreInitialVague, dateDebutVague, poidsMoyenInitial } = input;

  if (bacs.length === 0) return [];

  const vagueStartMs = dateDebutVague.getTime();

  // Compute vivants per bac using existing logic
  const vivantsByBac = computeVivantsByBac(bacs, releves, nombreInitialVague);

  // Pre-compute initial fish count per bac (mirrors computeVivantsByBac logic)
  const nombreInitialParBac = Math.floor(nombreInitialVague / bacs.length);
  const reste = nombreInitialVague - nombreInitialParBac * bacs.length;

  const results: Omit<BacPerformanceData, "rank" | "rankLabel">[] = bacs.map(
    (bac, idx) => {
      const isLastBac = idx === bacs.length - 1;
      const nombreInitialBac =
        bac.nombreInitial != null
          ? bac.nombreInitial
          : nombreInitialParBac + (isLastBac ? reste : 0);

      // Filter biometrie relevés for this bac, sorted by date asc
      const biometries = releves
        .filter(
          (r) =>
            r.bacId === bac.id &&
            r.typeReleve === "BIOMETRIE" &&
            r.poidsMoyen !== null
        )
        .sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      // Sparkline data
      const sparklineData = biometries.map((r) => {
        const dateMs = new Date(r.date).getTime();
        return {
          jour: Math.floor((dateMs - vagueStartMs) / 86400000),
          poidsMoyen: r.poidsMoyen as number,
        };
      });

      // Current and previous poidsMoyen
      const poidsMoyenActuel =
        biometries.length > 0
          ? (biometries[biometries.length - 1].poidsMoyen as number)
          : null;
      const poidsMoyenPrecedent =
        biometries.length > 1
          ? (biometries[biometries.length - 2].poidsMoyen as number)
          : null;

      // GMQ calculation
      let gmq: number | null = null;
      if (poidsMoyenActuel !== null) {
        if (biometries.length >= 2) {
          const prev = biometries[biometries.length - 2];
          const curr = biometries[biometries.length - 1];
          const daysBetween = Math.max(
            1,
            Math.floor(
              (new Date(curr.date).getTime() - new Date(prev.date).getTime()) /
                86400000
            )
          );
          gmq =
            Math.round(
              ((poidsMoyenActuel - (poidsMoyenPrecedent as number)) /
                daysBetween) *
                100
            ) / 100;
        } else if (biometries.length === 1) {
          // GMQ from initial weight since vague start
          const curr = biometries[0];
          const daysSinceStart = Math.max(
            1,
            Math.floor(
              (new Date(curr.date).getTime() - vagueStartMs) / 86400000
            )
          );
          gmq =
            Math.round(
              ((poidsMoyenActuel - poidsMoyenInitial) / daysSinceStart) * 100
            ) / 100;
        }
      }

      // Vivants
      const nombreVivants = vivantsByBac.get(bac.id) ?? nombreInitialBac;

      // Biomasse actuelle (vivants only — not including sold fish)
      const biomasse =
        poidsMoyenActuel !== null
          ? Math.round(((poidsMoyenActuel * nombreVivants) / 1000) * 100) / 100
          : Math.round(((poidsMoyenInitial * nombreVivants) / 1000) * 100) / 100;

      // Taux de survie
      const tauxSurvie =
        nombreInitialBac > 0
          ? Math.round((nombreVivants / nombreInitialBac) * 100 * 10) / 10
          : 0;

      // Initial biomasse
      const biomasseInitiale =
        Math.round(((poidsMoyenInitial * nombreInitialBac) / 1000) * 100) / 100;

      // Sold biomass — estimated from VENTE relevés × weight at time of sale
      const soldBiomasseKg = computeSoldBiomassePerBac(
        bac.id, releves, biometries, poidsMoyenInitial
      );

      // Total gain biomasse (includes sold fish)
      const gainBiomasseKg =
        Math.round((biomasse + soldBiomasseKg - biomasseInitiale) * 100) / 100;

      // ── Feed metrics from ReleveConsommation (with unit conversion) ─────────
      const alimentationReleves = releves.filter(
        (r) => r.bacId === bac.id && r.typeReleve === "ALIMENTATION"
      );

      let totalAlimentKg = 0;
      let coutAliment = 0;

      for (const rel of alimentationReleves) {
        if (rel.consommations.length > 0) {
          // Use ReleveConsommation data (precise per-product breakdown)
          for (const c of rel.consommations) {
            const { costFcfa, quantiteKg } = computeConsommationCost(c);
            totalAlimentKg += quantiteKg;
            coutAliment += costFcfa;
          }
        } else if (rel.quantiteAliment != null) {
          // Fallback: use Releve.quantiteAliment (assumed KG, no cost info)
          totalAlimentKg += rel.quantiteAliment;
        }
      }

      totalAlimentKg = Math.round(totalAlimentKg * 1000) / 1000;
      coutAliment = Math.round(coutAliment);

      // FCR — accounts for sold fish: totalFeed / (biomasse + soldBiomasse - initialBiomasse)
      const fcr =
        gainBiomasseKg > 0
          ? Math.round((totalAlimentKg / gainBiomasseKg) * 100) / 100
          : null;

      // Cost per kg produced
      const coutParKgProduit =
        gainBiomasseKg > 0
          ? Math.round((coutAliment / gainBiomasseKg) * 100) / 100
          : null;

      // Last biometry date
      const derniereBiometrieDate =
        biometries.length > 0
          ? new Date(biometries[biometries.length - 1].date).toISOString()
          : null;

      // ── Biometry period snapshots ───────────────────────────────────────────
      const periodSnapshots = computePeriodSnapshots(
        bac.id,
        biometries,
        releves,
        nombreInitialBac,
        poidsMoyenInitial,
        vagueStartMs,
        input.now
      );

      return {
        bacId: bac.id,
        bacNom: bac.nom,
        poidsMoyenActuel,
        poidsMoyenPrecedent,
        gmq,
        nombreVivants,
        nombreInitial: nombreInitialBac,
        biomasse,
        tauxSurvie,
        totalAlimentKg,
        fcr,
        coutAliment,
        coutParKgProduit,
        gainBiomasseKg,
        soldBiomasseKg,
        sparklineData,
        periodSnapshots,
        derniereBiometrieDate,
      };
    }
  );

  // Sort by FCR ascending, nulls last
  const sorted = [...results].sort((a, b) => {
    if (a.fcr === null && b.fcr === null) return 0;
    if (a.fcr === null) return 1;
    if (b.fcr === null) return -1;
    return a.fcr - b.fcr;
  });

  // Assign ranks — no hardcoded French, component handles i18n
  return sorted.map((item, idx) => {
    const rank = idx + 1;
    const rankLabel = `#${rank}`;
    return { ...item, rank, rankLabel };
  });
}

// ── Period snapshots computation ─────────────────────────────────────────────

/**
 * Build a map of date → comptage count for a bac.
 * COMPTAGE relevés linked to calibrages reset the fish count on that date.
 * We take the LAST comptage on each date (in case of duplicates).
 */
function buildComptageResets(
  bacId: string,
  allReleves: ReleveInput[]
): Map<number, number> {
  const resets = new Map<number, number>();
  // COMPTAGE relevés for this bac, sorted by date
  const comptages = allReleves
    .filter((r) => r.bacId === bacId && r.typeReleve === "COMPTAGE" && r.nombreCompte != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const c of comptages) {
    const dateMs = new Date(c.date).getTime();
    resets.set(dateMs, c.nombreCompte as number);
  }
  return resets;
}

function computePeriodSnapshots(
  bacId: string,
  biometries: ReleveInput[],
  allReleves: ReleveInput[],
  nombreInitialBac: number,
  poidsMoyenInitial: number,
  vagueStartMs: number,
  now?: Date
): BiometryPeriodSnapshot[] {
  if (biometries.length < 1) return [];

  const nowMs = (now ?? new Date()).getTime();
  const snapshots: BiometryPeriodSnapshot[] = [];

  // Build comptage reset map for this bac (dateMs → fish count)
  const comptageResets = buildComptageResets(bacId, allReleves);

  // Track cumulative vivants
  let cumulativeVivants = nombreInitialBac;

  // Helper: compute feed/mortality/sales in a date range (start exclusive, end inclusive)
  function computePeriodData(dateDebutMs: number, dateFinMs: number) {
    const periodAlimentReleves = allReleves.filter((r) => {
      if (r.bacId !== bacId || r.typeReleve !== "ALIMENTATION") return false;
      const rDateMs = new Date(r.date).getTime();
      return rDateMs > dateDebutMs && rDateMs <= dateFinMs;
    });

    let alimentKg = 0;
    let coutAlimentPeriode = 0;
    for (const rel of periodAlimentReleves) {
      if (rel.consommations.length > 0) {
        for (const c of rel.consommations) {
          const { costFcfa, quantiteKg } = computeConsommationCost(c);
          alimentKg += quantiteKg;
          coutAlimentPeriode += costFcfa;
        }
      } else if (rel.quantiteAliment != null) {
        alimentKg += rel.quantiteAliment;
      }
    }
    alimentKg = Math.round(alimentKg * 1000) / 1000;
    coutAlimentPeriode = Math.round(coutAlimentPeriode);

    const mortalites = allReleves
      .filter((r) => {
        if (r.bacId !== bacId || r.typeReleve !== "MORTALITE") return false;
        const rDateMs = new Date(r.date).getTime();
        return rDateMs > dateDebutMs && rDateMs <= dateFinMs;
      })
      .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);

    const soldInPeriod = allReleves
      .filter((r) => {
        if (r.bacId !== bacId || r.typeReleve !== "VENTE") return false;
        const rDateMs = new Date(r.date).getTime();
        return rDateMs > dateDebutMs && rDateMs <= dateFinMs;
      })
      .reduce((sum, r) => sum + (r.nombreVendus ?? 0), 0);

    return { alimentKg, coutAlimentPeriode, mortalites, soldInPeriod };
  }

  /**
   * Check if a comptage reset exists at or near a given date (same day).
   * Returns the reset count or null if no reset found.
   */
  function getResetAtDate(targetMs: number): number | null {
    // Check exact match first
    if (comptageResets.has(targetMs)) {
      return comptageResets.get(targetMs)!;
    }
    // Check same calendar day (comptage and biometry may have slightly different timestamps)
    const targetDay = new Date(targetMs).toISOString().slice(0, 10);
    for (const [dateMs, count] of comptageResets) {
      const resetDay = new Date(dateMs).toISOString().slice(0, 10);
      if (resetDay === targetDay) return count;
    }
    return null;
  }

  // Closed periods: between consecutive biometries
  for (let i = 0; i < biometries.length - 1; i++) {
    const bioStart = biometries[i];
    const bioEnd = biometries[i + 1];

    const dateDebutMs = new Date(bioStart.date).getTime();
    const dateFinMs = new Date(bioEnd.date).getTime();
    const dureeJours = Math.max(1, Math.floor((dateFinMs - dateDebutMs) / 86400000));

    const poidsMoyenDebut = bioStart.poidsMoyen as number;
    const poidsMoyenFin = bioEnd.poidsMoyen as number;
    const croissanceG = Math.round((poidsMoyenFin - poidsMoyenDebut) * 100) / 100;
    const gmq = Math.round((croissanceG / dureeJours) * 100) / 100;

    const { alimentKg, coutAlimentPeriode, mortalites, soldInPeriod } =
      computePeriodData(dateDebutMs, dateFinMs);

    // Determine vivants at the START of this period
    // Check if a comptage reset happened on the start date of this period
    const resetAtStart = getResetAtDate(dateDebutMs);
    if (resetAtStart !== null) {
      // Calibrage reset: use the comptage count as vivants at period start
      cumulativeVivants = resetAtStart;
    } else if (i === 0) {
      // First period: subtract all morts/sales up to and including the start date
      const mortsBeforeFirst = allReleves
        .filter((r) => {
          if (r.bacId !== bacId || r.typeReleve !== "MORTALITE") return false;
          return new Date(r.date).getTime() <= dateDebutMs;
        })
        .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
      const soldBeforeFirst = allReleves
        .filter((r) => {
          if (r.bacId !== bacId || r.typeReleve !== "VENTE") return false;
          return new Date(r.date).getTime() <= dateDebutMs;
        })
        .reduce((sum, r) => sum + (r.nombreVendus ?? 0), 0);
      cumulativeVivants = nombreInitialBac - mortsBeforeFirst - soldBeforeFirst;
    }

    const vivantsDebutFinal = cumulativeVivants;

    // Determine vivants at the END of this period
    // Check if a comptage reset happened on the end date
    const resetAtEnd = getResetAtDate(dateFinMs);
    if (resetAtEnd !== null) {
      // Calibrage at end: vivantsFin is the reset count
      cumulativeVivants = resetAtEnd;
    } else {
      cumulativeVivants = cumulativeVivants - mortalites - soldInPeriod;
    }
    const vivantsFin = cumulativeVivants;

    const biomasseDebut = Math.round(((poidsMoyenDebut * vivantsDebutFinal) / 1000) * 100) / 100;
    const biomasseFin = Math.round(((poidsMoyenFin * vivantsFin) / 1000) * 100) / 100;

    // A period "has calibrage" if fish were moved IN or OUT at the END of this period.
    // resetAtStart just means we start from a known post-calibrage count (previous period ended with a calibrage).
    const hasCalibrage = resetAtEnd !== null;

    // Period FCR: feed consumed / biomass gain (including sold fish weight)
    // Skip FCR for calibrage periods — biomass gain is distorted by fish transfers
    let fcrPeriode: number | null = null;
    if (!hasCalibrage) {
      const soldBiomassePeriod = allReleves
        .filter((r) => {
          if (r.bacId !== bacId || r.typeReleve !== "VENTE") return false;
          const rDateMs = new Date(r.date).getTime();
          return rDateMs > dateDebutMs && rDateMs <= dateFinMs;
        })
        .reduce((sum, r) => {
          return sum + ((r.nombreVendus ?? 0) * poidsMoyenFin) / 1000;
        }, 0);

      const gainBiomassePeriod = biomasseFin + soldBiomassePeriod - biomasseDebut;
      fcrPeriode =
        gainBiomassePeriod > 0 && alimentKg > 0
          ? Math.round((alimentKg / gainBiomassePeriod) * 100) / 100
          : null;
    }

    snapshots.push({
      periodIndex: i,
      dateDebut: new Date(bioStart.date).toISOString(),
      dateFin: new Date(bioEnd.date).toISOString(),
      dureeJours,
      enCours: false,
      hasCalibrage,
      poidsMoyenDebut,
      poidsMoyenFin,
      croissanceG,
      gmq,
      alimentKg,
      coutAlimentPeriode,
      mortalites,
      vivantsDebut: vivantsDebutFinal,
      vivantsFin,
      biomasseDebut,
      biomasseFin,
      fcrPeriode,
    });
  }

  // ── Open period: from last biometry to today ────────────────────────────────
  const lastBio = biometries[biometries.length - 1];
  const lastBioDateMs = new Date(lastBio.date).getTime();
  const dureeJoursEnCours = Math.max(1, Math.floor((nowMs - lastBioDateMs) / 86400000));

  // Only add the open period if at least 1 day has passed since the last biometry
  if (nowMs > lastBioDateMs) {
    const poidsMoyenDebut = lastBio.poidsMoyen as number;

    // Check if last biometry coincides with a comptage reset
    const resetAtLastBio = getResetAtDate(lastBioDateMs);
    if (resetAtLastBio !== null) {
      cumulativeVivants = resetAtLastBio;
    } else if (biometries.length === 1) {
      // Single biometry case: compute vivants at that point
      const mortsBeforeFirst = allReleves
        .filter((r) => {
          if (r.bacId !== bacId || r.typeReleve !== "MORTALITE") return false;
          return new Date(r.date).getTime() <= lastBioDateMs;
        })
        .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
      const soldBeforeFirst = allReleves
        .filter((r) => {
          if (r.bacId !== bacId || r.typeReleve !== "VENTE") return false;
          return new Date(r.date).getTime() <= lastBioDateMs;
        })
        .reduce((sum, r) => sum + (r.nombreVendus ?? 0), 0);
      cumulativeVivants = nombreInitialBac - mortsBeforeFirst - soldBeforeFirst;
    }

    const { alimentKg, coutAlimentPeriode, mortalites, soldInPeriod } =
      computePeriodData(lastBioDateMs, nowMs);

    const vivantsDebutEnCours = cumulativeVivants;
    const vivantsFinEnCours = cumulativeVivants - mortalites - soldInPeriod;

    const biomasseDebut = Math.round(((poidsMoyenDebut * vivantsDebutEnCours) / 1000) * 100) / 100;

    snapshots.push({
      periodIndex: snapshots.length,
      dateDebut: new Date(lastBio.date).toISOString(),
      dateFin: new Date(nowMs).toISOString(),
      dureeJours: dureeJoursEnCours,
      enCours: true,
      hasCalibrage: false, // open period starts from known state, no calibrage within
      poidsMoyenDebut,
      poidsMoyenFin: null,
      croissanceG: null,
      gmq: null,
      alimentKg,
      coutAlimentPeriode,
      mortalites,
      vivantsDebut: vivantsDebutEnCours,
      vivantsFin: vivantsFinEnCours,
      biomasseDebut,
      biomasseFin: null,
      fcrPeriode: null,
    });
  }

  return snapshots;
}
