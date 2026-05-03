/**
 * Tests unitaires pour computeVivantsByBac et computeNombreVivantsVague
 * (src/lib/calculs.ts).
 *
 * Verifie la logique de calcul du nombre de vivants :
 *   - Soustraction des morts post-COMPTAGE
 *   - COMPTAGE sans mortalite apres → vivants = comptage exact
 *   - Fallback sans COMPTAGE → vivants = initial - total morts
 *   - Plusieurs bacs avec dates de COMPTAGE differentes
 *   - Fallback bacs=[] avec COMPTAGE global + morts apres
 *   - Releves sans champ date (robustesse)
 */

import { describe, it, expect } from "vitest";
import { computeVivantsByBac, computeNombreVivantsVague } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Releve = {
  bacId: string | null;
  typeReleve: string;
  nombreMorts: number | null;
  nombreCompte: number | null;
  date?: string | Date | null;
};

type Bac = { id: string; nombreInitial: number | null };

/** Cree une date ISO simple a partir de 'YYYY-MM-DD' pour lisibilite des tests */
function d(iso: string): Date {
  return new Date(iso);
}

// ---------------------------------------------------------------------------
// computeVivantsByBac
// ---------------------------------------------------------------------------

describe("computeVivantsByBac", () => {
  // Test 1 — Morts APRES le dernier COMPTAGE sont soustraits
  it("soustrait les morts post-COMPTAGE du compte de COMPTAGE", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: Releve[] = [
      // COMPTAGE jour 5 → 480 poissons
      { bacId: "bac-1", typeReleve: "COMPTAGE", nombreCompte: 480, nombreMorts: null, date: d("2026-01-05") },
      // 3 morts jour 6 (apres COMPTAGE)
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 3, nombreCompte: null, date: d("2026-01-06") },
      // 2 morts jour 7 (apres COMPTAGE)
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 2, nombreCompte: null, date: d("2026-01-07") },
    ];

    const result = computeVivantsByBac(bacs, releves, 500);

    // 480 - 3 - 2 = 475
    expect(result.get("bac-1")).toBe(475);
  });

  // Test 2 — COMPTAGE sans mortalite apres → vivants = compte exact
  it("retourne le compte exact quand aucune mort apres COMPTAGE", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: Releve[] = [
      // 5 morts avant le COMPTAGE
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 5, nombreCompte: null, date: d("2026-01-03") },
      // COMPTAGE jour 5 → 490
      { bacId: "bac-1", typeReleve: "COMPTAGE", nombreCompte: 490, nombreMorts: null, date: d("2026-01-05") },
    ];

    const result = computeVivantsByBac(bacs, releves, 500);

    // Aucune mort apres le comptage → vivants = 490
    expect(result.get("bac-1")).toBe(490);
  });

  // Test 3 — Aucun COMPTAGE : fallback initial - total morts
  it("utilise initial - totalMorts quand aucun COMPTAGE pour le bac", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: Releve[] = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 10, nombreCompte: null, date: d("2026-01-02") },
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 5, nombreCompte: null, date: d("2026-01-04") },
    ];

    const result = computeVivantsByBac(bacs, releves, 500);

    // Pas de COMPTAGE → 500 - 10 - 5 = 485
    expect(result.get("bac-1")).toBe(485);
  });

  // Test 4 — Aucune mort du tout : fallback donne nombreInitial integralement
  it("retourne nombreInitial quand aucune mort et aucun COMPTAGE", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 300 }];
    const releves: Releve[] = [];

    const result = computeVivantsByBac(bacs, releves, 300);

    expect(result.get("bac-1")).toBe(300);
  });

  // Test 5 — Plusieurs bacs avec dates de COMPTAGE differentes
  //   Bac A : COMPTAGE jour 3, mort jour 4 → mort APRES COMPTAGE de A
  //   Bac B : COMPTAGE jour 5, mort jour 4 → mort AVANT COMPTAGE de B (ignoree pour B)
  it("gere des dates de COMPTAGE differentes par bac independamment", () => {
    const bacs: Bac[] = [
      { id: "bac-a", nombreInitial: 200 },
      { id: "bac-b", nombreInitial: 300 },
    ];
    const releves: Releve[] = [
      // Bac A : COMPTAGE jour 3 → 195 poissons
      { bacId: "bac-a", typeReleve: "COMPTAGE", nombreCompte: 195, nombreMorts: null, date: d("2026-01-03") },
      // Mort jour 4 — APRES comptage de A, AVANT comptage de B
      { bacId: "bac-a", typeReleve: "MORTALITE", nombreMorts: 7, nombreCompte: null, date: d("2026-01-04") },
      { bacId: "bac-b", typeReleve: "MORTALITE", nombreMorts: 7, nombreCompte: null, date: d("2026-01-04") },
      // Bac B : COMPTAGE jour 5 → 290 poissons (ce comptage integre deja la mort du jour 4)
      { bacId: "bac-b", typeReleve: "COMPTAGE", nombreCompte: 290, nombreMorts: null, date: d("2026-01-05") },
    ];

    const result = computeVivantsByBac(bacs, releves, 500);

    // Bac A : 195 (comptage) - 7 (post-comptage) = 188
    expect(result.get("bac-a")).toBe(188);
    // Bac B : 290 (comptage) - 0 (aucune mort apres le comptage du jour 5) = 290
    expect(result.get("bac-b")).toBe(290);
  });

  // Test 6 — Bac avec nombreInitial null : fallback sur repartition uniforme
  it("utilise la repartition uniforme si bac.nombreInitial est null", () => {
    const bacs: Bac[] = [
      { id: "bac-1", nombreInitial: null },
      { id: "bac-2", nombreInitial: null },
    ];
    const releves: Releve[] = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 5, nombreCompte: null, date: d("2026-01-02") },
    ];

    const result = computeVivantsByBac(bacs, releves, 400);

    // nombreInitialParBac = round(400 / 2) = 200
    // bac-1: 200 - 5 = 195
    // bac-2: 200 - 0 = 200
    expect(result.get("bac-1")).toBe(195);
    expect(result.get("bac-2")).toBe(200);
  });

  // Test 7 — Morts AVANT le COMPTAGE ne comptent pas dans la soustraction post-comptage
  it("ignore les morts anterieures au COMPTAGE dans le calcul post-comptage", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: Releve[] = [
      // 20 morts AVANT le COMPTAGE
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 20, nombreCompte: null, date: d("2026-01-02") },
      // COMPTAGE jour 5 integre deja les morts precedentes → 476
      { bacId: "bac-1", typeReleve: "COMPTAGE", nombreCompte: 476, nombreMorts: null, date: d("2026-01-05") },
      // 4 morts APRES le COMPTAGE
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 4, nombreCompte: null, date: d("2026-01-08") },
    ];

    const result = computeVivantsByBac(bacs, releves, 500);

    // 476 (comptage) - 4 (post-comptage seulement) = 472
    expect(result.get("bac-1")).toBe(472);
  });
});

// ---------------------------------------------------------------------------
// computeNombreVivantsVague
// ---------------------------------------------------------------------------

describe("computeNombreVivantsVague", () => {
  // Test 1 — Aggrge correctement plusieurs bacs
  it("additionne les vivants de tous les bacs", () => {
    const bacs: Bac[] = [
      { id: "bac-a", nombreInitial: 200 },
      { id: "bac-b", nombreInitial: 300 },
    ];
    const releves: Releve[] = [
      { bacId: "bac-a", typeReleve: "MORTALITE", nombreMorts: 10, nombreCompte: null, date: d("2026-01-03") },
      { bacId: "bac-b", typeReleve: "MORTALITE", nombreMorts: 20, nombreCompte: null, date: d("2026-01-03") },
    ];

    const total = computeNombreVivantsVague(bacs, releves, 500);

    // bac-a: 200-10=190, bac-b: 300-20=280 → 470
    expect(total).toBe(470);
  });

  // Test 2 — Fallback bacs=[], COMPTAGE global existe + morts apres
  it("fallback bacs=[] : soustrait morts post-COMPTAGE global", () => {
    const releves: Releve[] = [
      // COMPTAGE global (bacId null) jour 5
      { bacId: null, typeReleve: "COMPTAGE", nombreCompte: 480, nombreMorts: null, date: d("2026-01-05") },
      // 3 morts jour 6 (apres le COMPTAGE)
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 3, nombreCompte: null, date: d("2026-01-06") },
      // 2 morts jour 7
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 2, nombreCompte: null, date: d("2026-01-07") },
    ];

    const total = computeNombreVivantsVague([], releves, 500);

    // 480 - 3 - 2 = 475
    expect(total).toBe(475);
  });

  // Test 3 — Fallback bacs=[], COMPTAGE sans morts apres
  it("fallback bacs=[] : retourne le COMPTAGE exact si aucune mort apres", () => {
    const releves: Releve[] = [
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 10, nombreCompte: null, date: d("2026-01-02") },
      { bacId: null, typeReleve: "COMPTAGE", nombreCompte: 490, nombreMorts: null, date: d("2026-01-05") },
    ];

    const total = computeNombreVivantsVague([], releves, 500);

    // Aucune mort apres le COMPTAGE → 490
    expect(total).toBe(490);
  });

  // Test 4 — Fallback bacs=[], aucun COMPTAGE → initial - total morts
  it("fallback bacs=[] sans COMPTAGE : initial - totalMorts", () => {
    const releves: Releve[] = [
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 15, nombreCompte: null, date: d("2026-01-03") },
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 10, nombreCompte: null, date: d("2026-01-06") },
    ];

    const total = computeNombreVivantsVague([], releves, 500);

    // 500 - 15 - 10 = 475
    expect(total).toBe(475);
  });

  // Test 5 — Releves sans champ date : robustesse (date undefined/null)
  it("gere les releves sans date (date undefined) sans planter", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 200 }];
    // Releve de MORTALITE sans date
    const releves: Releve[] = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 5, nombreCompte: null },
    ];

    // Ne doit pas lever d'exception
    expect(() => computeNombreVivantsVague(bacs, releves, 200)).not.toThrow();
    const total = computeNombreVivantsVague(bacs, releves, 200);
    // Pas de COMPTAGE → fallback: 200 - 5 = 195
    expect(total).toBe(195);
  });

  // Test 6 — Releve COMPTAGE sans date : la date est traitee comme new Date(0)
  //   Donc toutes les mortalites avec une date reelle sont APRES
  it("releve COMPTAGE sans date : date traitee comme epoch (toutes morts apres)", () => {
    const releves: Releve[] = [
      // COMPTAGE sans date → date fallback = new Date(0) = 1970-01-01
      { bacId: null, typeReleve: "COMPTAGE", nombreCompte: 450, nombreMorts: null, date: undefined },
      // Mort avec date reelle → consideree apres le COMPTAGE
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 10, nombreCompte: null, date: d("2026-01-05") },
    ];

    const total = computeNombreVivantsVague([], releves, 500);

    // 450 (comptage) - 10 (apres epoch) = 440
    expect(total).toBe(440);
  });

  // Test 7 — Aucun releve : vivants = nombreInitial
  it("retourne nombreInitial quand aucun releve", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 500 }];
    const total = computeNombreVivantsVague(bacs, [], 500);
    expect(total).toBe(500);
  });

  // Test 8 — Aucun bac et aucun releve : vivants = nombreInitial
  it("retourne nombreInitial avec bacs=[] et releves=[]", () => {
    const total = computeNombreVivantsVague([], [], 300);
    expect(total).toBe(300);
  });

  // Test 9 — Post-COMPTAGE : morts avec date exactement egale au COMPTAGE ne sont pas deduites
  it("morts a la meme date exacte que le COMPTAGE ne sont PAS post-comptage (strict >)", () => {
    const bacs: Bac[] = [{ id: "bac-1", nombreInitial: 500 }];
    const comptageDate = d("2026-01-05");
    const releves: Releve[] = [
      { bacId: "bac-1", typeReleve: "COMPTAGE", nombreCompte: 480, nombreMorts: null, date: comptageDate },
      // Mort a la meme milliseconde que le COMPTAGE → strictement PAS apres
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 5, nombreCompte: null, date: comptageDate },
    ];

    const result = computeVivantsByBac(bacs, releves, 500);

    // La mort a la meme date que le COMPTAGE n'est pas soustrait (> pas >=)
    expect(result.get("bac-1")).toBe(480);
  });
});

// ---------------------------------------------------------------------------
// BUG-044 — Régression : distribution inégale par bac (nombreInitial réel vs undefined)
// Vague 26-02 : 5500 poissons, 3 bacs (3500 / 1800 / 200)
// Sans fix : nombreInitial = undefined → répartition uniforme ≈ 1833 par bac
// Avec fix : nombreInitial réel utilisé → vivants corrects par bac
// ---------------------------------------------------------------------------

describe("BUG-044 — regression : weighted average chart avec distribution inégale", () => {
  // Bacs avec distribution réelle (3500 / 1800 / 200)
  const bacsAvecNombreInitial: Bac[] = [
    { id: "bac-a", nombreInitial: 3500 },
    { id: "bac-b", nombreInitial: 1800 },
    { id: "bac-c", nombreInitial: 200 },
  ];

  // Bacs sans nombreInitial (bug avant fix : les champs étaient strippés lors du select)
  const bacsSansNombreInitial: Bac[] = [
    { id: "bac-a", nombreInitial: null },
    { id: "bac-b", nombreInitial: null },
    { id: "bac-c", nombreInitial: null },
  ];

  const releves: Releve[] = [];

  it("avec nombreInitial réel : les vivants reflètent la distribution 3500/1800/200", () => {
    const result = computeVivantsByBac(bacsAvecNombreInitial, releves, 5500);

    // Aucune mortalité, aucun comptage → vivants = initial par bac
    expect(result.get("bac-a")).toBe(3500);
    expect(result.get("bac-b")).toBe(1800);
    expect(result.get("bac-c")).toBe(200);
    // Total conservé
    const total = (result.get("bac-a") ?? 0) + (result.get("bac-b") ?? 0) + (result.get("bac-c") ?? 0);
    expect(total).toBe(5500);
  });

  it("BUG : sans nombreInitial (undefined strippé), les vivants tombent sur la répartition uniforme ≈ 1833", () => {
    // C'est le comportement BUGGY que le fix corrige : avant le fix, les bacs avaient
    // nombreInitial = undefined car getVagueById ne le sélectionnait pas depuis AssignationBac.
    const result = computeVivantsByBac(bacsSansNombreInitial, releves, 5500);

    // Répartition uniforme : floor(5500 / 3) = 1833, reste = 1 → dernier bac reçoit 1834
    expect(result.get("bac-a")).toBe(1833);
    expect(result.get("bac-b")).toBe(1833);
    expect(result.get("bac-c")).toBe(1834); // dernier bac reçoit le reste
    const total = (result.get("bac-a") ?? 0) + (result.get("bac-b") ?? 0) + (result.get("bac-c") ?? 0);
    expect(total).toBe(5500);
  });

  it("le poids moyen pondéré diffère significativement entre les deux cas (bug vs fix)", () => {
    // Biométrie du jour J : bac-a=45g, bac-b=50g, bac-c=80g
    // Ces valeurs sont proches de la vague 26-02 décrite dans le rapport de bug.
    const poidsMoyenParBac: Record<string, number> = {
      "bac-a": 45,
      "bac-b": 50,
      "bac-c": 80,
    };

    // Calcul avec les vivants CORRECTS (fix appliqué)
    const vivantsAvecFix = computeVivantsByBac(bacsAvecNombreInitial, releves, 5500);
    let sumWeightedFix = 0;
    let sumWeightsFix = 0;
    for (const [bacId, poids] of Object.entries(poidsMoyenParBac)) {
      const vivants = vivantsAvecFix.get(bacId) ?? 1;
      sumWeightedFix += poids * vivants;
      sumWeightsFix += vivants;
    }
    const poidsMoyenFix = sumWeightedFix / sumWeightsFix;

    // Calcul avec les vivants BUGGY (sans fix : répartition uniforme)
    const vivantsSansFix = computeVivantsByBac(bacsSansNombreInitial, releves, 5500);
    let sumWeightedBug = 0;
    let sumWeightsBug = 0;
    for (const [bacId, poids] of Object.entries(poidsMoyenParBac)) {
      const vivants = vivantsSansFix.get(bacId) ?? 1;
      sumWeightedBug += poids * vivants;
      sumWeightsBug += vivants;
    }
    const poidsMoyenBug = sumWeightedBug / sumWeightsBug;

    // Le fix donne un poids moyen pondéré nettement plus proche de bac-a (3500 poissons à 45g)
    // Le bug sur-représentait bac-c (80g) en lui donnant 1833 vivants au lieu de 200.
    // Fix : (3500*45 + 1800*50 + 200*80) / 5500 = 263500 / 5500 ≈ 47.91g
    // Bug : (1833*45 + 1833*50 + 1834*80) / 5500 ≈ 58.5g (bac-c sur-représenté : 1834 vivants au lieu de 200)
    expect(poidsMoyenFix).toBeCloseTo(47.91, 1);
    expect(poidsMoyenBug).toBeGreaterThan(poidsMoyenFix + 5); // le bug produit une valeur significativement plus haute
  });
});
