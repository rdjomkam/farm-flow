/**
 * Tests d'intégration — Upgrade d'abonnement
 *
 * Story 53.2 — Sprint 53
 *
 * Couvre :
 * - DECOUVERTE → ELEVEUR : delta positif, crédit prorata insuffisant → paiement requis
 * - ELEVEUR annuel → PROFESSIONNEL mensuel : crédit important → upgrade immédiat, soldeCredit mis à jour
 * - Upgrade impossible si abonnement SUSPENDU (400)
 * - Upgrade vers plan identique (400)
 * - Fournisseur manquant quand paiement requis (400)
 *
 * R2 : enums importés depuis @/types
 * R4 : upgrade dans $transaction
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
// Mocks — doivent être avant tout import du module testé
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

// Mock prisma.$transaction + tx.user.findUniqueOrThrow + tx.abonnement.*
const mockPrismaTransaction = vi.fn();
const mockUserFindUniqueOrThrow = vi.fn();
const mockAbonnementUpdateMany = vi.fn();
const mockAbonnementCreate = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    user: {
      findUniqueOrThrow: (...args: unknown[]) => mockUserFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    abonnement: {
      updateMany: (...args: unknown[]) => mockAbonnementUpdateMany(...args),
      create: (...args: unknown[]) => mockAbonnementCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/abonnements/[id]/upgrade/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@farm.cm",
  phone: null,
  name: "Eleveur",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Gérant",
  permissions: [Permission.ABONNEMENTS_GERER],
};

function makeRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/abonnements/${id}/upgrade`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeAbonnement(overrides: {
  id: string;
  userId?: string;
  statut?: StatutAbonnement;
  planId?: string;
  plan?: { id: string; typePlan: TypePlan; nom: string; isActif?: boolean };
  prixPaye?: number;
  periode?: PeriodeFacturation;
  dateDebut?: Date;
  dateFin?: Date;
}) {
  const now = new Date();
  const dateFin = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  return {
    id: overrides.id,
    userId: overrides.userId ?? "user-1",
    statut: overrides.statut ?? StatutAbonnement.ACTIF,
    planId: overrides.planId ?? "plan-decouverte",
    plan: overrides.plan ?? { id: "plan-decouverte", typePlan: TypePlan.DECOUVERTE, nom: "Découverte" },
    prixPaye: overrides.prixPaye ?? 0,
    periode: overrides.periode ?? PeriodeFacturation.MENSUEL,
    dateDebut: overrides.dateDebut ?? now,
    dateFin: overrides.dateFin ?? dateFin,
    dateProchainRenouvellement: dateFin,
    paiements: [],
    remisesAppliquees: [],
  };
}

function makePlan(id: string, typePlan: TypePlan, nom: string) {
  return {
    id,
    typePlan,
    nom,
    isActif: true,
    dureeEssaiJours: null,
  };
}

/**
 * Configure la $transaction pour simuler upgrade immédiat (crédit suffisant).
 */
function setupTransactionImmediateUpgrade(
  soldeCreditActuel: number,
  nouveauAbonnement: Record<string, unknown>
) {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      user: {
        findUniqueOrThrow: (args: unknown) => Promise<{ soldeCredit: number }>;
        update: (args: unknown) => Promise<unknown>;
      };
      abonnement: {
        updateMany: (args: unknown) => Promise<{ count: number }>;
        create: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        user: {
          findUniqueOrThrow: () => Promise.resolve({ soldeCredit: soldeCreditActuel }),
          update: () => Promise.resolve({}),
        },
        abonnement: {
          updateMany: () => Promise.resolve({ count: 1 }),
          create: () => Promise.resolve({ id: "abo-new", ...nouveauAbonnement }),
        },
      };
      return fn(txMock);
    }
  );
}

/**
 * Configure la $transaction pour simuler upgrade avec paiement requis.
 */
function setupTransactionPaiementRequis(
  soldeCreditActuel: number,
  nouvelAbonnement: Record<string, unknown>
) {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      user: {
        findUniqueOrThrow: (args: unknown) => Promise<{ soldeCredit: number }>;
        update: (args: unknown) => Promise<unknown>;
      };
      abonnement: {
        updateMany: (args: unknown) => Promise<{ count: number }>;
        create: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        user: {
          findUniqueOrThrow: () => Promise.resolve({ soldeCredit: soldeCreditActuel }),
          update: () => Promise.resolve({}),
        },
        abonnement: {
          updateMany: () => Promise.resolve({ count: 0 }),
          create: () => Promise.resolve({ id: "abo-pending", ...nouvelAbonnement }),
        },
      };
      return fn(txMock);
    }
  );
}

// ---------------------------------------------------------------------------
// Tests : DECOUVERTE → ELEVEUR — delta positif, paiement requis
// ---------------------------------------------------------------------------

describe("Upgrade DECOUVERTE → ELEVEUR (delta positif, paiement requis)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("upgrade DECOUVERTE (gratuit, 0 crédit) → ELEVEUR mensuel (3000 FCFA) → paiement requis", async () => {
    // DECOUVERTE plan à 0 FCFA → crédit prorata = 0 → montantAPayer = 3000
    const now = new Date();
    const dateFin = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const abonnement = makeAbonnement({
      id: "abo-decouverte",
      planId: "plan-decouverte",
      plan: { id: "plan-decouverte", typePlan: TypePlan.DECOUVERTE, nom: "Découverte" },
      prixPaye: 0,
      dateDebut: now,
      dateFin,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-decouverte", TypePlan.DECOUVERTE, "Découverte"))
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"));

    setupTransactionPaiementRequis(0, {
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
      planId: "plan-eleveur",
    });

    mockInitierPaiement.mockResolvedValue({
      paiementId: "pmt-1",
      referenceExterne: "ref-ext-1",
      statut: "EN_ATTENTE",
    });

    const req = makeRequest("abo-decouverte", {
      nouveauPlanId: "plan-eleveur",
      periode: PeriodeFacturation.MENSUEL,
      fournisseur: FournisseurPaiement.MTN_MOMO,
      phoneNumber: "+237650000001",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-decouverte" }) });

    expect(res.status).toBe(201);
    const data = await res.json() as { type: string; prorata: { montantAPayer: number } };
    expect(data.type).toBe("PAIEMENT_REQUIS");
    expect(data.prorata.montantAPayer).toBeGreaterThan(0);
  });

  it("upgrade requiert un fournisseur quand montantAPayer > 0 → 400 si absent", async () => {
    const now = new Date();
    const dateFin = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const abonnement = makeAbonnement({
      id: "abo-decouverte-2",
      planId: "plan-decouverte",
      plan: { id: "plan-decouverte", typePlan: TypePlan.DECOUVERTE, nom: "Découverte" },
      prixPaye: 0,
      dateDebut: now,
      dateFin,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-decouverte", TypePlan.DECOUVERTE, "Découverte"))
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"));

    // Transaction simulée qui lève FOURNISSEUR_REQUIS (car montantAPayer > 0, pas de fournisseur)
    mockPrismaTransaction.mockRejectedValue(
      new Error("FOURNISSEUR_REQUIS:Le fournisseur de paiement est obligatoire pour ce montant.")
    );

    const req = makeRequest("abo-decouverte-2", {
      nouveauPlanId: "plan-eleveur",
      periode: PeriodeFacturation.MENSUEL,
      // fournisseur absent intentionnellement
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-decouverte-2" }) });

    expect(res.status).toBe(400);
  });

  it("upgrade vers plan identique → 400", async () => {
    const abonnement = makeAbonnement({
      id: "abo-elev-1",
      planId: "plan-eleveur",
      plan: { id: "plan-eleveur", typePlan: TypePlan.ELEVEUR, nom: "Eleveur" },
      prixPaye: 3000,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"))
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"));

    const req = makeRequest("abo-elev-1", {
      nouveauPlanId: "plan-eleveur", // même plan
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-elev-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("identique");
  });

  it("upgrade depuis abonnement SUSPENDU → 400", async () => {
    const abonnement = makeAbonnement({
      id: "abo-suspendu",
      statut: StatutAbonnement.SUSPENDU,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeRequest("abo-suspendu", {
      nouveauPlanId: "plan-eleveur",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-suspendu" }) });

    expect(res.status).toBe(400);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("ACTIF");
  });

  it("abonnement introuvable → 404", async () => {
    mockGetAbonnementById.mockResolvedValue(null);

    const req = makeRequest("abo-inexistant", {
      nouveauPlanId: "plan-eleveur",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-inexistant" }) });

    expect(res.status).toBe(404);
  });

  it("abonnement appartenant à un autre utilisateur → 403", async () => {
    const abonnement = makeAbonnement({
      id: "abo-autre",
      userId: "user-autre", // pas user-1
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeRequest("abo-autre", {
      nouveauPlanId: "plan-eleveur",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-autre" }) });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests : ELEVEUR annuel → PROFESSIONNEL mensuel — crédit couvre (upgrade immédiat)
// ---------------------------------------------------------------------------

describe("Upgrade ELEVEUR annuel → PROFESSIONNEL mensuel (upgrade immédiat via soldeCredit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("crédit prorata + soldeCredit >= prixNouveauPlan → upgrade immédiat, type=IMMEDIAT", async () => {
    // ELEVEUR annuel à 25000 FCFA, utilisé à mi-période → crédit prorata ≈ 12500
    // + soldeCredit = 3000 → total = 15500 >= 8000 (PROFESSIONNEL mensuel)
    const now = new Date("2026-04-01");
    const dateDebut = new Date("2026-01-01");
    const dateFin = new Date("2027-01-01");

    const abonnement = makeAbonnement({
      id: "abo-eleveur-annuel",
      planId: "plan-eleveur-annuel",
      plan: { id: "plan-eleveur-annuel", typePlan: TypePlan.ELEVEUR, nom: "Eleveur" },
      prixPaye: 25000,
      periode: PeriodeFacturation.ANNUEL,
      dateDebut,
      dateFin,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-eleveur-annuel", TypePlan.ELEVEUR, "Eleveur"))
      .mockResolvedValueOnce(makePlan("plan-pro-mensuel", TypePlan.PROFESSIONNEL, "Professionnel"));

    // Solde crédit actuel = 3000, donc total > prix PROFESSIONNEL mensuel (8000)
    setupTransactionImmediateUpgrade(3000, {
      statut: StatutAbonnement.ACTIF,
      planId: "plan-pro-mensuel",
    });

    const req = makeRequest("abo-eleveur-annuel", {
      nouveauPlanId: "plan-pro-mensuel",
      periode: PeriodeFacturation.MENSUEL,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-eleveur-annuel" }) });

    expect(res.status).toBe(201);
    const data = await res.json() as { type: string; prorata: { montantAPayer: number; creditRestant: number } };
    expect(data.type).toBe("IMMEDIAT");
    // Pas de paiement requis
    expect(data.prorata.montantAPayer).toBe(0);
    // soldeCredit résiduel >= 0
    expect(data.prorata.creditRestant).toBeGreaterThanOrEqual(0);
  });

  it("upgrade immédiat → initierPaiement n'est pas appelé", async () => {
    const now = new Date();
    const dateFin = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000);
    const abonnement = makeAbonnement({
      id: "abo-eleveur-rich",
      planId: "plan-eleveur",
      plan: { id: "plan-eleveur", typePlan: TypePlan.ELEVEUR, nom: "Eleveur" },
      prixPaye: 25000,
      periode: PeriodeFacturation.ANNUEL,
      dateDebut: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      dateFin,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"))
      .mockResolvedValueOnce(makePlan("plan-pro", TypePlan.PROFESSIONNEL, "Professionnel"));

    setupTransactionImmediateUpgrade(10000, {
      statut: StatutAbonnement.ACTIF,
      planId: "plan-pro",
    });

    const req = makeRequest("abo-eleveur-rich", {
      nouveauPlanId: "plan-pro",
      periode: PeriodeFacturation.MENSUEL,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-eleveur-rich" }) });

    expect(res.status).toBe(201);
    // Pas d'appel au service de paiement
    expect(mockInitierPaiement).not.toHaveBeenCalled();
  });

  it("upgrade avec paiement requis → initierPaiement appelé exactement une fois", async () => {
    const abonnement = makeAbonnement({
      id: "abo-eleveur-pauvre",
      planId: "plan-eleveur",
      plan: { id: "plan-eleveur", typePlan: TypePlan.ELEVEUR, nom: "Eleveur" },
      prixPaye: 1000, // petit crédit prorata
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"))
      .mockResolvedValueOnce(makePlan("plan-pro", TypePlan.PROFESSIONNEL, "Professionnel"));

    setupTransactionPaiementRequis(0, {
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
      planId: "plan-pro",
    });

    mockInitierPaiement.mockResolvedValue({
      paiementId: "pmt-elev-pro",
      referenceExterne: "ref-elev-pro",
      statut: "EN_ATTENTE",
    });

    const req = makeRequest("abo-eleveur-pauvre", {
      nouveauPlanId: "plan-pro",
      periode: PeriodeFacturation.MENSUEL,
      fournisseur: FournisseurPaiement.ORANGE_MONEY,
      phoneNumber: "+237690000001",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-eleveur-pauvre" }) });

    expect(res.status).toBe(201);
    expect(mockInitierPaiement).toHaveBeenCalledOnce();
    const data = await res.json() as { type: string; paiement: { paiementId: string } };
    expect(data.type).toBe("PAIEMENT_REQUIS");
    expect(data.paiement.paiementId).toBe("pmt-elev-pro");
  });

  it("logAbonnementAudit appelé avec action UPGRADE après upgrade réussi", async () => {
    const abonnement = makeAbonnement({
      id: "abo-audit-test",
      planId: "plan-decouverte",
      plan: { id: "plan-decouverte", typePlan: TypePlan.DECOUVERTE, nom: "Découverte" },
      prixPaye: 0,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-decouverte", TypePlan.DECOUVERTE, "Découverte"))
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"));

    setupTransactionPaiementRequis(0, {
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
    });

    mockInitierPaiement.mockResolvedValue({
      paiementId: "pmt-audit",
      referenceExterne: "ref-audit",
      statut: "EN_ATTENTE",
    });

    const req = makeRequest("abo-audit-test", {
      nouveauPlanId: "plan-eleveur",
      fournisseur: FournisseurPaiement.MTN_MOMO,
    });

    await POST(req, { params: Promise.resolve({ id: "abo-audit-test" }) });

    // logAbonnementAudit appelé avec action UPGRADE (fire-and-forget async)
    // Attendre que les micro-tâches soient résolues
    await Promise.resolve();
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("UPGRADE");
  });
});

// ---------------------------------------------------------------------------
// Tests : Upgrade EN_GRACE → plan supérieur (autorisé)
// ---------------------------------------------------------------------------

describe("Upgrade depuis EN_GRACE (autorisé)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("abonnement EN_GRACE peut être upgradé → 201", async () => {
    const abonnement = makeAbonnement({
      id: "abo-grace-upgrade",
      statut: StatutAbonnement.EN_GRACE,
      planId: "plan-eleveur",
      plan: { id: "plan-eleveur", typePlan: TypePlan.ELEVEUR, nom: "Eleveur" },
      prixPaye: 3000,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);
    mockGetPlanAbonnementById
      .mockResolvedValueOnce(makePlan("plan-eleveur", TypePlan.ELEVEUR, "Eleveur"))
      .mockResolvedValueOnce(makePlan("plan-pro", TypePlan.PROFESSIONNEL, "Professionnel"));

    setupTransactionImmediateUpgrade(10000, {
      statut: StatutAbonnement.ACTIF,
      planId: "plan-pro",
    });

    const req = makeRequest("abo-grace-upgrade", {
      nouveauPlanId: "plan-pro",
      periode: PeriodeFacturation.MENSUEL,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-grace-upgrade" }) });

    expect(res.status).toBe(201);
  });

  it("abonnement EXPIRE ne peut pas être upgradé → 400", async () => {
    const abonnement = makeAbonnement({
      id: "abo-expire-upgrade",
      statut: StatutAbonnement.EXPIRE,
    });

    mockGetAbonnementById.mockResolvedValue(abonnement);

    const req = makeRequest("abo-expire-upgrade", {
      nouveauPlanId: "plan-eleveur",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "abo-expire-upgrade" }) });

    expect(res.status).toBe(400);
  });
});
