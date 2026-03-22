/**
 * Tests d'intégration — Routes /api/abonnements (Sprint 32)
 *
 * Couvre :
 * - POST /abonnements — crée abonnement + initie paiement
 * - POST /abonnements — code remise invalide → 400
 * - GET /abonnements/actif — retourne l'abonnement ACTIF
 * - POST /abonnements/[id]/renouveler — depuis EXPIRE → EN_ATTENTE_PAIEMENT
 * - POST /abonnements/[id]/annuler — statut → ANNULE (R4 atomique)
 *
 * Story 32.5 — Sprint 32
 * R2 : enums StatutAbonnement, Permission importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/abonnements/route";
import { GET as GET_ACTIF } from "@/app/api/abonnements/actif/route";
import { POST as POST_ANNULER } from "@/app/api/abonnements/[id]/annuler/route";
import { POST as POST_RENOUVELER } from "@/app/api/abonnements/[id]/renouveler/route";
import { NextRequest } from "next/server";
import { Permission, StatutAbonnement, PeriodeFacturation, FournisseurPaiement, TypePlan, StatutPaiementAbo } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAbonnements = vi.fn();
const mockGetAbonnementById = vi.fn();
const mockGetAbonnementActif = vi.fn();
const mockCreateAbonnement = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnements: (...args: unknown[]) => mockGetAbonnements(...args),
  getAbonnementById: (...args: unknown[]) => mockGetAbonnementById(...args),
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
  createAbonnement: (...args: unknown[]) => mockCreateAbonnement(...args),
  activerAbonnement: vi.fn(),
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

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnement: {
      updateMany: (...args: unknown[]) => mockPrismaUpdateMany(...args),
      findFirst: vi.fn(),
    },
  },
}));

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
  });

  it("souscription valide → créer abonnement + initier paiement → 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    mockVerifierRemiseApplicable.mockResolvedValue({ remise: null, erreur: undefined });
    mockCreateAbonnement.mockResolvedValue(FAKE_ABONNEMENT);
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
    expect(mockCreateAbonnement).toHaveBeenCalledOnce();
    expect(mockInitierPaiement).toHaveBeenCalledOnce();
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
    expect(mockCreateAbonnement).not.toHaveBeenCalled();
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
  });

  it("renouveler depuis EXPIRE → crée nouvel abonnement EN_ATTENTE_PAIEMENT → 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue({
      ...FAKE_ABONNEMENT,
      statut: StatutAbonnement.EXPIRE,
    });
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    const newAbonnement = { ...FAKE_ABONNEMENT, id: "abo-2", statut: StatutAbonnement.EN_ATTENTE_PAIEMENT };
    mockCreateAbonnement.mockResolvedValue(newAbonnement);
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
    expect(mockCreateAbonnement).toHaveBeenCalledOnce();
    expect(mockInitierPaiement).toHaveBeenCalledOnce();
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
    expect(mockCreateAbonnement).not.toHaveBeenCalled();
  });
});
