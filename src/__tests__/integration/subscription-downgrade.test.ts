/**
 * Tests d'intégration — Downgrade d'abonnement
 *
 * Story 53.2 — Sprint 53
 *
 * Couvre :
 * - PROFESSIONNEL → ELEVEUR avec sélection de ressources valide → 200 downgrade programmé
 * - Trop de ressources sélectionnées par rapport aux limites du nouveau plan → 400
 * - Downgrade depuis statut non-ACTIF → 400
 * - Annuler un downgrade programmé → DELETE 200
 * - Annuler quand pas de downgrade programmé → DELETE 400
 *
 * R2 : enums importés depuis @/types
 * R4 : downgrade dans $transaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  StatutAbonnement,
  TypePlan,
  PeriodeFacturation,
  Permission,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAbonnementById = vi.fn();
const mockLogAbonnementAudit = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementById: (...args: unknown[]) => mockGetAbonnementById(...args),
  logAbonnementAudit: (...args: unknown[]) => mockLogAbonnementAudit(...args),
  getAbonnementActif: vi.fn(),
  getAbonnementActifPourSite: vi.fn(),
}));

const mockGetPlanAbonnementById = vi.fn();

vi.mock("@/lib/queries/plans-abonnements", () => ({
  getPlanAbonnementById: (...args: unknown[]) => mockGetPlanAbonnementById(...args),
}));

const mockRequirePermission = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  ForbiddenError: class ForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

vi.mock("@/lib/abonnements/invalidate-caches", () => ({
  invalidateSubscriptionCaches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

const mockPrismaTransaction = vi.fn();
const mockAbonnementUpdate = vi.fn();
const mockAbonnementFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    abonnement: {
      update: (...args: unknown[]) => mockAbonnementUpdate(...args),
      findFirst: (...args: unknown[]) => mockAbonnementFindFirst(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import { POST, DELETE } from "@/app/api/abonnements/[id]/downgrade/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@farm.cm",
  phone: null,
  name: "Professionnel",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Gérant",
  permissions: [Permission.ABONNEMENTS_GERER],
};

function makeRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/abonnements/${id}/downgrade`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost/api/abonnements/${id}/downgrade`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

function makeAbonnementProfessionnel(overrides: { id: string; statut?: StatutAbonnement; downgradeVersId?: string | null }) {
  const now = new Date();
  const dateFin = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  return {
    id: overrides.id,
    userId: "user-1",
    statut: overrides.statut ?? StatutAbonnement.ACTIF,
    planId: "plan-professionnel",
    plan: { id: "plan-professionnel", typePlan: TypePlan.PROFESSIONNEL, nom: "Professionnel", isActif: true },
    prixPaye: 8000,
    periode: PeriodeFacturation.MENSUEL,
    dateDebut: now,
    dateFin,
    dateProchainRenouvellement: dateFin,
    downgradeVersId: overrides.downgradeVersId ?? null,
    downgradePeriode: null,
    downgradeRessourcesAGarder: null,
    paiements: [],
    remisesAppliquees: [],
  };
}

function makePlan(id: string, typePlan: TypePlan) {
  return {
    id,
    typePlan,
    nom: typePlan,
    isActif: true,
    dureeEssaiJours: null,
  };
}

/**
 * Configure la $transaction pour le downgrade.
 * Simule tx.abonnement.update retournant l'abonnement mis à jour.
 */
function setupTransactionDowngrade(abonnementMisAJour: Record<string, unknown>) {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      abonnement: {
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        abonnement: {
          update: () => Promise.resolve(abonnementMisAJour),
        },
      };
      return fn(txMock);
    }
  );
}

// ---------------------------------------------------------------------------
// Tests : PROFESSIONNEL → ELEVEUR avec sélection valide
// ---------------------------------------------------------------------------

describe("Downgrade PROFESSIONNEL → ELEVEUR (sélection ressources valide)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("downgrade avec 1 site, 5 bacs, 2 vagues → 200 (dans les limites ELEVEUR)", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-down" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-eleveur", TypePlan.ELEVEUR));

    setupTransactionDowngrade({
      ...abonnement,
      downgradeVersId: "plan-eleveur",
      downgradePeriode: PeriodeFacturation.MENSUEL,
    });

    // ELEVEUR : 10 bacs, 3 vagues, 1 site
    const req = makeRequest("abo-pro-down", {
      nouveauPlanId: "plan-eleveur",
      ressourcesAGarder: {
        sites: ["site-1"],         // 1 site ≤ 1
        bacs: { "site-1": ["bac-1", "bac-2", "bac-3", "bac-4", "bac-5"] }, // 5 ≤ 10
        vagues: { "site-1": ["vague-1", "vague-2"] }, // 2 ≤ 3
      },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-pro-down" }) });

    expect(res.status).toBe(200);
    const data = await res.json() as { downgrade: { nouveauPlanId: string }; message: string };
    expect(data.downgrade.nouveauPlanId).toBe("plan-eleveur");
    expect(data.message).toContain("Downgrade programmé");
  });

  it("downgrade sans ressourcesAGarder → utilise les valeurs vides par défaut → 200", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-empty" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-eleveur", TypePlan.ELEVEUR));

    setupTransactionDowngrade({
      ...abonnement,
      downgradeVersId: "plan-eleveur",
    });

    const req = makeRequest("abo-pro-empty", {
      nouveauPlanId: "plan-eleveur",
      // ressourcesAGarder absent → défaut { sites: [], bacs: {}, vagues: {} }
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-pro-empty" }) });

    expect(res.status).toBe(200);
  });

  it("trop de sites sélectionnés pour le nouveau plan → 400", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-too-many-sites" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    // ELEVEUR : limite 1 site
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-eleveur", TypePlan.ELEVEUR));

    const req = makeRequest("abo-pro-too-many-sites", {
      nouveauPlanId: "plan-eleveur",
      ressourcesAGarder: {
        sites: ["site-1", "site-2"], // 2 sites > limite 1
        bacs: {},
        vagues: {},
      },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-pro-too-many-sites" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("site");
  });

  it("trop de bacs sélectionnés pour ELEVEUR (limite 10) → 400", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-too-many-bacs" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-eleveur", TypePlan.ELEVEUR));

    // 11 bacs > limite ELEVEUR de 10
    const bacs = Array.from({ length: 11 }, (_, i) => `bac-${i + 1}`);
    const req = makeRequest("abo-pro-too-many-bacs", {
      nouveauPlanId: "plan-eleveur",
      ressourcesAGarder: {
        sites: ["site-1"],
        bacs: { "site-1": bacs },
        vagues: {},
      },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-pro-too-many-bacs" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("bac");
    expect(data.message).toContain("10");
  });

  it("trop de vagues sélectionnées pour ELEVEUR (limite 3) → 400", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-too-many-vagues" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-eleveur", TypePlan.ELEVEUR));

    // 4 vagues > limite ELEVEUR de 3
    const req = makeRequest("abo-pro-too-many-vagues", {
      nouveauPlanId: "plan-eleveur",
      ressourcesAGarder: {
        sites: ["site-1"],
        bacs: {},
        vagues: { "site-1": ["vague-1", "vague-2", "vague-3", "vague-4"] },
      },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-pro-too-many-vagues" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("vague");
    expect(data.message).toContain("3");
  });

  it("downgrade depuis statut EN_GRACE → 400 (seuls les ACTIF peuvent downgrader)", async () => {
    const abonnement = makeAbonnementProfessionnel({
      id: "abo-grace-down",
      statut: StatutAbonnement.EN_GRACE,
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeRequest("abo-grace-down", {
      nouveauPlanId: "plan-eleveur",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-grace-down" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("ACTIF");
  });

  it("downgrade vers plan identique → 400", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-identical" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    // Même plan retourné par getPlanAbonnementById
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-professionnel", TypePlan.PROFESSIONNEL));

    const req = makeRequest("abo-pro-identical", {
      nouveauPlanId: "plan-professionnel", // même plan
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-pro-identical" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("identique");
  });

  it("logAbonnementAudit appelé avec action DOWNGRADE_PROGRAMME", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-pro-audit" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlan("plan-eleveur", TypePlan.ELEVEUR));

    setupTransactionDowngrade({
      ...abonnement,
      downgradeVersId: "plan-eleveur",
    });

    const req = makeRequest("abo-pro-audit", {
      nouveauPlanId: "plan-eleveur",
    });

    await POST(req, { params: Promise.resolve({ id: "abo-pro-audit" }) });

    await Promise.resolve(); // laisser les micro-tâches se terminer
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("DOWNGRADE_PROGRAMME");
  });
});

// ---------------------------------------------------------------------------
// Tests : Annulation du downgrade
// ---------------------------------------------------------------------------

describe("Annulation du downgrade programmé (DELETE)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("annuler un downgrade programmé → 200", async () => {
    const abonnement = makeAbonnementProfessionnel({
      id: "abo-annuler-down",
      downgradeVersId: "plan-eleveur",
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    // La $transaction annule le downgrade
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: {
        abonnement: {
          update: (args: unknown) => Promise<unknown>;
        };
      }) => Promise<unknown>) => {
        return fn({
          abonnement: {
            update: () => Promise.resolve({ ...abonnement, downgradeVersId: null }),
          },
        });
      }
    );

    const req = makeDeleteRequest("abo-annuler-down");
    const res = await DELETE(req, { params: Promise.resolve({ id: "abo-annuler-down" }) });

    expect(res.status).toBe(200);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("annulé");
  });

  it("pas de downgrade programmé → DELETE 400", async () => {
    const abonnement = makeAbonnementProfessionnel({
      id: "abo-no-down",
      downgradeVersId: null, // pas de downgrade programmé
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeDeleteRequest("abo-no-down");
    const res = await DELETE(req, { params: Promise.resolve({ id: "abo-no-down" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("downgrade");
  });

  it("abonnement introuvable → DELETE 404", async () => {
    mockGetAbonnementById.mockResolvedValue(null);

    const req = makeDeleteRequest("abo-inexistant");
    const res = await DELETE(req, { params: Promise.resolve({ id: "abo-inexistant" }) });

    expect(res.status).toBe(404);
  });

  it("annulation appartenant à un autre utilisateur → DELETE 403", async () => {
    const abonnement = makeAbonnementProfessionnel({ id: "abo-autre-down" });
    const abonnementAutre = { ...abonnement, userId: "user-autre" };
    mockGetAbonnementById.mockResolvedValue(abonnementAutre);

    const req = makeDeleteRequest("abo-autre-down");
    const res = await DELETE(req, { params: Promise.resolve({ id: "abo-autre-down" }) });

    expect(res.status).toBe(403);
  });

  it("logAbonnementAudit appelé avec action DOWNGRADE_ANNULE", async () => {
    const abonnement = makeAbonnementProfessionnel({
      id: "abo-audit-annule",
      downgradeVersId: "plan-eleveur",
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: {
        abonnement: { update: () => Promise<unknown> };
      }) => Promise<unknown>) => {
        return fn({ abonnement: { update: () => Promise.resolve({}) } });
      }
    );

    const req = makeDeleteRequest("abo-audit-annule");
    await DELETE(req, { params: Promise.resolve({ id: "abo-audit-annule" }) });

    await Promise.resolve();
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("DOWNGRADE_ANNULE");
  });
});
