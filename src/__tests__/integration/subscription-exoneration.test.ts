/**
 * Tests d'intégration — Exonération backoffice
 *
 * Story 53.2 — Sprint 53
 *
 * Couvre :
 * - Création temporaire (avec dateFin) → 201
 * - Création permanente (sans dateFin → 2099-12-31) → 201
 * - Annulation d'exonération (DELETE) → 200
 * - Annulation déjà annulée → 409
 * - Non super-admin → 401 ou 403
 *
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques ($transaction)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { StatutAbonnement, TypePlan, PeriodeFacturation } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireSuperAdmin = vi.fn();

vi.mock("@/lib/auth/backoffice", () => ({
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
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

vi.mock("@/lib/permissions", () => ({
  ForbiddenError: class ForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/abonnements/invalidate-caches", () => ({
  invalidateSubscriptionCaches: vi.fn().mockResolvedValue(undefined),
}));

const mockLogAbonnementAudit = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  logAbonnementAudit: (...args: unknown[]) => mockLogAbonnementAudit(...args),
  getAbonnementActif: vi.fn(),
  getAbonnementActifPourSite: vi.fn(),
}));

// Mock Prisma
const mockUserFindUnique = vi.fn();
const mockPlanAbonnementFindFirst = vi.fn();
const mockAbonnementCreate = vi.fn();
const mockAbonnementFindFirst = vi.fn();
const mockAbonnementFindMany = vi.fn();
const mockAbonnementUpdateMany = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    planAbonnement: {
      findFirst: (...args: unknown[]) => mockPlanAbonnementFindFirst(...args),
    },
    abonnement: {
      create: (...args: unknown[]) => mockAbonnementCreate(...args),
      findFirst: (...args: unknown[]) => mockAbonnementFindFirst(...args),
      findMany: (...args: unknown[]) => mockAbonnementFindMany(...args),
      updateMany: (...args: unknown[]) => mockAbonnementUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import { GET as GETExonerations, POST as POSTExoneration } from "@/app/api/backoffice/exonerations/route";
import { GET as GETExonerationById, DELETE as DELETEExoneration } from "@/app/api/backoffice/exonerations/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  userId: "admin-1",
  email: "admin@dkfarm.com",
  isSuperAdmin: true,
};

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/backoffice/exonerations", {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost/api/backoffice/exonerations/${id}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

function makeGetByIdRequest(id: string) {
  return new NextRequest(`http://localhost/api/backoffice/exonerations/${id}`, {
    method: "GET",
  });
}

function makeExonerationAbonnement(id: string, statut: StatutAbonnement = StatutAbonnement.ACTIF) {
  return {
    id,
    userId: "user-exo-1",
    statut,
    planId: "plan-exoneration",
    plan: { id: "plan-exoneration", nom: "EXONERATION", typePlan: TypePlan.EXONERATION },
    prixPaye: 0,
    periode: PeriodeFacturation.MENSUEL,
    dateDebut: new Date(),
    dateFin: new Date("2099-12-31T23:59:59.000Z"),
    dateProchainRenouvellement: new Date("2099-12-31T23:59:59.000Z"),
    motifExoneration: "Partenaire DKFarm",
    user: { id: "user-exo-1", name: "Partenaire", email: "partenaire@test.cm" },
    site: null,
  };
}

/**
 * Configure la $transaction pour créer une exonération.
 */
function setupTransactionExonerationCreate(abonnement: Record<string, unknown>) {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      abonnement: {
        create: (args: unknown) => Promise<Record<string, unknown>>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        abonnement: {
          create: () => Promise.resolve(abonnement),
        },
      };
      return fn(txMock);
    }
  );
}

// ---------------------------------------------------------------------------
// Tests : Création d'exonération
// ---------------------------------------------------------------------------

describe("Création d'exonération (POST /api/backoffice/exonerations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(ADMIN_SESSION);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
    mockUserFindUnique.mockResolvedValue({ id: "user-exo-1", name: "Partenaire" });
    mockPlanAbonnementFindFirst.mockResolvedValue({
      id: "plan-exoneration",
      typePlan: TypePlan.EXONERATION,
    });
  });

  it("exonération temporaire avec dateFin → 201", async () => {
    const abonnement = makeExonerationAbonnement("abo-exo-temp");
    const tempAbonnement = { ...abonnement, dateFin: new Date("2026-12-31") };
    setupTransactionExonerationCreate(tempAbonnement);

    const req = makeRequest({
      userId: "user-exo-1",
      motif: "Partenariat temporaire",
      dateFin: "2026-12-31",
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(201);
    const data = await res.json() as { statut: string; plan: { typePlan: string } };
    expect(data.statut).toBe(StatutAbonnement.ACTIF);
    expect(data.plan.typePlan).toBe(TypePlan.EXONERATION);
  });

  it("exonération permanente (sans dateFin → 2099-12-31) → 201", async () => {
    const abonnement = makeExonerationAbonnement("abo-exo-perm");
    setupTransactionExonerationCreate(abonnement);

    const req = makeRequest({
      userId: "user-exo-1",
      motif: "Partenaire permanent DKFarm",
      // dateFin absent → permanent
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(201);
    const data = await res.json() as {
      statut: string;
      dateFin: string;
    };
    expect(data.statut).toBe(StatutAbonnement.ACTIF);
    // La dateFin doit être en 2099 (ou début 2100 selon la timezone locale)
    const dateFin = new Date(data.dateFin);
    expect(dateFin.getFullYear()).toBeGreaterThanOrEqual(2099);
  });

  it("motif absent → 400", async () => {
    const req = makeRequest({
      userId: "user-exo-1",
      // motif absent
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(400);
    const data = await res.json() as { errors: Array<{ field: string }> };
    expect(data.errors.some((e) => e.field === "motif")).toBe(true);
  });

  it("userId absent → 400", async () => {
    const req = makeRequest({
      motif: "Test sans userId",
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(400);
    const data = await res.json() as { errors: Array<{ field: string }> };
    expect(data.errors.some((e) => e.field === "userId")).toBe(true);
  });

  it("utilisateur introuvable → 404", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const req = makeRequest({
      userId: "user-inexistant",
      motif: "Test utilisateur inexistant",
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(404);
  });

  it("plan EXONERATION introuvable en DB → 500", async () => {
    mockPlanAbonnementFindFirst.mockResolvedValue(null);

    const req = makeRequest({
      userId: "user-exo-1",
      motif: "Test plan absent",
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(500);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("EXONERATION");
  });

  it("dateFin invalide → 400", async () => {
    const req = makeRequest({
      userId: "user-exo-1",
      motif: "Test date invalide",
      dateFin: "pas-une-date",
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(400);
  });

  it("non super-admin → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifié."));

    const req = makeRequest({
      userId: "user-1",
      motif: "Test auth",
    });

    const res = await POSTExoneration(req);

    expect(res.status).toBe(401);
  });

  it("audit EXONERATION loggé après création", async () => {
    const abonnement = makeExonerationAbonnement("abo-exo-audit");
    setupTransactionExonerationCreate(abonnement);

    const req = makeRequest({
      userId: "user-exo-1",
      motif: "Audit test",
    });

    await POSTExoneration(req);

    // logAbonnementAudit est appelé avec EXONERATION (peut être fire-and-forget)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("EXONERATION");
  });
});

// ---------------------------------------------------------------------------
// Tests : Annulation d'exonération
// ---------------------------------------------------------------------------

describe("Annulation d'exonération (DELETE /api/backoffice/exonerations/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(ADMIN_SESSION);
    mockLogAbonnementAudit.mockResolvedValue(undefined);
  });

  it("annuler une exonération active → 200", async () => {
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-exo-del",
      userId: "user-exo-1",
      statut: StatutAbonnement.ACTIF,
      motifExoneration: "Partenaire DKFarm",
    });
    mockAbonnementUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeDeleteRequest("abo-exo-del");
    const res = await DELETEExoneration(req, { params: Promise.resolve({ id: "abo-exo-del" }) });

    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean; message: string };
    expect(data.success).toBe(true);
    expect(data.message).toContain("annul");
  });

  it("annuler exonération déjà annulée → 409", async () => {
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-exo-deja-annule",
      userId: "user-exo-1",
      statut: StatutAbonnement.ANNULE,
      motifExoneration: "Test",
    });

    const req = makeDeleteRequest("abo-exo-deja-annule");
    const res = await DELETEExoneration(req, { params: Promise.resolve({ id: "abo-exo-deja-annule" }) });

    expect(res.status).toBe(409);
    const data = await res.json() as { message: string };
    expect(data.message).toContain("deja annulee");
  });

  it("exonération introuvable → 404", async () => {
    mockAbonnementFindFirst.mockResolvedValue(null);

    const req = makeDeleteRequest("abo-inexistant");
    const res = await DELETEExoneration(req, { params: Promise.resolve({ id: "abo-inexistant" }) });

    expect(res.status).toBe(404);
  });

  it("non super-admin → 403 (ForbiddenError)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequireSuperAdmin.mockRejectedValue(new ForbiddenError("Accès réservé aux super-admins."));

    const req = makeDeleteRequest("abo-exo-1");
    const res = await DELETEExoneration(req, { params: Promise.resolve({ id: "abo-exo-1" }) });

    expect(res.status).toBe(403);
  });

  it("annulation → updateMany avec condition statut != ANNULE", async () => {
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-exo-cond",
      userId: "user-exo-1",
      statut: StatutAbonnement.ACTIF,
      motifExoneration: "Partenaire",
    });
    mockAbonnementUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeDeleteRequest("abo-exo-cond");
    await DELETEExoneration(req, { params: Promise.resolve({ id: "abo-exo-cond" }) });

    expect(mockAbonnementUpdateMany).toHaveBeenCalledOnce();
    const updateArgs = mockAbonnementUpdateMany.mock.calls[0][0] as {
      where: { statut: { not: string } };
      data: { statut: string };
    };
    expect(updateArgs.where.statut.not).toBe(StatutAbonnement.ANNULE);
    expect(updateArgs.data.statut).toBe(StatutAbonnement.ANNULE);
  });

  it("audit ANNULATION_EXONERATION loggé après annulation", async () => {
    mockAbonnementFindFirst.mockResolvedValue({
      id: "abo-exo-audit-del",
      userId: "user-exo-1",
      statut: StatutAbonnement.ACTIF,
      motifExoneration: "Partenaire",
    });
    mockAbonnementUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeDeleteRequest("abo-exo-audit-del");
    await DELETEExoneration(req, { params: Promise.resolve({ id: "abo-exo-audit-del" }) });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockLogAbonnementAudit).toHaveBeenCalled();
    const [, action] = mockLogAbonnementAudit.mock.calls[0] as [string, string];
    expect(action).toBe("ANNULATION_EXONERATION");
  });
});

// ---------------------------------------------------------------------------
// Tests : Liste des exonérations (GET)
// ---------------------------------------------------------------------------

describe("Liste des exonérations (GET /api/backoffice/exonerations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(ADMIN_SESSION);
  });

  it("retourne la liste des exonérations → 200", async () => {
    const exonerations = [
      makeExonerationAbonnement("abo-exo-list-1"),
      makeExonerationAbonnement("abo-exo-list-2"),
    ];
    mockAbonnementFindMany.mockResolvedValue(exonerations);

    const req = makeRequest();
    const res = await GETExonerations(req);

    expect(res.status).toBe(200);
    const data = await res.json() as { exonerations: unknown[]; total: number };
    expect(data.total).toBe(2);
    expect(data.exonerations).toHaveLength(2);
  });

  it("non super-admin → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireSuperAdmin.mockRejectedValue(new AuthError("Non authentifié."));

    const req = makeRequest();
    const res = await GETExonerations(req);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : Détail d'une exonération (GET /[id])
// ---------------------------------------------------------------------------

describe("Détail exonération (GET /api/backoffice/exonerations/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(ADMIN_SESSION);
  });

  it("exonération trouvée → 200", async () => {
    mockAbonnementFindFirst.mockResolvedValue(makeExonerationAbonnement("abo-exo-detail"));

    const req = makeGetByIdRequest("abo-exo-detail");
    const res = await GETExonerationById(req, { params: Promise.resolve({ id: "abo-exo-detail" }) });

    expect(res.status).toBe(200);
    const data = await res.json() as { id: string };
    expect(data.id).toBe("abo-exo-detail");
  });

  it("exonération introuvable → 404", async () => {
    mockAbonnementFindFirst.mockResolvedValue(null);

    const req = makeGetByIdRequest("abo-inexistant");
    const res = await GETExonerationById(req, { params: Promise.resolve({ id: "abo-inexistant" }) });

    expect(res.status).toBe(404);
  });
});
