/**
 * Tests de non-régression — Bugfix ICA Vague-level (analytics.ts)
 *
 * Trois bugs corrigés dans `src/lib/queries/analytics.ts` :
 *
 * BUG 1 — `getComparaisonVagues` : totalAliment ignorait ReleveConsommation
 *   Fix : réducteur hybride — priorité à quantiteAliment si non-null,
 *   sinon SUM(consommations[].quantite).
 *
 * BUG 2 — `getAnalyticsDashboard` tendanceFCR : même pattern quantiteAliment
 *   Fix identique + ajout de consommations dans le select de la query.
 *
 * BUG 3 — tendanceFCR : gain biomasse mensuel = gain vie totale (J0 → fin)
 *   Fix : gain intra-mois uniquement. Nécessite ≥2 biométries dans le mois,
 *   sinon aucun point FCR n'est émis pour ce mois.
 *
 * Ces tests exercent la LOGIQUE pure des reducers et du guard, sans appel DB.
 * Ils répliquent fidèlement le code de analytics.ts pour valider les invariants.
 */

import { describe, it, expect } from "vitest";
import { calculerBiomasse, calculerFCR } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Helpers — réplique des reducers corrigés dans analytics.ts
// ---------------------------------------------------------------------------

/**
 * Réplique du réducteur hybride totalAliment (BUG 1 + BUG 2 fix).
 *
 * Règle : si quantiteAliment est non-null sur un relevé, on l'utilise.
 * Sinon on somme les consommations de ce relevé. On ne cumule JAMAIS les deux.
 */
type ReleveAliment = {
  quantiteAliment: number | null;
  consommations: { quantite: number }[];
};

function sumAlimentRelevesHybrid(alimentations: ReleveAliment[]): number {
  return alimentations.reduce((s, r) => {
    if (r.quantiteAliment !== null && r.quantiteAliment !== undefined) {
      return s + r.quantiteAliment;
    }
    return s + r.consommations.reduce((cs, c) => cs + c.quantite, 0);
  }, 0);
}

/**
 * Réplique du calcul de gain intra-mois (BUG 3 fix).
 *
 * Pour un ensemble de biométries d'UNE vague dans UN mois :
 * - Si < 2 biométries → retourne null (pas de point FCR)
 * - Si ≥ 2 → gain = biomasse(derniere) - biomasse(premiere), ou null si pas
 *   d'amélioration (biomasseFin <= biomasseDebut)
 */
type BioReleve = {
  poidsMoyen: number | null;
};

function computeGainIntraMois(
  bios: BioReleve[],
  nombreInitial: number
): number | null {
  if (bios.length < 2) return null;
  const premiereBio = bios.at(0);
  const derniereBio = bios.at(-1);
  const poidsMoyenDebut = premiereBio?.poidsMoyen ?? null;
  const poidsMoyenFin = derniereBio?.poidsMoyen ?? null;
  const biomasseFin = calculerBiomasse(poidsMoyenFin, nombreInitial);
  const biomasseDebut = calculerBiomasse(poidsMoyenDebut, nombreInitial);
  if (
    biomasseFin !== null &&
    biomasseDebut !== null &&
    biomasseFin > biomasseDebut
  ) {
    return biomasseFin - biomasseDebut;
  }
  return null;
}

// ---------------------------------------------------------------------------
// BUG 1 + BUG 2 — Réducteur hybride totalAliment
// ---------------------------------------------------------------------------

describe("sumAlimentRelevesHybrid — réducteur hybride totalAliment (BUG 1 + 2)", () => {
  it("saisie directe uniquement : utilise quantiteAliment, ignore consommations vides", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: 10, consommations: [] },
      { quantiteAliment: 5, consommations: [] },
    ];
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(15);
  });

  it("saisie directe avec consommations présentes : quantiteAliment a priorité, consommations ignorées", () => {
    // Le relevé a quantiteAliment=8 ET des consommations — on ne cumule PAS les deux
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: 8, consommations: [{ quantite: 3 }, { quantite: 2 }] },
    ];
    // Résultat attendu : 8, pas 8+3+2=13
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(8);
  });

  it("stock-linked uniquement (quantiteAliment null) : somme les consommations", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 4 }, { quantite: 6 }] },
      { quantiteAliment: null, consommations: [{ quantite: 2 }] },
    ];
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(12);
  });

  it("mix : un relevé direct + un relevé stock-linked", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: 10, consommations: [] },
      { quantiteAliment: null, consommations: [{ quantite: 5 }, { quantite: 3 }] },
    ];
    // 10 (direct) + 8 (stock) = 18
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(18);
  });

  it("relevé sans quantiteAliment et sans consommations : contribue 0", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [] },
    ];
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(0);
  });

  it("liste vide : retourne 0", () => {
    expect(sumAlimentRelevesHybrid([])).toBe(0);
  });

  it("quantiteAliment = 0 est traité comme valeur numérique valide (0, pas fallback stock)", () => {
    // quantiteAliment = 0 est non-null → on utilise 0, pas les consommations
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: 0, consommations: [{ quantite: 7 }] },
    ];
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(0);
  });

  it("plusieurs relevés stock-linked avec plusieurs consommations chacun", () => {
    const alimentations: ReleveAliment[] = [
      {
        quantiteAliment: null,
        consommations: [{ quantite: 2 }, { quantite: 3 }, { quantite: 5 }],
      },
      {
        quantiteAliment: null,
        consommations: [{ quantite: 1 }, { quantite: 4 }],
      },
    ];
    // (2+3+5) + (1+4) = 10 + 5 = 15
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(15);
  });

  it("ne double-compte pas : relevé avec quantiteAliment non-null ET consommations non-vides", () => {
    const alimentations: ReleveAliment[] = [
      {
        quantiteAliment: 20,
        consommations: [{ quantite: 10 }, { quantite: 10 }],
      },
    ];
    // Sans le fix (bug original) : 20 → mais si on avait additionné les deux = 40
    // Avec le fix : 20 uniquement
    const result = sumAlimentRelevesHybrid(alimentations);
    expect(result).toBe(20);
    expect(result).not.toBe(40); // garantit absence de double-comptage
  });
});

// ---------------------------------------------------------------------------
// BUG 3 — Gain intra-mois (≥2 biométries requises)
// ---------------------------------------------------------------------------

describe("computeGainIntraMois — gain biomasse mensuel intra-mois (BUG 3)", () => {
  it("0 biométrie dans le mois → null (pas de point FCR)", () => {
    expect(computeGainIntraMois([], 1000)).toBeNull();
  });

  it("1 biométrie dans le mois → null (insuffisant pour un gain intra-mois)", () => {
    const bios: BioReleve[] = [{ poidsMoyen: 50 }];
    expect(computeGainIntraMois(bios, 1000)).toBeNull();
  });

  it("2 biométries : gain = biomasse(derniere) - biomasse(premiere)", () => {
    // poids : 50g → 70g, 1000 poissons
    // bioDebut = (50 * 1000) / 1000 = 50 kg
    // bioFin   = (70 * 1000) / 1000 = 70 kg
    // gain = 20 kg
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 70 }];
    expect(computeGainIntraMois(bios, 1000)).toBeCloseTo(20);
  });

  it("3 biométries : utilise la première et la dernière (pas celle du milieu)", () => {
    // bios ordonnées : 40g, 60g, 80g → gain entre 40g et 80g
    // bioDebut = (40 * 500) / 1000 = 20 kg
    // bioFin   = (80 * 500) / 1000 = 40 kg
    // gain = 20 kg (pas 10+10=20 via milieu, mais 20 direct first→last)
    const bios: BioReleve[] = [
      { poidsMoyen: 40 },
      { poidsMoyen: 60 },
      { poidsMoyen: 80 },
    ];
    const result = computeGainIntraMois(bios, 500);
    expect(result).toBeCloseTo(20);
  });

  it("poids décroissant dans le mois → null (pas de gain positif, FCR non émis)", () => {
    // poissons ont perdu du poids (situation anormale)
    const bios: BioReleve[] = [{ poidsMoyen: 80 }, { poidsMoyen: 60 }];
    expect(computeGainIntraMois(bios, 1000)).toBeNull();
  });

  it("même poids début et fin → null (gain = 0, FCR non émis)", () => {
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 50 }];
    expect(computeGainIntraMois(bios, 1000)).toBeNull();
  });

  it("poidsMoyen null sur la première biométrie → null", () => {
    const bios: BioReleve[] = [{ poidsMoyen: null }, { poidsMoyen: 70 }];
    expect(computeGainIntraMois(bios, 1000)).toBeNull();
  });

  it("poidsMoyen null sur la dernière biométrie → null", () => {
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: null }];
    expect(computeGainIntraMois(bios, 1000)).toBeNull();
  });

  it("résultat cohérent avec calculerBiomasse (formule : poids * n / 1000)", () => {
    // poids : 100g → 150g, 2000 poissons
    // bioDebut = (100 * 2000) / 1000 = 200 kg
    // bioFin   = (150 * 2000) / 1000 = 300 kg
    // gain = 100 kg
    const bios: BioReleve[] = [{ poidsMoyen: 100 }, { poidsMoyen: 150 }];
    const gain = computeGainIntraMois(bios, 2000);
    expect(gain).toBeCloseTo(100);
    // Vérification directe via calculerBiomasse
    const bioDebut = calculerBiomasse(100, 2000)!;
    const bioFin = calculerBiomasse(150, 2000)!;
    expect(gain).toBeCloseTo(bioFin - bioDebut);
  });
});

// ---------------------------------------------------------------------------
// Intégration — FCR mensuel avec les deux fixes combinés
// ---------------------------------------------------------------------------

describe("FCR mensuel — intégration hybrid totalAliment + gain intra-mois", () => {
  /**
   * Simule le calcul FCR d'un mois tel qu'il est fait dans tendanceFCR (analytics.ts),
   * avec les deux corrections (BUG 2 + BUG 3) appliquées.
   */
  function computeFCRMensuel(
    alimentations: ReleveAliment[],
    bios: BioReleve[],
    nombreInitial: number
  ): number | null {
    const totalAliment = sumAlimentRelevesHybrid(alimentations);
    const gainBiomasse = computeGainIntraMois(bios, nombreInitial);
    return calculerFCR(totalAliment, gainBiomasse);
  }

  it("relevés stock-linked + ≥2 biométries → FCR calculé correctement", () => {
    // 30 kg aliment, poids 50g→80g sur 1000 poissons
    // bioDebut = 50 kg, bioFin = 80 kg, gain = 30 kg
    // FCR = 30 / 30 = 1.0
    const aliments: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 15 }, { quantite: 15 }] },
    ];
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 80 }];
    const fcr = computeFCRMensuel(aliments, bios, 1000);
    expect(fcr).not.toBeNull();
    expect(fcr).toBeCloseTo(1.0); // 30 / 30
  });

  it("relevé direct + ≥2 biométries → FCR correct (même résultat qu'avant bugfix si quantiteAliment non-null)", () => {
    // 20 kg aliment direct, poids 40g→90g sur 500 poissons
    // bioDebut = (40*500)/1000 = 20 kg, bioFin = (90*500)/1000 = 45 kg, gain = 25 kg
    // FCR = 20 / 25 = 0.8
    const aliments: ReleveAliment[] = [
      { quantiteAliment: 20, consommations: [] },
    ];
    const bios: BioReleve[] = [{ poidsMoyen: 40 }, { poidsMoyen: 90 }];
    const fcr = computeFCRMensuel(aliments, bios, 500);
    expect(fcr).not.toBeNull();
    expect(fcr).toBeCloseTo(0.8);
  });

  it("stock-linked + seule 1 biométrie dans le mois → FCR null (BUG 3 guard)", () => {
    // Avant le fix BUG 3 : un FCR faux était émis en utilisant le gain vie totale
    // Après le fix : on ne produit pas de point FCR si < 2 biométries
    const aliments: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 10 }] },
    ];
    const bios: BioReleve[] = [{ poidsMoyen: 60 }];
    const fcr = computeFCRMensuel(aliments, bios, 1000);
    expect(fcr).toBeNull();
  });

  it("stock-linked + 0 biométries → FCR null", () => {
    const aliments: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 10 }] },
    ];
    const fcr = computeFCRMensuel(aliments, [], 1000);
    expect(fcr).toBeNull();
  });

  it("aucun aliment (0 kg) + gain positif → FCR = 0 (calculerFCR retourne 0/gain = 0)", () => {
    // totalAliment = 0, gain > 0 → FCR = 0 / gain = 0
    const aliments: ReleveAliment[] = [];
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 80 }];
    const fcr = computeFCRMensuel(aliments, bios, 1000);
    expect(fcr).toBeCloseTo(0);
  });

  it("relevé avec double-saisie (quantiteAliment + consommations) : pas de double-comptage dans FCR", () => {
    // quantiteAliment = 15 ET consommations = 15 → on utilise uniquement 15 (pas 30)
    // poids 50g→100g sur 1000 poissons → gain = (100-50)*1000/1000 = 50 kg
    // FCR correct = 15 / 50 = 0.3  (pas 30/50 = 0.6 qui serait le double-compte)
    const aliments: ReleveAliment[] = [
      { quantiteAliment: 15, consommations: [{ quantite: 15 }] },
    ];
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 100 }];
    const fcr = computeFCRMensuel(aliments, bios, 1000);
    expect(fcr).toBeCloseTo(0.3);
    expect(fcr).not.toBeCloseTo(0.6); // garantit absence de double-comptage
  });

  it("poids décroissant dans le mois → FCR null même si aliment présent", () => {
    // Gain négatif → calculerFCR retourne null (gainBiomasse <= 0)
    const aliments: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 5 }] },
    ];
    const bios: BioReleve[] = [{ poidsMoyen: 80 }, { poidsMoyen: 60 }];
    const fcr = computeFCRMensuel(aliments, bios, 1000);
    expect(fcr).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Régression — comparaison avant/après bugfix sur cas concret
// ---------------------------------------------------------------------------

describe("Régression — avant vs après bugfix (BUG 1)", () => {
  /**
   * Simule le BUG ORIGINAL (avant fix) : utilise uniquement quantiteAliment ?? 0
   */
  function sumAlimentOriginal(alimentations: ReleveAliment[]): number {
    return alimentations.reduce((s, r) => s + (r.quantiteAliment ?? 0), 0);
  }

  it("BUG ORIGINAL : relevé stock-linked → totalAliment = 0 (bug)", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 20 }] },
    ];
    // Bug : retournait 0 car quantiteAliment est null
    expect(sumAlimentOriginal(alimentations)).toBe(0);
  });

  it("FIX : relevé stock-linked → totalAliment = 20 (correct)", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 20 }] },
    ];
    // Fix : retourne 20 depuis les consommations
    expect(sumAlimentRelevesHybrid(alimentations)).toBe(20);
  });

  it("BUG ORIGINAL : fcrGlobal = null car totalAliment = 0 pour relevé stock-linked", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 30 }] },
    ];
    const totalAlimentBug = sumAlimentOriginal(alimentations); // = 0
    // calculerFCR(0, gain) = 0/gain = 0 (pas null), mais si on passe null...
    // En réalité : si totalAliment = 0 et qu'il y a un gain, FCR = 0 pas null
    // Le vrai bug : FCR = 0 au lieu de FCR = totalAliment_réel / gain
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 80 }];
    const gainBiomasse = computeGainIntraMois(bios, 1000); // 30 kg
    const fcrBug = calculerFCR(totalAlimentBug, gainBiomasse); // 0 / 30 = 0
    expect(fcrBug).toBeCloseTo(0); // FCR faussement à 0
  });

  it("FIX : fcrGlobal calculé correctement depuis les consommations", () => {
    const alimentations: ReleveAliment[] = [
      { quantiteAliment: null, consommations: [{ quantite: 30 }] },
    ];
    const totalAlimentFix = sumAlimentRelevesHybrid(alimentations); // = 30
    const bios: BioReleve[] = [{ poidsMoyen: 50 }, { poidsMoyen: 80 }];
    const gainBiomasse = computeGainIntraMois(bios, 1000); // 30 kg
    const fcrFix = calculerFCR(totalAlimentFix, gainBiomasse); // 30 / 30 = 1.0
    expect(fcrFix).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// Régression — avant vs après bugfix sur BUG 3
// ---------------------------------------------------------------------------

describe("Régression — avant vs après bugfix (BUG 3 : gain vie totale vs gain intra-mois)", () => {
  /**
   * Simule le BUG ORIGINAL BUG 3 :
   * gain = calculerBiomasse(poidsMoyenFin, nombreInitial) - calculerBiomasse(poidsMoyenInitialVague, nombreInitial)
   * où poidsMoyenInitialVague est le poids J0 de la vague (depuis le début de vie).
   */
  function computeGainVieTotal(
    poidsMoyenFin: number,
    poidsMoyenInitialVague: number,
    nombreInitial: number
  ): number | null {
    const biomasseFin = calculerBiomasse(poidsMoyenFin, nombreInitial);
    const biomasseInitiale = calculerBiomasse(poidsMoyenInitialVague, nombreInitial);
    if (biomasseFin !== null && biomasseInitiale !== null && biomasseFin > biomasseInitiale) {
      return biomasseFin - biomasseInitiale;
    }
    return null;
  }

  it("BUG ORIGINAL : même gain pour tous les mois car poidsMoyenInitial = J0 constant", () => {
    const poidsMoyenInitialVague = 5; // poids J0 (alevin au démarrage)
    const nombreInitial = 1000;

    // Mois 1 : poids fin de mois = 50g
    const gainMois1 = computeGainVieTotal(50, poidsMoyenInitialVague, nombreInitial);
    // Mois 2 : poids fin de mois = 80g (même calcul, même poidsMoyenInitialVague!)
    const gainMois2 = computeGainVieTotal(80, poidsMoyenInitialVague, nombreInitial);

    // Les deux gains sont différents mais tous les deux calculés depuis J0 — pas intra-mois
    // Mois 1 : (50-5)*1000/1000 = 45 kg (gain total depuis J0, pas mensuel)
    // Mois 2 : (80-5)*1000/1000 = 75 kg (idem)
    expect(gainMois1).toBeCloseTo(45); // gain depuis J0, pas gain mensuel
    expect(gainMois2).toBeCloseTo(75); // gain depuis J0, pas gain mensuel
    // Ces valeurs sont incorrectes pour calculer un FCR mensuel
  });

  it("FIX : gain intra-mois correct pour chaque mois", () => {
    const nombreInitial = 1000;

    // Mois 1 : première bio = 5g, dernière bio = 50g
    const biosMois1: BioReleve[] = [{ poidsMoyen: 5 }, { poidsMoyen: 50 }];
    const gainMois1 = computeGainIntraMois(biosMois1, nombreInitial);
    // (50-5)*1000/1000 = 45 kg de gain intra-mois

    // Mois 2 : première bio = 55g (début de mois 2), dernière bio = 80g
    const biosMois2: BioReleve[] = [{ poidsMoyen: 55 }, { poidsMoyen: 80 }];
    const gainMois2 = computeGainIntraMois(biosMois2, nombreInitial);
    // (80-55)*1000/1000 = 25 kg de gain intra-mois

    expect(gainMois1).toBeCloseTo(45);
    expect(gainMois2).toBeCloseTo(25);
    // Les deux valeurs représentent le vrai gain du mois, comparables entre eux
  });

  it("FIX : mois démarrage avec une seule biométrie → pas de point FCR émis", () => {
    // Au premier mois d'une vague, souvent une seule biométrie initiale
    const biosMois1: BioReleve[] = [{ poidsMoyen: 5 }];
    expect(computeGainIntraMois(biosMois1, 1000)).toBeNull();
    // Comportement correct : pas de FCR pour ce mois
  });
});
