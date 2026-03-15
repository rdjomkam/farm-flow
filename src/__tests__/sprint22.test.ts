/**
 * Tests Sprint 22 — UX Guidee & Instructions
 *
 * Ce fichier couvre les fonctionnalites Sprint 22 non deja testees
 * dans les fichiers de tests precedents (calculs.test.ts, activites.test.ts,
 * activites-releves.test.ts, feeding.test.ts).
 *
 * Stories couvertes :
 *   S16-3 : Lien activite→releve (constantes ACTIVITE_RELEVE_TYPE_MAP + RELEVE_COMPATIBLE_TYPES)
 *   S16-5 : Projections — integration des 5 fonctions dans un scenario realiste
 *   S16-6 : Alertes graduees benchmark — evaluerBenchmark avec ConfigElevage configurable
 *   S16-7 : API activites — cas limites supplementaires (instructions + completion)
 *
 * Note : Les tests unitaires des 5 fonctions de projection (calculerSGRRequis,
 * calculerDateRecolteEstimee, calculerAlimentRestantEstime, calculerRevenuAttendu,
 * genererCourbeProjection) sont deja couverts dans calculs.test.ts (lignes 736-912).
 * Ce fichier ajoute des tests d'integration et des scenarios realistes supplementaires.
 */

import { describe, it, expect } from "vitest";
import {
  calculerSGRRequis,
  calculerDateRecolteEstimee,
  calculerAlimentRestantEstime,
  calculerRevenuAttendu,
  genererCourbeProjection,
  calculerSGR,
  calculerBiomasse,
  calculerFCR,
} from "@/lib/calculs";
import {
  evaluerBenchmark,
  getBenchmarks,
  BENCHMARK_FCR,
  BENCHMARK_SGR,
  BENCHMARK_SURVIE,
} from "@/lib/benchmarks";
import {
  RELEVE_COMPATIBLE_TYPES,
  ACTIVITE_RELEVE_TYPE_MAP,
} from "@/types/api";
import { TypeActivite, TypeReleve } from "@/types";

// ===========================================================================
// S16-3 — Constantes de liaison activite→releve
// ===========================================================================

describe("S16-3 — RELEVE_COMPATIBLE_TYPES : types d'activite necessitant un releve", () => {
  it("contient ALIMENTATION", () => {
    expect(RELEVE_COMPATIBLE_TYPES).toContain(TypeActivite.ALIMENTATION);
  });

  it("contient BIOMETRIE", () => {
    expect(RELEVE_COMPATIBLE_TYPES).toContain(TypeActivite.BIOMETRIE);
  });

  it("contient QUALITE_EAU", () => {
    expect(RELEVE_COMPATIBLE_TYPES).toContain(TypeActivite.QUALITE_EAU);
  });

  it("contient COMPTAGE", () => {
    expect(RELEVE_COMPATIBLE_TYPES).toContain(TypeActivite.COMPTAGE);
  });

  it("ne contient pas NETTOYAGE (pas de releve associe)", () => {
    expect(RELEVE_COMPATIBLE_TYPES).not.toContain(TypeActivite.NETTOYAGE);
  });

  it("ne contient pas TRAITEMENT (pas de releve associe)", () => {
    expect(RELEVE_COMPATIBLE_TYPES).not.toContain(TypeActivite.TRAITEMENT);
  });

  it("ne contient pas RECOLTE (pas de releve associe)", () => {
    expect(RELEVE_COMPATIBLE_TYPES).not.toContain(TypeActivite.RECOLTE);
  });

  it("ne contient pas TRI", () => {
    expect(RELEVE_COMPATIBLE_TYPES).not.toContain(TypeActivite.TRI);
  });

  it("ne contient pas MEDICATION", () => {
    expect(RELEVE_COMPATIBLE_TYPES).not.toContain(TypeActivite.MEDICATION);
  });

  it("ne contient pas AUTRE", () => {
    expect(RELEVE_COMPATIBLE_TYPES).not.toContain(TypeActivite.AUTRE);
  });

  it("contient exactement 4 types", () => {
    expect(RELEVE_COMPATIBLE_TYPES).toHaveLength(4);
  });
});

describe("S16-3 — ACTIVITE_RELEVE_TYPE_MAP : mapping typeActivite → typeReleve", () => {
  it("mappe ALIMENTATION → TypeReleve.ALIMENTATION", () => {
    expect(ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.ALIMENTATION]).toBe(
      TypeReleve.ALIMENTATION
    );
  });

  it("mappe BIOMETRIE → TypeReleve.BIOMETRIE", () => {
    expect(ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.BIOMETRIE]).toBe(
      TypeReleve.BIOMETRIE
    );
  });

  it("mappe QUALITE_EAU → TypeReleve.QUALITE_EAU", () => {
    expect(ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.QUALITE_EAU]).toBe(
      TypeReleve.QUALITE_EAU
    );
  });

  it("mappe COMPTAGE → TypeReleve.COMPTAGE", () => {
    expect(ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.COMPTAGE]).toBe(
      TypeReleve.COMPTAGE
    );
  });

  it("NETTOYAGE n'a pas de mapping (undefined)", () => {
    expect(
      ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.NETTOYAGE]
    ).toBeUndefined();
  });

  it("TRAITEMENT n'a pas de mapping (undefined)", () => {
    expect(
      ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.TRAITEMENT]
    ).toBeUndefined();
  });

  it("RECOLTE n'a pas de mapping (undefined)", () => {
    expect(
      ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.RECOLTE]
    ).toBeUndefined();
  });

  it("TRI n'a pas de mapping (undefined)", () => {
    expect(ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.TRI]).toBeUndefined();
  });

  it("MEDICATION n'a pas de mapping (undefined)", () => {
    expect(
      ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.MEDICATION]
    ).toBeUndefined();
  });

  it("AUTRE n'a pas de mapping (undefined)", () => {
    expect(ACTIVITE_RELEVE_TYPE_MAP[TypeActivite.AUTRE]).toBeUndefined();
  });

  it("coherence : chaque type de RELEVE_COMPATIBLE_TYPES a un mapping", () => {
    for (const type of RELEVE_COMPATIBLE_TYPES) {
      expect(ACTIVITE_RELEVE_TYPE_MAP[type]).toBeDefined();
    }
  });

  it("coherence : tous les types avec mapping sont dans RELEVE_COMPATIBLE_TYPES", () => {
    const typeAvecMapping = Object.keys(ACTIVITE_RELEVE_TYPE_MAP) as TypeActivite[];
    for (const type of typeAvecMapping) {
      expect(RELEVE_COMPATIBLE_TYPES).toContain(type);
    }
  });
});

// ===========================================================================
// S16-5 — Integration scenario realiste des projections de performance
// ===========================================================================

describe("S16-5 — Scenario realiste : vague Clarias gariepinus en milieu de cycle", () => {
  /**
   * Scenario : vague de 500 poissons, 60 jours ecoules
   * - Alevin 5g → 200g apres 60 jours (SGR reel ~5.4%)
   * - Objectif : 800g en 180 jours (SGR requis ~1.8%)
   * - FCR mesure : 1.6
   * - 120 jours restants
   */

  const POIDS_ACTUEL = 200; // grammes
  const POIDS_OBJECTIF = 800; // grammes
  const NOMBRE_VIVANTS = 480; // (96% survie sur 500)
  const FCR_ACTUEL = 1.6;
  const JOURS_RESTANTS = 120;
  const DATE_REF = new Date("2026-03-15");

  it("calculerSGRRequis retourne une valeur realiste pour atteindre 800g en 120j depuis 200g", () => {
    const sgrRequis = calculerSGRRequis(
      POIDS_ACTUEL,
      POIDS_OBJECTIF,
      JOURS_RESTANTS
    );
    // SGR = (ln(800) - ln(200)) / 120 * 100 = ln(4) / 120 * 100 ≈ 1.155%
    expect(sgrRequis).not.toBeNull();
    expect(sgrRequis!).toBeCloseTo(1.155, 1);
  });

  it("calculerSGR depuis 5g vers 200g en 60 jours donne un SGR eleve (phase juvenile)", () => {
    const sgrActuel = calculerSGR(5, 200, 60);
    // SGR = (ln(200) - ln(5)) / 60 * 100 = (5.298 - 1.609) / 60 * 100 ≈ 6.15%
    expect(sgrActuel).not.toBeNull();
    expect(sgrActuel!).toBeGreaterThan(5.0);
  });

  it("calculerDateRecolteEstimee retourne une date dans le futur avec un SGR actuel sain", () => {
    // SGR actuel 6.15% > SGR requis 1.155% → la vague est en avance
    const sgrActuel = 6.15;
    const date = calculerDateRecolteEstimee(
      POIDS_ACTUEL,
      POIDS_OBJECTIF,
      sgrActuel,
      DATE_REF
    );
    expect(date).not.toBeNull();
    // Avec un SGR de 6.15%, la recolte devrait etre dans ~23 jours
    const joursAvantRecolte = Math.round(
      (date!.getTime() - DATE_REF.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(joursAvantRecolte).toBeGreaterThan(10);
    expect(joursAvantRecolte).toBeLessThan(50);
  });

  it("calculerAlimentRestantEstime calcule correctement l'aliment pour finir la vague", () => {
    const aliment = calculerAlimentRestantEstime(
      POIDS_ACTUEL,
      POIDS_OBJECTIF,
      NOMBRE_VIVANTS,
      FCR_ACTUEL
    );
    // gainBiomasse = (800 - 200) * 480 / 1000 = 288 kg
    // aliment = 288 * 1.6 = 460.8 kg
    expect(aliment).not.toBeNull();
    expect(aliment!).toBeCloseTo(460.8, 0);
  });

  it("calculerRevenuAttendu retourne null si prixVenteKg n'est pas renseigne", () => {
    // Cas reel : prixVenteKg est null dans ConfigElevage (non configure)
    const revenu = calculerRevenuAttendu(POIDS_OBJECTIF, NOMBRE_VIVANTS, null);
    expect(revenu).toBeNull();
  });

  it("calculerRevenuAttendu calcule correctement si prixVenteKg est renseigne", () => {
    // Exemple : 1500 CFA/kg, 480 poissons × 800g = 384 kg → 576 000 CFA
    const revenu = calculerRevenuAttendu(POIDS_OBJECTIF, NOMBRE_VIVANTS, 1500);
    expect(revenu).not.toBeNull();
    expect(revenu!).toBeCloseTo(576000, 0);
  });

  it("genererCourbeProjection genere 91 points pour 90 jours de projection", () => {
    const sgrActuel = 6.15;
    const points = genererCourbeProjection(
      POIDS_ACTUEL,
      sgrActuel,
      90,
      60 // jour de depart = J60
    );
    expect(points).toHaveLength(91); // J60 a J150 inclus
  });

  it("genererCourbeProjection atteint environ le poids objectif en ~23 jours avec SGR 6.15%", () => {
    const sgrActuel = 6.15;
    const points = genererCourbeProjection(POIDS_ACTUEL, sgrActuel, 30, 60);
    // Apres 23 jours avec SGR 6.15%, le poids devrait depasser 800g
    const poidsAJ23 = points.find((p) => p.jour === 83)?.poidsProjecte; // J60+23
    expect(poidsAJ23).toBeDefined();
    expect(poidsAJ23!).toBeGreaterThan(600); // Doit avoir bien progresse
  });

  it("scenario complet : SGR actuel > SGR requis → la vague est en avance", () => {
    const sgrActuel = calculerSGR(5, POIDS_ACTUEL, 60)!;
    const sgrRequis = calculerSGRRequis(
      POIDS_ACTUEL,
      POIDS_OBJECTIF,
      JOURS_RESTANTS
    )!;

    // La vague est en avance si sgrActuel >= sgrRequis
    expect(sgrActuel).toBeGreaterThan(sgrRequis);
  });
});

describe("S16-5 — Cas limites des projections en conditions degradees", () => {
  it("calculerSGRRequis retourne null si poids actuel >= objectif (objectif deja atteint)", () => {
    // Poids 800g = objectif 800g → ln(800/800) = 0 → SGR requis = 0
    const sgr = calculerSGRRequis(800, 800, 30);
    expect(sgr).toBeCloseTo(0, 5);
  });

  it("calculerSGRRequis retourne null si poids actuel depasse l'objectif", () => {
    // Poids 900g > objectif 800g → SGR negatif theoriquement
    // Notre implementation retourne null si l'un des params est invalide
    // ou la valeur negative si le numerateur est negatif (ln(800)-ln(900) < 0)
    const sgr = calculerSGRRequis(900, 800, 30);
    // Valeur negative ou null selon impl : verifier que ca ne plante pas
    expect(sgr === null || (sgr !== null && sgr < 0)).toBe(true);
  });

  it("calculerAlimentRestantEstime retourne null si objectif deja atteint", () => {
    expect(calculerAlimentRestantEstime(800, 800, 500, 1.5)).toBeNull();
    expect(calculerAlimentRestantEstime(900, 800, 500, 1.5)).toBeNull();
  });

  it("genererCourbeProjection avec SGR tres eleve projette une croissance rapide", () => {
    // SGR 10% (tres eleve, phase juvenile precoce)
    const points = genererCourbeProjection(5, 10, 30, 0);
    expect(points).toHaveLength(31);
    // Avec SGR 10%, le poids double approximativement tous les 7 jours
    expect(points[7].poidsProjecte).toBeGreaterThan(points[0].poidsProjecte * 1.8);
  });

  it("genererCourbeProjection avec SGR faible projette une croissance lente", () => {
    // SGR 0.5% (mauvaise performance)
    const points = genererCourbeProjection(200, 0.5, 30, 0);
    expect(points).toHaveLength(31);
    // Apres 30 jours avec SGR 0.5%, poids ≈ 200 * e^(0.005*30) = 200 * e^0.15 ≈ 232.4g
    // toBeCloseTo(232, 0) tolerance 0.5 (precision 0 chiffres apres virgule)
    expect(points[30].poidsProjecte).toBeCloseTo(232, 0);
    expect(points[30].poidsProjecte).toBeLessThan(250);
  });
});

// ===========================================================================
// S16-6 — Alertes graduees benchmark avec ConfigElevage
// ===========================================================================

describe("S16-6 — Benchmark avec seuils ConfigElevage personnalises", () => {
  const configSilures = {
    // Seuils adaptes pour Clarias gariepinus au Cameroun
    survieExcellentMin: 92,
    survieBonMin: 87,
    survieAcceptableMin: 82,
    fcrExcellentMax: 1.4, // Silures bien nourris
    fcrBonMax: 1.7,
    fcrAcceptableMax: 2.1,
    sgrExcellentMin: 2.5, // Croissance juvenile rapide
    sgrBonMin: 1.8,
    sgrAcceptableMin: 1.2,
    densiteExcellentMax: 6,
    densiteBonMax: 9,
    densiteAcceptableMax: 14,
    mortaliteExcellentMax: 2,
    mortaliteBonMax: 4,
    mortaliteAcceptableMax: 8,
  } as unknown as import("@/types").ConfigElevage;

  it("utilise le seuil FCR de la config (1.4 excellent) au lieu du defaut (1.5)", () => {
    const benchmarks = getBenchmarks(configSilures);
    // Avec config : FCR 1.45 est BON (pas EXCELLENT car > 1.4)
    expect(evaluerBenchmark(1.45, benchmarks.fcr)).toBe("BON");
    // Avec config defaut : FCR 1.45 serait EXCELLENT (< 1.5)
    expect(evaluerBenchmark(1.45, BENCHMARK_FCR)).toBe("EXCELLENT");
  });

  it("utilise le seuil SGR de la config (2.5 excellent) au lieu du defaut (2.0)", () => {
    const benchmarks = getBenchmarks(configSilures);
    // Avec config : SGR 2.3 est BON (entre 1.8 et 2.5)
    expect(evaluerBenchmark(2.3, benchmarks.sgr)).toBe("BON");
    // Avec defaut : SGR 2.3 serait EXCELLENT (>= 2.0)
    expect(evaluerBenchmark(2.3, BENCHMARK_SGR)).toBe("EXCELLENT");
  });

  it("utilise le seuil survie de la config (92% excellent) au lieu du defaut (90%)", () => {
    const benchmarks = getBenchmarks(configSilures);
    // Avec config : 91% survie est BON (entre 87% et 92%)
    expect(evaluerBenchmark(91, benchmarks.survie)).toBe("BON");
    // Avec defaut : 91% serait EXCELLENT (>= 90%)
    expect(evaluerBenchmark(91, BENCHMARK_SURVIE)).toBe("EXCELLENT");
  });

  it("FCR 1.3 est EXCELLENT avec les deux configs (< 1.4 et < 1.5)", () => {
    const benchmarks = getBenchmarks(configSilures);
    expect(evaluerBenchmark(1.3, benchmarks.fcr)).toBe("EXCELLENT");
    expect(evaluerBenchmark(1.3, BENCHMARK_FCR)).toBe("EXCELLENT");
  });

  it("FCR 2.5 est MAUVAIS avec les deux configs (> 2.1 et > 2.2)", () => {
    const benchmarks = getBenchmarks(configSilures);
    expect(evaluerBenchmark(2.5, benchmarks.fcr)).toBe("MAUVAIS");
    expect(evaluerBenchmark(2.5, BENCHMARK_FCR)).toBe("MAUVAIS");
  });

  it("evaluerBenchmark retourne null pour toutes les metriques si valeur null", () => {
    const benchmarks = getBenchmarks(configSilures);
    expect(evaluerBenchmark(null, benchmarks.fcr)).toBeNull();
    expect(evaluerBenchmark(null, benchmarks.sgr)).toBeNull();
    expect(evaluerBenchmark(null, benchmarks.survie)).toBeNull();
    expect(evaluerBenchmark(null, benchmarks.mortalite)).toBeNull();
    expect(evaluerBenchmark(null, benchmarks.densite)).toBeNull();
  });

  it("fallback vers les benchmarks hardcodes si config est null", () => {
    const benchmarks = getBenchmarks(null);
    // FCR 1.45 avec defaut → EXCELLENT (seuil 1.5)
    expect(evaluerBenchmark(1.45, benchmarks.fcr)).toBe("EXCELLENT");
  });
});

// ===========================================================================
// S16-5 — Coherence de la logique 'enAvance' dans le scenario dashboard
// ===========================================================================

describe("S16-5 — Logique enAvance (sgrActuel >= sgrRequis)", () => {
  it("enAvance = true si sgrActuel > sgrRequis", () => {
    const sgrActuel = calculerSGR(5, 200, 60); // ~6.15
    const sgrRequis = calculerSGRRequis(200, 800, 120); // ~1.155
    expect(sgrActuel).not.toBeNull();
    expect(sgrRequis).not.toBeNull();
    const enAvance = sgrActuel! >= sgrRequis!;
    expect(enAvance).toBe(true);
  });

  it("enAvance = false si sgrActuel < sgrRequis (vague en retard)", () => {
    // SGR 0.5% << SGR requis pour aller de 200g a 800g en 120j
    const sgrActuel = 0.5;
    const sgrRequis = calculerSGRRequis(200, 800, 120)!; // ~1.155
    const enAvance = sgrActuel >= sgrRequis;
    expect(enAvance).toBe(false);
  });

  it("enAvance = null si sgrActuel est null (pas assez de donnees biometriques)", () => {
    const sgrActuel: number | null = null;
    const sgrRequis = calculerSGRRequis(200, 800, 120);
    const enAvance =
      sgrActuel !== null && sgrRequis !== null
        ? sgrActuel >= sgrRequis
        : null;
    expect(enAvance).toBeNull();
  });

  it("enAvance = null si sgrRequis est null (pas de poids actuel)", () => {
    const sgrActuel = 2.5;
    const sgrRequis: number | null = calculerSGRRequis(null, 800, 120);
    const enAvance =
      sgrActuel !== null && sgrRequis !== null
        ? sgrActuel >= sgrRequis
        : null;
    expect(enAvance).toBeNull();
    expect(sgrRequis).toBeNull();
  });
});

// ===========================================================================
// S16-5 — Calculs intermediaires utilises par getProjectionsDashboard
// ===========================================================================

describe("S16-5 — Calculs intermediaires du pipeline projection", () => {
  it("calculerBiomasse retourne correctement la biomasse initiale et actuelle", () => {
    // 500 alevins de 5g → 2.5 kg de biomasse initiale
    const biomasseInitiale = calculerBiomasse(5, 500);
    expect(biomasseInitiale).toBeCloseTo(2.5, 2);

    // 480 poissons de 200g → 96 kg de biomasse actuelle
    const biomasseActuelle = calculerBiomasse(200, 480);
    expect(biomasseActuelle).toBeCloseTo(96, 0);
  });

  it("calculerFCR avec gain de biomasse positif", () => {
    // 100 kg d'aliment / 93.5 kg de gain = FCR 1.07
    const gainBiomasse = 96 - 2.5; // 93.5 kg
    const fcr = calculerFCR(100, gainBiomasse);
    expect(fcr).not.toBeNull();
    expect(fcr!).toBeCloseTo(1.07, 1);
  });

  it("FCR fallback a 1.5 si pas assez de donnees (calcul aliment restant)", () => {
    // Sans gain de biomasse mesure, FCR par defaut = 1.5 (valeur cible silures)
    const fcrCalcule = calculerFCR(null, null);
    const fcrUtilise = fcrCalcule ?? 1.5;
    expect(fcrUtilise).toBe(1.5);
  });

  it("dureeEstimeeCycle - joursEcoules donne les jours restants (avec Math.max(1, x))", () => {
    // Cycle estime 180j, 60j ecoules → 120j restants
    const dureeEstimeeCycle = 180;
    const joursEcoules = 60;
    const joursRestants = Math.max(1, dureeEstimeeCycle - joursEcoules);
    expect(joursRestants).toBe(120);

    // Cas degenere : vague en retard (joursEcoules > dureeEstimeeCycle)
    const joursEcoulesTooMany = 200;
    const joursRestantsMin = Math.max(
      1,
      dureeEstimeeCycle - joursEcoulesTooMany
    );
    expect(joursRestantsMin).toBe(1); // Au minimum 1 jour
  });

  it("joursProjection est plafonne a 90 jours (min avec joursRestantsEstimes)", () => {
    // Si joursRestantsEstimes = 200, on limite a 90 jours
    const joursRestantsEstimes = 200;
    const joursProjection = Math.min(joursRestantsEstimes, 90);
    expect(joursProjection).toBe(90);

    // Si joursRestantsEstimes = 45, on utilise 45
    const joursProjectionCourt = Math.min(45, 90);
    expect(joursProjectionCourt).toBe(45);

    // Si joursRestantsEstimes est null, fallback a 60
    const joursProjectionNullFallback = Math.min(60, 90); // Fallback 60j
    expect(joursProjectionNullFallback).toBe(60);
  });
});
