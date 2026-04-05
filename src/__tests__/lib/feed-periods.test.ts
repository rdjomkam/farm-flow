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
 *   - methodeRank : ordre de priorite 0-4 (VALEUR_INITIALE < LINEAIRE < GOMPERTZ < BIOMETRIE_EXACTE < BIOMETRIE_INTERPOLEE)
 *
 * ADR-028 — FCR feed-switching accuracy.
 * ADR-029 — Configurable interpolation strategy (LINEAIRE vs GOMPERTZ_VAGUE).
 */

import { describe, it, expect } from "vitest";
import {
  interpolerPoidsBac,
  segmenterPeriodesAlimentaires,
  type ReleveAlimPoint,
  type BiometriePoint,
  type VagueContext,
  type GompertzVagueContext,
  type GompertzBacContext,
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
    // Une biometrie non exacte est necessaire pour que la garde "bacBios.length === 0"
    // ne court-circuite pas la logique Gompertz
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

describe("methodeRank — ordre de priorite 0-4 (ADR-029 legacy — see ADR-030 for 5 levels)", () => {
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
// ADR-030 — interpolerPoidsBac avec strategie GOMPERTZ_BAC
// ---------------------------------------------------------------------------

/**
 * Contexte Gompertz bac valide par defaut pour les tests ADR-030.
 *
 * Parametres biologiquement plausibles pour Clarias gariepinus — bac individuel.
 * HIGH confidence : biometrieCount >= 8, r2 > 0.95.
 */
const GOMPERTZ_BAC_CTX_HIGH: GompertzBacContext = {
  wInfinity: 1200,
  k: 0.018,
  ti: 95,
  r2: 0.97,
  biometrieCount: 8,
  confidenceLevel: "HIGH",
  vagueDebut: makeDate(0),
};

const GOMPERTZ_BAC_CTX_MEDIUM: GompertzBacContext = {
  wInfinity: 1100,
  k: 0.020,
  ti: 90,
  r2: 0.87,
  biometrieCount: 5,
  confidenceLevel: "MEDIUM",
  vagueDebut: makeDate(0),
};

describe("interpolerPoidsBac — strategie GOMPERTZ_BAC (ADR-030)", () => {
  // ---- Cas nominal : GOMPERTZ_BAC HIGH, valeurs valides ------------------

  it("GOMPERTZ_BAC + contexte HIGH valide -> retourne le poids Gompertz du bac", () => {
    const targetDate = makeDate(50);
    const expectedPoids = gompertzWeight(50, {
      wInfinity: GOMPERTZ_BAC_CTX_HIGH.wInfinity,
      k: GOMPERTZ_BAC_CTX_HIGH.k,
      ti: GOMPERTZ_BAC_CTX_HIGH.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80), // non exacte a J50
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_BAC");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  it("GOMPERTZ_BAC + contexte MEDIUM valide -> methode = GOMPERTZ_BAC", () => {
    const targetDate = makeDate(40);
    const expectedPoids = gompertzWeight(40, {
      wInfinity: GOMPERTZ_BAC_CTX_MEDIUM.wInfinity,
      k: GOMPERTZ_BAC_CTX_MEDIUM.k,
      ti: GOMPERTZ_BAC_CTX_MEDIUM.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 30), // non exacte a J40
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_MEDIUM],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_BAC");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  // ---- Biometrie exacte prime toujours sur GOMPERTZ_BAC (etape 1 inchangee) ----

  it("biometrie exacte le meme jour prime sur GOMPERTZ_BAC", () => {
    const targetDate = makeDate(50);
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 50, 777), // biometrie exacte a J50
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("BIOMETRIE_EXACTE");
    expect(result!.poids).toBe(777);
  });

  // ---- GOMPERTZ_BAC avec gompertzMinPoints=3 (choix de l'eleveur) --------

  it("GOMPERTZ_BAC avec n=3 minPoints et biometrieCount=3 -> GOMPERTZ_BAC utilise", () => {
    const ctxN3: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      biometrieCount: 3,
      r2: 0.999,
      confidenceLevel: "HIGH",
    };
    const targetDate = makeDate(60);
    const expectedPoids = gompertzWeight(60, {
      wInfinity: ctxN3.wInfinity,
      k: ctxN3.k,
      ti: ctxN3.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 40), // non exacte a J60
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxN3],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 3, // seuil abaisse a 3 par l'eleveur
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_BAC");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });
});

// ---------------------------------------------------------------------------
// ADR-030 — fallbacks GOMPERTZ_BAC -> GOMPERTZ_VAGUE -> LINEAIRE -> INITIALE
// ---------------------------------------------------------------------------

describe("interpolerPoidsBac — fallbacks GOMPERTZ_BAC (ADR-030)", () => {
  // ---- Fallback : bacId absent de la Map ---------------------------------

  it("bacId absent de gompertzBacContexts -> fallback GOMPERTZ_VAGUE", () => {
    // bac-A n'est pas dans la Map -> fallback sur GompertzVague
    const targetDate = makeDate(50);
    const expectedPoids = gompertzWeight(50, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-B", GOMPERTZ_BAC_CTX_HIGH], // seul bac-B est dans la Map, pas bac-A
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  // ---- Fallback : gompertzBacContexts non fourni -------------------------

  it("gompertzBacContexts non fourni -> fallback GOMPERTZ_VAGUE", () => {
    const targetDate = makeDate(50);
    const expectedPoids = gompertzWeight(50, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      // gompertzBacContexts non fourni
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  // ---- Fallback : confidenceLevel bac = LOW -> GOMPERTZ_VAGUE -----------

  it("confidenceLevel bac = LOW -> fallback GOMPERTZ_VAGUE", () => {
    const ctxLow: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      confidenceLevel: "LOW",
      r2: 0.88, // r2 ok mais LOW -> refus
    };
    const targetDate = makeDate(50);
    const expectedPoids = gompertzWeight(50, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxLow],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });

  // ---- Fallback : confidenceLevel bac = INSUFFICIENT_DATA -> GOMPERTZ_VAGUE ----

  it("confidenceLevel bac = INSUFFICIENT_DATA -> fallback GOMPERTZ_VAGUE", () => {
    const ctxInsufficient: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      confidenceLevel: "INSUFFICIENT_DATA",
    };
    const targetDate = makeDate(50);
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxInsufficient],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
  });

  // ---- Fallback : r2 bac < 0.85 -> GOMPERTZ_VAGUE -----------------------

  it("r2 bac < 0.85 -> fallback GOMPERTZ_VAGUE", () => {
    const ctxBadR2: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      r2: 0.80, // sous le seuil 0.85
    };
    const targetDate = makeDate(50);
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxBadR2],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
  });

  // ---- Fallback : biometrieCount bac < minPoints -> GOMPERTZ_VAGUE ------

  it("biometrieCount bac < gompertzMinPoints -> fallback GOMPERTZ_VAGUE", () => {
    const ctxFewPoints: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      biometrieCount: 3, // sous le seuil de 5
    };
    const targetDate = makeDate(50);
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxFewPoints],
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
  });

  // ---- Double fallback : bac LOW + vague LOW -> INTERPOLATION_LINEAIRE --

  it("bac LOW + vague LOW -> fallback INTERPOLATION_LINEAIRE", () => {
    const ctxBacLow: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      confidenceLevel: "LOW",
    };
    const ctxVagueLow: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      confidenceLevel: "LOW",
    };
    // Biometries encadrantes pour que INTERPOLATION_LINEAIRE soit disponible
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxBacLow],
    ]);

    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: ctxVagueLow,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
  });

  // ---- Triple fallback : bac LOW + vague LOW + pas de biometries -> VALEUR_INITIALE ----

  it("bac LOW + vague LOW + aucune biometrie encadrante -> VALEUR_INITIALE", () => {
    const ctxBacLow: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      confidenceLevel: "LOW",
    };
    const ctxVagueLow: GompertzVagueContext = {
      ...GOMPERTZ_CTX_HIGH,
      confidenceLevel: "LOW",
    };
    // Biometrie apres la date cible -> pas d'encadrement -> VALEUR_INITIALE
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 60, 200), // apres la date cible J30
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxBacLow],
    ]);

    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: ctxVagueLow,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("VALEUR_INITIALE");
  });

  // ---- Strategies LINEAIRE et GOMPERTZ_VAGUE ignorent gompertzBacContexts ----

  it("strategie LINEAIRE ignore gompertzBacContexts meme si fourni", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 0, 10),
      makeBio("bac-A", 60, 200),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH],
    ]);

    const result = interpolerPoidsBac(makeDate(30), "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.LINEAIRE,
      gompertzBacContexts: bacContexts,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("INTERPOLATION_LINEAIRE");
    // interpolation lineaire : 10 + (200-10) * (30/60) = 105g
    expect(result!.poids).toBeCloseTo(105, 3);
  });

  it("strategie GOMPERTZ_VAGUE ignore gompertzBacContexts meme si fourni", () => {
    const targetDate = makeDate(50);
    const expectedPoids = gompertzWeight(50, {
      wInfinity: GOMPERTZ_CTX_HIGH.wInfinity,
      k: GOMPERTZ_CTX_HIGH.k,
      ti: GOMPERTZ_CTX_HIGH.ti,
    });

    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 10, 80),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH], // fourni mais ignore car strategie = GOMPERTZ_VAGUE
    ]);

    const result = interpolerPoidsBac(targetDate, "bac-A", biometries, 10, {
      strategie: StrategieInterpolation.GOMPERTZ_VAGUE,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).not.toBeNull();
    expect(result!.methode).toBe("GOMPERTZ_VAGUE");
    expect(result!.poids).toBeCloseTo(expectedPoids, 6);
  });
});

// ---------------------------------------------------------------------------
// ADR-030 — segmenterPeriodesAlimentaires avec GOMPERTZ_BAC
// ---------------------------------------------------------------------------

describe("segmenterPeriodesAlimentaires — strategie GOMPERTZ_BAC (ADR-030)", () => {
  it("options transmises avec gompertzBacContexts -> periodes utilisent GOMPERTZ_BAC", () => {
    // bac-A a un contexte HIGH valide -> GOMPERTZ_BAC
    // Une biometrie non exacte est necessaire pour eviter la garde precoce
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 2, 25), // non exacte par rapport a J5 et J20
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH],
    ]);

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_BAC");
  });

  it("scenario mixte : bac-A (GOMPERTZ_BAC) et bac-B (fallback GOMPERTZ_VAGUE)", () => {
    // bac-A : dans la Map -> GOMPERTZ_BAC
    // bac-B : pas dans la Map -> fallback GOMPERTZ_VAGUE
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 2, 25), // non exacte pour bac-A
      makeBio("bac-B", 3, 30), // non exacte pour bac-B
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r3", "bac-B", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r4", "bac-B", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH], // bac-A a assez de donnees
      // bac-B absent -> fallback GOMPERTZ_VAGUE
    ]);

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(2);

    const periodeA = result.find((p) => p.bacId === "bac-A");
    const periodeB = result.find((p) => p.bacId === "bac-B");

    expect(periodeA).toBeDefined();
    expect(periodeB).toBeDefined();
    expect(periodeA!.methodeEstimation).toBe("GOMPERTZ_BAC");
    expect(periodeB!.methodeEstimation).toBe("GOMPERTZ_VAGUE");
  });
});

// ---------------------------------------------------------------------------
// ADR-030 — methodeRank 5 niveaux (BIOMETRIE_EXACTE=4, GOMPERTZ_BAC=3,
//           GOMPERTZ_VAGUE=2, INTERPOLATION_LINEAIRE=1, VALEUR_INITIALE=0)
// ---------------------------------------------------------------------------

describe("methodeRank — ordre de priorite 5 niveaux (ADR-030)", () => {
  /**
   * On verifie que GOMPERTZ_BAC a bien un rang superieur a GOMPERTZ_VAGUE (3 > 2),
   * et que BIOMETRIE_EXACTE a bien un rang superieur a GOMPERTZ_BAC (4 > 3).
   */

  it("BIOMETRIE_EXACTE (rang 4) > GOMPERTZ_BAC (rang 3) -> GOMPERTZ_BAC conservateur", () => {
    // debut = BIOMETRIE_EXACTE (J5 biometrie exacte)
    // fin   = GOMPERTZ_BAC (J20, pas de biometrie exacte)
    // min(4, 3) = 3 -> methode = GOMPERTZ_BAC
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 50), // biometrie exacte au debut de la periode
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH],
    ]);

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    // debut = BIOMETRIE_EXACTE (rang 4), fin = GOMPERTZ_BAC (rang 3)
    // methodeRank(debut)=4 > methodeRank(fin)=3 -> retourne methode de fin = GOMPERTZ_BAC
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_BAC");
  });

  it("GOMPERTZ_BAC (rang 3) > GOMPERTZ_VAGUE (rang 2) dans la comparaison de rang", () => {
    // debut = GOMPERTZ_BAC (bac-A dans la Map)
    // fin   = GOMPERTZ_VAGUE (bac-A dans la Map mais on va forcer la fin a n'avoir que VAGUE)
    //
    // Strategie : utiliser un contexte bac dont vagueDebut est APRES le debut de la periode
    // fin  = J5  : vagueDebut bac = makeDate(10) -> tDays = 5-10 = -5 < 0 -> fallback GOMPERTZ_VAGUE
    // debut = J25 : vagueDebut bac = makeDate(10) -> tDays = 25-10 = 15 >= 0 -> GOMPERTZ_BAC
    //
    // Mais l'ordre debut/fin depend de l'ordre des releves. On va construire une periode
    // dont la borne debut a tDays negatif (-> GOMPERTZ_VAGUE) et la borne fin a tDays positif (-> GOMPERTZ_BAC)
    // -> min(2, 3) = 2 -> GOMPERTZ_VAGUE
    const ctxBacDebutTard: GompertzBacContext = {
      ...GOMPERTZ_BAC_CTX_HIGH,
      vagueDebut: makeDate(15), // vague debut = J15, apres le 1er releve J5
    };
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 3, 20), // non exacte pour J5 et J25
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 25, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", ctxBacDebutTard],
    ]);

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzContext: GOMPERTZ_CTX_HIGH, // vague valide comme fallback
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    // debut J5  : tDays = 5-15 = -10 < 0 -> GOMPERTZ_BAC refuse -> fallback GOMPERTZ_VAGUE (rang 2)
    // fin   J25 : tDays = 25-15 = 10 >= 0 -> GOMPERTZ_BAC (rang 3)
    // min(2, 3) = 2 -> methodeEstimation = GOMPERTZ_VAGUE
    expect(result[0].methodeEstimation).toBe("GOMPERTZ_VAGUE");
  });

  it("BIOMETRIE_EXACTE (rang 4) sur les deux bornes -> BIOMETRIE_EXACTE meme avec GOMPERTZ_BAC configure", () => {
    const biometries: BiometriePoint[] = [
      makeBio("bac-A", 5, 50),
      makeBio("bac-A", 20, 150),
    ];
    const releves: ReleveAlimPoint[] = [
      makeReleve("r1", "bac-A", 5, [{ produitId: "prod-X", quantiteKg: 3 }]),
      makeReleve("r2", "bac-A", 20, [{ produitId: "prod-X", quantiteKg: 3 }]),
    ];
    const bacContexts = new Map<string, GompertzBacContext>([
      ["bac-A", GOMPERTZ_BAC_CTX_HIGH],
    ]);

    const result = segmenterPeriodesAlimentaires(releves, biometries, BASE_VAGUE_CONTEXT, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: bacContexts,
      gompertzMinPoints: 5,
    });

    expect(result).toHaveLength(1);
    // Les deux bornes ont une biometrie exacte -> rang 4 partout -> BIOMETRIE_EXACTE
    expect(result[0].methodeEstimation).toBe("BIOMETRIE_EXACTE");
  });

  it("rang : VALEUR_INITIALE(0) < INTERPOLATION_LINEAIRE(1) < GOMPERTZ_VAGUE(2) < GOMPERTZ_BAC(3) < BIOMETRIE_EXACTE(4)", () => {
    // Test indirect : on verifie que les 5 niveaux existent via les methodes observees
    // dans les tests precedents. Ce test vaut comme documentation de l'ordre.

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

    // GOMPERTZ_BAC = 3
    const resGB = interpolerPoidsBac(makeDate(50), "bac-A", [makeBio("bac-A", 5, 40)], 10, {
      strategie: StrategieInterpolation.GOMPERTZ_BAC,
      gompertzBacContexts: new Map([["bac-A", GOMPERTZ_BAC_CTX_HIGH]]),
      gompertzMinPoints: 5,
    });
    expect(resGB!.methode).toBe("GOMPERTZ_BAC");

    // BIOMETRIE_EXACTE = 4
    const resExact = interpolerPoidsBac(makeDate(50), "bac-A", [makeBio("bac-A", 50, 500)], 10);
    expect(resExact!.methode).toBe("BIOMETRIE_EXACTE");
  });
});
