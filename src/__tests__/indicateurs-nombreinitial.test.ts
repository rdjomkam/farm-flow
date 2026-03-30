/**
 * Tests d'integration pour getIndicateursVague (src/lib/queries/indicateurs.ts).
 *
 * Verifie que le taux de survie utilise TOUJOURS vague.nombreInitial comme
 * denominateur, et jamais la somme des nombreInitial des bacs.
 *
 * Cas couverts :
 *   1. nombreInitial vague > somme des nombreInitial bacs → survie basee sur vague
 *   2. Bac ajoute en cours de vague (bac.nombreInitial > vague.nombreInitial initial)
 *      → survie toujours par rapport a vague.nombreInitial
 *   3. Vague sans bac → survie basee sur vague.nombreInitial (fallback)
 *   4. Aucune mortalite → tauxSurvie = 100
 *   5. Toutes mortalites → tauxSurvie proche de 0
 *
 * Strategie : mock complet de Prisma pour eviter la DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cree une date ISO simple */
function d(iso: string): Date {
  return new Date(iso);
}

/** Cree un objet vague minimal avec bacs et releves */
function makeVague(overrides: {
  nombreInitial: number;
  poidsMoyenInitial: number;
  bacs?: { id: string; nombrePoissons: number | null; nombreInitial: number | null; poidsMoyenInitial: number | null }[];
  releves?: {
    typeReleve: string;
    date: Date;
    bacId: string | null;
    poidsMoyen: number | null;
    tailleMoyenne: number | null;
    nombreMorts: number | null;
    quantiteAliment: number | null;
    nombreCompte: number | null;
  }[];
}) {
  return {
    id: "vague-1",
    siteId: "site-1",
    code: "V-2026-001",
    statut: "EN_COURS",
    dateDebut: d("2026-01-01"),
    dateFin: null,
    nombreInitial: overrides.nombreInitial,
    poidsMoyenInitial: overrides.poidsMoyenInitial,
    origineAlevins: null,
    bacs: overrides.bacs ?? [],
    releves: overrides.releves ?? [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getIndicateursVague — tauxSurvie utilise vague.nombreInitial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1 — Cas standard : nombreInitial vague > somme nombreInitial bacs
  //   Si on utilisait la somme des bacs, le denominateur serait different
  it("utilise vague.nombreInitial comme denominateur (pas la somme des bacs)", async () => {
    // vague.nombreInitial = 500
    // bac-1.nombreInitial = 200 (distribue a ce bac)
    // bac-2.nombreInitial = 200 (distribue a ce bac)
    // Somme bacs = 400 ≠ 500 (vague en a 500 car l'historique est plus grand)
    const vague = makeVague({
      nombreInitial: 500,
      poidsMoyenInitial: 10,
      bacs: [
        { id: "bac-1", nombrePoissons: 195, nombreInitial: 200, poidsMoyenInitial: 10 },
        { id: "bac-2", nombrePoissons: 190, nombreInitial: 200, poidsMoyenInitial: 10 },
      ],
      releves: [
        // 10 morts dans bac-1
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-05"), bacId: "bac-1", poidsMoyen: null, tailleMoyenne: null, nombreMorts: 10, quantiteAliment: null, nombreCompte: null },
        // 10 morts dans bac-2
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-05"), bacId: "bac-2", poidsMoyen: null, tailleMoyenne: null, nombreMorts: 10, quantiteAliment: null, nombreCompte: null },
      ],
    });

    mockVagueFindFirst.mockResolvedValue(vague);

    const result = await getIndicateursVague("site-1", "vague-1");
    expect(result).not.toBeNull();

    // vivants = (200-10) + (200-10) = 380 (fallback: bac.nombreInitial - mortsBac)
    // tauxSurvie = 380 / 500 * 100 = 76%  (denominateur = vague.nombreInitial)
    // Si on avait utilise la somme des bacs (400) : 380/400 = 95% → mauvais
    expect(result!.tauxSurvie).toBeCloseTo(76, 0);
    expect(result!.nombreVivants).toBe(380);
  });

  // Test 2 — Bac ajoute en cours de vague
  //   vague.nombreInitial = 300 (avant ajout)
  //   Puis on a incremente vague.nombreInitial lors de l'ajout du bac-2
  //   Au moment du test, vague.nombreInitial = 500 (300 + 200)
  //   bac-1.nombreInitial = 300, bac-2.nombreInitial = 200
  //   Morts = 50 total → vivants = 450
  //   tauxSurvie = 450 / 500 = 90%
  it("taux de survie correct quand un bac a ete ajoute en cours de vague", async () => {
    const vague = makeVague({
      nombreInitial: 500, // apres ajout du bac-2
      poidsMoyenInitial: 10,
      bacs: [
        { id: "bac-1", nombrePoissons: 270, nombreInitial: 300, poidsMoyenInitial: 10 },
        { id: "bac-2", nombrePoissons: 180, nombreInitial: 200, poidsMoyenInitial: 10 },
      ],
      releves: [
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-10"), bacId: "bac-1", poidsMoyen: null, tailleMoyenne: null, nombreMorts: 30, quantiteAliment: null, nombreCompte: null },
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-10"), bacId: "bac-2", poidsMoyen: null, tailleMoyenne: null, nombreMorts: 20, quantiteAliment: null, nombreCompte: null },
      ],
    });

    mockVagueFindFirst.mockResolvedValue(vague);

    const result = await getIndicateursVague("site-1", "vague-1");
    expect(result).not.toBeNull();

    // vivants = (300-30) + (200-20) = 270 + 180 = 450
    // tauxSurvie = 450 / 500 = 90%
    expect(result!.nombreVivants).toBe(450);
    expect(result!.tauxSurvie).toBeCloseTo(90, 0);
  });

  // Test 3 — Vague sans bac (bacs=[]) : fallback sur logique globale
  it("calcule le taux de survie correctement quand aucun bac attache", async () => {
    const vague = makeVague({
      nombreInitial: 400,
      poidsMoyenInitial: 10,
      bacs: [],
      releves: [
        // 40 morts globales (bacId null)
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-05"), bacId: null, poidsMoyen: null, tailleMoyenne: null, nombreMorts: 40, quantiteAliment: null, nombreCompte: null },
      ],
    });

    mockVagueFindFirst.mockResolvedValue(vague);

    const result = await getIndicateursVague("site-1", "vague-1");
    expect(result).not.toBeNull();

    // vivants = 400 - 40 = 360
    // tauxSurvie = 360 / 400 * 100 = 90%
    expect(result!.nombreVivants).toBe(360);
    expect(result!.tauxSurvie).toBeCloseTo(90, 0);
  });

  // Test 4 — Aucune mortalite → tauxSurvie = 100
  it("retourne tauxSurvie=100 quand aucune mortalite", async () => {
    const vague = makeVague({
      nombreInitial: 500,
      poidsMoyenInitial: 10,
      bacs: [
        { id: "bac-1", nombrePoissons: 250, nombreInitial: 250, poidsMoyenInitial: 10 },
        { id: "bac-2", nombrePoissons: 250, nombreInitial: 250, poidsMoyenInitial: 10 },
      ],
      releves: [],
    });

    mockVagueFindFirst.mockResolvedValue(vague);

    const result = await getIndicateursVague("site-1", "vague-1");
    expect(result).not.toBeNull();

    expect(result!.nombreVivants).toBe(500);
    expect(result!.tauxSurvie).toBe(100);
  });

  // Test 5 — Toutes les mortalites enregistrees → tauxSurvie proche de 0
  it("retourne tauxSurvie proche de 0 quand mortalite totale", async () => {
    const vague = makeVague({
      nombreInitial: 500,
      poidsMoyenInitial: 10,
      bacs: [
        { id: "bac-1", nombrePoissons: 0, nombreInitial: 500, poidsMoyenInitial: 10 },
      ],
      releves: [
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-05"), bacId: "bac-1", poidsMoyen: null, tailleMoyenne: null, nombreMorts: 500, quantiteAliment: null, nombreCompte: null },
      ],
    });

    mockVagueFindFirst.mockResolvedValue(vague);

    const result = await getIndicateursVague("site-1", "vague-1");
    expect(result).not.toBeNull();

    expect(result!.nombreVivants).toBe(0);
    expect(result!.tauxSurvie).toBe(0);
  });

  // Test 6 — Vague introuvable → null
  it("retourne null si la vague est introuvable", async () => {
    mockVagueFindFirst.mockResolvedValue(null);

    const result = await getIndicateursVague("site-1", "vague-inexistante");
    expect(result).toBeNull();
  });

  // Test 7 — Avec COMPTAGE : vivants bases sur dernierComptage - mortsApres,
  //   mais le denominateur du tauxSurvie reste vague.nombreInitial
  it("tauxSurvie denominateur reste vague.nombreInitial meme avec COMPTAGE", async () => {
    // vague.nombreInitial = 500
    // COMPTAGE jour 10 → 460 poissons
    // 10 morts apres le COMPTAGE
    // vivants = 460 - 10 = 450
    // tauxSurvie = 450 / 500 = 90%   (pas 450/460 = 97.8%)
    const vague = makeVague({
      nombreInitial: 500,
      poidsMoyenInitial: 10,
      bacs: [
        { id: "bac-1", nombrePoissons: 450, nombreInitial: 500, poidsMoyenInitial: 10 },
      ],
      releves: [
        { typeReleve: TypeReleve.COMPTAGE, date: d("2026-01-10"), bacId: "bac-1", poidsMoyen: null, tailleMoyenne: null, nombreMorts: null, quantiteAliment: null, nombreCompte: 460 },
        { typeReleve: TypeReleve.MORTALITE, date: d("2026-01-15"), bacId: "bac-1", poidsMoyen: null, tailleMoyenne: null, nombreMorts: 10, quantiteAliment: null, nombreCompte: null },
      ],
    });

    mockVagueFindFirst.mockResolvedValue(vague);

    const result = await getIndicateursVague("site-1", "vague-1");
    expect(result).not.toBeNull();

    expect(result!.nombreVivants).toBe(450);
    // Denominateur = vague.nombreInitial = 500
    expect(result!.tauxSurvie).toBeCloseTo(90, 0);
  });
});
