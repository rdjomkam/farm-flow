/**
 * Tests d'intégration — Essai gratuit (Trial)
 *
 * Story 53.2 — Sprint 53
 *
 * Couvre :
 * - Création d'essai : succès, plan sans essai (400), essai déjà utilisé (409)
 * - Conversion essai → abonnement payant : succès, paiement initié
 * - Conversion échoue si essai non-ACTIF (400)
 * - Conversion échoue si c'est pas un essai (400)
 *
 * R2 : enums importés depuis @/types
 * R4 : check + création atomiques via $transaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  StatutAbonnement,
  TypePlan,
  PeriodeFacturation,
  FournisseurPaiement,
  Permission,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogAbonnementAudit = vi.fn();
const mockGetAbonnementById = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  logAbonnementAudit: (...args: unknown[]) => mockLogAbonnementAudit(...args),
  getAbonnementById: (...args: unknown[]) => mockGetAbonnementById(...args),
  getAbonnementActif: vi.fn(),
  getAbonnementActifPourSite: vi.fn(),
}));

const mockGetPlanAbonnementById = vi.fn();

vi.mock("@/lib/queries/plans-abonnements", () => ({
  getPlanAbonnementById: (...args: unknown[]) => mockGetPlanAbonnementById(...args),
}));

const mockInitierPaiement = vi.fn();

vi.mock("@/lib/services/billing", () => ({
  initierPaiement: (...args: unknown[]) => mockInitierPaiement(...args),
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
const mockAbonnementCreate = vi.fn();
const mockAbonnementUpdate = vi.fn();
const mockEssaiUtiliseFindUnique = vi.fn();
const mockEssaiUtiliseCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    abonnement: {
      create: (...args: unknown[]) => mockAbonnementCreate(...args),
      update: (...args: unknown[]) => mockAbonnementUpdate(...args),
    },
    essaiUtilise: {
      findUnique: (...args: unknown[]) => mockEssaiUtiliseFindUnique(...args),
      create: (...args: unknown[]) => mockEssaiUtiliseCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import { POST as POSTEssai } from "@/app/api/abonnements/essai/route";
import { POST as POSTConvertir } from "@/app/api/abonnements/[id]/convertir-essai/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@farm.cm",
  phone: null,
  name: "Testeur",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Gérant",
  permissions: [Permission.ABONNEMENTS_GERER],
};

function makeEssaiRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/abonnements/essai", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeConvertirRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/abonnements/${id}/convertir-essai`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makePlanWithEssai(typePlan: TypePlan, dureeEssaiJours: number | null = 14) {
  return {
    id: `plan-${typePlan.toLowerCase()}`,
    typePlan,
    nom: typePlan,
    isActif: true,
    dureeEssaiJours,
  };
}

function makeAbonnementEssai(overrides: {
  id: string;
  statut?: StatutAbonnement;
  isEssai?: boolean;
  planId?: string;
  userId?: string;
}) {
  const now = new Date();
  const dateFin = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  return {
    id: overrides.id,
    userId: overrides.userId ?? "user-1",
    statut: overrides.statut ?? StatutAbonnement.ACTIF,
    isEssai: overrides.isEssai !== undefined ? overrides.isEssai : true,
    planId: overrides.planId ?? "plan-eleveur",
    plan: { id: "plan-eleveur", typePlan: TypePlan.ELEVEUR, nom: "Eleveur", isActif: true },
    prixPaye: 0,
    periode: PeriodeFacturation.MENSUEL,
    dateDebut: now,
    dateFin,
    dateProchainRenouvellement: dateFin,
    paiements: [],
    remisesAppliquees: [],
  };
}

/**
 * Configure la $transaction pour créer un essai avec succès.
 */
function setupTransactionEssaiSucces(nouvelAbonnement: Record<string, unknown>) {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      essaiUtilise: {
        findUnique: (args: unknown) => Promise<null>;
        create: (args: unknown) => Promise<unknown>;
      };
      abonnement: {
        create: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        essaiUtilise: {
          findUnique: () => Promise.resolve(null), // pas d'essai existant
          create: () => Promise.resolve({ userId: "user-1", typePlan: "ELEVEUR" }),
        },
        abonnement: {
          create: () => Promise.resolve({ id: "abo-essai-new", isEssai: true, ...nouvelAbonnement }),
        },
      };
      return fn(txMock);
    }
  );
}

/**
 * Configure la $transaction pour simuler un essai déjà utilisé (409).
 */
function setupTransactionEssaiDejaUtilise() {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      essaiUtilise: {
        findUnique: (args: unknown) => Promise<{ userId: string; typePlan: string }>;
        create: (args: unknown) => Promise<unknown>;
      };
      abonnement: {
        create: (args: unknown) => Promise<unknown>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        essaiUtilise: {
          findUnique: () => Promise.resolve({ userId: "user-1", typePlan: "ELEVEUR" }),
          create: () => Promise.reject(new Error("Should not reach create")),
        },
        abonnement: {
          create: () => Promise.reject(new Error("Should not reach create")),
        },
      };
      return fn(txMock);
    }
  );
}

// ---------------------------------------------------------------------------
// Tests : Création d'essai
// ---------------------------------------------------------------------------

describe("Création d'essai gratuit (POST /api/abonnements/essai)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("essai créé avec succès → 201 avec isEssai=true", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.ELEVEUR, 14));
    setupTransactionEssaiSucces({
      statut: StatutAbonnement.ACTIF,
      prixPaye: 0,
      planId: "plan-eleveur",
    });

    const req = makeEssaiRequest({ planId: "plan-eleveur" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(201);
    const data = await res.json() as { abonnement: { isEssai: boolean }; message: string };
    expect(data.abonnement.isEssai).toBe(true);
    expect(data.message).toContain("14");
  });

  it("essai déjà utilisé pour ce plan → 409", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.ELEVEUR, 14));
    setupTransactionEssaiDejaUtilise();

    const req = makeEssaiRequest({ planId: "plan-eleveur" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(409);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("essai");
  });

  it("plan sans dureeEssaiJours (0) → 400 Ce plan ne propose pas d'essai", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.DECOUVERTE, 0));

    const req = makeEssaiRequest({ planId: "plan-decouverte" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("essai");
  });

  it("plan sans dureeEssaiJours (null) → 400", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.DECOUVERTE, null));

    const req = makeEssaiRequest({ planId: "plan-decouverte" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(400);
  });

  it("planId absent → 400", async () => {
    const req = makeEssaiRequest({});
    const res = await POSTEssai(req);

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("planId");
  });

  it("plan introuvable → 404", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(null);

    const req = makeEssaiRequest({ planId: "plan-inexistant" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(404);
  });

  it("plan inactif → 404", async () => {
    mockGetPlanAbonnementById.mockResolvedValue({
      ...makePlanWithEssai(TypePlan.ELEVEUR, 14),
      isActif: false,
    });

    const req = makeEssaiRequest({ planId: "plan-inactif" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(404);
  });

  it("essai ELEVEUR déjà utilisé, essai PROFESSIONNEL non utilisé → essai PROFESSIONNEL autorisé", async () => {
    // Plans différents → essais distincts (un essai par plan)
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.PROFESSIONNEL, 14));

    // L'essai PROFESSIONNEL n'a pas encore été utilisé
    setupTransactionEssaiSucces({
      statut: StatutAbonnement.ACTIF,
      prixPaye: 0,
      planId: "plan-professionnel",
    });

    const req = makeEssaiRequest({ planId: "plan-professionnel" });
    const res = await POSTEssai(req);

    expect(res.status).toBe(201);
  });

  it("création d'essai → logAbonnementAudit appelé avec CREATION_ESSAI", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.ELEVEUR, 14));
    setupTransactionEssaiSucces({ statut: StatutAbonnement.ACTIF });

    const req = makeEssaiRequest({ planId: "plan-eleveur" });
    await POSTEssai(req);

    await Promise.resolve();
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("CREATION_ESSAI");
  });
});

// ---------------------------------------------------------------------------
// Tests : Conversion essai → payant
// ---------------------------------------------------------------------------

describe("Conversion essai gratuit en abonnement payant (POST .../convertir-essai)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("conversion essai ACTIF → 200, paiement initié", async () => {
    const abonnement = makeAbonnementEssai({ id: "abo-essai-convert" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.ELEVEUR, 14));

    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: {
        abonnement: {
          update: (args: unknown) => Promise<Record<string, unknown>>;
        };
      }) => Promise<unknown>) => {
        return fn({
          abonnement: {
            update: () => Promise.resolve({
              ...abonnement,
              isEssai: false,
              statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
              prixPaye: 3000,
            }),
          },
        });
      }
    );

    mockInitierPaiement.mockResolvedValue({
      paiementId: "pmt-conv-1",
      referenceExterne: "ref-conv-1",
      statut: "EN_ATTENTE",
    });

    const req = makeConvertirRequest("abo-essai-convert", {
      fournisseur: FournisseurPaiement.MTN_MOMO,
      periode: PeriodeFacturation.MENSUEL,
      phoneNumber: "+237650000001",
    });

    const res = await POSTConvertir(req, { params: Promise.resolve({ id: "abo-essai-convert" }) });

    expect(res.status).toBe(200);
    const data = await res.json() as {
      abonnement: { isEssai: boolean };
      paiement: { paiementId: string };
      message: string;
    };
    expect(data.paiement.paiementId).toBe("pmt-conv-1");
    expect(data.message).toContain("Conversion");
  });

  it("conversion d'un abonnement qui n'est PAS un essai → 400", async () => {
    const abonnement = makeAbonnementEssai({
      id: "abo-non-essai",
      isEssai: false,
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeConvertirRequest("abo-non-essai", {
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const res = await POSTConvertir(req, { params: Promise.resolve({ id: "abo-non-essai" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("essai");
  });

  it("conversion d'un essai EXPIRE → 400 (statut non-ACTIF)", async () => {
    const abonnement = makeAbonnementEssai({
      id: "abo-essai-expire",
      statut: StatutAbonnement.EXPIRE,
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeConvertirRequest("abo-essai-expire", {
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const res = await POSTConvertir(req, { params: Promise.resolve({ id: "abo-essai-expire" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("ACTIF");
  });

  it("fournisseur absent → 400", async () => {
    const abonnement = makeAbonnementEssai({ id: "abo-essai-no-fournisseur" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.ELEVEUR, 14));

    const req = makeConvertirRequest("abo-essai-no-fournisseur", {
      // fournisseur absent
      periode: PeriodeFacturation.MENSUEL,
    });

    const res = await POSTConvertir(req, { params: Promise.resolve({ id: "abo-essai-no-fournisseur" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("fournisseur");
  });

  it("essai appartenant à un autre utilisateur → 403", async () => {
    const abonnement = makeAbonnementEssai({
      id: "abo-essai-autre",
      userId: "user-autre",
    });
    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeConvertirRequest("abo-essai-autre", {
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const res = await POSTConvertir(req, { params: Promise.resolve({ id: "abo-essai-autre" }) });

    expect(res.status).toBe(403);
  });

  it("essai introuvable → 404", async () => {
    mockGetAbonnementById.mockResolvedValue(null);

    const req = makeConvertirRequest("abo-inexistant", {
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const res = await POSTConvertir(req, { params: Promise.resolve({ id: "abo-inexistant" }) });

    expect(res.status).toBe(404);
  });

  it("conversion → logAbonnementAudit appelé avec CONVERSION_ESSAI", async () => {
    const abonnement = makeAbonnementEssai({ id: "abo-audit-conv" });
    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById.mockResolvedValue(makePlanWithEssai(TypePlan.ELEVEUR, 14));

    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: {
        abonnement: { update: () => Promise<Record<string, unknown>> };
      }) => Promise<unknown>) => {
        return fn({ abonnement: { update: () => Promise.resolve({ ...abonnement, isEssai: false }) } });
      }
    );

    mockInitierPaiement.mockResolvedValue({
      paiementId: "pmt-audit-conv",
      referenceExterne: "ref-audit-conv",
      statut: "EN_ATTENTE",
    });

    const req = makeConvertirRequest("abo-audit-conv", {
      fournisseur: FournisseurPaiement.ORANGE_MONEY,
    });

    await POSTConvertir(req, { params: Promise.resolve({ id: "abo-audit-conv" }) });

    await Promise.resolve();
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("CONVERSION_ESSAI");
  });
});
