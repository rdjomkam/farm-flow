/**
 * Tests unitaires — createAbonnementFromPack (Sprint 44)
 *
 * Couvre :
 * - Pack DECOUVERTE → abonnement gratuit ACTIF (prixPaye = 0)
 * - Pack PROFESSIONNEL → abonnement avec prix correct
 * - Site avec abonnement ACTIF sur le meme plan → renouvellement (dateFin etendue)
 * - Site avec abonnement ACTIF sur un plan different → ancien ANNULE, nouveau ACTIF
 * - packId invalide → throw
 * - Pack sans plan associe → throw
 *
 * Story 44.4 — Sprint 44
 * R2 : enums importes depuis @/types
 * R4 : operation atomique dans $transaction
 * R8 : siteId obligatoire sur Abonnement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAbonnementFromPack } from "@/lib/abonnements/create-from-pack";
import {
  PeriodeFacturation,
  StatutAbonnement,
  TypePlan,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPackFindUnique = vi.fn();
const mockAbonnementFindFirst = vi.fn();
const mockAbonnementUpdate = vi.fn();
const mockAbonnementCreate = vi.fn();
const mockSiteUpdate = vi.fn();
const mockPlanFindUnique = vi.fn();

const makeTxMock = () => ({
  pack: { findUnique: mockPackFindUnique },
  abonnement: {
    findFirst: mockAbonnementFindFirst,
    update: mockAbonnementUpdate,
    create: mockAbonnementCreate,
  },
  planAbonnement: { findUnique: mockPlanFindUnique },
  site: { update: mockSiteUpdate },
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: ReturnType<typeof makeTxMock>) => unknown) =>
      fn(makeTxMock())
    ),
  },
}));

vi.mock("@/lib/abonnements/apply-plan-modules", () => ({
  applyPlanModulesTx: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAN_DECOUVERTE = {
  id: "plan-decouverte",
  typePlan: TypePlan.DECOUVERTE,
  prixMensuel: null,
  prixTrimestriel: null,
  prixAnnuel: null,
  modulesInclus: [],
};

const PLAN_PROFESSIONNEL = {
  id: "plan-pro",
  typePlan: TypePlan.PROFESSIONNEL,
  prixMensuel: 15000,
  prixTrimestriel: 40000,
  prixAnnuel: 140000,
  modulesInclus: ["GROSSISSEMENT", "VENTES"],
};

const PLAN_ELEVEUR = {
  id: "plan-eleveur",
  typePlan: TypePlan.ELEVEUR,
  prixMensuel: 5000,
  prixTrimestriel: 13000,
  prixAnnuel: 48000,
  modulesInclus: ["GROSSISSEMENT"],
};

function makePackWithPlan(plan: typeof PLAN_DECOUVERTE | typeof PLAN_PROFESSIONNEL | typeof PLAN_ELEVEUR) {
  return {
    id: `pack-${plan.typePlan.toLowerCase()}`,
    nom: `Pack ${plan.typePlan}`,
    plan,
  };
}

function makeAbonnementActif(planId: string, dateFinOffsetDays = 15) {
  const dateFin = new Date();
  dateFin.setDate(dateFin.getDate() + dateFinOffsetDays);
  return {
    id: "abo-existant",
    planId,
    statut: StatutAbonnement.ACTIF,
    dateFin,
    dateProchainRenouvellement: dateFin,
    dateFinGrace: null,
    prixPaye: 15000,
    siteId: "site-client",
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Pack DECOUVERTE → prixPaye = 0, statut ACTIF
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — pack DECOUVERTE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAbonnementFindFirst.mockResolvedValue(null);
  });

  it("cree un abonnement ACTIF avec prixPaye = 0", async () => {
    const pack = makePackWithPlan(PLAN_DECOUVERTE);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_DECOUVERTE);

    const createdAbo = {
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 0,
      planId: PLAN_DECOUVERTE.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAbonnementCreate.mockResolvedValue(createdAbo);

    const result = await createAbonnementFromPack(
      "site-client",
      pack.id,
      "user-1",
      PeriodeFacturation.MENSUEL
    );

    expect(result.statut).toBe(StatutAbonnement.ACTIF);
    expect(result.prixPaye).toBe(0);
  });

  it("appelle abonnement.create avec statut ACTIF et planId correct", async () => {
    const pack = makePackWithPlan(PLAN_DECOUVERTE);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_DECOUVERTE);

    const createdAbo = {
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 0,
      planId: PLAN_DECOUVERTE.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAbonnementCreate.mockResolvedValue(createdAbo);

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.statut).toBe(StatutAbonnement.ACTIF);
    expect(createCall.data.planId).toBe(PLAN_DECOUVERTE.id);
    expect(createCall.data.prixPaye).toBe(0);
    expect(createCall.data.siteId).toBe("site-client");
  });

  it("la dateFin est environ 1 mois apres dateDebut (MENSUEL)", async () => {
    const pack = makePackWithPlan(PLAN_DECOUVERTE);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_DECOUVERTE);

    const now = new Date();
    const expectedDateFin = new Date(now);
    expectedDateFin.setMonth(expectedDateFin.getMonth() + 1);

    const createdAbo = {
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 0,
      planId: PLAN_DECOUVERTE.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: now,
      dateFin: expectedDateFin,
      dateProchainRenouvellement: expectedDateFin,
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
    };
    mockAbonnementCreate.mockResolvedValue(createdAbo);

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const createCall = mockAbonnementCreate.mock.calls[0][0];
    // dateFin doit etre env +1 mois
    const diffMs = createCall.data.dateFin.getTime() - createCall.data.dateDebut.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(32);
  });
});

// ---------------------------------------------------------------------------
// Pack PROFESSIONNEL → prix selon periode
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — pack PROFESSIONNEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAbonnementFindFirst.mockResolvedValue(null);
  });

  it("cree abonnement MENSUEL avec prixPaye = prixMensuel du plan", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const createdAbo = {
      id: "abo-pro",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 15000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAbonnementCreate.mockResolvedValue(createdAbo);

    const result = await createAbonnementFromPack(
      "site-client",
      pack.id,
      "user-1",
      PeriodeFacturation.MENSUEL
    );

    expect(result.prixPaye).toBe(15000);
    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.prixPaye).toBe(15000);
  });

  it("cree abonnement TRIMESTRIEL avec prixPaye = prixTrimestriel du plan", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const now = new Date();
    const dateFin = new Date(now);
    dateFin.setMonth(dateFin.getMonth() + 3);

    const createdAbo = {
      id: "abo-pro-trim",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 40000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.TRIMESTRIEL,
      dateDebut: now,
      dateFin,
      dateProchainRenouvellement: dateFin,
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
    };
    mockAbonnementCreate.mockResolvedValue(createdAbo);

    const result = await createAbonnementFromPack(
      "site-client",
      pack.id,
      "user-1",
      PeriodeFacturation.TRIMESTRIEL
    );

    expect(result.prixPaye).toBe(40000);
    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.prixPaye).toBe(40000);
    expect(createCall.data.periode).toBe(PeriodeFacturation.TRIMESTRIEL);
  });

  it("cree abonnement ANNUEL avec prixPaye = prixAnnuel du plan", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const now = new Date();
    const dateFin = new Date(now);
    dateFin.setFullYear(dateFin.getFullYear() + 1);

    const createdAbo = {
      id: "abo-pro-annuel",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 140000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.ANNUEL,
      dateDebut: now,
      dateFin,
      dateProchainRenouvellement: dateFin,
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
    };
    mockAbonnementCreate.mockResolvedValue(createdAbo);

    const result = await createAbonnementFromPack(
      "site-client",
      pack.id,
      "user-1",
      PeriodeFacturation.ANNUEL
    );

    expect(result.prixPaye).toBe(140000);
    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.prixPaye).toBe(140000);
    expect(createCall.data.periode).toBe(PeriodeFacturation.ANNUEL);
  });

  it("dateFin ANNUEL est environ 12 mois apres dateDebut", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const now = new Date();
    const dateFin = new Date(now);
    dateFin.setFullYear(dateFin.getFullYear() + 1);

    mockAbonnementCreate.mockResolvedValue({
      id: "abo-annuel",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 140000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.ANNUEL,
      dateDebut: now,
      dateFin,
      dateProchainRenouvellement: dateFin,
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
    });

    await createAbonnementFromPack("site-client", pack.id, "user-1", PeriodeFacturation.ANNUEL);

    const createCall = mockAbonnementCreate.mock.calls[0][0];
    const diffMs = createCall.data.dateFin.getTime() - createCall.data.dateDebut.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // 365 jours environ (±2 pour les années bissextiles)
    expect(diffDays).toBeGreaterThanOrEqual(363);
    expect(diffDays).toBeLessThanOrEqual(367);
  });
});

// ---------------------------------------------------------------------------
// Renouvellement — meme plan, abonnement ACTIF existant
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — renouvellement (meme plan)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("met a jour l'abonnement existant (update, pas create)", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const existingAbo = makeAbonnementActif(PLAN_PROFESSIONNEL.id, 15);
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    const newDateFin = new Date(existingAbo.dateFin);
    newDateFin.setMonth(newDateFin.getMonth() + 1);

    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      dateFin: newDateFin,
      dateProchainRenouvellement: newDateFin,
      dateFinGrace: null,
    });

    await createAbonnementFromPack(
      "site-client",
      pack.id,
      "user-1",
      PeriodeFacturation.MENSUEL
    );

    expect(mockAbonnementUpdate).toHaveBeenCalledOnce();
    expect(mockAbonnementCreate).not.toHaveBeenCalled();
  });

  it("la nouvelle dateFin est etendue depuis l'ancienne dateFin (si dans le futur)", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const futureDateFin = new Date();
    futureDateFin.setDate(futureDateFin.getDate() + 15); // 15 jours dans le futur

    const existingAbo = {
      ...makeAbonnementActif(PLAN_PROFESSIONNEL.id),
      dateFin: futureDateFin,
    };
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    const expectedNewDateFin = new Date(futureDateFin);
    expectedNewDateFin.setMonth(expectedNewDateFin.getMonth() + 1);

    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      dateFin: expectedNewDateFin,
      dateProchainRenouvellement: expectedNewDateFin,
    });

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const updateCall = mockAbonnementUpdate.mock.calls[0][0];
    // dateFin mise a jour doit etre apres l'ancienne dateFin
    expect(updateCall.data.dateFin > futureDateFin).toBe(true);
  });

  it("renouvelle depuis now si l'ancienne dateFin est dans le passe", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    // dateFin dans le passe
    const pastDateFin = new Date();
    pastDateFin.setDate(pastDateFin.getDate() - 5);

    const existingAbo = {
      ...makeAbonnementActif(PLAN_PROFESSIONNEL.id),
      dateFin: pastDateFin,
      statut: StatutAbonnement.ACTIF,
    };
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    const now = new Date();
    const expectedNewDateFin = new Date(now);
    expectedNewDateFin.setMonth(expectedNewDateFin.getMonth() + 1);

    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      dateFin: expectedNewDateFin,
      dateProchainRenouvellement: expectedNewDateFin,
    });

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const updateCall = mockAbonnementUpdate.mock.calls[0][0];
    // La nouvelle dateFin doit etre dans le futur
    expect(updateCall.data.dateFin > now).toBe(true);
  });

  it("preserve le statut ACTIF lors du renouvellement", async () => {
    const pack = makePackWithPlan(PLAN_ELEVEUR);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_ELEVEUR);

    const existingAbo = makeAbonnementActif(PLAN_ELEVEUR.id, 20);
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    const newDateFin = new Date(existingAbo.dateFin);
    newDateFin.setMonth(newDateFin.getMonth() + 1);

    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      statut: StatutAbonnement.ACTIF,
      dateFin: newDateFin,
      dateProchainRenouvellement: newDateFin,
    });

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const updateCall = mockAbonnementUpdate.mock.calls[0][0];
    expect(updateCall.data.statut).toBe(StatutAbonnement.ACTIF);
    expect(updateCall.data.dateFinGrace).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Changement de plan — ancien ANNULE, nouveau ACTIF
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — changement de plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("annule l'ancien abonnement avant de creer le nouveau", async () => {
    // Site a un abonnement ELEVEUR, on active un pack PROFESSIONNEL
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    // Abonnement existant sur le plan ELEVEUR (plan different)
    const existingAbo = makeAbonnementActif(PLAN_ELEVEUR.id, 10);
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    // update = annulation ancien
    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      statut: StatutAbonnement.ANNULE,
    });

    // create = nouveau abonnement
    const newAbo = {
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 15000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAbonnementCreate.mockResolvedValue(newAbo);

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    // update doit avoir ete appele pour ANNULER l'ancien
    expect(mockAbonnementUpdate).toHaveBeenCalledOnce();
    const updateCall = mockAbonnementUpdate.mock.calls[0][0];
    expect(updateCall.data.statut).toBe(StatutAbonnement.ANNULE);
    expect(updateCall.where.id).toBe(existingAbo.id);

    // create doit avoir cree le nouvel abonnement avec le bon planId
    expect(mockAbonnementCreate).toHaveBeenCalledOnce();
    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.statut).toBe(StatutAbonnement.ACTIF);
    expect(createCall.data.planId).toBe(PLAN_PROFESSIONNEL.id);
  });

  it("le nouvel abonnement a prixPaye du nouveau plan", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);

    const existingAbo = makeAbonnementActif(PLAN_DECOUVERTE.id, 5);
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      statut: StatutAbonnement.ANNULE,
    });

    const newAbo = {
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 15000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAbonnementCreate.mockResolvedValue(newAbo);

    const result = await createAbonnementFromPack("site-client", pack.id, "user-1");

    expect(result.prixPaye).toBe(15000);
    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.prixPaye).toBe(15000);
  });

  it("le nouvel abonnement DECOUVERTE a prixPaye = 0 meme si l'ancien etait payant", async () => {
    const pack = makePackWithPlan(PLAN_DECOUVERTE);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_DECOUVERTE);

    const existingAbo = makeAbonnementActif(PLAN_PROFESSIONNEL.id, 20);
    mockAbonnementFindFirst.mockResolvedValue(existingAbo);

    mockAbonnementUpdate.mockResolvedValue({
      ...existingAbo,
      statut: StatutAbonnement.ANNULE,
    });

    const newAbo = {
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 0,
      planId: PLAN_DECOUVERTE.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAbonnementCreate.mockResolvedValue(newAbo);

    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.prixPaye).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cas d'erreur — packId invalide / pack sans plan
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — erreurs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw si le pack est introuvable", async () => {
    mockPackFindUnique.mockResolvedValue(null);

    await expect(
      createAbonnementFromPack("site-client", "pack-inexistant", "user-1")
    ).rejects.toThrow(/Pack pack-inexistant introuvable/);

    expect(mockAbonnementCreate).not.toHaveBeenCalled();
    expect(mockAbonnementUpdate).not.toHaveBeenCalled();
  });

  it("throw si le pack n'a pas de plan associe", async () => {
    mockPackFindUnique.mockResolvedValue({
      id: "pack-no-plan",
      nom: "Pack sans plan",
      plan: null,
    });

    await expect(
      createAbonnementFromPack("site-client", "pack-no-plan", "user-1")
    ).rejects.toThrow(/n'a pas de plan associ/);

    expect(mockAbonnementCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Appel applyPlanModulesTx — modules du plan appliques au site
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — application des modules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle applyPlanModulesTx avec siteId et planId corrects", async () => {
    const { applyPlanModulesTx } = await import("@/lib/abonnements/apply-plan-modules");

    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);
    mockAbonnementFindFirst.mockResolvedValue(null);

    mockAbonnementCreate.mockResolvedValue({
      id: "abo-new",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 15000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-test",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createAbonnementFromPack("site-test", pack.id, "user-1");

    expect(applyPlanModulesTx).toHaveBeenCalledWith(
      expect.anything(),
      "site-test",
      PLAN_PROFESSIONNEL.id
    );
  });
});

// ---------------------------------------------------------------------------
// Periode par defaut — MENSUEL si non precise
// ---------------------------------------------------------------------------

describe("createAbonnementFromPack — periode par defaut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("utilise MENSUEL comme periode par defaut si non fournie", async () => {
    const pack = makePackWithPlan(PLAN_PROFESSIONNEL);
    mockPackFindUnique.mockResolvedValue(pack);
    mockPlanFindUnique.mockResolvedValue(PLAN_PROFESSIONNEL);
    mockAbonnementFindFirst.mockResolvedValue(null);

    mockAbonnementCreate.mockResolvedValue({
      id: "abo-default",
      statut: StatutAbonnement.ACTIF,
      prixPaye: 15000,
      planId: PLAN_PROFESSIONNEL.id,
      siteId: "site-client",
      periode: PeriodeFacturation.MENSUEL,
      dateDebut: new Date(),
      dateFin: new Date(),
      dateProchainRenouvellement: new Date(),
      dateFinGrace: null,
      remiseId: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Appel sans le 4e argument
    await createAbonnementFromPack("site-client", pack.id, "user-1");

    const createCall = mockAbonnementCreate.mock.calls[0][0];
    expect(createCall.data.periode).toBe(PeriodeFacturation.MENSUEL);
  });
});
