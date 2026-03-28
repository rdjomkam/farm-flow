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
  label: "survie",
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
  label: "densite",
  unit: "poissons/m\u00B3",
  // Lower density is better for Clarias — seuils en poissons/m3
  excellent: { min: 0, max: 7 },
  bon: { min: 7, max: 10 },
  acceptable: { min: 10, max: 15 },
};

export const BENCHMARK_MORTALITE: BenchmarkRange = {
  label: "mortalite",
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
    label: "survie",
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
    label: "densite",
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
    label: "mortalite",
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

// ---------------------------------------------------------------------------
// PLAN-feed-analytics-v2 — FB.3 : Benchmarks par phase pour Clarias gariepinus
// ---------------------------------------------------------------------------

/**
 * Benchmarks FCR differencies par phase d'elevage.
 * Source : FAO / CIRAD Clarias gariepinus guidelines.
 * FCR : lower is better.
 */
export const BENCHMARK_FCR_PAR_PHASE: Record<
  string,
  { excellent: number; bon: number; acceptable: number }
> = {
  ACCLIMATATION:    { excellent: 1.2, bon: 1.5, acceptable: 2.0 },
  CROISSANCE_DEBUT: { excellent: 1.3, bon: 1.6, acceptable: 2.0 },
  JUVENILE:         { excellent: 1.4, bon: 1.8, acceptable: 2.2 },
  GROSSISSEMENT:    { excellent: 1.5, bon: 1.9, acceptable: 2.5 },
  FINITION:         { excellent: 1.6, bon: 2.0, acceptable: 2.8 },
  PRE_RECOLTE:      { excellent: 1.8, bon: 2.2, acceptable: 3.0 },
} as const;

/**
 * Benchmarks SGR differencies par phase.
 * SGR : higher is better. Valeurs en %/jour.
 */
export const BENCHMARK_SGR_PAR_PHASE: Record<
  string,
  { excellent: number; bon: number; acceptable: number }
> = {
  ACCLIMATATION:    { excellent: 4.0, bon: 3.0, acceptable: 2.0 },
  CROISSANCE_DEBUT: { excellent: 3.5, bon: 2.5, acceptable: 1.8 },
  JUVENILE:         { excellent: 3.0, bon: 2.0, acceptable: 1.5 },
  GROSSISSEMENT:    { excellent: 2.5, bon: 1.8, acceptable: 1.2 },
  FINITION:         { excellent: 2.0, bon: 1.5, acceptable: 1.0 },
  PRE_RECOLTE:      { excellent: 1.5, bon: 1.0, acceptable: 0.7 },
} as const;

/**
 * Benchmarks ADG (Average Daily Gain) par stade de poids.
 * Valeurs en g/jour.
 *
 * FRONTIERES : poidsMin inclusif, poidsMax exclusif.
 * Ex : fingerling couvre [0, 30[, juvenile couvre [30, 150[, etc.
 */
export const BENCHMARK_ADG_PAR_STADE: Record<
  string,
  { label: string; poidsMin: number; poidsMax: number; excellent: number; bon: number }
> = {
  fingerling: { label: "Fingerling (<30g)",     poidsMin: 0,   poidsMax: 30,       excellent: 1.5, bon: 1.0 },
  juvenile:   { label: "Juvenile (30-150g)",    poidsMin: 30,  poidsMax: 150,      excellent: 3.0, bon: 2.0 },
  subadulte:  { label: "Sub-adulte (150-400g)", poidsMin: 150, poidsMax: 400,      excellent: 5.0, bon: 3.5 },
  adulte:     { label: "Adulte (>=400g)",       poidsMin: 400, poidsMax: Infinity, excellent: 6.0, bon: 4.0 },
} as const;

/**
 * Benchmark DFR (Daily Feeding Rate) en % biomasse/jour.
 */
export const BENCHMARK_DFR_PAR_PHASE: Record<
  string,
  { min: number; max: number; optimal: number }
> = {
  ACCLIMATATION:    { min: 8,   max: 15, optimal: 10  },
  CROISSANCE_DEBUT: { min: 5,   max: 8,  optimal: 6   },
  JUVENILE:         { min: 3,   max: 5,  optimal: 4   },
  GROSSISSEMENT:    { min: 2,   max: 4,  optimal: 3   },
  FINITION:         { min: 1.5, max: 3,  optimal: 2   },
  PRE_RECOLTE:      { min: 1,   max: 2,  optimal: 1.5 },
} as const;

/**
 * Retourne les seuils FCR pour une phase donnee.
 */
export function getBenchmarkFCRPourPhase(phase: string | null): BenchmarkRange {
  if (!phase || !(phase in BENCHMARK_FCR_PAR_PHASE)) {
    return BENCHMARK_FCR;
  }
  const seuils = BENCHMARK_FCR_PAR_PHASE[phase];
  return {
    label: "fcr",
    unit: "",
    excellent: { min: 0, max: seuils.excellent },
    bon: { min: seuils.excellent, max: seuils.bon },
    acceptable: { min: seuils.bon, max: seuils.acceptable },
  };
}

/**
 * Retourne les seuils ADG pour un poids moyen donne.
 * Frontieres : poidsMin inclusif, poidsMax exclusif.
 */
export function getBenchmarkADGPourPoids(poidsMoyen: number | null): BenchmarkRange | null {
  if (poidsMoyen == null) return null;
  const stade = Object.values(BENCHMARK_ADG_PAR_STADE).find(
    (s) => poidsMoyen >= s.poidsMin && poidsMoyen < s.poidsMax
  );
  if (!stade) return null;
  return {
    label: "adg",
    unit: "g/j",
    excellent: { min: stade.excellent, max: Infinity },
    bon: { min: stade.bon, max: stade.excellent },
    acceptable: { min: 0, max: stade.bon },
  };
}
