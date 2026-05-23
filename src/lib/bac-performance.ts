/**
 * src/lib/bac-performance.ts
 *
 * Pure calculation functions for per-bac growth and cost performance metrics.
 * All functions are side-effect-free and testable.
 *
 * Sprint 12 — Story: Performance par Bac section on Vague Detail Page
 */

import { computeVivantsByBac } from "@/lib/calculs";

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
  totalAlimentKg: number; // SUM of ALIMENTATION relevés quantiteAliment for this bac
  fcr: number | null; // totalAlimentKg / gainBiomasseKg (null if no gain)
  // Cost metrics
  coutAliment: number; // SUM of ReleveConsommation quantities × product price
  coutParKgProduit: number | null; // coutAliment / gainBiomasseKg
  gainBiomasseKg: number; // current biomasse - initial biomasse
  // Sparkline
  sparklineData: { jour: number; poidsMoyen: number }[]; // all biometrie points chronologically
  // Meta
  derniereBiometrieDate: string | null; // ISO string (serializable across RSC boundary)
  rank: number; // 1 = best FCR
  rankLabel: string; // "#1 Meilleur FCR" or "#3" etc.
}

export interface BacPerformanceInput {
  bacs: { id: string; nom: string; nombreInitial: number | null }[];
  releves: {
    bacId: string | null;
    typeReleve: string;
    date: Date | string;
    poidsMoyen: number | null;
    nombreMorts: number | null;
    nombreCompte: number | null;
    nombreVendus: number | null;
    quantiteAliment: number | null;
    consommations: { quantite: number; produit: { prixUnitaire: number } }[];
  }[];
  nombreInitialVague: number;
  dateDebutVague: Date;
  poidsMoyenInitial: number;
}

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

      // Biomasse actuelle
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

      // Gain biomasse
      const gainBiomasseKg =
        Math.round((biomasse - biomasseInitiale) * 100) / 100;

      // Total aliment (kg) from ALIMENTATION relevés
      const totalAlimentKg = releves
        .filter(
          (r) => r.bacId === bac.id && r.typeReleve === "ALIMENTATION"
        )
        .reduce((sum, r) => sum + (r.quantiteAliment ?? 0), 0);

      // FCR
      const fcr =
        gainBiomasseKg > 0
          ? Math.round((totalAlimentKg / gainBiomasseKg) * 100) / 100
          : null;

      // Feed cost from consommations
      const coutAliment = releves
        .filter(
          (r) => r.bacId === bac.id && r.typeReleve === "ALIMENTATION"
        )
        .reduce(
          (sum, r) =>
            sum +
            r.consommations.reduce(
              (cs, c) => cs + c.quantite * c.produit.prixUnitaire,
              0
            ),
          0
        );

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
        sparklineData,
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

  // Assign ranks
  return sorted.map((item, idx) => {
    const rank = idx + 1;
    const rankLabel =
      rank === 1 && item.fcr !== null ? `#1 Meilleur FCR` : `#${rank}`;
    return { ...item, rank, rankLabel };
  });
}
