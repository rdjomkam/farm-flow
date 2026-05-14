/**
 * Helpers d'agrégation pour le rapport PDF de vague.
 *
 * Fonctions pures : aucun appel DB, aucun effet de bord.
 * Prennent les relevés bruts (RawReleve) et retournent les sections
 * structurées du DTO CreateRapportVaguePDFDTO.
 */

import type {
  EvolutionPoidsTableRow,
  EvolutionPoidsMoyenRow,
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
  bacId: string | null;
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
// Bac info pour le calcul des vivants par bac à une date donnée
// ---------------------------------------------------------------------------

export interface BacInfo {
  id: string;
  nom: string;
  nombreInitial: number | null;
}

// ---------------------------------------------------------------------------
// 1. buildEvolutionPoidsTable (per-bac)
// ---------------------------------------------------------------------------

/**
 * Construit le tableau d'évolution du poids par bac.
 *
 * - Filtre les relevés BIOMETRIE ayant un poidsMoyen non nul
 * - Résout le nom du bac via bacNameMap
 * - Trie par date ASC puis nom de bac
 */
export function buildEvolutionPoidsTable(
  releves: RawReleve[],
  dateDebut: Date,
  bacNameMap: Map<string, string>
): EvolutionPoidsTableRow[] {
  return releves
    .filter((r) => r.typeReleve === "BIOMETRIE" && r.poidsMoyen !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({
      date: r.date,
      jourDepuisDebut: Math.floor(
        (r.date.getTime() - dateDebut.getTime()) / 86400000
      ),
      nomBac: (r.bacId && bacNameMap.get(r.bacId)) || "—",
      poidsMoyen: r.poidsMoyen as number,
      tailleMoyenne: r.tailleMoyenne,
      echantillon: r.echantillonCount,
    }));
}

// ---------------------------------------------------------------------------
// 1b. buildEvolutionPoidsMoyenTable (weighted avg across bacs + Gompertz)
// ---------------------------------------------------------------------------

/**
 * Calcule le poids prédit par le modèle de Gompertz à un jour donné.
 * W(t) = wInfinity * exp(-exp(-k * (t - ti)))
 */
function gompertzPredict(
  gompertz: GompertzRecord,
  jourDepuisDebut: number
): number {
  const { wInfinity, k, ti } = gompertz;
  return wInfinity * Math.exp(-Math.exp(-k * (jourDepuisDebut - ti)));
}

/**
 * Calcule le nombre de vivants par bac à une date donnée.
 * vivants = nombreInitial - sum(mortalités avant ou à cette date pour ce bac)
 */
function computeVivantsParBacAtDate(
  bacs: BacInfo[],
  releves: RawReleve[],
  nombreInitialVague: number,
  atDate: Date
): Map<string, number> {
  const nombreInitialParBac = bacs.length > 0
    ? Math.floor(nombreInitialVague / bacs.length)
    : nombreInitialVague;
  const reste = bacs.length > 0
    ? nombreInitialVague - nombreInitialParBac * bacs.length
    : 0;

  const result = new Map<string, number>();

  for (let idx = 0; idx < bacs.length; idx++) {
    const bac = bacs[idx];
    const isLast = idx === bacs.length - 1;
    const initialBac = bac.nombreInitial ?? (nombreInitialParBac + (isLast ? reste : 0));

    const mortsJusquaDate = releves
      .filter(
        (r) =>
          r.typeReleve === "MORTALITE" &&
          r.bacId === bac.id &&
          r.date.getTime() <= atDate.getTime()
      )
      .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);

    result.set(bac.id, Math.max(0, initialBac - mortsJusquaDate));
  }

  return result;
}

/**
 * Construit le tableau d'évolution du poids moyen pondéré par les vivants
 * à chaque date de biométrie, avec la prédiction Gompertz.
 *
 * Pour chaque date unique de biométrie :
 * 1. Calcule vivants par bac à cette date (initial - mortalités cumulées)
 * 2. Pondère les poids mesurés par bac : sum(poids_bac * vivants_bac) / sum(vivants_bac)
 * 3. Calcule le poids prédit Gompertz si le modèle est disponible
 */
export function buildEvolutionPoidsMoyenTable(
  releves: RawReleve[],
  bacs: BacInfo[],
  nombreInitialVague: number,
  dateDebut: Date,
  gompertz: GompertzRecord | null
): EvolutionPoidsMoyenRow[] {
  const biometries = releves
    .filter((r) => r.typeReleve === "BIOMETRIE" && r.poidsMoyen !== null && r.bacId !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const dateGroups = new Map<string, RawReleve[]>();
  for (const r of biometries) {
    const key = r.date.toISOString().slice(0, 10);
    const group = dateGroups.get(key) ?? [];
    group.push(r);
    dateGroups.set(key, group);
  }

  const rows: EvolutionPoidsMoyenRow[] = [];

  for (const [, group] of dateGroups) {
    const refDate = group[0].date;
    const jourDepuisDebut = Math.floor(
      (refDate.getTime() - dateDebut.getTime()) / 86400000
    );

    const vivantsMap = computeVivantsParBacAtDate(bacs, releves, nombreInitialVague, refDate);

    let totalPoidsWeighted = 0;
    let totalVivants = 0;

    for (const r of group) {
      const vivants = vivantsMap.get(r.bacId!) ?? 0;
      totalPoidsWeighted += (r.poidsMoyen as number) * vivants;
      totalVivants += vivants;
    }

    if (totalVivants === 0) continue;

    const poidsMoyenMesure = Math.round((totalPoidsWeighted / totalVivants) * 100) / 100;

    let poidsPreditGompertz: number | null = null;
    if (gompertz) {
      poidsPreditGompertz = Math.round(gompertzPredict(gompertz, jourDepuisDebut) * 100) / 100;
    }

    const ecart = poidsPreditGompertz !== null
      ? Math.round((poidsMoyenMesure - poidsPreditGompertz) * 100) / 100
      : null;

    rows.push({
      date: refDate,
      jourDepuisDebut,
      poidsMoyenMesure,
      poidsPreditGompertz,
      ecart,
    });
  }

  return rows;
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
  nombreInitial: number,
  calibrageMorts = 0
): MortalitySummaryPDF {
  const mortaliteReleves = releves.filter((r) => r.typeReleve === "MORTALITE");

  const mortsReleves = mortaliteReleves.reduce(
    (sum, r) => sum + (r.nombreMorts ?? 0),
    0
  );

  const totalMorts = mortsReleves + calibrageMorts;

  const tauxMortalite =
    nombreInitial > 0 ? (totalMorts / nombreInitial) * 100 : 0;

  const causeCount = new Map<string, number>();
  for (const r of mortaliteReleves) {
    const cause = r.causeMortalite ?? "INCONNUE";
    causeCount.set(cause, (causeCount.get(cause) ?? 0) + 1);
  }
  if (calibrageMorts > 0) {
    causeCount.set("CALIBRAGE", calibrageMorts);
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

  const frequences = alimentReleves
    .map((r) => r.frequenceAliment)
    .filter((f): f is number => f !== null);

  const frequenceMoyenne =
    frequences.length > 0
      ? frequences.reduce((sum, f) => sum + f, 0) / frequences.length
      : null;

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
