import { describe, it, expect } from "vitest";
import {
  calculerTauxSurvie,
  calculerGainPoids,
  calculerSGR,
  calculerFCR,
  calculerBiomasse,
} from "@/lib/calculs";

// ---------------------------------------------------------------------------
// calculerTauxSurvie
// ---------------------------------------------------------------------------
describe("calculerTauxSurvie", () => {
  it("calcule correctement le taux de survie avec des valeurs réalistes", () => {
    // 500 alevins, 450 survivants → 90%
    expect(calculerTauxSurvie(450, 500)).toBe(90);
  });

  it("retourne 100% quand aucune mortalité", () => {
    expect(calculerTauxSurvie(1000, 1000)).toBe(100);
  });

  it("retourne 0% quand aucun survivant", () => {
    expect(calculerTauxSurvie(0, 500)).toBe(0);
  });

  it("retourne null si nombreInitial est 0 (division par zéro)", () => {
    expect(calculerTauxSurvie(100, 0)).toBeNull();
  });

  it("retourne null si nombreInitial est négatif", () => {
    expect(calculerTauxSurvie(100, -10)).toBeNull();
  });

  it("retourne null si nombreVivants est null", () => {
    expect(calculerTauxSurvie(null, 500)).toBeNull();
  });

  it("retourne null si nombreInitial est null", () => {
    expect(calculerTauxSurvie(450, null)).toBeNull();
  });

  it("retourne null si les deux paramètres sont null", () => {
    expect(calculerTauxSurvie(null, null)).toBeNull();
  });

  it("gère un taux de survie faible (mortalité élevée de silures)", () => {
    // 2000 alevins, 1200 survivants → 60%
    expect(calculerTauxSurvie(1200, 2000)).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// calculerGainPoids
// ---------------------------------------------------------------------------
describe("calculerGainPoids", () => {
  it("calcule le gain de poids positif pour silures en croissance", () => {
    // De 5g (alevin) à 150g après 2 mois → gain de 145g
    expect(calculerGainPoids(150, 5)).toBe(145);
  });

  it("calcule le gain de poids pour silures adultes", () => {
    // De 300g à 500g → gain de 200g
    expect(calculerGainPoids(500, 300)).toBe(200);
  });

  it("retourne 0 quand pas de changement de poids", () => {
    expect(calculerGainPoids(100, 100)).toBe(0);
  });

  it("retourne une valeur négative en cas de perte de poids", () => {
    // Perte de poids possible en cas de stress ou maladie
    expect(calculerGainPoids(80, 100)).toBe(-20);
  });

  it("retourne null si poidsMoyenActuel est null", () => {
    expect(calculerGainPoids(null, 100)).toBeNull();
  });

  it("retourne null si poidsMoyenPrecedent est null", () => {
    expect(calculerGainPoids(150, null)).toBeNull();
  });

  it("retourne null si les deux paramètres sont null", () => {
    expect(calculerGainPoids(null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerSGR
// ---------------------------------------------------------------------------
describe("calculerSGR", () => {
  it("calcule le SGR avec des valeurs réalistes de silures", () => {
    // Alevin 5g → 150g en 60 jours
    // SGR = ((ln(150) - ln(5)) / 60) * 100 = ((5.0106 - 1.6094) / 60) * 100 ≈ 5.67 %/jour
    const sgr = calculerSGR(5, 150, 60);
    expect(sgr).not.toBeNull();
    expect(sgr!).toBeCloseTo(5.67, 1);
  });

  it("calcule le SGR pour une croissance modérée", () => {
    // 100g → 200g en 30 jours
    // SGR = ((ln(200) - ln(100)) / 30) * 100 = (0.6931 / 30) * 100 ≈ 2.31 %/jour
    const sgr = calculerSGR(100, 200, 30);
    expect(sgr).not.toBeNull();
    expect(sgr!).toBeCloseTo(2.31, 1);
  });

  it("retourne un SGR faible pour une croissance lente", () => {
    // 200g → 210g en 30 jours
    // SGR = ((ln(210) - ln(200)) / 30) * 100 ≈ 0.163 %/jour
    const sgr = calculerSGR(200, 210, 30);
    expect(sgr).not.toBeNull();
    expect(sgr!).toBeCloseTo(0.163, 2);
  });

  it("retourne null si poidsInitial est 0", () => {
    expect(calculerSGR(0, 150, 60)).toBeNull();
  });

  it("retourne null si poidsFinal est 0", () => {
    expect(calculerSGR(5, 0, 60)).toBeNull();
  });

  it("retourne null si nombreJours est 0", () => {
    expect(calculerSGR(5, 150, 0)).toBeNull();
  });

  it("retourne null si poidsInitial est négatif", () => {
    expect(calculerSGR(-5, 150, 60)).toBeNull();
  });

  it("retourne null si nombreJours est négatif", () => {
    expect(calculerSGR(5, 150, -10)).toBeNull();
  });

  it("retourne null si un paramètre est null", () => {
    expect(calculerSGR(null, 150, 60)).toBeNull();
    expect(calculerSGR(5, null, 60)).toBeNull();
    expect(calculerSGR(5, 150, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerFCR
// ---------------------------------------------------------------------------
describe("calculerFCR", () => {
  it("calcule le FCR avec des valeurs réalistes de silures", () => {
    // 50 kg d'aliment distribué, gain de biomasse de 40 kg → FCR = 1.25
    expect(calculerFCR(50, 40)).toBe(1.25);
  });

  it("FCR idéal pour silures (proche de 1.0)", () => {
    // 30 kg aliment, 30 kg gain → FCR = 1.0
    expect(calculerFCR(30, 30)).toBe(1);
  });

  it("FCR élevé indique une mauvaise conversion", () => {
    // 100 kg aliment, 50 kg gain → FCR = 2.0 (mauvais)
    expect(calculerFCR(100, 50)).toBe(2);
  });

  it("retourne null si gainBiomasse est 0 (division par zéro)", () => {
    expect(calculerFCR(50, 0)).toBeNull();
  });

  it("retourne null si gainBiomasse est négatif", () => {
    // Perte de biomasse → FCR non pertinent
    expect(calculerFCR(50, -10)).toBeNull();
  });

  it("retourne null si totalAliment est null", () => {
    expect(calculerFCR(null, 40)).toBeNull();
  });

  it("retourne null si gainBiomasse est null", () => {
    expect(calculerFCR(50, null)).toBeNull();
  });

  it("retourne null si les deux paramètres sont null", () => {
    expect(calculerFCR(null, null)).toBeNull();
  });

  it("gère un totalAliment de 0 (pas d'alimentation)", () => {
    // 0 kg aliment avec un gain de biomasse → FCR = 0 (scénario improbable mais valide)
    expect(calculerFCR(0, 40)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculerBiomasse
// ---------------------------------------------------------------------------
describe("calculerBiomasse", () => {
  it("calcule la biomasse avec des valeurs réalistes de silures", () => {
    // 500 poissons × 150g = 75 000g = 75 kg
    expect(calculerBiomasse(150, 500)).toBe(75);
  });

  it("calcule la biomasse pour des alevins", () => {
    // 2000 alevins × 5g = 10 000g = 10 kg
    expect(calculerBiomasse(5, 2000)).toBe(10);
  });

  it("calcule la biomasse pour des poissons adultes", () => {
    // 300 poissons × 500g = 150 000g = 150 kg
    expect(calculerBiomasse(500, 300)).toBe(150);
  });

  it("retourne 0 quand il n'y a pas de poissons", () => {
    expect(calculerBiomasse(150, 0)).toBe(0);
  });

  it("retourne 0 quand le poids moyen est 0", () => {
    expect(calculerBiomasse(0, 500)).toBe(0);
  });

  it("retourne null si poidsMoyen est null", () => {
    expect(calculerBiomasse(null, 500)).toBeNull();
  });

  it("retourne null si nombreVivants est null", () => {
    expect(calculerBiomasse(150, null)).toBeNull();
  });

  it("retourne null si les deux paramètres sont null", () => {
    expect(calculerBiomasse(null, null)).toBeNull();
  });
});
