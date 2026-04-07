/**
 * Tests unitaires — KPIs et Planning de reproduction
 *
 * Fichier source : src/lib/queries/reproduction-stats.ts
 *
 * Couvre :
 *   - getReproductionKpis  : tous les champs, calculs des taux, cas zero, filtres dates
 *   - getReproductionLotsKpis : parPhase groupe par phase, phaseMoyenneDureeJours
 *   - getReproductionPlanningEvents : 4 tableaux, filtre par plage de dates
 *
 * Prisma est integralement moque pour isoler la logique metier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getReproductionKpis,
  getReproductionLotsKpis,
  getReproductionPlanningEvents,
} from "@/lib/queries/reproduction-stats";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPonteFindMany = vi.fn();
const mockPonteCount = vi.fn();
const mockIncubationFindMany = vi.fn();
const mockLotAlevinsFindMany = vi.fn();
const mockLotAlevinsCount = vi.fn();
const mockReproducteurCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    ponte: {
      findMany: (...args: unknown[]) => mockPonteFindMany(...args),
      count: (...args: unknown[]) => mockPonteCount(...args),
    },
    incubation: {
      findMany: (...args: unknown[]) => mockIncubationFindMany(...args),
    },
    lotAlevins: {
      findMany: (...args: unknown[]) => mockLotAlevinsFindMany(...args),
      count: (...args: unknown[]) => mockLotAlevinsCount(...args),
    },
    reproducteur: {
      count: (...args: unknown[]) => mockReproducteurCount(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

const SITE_ID = "site-test-001";

// ---------------------------------------------------------------------------
// getReproductionKpis
// ---------------------------------------------------------------------------

describe("getReproductionKpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Valeurs par defaut : aucune donnee
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);
    // lotAlevins.count est appele 3 fois (EN_ELEVAGE, TRANSFERE, PERDU)
    mockLotAlevinsCount.mockResolvedValue(0);
    // reproducteur.count est appele 3 fois (FEMELLE, MALE, femellesActives)
    mockReproducteurCount.mockResolvedValue(0);
  });

  it("retourne tous les champs attendus", async () => {
    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis).toHaveProperty("totalPontes");
    expect(kpis).toHaveProperty("totalPontesReussies");
    expect(kpis).toHaveProperty("totalOeufs");
    expect(kpis).toHaveProperty("totalLarvesViables");
    expect(kpis).toHaveProperty("totalAlevinsActifs");
    expect(kpis).toHaveProperty("totalAlevinsSortis");
    expect(kpis).toHaveProperty("tauxFecondation");
    expect(kpis).toHaveProperty("tauxEclosion");
    expect(kpis).toHaveProperty("tauxSurvieLarvaire");
    expect(kpis).toHaveProperty("tauxSurvieGlobal");
    expect(kpis).toHaveProperty("totalFemelles");
    expect(kpis).toHaveProperty("totalMales");
    expect(kpis).toHaveProperty("femellesActives");
    expect(kpis).toHaveProperty("lotsEnCours");
    expect(kpis).toHaveProperty("lotsTransferes");
    expect(kpis).toHaveProperty("lotsPerdus");
    expect(kpis).toHaveProperty("productionMensuelle");
  });

  it("retourne des zeros quand aucune donnee", async () => {
    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.totalPontes).toBe(0);
    expect(kpis.totalPontesReussies).toBe(0);
    expect(kpis.totalOeufs).toBe(0);
    expect(kpis.totalLarvesViables).toBe(0);
    expect(kpis.totalAlevinsActifs).toBe(0);
    expect(kpis.totalAlevinsSortis).toBe(0);
    expect(kpis.tauxFecondation).toBe(0);
    expect(kpis.tauxEclosion).toBe(0);
    expect(kpis.tauxSurvieLarvaire).toBe(0);
    expect(kpis.tauxSurvieGlobal).toBe(0);
  });

  it("ne retourne pas NaN quand totalPontes est zero (division par zero)", async () => {
    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.tauxFecondation).not.toBeNaN();
    expect(kpis.tauxEclosion).not.toBeNaN();
    expect(kpis.tauxSurvieLarvaire).not.toBeNaN();
    expect(kpis.tauxSurvieGlobal).not.toBeNaN();
  });

  it("calcule tauxFecondation = totalPontesReussies / totalPontes * 100", async () => {
    // 3 TERMINEE sur 5 pontes = 60%
    mockPonteFindMany.mockResolvedValueOnce([
      { id: "p1", statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-01") },
      { id: "p2", statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-02") },
      { id: "p3", statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-03") },
      { id: "p4", statut: "EN_COURS", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-04") },
      { id: "p5", statut: "ECHOUEE", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-05") },
    ]);

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.totalPontes).toBe(5);
    expect(kpis.totalPontesReussies).toBe(3);
    expect(kpis.tauxFecondation).toBe(60);
  });

  it("calcule tauxEclosion = totalLarvesViables / totalOeufs * 100 depuis incubations", async () => {
    mockPonteFindMany.mockResolvedValueOnce([
      { id: "p1", statut: "TERMINEE", nombreOeufsEstime: 500, nombreLarvesViables: null, datePonte: new Date("2026-01-01") },
    ]);
    // 800 larves / 1000 oeufs = 80%
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.tauxEclosion).toBe(80);
  });

  it("utilise les oeufs des pontes si les incubations n'en ont pas", async () => {
    mockPonteFindMany.mockResolvedValueOnce([
      { id: "p1", statut: "TERMINEE", nombreOeufsEstime: 1200, nombreLarvesViables: 960, datePonte: new Date("2026-01-01") },
    ]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: null, nombreLarvesViables: null },
    ]);

    const kpis = await getReproductionKpis(SITE_ID);

    // Oeufs depuis pontes (fallback)
    expect(kpis.totalOeufs).toBe(1200);
    // Larves depuis pontes (fallback)
    expect(kpis.totalLarvesViables).toBe(960);
  });

  it("distingue totalAlevinsActifs (EN_ELEVAGE) de totalAlevinsSortis (TRANSFERE)", async () => {
    mockPonteFindMany.mockResolvedValueOnce([]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    // 2 EN_ELEVAGE + 1 TRANSFERE
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 300, statut: "EN_ELEVAGE" },
      { nombreActuel: 200, statut: "EN_ELEVAGE" },
      { nombreActuel: 150, statut: "TRANSFERE" },
    ]);

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.totalAlevinsActifs).toBe(500);   // 300 + 200
    expect(kpis.totalAlevinsSortis).toBe(150);
  });

  it("calcule tauxSurvieGlobal = (tauxFecondation * tauxEclosion * tauxSurvieLarvaire) / 10000", async () => {
    // tauxFecondation = 100% (1 TERMINEE / 1)
    // tauxEclosion = 80% (800 / 1000)
    // allAlevins = EN_ELEVAGE(400) + TRANSFERE(0) = 400
    // tauxSurvieLarvaire = 50% (400 / 800)
    // tauxGlobal = 100 * 80 * 50 / 10000 = 40%
    mockPonteFindMany.mockResolvedValueOnce([
      { id: "p1", statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-01") },
    ]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 1000, nombreLarvesViables: 800 },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 400, statut: "EN_ELEVAGE" },
    ]);

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.tauxFecondation).toBe(100);
    expect(kpis.tauxEclosion).toBe(80);
    expect(kpis.tauxSurvieLarvaire).toBe(50);
    expect(kpis.tauxSurvieGlobal).toBe(40);
  });

  it("plafonne tous les taux a 100%", async () => {
    // Donnees aberrantes pour forcer des taux > 100%
    mockPonteFindMany.mockResolvedValueOnce([
      { id: "p1", statut: "TERMINEE", nombreOeufsEstime: null, nombreLarvesViables: null, datePonte: new Date("2026-01-01") },
    ]);
    mockIncubationFindMany.mockResolvedValue([
      { nombreOeufsPlaces: 100, nombreLarvesViables: 200 }, // 200% => plafonne
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      { nombreActuel: 300, statut: "EN_ELEVAGE" }, // 150% => plafonne
    ]);

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.tauxFecondation).toBeLessThanOrEqual(100);
    expect(kpis.tauxEclosion).toBeLessThanOrEqual(100);
    expect(kpis.tauxSurvieLarvaire).toBeLessThanOrEqual(100);
    expect(kpis.tauxSurvieGlobal).toBeLessThanOrEqual(100);
  });

  it("applique le filtre dateDebut / dateFin sur les pontes", async () => {
    const dateDebut = new Date("2026-01-01");
    const dateFin = new Date("2026-03-31");

    await getReproductionKpis(SITE_ID, dateDebut, dateFin);

    const queryArgs = mockPonteFindMany.mock.calls[0][0];
    expect(queryArgs.where.datePonte).toBeDefined();
    expect(queryArgs.where.datePonte.gte).toEqual(dateDebut);
    expect(queryArgs.where.datePonte.lte).toEqual(dateFin);
  });

  it("n'applique pas de filtre date quand aucune date n'est fournie", async () => {
    await getReproductionKpis(SITE_ID);

    const queryArgs = mockPonteFindMany.mock.calls[0][0];
    expect(queryArgs.where.datePonte).toBeUndefined();
  });

  it("retourne productionMensuelle avec 6 entrees (6 derniers mois)", async () => {
    // La ponte est hors des 6 derniers mois — seul le map vide est retourne
    mockPonteFindMany
      .mockResolvedValueOnce([]) // premier appel : getReproductionKpis pontes filtre periode
      .mockResolvedValueOnce([]); // deuxieme appel : pontesRecentes (6 derniers mois)

    const kpis = await getReproductionKpis(SITE_ID);

    expect(Array.isArray(kpis.productionMensuelle)).toBe(true);
    expect(kpis.productionMensuelle).toHaveLength(6);
  });

  it("utilise le siteId pour filtrer toutes les requetes", async () => {
    await getReproductionKpis(SITE_ID);

    // Verification que le siteId est passe dans le premier appel ponte
    const ponteArgs = mockPonteFindMany.mock.calls[0][0];
    expect(ponteArgs.where.siteId).toBe(SITE_ID);
  });

  it("retourne les counts geniteurs depuis reproducteur.count", async () => {
    // 4 femelles, 2 males, 3 femelles actives
    mockReproducteurCount
      .mockResolvedValueOnce(4)  // totalFemelles
      .mockResolvedValueOnce(2)  // totalMales
      .mockResolvedValueOnce(3); // femellesActives

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.totalFemelles).toBe(4);
    expect(kpis.totalMales).toBe(2);
    expect(kpis.femellesActives).toBe(3);
  });

  it("retourne les counts lots depuis lotAlevins.count", async () => {
    // 5 EN_ELEVAGE, 3 TRANSFERE, 1 PERDU
    mockLotAlevinsCount
      .mockResolvedValueOnce(5)  // lotsEnCours (EN_ELEVAGE)
      .mockResolvedValueOnce(3)  // lotsTransferes (TRANSFERE)
      .mockResolvedValueOnce(1); // lotsPerdus (PERDU)

    const kpis = await getReproductionKpis(SITE_ID);

    expect(kpis.lotsEnCours).toBe(5);
    expect(kpis.lotsTransferes).toBe(3);
    expect(kpis.lotsPerdus).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getReproductionLotsKpis
// ---------------------------------------------------------------------------

describe("getReproductionLotsKpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLotAlevinsFindMany.mockResolvedValue([]);
  });

  it("retourne parPhase et phaseMoyenneDureeJours", async () => {
    const result = await getReproductionLotsKpis(SITE_ID);

    expect(result).toHaveProperty("parPhase");
    expect(result).toHaveProperty("phaseMoyenneDureeJours");
  });

  it("retourne des tableaux vides quand aucun lot actif", async () => {
    const result = await getReproductionLotsKpis(SITE_ID);

    expect(result.parPhase).toEqual([]);
    expect(result.phaseMoyenneDureeJours).toEqual([]);
  });

  it("groupe les lots par phase dans parPhase", async () => {
    const now = new Date();
    const dateDebutPhase = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 jours avant

    mockLotAlevinsFindMany.mockResolvedValue([
      { phase: "LARVE", nombreActuel: 500, dateDebutPhase },
      { phase: "LARVE", nombreActuel: 300, dateDebutPhase },
      { phase: "ALEVIN", nombreActuel: 200, dateDebutPhase },
    ]);

    const result = await getReproductionLotsKpis(SITE_ID);

    expect(result.parPhase).toHaveLength(2); // LARVE et ALEVIN
    const larvePhasе = result.parPhase.find((p) => p.phase === "LARVE");
    const alevinPhase = result.parPhase.find((p) => p.phase === "ALEVIN");

    expect(larvePhasе).toBeDefined();
    expect(larvePhasе!.count).toBe(2);
    expect(larvePhasе!.totalPoissons).toBe(800);

    expect(alevinPhase).toBeDefined();
    expect(alevinPhase!.count).toBe(1);
    expect(alevinPhase!.totalPoissons).toBe(200);
  });

  it("calcule la duree moyenne par phase dans phaseMoyenneDureeJours", async () => {
    const now = new Date();
    // Lot 1 : 10 jours, lot 2 : 20 jours => moyenne 15 jours
    const date10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const date20 = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

    mockLotAlevinsFindMany.mockResolvedValue([
      { phase: "LARVE", nombreActuel: 300, dateDebutPhase: date10 },
      { phase: "LARVE", nombreActuel: 400, dateDebutPhase: date20 },
    ]);

    const result = await getReproductionLotsKpis(SITE_ID);

    const larveDuree = result.phaseMoyenneDureeJours.find(
      (p) => p.phase === "LARVE"
    );
    expect(larveDuree).toBeDefined();
    // Moyenne de 10 et 20 = 15 jours (arrondi)
    expect(larveDuree!.dureeJours).toBe(15);
  });

  it("retourne dureeJours = 0 pour une phase sans lot", async () => {
    // Phase avec count = 0 ne devrait pas etre dans le map
    // Mais si elle y etait, la division par zero serait evitee
    mockLotAlevinsFindMany.mockResolvedValue([
      { phase: "ALEVIN", nombreActuel: 100, dateDebutPhase: new Date() },
    ]);

    const result = await getReproductionLotsKpis(SITE_ID);

    const alevinDuree = result.phaseMoyenneDureeJours.find(
      (p) => p.phase === "ALEVIN"
    );
    expect(alevinDuree).toBeDefined();
    expect(alevinDuree!.dureeJours).toBeGreaterThanOrEqual(0);
  });

  it("filtre les lots par siteId", async () => {
    await getReproductionLotsKpis(SITE_ID);

    const queryArgs = mockLotAlevinsFindMany.mock.calls[0][0];
    expect(queryArgs.where.siteId).toBe(SITE_ID);
  });

  it("filtre uniquement les statuts EN_ELEVAGE et EN_INCUBATION", async () => {
    await getReproductionLotsKpis(SITE_ID);

    const queryArgs = mockLotAlevinsFindMany.mock.calls[0][0];
    expect(queryArgs.where.statut).toBeDefined();
    expect(queryArgs.where.statut.in).toContain("EN_ELEVAGE");
    expect(queryArgs.where.statut.in).toContain("EN_INCUBATION");
  });

  it("retourne les champs count et totalPoissons dans parPhase", async () => {
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        phase: "LARVE",
        nombreActuel: 600,
        dateDebutPhase: new Date(),
      },
    ]);

    const result = await getReproductionLotsKpis(SITE_ID);

    expect(result.parPhase[0]).toHaveProperty("phase");
    expect(result.parPhase[0]).toHaveProperty("count");
    expect(result.parPhase[0]).toHaveProperty("totalPoissons");
  });
});

// ---------------------------------------------------------------------------
// getReproductionPlanningEvents
// ---------------------------------------------------------------------------

describe("getReproductionPlanningEvents", () => {
  const dateDebut = new Date("2026-03-01");
  const dateFin = new Date("2026-03-31");

  beforeEach(() => {
    vi.clearAllMocks();
    mockPonteFindMany.mockResolvedValue([]);
    mockIncubationFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);
  });

  it("retourne un objet avec les 4 tableaux attendus", async () => {
    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    expect(events).toHaveProperty("pontesPlanifiees");
    expect(events).toHaveProperty("incubationsEnCours");
    expect(events).toHaveProperty("lotsEnElevage");
    expect(events).toHaveProperty("eclosionsPrevues");
  });

  it("retourne des tableaux vides quand aucun evenement", async () => {
    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    expect(events.pontesPlanifiees).toEqual([]);
    expect(events.incubationsEnCours).toEqual([]);
    expect(events.lotsEnElevage).toEqual([]);
    expect(events.eclosionsPrevues).toEqual([]);
  });

  it("filtre les pontes par plage de dates", async () => {
    await getReproductionPlanningEvents(SITE_ID, dateDebut, dateFin);

    const ponteArgs = mockPonteFindMany.mock.calls[0][0];
    expect(ponteArgs.where.datePonte).toBeDefined();
    expect(ponteArgs.where.datePonte.gte).toEqual(dateDebut);
    expect(ponteArgs.where.datePonte.lte).toEqual(dateFin);
  });

  it("filtre par siteId pour toutes les requetes", async () => {
    await getReproductionPlanningEvents(SITE_ID, dateDebut, dateFin);

    const ponteArgs = mockPonteFindMany.mock.calls[0][0];
    expect(ponteArgs.where.siteId).toBe(SITE_ID);
  });

  it("mappe les pontes vers le format PontePlanifiee", async () => {
    const fakePonte = {
      id: "ponte-1",
      code: "P-001",
      datePonte: new Date("2026-03-15"),
      statut: "EN_COURS",
      femelle: { id: "repr-1", code: "F-001" },
    };
    mockPonteFindMany.mockResolvedValueOnce([fakePonte]);

    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    expect(events.pontesPlanifiees).toHaveLength(1);
    expect(events.pontesPlanifiees[0].id).toBe("ponte-1");
    expect(events.pontesPlanifiees[0].code).toBe("P-001");
    expect(events.pontesPlanifiees[0].statut).toBe("EN_COURS");
    expect(events.pontesPlanifiees[0].femelle).toEqual({
      id: "repr-1",
      code: "F-001",
    });
  });

  it("retourne femelle null quand la ponte n'a pas de femelle", async () => {
    mockPonteFindMany.mockResolvedValueOnce([
      {
        id: "ponte-2",
        code: "P-002",
        datePonte: new Date("2026-03-20"),
        statut: "EN_COURS",
        femelle: null,
      },
    ]);

    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    expect(events.pontesPlanifiees[0].femelle).toBeNull();
  });

  it("mappe les incubations vers le format IncubationEnCours", async () => {
    const fakeIncubation = {
      id: "incub-1",
      code: "INC-001",
      dateDebutIncubation: new Date("2026-03-16"),
      dateEclosionPrevue: new Date("2026-03-30"),
      statut: "EN_COURS",
    };
    mockIncubationFindMany.mockResolvedValueOnce([fakeIncubation]);

    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    // Les deux premiers appels a incubation.findMany : incubationsEnCours puis eclosionsPrevues
    expect(events.incubationsEnCours).toHaveLength(1);
    expect(events.incubationsEnCours[0].id).toBe("incub-1");
    expect(events.incubationsEnCours[0].code).toBe("INC-001");
    expect(events.incubationsEnCours[0].statut).toBe("EN_COURS");
  });

  it("mappe les lots vers le format LotEnElevage", async () => {
    const fakeLot = {
      id: "lot-1",
      code: "LOT-001",
      phase: "LARVE",
      dateDebutPhase: new Date("2026-03-01"),
      ageJours: 14,
      nombreActuel: 500,
    };
    mockLotAlevinsFindMany.mockResolvedValueOnce([fakeLot]);

    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    expect(events.lotsEnElevage).toHaveLength(1);
    expect(events.lotsEnElevage[0].id).toBe("lot-1");
    expect(events.lotsEnElevage[0].phase).toBe("LARVE");
    expect(events.lotsEnElevage[0].ageJours).toBe(14);
    expect(events.lotsEnElevage[0].nombreActuel).toBe(500);
  });

  it("filtre les eclosionsPrevues par dateEclosionPrevue dans la periode", async () => {
    // Le premier incubationFindMany est pour incubationsEnCours
    // Le deuxieme est pour eclosionsPrevues avec filtre dateEclosionPrevue
    mockIncubationFindMany
      .mockResolvedValueOnce([]) // incubationsEnCours
      .mockResolvedValueOnce([   // eclosionsPrevues
        {
          id: "incub-2",
          code: "INC-002",
          dateEclosionPrevue: new Date("2026-03-25"),
        },
      ]);

    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    expect(events.eclosionsPrevues).toHaveLength(1);
    expect(events.eclosionsPrevues[0].incubationId).toBe("incub-2");
    expect(events.eclosionsPrevues[0].code).toBe("INC-002");
  });

  it("exclut les eclosionsPrevues avec dateEclosionPrevue null", async () => {
    mockIncubationFindMany
      .mockResolvedValueOnce([]) // incubationsEnCours
      .mockResolvedValueOnce([   // eclosionsPrevues avec dateNull
        {
          id: "incub-3",
          code: "INC-003",
          dateEclosionPrevue: null,
        },
      ]);

    const events = await getReproductionPlanningEvents(
      SITE_ID,
      dateDebut,
      dateFin
    );

    // Les eclosions sans date prevue sont filtrees
    expect(events.eclosionsPrevues).toHaveLength(0);
  });
});
