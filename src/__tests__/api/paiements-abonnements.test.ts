/**
 * Tests d'intégration — Routes /api/abonnements/[id]/paiements et /api/paiements/[id]/verifier
 *
 * Couvre :
 * - GET  /api/abonnements/[id]/paiements — liste paiements de l'abonnement → 200 / 401 / 404
 * - POST /api/abonnements/[id]/paiements — initier un nouveau paiement → 201 / 400 / 401 / 404
 * - GET  /api/paiements/[id]/verifier     — vérifier statut paiement → 200 / 401 / 404
 *
 * Story 32.3 — Sprint 32
 * Sprint 52 : siteId supprimé d'Abonnement/PaiementAbonnement — ownership via userId
 * R2 : enums StatutPaiementAbo, FournisseurPaiement, Permission importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/abonnements/[id]/paiements/route";
import { GET as GET_VERIFIER } from "@/app/api/paiements/[id]/verifier/route";
import { NextRequest } from "next/server";
import {
  Permission,
  StatutPaiementAbo,
  FournisseurPaiement,
  StatutAbonnement,
  PeriodeFacturation,
  TypePlan,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAbonnementById = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementById: (...args: unknown[]) => mockGetAbonnementById(...args),
}));

const mockGetPaiementsByAbonnement = vi.fn();

vi.mock("@/lib/queries/paiements-abonnements", () => ({
  getPaiementsByAbonnement: (...args: unknown[]) =>
    mockGetPaiementsByAbonnement(...args),
}));

const mockInitierPaiement = vi.fn();
const mockVerifierEtActiverPaiement = vi.fn();

vi.mock("@/lib/services/billing", () => ({
  initierPaiement: (...args: unknown[]) => mockInitierPaiement(...args),
  verifierEtActiverPaiement: (...args: unknown[]) =>
    mockVerifierEtActiverPaiement(...args),
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

const mockPrismaFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    paiementAbonnement: {
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
    },
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

const FAKE_PLAN = {
  id: "plan-eleveur",
  nom: "Éleveur",
  typePlan: TypePlan.ELEVEUR,
  prixMensuel: 3000,
  prixTrimestriel: 7500,
  prixAnnuel: 25000,
  isActif: true,
  isPublic: true,
};

const FAKE_ABONNEMENT = {
  id: "abo-1",
  // Sprint 52 : siteId supprimé d'Abonnement
  planId: "plan-eleveur",
  plan: FAKE_PLAN,
  periode: PeriodeFacturation.MENSUEL,
  statut: StatutAbonnement.ACTIF,
  dateDebut: new Date(),
  dateFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  dateProchainRenouvellement: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  prixPaye: 3000,
  userId: "user-1",
};

const FAKE_PAIEMENTS = [
  {
    id: "paiement-1",
    abonnementId: "abo-1",
    // Sprint 52 : siteId supprimé de PaiementAbonnement
    statut: StatutPaiementAbo.CONFIRME,
    montant: 3000,
    fournisseur: FournisseurPaiement.MANUEL,
    referenceExterne: "ref-001",
    dateConfirmation: new Date(),
    createdAt: new Date(),
  },
];

const FAKE_PAIEMENT_EN_ATTENTE = {
  id: "paiement-2",
  abonnementId: "abo-1",
  // Sprint 52 : siteId supprimé de PaiementAbonnement
  statut: StatutPaiementAbo.INITIE,
  montant: 3000,
  fournisseur: FournisseurPaiement.MTN_MOMO,
  referenceExterne: "ref-mtn-002",
  dateConfirmation: null,
  createdAt: new Date(),
  abonnement: { id: "abo-1", statut: StatutAbonnement.ACTIF },
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// Tests : GET /api/abonnements/[id]/paiements
// ---------------------------------------------------------------------------

describe("GET /api/abonnements/[id]/paiements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne la liste des paiements de l'abonnement → 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(FAKE_ABONNEMENT);
    mockGetPaiementsByAbonnement.mockResolvedValue(FAKE_PAIEMENTS);

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/paiements");
    const res = await GET(req, { params: Promise.resolve({ id: "abo-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.paiements).toHaveLength(1);
    expect(data.total).toBe(1);
    // Sprint 52 : ownership via userId — getAbonnementById sans siteId
    expect(mockGetAbonnementById).toHaveBeenCalledWith("abo-1");
    expect(mockGetPaiementsByAbonnement).toHaveBeenCalledWith("abo-1");
  });

  it("abonnement inexistant ou hors site → 404", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/abonnements/inexistant/paiements");
    const res = await GET(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
    expect(mockGetPaiementsByAbonnement).not.toHaveBeenCalled();
  });

  it("sans auth → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/paiements");
    const res = await GET(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : POST /api/abonnements/[id]/paiements — initier un nouveau paiement
// ---------------------------------------------------------------------------

describe("POST /api/abonnements/[id]/paiements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initier un paiement avec fournisseur valide → 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(FAKE_ABONNEMENT);
    mockInitierPaiement.mockResolvedValue({
      paiementId: "paiement-3",
      referenceExterne: "ref-mtn-003",
      statut: StatutPaiementAbo.INITIE,
      message: "Paiement initie avec succes.",
    });

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/paiements", {
      method: "POST",
      body: JSON.stringify({
        fournisseur: FournisseurPaiement.MTN_MOMO,
        phoneNumber: "+237600000001",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abo-1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.paiementId).toBe("paiement-3");
    expect(data.referenceExterne).toBe("ref-mtn-003");
    expect(data.statut).toBe(StatutPaiementAbo.INITIE);
    // Sprint 52 : initierPaiement sans siteId
    expect(mockInitierPaiement).toHaveBeenCalledWith(
      "abo-1",
      "user-1",
      expect.objectContaining({ fournisseur: FournisseurPaiement.MTN_MOMO })
    );
  });

  it("fournisseur absent → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(FAKE_ABONNEMENT);

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/paiements", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+237600000001" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(400);
    expect(mockInitierPaiement).not.toHaveBeenCalled();
  });

  it("fournisseur invalide → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(FAKE_ABONNEMENT);

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/paiements", {
      method: "POST",
      body: JSON.stringify({ fournisseur: "PAYPAL", phoneNumber: "+237600000001" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(400);
    expect(mockInitierPaiement).not.toHaveBeenCalled();
  });

  it("abonnement inexistant ou hors site → 404", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/abonnements/inexistant/paiements", {
      method: "POST",
      body: JSON.stringify({ fournisseur: FournisseurPaiement.MANUEL }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
    expect(mockInitierPaiement).not.toHaveBeenCalled();
  });

  it("sans auth → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/abonnements/abo-1/paiements", {
      method: "POST",
      body: JSON.stringify({ fournisseur: FournisseurPaiement.MANUEL }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abo-1" }) });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/paiements/[id]/verifier
// ---------------------------------------------------------------------------

describe("GET /api/paiements/[id]/verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paiement en attente → confirme=false, statut INITIE → 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    // Premier findFirst : retourne le paiement avec referenceExterne
    mockPrismaFindFirst
      .mockResolvedValueOnce(FAKE_PAIEMENT_EN_ATTENTE)
      // Second findFirst : recharge après vérification
      .mockResolvedValueOnce({
        statut: StatutPaiementAbo.INITIE,
        dateConfirmation: null,
      });
    mockVerifierEtActiverPaiement.mockResolvedValue(false);

    const req = makeRequest("http://localhost:3000/api/paiements/paiement-2/verifier");
    const res = await GET_VERIFIER(req, { params: Promise.resolve({ id: "paiement-2" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.paiementId).toBe("paiement-2");
    expect(data.statut).toBe(StatutPaiementAbo.INITIE);
    expect(data.confirme).toBe(false);
  });

  it("paiement confirmé par la gateway → confirme=true, statut CONFIRME → 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaFindFirst
      .mockResolvedValueOnce(FAKE_PAIEMENT_EN_ATTENTE)
      .mockResolvedValueOnce({
        statut: StatutPaiementAbo.CONFIRME,
        dateConfirmation: new Date(),
      });
    mockVerifierEtActiverPaiement.mockResolvedValue(true);

    const req = makeRequest("http://localhost:3000/api/paiements/paiement-2/verifier");
    const res = await GET_VERIFIER(req, { params: Promise.resolve({ id: "paiement-2" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.confirme).toBe(true);
    expect(data.statut).toBe(StatutPaiementAbo.CONFIRME);
    expect(data.dateConfirmation).not.toBeNull();
    // R idempotence : verifierEtActiverPaiement appelé avec la referenceExterne
    expect(mockVerifierEtActiverPaiement).toHaveBeenCalledWith("ref-mtn-002");
  });

  it("paiement sans referenceExterne → 200 sans appel gateway", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaFindFirst.mockResolvedValueOnce({
      ...FAKE_PAIEMENT_EN_ATTENTE,
      referenceExterne: null,
    });

    const req = makeRequest("http://localhost:3000/api/paiements/paiement-2/verifier");
    const res = await GET_VERIFIER(req, { params: Promise.resolve({ id: "paiement-2" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.confirme).toBe(false);
    // Idempotence : pas d'appel gateway si pas de referenceExterne
    expect(mockVerifierEtActiverPaiement).not.toHaveBeenCalled();
  });

  it("paiement introuvable ou hors site → 404", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaFindFirst.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost:3000/api/paiements/inexistant/verifier");
    const res = await GET_VERIFIER(req, {
      params: Promise.resolve({ id: "inexistant" }),
    });

    expect(res.status).toBe(404);
    expect(mockVerifierEtActiverPaiement).not.toHaveBeenCalled();
  });

  it("sans auth → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/paiements/paiement-2/verifier");
    const res = await GET_VERIFIER(req, { params: Promise.resolve({ id: "paiement-2" }) });

    expect(res.status).toBe(401);
  });
});
