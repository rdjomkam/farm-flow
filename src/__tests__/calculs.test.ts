import { describe, it, expect } from "vitest";
import {
  calculerTauxSurvie,
  calculerGainPoids,
  calculerSGR,
  calculerFCR,
  calculerBiomasse,
  calculerDensite,
  calculerTauxMortalite,
  calculerGainQuotidien,
  calculerCoutParKg,
  calculerROI,
  calculerFCRParAliment,
  calculerCoutParKgGain,
  genererRecommandation,
  getPrixParUniteBase,
  convertirQuantiteAchat,
  // Sprint 22 — fonctions de projection
  calculerSGRRequis,
  calculerDateRecolteEstimee,
  calculerAlimentRestantEstime,
  calculerRevenuAttendu,
  genererCourbeProjection,
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

// ---------------------------------------------------------------------------
// calculerDensite
// ---------------------------------------------------------------------------
describe("calculerDensite", () => {
  it("calcule la densite pour un bac de 1000L avec 75kg de biomasse", () => {
    // 75 kg / (1000L / 1000) = 75 kg/m³
    expect(calculerDensite(75, 1000)).toBe(75);
  });

  it("calcule la densite pour un grand bac", () => {
    // 50 kg / (5000L / 1000) = 50 / 5 = 10 kg/m³
    expect(calculerDensite(50, 5000)).toBe(10);
  });

  it("retourne null si biomasse est null", () => {
    expect(calculerDensite(null, 1000)).toBeNull();
  });

  it("retourne null si volume est null", () => {
    expect(calculerDensite(75, null)).toBeNull();
  });

  it("retourne null si volume est 0 (division par zero)", () => {
    expect(calculerDensite(75, 0)).toBeNull();
  });

  it("retourne null si volume est negatif", () => {
    expect(calculerDensite(75, -100)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerTauxMortalite
// ---------------------------------------------------------------------------
describe("calculerTauxMortalite", () => {
  it("calcule correctement le taux de mortalite", () => {
    // 50 morts sur 1000 → 5%
    expect(calculerTauxMortalite(50, 1000)).toBe(5);
  });

  it("retourne 0% quand aucune mortalite", () => {
    expect(calculerTauxMortalite(0, 500)).toBe(0);
  });

  it("retourne 100% quand tous sont morts", () => {
    expect(calculerTauxMortalite(500, 500)).toBe(100);
  });

  it("retourne null si totalMorts est null", () => {
    expect(calculerTauxMortalite(null, 500)).toBeNull();
  });

  it("retourne null si nombreInitial est null", () => {
    expect(calculerTauxMortalite(50, null)).toBeNull();
  });

  it("retourne null si nombreInitial est 0", () => {
    expect(calculerTauxMortalite(50, 0)).toBeNull();
  });

  it("retourne null si nombreInitial est negatif", () => {
    expect(calculerTauxMortalite(50, -10)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerGainQuotidien
// ---------------------------------------------------------------------------
describe("calculerGainQuotidien", () => {
  it("calcule le gain quotidien en kg/jour", () => {
    // 10 kg debut, 40 kg fin, 30 jours → 1 kg/jour
    expect(calculerGainQuotidien(10, 40, 30)).toBe(1);
  });

  it("retourne une valeur negative en cas de perte", () => {
    // 50 kg debut, 40 kg fin → perte
    expect(calculerGainQuotidien(50, 40, 10)).toBe(-1);
  });

  it("retourne 0 quand pas de changement", () => {
    expect(calculerGainQuotidien(30, 30, 10)).toBe(0);
  });

  it("retourne null si jours est 0", () => {
    expect(calculerGainQuotidien(10, 40, 0)).toBeNull();
  });

  it("retourne null si jours est negatif", () => {
    expect(calculerGainQuotidien(10, 40, -5)).toBeNull();
  });

  it("retourne null si biomasseDebut est null", () => {
    expect(calculerGainQuotidien(null, 40, 30)).toBeNull();
  });

  it("retourne null si biomasseFin est null", () => {
    expect(calculerGainQuotidien(10, null, 30)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerCoutParKg
// ---------------------------------------------------------------------------
describe("calculerCoutParKg", () => {
  it("calcule le cout par kg de biomasse produite", () => {
    // 5000 FCFA d'aliment, 10 kg de gain → 500 FCFA/kg
    expect(calculerCoutParKg(5000, 10)).toBe(500);
  });

  it("retourne null si gainBiomasse est 0", () => {
    expect(calculerCoutParKg(5000, 0)).toBeNull();
  });

  it("retourne null si gainBiomasse est negatif", () => {
    expect(calculerCoutParKg(5000, -10)).toBeNull();
  });

  it("retourne null si coutTotal est null", () => {
    expect(calculerCoutParKg(null, 10)).toBeNull();
  });

  it("retourne null si gainBiomasse est null", () => {
    expect(calculerCoutParKg(5000, null)).toBeNull();
  });

  it("retourne 0 si coutTotal est 0", () => {
    expect(calculerCoutParKg(0, 10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculerROI
// ---------------------------------------------------------------------------
describe("calculerROI", () => {
  it("calcule un ROI positif", () => {
    // Revenu 150000, cout 100000 → ROI = 50%
    expect(calculerROI(150000, 100000)).toBe(50);
  });

  it("calcule un ROI negatif (perte)", () => {
    // Revenu 80000, cout 100000 → ROI = -20%
    expect(calculerROI(80000, 100000)).toBe(-20);
  });

  it("calcule un ROI de 0% (seuil de rentabilite)", () => {
    expect(calculerROI(100000, 100000)).toBe(0);
  });

  it("retourne null si coutTotal est 0", () => {
    expect(calculerROI(100000, 0)).toBeNull();
  });

  it("retourne null si coutTotal est negatif", () => {
    expect(calculerROI(100000, -5000)).toBeNull();
  });

  it("retourne null si revenu est null", () => {
    expect(calculerROI(null, 100000)).toBeNull();
  });

  it("retourne null si coutTotal est null", () => {
    expect(calculerROI(100000, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerFCRParAliment (CR-011)
// ---------------------------------------------------------------------------
describe("calculerFCRParAliment", () => {
  it("calcule le FCR pondere pour une seule vague", () => {
    // 50 kg aliment, 40 kg gain → FCR = 1.25
    const result = calculerFCRParAliment([{ quantite: 50, gainBiomasse: 40 }]);
    expect(result).toBe(1.25);
  });

  it("calcule le FCR pondere pour plusieurs vagues", () => {
    // Vague 1: 30 kg aliment, 20 kg gain
    // Vague 2: 50 kg aliment, 30 kg gain
    // Total: 80 / 50 = 1.6
    const result = calculerFCRParAliment([
      { quantite: 30, gainBiomasse: 20 },
      { quantite: 50, gainBiomasse: 30 },
    ]);
    expect(result).toBe(1.6);
  });

  it("ignore les vagues sans gain de biomasse", () => {
    // Vague avec gain null est ignoree
    const result = calculerFCRParAliment([
      { quantite: 50, gainBiomasse: 40 },
      { quantite: 20, gainBiomasse: null },
    ]);
    expect(result).toBe(1.25);
  });

  it("ignore les vagues avec gain negatif", () => {
    const result = calculerFCRParAliment([
      { quantite: 50, gainBiomasse: 40 },
      { quantite: 20, gainBiomasse: -5 },
    ]);
    expect(result).toBe(1.25);
  });

  it("ignore les vagues avec gain = 0", () => {
    const result = calculerFCRParAliment([
      { quantite: 50, gainBiomasse: 40 },
      { quantite: 20, gainBiomasse: 0 },
    ]);
    expect(result).toBe(1.25);
  });

  it("retourne null si aucune vague valide", () => {
    expect(calculerFCRParAliment([
      { quantite: 10, gainBiomasse: null },
      { quantite: 20, gainBiomasse: -5 },
    ])).toBeNull();
  });

  it("retourne null si tableau vide", () => {
    expect(calculerFCRParAliment([])).toBeNull();
  });

  it("retourne null si toutes les quantites sont 0", () => {
    expect(calculerFCRParAliment([
      { quantite: 0, gainBiomasse: 40 },
    ])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculerCoutParKgGain (CR-011)
// ---------------------------------------------------------------------------
describe("calculerCoutParKgGain", () => {
  it("calcule le cout par kg de gain", () => {
    // 50 kg aliment × 2000 CFA/kg = 100 000 CFA / 40 kg gain = 2500 CFA/kg
    expect(calculerCoutParKgGain(50, 2000, 40)).toBe(2500);
  });

  it("retourne null si quantite est null", () => {
    expect(calculerCoutParKgGain(null, 2000, 40)).toBeNull();
  });

  it("retourne null si prixUnitaire est null", () => {
    expect(calculerCoutParKgGain(50, null, 40)).toBeNull();
  });

  it("retourne null si gainBiomasse est null", () => {
    expect(calculerCoutParKgGain(50, 2000, null)).toBeNull();
  });

  it("retourne null si quantite est 0", () => {
    expect(calculerCoutParKgGain(0, 2000, 40)).toBeNull();
  });

  it("retourne null si gainBiomasse est 0", () => {
    expect(calculerCoutParKgGain(50, 2000, 0)).toBeNull();
  });

  it("retourne null si gainBiomasse est negatif", () => {
    expect(calculerCoutParKgGain(50, 2000, -10)).toBeNull();
  });

  it("gere un aliment gratuit (prix 0)", () => {
    // 50 kg × 0 CFA / 40 kg = 0
    expect(calculerCoutParKgGain(50, 0, 40)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// genererRecommandation (CR-011)
// ---------------------------------------------------------------------------
describe("genererRecommandation", () => {
  it("genere une recommandation avec fournisseur et comparaison", () => {
    const result = genererRecommandation(
      { nom: "Raanan 42%", fournisseur: "AquaFeed", fcrMoyen: 1.52, coutParKgGain: 2280 },
      { nom: "Coppens Catfish", fcrMoyen: 1.85, coutParKgGain: 2960 }
    );
    expect(result).toContain("Raanan 42%");
    expect(result).toContain("AquaFeed");
    expect(result).toContain("1.52");
    expect(result).toContain("2280");
    expect(result).toContain("Coppens Catfish");
    expect(result).toContain("economiser");
  });

  it("genere une recommandation sans fournisseur", () => {
    const result = genererRecommandation(
      { nom: "Aliment A", fournisseur: null, fcrMoyen: 1.5, coutParKgGain: 3000 },
      null
    );
    expect(result).toContain("Aliment A");
    expect(result).not.toContain("fournisseur");
    expect(result).toContain("1.50");
  });

  it("genere une recommandation sans deuxieme aliment", () => {
    const result = genererRecommandation(
      { nom: "Aliment A", fournisseur: "Fourn", fcrMoyen: 1.5, coutParKgGain: 3000 },
      null
    );
    expect(result).toContain("Aliment A");
    expect(result).not.toContain("economiser");
  });

  it("ne mentionne pas l'economie si le deuxieme est meilleur", () => {
    const result = genererRecommandation(
      { nom: "Aliment A", fournisseur: null, fcrMoyen: 1.5, coutParKgGain: 3000 },
      { nom: "Aliment B", fcrMoyen: 1.8, coutParKgGain: 2500 }
    );
    expect(result).not.toContain("economiser");
  });

  it("retourne null si meilleur est null", () => {
    expect(genererRecommandation(null, null)).toBeNull();
  });

  it("retourne null si fcrMoyen est null", () => {
    expect(genererRecommandation(
      { nom: "A", fournisseur: null, fcrMoyen: null, coutParKgGain: 3000 },
      null
    )).toBeNull();
  });

  it("retourne null si coutParKgGain est null", () => {
    expect(genererRecommandation(
      { nom: "A", fournisseur: null, fcrMoyen: 1.5, coutParKgGain: null },
      null
    )).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPrixParUniteBase (Sprint 14 — conversion unites d'achat)
// ---------------------------------------------------------------------------
describe("getPrixParUniteBase", () => {
  it("retourne prixUnitaire / contenance quand uniteAchat + contenance definis", () => {
    // Farine de poisson: 15000 CFA/sac de 25 kg → 600 CFA/kg
    const result = getPrixParUniteBase({
      prixUnitaire: 15000,
      uniteAchat: "SACS",
      contenance: 25,
    });
    expect(result).toBe(600);
  });

  it("retourne prixUnitaire inchange quand pas d'uniteAchat", () => {
    const result = getPrixParUniteBase({
      prixUnitaire: 2000,
      uniteAchat: null,
      contenance: null,
    });
    expect(result).toBe(2000);
  });

  it("retourne prixUnitaire inchange quand uniteAchat undefined", () => {
    const result = getPrixParUniteBase({
      prixUnitaire: 2000,
    });
    expect(result).toBe(2000);
  });

  it("retourne prixUnitaire quand contenance est 0 (pas de division par zero)", () => {
    const result = getPrixParUniteBase({
      prixUnitaire: 15000,
      uniteAchat: "SACS",
      contenance: 0,
    });
    expect(result).toBe(15000);
  });

  it("retourne prixUnitaire quand contenance est null", () => {
    const result = getPrixParUniteBase({
      prixUnitaire: 15000,
      uniteAchat: "SACS",
      contenance: null,
    });
    expect(result).toBe(15000);
  });

  it("retourne prixUnitaire quand contenance est negative", () => {
    // contenance negative: contenance > 0 est false, fallback
    const result = getPrixParUniteBase({
      prixUnitaire: 15000,
      uniteAchat: "SACS",
      contenance: -5,
    });
    expect(result).toBe(15000);
  });

  it("gere un prix unitaire de 0", () => {
    const result = getPrixParUniteBase({
      prixUnitaire: 0,
      uniteAchat: "SACS",
      contenance: 25,
    });
    expect(result).toBe(0);
  });

  it("calcule correctement avec contenance decimale", () => {
    // 10000 CFA / 2.5 L = 4000 CFA/L
    const result = getPrixParUniteBase({
      prixUnitaire: 10000,
      uniteAchat: "LITRE",
      contenance: 2.5,
    });
    expect(result).toBe(4000);
  });
});

// ---------------------------------------------------------------------------
// convertirQuantiteAchat (Sprint 14 — conversion unites d'achat)
// ---------------------------------------------------------------------------
describe("convertirQuantiteAchat", () => {
  it("convertit quantite * contenance quand uniteAchat + contenance definis", () => {
    // 2 sacs de 25 kg → 50 kg
    const result = convertirQuantiteAchat(2, {
      uniteAchat: "SACS",
      contenance: 25,
    });
    expect(result).toBe(50);
  });

  it("retourne quantite inchangee quand pas d'uniteAchat", () => {
    const result = convertirQuantiteAchat(10, {
      uniteAchat: null,
      contenance: null,
    });
    expect(result).toBe(10);
  });

  it("retourne quantite inchangee quand uniteAchat undefined", () => {
    const result = convertirQuantiteAchat(10, {});
    expect(result).toBe(10);
  });

  it("retourne quantite inchangee quand contenance est null", () => {
    const result = convertirQuantiteAchat(10, {
      uniteAchat: "SACS",
      contenance: null,
    });
    expect(result).toBe(10);
  });

  it("retourne quantite inchangee quand contenance est 0", () => {
    const result = convertirQuantiteAchat(10, {
      uniteAchat: "SACS",
      contenance: 0,
    });
    expect(result).toBe(10);
  });

  it("retourne quantite inchangee quand contenance est negative", () => {
    const result = convertirQuantiteAchat(10, {
      uniteAchat: "SACS",
      contenance: -5,
    });
    expect(result).toBe(10);
  });

  it("gere une quantite de 0", () => {
    const result = convertirQuantiteAchat(0, {
      uniteAchat: "SACS",
      contenance: 25,
    });
    expect(result).toBe(0);
  });

  it("gere une contenance decimale", () => {
    // 3 bidons de 2.5 L → 7.5 L
    const result = convertirQuantiteAchat(3, {
      uniteAchat: "LITRE",
      contenance: 2.5,
    });
    expect(result).toBe(7.5);
  });

  it("gere une grande quantite", () => {
    // 100 sacs de 50 kg → 5000 kg
    const result = convertirQuantiteAchat(100, {
      uniteAchat: "SACS",
      contenance: 50,
    });
    expect(result).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Sprint 22 (S16-5) — Fonctions de projection de performance
// ---------------------------------------------------------------------------

describe("calculerSGRRequis", () => {
  it("calcule correctement le SGR requis pour atteindre l'objectif", () => {
    // Poids actuel 200g, objectif 800g, 60 jours restants
    const sgr = calculerSGRRequis(200, 800, 60);
    // SGR = (ln(800) - ln(200)) / 60 * 100 = ln(4) / 60 * 100 ≈ 2.31
    expect(sgr).not.toBeNull();
    expect(sgr!).toBeCloseTo(2.31, 1);
  });

  it("retourne null si poidsMoyenActuel est null", () => {
    expect(calculerSGRRequis(null, 800, 60)).toBeNull();
  });

  it("retourne null si poidsObjectif est null", () => {
    expect(calculerSGRRequis(200, null, 60)).toBeNull();
  });

  it("retourne null si joursRestants est null", () => {
    expect(calculerSGRRequis(200, 800, null)).toBeNull();
  });

  it("retourne null si poidsMoyenActuel <= 0", () => {
    expect(calculerSGRRequis(0, 800, 60)).toBeNull();
    expect(calculerSGRRequis(-10, 800, 60)).toBeNull();
  });

  it("retourne null si joursRestants <= 0", () => {
    expect(calculerSGRRequis(200, 800, 0)).toBeNull();
    expect(calculerSGRRequis(200, 800, -5)).toBeNull();
  });

  it("retourne 0 si poids actuel == objectif", () => {
    const sgr = calculerSGRRequis(800, 800, 60);
    expect(sgr).toBeCloseTo(0, 5);
  });
});

describe("calculerDateRecolteEstimee", () => {
  it("retourne une date dans le futur avec un SGR positif", () => {
    const now = new Date("2026-03-15");
    const date = calculerDateRecolteEstimee(200, 800, 2.31, now);
    expect(date).not.toBeNull();
    expect(date!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("retourne null si poidsMoyenActuel est null", () => {
    expect(calculerDateRecolteEstimee(null, 800, 2.31)).toBeNull();
  });

  it("retourne null si sgrActuel est null", () => {
    expect(calculerDateRecolteEstimee(200, 800, null)).toBeNull();
  });

  it("retourne null si sgrActuel <= 0", () => {
    expect(calculerDateRecolteEstimee(200, 800, 0)).toBeNull();
    expect(calculerDateRecolteEstimee(200, 800, -1)).toBeNull();
  });

  it("utilise la date courante si dateReference non fournie", () => {
    const date = calculerDateRecolteEstimee(200, 800, 2.31);
    expect(date).not.toBeNull();
    expect(date!.getTime()).toBeGreaterThan(Date.now());
  });

  it("retourne null si poids actuel >= objectif (objectif deja atteint)", () => {
    // Avec poids >= objectif, le logarithme sera <= 0, mais jours <= 0 pas capture dans la formule
    // On teste que ca ne plante pas (resultat peut etre retourne ou null selon le signe)
    const date = calculerDateRecolteEstimee(800, 800, 2.0);
    // ln(800) - ln(800) = 0, donc jours = 0 → retourne null
    expect(date).toBeNull();
  });
});

describe("calculerAlimentRestantEstime", () => {
  it("calcule correctement l'aliment restant", () => {
    // poids actuel 200g, objectif 800g, 500 poissons, FCR 1.5
    // gainBiomasse = (800-200) * 500 / 1000 = 300 kg
    // aliment = 300 * 1.5 = 450 kg
    const aliment = calculerAlimentRestantEstime(200, 800, 500, 1.5);
    expect(aliment).not.toBeNull();
    expect(aliment!).toBeCloseTo(450, 1);
  });

  it("retourne null si poidsMoyenActuel est null", () => {
    expect(calculerAlimentRestantEstime(null, 800, 500, 1.5)).toBeNull();
  });

  it("retourne null si poidsObjectif est null", () => {
    expect(calculerAlimentRestantEstime(200, null, 500, 1.5)).toBeNull();
  });

  it("retourne null si nombreVivants est null", () => {
    expect(calculerAlimentRestantEstime(200, 800, null, 1.5)).toBeNull();
  });

  it("retourne null si fcrActuel est null", () => {
    expect(calculerAlimentRestantEstime(200, 800, 500, null)).toBeNull();
  });

  it("retourne null si poidsObjectif <= poidsMoyenActuel (objectif deja atteint)", () => {
    expect(calculerAlimentRestantEstime(800, 800, 500, 1.5)).toBeNull();
    expect(calculerAlimentRestantEstime(900, 800, 500, 1.5)).toBeNull();
  });

  it("retourne null si nombreVivants <= 0", () => {
    expect(calculerAlimentRestantEstime(200, 800, 0, 1.5)).toBeNull();
  });
});

describe("calculerRevenuAttendu", () => {
  it("calcule correctement le revenu attendu", () => {
    // poids objectif 800g, 500 poissons, prix 2000 CFA/kg
    // biomasse = 800 * 500 / 1000 = 400 kg
    // revenu = 400 * 2000 = 800000 CFA
    const revenu = calculerRevenuAttendu(800, 500, 2000);
    expect(revenu).not.toBeNull();
    expect(revenu!).toBeCloseTo(800000, 0);
  });

  it("retourne null si prixVenteKg est null", () => {
    expect(calculerRevenuAttendu(800, 500, null)).toBeNull();
  });

  it("retourne null si poidsObjectif est null", () => {
    expect(calculerRevenuAttendu(null, 500, 2000)).toBeNull();
  });

  it("retourne null si nombreVivants est null", () => {
    expect(calculerRevenuAttendu(800, null, 2000)).toBeNull();
  });

  it("retourne null si prixVenteKg <= 0", () => {
    expect(calculerRevenuAttendu(800, 500, 0)).toBeNull();
    expect(calculerRevenuAttendu(800, 500, -100)).toBeNull();
  });
});

describe("genererCourbeProjection", () => {
  it("genere le bon nombre de points", () => {
    // 10 jours de projection → 11 points (J0 inclus)
    const points = genererCourbeProjection(200, 2.31, 10, 0);
    expect(points).toHaveLength(11);
  });

  it("le premier point correspond au poids actuel", () => {
    const points = genererCourbeProjection(200, 2.31, 10, 0);
    expect(points[0].poidsProjecte).toBe(200);
    expect(points[0].jour).toBe(0);
  });

  it("le poids augmente de jour en jour avec SGR positif", () => {
    const points = genererCourbeProjection(200, 2.31, 10, 0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].poidsProjecte).toBeGreaterThan(points[i - 1].poidsProjecte);
    }
  });

  it("prend en compte le jourDepart", () => {
    const points = genererCourbeProjection(200, 2.31, 5, 30);
    expect(points[0].jour).toBe(30);
    expect(points[5].jour).toBe(35);
  });

  it("retourne un tableau vide si poidsMoyenActuel est null", () => {
    expect(genererCourbeProjection(null, 2.31, 10, 0)).toHaveLength(0);
  });

  it("retourne un tableau vide si sgrActuel est null ou <= 0", () => {
    expect(genererCourbeProjection(200, null, 10, 0)).toHaveLength(0);
    expect(genererCourbeProjection(200, 0, 10, 0)).toHaveLength(0);
    expect(genererCourbeProjection(200, -1, 10, 0)).toHaveLength(0);
  });

  it("retourne un tableau vide si joursProjection <= 0", () => {
    expect(genererCourbeProjection(200, 2.31, 0, 0)).toHaveLength(0);
  });
});
