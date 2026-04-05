/**
 * Tests unitaires pour src/lib/feed-periods.ts
 *
 * Couverture :
 *   - interpolerPoidsBac : biometrie exacte, interpolation lineaire, valeur initiale,
 *     cas limites (aucune biometrie, biometrie unique avant/apres, date apres toutes)
 *   - interpolerPoidsBac (ADR-029) : strategie GOMPERTZ_VAGUE, fallbacks
 *   - segmenterPeriodesAlimentaires :
 *     - Bac unique, produit unique (pas de switch) -> 1 periode
 *     - Bac unique, changement de produit au jour X -> 2 periodes
 *     - Deux bacs, produits differents -> periodes distinctes par bac
 *     - bacId null -> groupe sous bac "unknown"
 *     - Gain de biomasse negatif -> gainBiomasseKg = null
 *     - Entrees vides -> tableau vide
 *     - Releve sans consommation -> ignore
 *     - Calcul du gainBiomasseKg verifie sur des donnees reelles
 *   - segmenterPeriodesAlimentaires (ADR-029) : options Gompertz transmises, methodeEstimation
 *   - methodeRank : ordre de priorite 0-3 (VALEUR_INITIALE < LINEAIRE < GOMPERTZ_VAGUE < BIOMETRIE_EXACTE)
 *
 * ADR-028 — FCR feed-switching accuracy.
 * ADR-029 — Configurable interpolation strategy (LINEAIRE vs GOMPERTZ_VAGUE).
 */

import { describe, it, expect } from "vitest";
import {
  interpolerPoidsBac,
  segmenterPeriodesAlimentaires,
  estimerNombreVivantsADate,
  type ReleveAlimPoint,
  type BiometriePoint,
  type VagueContext,
  type GompertzVagueContext,
  type CalibragePoint,
} from "@/lib/feed-periods";
import { gompertzWeight } from "@/lib/gompertz";
import { StrategieInterpolation } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDate(offsetDays: number): Date {
  // All dates relative to a fixed epoch to keep tests deterministic
  const base = new Date("2026-01-01T00:00:00.000Z");
  return new Date(base.getTime() + offsetDays * 86_400_000);
}

function makeBio(bacId: string | null, offsetDays: number, poidsMoyen: number): BiometriePoint {
  return { bacId, date: makeDate(offsetDays), poidsMoyen };
}

function makeReleve(
  releveId: string,
  bacId: string | null,
  offsetDays: number,
  consommations: { produitId: string; quantiteKg: number }[]
): ReleveAlimPoint {
  return { releveId, bacId, date: makeDate(offsetDays), consommations };
}

const BASE_VAGUE_CONTEXT: VagueContext = {
  dateDebut: makeDate(0),
  nombreInitial: 1000,
  poidsMoyenInitial: 10, // 10g
  bacs: [{ id: "bac-A", nombreInitial: 500 }, { id: "bac-B", nombreInitial: 500 }],
};

// ---------------------------------------------------------------------------
// interpolerPoidsBac
// ---------------------------------------------------------------------------

describe("interpolerPoidsBac", () => {
  it("biometrie exacte le meme jour -> BIOMETRIE_EXACTE", () => {
    const biometries: BiometriePoint[] = [makeBio("bac-A", 5, 50)];
    const result = interpolerPoidsBac(makeDate(5), "bac-A", biometries, 10);
    expect(result).not.toBeNull();
    expect(result!.poids).toBe(50);
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
  });

  it("biometrie exacte : l'heure ne compte pas, seul le jour calendaire", () => {
    // biometrie a 08:00, cible a 18:00 le meme jour
    const bioDate = new Date("2026-01-06T08:00:00.000Z");
    const targetDate = new Date("2026-01-06T18:00:00.000Z");
    const biometries: BiometriePoint[] = [{ bacId: "bac-A", date: bioDate, poidsMoyen: 55 }];
    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10);
    expect(result!.poids).toBe(55);
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
  });

  it("interpolation lineaire entre deux biometries qui encadrent la date cible", () => {
    // J0 = 10g, J10 = 20g, cible = J5 -> 15g
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 10, 20),
    ];
    const result = interpolerPoidsBac(makeDate(5), "bac-A", biometries, 5);
    expect(result).not.toBeNull();
    expect(result!.poids).toBeCloseTo(15, 5);
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  it("interpolation lineaire : progression non uniforme (2/3 du chemin)", () => {
    // J0 = 100g, J30 = 160g, cible = J20 -> 140g
    // 100 + (160-100) * (20/30) = 100 + 60 * 0.6667 = 140
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 100),
      makeBio("bac-A", 30, 160),
    ];
    const result = interpolerPoidsBac(makeDate(20), "bac-A", biometries, 50);
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
    expect(result!.poids).toBeCloseTo(140, 3);
  });

  it("date avant toutes les biometries -> VALEUR_INITIALE", () => {
    const biometries: BiometriePoint[] = [makeBio("bac-A", 10, 50)];
    const result = interpolerPoidsBac(makeDate(3), "bac-A", biometries, 10);
    expect(result).not.toBeNull();
    expect(result!.poids).toBe(10);
    expect(result!.methode).toBe("VALEUR_INITIALE");
  });

  it("date apres toutes les biometries -> derniere biometrie connue (BIOMETRIE_EXACTE)", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40),
      makeBio("bac-A", 10, 60),
    ];
    const result = interpolerPoidsBac(makeDate(15), "bac-A", biometries, 10);
    expect(result).not.toBeNull();
    // La derniere biometrie = 60g
    expect(result!.poids).toBe(60);
    // Le code utilise methode INTERPOLATION_LINEAIRE pour le cas "before only" (extrapolation)
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  it("aucune biometrie pour ce bac -> fallback sur poidsInitial (VALEUR_INITIALE)", () => {
    const biometries: BiometriePoint[] = [makeBio("bac-B", 5, 50)]; // autre bac
    const result = interpolerPoidsBac(makeDate(5), "bac-A", biometries, 10);
    expect(result).not.toBeNull();
    expect(result!.poids).toBe(10);
    expect(result!.methode).toBe("VALEUR_INITIALE");
  });

  it("aucune biometrie du tout -> fallback sur poidsInitial", () => {
    const result = interpolerPoidsBac(makeDate(5), "bac-A", [], 10);
    expect(result).not.toBeNull();
    expect(result!.poids).toBe(10);
    expect(result!.methode).toBe("VALEUR_INITIALE");
  });

  it("bacId null : filtre uniquement les biometries null", () => {
    const biometries: BiometriePoint[] = [
      makeBio(null, 5, 77),
      makeBio("bac-A", 5, 99),
    ];
    const result = interpolerPoidsBac(makeDate(5), null, biometries, 10);
    expect(result!.poids).toBe(77);
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
  });

  it("biometrie unique exactement le meme jour -> BIOMETRIE_EXACTE", () => {
    const biometries: BiometriePoint[] = [makeBio("bac-A", 7, 88)];
    const result = interpolerPoidsBac(makeDate(7), "bac-A", biometries, 10);
    expect(result!.poids).toBe(88);
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
  });
});

// ---------------------------------------------------------------------------
// segmenterPeriodesAlimentaires
// ---------------------------------------------------------------------------

describe("segmenterPeriodesAlimentaires", () => {
  it("entrees vides -> tableau vide", () => {
    const result = segmenterPeriodesAlimentaires([], [], BASE_VAGUE_CONTEXT);
    expect(result).toEqual([]);
  });

  it("releves sans consommations -> tableau vide", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, []),
      makeReleve("r2", "bac-A", 3, []),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(0);
  });

  // ----- Bac unique, produit unique (pas de changement) -------------------

  it("bac unique, produit unique -> 1 periode", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r3", "bac-A", 10, [{ produitId: "prod-X", quantiteKg: 2 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].produitId).toBe("prod-X");
    expect(result[0].bacId).toBe("bac-A");
    expect(result[0].quantiteKg).toBe(6);
  });

  it("bac unique, produit unique -> dateDebut et dateFin correspondent aux bornes", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 2, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 8, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result[0].dateDebut.getTime()).toBe(makeDate(2).getTime());
    expect(result[0].dateFin.getTime()).toBe(makeDate(8).getTime());
  });

  // ----- Bac unique, changement de produit --------------------------------

  it("bac unique, changement de produit au jour X -> 2 periodes", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 7, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r3", "bac-A", 14, [{ produitId: "prod-Y", quantiteKg: 3 }]), // switch
      makeReleve("r4", "bac-A", 21, [{ produitId: "prod-Y", quantiteKg: 3 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(2);

    const periodeX = result.find((p) => p.produitId === "prod-X");
    const periodeY = result.find((p) => p.produitId === "prod-Y");

    expect(periodeX).toBeDefined();
    expect(periodeY).toBeDefined();
    expect(periodeX!.quantiteKg).toBe(4);
    expect(periodeY!.quantiteKg).toBe(6);
  });

  it("changement de produit : les dates de bornes sont correctes", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 0, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 10, [{ produitId: "prod-Y", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(2);
    const periodeX = result.find((p) => p.produitId === "prod-X")!;
    const periodeY = result.find((p) => p.produitId === "prod-Y")!;
    // periode X : debut = J0, fin = J0
    expect(periodeX.dateDebut.getTime()).toBe(makeDate(0).getTime());
    expect(periodeX.dateFin.getTime()).toBe(makeDate(0).getTime());
    // periode Y : debut = J10, fin = J10
    expect(periodeY.dateDebut.getTime()).toBe(makeDate(10).getTime());
    expect(periodeY.dateFin.getTime()).toBe(makeDate(10).getTime());
  });

  // ----- Deux bacs, produits differents -----------------------------------

  it("deux bacs avec produits differents -> periodes separees par bac", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r3", "bac-B", 1, [{ produitId: "prod-Y", quantiteKg: 3 }]),
      makeReleve("r4", "bac-B", 5, [{ produitId: "prod-Y", quantiteKg: 3 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(2);

    const periodeA = result.find((p) => p.bacId === "bac-A");
    const periodeB = result.find((p) => p.bacId === "bac-B");
    expect(periodeA!.produitId).toBe("prod-X");
    expect(periodeB!.produitId).toBe("prod-Y");
  });

  it("deux bacs, bac-A switch + bac-B stable -> 3 periodes au total", () => {
    const releves: ReleveAlimPoint[] = [
      // Bac A : prod-X puis prod-Y
      makeReleve("r1", "bac-A", 0, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 7, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r3", "bac-A", 14, [{ produitId: "prod-Y", quantiteKg: 3 }]),
      // Bac B : prod-X tout le temps
      makeReleve("r4", "bac-B", 0, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r5", "bac-B", 7, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r6", "bac-B", 14, [{ produitId: "prod-X", quantiteKg: 2 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    // bac-A : 2 periodes (prod-X puis prod-Y)
    // bac-B : 1 periode (prod-X)
    expect(result).toHaveLength(3);

    const bacAperiods = result.filter((p) => p.bacId === "bac-A");
    const bacBperiods = result.filter((p) => p.bacId === "bac-B");
    expect(bacAperiods).toHaveLength(2);
    expect(bacBperiods).toHaveLength(1);
  });

  // ----- bacId null -> fallback "unknown" ---------------------------------

  it("bacId null -> bacId resultat = 'unknown'", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", null, 1, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", null, 5, [{ produitId: "prod-X", quantiteKg: 2 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].bacId).toBe("unknown");
  });

  it("bacId null -> nombreVivants utilise nombreInitial de la vague", () => {
    const context: VagueContext = {
      dateDebut: makeDate(0),
      nombreInitial: 800,
      poidsMoyenInitial: 10,
      bacs: [],
    };
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", null, 1, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], context);
    expect(result[0].nombreVivants).toBe(800);
  });

  // ----- Gain de biomasse negatif -> exclusion ----------------------------

  it("gain de biomasse negatif -> gainBiomasseKg = null (anti-gain exclu)", () => {
    // poidsMoyen debut = 100g, fin = 80g -> gain negatif
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 100), // J0
      makeBio("bac-A", 10, 80), // J10 (perte)
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 0, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 10, [{ produitId: "prod-X", quantiteKg: 2 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].gainBiomasseKg).toBeNull();
  });

  // ----- Calcul correct du gainBiomasseKg ---------------------------------

  it("gainBiomasseKg calcule correctement avec biometrie exacte", () => {
    // Bac A : 500 poissons (nombreInitial defini), debut 10g, fin 50g
    // gain = (50 - 10) * 500 / 1000 = 20 kg
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 1, 10),
      makeBio("bac-A", 10, 50),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r2", "bac-A", 10, [{ produitId: "prod-X", quantiteKg: 5 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].gainBiomasseKg).toBeCloseTo(20, 5);
  });

  it("gainBiomasseKg avec interpolation lineaire pour les bornes", () => {
    // Biometries : J0 = 10g, J20 = 30g
    // Releves alimentation : J5 a J15 (un seul produit)
    // poidsMoyenDebut = interpoler(J5) = 10 + (30-10) * (5/20) = 15g
    // poidsMoyenFin   = interpoler(J15) = 10 + (30-10) * (15/20) = 25g
    // nombreVivants = 500 (bac-A, nombreInitial=500)
    // gain = (25 - 15) * 500 / 1000 = 5 kg
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 20, 30),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 15, [{ produitId: "prod-X", quantiteKg: 2 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);
    expect(result[0].methodeEstimation).toBe("INTERPOLATION_LINEAIRE");
    expect(result[0].gainBiomasseKg).toBeCloseTo(5, 3);
  });

  // ----- methodeEstimation choisit la moins precise des deux bornes (indicateur conservateur) --------

  it("methodeEstimation = BIOMETRIE_EXACTE si debut exact et fin exact", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 1, 20),
      makeBio("bac-A", 7, 40),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 7, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);
    expect(result[0].methodeEstimation).toBe("BIOMETRIE_EXACTE");
  });

  it("methodeEstimation = VALEUR_INITIALE quand aucune biometrie n'est disponible", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result[0].methodeEstimation).toBe("VALEUR_INITIALE");
    // Pas de gain : debut = fin = poidsInitial = 10g
    expect(result[0].gainBiomasseKg).toBeNull();
  });

  // ----- Produit principal = celui dont quantiteKg est le plus haut ------

  it("plusieurs produits par releve : le produit principal est celui avec quantiteKg max", () => {
    // prod-X = 0.5kg, prod-Y = 2kg -> prod-Y est principal
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [
        { produitId: "prod-X", quantiteKg: 0.5 },
        { produitId: "prod-Y", quantiteKg: 2 },
      ]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].produitId).toBe("prod-Y");
    // quantiteKg ne compte que le produit principal de la periode
    expect(result[0].quantiteKg).toBe(2);
  });

  it("quantiteKg totalise uniquement les kg du produit de la periode", () => {
    // Chaque releve a prod-X = 2kg et prod-supplement = 0.3kg
    // Seul prod-X doit etre totalise pour la periode prod-X
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [
        { produitId: "prod-X", quantiteKg: 2 },
        { produitId: "prod-sup", quantiteKg: 0.3 },
      ]),
      makeReleve("r2", "bac-A", 5, [
        { produitId: "prod-X", quantiteKg: 2 },
        { produitId: "prod-sup", quantiteKg: 0.3 },
      ]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result[0].quantiteKg).toBe(4); // 2 + 2, pas 4.6
  });

  // ----- nombreVivants distribue equitablement quand pas de nombreInitial bac -----

  it("nombreVivants : distribution equitable si bac.nombreInitial = null", () => {
    const context: VagueContext = {
      dateDebut: makeDate(0),
      nombreInitial: 1000,
      poidsMoyenInitial: 10,
      bacs: [
        { id: "bac-A", nombreInitial: null },
        { id: "bac-B", nombreInitial: null },
      ],
    };
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], context);
    // 1000 / 2 bacs = 500
    expect(result[0].nombreVivants).toBe(500);
  });

  // ----- Scenario complet : mono-aliment vs comportement attendu ----------

  it("scenario complet mono-aliment : resultat coherent avec l'ancien algorithme", () => {
    // Vague avec 1 bac, 1 aliment, biometries reelles
    // poids debut = 10g, poids fin = 50g, 500 poissons, 15kg aliment
    // gain = (50-10)*500/1000 = 20 kg
    // FCR attendu = 15/20 = 0.75 (calcule en dehors, on verifie juste gain et quantite)
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 1, 10),
      makeBio("bac-A", 30, 50),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 10, [{ produitId: "prod-X", quantiteKg: 4 }]),
      makeReleve("r3", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 4 }]),
      makeReleve("r4", "bac-A", 30, [{ produitId: "prod-X", quantiteKg: 4 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].quantiteKg).toBe(15);
    expect(result[0].gainBiomasseKg).toBeCloseTo(20, 5);
  });

  // ----- Scenario switch partiel (ADR-028 cas emblematique) ---------------

  it("scenario switch partiel : bac-A change, bac-B stable -> FCR par produit correct", () => {
    // J0-J21 : bac-A + bac-B sur prod-X (Skretting 2mm)
    // J21+   : bac-A passe prod-Y (Skretting 3mm), bac-B reste prod-X
    // Biometries : debut = 20g, fin = 80g pour les deux bacs
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 20),
      makeBio("bac-A", 40, 80),
      makeBio("bac-B", 0, 20),
      makeBio("bac-B", 40, 80),
    ];

    const releves: ReleveAlimPoint[] = [
      // Bac A : prod-X J0-J21
      makeReleve("r1", "bac-A", 0, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r2", "bac-A", 7, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r3", "bac-A", 14, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r4", "bac-A", 21, [{ produitId: "prod-X", quantiteKg: 5 }]),
      // Bac A : prod-Y J28-J40
      makeReleve("r5", "bac-A", 28, [{ produitId: "prod-Y", quantiteKg: 6 }]),
      makeReleve("r6", "bac-A", 35, [{ produitId: "prod-Y", quantiteKg: 6 }]),
      makeReleve("r7", "bac-A", 40, [{ produitId: "prod-Y", quantiteKg: 6 }]),
      // Bac B : prod-X tout le temps
      makeReleve("r8", "bac-B", 0, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r9", "bac-B", 7, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r10", "bac-B", 14, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r11", "bac-B", 21, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r12", "bac-B", 28, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r13", "bac-B", 35, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r14", "bac-B", 40, [{ produitId: "prod-X", quantiteKg: 5 }]),
    ];

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);

    // bac-A : 2 periodes (prod-X J0-J21, prod-Y J28-J40)
    // bac-B : 1 periode  (prod-X J0-J40)
    expect(result).toHaveLength(3);

    const periodesX = result.filter((p) => p.produitId === "prod-X");
    const periodesY = result.filter((p) => p.produitId === "prod-Y");
    expect(periodesX).toHaveLength(2);
    expect(periodesY).toHaveLength(1);

    // prod-Y ne concerne que bac-A
    expect(periodesY[0].bacId).toBe("bac-A");

    // Les gains de biomasse sont positifs (80 > 20)
    for (const p of result) {
      if (p.gainBiomasseKg !== null) {
        expect(p.gainBiomasseKg).toBeGreaterThan(0);
      }
    }
  });

  // ----- Releves non tries en entree -> tris correctement ----------------

  it("releves en entree dans le desordre -> tries par date avant segmentation", () => {
    // Ordre inverse : J10, J5, J1 - resultat doit etre 1 periode de J1 a J10
    const releves: ReleveAlimPoint[] = [
      makeReleve("r3", "bac-A", 10, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 2 }]),
      makeReleve("r2", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 2 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].dateDebut.getTime()).toBe(makeDate(1).getTime());
    expect(result[0].dateFin.getTime()).toBe(makeDate(10).getTime());
    expect(result[0].quantiteKg).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// ADR-029 — interpolerPoidsBac avec strategie GOMPERTZ_VAGUE
// ---------------------------------------------------------------------------

/**
 * Contexte Gompertz valide par defaut pour les tests ADR-029.
 *
 * Parametres biologiquement plausibles pour Clarias gariepinus.
 * Vague debut = makeDate(0) (2026-01-01).
 * HIGH confidence : biometrieCount >= 8, r2 > 0.95.
 */
const GOMPERTZ_CTX_HIGH: GompertzVagueContext = {
  wInfinity: 1200,
  k: 0.018,
  ti: 95,
  r2: 0.97,
  biometrieCount: 10,
  confidenceLevel: "HIGH",
  vagueDebut: makeDate(0),
};

const GOMPERTZ_CTX_MEDIUM: GompertzVagueContext = {
  wInfinity: 1200,
  k: 0.018,
  ti: 95,
  r2: 0.87,
  biometrieCount: 7,
  confidenceLevel: "MEDIUM",
  vagueDebut: makeDate(0),
};

describe("interpolerPoidsBac — strategie GOMPERTZ_VAGUE (ADR-029)", () => {
  // ---- Cas nominal : Gompertz HIGH, valeurs valides ----------------------

  it("strategie GOMPERTZ_VAGUE + contexte HIGH valid -> retourne le poids Gompertz", () => {
    const targetDate = makeDate(50); // t = 50 jours depuis vagueDebut
    const expectedPoids = gompertzWeight(50, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80), // pas de biometrie exacte a J50
    ];

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  it("strategie GOMPERTZ_VAGUE + contexte MEDIUM valid -> methode = GOMPERTZ_VAGUE", () => {
    const targetDate = makeDate(30);
    const expectedPoids = gompertzWeight(30, {
      wInfinity: GOMPERTZ_CTX_MEDIUM.wInfinity,
      k: GOMPERTZ_CTX_MEDIUM.k,
      ti: GOMPERTZ_CTX_MEDIUM.ti,
    });

    // Au moins une biometrie pour le bac (non exacte) pour passer la garde "bacBios.length === 0"
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40), // avant targetDate, pas exacte
    ];

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_MEDIUM,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  // ---- Biometrie exacte prime toujours sur Gompertz (etape 1 inchangee) --

  it("biometrie exacte le meme jour prime sur Gompertz", () => {
    // La biometrie dit 999g, Gompertz donnerait une autre valeur
    const targetDate = makeDate(50);
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 50, 999), // biometrie exacte a J50
    ];

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
    expect(result!.poids).toBe(999);
  });

  // ---- Fallback : confidence insuffisante --------------------------------

  it("gompertzContext.confidenceLevel = LOW -> fallback INTERPOLATION_LINEAIRE", () => {
    const ctxLow: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      confidenceLevel: "LOW",
      r2: 0.88, // r2 ok mais niveau LOW -> refus
    };
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxLow,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  it("gompertzContext.confidenceLevel = INSUFFICIENT_DATA -> fallback INTERPOLATION_LINEAIRE", () => {
    const ctxInsufficient: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      confidenceLevel: "INSUFFICIENT_DATA",
      r2: 0.97,
    };
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxInsufficient,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  // ---- Fallback : r2 insuffisant ----------------------------------------

  it("r2 < 0.85 -> fallback INTERPOLATION_LINEAIRE", () => {
    const ctxBadR2: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      r2: 0.80, // en-dessous du seuil 0.85
      confidenceLevel: "HIGH",
    };
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxBadR2,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  it("r2 exactement = 0.85 -> Gompertz accepte (seuil inclusif)", () => {
    const ctxR2Limite: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      r2: 0.85,
    };
    // Une biometrie non exacte pour passer la garde "bacBios.length === 0"
    // Si Gompertz n'est pas utilise on tomberait sur INTERPOLATION_LINEAIRE (une seule bio avant)
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40), // avant J50, pas exacte
    ];
    const result = interpolerPoidsBac(makeDate(50), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxR2Limite,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
  });

  // ---- Fallback : biometrieCount insuffisant -----------------------------

  it("biometrieCount < gompertzMinPoints -> fallback INTERPOLATION_LINEAIRE", () => {
    const ctxFewPoints: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      biometrieCount: 3, // sous le seuil par defaut de 5
    };
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxFewPoints,
      gompertzMinPoints: 5, // seuil = 5, biometrieCount = 3 -> refus
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  it("biometrieCount = gompertzMinPoints -> Gompertz accepte (valeur exacte suffit)", () => {
    const ctxExactPoints: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      biometrieCount: 5,
    };
    // Une biometrie non exacte pour passer la garde "bacBios.length === 0"
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40),
    ];
    const result = interpolerPoidsBac(makeDate(50), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxExactPoints,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
  });

  // ---- Fallback : gompertzContext absent ---------------------------------

  it("gompertzContext undefined -> fallback INTERPOLATION_LINEAIRE", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: undefined, // pas de contexte
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  // ---- Fallback : t negatif (targetDate avant vagueDebut) ----------------

  it("targetDate avant vagueDebut (t negatif) -> fallback INTERPOLATION_LINEAIRE", () => {
    const ctx: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      vagueDebut: makeDate(10), // vague debut = J10
    };
    // targetDate = J5, donc t = 5 - 10 = -5 jours -> t negatif -> fallback
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 1, 10),
      makeBio("bac-A", 20, 50),
    ];
    const result = interpolerPoidsBac(makeDate(5), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctx,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  // ---- Strategie LINEAIRE ignore le contexte Gompertz -------------------

  it("strategie LINEAIRE ignore gompertzContext, utilise l'interpolation lineaire", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.LINEAIRE,
      gompertzContext: GOMPERTZ_CTX_HIGH, // fourni mais ignore
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
    // interpolation lineaire : 10 + (200-10) * (30/60) = 10 + 95 = 105g
    expect(result!.poids).toBeCloseTo(105, 3);
  });

  it("sans options du tout -> comportement ADR-028 (LINEAIRE par defaut)", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10);

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  // ---- Gompertz avec n=3 (minimum) et r2 ~ 1.0 -------------------------

  it("Gompertz avec gompertzMinPoints=3 et r2=0.999 -> Gompertz utilise (trade-off accepte)", () => {
    const ctxN3: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      biometrieCount: 3,
      r2: 0.999, // r2 ~ 1.0 avec n=3 (overfitting acceptable selon ADR-029)
      confidenceLevel: "HIGH",
    };
    // Une biometrie non exacte pour passer la garde "bacBios.length === 0"
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40),
    ];
    const result = interpolerPoidsBac(makeDate(50), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxN3,
      gompertzMinPoints: 3, // seuil abaisse a 3 par l'eleveur
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    const expectedPoids = gompertzWeight(50, {
      wInfinity: ctxN3.wInfinity,
      k: ctxN3.k,
      ti: ctxN3.ti,
    });
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  // ---- gompertzMinPoints par defaut = 5 quand non fourni -----------------

  it("gompertzMinPoints absent dans options -> defaut = 5 (biometrieCount=4 -> refus)", () => {
    // biometrieCount = 4 < 5 (defaut) -> refus -> fallback LINEAIRE
    const ctxCount4: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      biometrieCount: 4,
    };
    // Biometries encadrantes pour que le fallback LINEAIRE soit actif (pas VALEUR_INITIALE)
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxCount4,
      // gompertzMinPoints non fourni -> defaut = 5
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });
});

// ---------------------------------------------------------------------------
// ADR-029 — segmenterPeriodesAlimentaires avec options Gompertz
// ---------------------------------------------------------------------------

describe("segmenterPeriodesAlimentaires — strategie GOMPERTZ_VAGUE (ADR-029)", () => {
  it("options transmises : periodes utilisent GOMPERTZ_VAGUE quand Gompertz valide", () => {
    // Vague debut = makeDate(0)
    // Releves a J5 et J20 (dates de borne)
    // Gompertz valid HIGH -> methodeEstimation doit refleter GOMPERTZ_VAGUE
    // Une biometrie non exacte est fournie pour tester la priorite Gompertz vs lineaire
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 2, 25), // non exacte par rapport a J5 et J20
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_VAGUE");
  });

  it("sans options -> comportement ADR-028 preserve (VALEUR_INITIALE sans biometries)", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT);

    expect(result).toHaveLength(1);
    // Sans biometries et sans Gompertz -> VALEUR_INITIALE
    expect(result[0].methodeEstimation).toBe("VALEUR_INITIALE");
  });

  it("options Gompertz LOW -> methodeEstimation = VALEUR_INITIALE (pas de biometries, fallback lineaire -> valeur initiale)", () => {
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const ctxLow: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      confidenceLevel: "LOW",
    };
    const result = segmenterPeriodesAlimentaires(releves, [], BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxLow,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    // LOW -> fallback lineaire -> pas de biometries -> VALEUR_INITIALE
    expect(result[0].methodeEstimation).toBe("VALEUR_INITIALE");
  });

  it("Gompertz avec biometrie exacte sur une borne -> methode = GOMPERTZ_VAGUE (borne sans biometrie)", () => {
    // J5 : biometrie exacte -> BIOMETRIE_EXACTE (rang 3)
    // J20 : pas de biometrie -> GOMPERTZ_VAGUE (rang 2)
    // methodeEstimation = min(3, 2) -> GOMPERTZ_VAGUE
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 50), // exacte au debut de la periode
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    // debut = BIOMETRIE_EXACTE (rang 3), fin = GOMPERTZ_VAGUE (rang 2)
    // methodeRank(debut)=3 > methodeRank(fin)=2 -> retourne la methode de fin = GOMPERTZ_VAGUE
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_VAGUE");
  });

  it("Gompertz avec deux biometries exactes sur les deux bornes -> BIOMETRIE_EXACTE", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 50),
      makeBio("bac-A", 20, 150),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    // Les deux bornes sont exactes -> Gompertz n'est jamais utilise pour etape 1
    expect(result[0].methodeEstimation).toBe("BIOMETRIE_EXACTE");
  });

  it("gainBiomasseKg calcule avec poids Gompertz aux bornes", () => {
    // J5 et J25 : pas de biometries exactes -> Gompertz utilise pour les deux bornes
    // poidsDebut = gompertzWeight(5, params)
    // poidsFin   = gompertzWeight(25, params)
    // nombreVivants = 500 (bac-A, nombreInitial=500)
    // gain = (poidsFin - poidsDebut) * 500 / 1000
    //
    // Note : une biometrie non exacte est necessaire pour eviter la garde precoce
    // "bacBios.length === 0" -> VALEUR_INITIALE
    const targetDebut = 5;
    const targetFin = 25;
    const poidsDebut = gompertzWeight(targetDebut, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });
    const poidsFin = gompertzWeight(targetFin, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });
    const expectedGain = ((poidsFin - poidsDebut) * 500) / 1000;

    // Biometrie a J2 : non exacte par rapport a J5 et J25
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 2, 15),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", targetDebut, [{ produitId: "prod-X", quantiteKg: 5 }]),
      makeReleve("r2", "bac-A", targetFin, [{ produitId: "prod-X", quantiteKg: 5 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_VAGUE");
    // poids Gompertz croit -> gain positif
    expect(result[0].gainBiomasseKg).toBeGreaterThan(0);
    expect(result[0].gainBiomasseKg).toBeCloseTo(expectedGain, 4);
  });
});

// ---------------------------------------------------------------------------
// ADR-029 — methodeRank : verification de l'ordre de priorite (0-3)
// ---------------------------------------------------------------------------

describe("methodeRank — ordre de priorite 0-3 (ADR-029, ADR-032)", () => {
  /**
   * On teste l'ordre via le comportement de segmenterPeriodesAlimentaires :
   * la methodeEstimation retournee est celle de la borne avec le rang le plus bas
   * (indicateur conservateur).
   */

  it("BIOMETRIE_EXACTE (rang 3) > GOMPERTZ_VAGUE (rang 2) -> GOMPERTZ_VAGUE conservateur", () => {
    // debut = BIOMETRIE_EXACTE, fin = GOMPERTZ_VAGUE
    // min(3, 2) = 2 -> methode = GOMPERTZ_VAGUE
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 1, 20), // exacte au debut
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 30, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result[0].methodeEstimation).toBe("GOMPERTZ_VAGUE");
  });

  it("GOMPERTZ_VAGUE (rang 2) > INTERPOLATION_LINEAIRE (rang 1) -> INTERPOLATION_LINEAIRE conservateur", () => {
    // Pour forcer une borne a GOMPERTZ et l'autre a LINEAIRE, on utilise un contexte
    // Gompertz dont vagueDebut est APRES le debut de la premiere borne : t negatif -> fallback LINEAIRE.
    //
    // vagueDebut Gompertz = makeDate(15) (apres le releve de J5)
    // targetDate debut = J5 : tDays = 5 - 15 = -10 < 0 -> fallback LINEAIRE (rang 1)
    // targetDate fin = J25 : tDays = 25 - 15 = 10 >= 0, biometrie non exacte -> GOMPERTZ (rang 2)
    //
    // methodeRank(debut)=1 <= methodeRank(fin)=2 -> retourne methode de debut = INTERPOLATION_LINEAIRE
    const ctxVagueDebutTard: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      vagueDebut: makeDate(15), // commence apres J5
    };
    // Biometries encadrantes pour J5 -> LINEAIRE (J0 et J10 encadrent J5)
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 10, 80),
      makeBio("bac-A", 20, 120), // J20 avant J25, pas d'encadrement pour J25
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 25, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: ctxVagueDebutTard,
      gompertzMinPoints: 5,
    });

    // debut J5 : t = 5 - 15 = -10 < 0 -> Gompertz refuse -> LINEAIRE (encadre par J0 et J10)
    // fin J25 : t = 25 - 15 = 10 >= 0, pas d'encadrement lineaire pour J25 (J20 avant, rien apres)
    //           -> GOMPERTZ_VAGUE
    // min(rang LINEAIRE=1, rang GOMPERTZ=2) = 1 -> INTERPOLATION_LINEAIRE
    expect(result[0].methodeEstimation).toBe("INTERPOLATION_LINEAIRE");
  });

  it("INTERPOLATION_LINEAIRE (rang 1) > VALEUR_INITIALE (rang 0) -> VALEUR_INITIALE conservateur", () => {
    // debut = J30 : encadre par J20 et J40 -> LINEAIRE (rang 1)
    // fin   = J50 : apres toutes les biometries mais seul J40 avant -> LINEAIRE
    //
    // En realite : si une borne tombe avant toutes les biometries -> VALEUR_INITIALE
    // debut = J2 : avant J20 -> VALEUR_INITIALE (rang 0)
    // fin   = J30 : encadre -> LINEAIRE (rang 1)
    // min(0, 1) = 0 -> VALEUR_INITIALE
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 20, 100),
      makeBio("bac-A", 40, 180),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 2, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 30, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    // Strategie LINEAIRE pour ce test (pas de Gompertz)
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT);

    expect(result[0].methodeEstimation).toBe("VALEUR_INITIALE");
  });

  it("BIOMETRIE_EXACTE (rang 3) sur les deux bornes -> BIOMETRIE_EXACTE", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 1, 20),
      makeBio("bac-A", 15, 80),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 1, [{ produitId: "prod-X", quantiteKg: 1 }]),
      makeReleve("r2", "bac-A", 15, [{ produitId: "prod-X", quantiteKg: 1 }]),
    ];
    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    // Biometrie exacte sur les deux bornes -> rang 3 partout -> BIOMETRIE_EXACTE
    expect(result[0].methodeEstimation).toBe("BIOMETRIE_EXACTE");
  });
});

// ---------------------------------------------------------------------------
// ADR-033 — interpolerPoidsVague : estimation de poids au niveau vague
// ---------------------------------------------------------------------------

import { interpolerPoidsVague } from "@/lib/feed-periods";

/**
 * Contexte Gompertz realiste calé sur Vague 26-01 (ADR-033).
 * W∞=1500, K=0.0488, ti=45.68, r2=0.99, n=12, HIGH
 * vagueDebut = makeDate(0) pour les tests
 */
const GOMPERTZ_CTX_ADR033: GompertzVagueContext = {
  wInfinity: 1500,
  k: 0.0488,
  ti: 45.68,
  r2: 0.9909,
  biometrieCount: 12,
  confidenceLevel: "HIGH",
  vagueDebut: makeDate(0),
};

describe("interpolerPoidsVague — vague-level weight estimation (ADR-033)", () => {
  // ---- BIOMETRIE_EXACTE quand correspondance exacte de date ----------------

  it("returns BIOMETRIE_EXACTE when exact date match exists", () => {
    // Biometries de bacs differents : J25 = 160g sur bac-01, J25 = 165g sur bac-03
    // La fonction doit prendre la premiere correspondance calendaire
    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 25, 160),
      makeBio("bac-03", 25, 165),
    ];
    const result = interpolerPoidsVague(makeDate(25), biometries, 0.5);
    expect(result.methode).toBe("BIOMETRIE_EXACTE");
    // poids = premiere biometrie exacte trouvee (160 ou 165 selon tri)
    expect([160, 165]).toContain(result.poids);
  });

  it("returns BIOMETRIE_EXACTE regardless of bacId (uses ALL biometries)", () => {
    // Une seule biometrie mais dans bac-03 (pas bac-01)
    // interpolerPoidsVague NE doit PAS filtrer par bacId
    const biometries: BiometriePoint[] = [
      makeBio("bac-03", 10, 77),
    ];
    const result = interpolerPoidsVague(makeDate(10), biometries, 0.5);
    expect(result.methode).toBe("BIOMETRIE_EXACTE");
    expect(result.poids).toBe(77);
  });

  // ---- GOMPERTZ_VAGUE meme en l'absence de biometries ---------------------

  it("returns GOMPERTZ_VAGUE even when zero biometries exist", () => {
    // Pas de biometries du tout — Gompertz doit s'evaluer car c'est une fonction de temps pur
    const result = interpolerPoidsVague(makeDate(21), [], 0.5, {
      gompertzContext: GOMPERTZ_CTX_ADR033,
    });
    expect(result.methode).toBe("GOMPERTZ_VAGUE");
    const expectedPoids = gompertzWeight(21, {
      wInfinity: GOMPERTZ_CTX_ADR033.wInfinity,
      k: GOMPERTZ_CTX_ADR033.k,
      ti: GOMPERTZ_CTX_ADR033.ti,
    });
    expect(result.poids).toBeCloseTo(expectedPoids, 4);
  });

  it("returns GOMPERTZ_VAGUE when biometries exist but no exact match", () => {
    // Biometries avant et apres mais pas exactes -> Gompertz prime sur INTERPOLATION_LINEAIRE
    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 5, 30),
      makeBio("bac-03", 40, 500),
    ];
    const result = interpolerPoidsVague(makeDate(21), biometries, 0.5, {
      gompertzContext: GOMPERTZ_CTX_ADR033,
    });
    expect(result.methode).toBe("GOMPERTZ_VAGUE");
    const expectedPoids = gompertzWeight(21, {
      wInfinity: GOMPERTZ_CTX_ADR033.wInfinity,
      k: GOMPERTZ_CTX_ADR033.k,
      ti: GOMPERTZ_CTX_ADR033.ti,
    });
    expect(result.poids).toBeCloseTo(expectedPoids, 4);
  });

  // ---- GOMPERTZ_VAGUE pour extrapolation (date apres toutes les biometries) ---

  it("returns GOMPERTZ_VAGUE for extrapolation beyond last biometry", () => {
    // Derniere biometrie a J25, date cible J35 (apres)
    // Devrait utiliser Gompertz, pas la valeur plate de J25
    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 10, 80),
      makeBio("bac-03", 25, 160),
    ];
    const result = interpolerPoidsVague(makeDate(35), biometries, 0.5, {
      gompertzContext: GOMPERTZ_CTX_ADR033,
    });
    expect(result.methode).toBe("GOMPERTZ_VAGUE");
    const expectedPoids = gompertzWeight(35, {
      wInfinity: GOMPERTZ_CTX_ADR033.wInfinity,
      k: GOMPERTZ_CTX_ADR033.k,
      ti: GOMPERTZ_CTX_ADR033.ti,
    });
    expect(result.poids).toBeCloseTo(expectedPoids, 4);
    // Le poids extrapolé via Gompertz doit être supérieur à la dernière biométrie connue (160g)
    // car Gompertz continue à croître au-delà de J25
    expect(result.poids).toBeGreaterThan(160);
  });

  // ---- INTERPOLATION_LINEAIRE quand Gompertz absent -----------------------

  it("returns INTERPOLATION_LINEAIRE between two biometries when no Gompertz", () => {
    // Pas de contexte Gompertz -> fallback interpolation lineaire
    // J0=50g, J40=400g, cible J20 -> 50 + (400-50)*(20/40) = 225g
    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 0, 50),
      makeBio("bac-03", 40, 400),
    ];
    const result = interpolerPoidsVague(makeDate(20), biometries, 0.5);
    expect(result.methode).toBe("INTERPOLATION_LINEAIRE");
    expect(result.poids).toBeCloseTo(50 + (400 - 50) * (20 / 40), 4);
  });

  // ---- VALEUR_INITIALE en dernier recours ----------------------------------

  it("returns VALEUR_INITIALE when no biometries and no Gompertz", () => {
    const result = interpolerPoidsVague(makeDate(25), [], 0.5);
    expect(result.methode).toBe("VALEUR_INITIALE");
    expect(result.poids).toBe(0.5);
  });

  it("returns VALEUR_INITIALE when only one biometry and date is before it (no Gompertz)", () => {
    const biometries: BiometriePoint[] = [makeBio("bac-01", 20, 200)];
    const result = interpolerPoidsVague(makeDate(5), biometries, 3);
    expect(result.methode).toBe("VALEUR_INITIALE");
    expect(result.poids).toBe(3);
  });

  // ---- Utilise TOUTES les biometries quels que soient les bacIds -----------

  it("uses ALL biometries regardless of bacId (no per-bac filter)", () => {
    // Biometries sur bac-03 et bac-04 uniquement (pas bac-01)
    // Pour un "bac-01" cet appel vague-level doit quand meme trouver les biometries
    // et faire l'interpolation lineaire entre elles
    const biometries: BiometriePoint[] = [
      makeBio("bac-03", 0, 50),
      makeBio("bac-04", 40, 400),
    ];
    // Pas de filtre par bacId : la fonction doit utiliser ces deux biometries
    const result = interpolerPoidsVague(makeDate(20), biometries, 10);
    // Si la fonction filtrait par bacId (e.g. bac-01), elle retomberait sur VALEUR_INITIALE (10g)
    // Ici, elle doit trouver les biometries J0=50g et J40=400g -> INTERPOLATION_LINEAIRE
    expect(result.methode).toBe("INTERPOLATION_LINEAIRE");
    expect(result.poids).toBeCloseTo(50 + (400 - 50) * (20 / 40), 4);
    // La valeur ne doit PAS être le poidsInitial (10g) — ce qui prouverait un filtre per-bac
    expect(result.poids).not.toBe(10);
  });

  // ---- BIOMETRIE_EXACTE prime toujours sur Gompertz -----------------------

  it("BIOMETRIE_EXACTE primes over Gompertz when exact day match", () => {
    // Biometrie exacte a J21 = 999g, Gompertz donnerait ~120g
    const biometries: BiometriePoint[] = [makeBio("bac-01", 21, 999)];
    const result = interpolerPoidsVague(makeDate(21), biometries, 0.5, {
      gompertzContext: GOMPERTZ_CTX_ADR033,
    });
    expect(result.methode).toBe("BIOMETRIE_EXACTE");
    expect(result.poids).toBe(999);
  });

  // ---- Gompertz : fallback si confidence insuffisante ---------------------

  it("falls back to INTERPOLATION_LINEAIRE when Gompertz confidence is LOW", () => {
    const ctxLow: GompertzVagueContext = {
      ...GOMPERTZ_CTX_ADR033,
      confidenceLevel: "LOW",
    };
    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 0, 10),
      makeBio("bac-03", 60, 800),
    ];
    const result = interpolerPoidsVague(makeDate(30), biometries, 0.5, {
      gompertzContext: ctxLow,
    });
    expect(result.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  it("falls back to VALEUR_INITIALE when Gompertz confidence is LOW and no biometries", () => {
    const ctxLow: GompertzVagueContext = {
      ...GOMPERTZ_CTX_ADR033,
      confidenceLevel: "LOW",
    };
    const result = interpolerPoidsVague(makeDate(25), [], 0.5, {
      gompertzContext: ctxLow,
    });
    expect(result.methode).toBe("VALEUR_INITIALE");
    expect(result.poids).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// ADR-033 — segmenterPeriodesAlimentaires : FCR vague-level avec Gompertz
// ---------------------------------------------------------------------------

describe("segmenterPeriodesAlimentaires — vague-level Gompertz (ADR-033)", () => {
  /**
   * Scenario realiste Vague 26-01 (ADR-033) :
   *
   * - Vague : 1300 poissons, 2 bacs initiaux (bac-01 + bac-02, 650 chacun),
   *   poidsInitial 0.5g, dateDebut = makeDate(0)
   * - Gompertz : W∞=1500, K=0.0488, ti=45.68, r2=0.99, n=12, HIGH
   * - Calibrage au J25 : bac-01→130, bac-03→520, bac-04→650 (+ 20 morts)
   * - Poids Gompertz :
   *   J21 ~ 120g, J25 ~ 160g, J35 ~ 400g
   * - Alimentation Skretting 3mm :
   *   bac-01 : J21-J25 (10kg), bac-02 : J21-J35 (50kg),
   *   bac-03 : J25-J35 (40kg), bac-04 : J25-J35 (45kg)
   * - Total aliment = 145kg
   */

  const GOMPERTZ_VAGUE_26_01: GompertzVagueContext = {
    wInfinity: 1500,
    k: 0.0488,
    ti: 45.68,
    r2: 0.9909,
    biometrieCount: 12,
    confidenceLevel: "HIGH",
    vagueDebut: makeDate(0),
  };

  const vagueAvecCalibrage4Bacs: VagueContext = {
    dateDebut: makeDate(0),
    nombreInitial: 1300,
    poidsMoyenInitial: 0.5,
    bacs: [
      { id: "bac-01", nombreInitial: 650 },
      { id: "bac-02", nombreInitial: 650 },
      { id: "bac-03", nombreInitial: null }, // cree au calibrage
      { id: "bac-04", nombreInitial: null }, // cree au calibrage
    ],
    calibrages: [
      {
        date: makeDate(25),
        nombreMorts: 20,
        groupes: [
          { destinationBacId: "bac-01", nombrePoissons: 130, poidsMoyen: 160 },
          { destinationBacId: "bac-03", nombrePoissons: 520, poidsMoyen: 160 },
          { destinationBacId: "bac-04", nombrePoissons: 650, poidsMoyen: 160 },
        ],
      },
    ],
  };

  // bac-01 : J21-J25 = 10kg, bac-02 : J21-J35 = 50kg,
  // bac-03 : J25-J35 = 40kg, bac-04 : J25-J35 = 45kg
  const relevesScenario: ReleveAlimPoint[] = [
    // bac-01
    makeReleve("r01-a", "bac-01", 21, [{ produitId: "skretting-3mm", quantiteKg: 5 }]),
    makeReleve("r01-b", "bac-01", 25, [{ produitId: "skretting-3mm", quantiteKg: 5 }]),
    // bac-02
    makeReleve("r02-a", "bac-02", 21, [{ produitId: "skretting-3mm", quantiteKg: 10 }]),
    makeReleve("r02-b", "bac-02", 28, [{ produitId: "skretting-3mm", quantiteKg: 20 }]),
    makeReleve("r02-c", "bac-02", 35, [{ produitId: "skretting-3mm", quantiteKg: 20 }]),
    // bac-03
    makeReleve("r03-a", "bac-03", 25, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
    makeReleve("r03-b", "bac-03", 30, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
    makeReleve("r03-c", "bac-03", 35, [{ produitId: "skretting-3mm", quantiteKg: 10 }]),
    // bac-04
    makeReleve("r04-a", "bac-04", 25, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
    makeReleve("r04-b", "bac-04", 30, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
    makeReleve("r04-c", "bac-04", 35, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
  ];

  it("uses Gompertz VAGUE for weight even for tanks with zero biometries", () => {
    // bac-03 et bac-04 sont crees au calibrage J25 -> aucune biometrie sous leur bacId
    // Avec l'ancien algorithme per-bac, ils retombaient sur VALEUR_INITIALE (0.5g)
    // Avec ADR-033 (interpolerPoidsVague sans filtre bacId), Gompertz est utilise
    //
    // On verifie via methodeEstimation : si bac-03/04 tombent sur VALEUR_INITIALE,
    // la methodeEstimation serait "VALEUR_INITIALE". Avec Gompertz, elle doit etre
    // "GOMPERTZ_VAGUE".
    //
    // On n'a pas de biometries dans ce test (scenario pur Gompertz)
    const periodes = segmenterPeriodesAlimentaires(
      relevesScenario,
      [], // aucune biometrie -> doit utiliser Gompertz via interpolerPoidsVague
      vagueAvecCalibrage4Bacs,
      {
        gompertzContext: GOMPERTZ_VAGUE_26_01,
        gompertzMinPoints: 5,
      }
    );

    // Filtrer les periodes de bac-03 et bac-04
    const periodes03 = periodes.filter((p) => p.bacId === "bac-03");
    const periodes04 = periodes.filter((p) => p.bacId === "bac-04");

    expect(periodes03.length).toBeGreaterThan(0);
    expect(periodes04.length).toBeGreaterThan(0);

    // Avec Gompertz vague (sans filtre bacId), la methode doit etre GOMPERTZ_VAGUE
    for (const p of [...periodes03, ...periodes04]) {
      expect(p.methodeEstimation).toBe("GOMPERTZ_VAGUE");
    }
  });

  it("produces biologically plausible FCR (0.8-2.5) with calibrage scenario", () => {
    // Scenario simplifie avec populations plus modestes pour FCR plausible.
    //
    // Gompertz: W∞=1000, K=0.03, ti=50
    //   J25 ≈ 120g, J35 ≈ 208g
    //
    // Contexte : 200 poissons, calibrage J25 : bac-s1→40 fish, bac-s2→160 fish (nouveau bac)
    // Alimentation Skretting :
    //   bac-s1 (J25-J35) : 6kg
    //   bac-s2 (J25-J35) : 26kg
    // Total feed = 32kg
    //
    // Gain attendu :
    //   bac-s1 : (208-120)*40/1000 = 3.52 kg
    //   bac-s2 : (208-120)*160/1000 = 14.08 kg
    //   Total gain = 17.60 kg
    //   FCR = 32/17.60 ≈ 1.82 (plausible pour Clarias)

    const GOMPERTZ_FCR_TEST: GompertzVagueContext = {
      wInfinity: 1000,
      k: 0.03,
      ti: 50,
      r2: 0.97,
      biometrieCount: 10,
      confidenceLevel: "HIGH",
      vagueDebut: makeDate(0),
    };

    const vagueFCR: VagueContext = {
      dateDebut: makeDate(0),
      nombreInitial: 200,
      poidsMoyenInitial: 5,
      bacs: [
        { id: "bac-s1", nombreInitial: 200 },
        { id: "bac-s2", nombreInitial: null }, // cree au calibrage
      ],
      calibrages: [
        {
          date: makeDate(25),
          nombreMorts: 0,
          groupes: [
            { destinationBacId: "bac-s1", nombrePoissons: 40, poidsMoyen: 120 },
            { destinationBacId: "bac-s2", nombrePoissons: 160, poidsMoyen: 120 },
          ],
        },
      ],
    };

    const relevesFCR: ReleveAlimPoint[] = [
      makeReleve("fs1-a", "bac-s1", 25, [{ produitId: "sk3mm", quantiteKg: 3 }]),
      makeReleve("fs1-b", "bac-s1", 35, [{ produitId: "sk3mm", quantiteKg: 3 }]),
      makeReleve("fs2-a", "bac-s2", 25, [{ produitId: "sk3mm", quantiteKg: 13 }]),
      makeReleve("fs2-b", "bac-s2", 35, [{ produitId: "sk3mm", quantiteKg: 13 }]),
    ];

    const periodes = segmenterPeriodesAlimentaires(
      relevesFCR,
      [], // aucune biometrie per-bac -> doit utiliser Gompertz
      vagueFCR,
      {
        gompertzContext: GOMPERTZ_FCR_TEST,
        gompertzMinPoints: 5,
      }
    );

    const validPeriodes = periodes.filter(
      (p) => p.gainBiomasseKg !== null && p.gainBiomasseKg > 0
    );

    // bac-s2 (nouveau bac sans biometrie per-bac) doit avoir un gain > 0 grace a Gompertz
    expect(validPeriodes.length).toBe(2);

    const totalAliment = validPeriodes.reduce((s, p) => s + p.quantiteKg, 0);
    const totalGain = validPeriodes.reduce((s, p) => s + (p.gainBiomasseKg ?? 0), 0);

    expect(totalGain).toBeGreaterThan(0);
    expect(totalAliment).toBeGreaterThan(0);

    const fcr = totalAliment / totalGain;
    // FCR attendu ≈ 1.82 (biologiquement plausible pour Clarias)
    expect(fcr).toBeGreaterThan(0.8);
    expect(fcr).toBeLessThan(2.5);
  });

  it("excludes feed from periods with negative gain", () => {
    // Scenario : poids decroit entre deux dates -> gain negatif -> periode exclue
    // On ajoute artificiellement des biometries avec poids decroissant
    // pour forcer un gain negatif sur bac-01
    const biometriesDecroissantes: BiometriePoint[] = [
      makeBio("bac-01", 21, 300), // J21 = 300g (haute)
      makeBio("bac-01", 25, 200), // J25 = 200g (basse) -> gain negatif
    ];

    // Releves bac-01 uniquement
    const releves01: ReleveAlimPoint[] = [
      makeReleve("r01-a", "bac-01", 21, [{ produitId: "skretting-3mm", quantiteKg: 5 }]),
      makeReleve("r01-b", "bac-01", 25, [{ produitId: "skretting-3mm", quantiteKg: 5 }]),
    ];

    const contexteSimple: VagueContext = {
      dateDebut: makeDate(0),
      nombreInitial: 650,
      poidsMoyenInitial: 0.5,
      bacs: [{ id: "bac-01", nombreInitial: 650 }],
    };

    const periodes = segmenterPeriodesAlimentaires(
      releves01,
      biometriesDecroissantes,
      contexteSimple
    );

    expect(periodes).toHaveLength(1);
    // Gain negatif -> gainBiomasseKg = null (exclu)
    expect(periodes[0].gainBiomasseKg).toBeNull();
    // La periode existe mais son gain est nul -> ne contribue pas au FCR
    expect(periodes[0].quantiteKg).toBe(10); // l'aliment est quand meme compte
  });

  it("bac-03 and bac-04 gain biomasse is NOT null with Gompertz (key ADR-033 regression test)", () => {
    // REGRESSION TEST pour DISC-01/DISC-02 :
    // Avant ADR-033, bac-03 et bac-04 (crees au calibrage) n'avaient pas de biometries
    // per-bac -> interpolerPoidsBac retournait VALEUR_INITIALE (0.5g) pour les deux bornes
    // -> gain = (0.5 - 0.5) * N / 1000 = 0 -> gainBiomasseKg = null -> FCR artificiellement haut
    //
    // Avec ADR-033 (interpolerPoidsVague), Gompertz est utilise pour les deux bornes
    // -> gain > 0 -> gainBiomasseKg != null
    const periodes = segmenterPeriodesAlimentaires(
      relevesScenario,
      [], // aucune biometrie per-bac
      vagueAvecCalibrage4Bacs,
      {
        gompertzContext: GOMPERTZ_VAGUE_26_01,
        gompertzMinPoints: 5,
      }
    );

    const periodes03 = periodes.filter((p) => p.bacId === "bac-03");
    const periodes04 = periodes.filter((p) => p.bacId === "bac-04");

    // Chaque bac doit avoir au moins une periode avec gain positif
    for (const p of [...periodes03, ...periodes04]) {
      // Le gain ne doit PAS etre null (ce qui arrivait avec l'ancien algo per-bac)
      expect(p.gainBiomasseKg).not.toBeNull();
      expect(p.gainBiomasseKg).toBeGreaterThan(0);
    }
  });

  it("total feed across all tanks matches expected sum (145kg)", () => {
    const periodes = segmenterPeriodesAlimentaires(
      relevesScenario,
      [],
      vagueAvecCalibrage4Bacs,
      {
        gompertzContext: GOMPERTZ_VAGUE_26_01,
        gompertzMinPoints: 5,
      }
    );

    // Verifier que le total aliment de toutes les periodes = 145kg (somme des releves)
    // bac-01: 5+5=10, bac-02: 10+20+20=50, bac-03: 15+15+10=40, bac-04: 15+15+15=45 -> 145
    const totalAliment = periodes.reduce((s, p) => s + p.quantiteKg, 0);
    expect(totalAliment).toBeCloseTo(145, 5);
  });
});

// ---------------------------------------------------------------------------
// ADR-030 — GOMPERTZ_BAC supprime (ADR-032). Les tests ci-dessous ont ete
// supprimes. La chaine d'interpolation est desormais a 3 niveaux :
// BIOMETRIE_EXACTE -> GOMPERTZ_VAGUE -> INTERPOLATION_LINEAIRE -> VALEUR_INITIALE
// ---------------------------------------------------------------------------

// Tests GOMPERTZ_BAC supprimes (ADR-032 — GOMPERTZ_BAC eliminated).
// La chaine est desormais : BIOMETRIE_EXACTE -> GOMPERTZ_VAGUE -> INTERPOLATION_LINEAIRE -> VALEUR_INITIALE
// Tests conserves sous ADR-029 (methodeRank 3 niveaux) et ADR-032 (calibrage-aware).
describe("methodeRank — ordre de priorite 4 niveaux (ADR-032)", () => {
  /**
   * Verifie que la chaine simplifiee sans GOMPERTZ_BAC fonctionne correctement :
   * BIOMETRIE_EXACTE(3) > GOMPERTZ_VAGUE(2) > INTERPOLATION_LINEAIRE(1) > VALEUR_INITIALE(0)
   */

  it("rang : VALEUR_INITIALE(0) < INTERPOLATION_LINEAIRE(1) < GOMPERTZ_VAGUE(2) < BIOMETRIE_EXACTE(3)", () => {
    // VALEUR_INITIALE = 0 : quand aucune biometrie avant la date cible
    const resVI = interpolerPoidsBac(makeDate(5), "bac-A", [makeBio("bac-A", 10, 50)], 10);
    expect(resVI!.methode).toBe("VALEUR_INITIALE");

    // INTERPOLATION_LINEAIRE = 1
    const resLin = interpolerPoidsBac(makeDate(5), "bac-A", [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 10, 100),
    ], 10);
    expect(resLin!.methode).toBe("INTERPOLATION_LINEAIRE");

    // GOMPERTZ_VAGUE = 2
    const resGV = interpolerPoidsBac(makeDate(50), "bac-A", [makeBio("bac-A", 5, 40)], 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });
    expect(resGV!.methode).toBe("GOMPERTZ_VAGUE");

    // BIOMETRIE_EXACTE = 3
    const resExact = interpolerPoidsBac(makeDate(50), "bac-A", [makeBio("bac-A", 50, 500)], 10);
    expect(resExact!.methode).toBe("BIOMETRIE_EXACTE");
  });

  it("BIOMETRIE_EXACTE (rang 3) > GOMPERTZ_VAGUE (rang 2) -> GOMPERTZ_VAGUE conservateur", () => {
    // debut = BIOMETRIE_EXACTE, fin = GOMPERTZ_VAGUE -> min(3, 2) = 2 -> GOMPERTZ_VAGUE
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 50), // exacte au debut
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_VAGUE");
  });
});

// ---------------------------------------------------------------------------
// ADR-031 — interpolerPoidsBac : champ detail enrichi (FCRTraceEstimationDetail)
// ---------------------------------------------------------------------------

describe("interpolerPoidsBac — detail FCRTraceEstimationDetail (ADR-031)", () => {
  // ---- BIOMETRIE_EXACTE -----------------------------------------------

  it("BIOMETRIE_EXACTE : detail contient methode, dateBiometrie et poidsMesureG", () => {
    const bioDate = makeDate(10);
    const biometries: BiometriePoint[] = [{ bacId: "bac-A", date: bioDate, poidsMoyen: 145 }];
    const result = interpolerPoidsBac(makeDate(10), "bac-A", biometries, 10);

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
    expect(result!.detail).not.toBeNull();
    expect(result!.detail.methode).toBe("BIOMETRIE_EXACTE");
    // Narrowing via discriminant
    if (result!.detail.methode === "BIOMETRIE_EXACTE") {
      expect(result!.detail.dateBiometrie.getTime()).toBe(bioDate.getTime());
      expect(result!.detail.poidsMesureG).toBe(145);
    }
  });

  it("BIOMETRIE_EXACTE : poidsMesureG correspond exactement a la valeur de la biometrie", () => {
    const biometries: BiometriePoint[] = [makeBio("bac-A", 7, 88)];
    const result = interpolerPoidsBac(makeDate(7), "bac-A", biometries, 10);

    expect(result!.detail.methode).toBe("BIOMETRIE_EXACTE");
    if (result!.detail.methode === "BIOMETRIE_EXACTE") {
      expect(result!.detail.poidsMesureG).toBe(88);
    }
  });

  // ---- INTERPOLATION_LINEAIRE : cas standard (deux bornes) ---------------

  it("INTERPOLATION_LINEAIRE : detail contient methode, pointAvant, pointApres et ratio", () => {
    const dateAvant = makeDate(0);
    const dateApres = makeDate(10);
    const biometries: BiometriePoint[] = [
      { bacId: "bac-A", date: dateAvant, poidsMoyen: 100 },
      { bacId: "bac-A", date: dateApres, poidsMoyen: 200 },
    ];
    // cible = J5 (milieu) -> ratio = 0.5
    const result = interpolerPoidsBac(makeDate(5), "bac-A", biometries, 10);

    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
    expect(result!.detail.methode).toBe("INTERPOLATION_LINEAIRE");

    if (result!.detail.methode === "INTERPOLATION_LINEAIRE") {
      // pointAvant
      expect(result!.detail.pointAvant).not.toBeNull();
      expect(result!.detail.pointAvant!.date.getTime()).toBe(dateAvant.getTime());
      expect(result!.detail.pointAvant!.poidsMoyenG).toBe(100);
      // pointApres
      expect(result!.detail.pointApres).not.toBeNull();
      expect(result!.detail.pointApres!.date.getTime()).toBe(dateApres.getTime());
      expect(result!.detail.pointApres!.poidsMoyenG).toBe(200);
      // ratio
      expect(result!.detail.ratio).toBeCloseTo(0.5, 6);
    }
  });

  it("INTERPOLATION_LINEAIRE : ratio reflete la position proportionnelle dans l'intervalle", () => {
    // J0=100g, J30=160g, cible=J20 -> ratio = 20/30 = 0.6667
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 100),
      makeBio("bac-A", 30, 160),
    ];
    const result = interpolerPoidsBac(makeDate(20), "bac-A", biometries, 50);

    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
    if (result!.detail.methode === "INTERPOLATION_LINEAIRE") {
      expect(result!.detail.ratio).toBeCloseTo(20 / 30, 6);
      expect(result!.detail.pointAvant).not.toBeNull();
      expect(result!.detail.pointApres).not.toBeNull();
    }
  });

  it("INTERPOLATION_LINEAIRE : extrapolation (date apres toutes les biometries) -> pointApres null et ratio null", () => {
    // Seule une biometrie avant la date cible -> extrapolation vers la fin
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40),
      makeBio("bac-A", 10, 60),
    ];
    const result = interpolerPoidsBac(makeDate(15), "bac-A", biometries, 10);

    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
    if (result!.detail.methode === "INTERPOLATION_LINEAIRE") {
      // pointAvant = derniere biometrie connue (J10)
      expect(result!.detail.pointAvant).not.toBeNull();
      expect(result!.detail.pointAvant!.poidsMoyenG).toBe(60);
      // pointApres = null (aucune biometrie apres J15)
      expect(result!.detail.pointApres).toBeNull();
      // ratio = null (extrapolation, pas d'intervalle)
      expect(result!.detail.ratio).toBeNull();
    }
  });

  // ---- GOMPERTZ_BAC supprime (ADR-032) ------------------------------------
  // Les tests GOMPERTZ_BAC ont ete supprimes. GOMPERTZ_VAGUE est desormais le
  // niveau le plus eleve avant BIOMETRIE_EXACTE.

  // ---- GOMPERTZ_VAGUE -----------------------------------------------------

  it("GOMPERTZ_VAGUE : detail contient methode, tJours, params et resultatG", () => {
    const targetDate = makeDate(60); // t = 60 jours
    const biometries: BiometriePoint[] = [makeBio("bac-A", 10, 80)];

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.detail.methode).toBe("GOMPERTZ_VAGUE");

    if (result!.detail.methode === "GOMPERTZ_VAGUE") {
      // tJours = 60 jours depuis vagueDebut = makeDate(0)
      expect(result!.detail.tJours).toBeCloseTo(60, 6);
      // params : correspond au contexte vague
      expect(result!.detail.params.wInfinity).toBe(GOMPERTZ_CTX_HIGH.wInfinity);
      expect(result!.detail.params.k).toBe(GOMPERTZ_CTX_HIGH.k);
      expect(result!.detail.params.ti).toBe(GOMPERTZ_CTX_HIGH.ti);
      expect(result!.detail.params.r2).toBe(GOMPERTZ_CTX_HIGH.r2);
      expect(result!.detail.params.biometrieCount).toBe(GOMPERTZ_CTX_HIGH.biometrieCount);
      expect(result!.detail.params.confidenceLevel).toBe(GOMPERTZ_CTX_HIGH.confidenceLevel);
      // resultatG doit etre coherent avec poids retourne
      const expected = gompertzWeight(60, {
        wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
        k: GOMPERTZ_CTX_HIGH.k,
        ti: GOMPERTZ_CTX_HIGH.ti,
      });
      expect(result!.detail.resultatG).toBeCloseTo(expected, 6);
      expect(result!.detail.resultatG).toBeCloseTo(result!.poids, 6);
    }
  });

  it("GOMPERTZ_VAGUE : tJours calcule correctement a partir de vagueDebut", () => {
    // vagueDebut = makeDate(0), targetDate = makeDate(35) -> tJours = 35
    const result = interpolerPoidsBac(makeDate(35), "bac-A", [makeBio("bac-A", 5, 40)], 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    if (result!.detail.methode === "GOMPERTZ_VAGUE") {
      expect(result!.detail.tJours).toBeCloseTo(35, 6);
    }
  });

  it("GOMPERTZ_VAGUE avec contexte valide : detail.methode = GOMPERTZ_VAGUE", () => {
    // Strategie GOMPERTZ_VAGUE avec contexte valide -> utilise Gompertz vague
    const biometries: BiometriePoint[] = [makeBio("bac-A", 5, 40)];

    const result = interpolerPoidsBac(makeDate(50), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });

    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.detail.methode).toBe("GOMPERTZ_VAGUE");
    if (result!.detail.methode === "GOMPERTZ_VAGUE") {
      // Les params correspondent au contexte vague
      expect(result!.detail.params.wInfinity).toBe(GOMPERTZ_CTX_HIGH.wInfinity);
    }
  });

  // ---- VALEUR_INITIALE -----------------------------------------------------

  it("VALEUR_INITIALE : detail contient methode et poidsMoyenInitialG quand aucune biometrie", () => {
    const result = interpolerPoidsBac(makeDate(5), "bac-A", [], 42);

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("VALEUR_INITIALE");
    expect(result!.detail.methode).toBe("VALEUR_INITIALE");

    if (result!.detail.methode === "VALEUR_INITIALE") {
      expect(result!.detail.poidsMoyenInitialG).toBe(42);
    }
  });

  it("VALEUR_INITIALE : detail contient la valeur poidsInitial correcte", () => {
    // Aucune biometrie pour ce bac (biometrie d'un autre bac)
    const biometries: BiometriePoint[] = [makeBio("bac-B", 5, 50)];
    const result = interpolerPoidsBac(makeDate(5), "bac-A", biometries, 25);

    expect(result!.methode).toBe("VALEUR_INITIALE");
    if (result!.detail.methode === "VALEUR_INITIALE") {
      expect(result!.detail.poidsMoyenInitialG).toBe(25);
    }
  });

  it("VALEUR_INITIALE : date avant toutes les biometries -> detail.poidsMoyenInitialG = poidsInitial", () => {
    // Seule biometrie a J10, targetDate = J3 (avant) -> VALEUR_INITIALE
    const biometries: BiometriePoint[] = [makeBio("bac-A", 10, 80)];
    const result = interpolerPoidsBac(makeDate(3), "bac-A", biometries, 15);

    expect(result!.methode).toBe("VALEUR_INITIALE");
    if (result!.detail.methode === "VALEUR_INITIALE") {
      expect(result!.detail.poidsMoyenInitialG).toBe(15);
    }
  });

  // ---- Compatibilite retrograde : le champ detail est additif ---------------

  it("backward compat : les champs poids et methode sont toujours presentes (detail est additif)", () => {
    // Verifier que les proprietes existantes (poids, methode) restent inchangees
    // quand detail est ajoute. On teste les 4 cas.

    // BIOMETRIE_EXACTE
    const r1 = interpolerPoidsBac(makeDate(5), "bac-A", [makeBio("bac-A", 5, 50)], 10);
    expect(r1!.poids).toBe(50);
    expect(r1!.methode).toBe("BIOMETRIE_EXACTE");
    expect(r1!.detail).toBeDefined();

    // INTERPOLATION_LINEAIRE
    const r2 = interpolerPoidsBac(makeDate(5), "bac-A", [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 10, 30),
    ], 10);
    expect(r2!.poids).toBeCloseTo(20, 5);
    expect(r2!.methode).toBe("INTERPOLATION_LINEAIRE");
    expect(r2!.detail).toBeDefined();

    // VALEUR_INITIALE
    const r3 = interpolerPoidsBac(makeDate(5), "bac-A", [], 99);
    expect(r3!.poids).toBe(99);
    expect(r3!.methode).toBe("VALEUR_INITIALE");
    expect(r3!.detail).toBeDefined();

    // GOMPERTZ_VAGUE
    const r4 = interpolerPoidsBac(makeDate(50), "bac-A", [makeBio("bac-A", 5, 40)], 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzMinPoints: 5,
    });
    expect(r4!.methode).toBe("GOMPERTZ_VAGUE");
    expect(r4!.detail).toBeDefined();
    // poids et detail.resultatG doivent etre coherents
    if (r4!.detail.methode === "GOMPERTZ_VAGUE") {
      expect(r4!.poids).toBeCloseTo(r4!.detail.resultatG, 6);
    }
  });
});

// ---------------------------------------------------------------------------
// ADR-032 — estimerNombreVivantsADate : calibrage-aware
// ---------------------------------------------------------------------------

describe("estimerNombreVivantsADate — calibrage-aware (ADR-032)", () => {
  /**
   * VagueContext de base pour ces tests.
   * Vague commencee le J0, 1300 poissons initiaux, 2 bacs (650 chacun).
   */
  const vagueContext3Bacs: VagueContext = {
    dateDebut: makeDate(0),
    nombreInitial: 1300,
    poidsMoyenInitial: 15,
    bacs: [
      { id: "bac-01", nombreInitial: 650 },
      { id: "bac-03", nombreInitial: 650 },
    ],
  };

  it("retourne nombreInitial du bac si aucun calibrage avant la date", () => {
    // Pas de calibrages -> utilise bac.nombreInitial
    const result = estimerNombreVivantsADate(
      "bac-01",
      makeDate(10),
      vagueContext3Bacs
    );
    expect(result).toBe(650);
  });

  it("utilise groupe.nombrePoissons du dernier calibrage avant la date", () => {
    // Calibrage au J25 : bac-01 recoit 130 poissons (redistribution)
    const calibrages: CalibragePoint[] = [
      {
        date: makeDate(25),
        nombreMorts: 0,
        groupes: [
          { destinationBacId: "bac-01", nombrePoissons: 130, poidsMoyen: 200 },
          { destinationBacId: "bac-03", nombrePoissons: 520, poidsMoyen: 200 },
        ],
      },
    ];
    const ctx: VagueContext = { ...vagueContext3Bacs, calibrages };

    // Avant calibrage (J20) -> utilise nombreInitial
    const avant = estimerNombreVivantsADate("bac-01", makeDate(20), ctx);
    expect(avant).toBe(650);

    // Apres calibrage (J26) -> utilise groupe.nombrePoissons = 130
    const apres = estimerNombreVivantsADate("bac-01", makeDate(26), ctx);
    expect(apres).toBe(130);
  });

  it("soustrait les mortalites post-calibrage", () => {
    // Calibrage au J25 : bac-01 = 130 poissons
    // Mortalite de 5 poissons au J28
    const calibrages: CalibragePoint[] = [
      {
        date: makeDate(25),
        nombreMorts: 0,
        groupes: [
          { destinationBacId: "bac-01", nombrePoissons: 130, poidsMoyen: 200 },
        ],
      },
    ];
    const ctx: VagueContext = { ...vagueContext3Bacs, calibrages };

    const mortalitesParBac = new Map([
      [
        "bac-01",
        [{ nombreMorts: 5, date: makeDate(28) }],
      ],
    ]);

    // A J29 : 130 - 5 = 125
    const result = estimerNombreVivantsADate("bac-01", makeDate(29), ctx, mortalitesParBac);
    expect(result).toBe(125);
  });

  it("gere un bac nouveau (jamais source) apparu lors d'un calibrage", () => {
    // bac-04 n'existe pas dans vagueContext3Bacs.bacs, mais apparait comme destination
    const ctx: VagueContext = {
      dateDebut: makeDate(0),
      nombreInitial: 1300,
      poidsMoyenInitial: 15,
      bacs: [
        { id: "bac-01", nombreInitial: 650 },
        { id: "bac-03", nombreInitial: 650 },
        { id: "bac-04", nombreInitial: null }, // nouveau bac cree lors du calibrage
      ],
      calibrages: [
        {
          date: makeDate(25),
          nombreMorts: 0,
          groupes: [
            { destinationBacId: "bac-01", nombrePoissons: 130, poidsMoyen: 200 },
            { destinationBacId: "bac-03", nombrePoissons: 520, poidsMoyen: 200 },
            { destinationBacId: "bac-04", nombrePoissons: 650, poidsMoyen: 200 },
          ],
        },
      ],
    };

    // bac-04 apres calibrage (J26) -> 650 poissons depuis le calibrageGroupe
    const result = estimerNombreVivantsADate("bac-04", makeDate(26), ctx);
    expect(result).toBe(650);
  });

  it("ignore les calibrages dont date > targetDate", () => {
    // Calibrage au J30, targetDate = J20 -> le calibrage est dans le futur -> ignorer
    const calibrages: CalibragePoint[] = [
      {
        date: makeDate(30),
        nombreMorts: 0,
        groupes: [
          { destinationBacId: "bac-01", nombrePoissons: 130, poidsMoyen: 200 },
        ],
      },
    ];
    const ctx: VagueContext = { ...vagueContext3Bacs, calibrages };

    // A J20, le calibrage futur est ignore -> utilise nombreInitial = 650
    const result = estimerNombreVivantsADate("bac-01", makeDate(20), ctx);
    expect(result).toBe(650);
  });

  it("retombe sur nombreInitial si calibrage.groupes ne contient pas ce bacId", () => {
    // Calibrage au J25 ne mentionne que bac-03, pas bac-01
    const calibrages: CalibragePoint[] = [
      {
        date: makeDate(25),
        nombreMorts: 0,
        groupes: [
          { destinationBacId: "bac-03", nombrePoissons: 1000, poidsMoyen: 200 },
          // bac-01 absent -> pas de mise a jour pour bac-01
        ],
      },
    ];
    const ctx: VagueContext = { ...vagueContext3Bacs, calibrages };

    // bac-01 apres calibrage -> utilise nombreInitial car il n'est pas destination
    const result = estimerNombreVivantsADate("bac-01", makeDate(26), ctx);
    expect(result).toBe(650); // toujours le nombreInitial de bac-01
  });
});

// ---------------------------------------------------------------------------
// ADR-032 — segmenterPeriodesAlimentaires avec calibrages
// ---------------------------------------------------------------------------

describe("segmenterPeriodesAlimentaires — avec calibrages (ADR-032)", () => {
  /**
   * Scenario realiste base sur Vague 26-01 :
   * - 1300 poissons initiaux repartis sur 2 bacs (650 chacun)
   * - Calibrage au J25 : bac-01 garde 130, bac-03 recoit 520, nouveau bac-04 recoit 650
   * - Alimentation post-calibrage avec Skretting 3mm
   * - Poids au J25 ~ 200g, poids au J35 ~ 350g (Gompertz vague)
   * - Aliment : ~50kg par bac sur 10 jours
   */

  // Contexte vague avec calibrage
  const vagueAvecCalibrage: VagueContext = {
    dateDebut: makeDate(0),
    nombreInitial: 1300,
    poidsMoyenInitial: 15,
    bacs: [
      { id: "bac-01", nombreInitial: 650 },
      { id: "bac-03", nombreInitial: 650 },
      { id: "bac-04", nombreInitial: null }, // cree au calibrage J25
    ],
    calibrages: [
      {
        date: makeDate(25),
        nombreMorts: 20,
        groupes: [
          { destinationBacId: "bac-01", nombrePoissons: 130, poidsMoyen: 200 },
          { destinationBacId: "bac-03", nombrePoissons: 520, poidsMoyen: 200 },
          { destinationBacId: "bac-04", nombrePoissons: 650, poidsMoyen: 200 },
        ],
      },
    ],
  };

  it("FCR plausible (0.5 < FCR < 3.0) pour bac ayant perdu 60% de population lors d'un calibrage", () => {
    // bac-01 passe de 650 a 130 poissons lors du calibrage J25.
    // Sans calibrage-aware, nombreVivants = 650 -> FCR artificiel < 0.5.
    // Avec calibrage-aware, nombreVivants = 130 -> FCR biologiquement plausible.
    //
    // Biometries : J25 = 200g, J35 = 350g
    // Aliment post-calibrage : 50kg sur la periode J26-J35
    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 25, 200),
      makeBio("bac-01", 35, 350),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-01", 26, [{ produitId: "skretting-3mm", quantiteKg: 10 }]),
      makeReleve("r2", "bac-01", 29, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
      makeReleve("r3", "bac-01", 32, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
      makeReleve("r4", "bac-01", 35, [{ produitId: "skretting-3mm", quantiteKg: 10 }]),
    ];

    const periodes = segmenterPeriodesAlimentaires(releves, biometries, vagueAvecCalibrage);

    expect(periodes).toHaveLength(1);
    const periode = periodes[0];

    // nombreVivants doit reflechir la population post-calibrage (130) et non pre-calibrage (650)
    expect(periode.nombreVivants).toBe(130);

    // gainBiomasseKg = (350 - 200) * 130 / 1000 = 19.5 kg
    // FCR = 50 / 19.5 ~ 2.56 (plausible pour Clarias)
    expect(periode.gainBiomasseKg).not.toBeNull();
    if (periode.gainBiomasseKg !== null) {
      const fcr = periode.quantiteKg / periode.gainBiomasseKg;
      expect(fcr).toBeGreaterThan(0.5);
      expect(fcr).toBeLessThan(3.0);
    }
  });

  it("pas de FCR < 0.5 sur donnees synthetiques de calibrage realiste", () => {
    // Scenario complet 3 bacs post-calibrage J25
    // bac-01 : 130 poissons, bac-03 : 520, bac-04 : 650
    // Biometries identiques pour tous : J25 = 200g, J35 = 350g
    // Aliment : 50kg par bac sur J26-J35

    const makeBioForBac = (bacId: string, day: number, poids: number) =>
      makeBio(bacId, day, poids);

    const biometries: BiometriePoint[] = [
      makeBioForBac("bac-01", 25, 200), makeBioForBac("bac-01", 35, 350),
      makeBioForBac("bac-03", 25, 200), makeBioForBac("bac-03", 35, 350),
      makeBioForBac("bac-04", 25, 200), makeBioForBac("bac-04", 35, 350),
    ];

    const makeRelevesForBac = (bacId: string, id: string): ReleveAlimPoint[] => [
      makeReleve(`${id}-r1`, bacId, 26, [{ produitId: "skretting-3mm", quantiteKg: 10 }]),
      makeReleve(`${id}-r2`, bacId, 29, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
      makeReleve(`${id}-r3`, bacId, 32, [{ produitId: "skretting-3mm", quantiteKg: 15 }]),
      makeReleve(`${id}-r4`, bacId, 35, [{ produitId: "skretting-3mm", quantiteKg: 10 }]),
    ];

    const releves: ReleveAlimPoint[] = [
      ...makeRelevesForBac("bac-01", "b01"),
      ...makeRelevesForBac("bac-03", "b03"),
      ...makeRelevesForBac("bac-04", "b04"),
    ];

    const periodes = segmenterPeriodesAlimentaires(releves, biometries, vagueAvecCalibrage);

    // 3 bacs, 1 periode chacun
    expect(periodes).toHaveLength(3);

    for (const p of periodes) {
      if (p.gainBiomasseKg !== null && p.gainBiomasseKg > 0) {
        const fcr = p.quantiteKg / p.gainBiomasseKg;
        // Aucun FCR ne doit etre biologiquement implausible (< 0.5)
        expect(fcr).toBeGreaterThan(0.5);
        // FCR inferieur a 4 pour donnees synthetiques propres
        expect(fcr).toBeLessThan(4.0);
      }
    }
  });

  it("periodes pre-calibrage et post-calibrage utilisent des nombreVivants differents", () => {
    // bac-01 :
    //   - Pre-calibrage (J10) : nombreVivants = 650 (nombreInitial)
    //   - Post-calibrage (J26) : nombreVivants = 130 (groupe du calibrage J25)

    const biometries: BiometriePoint[] = [
      makeBio("bac-01", 5, 50),
      makeBio("bac-01", 15, 100),
      makeBio("bac-01", 25, 200),
      makeBio("bac-01", 35, 350),
    ];

    // Deux periodes distinctes (changement de produit au J25 pour distinguer)
    const releves: ReleveAlimPoint[] = [
      // Pre-calibrage : produit A
      makeReleve("r1", "bac-01", 5, [{ produitId: "prod-A", quantiteKg: 10 }]),
      makeReleve("r2", "bac-01", 15, [{ produitId: "prod-A", quantiteKg: 10 }]),
      // Post-calibrage : produit B
      makeReleve("r3", "bac-01", 26, [{ produitId: "prod-B", quantiteKg: 10 }]),
      makeReleve("r4", "bac-01", 35, [{ produitId: "prod-B", quantiteKg: 10 }]),
    ];

    const periodes = segmenterPeriodesAlimentaires(releves, biometries, vagueAvecCalibrage);
    expect(periodes).toHaveLength(2);

    const periodeA = periodes.find((p) => p.produitId === "prod-A");
    const periodeB = periodes.find((p) => p.produitId === "prod-B");

    expect(periodeA).toBeDefined();
    expect(periodeB).toBeDefined();

    // Pre-calibrage : dateDebut = J5 < J25 -> pas de calibrage applicable -> 650
    expect(periodeA!.nombreVivants).toBe(650);

    // Post-calibrage : dateDebut = J26 > J25 -> calibrage applicable -> 130
    expect(periodeB!.nombreVivants).toBe(130);

    // Les deux periodes doivent avoir des nombreVivants differents
    expect(periodeA!.nombreVivants).not.toBe(periodeB!.nombreVivants);
  });
});
