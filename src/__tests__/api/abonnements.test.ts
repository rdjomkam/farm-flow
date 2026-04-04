/**
 * Tests d'intégration — Routes /api/abonnements (Sprint 32)
 *
 * Couvre :
 * - POST /abonnements — crée abonnement + initie paiement (via $transaction)
 * - POST /abonnements — garde-fou 409 EN_ATTENTE_PAIEMENT existant
 * - POST /abonnements — code remise invalide → 400
 * - GET /abonnements/actif — retourne l'abonnement ACTIF
 * - POST /abonnements/[id]/renouveler — depuis EXPIRE → EN_ATTENTE_PAIEMENT
 * - POST /abonnements/[id]/renouveler — soldeCredit déduit atomiquement
 * - POST /abonnements/[id]/annuler — statut → ANNULE (R4 atomique)
 *
 * Story 32.5 — Sprint 32
 * Story 47.2 — Sprint 47 : garde-fou 409 + soldeCredit renouvellement
 * R2 : enums StatutAbonnement, Permission importés depuis @/types
 * ERR-017 : mocks mis à jour pour les nouvelles $transactions (garde-fou + soldeCredit)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/abonnements/route";
import { GET as GET_ACTIF } from "@/app/api/abonnements/actif/route";
import { POST as POST_ANNULER } from "@/app/api/abonnements/[id]/annuler/route";
import { POST as POST_RENOUVELER } from "@/app/api/abonnements/[id]/renouveler/route";
import { NextRequest } from "next/server";
import {
  Permission,
  StatutAbonnement,
  PeriodeFacturation,
  FournisseurPaiement,
  TypePlan,
  StatutPaiementAbo,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAbonnements = vi.fn();
const mockGetAbonnementById = vi.fn();
const mockGetAbonnementActif = vi.fn();
// mockCreateAbonnement kept for backward-compat (annuler route may call it indirectly via mocks)
const mockCreateAbonnement = vi.fn();
const mockLogAbonnementAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnements: (...args: unknown[]) => mockGetAbonnements(...args),
  getAbonnementById: (...args: unknown[]) => mockGetAbonnementById(...args),
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
  getAbonnementActifPourSite: (...args: unknown[]) => mockGetAbonnementActif(...args),
  createAbonnement: (...args: unknown[]) => mockCreateAbonnement(...args),
  activerAbonnement: vi.fn(),
  logAbonnementAudit: (...args: unknown[]) => mockLogAbonnementAudit(...args),
}));

const mockGetPlanAbonnementById = vi.fn();

vi.mock("@/lib/queries/plans-abonnements", () => ({
  getPlanAbonnementById: (...args: unknown[]) => mockGetPlanAbonnementById(...args),
}));

const mockVerifierRemiseApplicable = vi.fn();
const mockAppliquerRemise = vi.fn();

vi.mock("@/lib/queries/remises", () => ({
  verifierRemiseApplicable: (...args: unknown[]) => mockVerifierRemiseApplicable(...args),
  appliquerRemise: (...args: unknown[]) => mockAppliquerRemise(...args),
}));

const mockInitierPaiement = vi.fn();

vi.mock("@/lib/services/billing", () => ({
  initierPaiement: (...args: unknown[]) => mockInitierPaiement(...args),
}));

vi.mock("@/lib/services/remises-automatiques", () => ({
  verifierEtAppliquerRemiseAutomatique: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/abonnements/invalidate-caches", () => ({
  invalidateSubscriptionCaches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockRequirePermission = vi.fn();
const mockPrismaUpdateMany = vi.fn();

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

// ---------------------------------------------------------------------------
// Mock prisma avec support $transaction (Story 47.2)
//
// POST /api/abonnements : $transaction(async tx => { tx.abonnement.count, tx.abonnement.create })
// POST /api/abonnements/[id]/renouveler : $transaction(async tx => {
//   tx.user.findUniqueOrThrow, tx.user.update, tx.abonnement.create
// })
// ---------------------------------------------------------------------------
const mockTxAbonnementCount = vi.fn();
const mockTxAbonnementCreate = vi.fn();
const mockTxUserFindUniqueOrThrow = vi.fn();
const mockTxUserUpdate = vi.fn();

const mockTx = {
  abonnement: {
    count: (...args: unknown[]) => mockTxAbonnementCount(...args),
    create: (...args: unknown[]) => mockTxAbonnementCreate(...args),
  },
  user: {
    findUniqueOrThrow: (...args: unknown[]) => mockTxUserFindUniqueOrThrow(...args),
    update: (...args: unknown[]) => mockTxUserUpdate(...args),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnement: {
      updateMany: (...args: unknown[]) => mockPrismaUpdateMany(...args),
      findFirst: vi.fn(),
    },
    $transaction: async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@farm.cm",
  phone: "+237600000001",
  name: "Gérant",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Gérant",
  permissions: [Permission.ABONNEMENTS_VOIR, Permission.ABONNEMENTS_GERER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_PLAN = {
  id: "plan-eleveur",
  nom: "Éleveur",
  typePlan: TypePlan.ELEVEUR,
  prixMensuel: 3000,
  prixTrimestriel: 7500,
  prixAnnuel: 25000,
  isActif: true,
  isPublic: true,
  limitesSites: 1,
  limitesBacs: 5,
  limitesVagues: 3,
  limitesIngFermes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { abonnements: 1 },
};

const FAKE_ABONNEMENT = {
  id: "abo-1",
  siteId: "site-1",
  planId: "plan-eleveur",
  plan: FAKE_PLAN,
  periode: PeriodeFacturation.MENSUEL,
  statut: StatutAbonnement.ACTIF,
  dateDebut: new Date(),
  dateFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  dateProchainRenouvellement: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  dateFinGrace: null,
  prixPaye: 3000,
  userId: "user-1",
  remiseId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  paiements: [],
  remisesAppliquees: [],
};

// ---------------------------------------------------------------------------
// Tests : POST /api/abonnements — souscription
// ---------------------------------------------------------------------------

describe("POST /api/abonnements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser les mocks de transaction : aucun EN_ATTENTE_PAIEMENT par défaut
    mockTxAbonnementCount.mockResolvedValue(0);
    mockTxAbonnementCreate.mockResolvedValue(FAKE_ABONNEMENT);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("souscription valide → garde-fou OK + créer abonnement (via $transaction) + initier paiement → 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    mockVerifierRemiseApplicable.mockResolvedValue({ remise: null, erreur: undefined });
    mockTxAbonnementCount.mockResolvedValue(0); // Pas d'EN_ATTENTE_PAIEMENT existant
    mockTxAbonnementCreate.mockResolvedValue(FAKE_ABONNEMENT);
    mockInitierPaiement.mockResolvedValue({
      paiementId: "paiement-1",
      referenceExterne: "ref-123",
      statut: StatutPaiementAbo.INITIE,
    });

    const req = makeRequest("http://localhost:3000/api/abonnements", {
      method: "POST",
      body: JSON.stringify({
        planId: "plan-eleveur",
        periode: PeriodeFacturation.MENSUEL,
        fournisseur: FournisseurPaiement.MANUEL,
        phoneNumber: "+237600000001",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.abonnement).toBeDefined();
    expect(data.paiement.paiementId).toBe("paiement-1");
    // La création passe par tx.abonnement.create (dans $transaction)
    expect(mockTxAbonnementCreate).toHaveBeenCalledOnce();
    expect(mockInitierPaiement).toHaveBeenCalledOnce();
  });

  it("EN_ATTENTE_PAIEMENT existant → garde-fou 409 (R4 / ERR-016)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    mockVerifierRemiseApplicable.mockResolvedValue({ remise: null, erreur: undefined });
    // Simuler qu'un EN_ATTENTE_PAIEMENT existe déjà pour cet utilisateur
    mockTxAbonnementCount.mockResolvedValue(1);

    const req = makeRequest("http://localhost:3000/api/abonnements", {
      method: "POST",
      body: JSON.stringify({
        planId: "plan-eleveur",
        periode: PeriodeFacturation.MENSUEL,
        fournisseur: FournisseurPaiement.MANUEL,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    expect(mockTxAbonnementCreate).not.toHaveBeenCalled();
    expect(mockInitierPaiement).not.toHaveBeenCalled();
  });

  it("code remise invalide → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    mockVerifierRemiseApplicable.mockResolvedValue({
      remise: null,
      erreur: "Code promo invalide",
    });

    const req = makeRequest("http://localhost:3000/api/abonnements", {
      method: "POST",
      body: JSON.stringify({
        planId: "plan-eleveur",
        periode: PeriodeFacturation.MENSUEL,
        fournisseur: FournisseurPaiement.MANUEL,
        remiseCode: "CODE-INVALIDE",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockTxAbonnementCreate).not.toHaveBeenCalled();
  });

  it("planId manquant → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/abonnements", {
      method: "POST",
      body: JSON.stringify({
        periode: PeriodeFacturation.MENSUEL,
        fournisseur: FournisseurPaiement.MANUEL,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("plan inexistant → 404", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/abonnements", {
      method: "POST",
      body: JSON.stringify({
        planId: "plan-inexistant",
        periode: PeriodeFacturation.MENSUEL,
        fournisseur: FournisseurPaiement.MANUEL,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("sans auth → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/abonnements", {
      method: "POST",
      body: JSON.stringify({
        planId: "plan-eleveur",
        periode: PeriodeFacturation.MENSUEL,
        fournisseur: FournisseurPaiement.MANUEL,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/abonnements/actif
// ---------------------------------------------------------------------------

describe("GET /api/abonnements/actif", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne l'abonnement ACTIF du site → 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementActif.mockResolvedValue(FAKE_ABONNEMENT);

    const req = makeRequest("http://localhost:3000/api/abonnements/actif");
    const res = await GET_ACTIF(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.abonnement.id).toBe("abo-1");
    expect(mockGetAbonnementActif).toHaveBeenCalledWith("site-1");
  });

  it("aucun abonnement actif → 200 avec abonnement null", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementActif.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/abonnements/actif");
    const res = await GET_ACTIF(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.abonnement).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests : POST /api/abonnements/[id]/annuler
// ---------------------------------------------------------------------------

describe("POST /api/abonnements/[id]/annuler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("annuler un abonnement ACTIF → statut ANNULE (R4 atomique) → 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({ ...FAKE_ABONNEMENT, statut: StatutAbonnement.ACTIF });
    mockPrismaUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/annuler", {
      method: "POST",
    });
    const res = await POST_ANNULER(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(200);
    // R4 : updateMany appelé avec condition atomique
    expect(mockPrismaUpdateMany).toHaveBeenCalledOnce();
  });

  it("abonnement déjà annulé → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({
      ...FAKE_ABONNEMENT,
      statut: StatutAbonnement.ANNULE,
    });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/annuler", {
      method: "POST",
    });
    const res = await POST_ANNULER(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(400);
    expect(mockPrismaUpdateMany).not.toHaveBeenCalled();
  });

  it("abonnement inexistant → 404", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/abonnements/inexistant/annuler", {
      method: "POST",
    });
    const res = await POST_ANNULER(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests : POST /api/abonnements/[id]/renouveler
// ---------------------------------------------------------------------------

describe("POST /api/abonnements/[id]/renouveler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser les mocks de transaction pour chaque test
    mockTxUserFindUniqueOrThrow.mockResolvedValue({ soldeCredit: 0 });
    mockTxUserUpdate.mockResolvedValue({});
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("renouveler depuis EXPIRE (solde=0) → crée nouvel abonnement EN_ATTENTE_PAIEMENT via $transaction → 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({
      ...FAKE_ABONNEMENT,
      statut: StatutAbonnement.EXPIRE,
    });
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    const newAbonnement = {
      ...FAKE_ABONNEMENT,
      id: "abo-2",
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
    };
    mockTxAbonnementCreate.mockResolvedValue(newAbonnement);
    mockTxUserFindUniqueOrThrow.mockResolvedValue({ soldeCredit: 0 }); // Pas de crédit
    mockInitierPaiement.mockResolvedValue({
      paiementId: "paiement-2",
      referenceExterne: "ref-456",
      statut: StatutPaiementAbo.INITIE,
    });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/renouveler", {
      method: "POST",
      body: JSON.stringify({ fournisseur: FournisseurPaiement.MANUEL }),
    });
    const res = await POST_RENOUVELER(req, { params: Promise.resolve({ id: "abo-1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.abonnement.id).toBe("abo-2");
    expect(data.paiement.paiementId).toBe("paiement-2");
    // Création passe par tx.abonnement.create (dans $transaction)
    expect(mockTxAbonnementCreate).toHaveBeenCalledOnce();
    expect(mockInitierPaiement).toHaveBeenCalledOnce();
    // Pas de mise à jour solde (solde = 0, rien à déduire)
    expect(mockTxUserUpdate).not.toHaveBeenCalled();
  });

  it("renouveler avec soldeCredit > prixPlan → prixFinal=0, solde déduit atomiquement dans $transaction", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({
      ...FAKE_ABONNEMENT,
      statut: StatutAbonnement.EXPIRE,
    });
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN); // prixMensuel ELEVEUR = 3000
    const newAbonnement = {
      ...FAKE_ABONNEMENT,
      id: "abo-3",
      prixPaye: 0,
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
    };
    mockTxAbonnementCreate.mockResolvedValue(newAbonnement);
    // Solde de 5000 FCFA (> prixPlan de 3000 → prixFinal = 0, nouveauSolde = 2000)
    mockTxUserFindUniqueOrThrow.mockResolvedValue({ soldeCredit: 5000 });
    mockTxUserUpdate.mockResolvedValue({});
    mockInitierPaiement.mockResolvedValue({
      paiementId: "paiement-3",
      referenceExterne: "ref-789",
      statut: StatutPaiementAbo.INITIE,
    });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/renouveler", {
      method: "POST",
      body: JSON.stringify({ fournisseur: FournisseurPaiement.MANUEL }),
    });
    const res = await POST_RENOUVELER(req, { params: Promise.resolve({ id: "abo-1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.abonnement.id).toBe("abo-3");
    // Le solde est mis à jour (5000 - 3000 = 2000)
    expect(mockTxUserUpdate).toHaveBeenCalledOnce();
    expect(mockTxUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ soldeCredit: 2000 }),
      })
    );
    // L'abonnement est créé avec prixPaye = 0 (entièrement couvert par le crédit)
    expect(mockTxAbonnementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prixPaye: 0 }),
      })
    );
  });

  it("renouveler avec soldeCredit partiel → prixFinal réduit, solde mis à zéro", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({
      ...FAKE_ABONNEMENT,
      statut: StatutAbonnement.EXPIRE,
    });
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN); // prixMensuel ELEVEUR = 3000
    const newAbonnement = {
      ...FAKE_ABONNEMENT,
      id: "abo-4",
      prixPaye: 1000,
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
    };
    mockTxAbonnementCreate.mockResolvedValue(newAbonnement);
    // Solde de 2000 FCFA (< prixPlan de 3000 → prixFinal = 1000, nouveauSolde = 0)
    mockTxUserFindUniqueOrThrow.mockResolvedValue({ soldeCredit: 2000 });
    mockTxUserUpdate.mockResolvedValue({});
    mockInitierPaiement.mockResolvedValue({
      paiementId: "paiement-4",
      referenceExterne: "ref-101",
      statut: StatutPaiementAbo.INITIE,
    });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/renouveler", {
      method: "POST",
      body: JSON.stringify({ fournisseur: FournisseurPaiement.MANUEL }),
    });
    const res = await POST_RENOUVELER(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(201);
    // Le solde est mis à 0
    expect(mockTxUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ soldeCredit: 0 }),
      })
    );
    // L'abonnement est créé avec prixPaye = 1000 (3000 - 2000)
    expect(mockTxAbonnementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prixPaye: 1000 }),
      })
    );
  });

  it("renouveler un abonnement ACTIF → 400 (ne peut pas renouveler un abonnement actif)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({
      ...FAKE_ABONNEMENT,
      statut: StatutAbonnement.ACTIF,
    });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/renouveler", {
      method: "POST",
      body: JSON.stringify({ fournisseur: FournisseurPaiement.MANUEL }),
    });
    const res = await POST_RENOUVELER(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(400);
    expect(mockTxAbonnementCreate).not.toHaveBeenCalled();
  });
});
