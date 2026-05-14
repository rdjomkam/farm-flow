/**
 * Helpers d'agrégation pour le rapport PDF de vague.
 *
 * Fonctions pures : aucun appel DB, aucun effet de bord.
 * Prennent les relevés bruts (RawReleve) et retournent les sections
 * structurées du DTO CreateRapportVaguePDFDTO.
 */

import type {
  EvolutionPoidsTableRow,
  MortalitySummaryPDF,
  FeedingSummaryPDF,
  WaterQualitySummaryPDF,
  WaterQualityMetricPDF,
  GompertzPDFSection,
} from "@/types/export";

// ---------------------------------------------------------------------------
// Type d'entrée brut (miroir des champs Prisma Releve)
// ---------------------------------------------------------------------------

export interface RawReleve {
  date: Date;
  typeReleve: string;
  poidsMoyen: number | null;
  tailleMoyenne: number | null;
  echantillonCount: number | null;
  nombreMorts: number | null;
  causeMortalite: string | null;
  quantiteAliment: number | null;
  typeAliment: string | null;
  frequenceAliment: number | null;
  temperature: number | null;
  ph: number | null;
  oxygene: number | null;
  ammoniac: number | null;
}

// ---------------------------------------------------------------------------
// Type paramètre Gompertz
// ---------------------------------------------------------------------------

export interface GompertzRecord {
  wInfinity: number;
  k: number;
  ti: number;
  r2: number;
  rmse: number;
  confidenceLevel: string;
}

// ---------------------------------------------------------------------------
// 1. buildEvolutionPoidsTable
// ---------------------------------------------------------------------------

/**
 * Construit le tableau d'évolution du poids à partir des relevés biométriques.
 *
 * - Filtre les relevés BIOMETRIE ayant un poidsMoyen non nul
 * - Calcule le nombre de jours depuis la date de début de la vague
 * - Trie par date ASC
 */
export function buildEvolutionPoidsTable(
  releves: RawReleve[],
  dateDebut: Date
): EvolutionPoidsTableRow[] {
  return releves
    .filter((r) => r.typeReleve === "BIOMETRIE" && r.poidsMoyen !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({
      date: r.date,
      jourDepuisDebut: Math.floor(
        (r.date.getTime() - dateDebut.getTime()) / 86400000
      ),
      poidsMoyen: r.poidsMoyen as number,
      tailleMoyenne: r.tailleMoyenne,
      echantillon: r.echantillonCount,
    }));
}

// ---------------------------------------------------------------------------
// 2. buildMortalitySummary
// ---------------------------------------------------------------------------

/**
 * Agrège les relevés de mortalité en un résumé.
 *
 * - Somme les nombreMorts (null traité comme 0)
 * - Calcule le taux de mortalité en pourcentage
 * - Retourne les causes triées par nombre d'occurrences DESC
 */
export function buildMortalitySummary(
  releves: RawReleve[],
  nombreInitial: number
): MortalitySummaryPDF {
  const mortaliteReleves = releves.filter((r) => r.typeReleve === "MORTALITE");

  const totalMorts = mortaliteReleves.reduce(
    (sum, r) => sum + (r.nombreMorts ?? 0),
    0
  );

  const tauxMortalite =
    nombreInitial > 0 ? (totalMorts / nombreInitial) * 100 : 0;

  // Compter les occurrences par cause
  const causeCount = new Map<string, number>();
  for (const r of mortaliteReleves) {
    const cause = r.causeMortalite ?? "INCONNUE";
    causeCount.set(cause, (causeCount.get(cause) ?? 0) + 1);
  }

  const topCauses = Array.from(causeCount.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count);

  return { totalMorts, tauxMortalite, topCauses };
}

// ---------------------------------------------------------------------------
// 3. buildFeedingSummary
// ---------------------------------------------------------------------------

/**
 * Agrège les relevés d'alimentation en un résumé.
 *
 * - Somme la quantité d'aliment totale
 * - Calcule la fréquence moyenne (null si aucune fréquence renseignée)
 * - Décompose par type d'aliment : count + total kg
 */
export function buildFeedingSummary(releves: RawReleve[]): FeedingSummaryPDF {
  const alimentReleves = releves.filter(
    (r) => r.typeReleve === "ALIMENTATION"
  );

  const totalAlimentKg = alimentReleves.reduce(
    (sum, r) => sum + (r.quantiteAliment ?? 0),
    0
  );

  // Moyenne de fréquence en ignorant les nulls
  const frequences = alimentReleves
    .map((r) => r.frequenceAliment)
    .filter((f): f is number => f !== null);

  const frequenceMoyenne =
    frequences.length > 0
      ? frequences.reduce((sum, f) => sum + f, 0) / frequences.length
      : null;

  // Grouper par type d'aliment
  const typeMap = new Map<string, { count: number; totalKg: number }>();
  for (const r of alimentReleves) {
    const type = r.typeAliment ?? "INCONNU";
    const existing = typeMap.get(type) ?? { count: 0, totalKg: 0 };
    typeMap.set(type, {
      count: existing.count + 1,
      totalKg: existing.totalKg + (r.quantiteAliment ?? 0),
    });
  }

  const typeBreakdown = Array.from(typeMap.entries()).map(
    ([type, { count, totalKg }]) => ({ type, count, totalKg })
  );

  return { totalAlimentKg, frequenceMoyenne, typeBreakdown };
}

// ---------------------------------------------------------------------------
// 4. buildWaterQualitySummary
// ---------------------------------------------------------------------------

/** Calcule avg/min/max pour un tableau de valeurs non nulles. */
function computeMetric(values: number[]): WaterQualityMetricPDF | null {
  if (values.length === 0) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return {
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Agrège les relevés de qualité d'eau en résumé min/avg/max par métrique.
 *
 * Retourne null pour une métrique si aucune valeur n'est renseignée.
 */
export function buildWaterQualitySummary(
  releves: RawReleve[]
): WaterQualitySummaryPDF {
  const eauReleves = releves.filter((r) => r.typeReleve === "QUALITE_EAU");

  const extract = (key: keyof RawReleve): number[] =>
    eauReleves
      .map((r) => r[key] as number | null)
      .filter((v): v is number => v !== null);

  return {
    temperature: computeMetric(extract("temperature")),
    ph: computeMetric(extract("ph")),
    oxygene: computeMetric(extract("oxygene")),
    ammoniac: computeMetric(extract("ammoniac")),
  };
}

// ---------------------------------------------------------------------------
// 5. buildGompertzSection
// ---------------------------------------------------------------------------

/** Formate une date en "dd/mm/yyyy". */
function formatDateFR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Construit la section Gompertz pour le PDF.
 *
 * - Retourne null si gompertz est null
 * - Calcule la date de récolte prédite si targetWeight < wInfinity
 *   en utilisant l'inverse de la fonction de Gompertz :
 *   t = ti - (1/k) * ln(-ln(targetWeight / wInfinity))
 */
export function buildGompertzSection(
  gompertz: GompertzRecord | null,
  dateDebut: Date,
  targetWeight: number | null
): GompertzPDFSection | null {
  if (!gompertz) return null;

  const { wInfinity, k, ti, r2, rmse, confidenceLevel } = gompertz;

  let predictedHarvestDate: string | null = null;

  if (targetWeight !== null && targetWeight < wInfinity && k > 0) {
    const ratio = targetWeight / wInfinity;
    // ratio must be in (0, 1) for a valid Gompertz inverse
    if (ratio > 0 && ratio < 1) {
      const t = ti - (1 / k) * Math.log(-Math.log(ratio));
      if (isFinite(t) && t >= 0) {
        const harvestDate = new Date(dateDebut.getTime() + t * 86400000);
        predictedHarvestDate = formatDateFR(harvestDate);
      }
    }
  }

  return {
    confidenceLevel,
    r2,
    rmse,
    wInfinity,
    k,
    ti,
    predictedHarvestDate,
    targetWeight,
  };
}
