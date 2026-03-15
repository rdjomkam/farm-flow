import { describe, it, expect } from "vitest";
import {
  evaluerBenchmark,
  benchmarkColor,
  benchmarkBgColor,
  getBenchmarks,
  BENCHMARK_SURVIE,
  BENCHMARK_FCR,
  BENCHMARK_SGR,
  BENCHMARK_MORTALITE,
  BENCHMARK_DENSITE,
} from "@/lib/benchmarks";

// ---------------------------------------------------------------------------
// evaluerBenchmark — Survie (higher is better)
// ---------------------------------------------------------------------------
describe("evaluerBenchmark — survie", () => {
  it("retourne EXCELLENT pour survie >= 90%", () => {
    expect(evaluerBenchmark(95, BENCHMARK_SURVIE)).toBe("EXCELLENT");
    expect(evaluerBenchmark(90, BENCHMARK_SURVIE)).toBe("EXCELLENT");
    expect(evaluerBenchmark(100, BENCHMARK_SURVIE)).toBe("EXCELLENT");
  });

  it("retourne BON pour survie entre 85% et 90%", () => {
    expect(evaluerBenchmark(87, BENCHMARK_SURVIE)).toBe("BON");
    expect(evaluerBenchmark(85, BENCHMARK_SURVIE)).toBe("BON");
  });

  it("retourne ACCEPTABLE pour survie entre 80% et 85%", () => {
    expect(evaluerBenchmark(82, BENCHMARK_SURVIE)).toBe("ACCEPTABLE");
    expect(evaluerBenchmark(80, BENCHMARK_SURVIE)).toBe("ACCEPTABLE");
  });

  it("retourne MAUVAIS pour survie < 80%", () => {
    expect(evaluerBenchmark(75, BENCHMARK_SURVIE)).toBe("MAUVAIS");
    expect(evaluerBenchmark(50, BENCHMARK_SURVIE)).toBe("MAUVAIS");
  });

  it("retourne null si la valeur est null", () => {
    expect(evaluerBenchmark(null, BENCHMARK_SURVIE)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluerBenchmark — FCR (lower is better)
// ---------------------------------------------------------------------------
describe("evaluerBenchmark — FCR", () => {
  it("retourne EXCELLENT pour FCR <= 1.5", () => {
    expect(evaluerBenchmark(1.2, BENCHMARK_FCR)).toBe("EXCELLENT");
    expect(evaluerBenchmark(1.5, BENCHMARK_FCR)).toBe("EXCELLENT");
    expect(evaluerBenchmark(0, BENCHMARK_FCR)).toBe("EXCELLENT");
  });

  it("retourne BON pour FCR entre 1.5 et 1.8", () => {
    expect(evaluerBenchmark(1.6, BENCHMARK_FCR)).toBe("BON");
    expect(evaluerBenchmark(1.8, BENCHMARK_FCR)).toBe("BON");
  });

  it("retourne ACCEPTABLE pour FCR entre 1.8 et 2.2", () => {
    expect(evaluerBenchmark(2.0, BENCHMARK_FCR)).toBe("ACCEPTABLE");
    expect(evaluerBenchmark(2.2, BENCHMARK_FCR)).toBe("ACCEPTABLE");
  });

  it("retourne MAUVAIS pour FCR > 2.2", () => {
    expect(evaluerBenchmark(2.5, BENCHMARK_FCR)).toBe("MAUVAIS");
    expect(evaluerBenchmark(3.0, BENCHMARK_FCR)).toBe("MAUVAIS");
  });
});

// ---------------------------------------------------------------------------
// evaluerBenchmark — SGR (higher is better)
// ---------------------------------------------------------------------------
describe("evaluerBenchmark — SGR", () => {
  it("retourne EXCELLENT pour SGR >= 2%/j", () => {
    expect(evaluerBenchmark(2.5, BENCHMARK_SGR)).toBe("EXCELLENT");
    expect(evaluerBenchmark(2.0, BENCHMARK_SGR)).toBe("EXCELLENT");
  });

  it("retourne BON pour SGR entre 1.5 et 2", () => {
    expect(evaluerBenchmark(1.7, BENCHMARK_SGR)).toBe("BON");
    expect(evaluerBenchmark(1.5, BENCHMARK_SGR)).toBe("BON");
  });

  it("retourne ACCEPTABLE pour SGR entre 1 et 1.5", () => {
    expect(evaluerBenchmark(1.2, BENCHMARK_SGR)).toBe("ACCEPTABLE");
    expect(evaluerBenchmark(1.0, BENCHMARK_SGR)).toBe("ACCEPTABLE");
  });

  it("retourne MAUVAIS pour SGR < 1%/j", () => {
    expect(evaluerBenchmark(0.5, BENCHMARK_SGR)).toBe("MAUVAIS");
    expect(evaluerBenchmark(0, BENCHMARK_SGR)).toBe("MAUVAIS");
  });
});

// ---------------------------------------------------------------------------
// evaluerBenchmark — Mortalite (lower is better)
// ---------------------------------------------------------------------------
describe("evaluerBenchmark — mortalite", () => {
  it("retourne EXCELLENT pour mortalite <= 3%", () => {
    expect(evaluerBenchmark(1, BENCHMARK_MORTALITE)).toBe("EXCELLENT");
    expect(evaluerBenchmark(3, BENCHMARK_MORTALITE)).toBe("EXCELLENT");
    expect(evaluerBenchmark(0, BENCHMARK_MORTALITE)).toBe("EXCELLENT");
  });

  it("retourne BON pour mortalite entre 3 et 5%", () => {
    expect(evaluerBenchmark(4, BENCHMARK_MORTALITE)).toBe("BON");
    expect(evaluerBenchmark(5, BENCHMARK_MORTALITE)).toBe("BON");
  });

  it("retourne ACCEPTABLE pour mortalite entre 5 et 10%", () => {
    expect(evaluerBenchmark(7, BENCHMARK_MORTALITE)).toBe("ACCEPTABLE");
    expect(evaluerBenchmark(10, BENCHMARK_MORTALITE)).toBe("ACCEPTABLE");
  });

  it("retourne MAUVAIS pour mortalite > 10%", () => {
    expect(evaluerBenchmark(12, BENCHMARK_MORTALITE)).toBe("MAUVAIS");
    expect(evaluerBenchmark(25, BENCHMARK_MORTALITE)).toBe("MAUVAIS");
  });
});

// ---------------------------------------------------------------------------
// evaluerBenchmark — Densite (lower is better)
// ---------------------------------------------------------------------------
describe("evaluerBenchmark — densite", () => {
  it("retourne EXCELLENT pour densite <= 7 poissons/m3", () => {
    expect(evaluerBenchmark(5, BENCHMARK_DENSITE)).toBe("EXCELLENT");
    expect(evaluerBenchmark(7, BENCHMARK_DENSITE)).toBe("EXCELLENT");
    expect(evaluerBenchmark(0, BENCHMARK_DENSITE)).toBe("EXCELLENT");
  });

  it("retourne BON pour densite entre 7 et 10", () => {
    expect(evaluerBenchmark(8, BENCHMARK_DENSITE)).toBe("BON");
    expect(evaluerBenchmark(10, BENCHMARK_DENSITE)).toBe("BON");
  });

  it("retourne ACCEPTABLE pour densite entre 10 et 15", () => {
    expect(evaluerBenchmark(12, BENCHMARK_DENSITE)).toBe("ACCEPTABLE");
    expect(evaluerBenchmark(15, BENCHMARK_DENSITE)).toBe("ACCEPTABLE");
  });

  it("retourne MAUVAIS pour densite > 15 poissons/m3", () => {
    expect(evaluerBenchmark(20, BENCHMARK_DENSITE)).toBe("MAUVAIS");
    expect(evaluerBenchmark(50, BENCHMARK_DENSITE)).toBe("MAUVAIS");
  });
});

// ---------------------------------------------------------------------------
// benchmarkColor
// ---------------------------------------------------------------------------
describe("benchmarkColor", () => {
  it("retourne text-accent-green pour EXCELLENT", () => {
    expect(benchmarkColor("EXCELLENT")).toBe("text-accent-green");
  });

  it("retourne text-accent-emerald pour BON", () => {
    expect(benchmarkColor("BON")).toBe("text-accent-emerald");
  });

  it("retourne text-accent-amber pour ACCEPTABLE", () => {
    expect(benchmarkColor("ACCEPTABLE")).toBe("text-accent-amber");
  });

  it("retourne text-accent-red pour MAUVAIS", () => {
    expect(benchmarkColor("MAUVAIS")).toBe("text-accent-red");
  });

  it("retourne text-muted-foreground pour null", () => {
    expect(benchmarkColor(null)).toBe("text-muted-foreground");
  });
});

// ---------------------------------------------------------------------------
// benchmarkBgColor
// ---------------------------------------------------------------------------
describe("benchmarkBgColor", () => {
  it("retourne bg-accent-green-muted pour EXCELLENT", () => {
    expect(benchmarkBgColor("EXCELLENT")).toBe("bg-accent-green-muted");
  });

  it("retourne bg-accent-emerald-muted pour BON", () => {
    expect(benchmarkBgColor("BON")).toBe("bg-accent-emerald-muted");
  });

  it("retourne bg-accent-amber-muted pour ACCEPTABLE", () => {
    expect(benchmarkBgColor("ACCEPTABLE")).toBe("bg-accent-amber-muted");
  });

  it("retourne bg-accent-red-muted pour MAUVAIS", () => {
    expect(benchmarkBgColor("MAUVAIS")).toBe("bg-accent-red-muted");
  });

  it("retourne bg-muted pour null", () => {
    expect(benchmarkBgColor(null)).toBe("bg-muted");
  });
});

// ---------------------------------------------------------------------------
// getBenchmarks — fallback sans config
// ---------------------------------------------------------------------------
describe("getBenchmarks — sans config", () => {
  it("retourne les benchmarks hardcodes par defaut si config est null", () => {
    const benchmarks = getBenchmarks(null);
    expect(benchmarks.survie).toEqual(BENCHMARK_SURVIE);
    expect(benchmarks.fcr).toEqual(BENCHMARK_FCR);
    expect(benchmarks.sgr).toEqual(BENCHMARK_SGR);
    expect(benchmarks.mortalite).toEqual(BENCHMARK_MORTALITE);
    expect(benchmarks.densite).toEqual(BENCHMARK_DENSITE);
  });

  it("retourne les benchmarks hardcodes par defaut si config est undefined", () => {
    const benchmarks = getBenchmarks(undefined);
    expect(benchmarks.survie.excellent.min).toBe(90);
    expect(benchmarks.fcr.excellent.max).toBe(1.5);
    expect(benchmarks.sgr.excellent.min).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getBenchmarks — avec config personnalisee
// ---------------------------------------------------------------------------
describe("getBenchmarks — avec config personnalisee", () => {
  const configPersonnalisee = {
    survieExcellentMin: 92,
    survieBonMin: 87,
    survieAcceptableMin: 82,
    fcrExcellentMax: 1.3,
    fcrBonMax: 1.6,
    fcrAcceptableMax: 2.0,
    sgrExcellentMin: 2.2,
    sgrBonMin: 1.7,
    sgrAcceptableMin: 1.2,
    densiteExcellentMax: 6,
    densiteBonMax: 9,
    densiteAcceptableMax: 13,
    mortaliteExcellentMax: 2,
    mortaliteBonMax: 4,
    mortaliteAcceptableMax: 8,
  } as unknown as import("@/types").ConfigElevage;

  it("utilise les seuils de survie de la config", () => {
    const benchmarks = getBenchmarks(configPersonnalisee);
    expect(benchmarks.survie.excellent.min).toBe(92);
    expect(benchmarks.survie.bon.min).toBe(87);
    expect(benchmarks.survie.acceptable.min).toBe(82);
  });

  it("utilise les seuils FCR de la config", () => {
    const benchmarks = getBenchmarks(configPersonnalisee);
    expect(benchmarks.fcr.excellent.max).toBe(1.3);
    expect(benchmarks.fcr.bon.max).toBe(1.6);
    expect(benchmarks.fcr.acceptable.max).toBe(2.0);
  });

  it("evaluerBenchmark utilise les seuils personnalises", () => {
    const benchmarks = getBenchmarks(configPersonnalisee);
    // Avec seuil survie excellent a 92%, 91% ne sera que BON
    expect(evaluerBenchmark(91, benchmarks.survie)).toBe("BON");
    // Avec seuil survie excellent a 92%, 93% sera EXCELLENT
    expect(evaluerBenchmark(93, benchmarks.survie)).toBe("EXCELLENT");
  });
});
