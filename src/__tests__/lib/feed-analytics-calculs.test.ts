/**
 * Tests des fonctions de calcul Feed Analytics (Sprint FB).
 *
 * Fonctions testees :
 *   - calculerADG   : Average Daily Gain
 *   - calculerPER   : Protein Efficiency Ratio
 *   - calculerDFR   : Daily Feeding Rate
 *   - calculerEcartRation : ecart ration reelle / theorique
 *   - calculerScoreAliment : score qualite aliment /10
 */

import { describe, it, expect } from "vitest";
import {
  calculerADG,
  calculerPER,
  calculerDFR,
  calculerEcartRation,
  calculerScoreAliment,
  DEFAULT_SCORE_CONFIG,
} from "@/lib/calculs";

// ---------------------------------------------------------------------------
// calculerADG — Average Daily Gain (g/jour)
// ---------------------------------------------------------------------------
describe("calculerADG", () => {
  it("cas normal : (10, 50, 20) → 2.0 g/jour", () => {
    // (50 - 10) / 20 = 2.0
    expect(calculerADG(10, 50, 20)).toBe(2.0);
  });

  it("ADG negatif autorise : (50, 30, 10) → -2.0 g/jour", () => {
    // perte de poids intentionnellement permise
    // (30 - 50) / 10 = -2.0
    expect(calculerADG(50, 30, 10)).toBe(-2.0);
  });

  it("jours = 0 → null (division par zero)", () => {
    expect(calculerADG(10, 50, 0)).toBeNull();
  });

  it("jours negatif → null", () => {
    expect(calculerADG(10, 50, -5)).toBeNull();
  });

  it("poidsInitial null → null", () => {
    expect(calculerADG(null, 50, 20)).toBeNull();
  });

  it("poidsFinal null → null", () => {
    expect(calculerADG(10, null, 20)).toBeNull();
  });

  it("jours null → null", () => {
    expect(calculerADG(10, 50, null)).toBeNull();
  });

  it("tous les parametres null → null", () => {
    expect(calculerADG(null, null, null)).toBeNull();
  });

  it("ADG de zero (pas de croissance)", () => {
    // 100g → 100g en 10 jours
    expect(calculerADG(100, 100, 10)).toBe(0);
  });

  it("ADG realiste silure juvenile : 5g → 150g en 90 jours → 1.61 g/j", () => {
    // (150 - 5) / 90 = 1.611...
    const adg = calculerADG(5, 150, 90);
    expect(adg).not.toBeNull();
    expect(adg!).toBeCloseTo(1.611, 2);
  });
});

// ---------------------------------------------------------------------------
// calculerPER — Protein Efficiency Ratio
// ---------------------------------------------------------------------------
describe("calculerPER", () => {
  it("cas normal : gain 1000g, 2kg aliment @ 25% proteines → PER = 2.0", () => {
    // proteinesConsommees = 2 * 1000 * (25/100) = 500g
    // PER = 1000 / 500 = 2.0
    expect(calculerPER(1000, 2, 25)).toBe(2.0);
  });

  it("PER realiste silure : gain 500g pop, 0.5kg aliment @ 42% proteines", () => {
    // proteinesConsommees = 0.5 * 1000 * 0.42 = 210g
    // PER = 500 / 210 ≈ 2.381
    const per = calculerPER(500, 0.5, 42);
    expect(per).not.toBeNull();
    expect(per!).toBeCloseTo(2.381, 2);
  });

  it("quantiteAliment = 0 → null", () => {
    expect(calculerPER(1000, 0, 25)).toBeNull();
  });

  it("tauxProteines = 0 → null", () => {
    expect(calculerPER(1000, 2, 0)).toBeNull();
  });

  it("gainPoids null → null", () => {
    expect(calculerPER(null, 2, 25)).toBeNull();
  });

  it("quantiteAliment null → null", () => {
    expect(calculerPER(1000, null, 25)).toBeNull();
  });

  it("tauxProteines null → null", () => {
    expect(calculerPER(1000, 2, null)).toBeNull();
  });

  it("gain de poids negatif → PER negatif (perte de poids)", () => {
    // Situation pathologique mais la fonction ne la refuse pas
    const per = calculerPER(-200, 2, 25);
    expect(per).not.toBeNull();
    expect(per!).toBeLessThan(0);
  });

  it("gain de poids zero → PER = 0", () => {
    // aucun gain mais proteines consommees : PER = 0
    expect(calculerPER(0, 2, 25)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculerDFR — Daily Feeding Rate (% biomasse/jour)
// ---------------------------------------------------------------------------
describe("calculerDFR", () => {
  it("cas normal : (0.5, 10) → 5.0%", () => {
    // (0.5 / 10) * 100 = 5.0
    expect(calculerDFR(0.5, 10)).toBe(5.0);
  });

  it("DFR realiste juvenile : 2kg distribue, 50kg biomasse → 4%", () => {
    expect(calculerDFR(2, 50)).toBe(4);
  });

  it("biomasse = 0 → null (division par zero)", () => {
    expect(calculerDFR(0.5, 0)).toBeNull();
  });

  it("biomasse negative → null", () => {
    expect(calculerDFR(0.5, -10)).toBeNull();
  });

  it("quantite null → null", () => {
    expect(calculerDFR(null, 10)).toBeNull();
  });

  it("biomasse null → null", () => {
    expect(calculerDFR(0.5, null)).toBeNull();
  });

  it("quantite = 0 avec biomasse > 0 → DFR = 0 (pas d'alimentation ce jour)", () => {
    // 0 kg distribue / 20 kg biomasse = 0%
    expect(calculerDFR(0, 20)).toBe(0);
  });

  it("DFR phase finition : 0.3kg distribue, 20kg biomasse → 1.5%", () => {
    expect(calculerDFR(0.3, 20)).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// calculerEcartRation — ecart ration reelle vs theorique (%)
// ---------------------------------------------------------------------------
describe("calculerEcartRation", () => {
  it("sur-alimentation : consomme > theorique → ecart positif", () => {
    // consomme 1.2kg, theorique 1.0kg → ecart = ((1.2 - 1.0) / 1.0) * 100 ≈ 20%
    // toBeCloseTo car 1.2 - 1.0 = 0.19999... en virgule flottante IEEE 754
    expect(calculerEcartRation(1.2, 1.0)).toBeCloseTo(20, 5);
  });

  it("sous-alimentation : consomme < theorique → ecart negatif", () => {
    // consomme 0.8kg, theorique 1.0kg → ecart = ((0.8 - 1.0) / 1.0) * 100 ≈ -20%
    // toBeCloseTo car 0.8 - 1.0 = -0.19999... en virgule flottante IEEE 754
    expect(calculerEcartRation(0.8, 1.0)).toBeCloseTo(-20, 5);
  });

  it("ration exacte : consomme = theorique → ecart = 0", () => {
    expect(calculerEcartRation(1.0, 1.0)).toBe(0);
  });

  it("theorique = 0 → null (division par zero)", () => {
    expect(calculerEcartRation(1.0, 0)).toBeNull();
  });

  it("theorique negative → null", () => {
    expect(calculerEcartRation(1.0, -1.0)).toBeNull();
  });

  it("consomme null → null", () => {
    expect(calculerEcartRation(null, 1.0)).toBeNull();
  });

  it("theorique null → null", () => {
    expect(calculerEcartRation(1.0, null)).toBeNull();
  });

  it("sur-alimentation forte : 3kg pour 1kg theorique → ecart = 200%", () => {
    expect(calculerEcartRation(3, 1)).toBe(200);
  });

  it("consomme = 0 → ecart = -100% (jeune totale)", () => {
    expect(calculerEcartRation(0, 1.0)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// calculerScoreAliment — score qualite /10 (multicriteres)
// ---------------------------------------------------------------------------
describe("calculerScoreAliment", () => {
  // Guard E3 : FCR = 0 → doit etre ignore (FCR <= 0 invalide)
  it("Guard E3 : FCR = 0 avec SGR = 2.5 → null si FCR ignoré ET autres aussi null", () => {
    // Quand FCR=0 est ignoré (guard), seul SGR contribue
    // SGR = 2.5 / 4.0 * 10 = 6.25, poids = 0.25 → score = 6.25, poidsTotal = 0.25
    // retourne score si poidsTotal > 0
    const score = calculerScoreAliment(0, 2.5, null, null);
    // FCR=0 est invalide et ignoré, SGR=2.5 contribue seul
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0);
    expect(score!).toBeLessThanOrEqual(10);
  });

  it("Guard E3 : FCR = 0 avec SGR = null ET coutKg = null ET survie = null → null", () => {
    // FCR ignoré + rien d'autre → poidsTotal = 0 → null
    expect(calculerScoreAliment(0, null, null, null)).toBeNull();
  });

  it("Guard E3 : FCR negatif (-1) avec SGR = null → null", () => {
    // FCR negatif ignoré, rien d'autre → null
    expect(calculerScoreAliment(-1, null, null, null)).toBeNull();
  });

  it("Guard E3 : FCR negatif (-1) avec SGR = 2.0 → score base sur SGR seul", () => {
    const score = calculerScoreAliment(-1, 2.0, null, null);
    expect(score).not.toBeNull();
    // SGR = 2.0 / 4.0 * 10 = 5.0 → score = 5.0
    expect(score!).toBeCloseTo(5.0, 1);
  });

  it("Guard E9 : FCR null ET SGR null → null", () => {
    expect(calculerScoreAliment(null, null, null, null)).toBeNull();
  });

  it("Guard E9 : FCR null ET SGR null avec coutKg et survie → null (FCR+SGR obligatoires)", () => {
    // La guard E9 est checked avant tout calcul
    expect(calculerScoreAliment(null, null, 1000, 85)).toBeNull();
  });

  it("cas realiste : FCR=1.5, SGR=2.5, coutKg=1000, survie=85 → score entre 0 et 10", () => {
    const score = calculerScoreAliment(1.5, 2.5, 1000, 85);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(10);
  });

  it("cas realiste : FCR=1.5, SGR=2.5, coutKg=1000, survie=85 → score raisonnable (~5-7)", () => {
    // FCR=1.5 → fcrNorm = 10 - ((1.5-1.0)/(3.0-1.0))*10 = 10 - 2.5 = 7.5
    // SGR=2.5 → sgrNorm = (2.5/4.0)*10 = 6.25
    // cout=1000 → coutNorm = 10 - ((1000-500)/(4000-500))*10 = 10 - 1.43 = 8.57
    // survie=85 → survieNorm = ((85-70)/(100-70))*10 = 5.0
    // score = (7.5*0.4 + 6.25*0.25 + 8.57*0.25 + 5.0*0.1) / 1.0
    //       = (3.0 + 1.5625 + 2.1425 + 0.5) / 1.0 = 7.205...
    const score = calculerScoreAliment(1.5, 2.5, 1000, 85);
    expect(score!).toBeGreaterThan(5);
    expect(score!).toBeLessThan(9);
  });

  it("cas parfait : FCR=1.0, SGR=4.0, coutKg=500, survie=100 → score proche de 10", () => {
    // FCR=1.0 → fcrNorm = 10 - ((1.0-1.0)/2.0)*10 = 10
    // SGR=4.0 → sgrNorm = (4.0/4.0)*10 = 10
    // cout=500 → coutNorm = 10 - ((500-500)/3500)*10 = 10
    // survie=100 → survieNorm = ((100-70)/30)*10 = 10
    // score = (10*0.4 + 10*0.25 + 10*0.25 + 10*0.1) / 1.0 = 10.0
    const score = calculerScoreAliment(1.0, 4.0, 500, 100);
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(10.0, 0);
  });

  it("cas terrible : FCR=3.0, SGR=0, coutKg=4000, survie=70 → score proche de 0", () => {
    // FCR=3.0 → fcrNorm = 10 - ((3.0-1.0)/2.0)*10 = 0
    // SGR=0 → sgrNorm = (0/4.0)*10 = 0
    // cout=4000 → coutNorm = 10 - ((4000-500)/3500)*10 = 0
    // survie=70 → survieNorm = ((70-70)/30)*10 = 0
    // score = 0 / 1.0 = 0.0
    const score = calculerScoreAliment(3.0, 0, 4000, 70);
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(0.0, 0);
  });

  it("FCR seul (SGR null, coutKg null, survie null) → score base sur FCR uniquement", () => {
    // FCR=1.5 → fcrNorm = 7.5, poidsTotal = 0.4
    // score = (7.5 * 0.4) / 0.4 = 7.5
    const score = calculerScoreAliment(1.5, null, null, null);
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(7.5, 1);
  });

  it("SGR seul (FCR null, coutKg null, survie null) → score base sur SGR uniquement", () => {
    // SGR=2.0 → sgrNorm = (2.0/4.0)*10 = 5.0, poidsTotal = 0.25
    // score = (5.0 * 0.25) / 0.25 = 5.0
    const score = calculerScoreAliment(null, 2.0, null, null);
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(5.0, 1);
  });

  it("utilise config personnalisee si fournie", () => {
    const customConfig = {
      fcrMin: 1.0,
      fcrMax: 2.0,  // plage plus etroite
      sgrMax: 3.0,
      coutKgMin: 200,
      coutKgMax: 2000,
      survieMin: 60,
    };
    // FCR=1.0 parfait avec config custom
    const score = calculerScoreAliment(1.0, null, null, null, customConfig);
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(10.0, 0);
  });

  it("score toujours entre 0 et 10 pour des valeurs hors plage", () => {
    // FCR tres bas (meilleur que optimal) → clampe a 10
    const score1 = calculerScoreAliment(0.1, 10, 0, 100);
    expect(score1).not.toBeNull();
    expect(score1!).toBeGreaterThanOrEqual(0);
    expect(score1!).toBeLessThanOrEqual(10);

    // FCR tres haut (bien pire que seuil max) → clampe a 0
    const score2 = calculerScoreAliment(5.0, 0, 5000, 50);
    expect(score2).not.toBeNull();
    expect(score2!).toBeGreaterThanOrEqual(0);
    expect(score2!).toBeLessThanOrEqual(10);
  });
});
