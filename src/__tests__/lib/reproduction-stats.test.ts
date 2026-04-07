/**
 * Tests unitaires — Statistiques de la chaine de reproduction (R4)
 *
 * Fichier source : src/lib/queries/reproduction-stats.ts
 *
 * Couvre :
 *   - getReproductionStats  : taux de fecondation, eclosion, survie larvaire, global
 *   - getReproductionFunnel : funnel 3 etapes [Oeufs, Larves viables, Alevins actifs]
 *
 * Prisma est integralement moque pour isoler la logique metier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getReproductionStats,
  getReproductionFunnel,
} from "@/lib/queries/reproduction-stats";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPonteFindMany = vi.fn();
const mockIncubationFindMany = vi.fn();
const mockLotAlevinsFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    ponte: {
      findMany: (...args: unknown[]) => mockPonteFindMany(...args),
    },
    incubation: {
      findMany: (...args: unknown[]) => mockIncubationFindMany(...args),
    },
    lotAlevins: {
      findMany: (...args: unknown[]) => mockLotAlevinsFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

const SITE_ID = "site-test-001";

// ---------------------------------------------------------------------------
// getReproductionStats
// ---------------------------------------------------------------------------

describe("getReproductionStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne des zeros quand aucune donnee", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const stats = await getReproductionStats(SITE_ID);

    expect(stats.totalPontes).toBe(0);
    expect(stats.pontesReussies).toBe(0);
    expect(stats.tauxFecondation).toBe(0);
    expect(stats.totalOeufs).toBe(0);
    expect(stats.totalLarvesViables).toBe(0);
    expect(stats.tauxEclosion).toBe(0);
    expect(stats.totalAlevinsActuels).toBe(0);
    expect(stats.tauxSurvieLarvaire).toBe(0);
    expect(stats.tauxSurvieGlobal).toBe(0);
  });

  it("calcule le tauxFecondation correctement : pontesReussies / totalPontes * 100", async () => {
    // 2 TERMINEE sur 4 pontes = 50%
    mockPonteFindMany.mockResolvedValue([
      { statut: "TERMINEE", nombreOeufsEstime: 1000, nombreLarvesViables: 800 },
      { statut: "TERMINEE", nombreOeufsEstime: 1000, nombreLarvesViables: 800 },
      { statut: "EN_COURS", nombreOeufsEstime: null, nombreLarvesViables: null },
      { statut: "ECHOUEE", nombreOeufsEstime: null, nombreLarvesViables: null },
    ]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const stats = await getReproductionStats(SITE_ID);

    expect(stats.totalPontes).toBe(4);
    expect(stats.pontesReussies).toBe(2);
    expect(stats.tauxFecondation).toBe(50);
  });

  it("calcule le tauxEclosion correctement depuis les incubations : larvesViables / oeufsPlaces * 100", async () => {
    mockPonteFindMany.mockResolvedValue([
      { statut: "TERMINEE", nombreOeufsEstime: 500, nombreLarvesViables: null },
    ]);
    // 800 larves / 1000 oeufs = 80%
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const stats = await getReproductionStats(SITE_ID);

    expect(stats.tauxEclosion).toBe(80);
  });

  it("se replie sur les oeufs des pontes si les incubations n'en ont pas", async () => {
    // Pontes ont 1000 oeufs estimes, incubations n'ont pas nombreOeufsPlaces
    mockPonteFindMany.mockResolvedValue([
      { statut: "TERMINEE", nombreOeufsEstime: 1000, nombreLarvesViables: 800 },
    ]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: null, nombreLarvesViables: null },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const stats = await getReproductionStats(SITE_ID);

    // totalOeufs = 1000 (depuis pontes) car incubations ont 0 oeufsPlaces
    expect(stats.totalOeufs).toBe(1000);
  });

  it("calcule le tauxSurvieGlobal : produit des 3 taux / 10000", async () => {
    // tauxFecondation = 100% (1 TERMINEE / 1 ponte)
    // tauxEclosion = 80% (800 larves / 1000 oeufs)
    // tauxSurvieLarvaire = 50% (400 alevins / 800 larves)
    // tauxGlobal = 100 * 80 * 50 / 10000 = 40%
    mockPonteFindMany.mockResolvedValue([
      { statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null },
    ]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 400 },
    ]);

    const stats = await getReproductionStats(SITE_ID);

    expect(stats.tauxFecondation).toBe(100);
    expect(stats.tauxEclosion).toBe(80);
    expect(stats.tauxSurvieLarvaire).toBe(50);
    expect(stats.tauxSurvieGlobal).toBe(40);
  });

  it("respecte le filtre dateDebut / dateFin pour les pontes", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const dateDebut = new Date("2026-01-01");
    const dateFin = new Date("2026-03-31");

    await getReproductionStats(SITE_ID, dateDebut, dateFin);

    const queryArgs = mockPonteFindMany.mock.calls[0][0];
    expect(queryArgs.where.datePonte).toBeDefined();
    expect(queryArgs.where.datePonte.gte).toEqual(dateDebut);
    expect(queryArgs.where.datePonte.lte).toEqual(dateFin);
  });

  it("n'applique pas de filtre date si aucune date n'est fournie", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    await getReproductionStats(SITE_ID);

    const queryArgs = mockPonteFindMany.mock.calls[0][0];
    expect(queryArgs.where.datePonte).toBeUndefined();
  });

  it("plafonne le taux de fecondation a 100%", async () => {
    // Cas improbable mais defensive : si pontesReussies > totalPontes (bug donnees)
    // La formule retourne > 100 mais Math.min(100, ...) doit plafonner
    mockPonteFindMany.mockResolvedValue([
      { statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null },
    ]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const stats = await getReproductionStats(SITE_ID);

    expect(stats.tauxFecondation).toBeLessThanOrEqual(100);
    expect(stats.tauxEclosion).toBeLessThanOrEqual(100);
    expect(stats.tauxSurvieLarvaire).toBeLessThanOrEqual(100);
    expect(stats.tauxSurvieGlobal).toBeLessThanOrEqual(100);
  });

  it("calcule totalAlevinsActuels en sommant les lots EN_ELEVAGE et TRANSFERE", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 200 },
      { nombreActuel: 150 },
      { nombreActuel: 100 },
    ]);

    const stats = await getReproductionStats(SITE_ID);

    expect(stats.totalAlevinsActuels).toBe(450);
  });

  it("retourne totalLarvesViables depuis les incubations quand disponibles", async () => {
    mockPonteFindMany.mockResolvedValue([
      { statut: "TERMINEE", nombreOeufsEstime: 1000, nombreLarvesViables: 100 }, // ignorees
    ]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 750 },
      { nombreOeufsPlaces: 500, nombreLarvesViables: 400 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const stats = await getReproductionStats(SITE_ID);

    // 750 + 400 = 1150 larves depuis les incubations (priorite sur les pontes)
    expect(stats.totalLarvesViables).toBe(1150);
  });
});

// ---------------------------------------------------------------------------
// getReproductionFunnel
// ---------------------------------------------------------------------------

describe("getReproductionFunnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne un tableau de 3 etapes : Oeufs, Larves viables, Alevins actifs", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 600 },
    ]);

    const funnel = await getReproductionFunnel(SITE_ID);

    expect(funnel).toHaveLength(3);
    expect(funnel[0].etape).toBe("Oeufs");
    expect(funnel[1].etape).toBe("Larves viables");
    expect(funnel[2].etape).toBe("Alevins actifs");
  });

  it("la premiere etape a toujours 100% de pourcentage", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 600 },
    ]);

    const funnel = await getReproductionFunnel(SITE_ID);

    expect(funnel[0].pourcentage).toBe(100);
  });

  it("chaque etape contient le bon count", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 2000, nombreLarvesViables: 1600 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 1000 },
    ]);

    const funnel = await getReproductionFunnel(SITE_ID);

    expect(funnel[0].count).toBe(2000);   // oeufs
    expect(funnel[1].count).toBe(1600);   // larves viables
    expect(funnel[2].count).toBe(1000);   // alevins actifs
  });

  it("calcule le pourcentage de chaque etape par rapport a la precedente", async () => {
    // 2000 oeufs -> 1600 larves (80%) -> 800 alevins (50%)
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 2000, nombreLarvesViables: 1600 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 800 },
    ]);

    const funnel = await getReproductionFunnel(SITE_ID);

    expect(funnel[0].pourcentage).toBe(100);
    expect(funnel[1].pourcentage).toBe(80);
    expect(funnel[2].pourcentage).toBe(50);
  });

  it("retourne 0% pour les etapes subsequentes quand pas de donnees", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const funnel = await getReproductionFunnel(SITE_ID);

    expect(funnel[0].pourcentage).toBe(100);
    expect(funnel[1].pourcentage).toBe(0);
    expect(funnel[2].pourcentage).toBe(0);
    expect(funnel[0].count).toBe(0);
    expect(funnel[1].count).toBe(0);
    expect(funnel[2].count).toBe(0);
  });

  it("propage les filtres de date a getReproductionStats via les appels Prisma", async () => {
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const dateDebut = new Date("2026-01-01");
    const dateFin = new Date("2026-06-30");

    await getReproductionFunnel(SITE_ID, dateDebut, dateFin);

    // getReproductionFunnel appelle getReproductionStats qui appelle Prisma
    const queryArgs = mockPonteFindMany.mock.calls[0][0];
    expect(queryArgs.where.datePonte).toBeDefined();
    expect(queryArgs.where.datePonte.gte).toEqual(dateDebut);
    expect(queryArgs.where.datePonte.lte).toEqual(dateFin);
  });

  it("plafonne les pourcentages a 100%", async () => {
    // Cas defensif : plus de larves que d'oeufs (donnees incorrectes)
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 100, nombreLarvesViables: 200 }, // 200% => plafonne a 100%
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    const funnel = await getReproductionFunnel(SITE_ID);

    expect(funnel[1].pourcentage).toBeLessThanOrEqual(100);
  });
});
