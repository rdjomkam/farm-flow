/**
 * Tests des fonctions de benchmark Feed Analytics (Sprint FB).
 *
 * Fonctions testees :
 *   - getBenchmarkFCRPourPhase : seuils FCR differencies par phase d'elevage
 *   - getBenchmarkADGPourPoids : seuils ADG selon le stade de poids
 */

import { describe, it, expect } from "vitest";
import {
  getBenchmarkFCRPourPhase,
  getBenchmarkADGPourPoids,
  BENCHMARK_FCR,
  BENCHMARK_FCR_PAR_PHASE,
  BENCHMARK_ADG_PAR_STADE,
} from "@/lib/benchmarks";

// ---------------------------------------------------------------------------
// getBenchmarkFCRPourPhase
// ---------------------------------------------------------------------------
describe("getBenchmarkFCRPourPhase", () => {
  it("phase valide GROSSISSEMENT → retourne les seuils de la phase GROSSISSEMENT", () => {
    const benchmark = getBenchmarkFCRPourPhase("GROSSISSEMENT");
    expect(benchmark).not.toBeNull();
    expect(benchmark.label).toBe("fcr");
    // Seuils issus de BENCHMARK_FCR_PAR_PHASE.GROSSISSEMENT
    const seuilsAttendus = BENCHMARK_FCR_PAR_PHASE["GROSSISSEMENT"];
    expect(benchmark.excellent.max).toBe(seuilsAttendus.excellent);
    expect(benchmark.bon.max).toBe(seuilsAttendus.bon);
    expect(benchmark.acceptable.max).toBe(seuilsAttendus.acceptable);
  });

  it("phase ACCLIMATATION → retourne seuils ACCLIMATATION", () => {
    const benchmark = getBenchmarkFCRPourPhase("ACCLIMATATION");
    const seuils = BENCHMARK_FCR_PAR_PHASE["ACCLIMATATION"];
    expect(benchmark.excellent.max).toBe(seuils.excellent);  // 1.2
    expect(benchmark.bon.max).toBe(seuils.bon);               // 1.5
    expect(benchmark.acceptable.max).toBe(seuils.acceptable); // 2.0
  });

  it("phase JUVENILE → retourne seuils JUVENILE", () => {
    const benchmark = getBenchmarkFCRPourPhase("JUVENILE");
    const seuils = BENCHMARK_FCR_PAR_PHASE["JUVENILE"];
    expect(benchmark.excellent.max).toBe(seuils.excellent);
    expect(benchmark.bon.max).toBe(seuils.bon);
    expect(benchmark.acceptable.max).toBe(seuils.acceptable);
  });

  it("phase FINITION → retourne seuils FINITION", () => {
    const benchmark = getBenchmarkFCRPourPhase("FINITION");
    const seuils = BENCHMARK_FCR_PAR_PHASE["FINITION"];
    expect(benchmark.excellent.max).toBe(seuils.excellent);  // 1.6
    expect(benchmark.bon.max).toBe(seuils.bon);              // 2.0
    expect(benchmark.acceptable.max).toBe(seuils.acceptable);// 2.8
  });

  it("phase PRE_RECOLTE → retourne seuils PRE_RECOLTE", () => {
    const benchmark = getBenchmarkFCRPourPhase("PRE_RECOLTE");
    const seuils = BENCHMARK_FCR_PAR_PHASE["PRE_RECOLTE"];
    expect(benchmark.excellent.max).toBe(seuils.excellent);
    expect(benchmark.acceptable.max).toBe(seuils.acceptable);
  });

  it("phase null → retourne BENCHMARK_FCR par defaut", () => {
    const benchmark = getBenchmarkFCRPourPhase(null);
    expect(benchmark).toEqual(BENCHMARK_FCR);
  });

  it("phase vide '' → retourne BENCHMARK_FCR par defaut", () => {
    const benchmark = getBenchmarkFCRPourPhase("");
    expect(benchmark).toEqual(BENCHMARK_FCR);
  });

  it("phase invalide 'PHASE_INCONNUE' → retourne BENCHMARK_FCR par defaut", () => {
    const benchmark = getBenchmarkFCRPourPhase("PHASE_INCONNUE");
    expect(benchmark).toEqual(BENCHMARK_FCR);
  });

  it("phase invalide en minuscules 'grossissement' → retourne BENCHMARK_FCR par defaut", () => {
    // Les phases sont en MAJUSCULES dans BENCHMARK_FCR_PAR_PHASE
    const benchmark = getBenchmarkFCRPourPhase("grossissement");
    expect(benchmark).toEqual(BENCHMARK_FCR);
  });

  it("structure du BenchmarkRange retourne est correcte (label, unit, excellent, bon, acceptable)", () => {
    const benchmark = getBenchmarkFCRPourPhase("GROSSISSEMENT");
    expect(benchmark).toHaveProperty("label", "fcr");
    expect(benchmark).toHaveProperty("unit", "");
    expect(benchmark).toHaveProperty("excellent");
    expect(benchmark).toHaveProperty("bon");
    expect(benchmark).toHaveProperty("acceptable");
    expect(benchmark.excellent).toHaveProperty("min");
    expect(benchmark.excellent).toHaveProperty("max");
  });

  it("excellent.min = 0 (FCR ne peut pas etre negatif)", () => {
    const benchmark = getBenchmarkFCRPourPhase("JUVENILE");
    expect(benchmark.excellent.min).toBe(0);
  });

  it("les seuils sont croissants (excellent < bon < acceptable pour FCR lower-is-better)", () => {
    const benchmark = getBenchmarkFCRPourPhase("GROSSISSEMENT");
    expect(benchmark.excellent.max).toBeLessThan(benchmark.bon.max);
    expect(benchmark.bon.max).toBeLessThan(benchmark.acceptable.max);
  });
});

// ---------------------------------------------------------------------------
// getBenchmarkADGPourPoids
// ---------------------------------------------------------------------------
describe("getBenchmarkADGPourPoids", () => {
  it("poids 15g → fingerling (boundary : < 30g)", () => {
    const benchmark = getBenchmarkADGPourPoids(15);
    expect(benchmark).not.toBeNull();
    // fingerling : poidsMin=0, poidsMax=30
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.fingerling.excellent);
    expect(benchmark!.bon.min).toBe(BENCHMARK_ADG_PAR_STADE.fingerling.bon);
  });

  it("poids 0g → fingerling (valeur minimale)", () => {
    const benchmark = getBenchmarkADGPourPoids(0);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.fingerling.excellent);
  });

  it("poids 29.9g → fingerling (boundary exclusive : < 30g, donc fingerling)", () => {
    const benchmark = getBenchmarkADGPourPoids(29.9);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.fingerling.excellent);
    expect(benchmark!.bon.min).toBe(BENCHMARK_ADG_PAR_STADE.fingerling.bon);
  });

  it("poids 30g → juvenile (boundary : >= 30g, poidsMax juvenile = 150)", () => {
    const benchmark = getBenchmarkADGPourPoids(30);
    expect(benchmark).not.toBeNull();
    // juvenile : poidsMin=30 (inclusif), poidsMax=150 (exclusif)
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.juvenile.excellent);
    expect(benchmark!.bon.min).toBe(BENCHMARK_ADG_PAR_STADE.juvenile.bon);
  });

  it("poids 100g → juvenile (milieu de la plage [30, 150[)", () => {
    const benchmark = getBenchmarkADGPourPoids(100);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.juvenile.excellent);
  });

  it("poids 149.9g → juvenile (boundary haute exclusive < 150)", () => {
    const benchmark = getBenchmarkADGPourPoids(149.9);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.juvenile.excellent);
  });

  it("poids 150g → subadulte (boundary : >= 150, poidsMax subadulte = 400)", () => {
    const benchmark = getBenchmarkADGPourPoids(150);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.subadulte.excellent);
    expect(benchmark!.bon.min).toBe(BENCHMARK_ADG_PAR_STADE.subadulte.bon);
  });

  it("poids 300g → subadulte (milieu de la plage [150, 400[)", () => {
    const benchmark = getBenchmarkADGPourPoids(300);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.subadulte.excellent);
  });

  it("poids 399.9g → subadulte (boundary haute exclusive < 400)", () => {
    const benchmark = getBenchmarkADGPourPoids(399.9);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.subadulte.excellent);
  });

  it("poids 400g → adulte (boundary : >= 400)", () => {
    const benchmark = getBenchmarkADGPourPoids(400);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.adulte.excellent);
    expect(benchmark!.bon.min).toBe(BENCHMARK_ADG_PAR_STADE.adulte.bon);
  });

  it("poids 800g → adulte (silure en finition)", () => {
    const benchmark = getBenchmarkADGPourPoids(800);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.min).toBe(BENCHMARK_ADG_PAR_STADE.adulte.excellent);
  });

  it("poids null → null", () => {
    expect(getBenchmarkADGPourPoids(null)).toBeNull();
  });

  it("structure BenchmarkRange correcte (label=adg, unit=g/j)", () => {
    const benchmark = getBenchmarkADGPourPoids(100);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.label).toBe("adg");
    expect(benchmark!.unit).toBe("g/j");
    expect(benchmark!.excellent).toHaveProperty("min");
    expect(benchmark!.excellent).toHaveProperty("max");
    expect(benchmark!.bon).toHaveProperty("min");
    expect(benchmark!.bon).toHaveProperty("max");
    expect(benchmark!.acceptable).toHaveProperty("min");
    expect(benchmark!.acceptable).toHaveProperty("max");
  });

  it("excellent.max = Infinity (ADG : higher is better, pas de plafond)", () => {
    const benchmark = getBenchmarkADGPourPoids(50);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.excellent.max).toBe(Infinity);
  });

  it("acceptable.min = 0 (tout ADG positif en dessous de bon est acceptable)", () => {
    const benchmark = getBenchmarkADGPourPoids(50);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.acceptable.min).toBe(0);
  });

  it("seuils croissants pour ADG higher-is-better : acceptable < bon < excellent", () => {
    const benchmark = getBenchmarkADGPourPoids(200);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.bon.min).toBeLessThan(benchmark!.excellent.min);
    expect(benchmark!.acceptable.min).toBeLessThan(benchmark!.bon.min);
  });
});
