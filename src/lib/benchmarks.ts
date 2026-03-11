/**
 * Benchmarks de reference pour Clarias gariepinus.
 *
 * Sources : FAO Manual on Catfish Production, ussec.org, aquaticed.com.
 * Utilises pour generer des alertes et colorer les indicateurs (vert/jaune/rouge).
 */

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
// Seuils individuels
// ---------------------------------------------------------------------------

export const BENCHMARK_SURVIE: BenchmarkRange = {
  label: "Taux de survie",
  unit: "%",
  excellent: { min: 90, max: 100 },
  bon: { min: 85, max: 90 },
  acceptable: { min: 80, max: 85 },
};

export const BENCHMARK_FCR: BenchmarkRange = {
  label: "FCR",
  unit: "",
  // FCR: lower is better → excellent < bon < acceptable
  excellent: { min: 0, max: 1.5 },
  bon: { min: 1.5, max: 1.8 },
  acceptable: { min: 1.8, max: 2.2 },
};

export const BENCHMARK_SGR: BenchmarkRange = {
  label: "SGR",
  unit: "%/j",
  excellent: { min: 2, max: Infinity },
  bon: { min: 1.5, max: 2 },
  acceptable: { min: 1, max: 1.5 },
};

export const BENCHMARK_DENSITE: BenchmarkRange = {
  label: "Densite",
  unit: "poissons/m\u00B3",
  // Lower density is better for Clarias
  excellent: { min: 0, max: 7 },
  bon: { min: 7, max: 10 },
  acceptable: { min: 10, max: 15 },
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
// Helper : evaluer un indicateur par rapport a un benchmark
// ---------------------------------------------------------------------------

/**
 * Evalue le niveau d'un indicateur par rapport au benchmark.
 *
 * Pour les metriques ou "plus bas = mieux" (FCR, mortalite, densite),
 * le benchmark encode deja les seuils dans le bon sens (excellent.max < bon.max).
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
