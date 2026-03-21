/**
 * Benchmarks de reference pour Clarias gariepinus.
 *
 * Sources : FAO Manual on Catfish Production, ussec.org, aquaticed.com.
 * Utilises pour generer des alertes et colorer les indicateurs (vert/jaune/rouge).
 *
 * Phase 3 (Sprint 19) : Les seuils sont maintenant configurables via ConfigElevage.
 * Si un ConfigElevage est fourni, ses valeurs priment sur les constantes hardcodees.
 * Fallback vers les constantes si aucune config n'est fournie (EC-5.1).
 */

import type { ConfigElevage } from "@/types";

export type BenchmarkLevel = "EXCELLENT" | "BON" | "ACCEPTABLE" | "MAUVAIS";

export interface BenchmarkRange {
  label: string;
  unit: string;
  /** Seuils du meilleur vers le pire. */
  excellent: { min: number; max: number };
  bon: { min: number; max: number };
  acceptable: { min: number; max: number };
  /** Tout ce qui est hors acceptable est MAUVAIS. */
}

// ---------------------------------------------------------------------------
// Seuils hardcodes par defaut (fallback EC-5.1)
// ---------------------------------------------------------------------------

export const BENCHMARK_SURVIE: BenchmarkRange = {
  label: "Taux de survie",
  unit: "%",
  excellent: { min: 90, max: 100 },
  bon: { min: 85, max: 90 },
  acceptable: { min: 80, max: 85 },
};

export const BENCHMARK_FCR: BenchmarkRange = {
  // i18n: display as "ICA" (fr) / "FCR" (en) — use analytics.benchmarks.fcr.label in components
  label: "fcr",
  unit: "",
  // FCR: lower is better → excellent < bon < acceptable
  excellent: { min: 0, max: 1.5 },
  bon: { min: 1.5, max: 1.8 },
  acceptable: { min: 1.8, max: 2.2 },
};

export const BENCHMARK_SGR: BenchmarkRange = {
  // i18n: display as "TCS" (fr) / "SGR" (en) — use analytics.benchmarks.sgr.label in components
  label: "sgr",
  unit: "%/j",
  excellent: { min: 2, max: Infinity },
  bon: { min: 1.5, max: 2 },
  acceptable: { min: 1, max: 1.5 },
};

export const BENCHMARK_DENSITE: BenchmarkRange = {
  label: "Densite",
  unit: "kg/m\u00B3",
  // Lower density is better for Clarias — seuils en kg/m3 (ADR-density-alerts)
  excellent: { min: 0, max: 100 },
  bon: { min: 100, max: 150 },
  acceptable: { min: 150, max: 200 },
};

export const BENCHMARK_MORTALITE: BenchmarkRange = {
  label: "Mortalite",
  unit: "%",
  // Lower mortality is better
  excellent: { min: 0, max: 3 },
  bon: { min: 3, max: 5 },
  acceptable: { min: 5, max: 10 },
};

// ---------------------------------------------------------------------------
// Map par type d'alerte
// ---------------------------------------------------------------------------

export const BENCHMARKS = {
  survie: BENCHMARK_SURVIE,
  fcr: BENCHMARK_FCR,
  sgr: BENCHMARK_SGR,
  densite: BENCHMARK_DENSITE,
  mortalite: BENCHMARK_MORTALITE,
} as const;

export type BenchmarkKey = keyof typeof BENCHMARKS;

// ---------------------------------------------------------------------------
// Fonctions de construction de BenchmarkRange depuis ConfigElevage
// ---------------------------------------------------------------------------

/**
 * Construit le BenchmarkRange pour la survie depuis la config (ou fallback).
 * @param config - ConfigElevage optionnel — utilise les valeurs hardcodees si absent (EC-5.1)
 */
export function getBenchmarkSurvie(config?: ConfigElevage | null): BenchmarkRange {
  if (!config) return BENCHMARK_SURVIE;
  return {
    label: "Taux de survie",
    unit: "%",
    excellent: { min: config.survieExcellentMin, max: 100 },
    bon: { min: config.survieBonMin, max: config.survieExcellentMin },
    acceptable: { min: config.survieAcceptableMin, max: config.survieBonMin },
  };
}

/**
 * Construit le BenchmarkRange pour le FCR depuis la config (ou fallback).
 * FCR : lower is better.
 */
export function getBenchmarkFcr(config?: ConfigElevage | null): BenchmarkRange {
  if (!config) return BENCHMARK_FCR;
  return {
    label: "fcr",
    unit: "",
    excellent: { min: 0, max: config.fcrExcellentMax },
    bon: { min: config.fcrExcellentMax, max: config.fcrBonMax },
    acceptable: { min: config.fcrBonMax, max: config.fcrAcceptableMax },
  };
}

/**
 * Construit le BenchmarkRange pour le SGR depuis la config (ou fallback).
 * SGR : higher is better.
 */
export function getBenchmarkSgr(config?: ConfigElevage | null): BenchmarkRange {
  if (!config) return BENCHMARK_SGR;
  return {
    label: "sgr",
    unit: "%/j",
    excellent: { min: config.sgrExcellentMin, max: Infinity },
    bon: { min: config.sgrBonMin, max: config.sgrExcellentMin },
    acceptable: { min: config.sgrAcceptableMin, max: config.sgrBonMin },
  };
}

/**
 * Construit le BenchmarkRange pour la densite depuis la config (ou fallback).
 * Densite : lower is better.
 */
export function getBenchmarkDensite(config?: ConfigElevage | null): BenchmarkRange {
  if (!config) return BENCHMARK_DENSITE;
  return {
    label: "Densite",
    unit: "poissons/m\u00B3",
    excellent: { min: 0, max: config.densiteExcellentMax },
    bon: { min: config.densiteExcellentMax, max: config.densiteBonMax },
    acceptable: { min: config.densiteBonMax, max: config.densiteAcceptableMax },
  };
}

/**
 * Construit le BenchmarkRange pour la mortalite depuis la config (ou fallback).
 * Mortalite cumulative : lower is better.
 */
export function getBenchmarkMortalite(config?: ConfigElevage | null): BenchmarkRange {
  if (!config) return BENCHMARK_MORTALITE;
  return {
    label: "Mortalite",
    unit: "%",
    excellent: { min: 0, max: config.mortaliteExcellentMax },
    bon: { min: config.mortaliteExcellentMax, max: config.mortaliteBonMax },
    acceptable: { min: config.mortaliteBonMax, max: config.mortaliteAcceptableMax },
  };
}

/**
 * Retourne tous les benchmarks construits depuis la config (ou fallback).
 * Equivalent configurable de la constante BENCHMARKS.
 */
export function getBenchmarks(config?: ConfigElevage | null) {
  return {
    survie: getBenchmarkSurvie(config),
    fcr: getBenchmarkFcr(config),
    sgr: getBenchmarkSgr(config),
    densite: getBenchmarkDensite(config),
    mortalite: getBenchmarkMortalite(config),
  };
}

// ---------------------------------------------------------------------------
// Helper : evaluer un indicateur par rapport a un benchmark
// ---------------------------------------------------------------------------

/**
 * Evalue le niveau d'un indicateur par rapport au benchmark.
 *
 * Pour les metriques ou "plus bas = mieux" (FCR, mortalite, densite),
 * le benchmark encode deja les seuils dans le bon sens (excellent.max < bon.max).
 *
 * Le parametre config est optionnel : si fourni, les seuils de la config sont utilises.
 * Sinon, les constantes hardcodees sont utilisees (fallback EC-5.1, retrocompatibilite).
 *
 * @param value - Valeur a evaluer
 * @param benchmark - BenchmarkRange (peut etre obtenu via getBenchmark*() avec config)
 */
export function evaluerBenchmark(
  value: number | null,
  benchmark: BenchmarkRange
): BenchmarkLevel | null {
  if (value == null) return null;

  if (value >= benchmark.excellent.min && value <= benchmark.excellent.max) {
    return "EXCELLENT";
  }
  if (value >= benchmark.bon.min && value <= benchmark.bon.max) {
    return "BON";
  }
  if (value >= benchmark.acceptable.min && value <= benchmark.acceptable.max) {
    return "ACCEPTABLE";
  }
  return "MAUVAIS";
}

/**
 * Retourne la couleur Tailwind associee au niveau de benchmark.
 */
export function benchmarkColor(level: BenchmarkLevel | null): string {
  switch (level) {
    case "EXCELLENT":
      return "text-accent-green";
    case "BON":
      return "text-accent-emerald";
    case "ACCEPTABLE":
      return "text-accent-amber";
    case "MAUVAIS":
      return "text-accent-red";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Retourne la couleur de fond associee au niveau de benchmark.
 */
export function benchmarkBgColor(level: BenchmarkLevel | null): string {
  switch (level) {
    case "EXCELLENT":
      return "bg-accent-green-muted";
    case "BON":
      return "bg-accent-emerald-muted";
    case "ACCEPTABLE":
      return "bg-accent-amber-muted";
    case "MAUVAIS":
      return "bg-accent-red-muted";
    default:
      return "bg-muted";
  }
}
