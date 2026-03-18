/**
 * Tests — template-engine.ts (Sprint 21, Story S15-10)
 *
 * Couvre :
 *   - resolveTemplate : resolution de chaque type de placeholder
 *   - Placeholder non resolu → "[donnee non disponible]" (EC-3.6)
 *   - buildPlaceholders : construction depuis le contexte
 *   - Formatage FR des nombres
 */

import { resolveTemplate, buildPlaceholders } from "@/lib/activity-engine/template-engine";

const UNAVAILABLE = "[donnee non disponible]";

// ---------------------------------------------------------------------------
// resolveTemplate
// ---------------------------------------------------------------------------

describe("resolveTemplate — resolution des placeholders", () => {
  it("resout un placeholder simple", () => {
    const result = resolveTemplate("Semaine {semaine}", { semaine: "3" });
    expect(result).toBe("Semaine 3");
  });

  it("resout plusieurs placeholders dans une meme chaine", () => {
    const result = resolveTemplate(
      "Alimentation J{semaine} — {quantite_calculee} kg pour {poids_moyen} g",
      { semaine: "3", quantite_calculee: "5,25", poids_moyen: "120" }
    );
    expect(result).toBe("Alimentation J3 — 5,25 kg pour 120 g");
  });

  it("remplace un placeholder inconnu par UNAVAILABLE (EC-3.6)", () => {
    const result = resolveTemplate("Valeur : {inconnu}", {});
    expect(result).toBe(`Valeur : ${UNAVAILABLE}`);
  });

  it("remplace un placeholder dont la valeur est undefined par UNAVAILABLE", () => {
    const result = resolveTemplate("Stock : {stock}", { stock: undefined });
    expect(result).toBe(`Stock : ${UNAVAILABLE}`);
  });

  it("remplace un placeholder dont la valeur est chaine vide par UNAVAILABLE", () => {
    const result = resolveTemplate("Produit : {produit}", { produit: "" });
    expect(result).toBe(`Produit : ${UNAVAILABLE}`);
  });

  it("conserve le texte autour des placeholders sans modification", () => {
    const result = resolveTemplate("Debut {valeur} Fin", { valeur: "OK" });
    expect(result).toBe("Debut OK Fin");
  });

  it("retourne la chaine inchangee si aucun placeholder", () => {
    const result = resolveTemplate("Aucun placeholder ici", {});
    expect(result).toBe("Aucun placeholder ici");
  });

  it("gere les placeholders consecutifs sans espaces", () => {
    const result = resolveTemplate("{semaine}/{jours_restants}", {
      semaine: "4",
      jours_restants: "80",
    });
    expect(result).toBe("4/80");
  });
});

// ---------------------------------------------------------------------------
// buildPlaceholders
// ---------------------------------------------------------------------------

describe("buildPlaceholders — construction depuis le contexte", () => {
  const baseCtx = {
    joursEcoules: 21,
    semaine: 4,
    indicateurs: {
      poidsMoyen: 120,
      fcr: 1.42,
      sgr: 2.15,
      tauxSurvie: 96.5,
      tauxMortaliteCumule: 3.5,
    },
    derniersReleves: [
      { tailleMoyenne: 18.5 },
    ],
  };

  it("resout semaine correctement", () => {
    const ph = buildPlaceholders(baseCtx, {});
    expect(ph.semaine).toBe("4");
  });

  it("resout poids_moyen avec 1 decimale en FR", () => {
    const ph = buildPlaceholders(baseCtx, {});
    // poidsMoyen=120 → formatNumber(120, 1) → "120" (FR locale)
    expect(ph.poids_moyen).toBe("120");
  });

  it("resout taille depuis le dernier releve avec tailleMoyenne", () => {
    const ph = buildPlaceholders(baseCtx, {});
    // tailleMoyenne=18.5 → formatNumber(18.5, 1)
    expect(ph.taille).toContain("18");
  });

  it("retourne UNAVAILABLE pour taille si aucun releve avec tailleMoyenne", () => {
    const ctx = { ...baseCtx, derniersReleves: [] };
    const ph = buildPlaceholders(ctx, {});
    expect(ph.taille).toBe(UNAVAILABLE);
  });

  it("resout valeur avec FCR en priorite sur SGR", () => {
    const ph = buildPlaceholders(baseCtx, {});
    // fcr=1.42 → valeur = "1,42" (FR)
    expect(ph.valeur).toContain("1");
    expect(ph.valeur).not.toBe(UNAVAILABLE);
  });

  it("resout valeur avec SGR si FCR null", () => {
    const ctx = {
      ...baseCtx,
      indicateurs: { ...baseCtx.indicateurs, fcr: null },
    };
    const ph = buildPlaceholders(ctx, {});
    expect(ph.valeur).not.toBe(UNAVAILABLE);
  });

  it("retourne UNAVAILABLE pour valeur si fcr et sgr null", () => {
    const ctx = {
      ...baseCtx,
      indicateurs: { ...baseCtx.indicateurs, fcr: null, sgr: null },
    };
    const ph = buildPlaceholders(ctx, {});
    expect(ph.valeur).toBe(UNAVAILABLE);
  });

  it("resout taux depuis tauxRationnement si fourni", () => {
    const ph = buildPlaceholders(baseCtx, { tauxRationnement: 3.5 });
    expect(ph.taux).not.toBe(UNAVAILABLE);
    // 3.5 → formatNumber(3.5, 2) en FR
    expect(ph.taux).toContain("3");
  });

  it("resout taux depuis tauxSurvie si tauxRationnement null", () => {
    const ph = buildPlaceholders(baseCtx, { tauxRationnement: null });
    // tauxSurvie=96.5 → formatNumber(96.5, 1)
    expect(ph.taux).not.toBe(UNAVAILABLE);
  });

  it("retourne UNAVAILABLE pour taux si tauxRationnement null et tauxSurvie null", () => {
    const ctx = {
      ...baseCtx,
      indicateurs: { ...baseCtx.indicateurs, tauxSurvie: null },
    };
    const ph = buildPlaceholders(ctx, { tauxRationnement: null });
    expect(ph.taux).toBe(UNAVAILABLE);
  });

  it("resout quantite_calculee en convertissant grammes → kg", () => {
    // 5000 grammes → 5 kg → "5"
    const ph = buildPlaceholders(baseCtx, { quantiteCalculee: 5000 });
    expect(ph.quantite_calculee).not.toBe(UNAVAILABLE);
    expect(ph.quantite_calculee).toContain("5");
  });

  it("retourne UNAVAILABLE pour quantite_calculee si null", () => {
    const ph = buildPlaceholders(baseCtx, { quantiteCalculee: null });
    expect(ph.quantite_calculee).toBe(UNAVAILABLE);
  });

  it("resout produit avec le nom fourni", () => {
    const ph = buildPlaceholders(baseCtx, { produitNom: "Farine de poisson" });
    expect(ph.produit).toBe("Farine de poisson");
  });

  it("retourne UNAVAILABLE pour produit si null", () => {
    const ph = buildPlaceholders(baseCtx, { produitNom: null });
    expect(ph.produit).toBe(UNAVAILABLE);
  });

  it("resout seuil avec la valeur fournie", () => {
    const ph = buildPlaceholders(baseCtx, { seuilValeur: 150 });
    expect(ph.seuil).not.toBe(UNAVAILABLE);
  });

  it("retourne UNAVAILABLE pour seuil si null", () => {
    const ph = buildPlaceholders(baseCtx, { seuilValeur: null });
    expect(ph.seuil).toBe(UNAVAILABLE);
  });

  it("resout jours_restants a partir de dureeEstimee - joursEcoules", () => {
    // joursEcoules=21, dureeEstimee=180 → joursRestants=159
    const ph = buildPlaceholders(baseCtx, { dureeEstimee: 180 });
    expect(ph.jours_restants).toBe("159");
  });

  it("retourne UNAVAILABLE pour jours_restants si dureeEstimee null", () => {
    const ph = buildPlaceholders(baseCtx, { dureeEstimee: null });
    expect(ph.jours_restants).toBe(UNAVAILABLE);
  });

  it("jours_restants = 0 si joursEcoules > dureeEstimee", () => {
    const ctx = { ...baseCtx, joursEcoules: 200 };
    const ph = buildPlaceholders(ctx, { dureeEstimee: 180 });
    expect(ph.jours_restants).toBe("0");
  });

  it("resout stock avec la quantite fournie", () => {
    const ph = buildPlaceholders(baseCtx, { stockQte: 125.5 });
    expect(ph.stock).not.toBe(UNAVAILABLE);
  });

  it("retourne UNAVAILABLE pour stock si null", () => {
    const ph = buildPlaceholders(baseCtx, { stockQte: null });
    expect(ph.stock).toBe(UNAVAILABLE);
  });

  it("resout quantite_recommandee si fournie", () => {
    const ph = buildPlaceholders(baseCtx, { quantiteRegle: 200 });
    expect(ph.quantite_recommandee).not.toBe(UNAVAILABLE);
  });

  it("retourne UNAVAILABLE pour quantite_recommandee si null", () => {
    const ph = buildPlaceholders(baseCtx, { quantiteRegle: null });
    expect(ph.quantite_recommandee).toBe(UNAVAILABLE);
  });
});

// ---------------------------------------------------------------------------
// Integration resolveTemplate + buildPlaceholders
// ---------------------------------------------------------------------------

describe("Integration — resolveTemplate + buildPlaceholders", () => {
  it("resout un template complet d'alimentation", () => {
    const ctx = {
      joursEcoules: 14,
      semaine: 3,
      indicateurs: {
        poidsMoyen: 80,
        fcr: 1.3,
        sgr: null,
        tauxSurvie: 97,
        tauxMortaliteCumule: 3,
      },
      derniersReleves: [{ tailleMoyenne: 12 }],
    };
    const placeholders = buildPlaceholders(ctx, {
      quantiteCalculee: 3500,
      produitNom: "Aliment granule 2mm",
    });
    const titre = resolveTemplate(
      "Alimentation semaine {semaine} — {quantite_calculee} kg ({produit})",
      placeholders
    );
    expect(titre).toContain("semaine 3");
    expect(titre).toContain("3,5");
    expect(titre).toContain("Aliment granule 2mm");
  });

  it("remplace les placeholders manquants par UNAVAILABLE dans le titre", () => {
    const ctx = {
      joursEcoules: 7,
      semaine: 2,
      indicateurs: {
        poidsMoyen: null,
        fcr: null,
        sgr: null,
        tauxSurvie: null,
        tauxMortaliteCumule: null,
      },
      derniersReleves: [],
    };
    const placeholders = buildPlaceholders(ctx, {});
    const titre = resolveTemplate("FCR : {valeur} / Poids : {poids_moyen}", placeholders);
    expect(titre).toContain(UNAVAILABLE);
  });
});

// ---------------------------------------------------------------------------
// Per-bac placeholder {bac}
// ---------------------------------------------------------------------------

describe("Placeholder {bac} — per-bac iteration", () => {
  const baseCtx = {
    joursEcoules: 14,
    semaine: 3,
    vague: { code: "V2026-001" },
    indicateurs: {
      poidsMoyen: 80,
      fcr: null,
      sgr: null,
      tauxSurvie: 97,
      tauxMortaliteCumule: 3,
      biomasse: 50,
    },
    derniersReleves: [] as { tailleMoyenne: number | null }[],
  };

  it("resout {bac} quand bacNom est fourni", () => {
    const ph = buildPlaceholders(baseCtx, { bacNom: "Bac Principal" });
    expect(ph.bac).toBe("Bac Principal");
    const titre = resolveTemplate("Activite pour {bac} — S{semaine}", ph);
    expect(titre).toBe("Activite pour Bac Principal — S3");
  });

  it("retourne UNAVAILABLE pour {bac} quand bacNom est null", () => {
    const ph = buildPlaceholders(baseCtx, { bacNom: null });
    expect(ph.bac).toBe(UNAVAILABLE);
  });
});
