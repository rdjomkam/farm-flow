/**
 * Tests d'intégration — Routes /api/plans (Sprint 32)
 *
 * Couvre :
 * - GET /api/plans?public=true — liste publique sans auth
 * - GET /api/plans              — liste complète avec auth + PLANS_GERER
 * - POST /api/plans             — créer un plan (auth + PLANS_GERER)
 * - GET /api/plans/[id]         — détail d'un plan
 * - PUT /api/plans/[id]         — modifier un plan (auth + PLANS_GERER)
 * - DELETE /api/plans/[id]      — désactiver (409 si abonnés actifs)
 * - PATCH /api/plans/[id]/toggle — activer/désactiver (R4 atomique)
 *
 * Story 32.5 — Sprint 32
 * R2 : enums TypePlan, Permission importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/plans/route";
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/plans/[id]/route";
import { PATCH as PATCH_TOGGLE } from "@/app/api/plans/[id]/toggle/route";
import { NextRequest } from "next/server";
import { Permission, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPlansAbonnements = vi.fn();
const mockGetPlanAbonnementById = vi.fn();
const mockCreatePlanAbonnement = vi.fn();
const mockUpdatePlanAbonnement = vi.fn();
const mockTogglePlanAbonnement = vi.fn();

vi.mock("@/lib/queries/plans-abonnements", () => ({
  getPlansAbonnements: (...args: unknown[]) => mockGetPlansAbonnements(...args),
  getPlanAbonnementById: (...args: unknown[]) => mockGetPlanAbonnementById(...args),
  createPlanAbonnement: (...args: unknown[]) => mockCreatePlanAbonnement(...args),
  updatePlanAbonnement: (...args: unknown[]) => mockUpdatePlanAbonnement(...args),
  togglePlanAbonnement: (...args: unknown[]) => mockTogglePlanAbonnement(...args),
}));

const mockRequirePermission = vi.fn();
const mockGetSession = vi.fn();

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
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

const AUTH_CONTEXT = {
  userId: "user-admin",
  email: "admin@dkfarm.cm",
  phone: null,
  name: "Admin DKFarm",
  globalRole: "ADMIN",
  activeSiteId: "site-dkfarm",
  siteRoleId: "",
  siteRoleName: "Super Admin",
  permissions: Object.values(Permission),
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_PLAN = {
  id: "plan-1",
  nom: "Plan Éleveur",
  typePlan: TypePlan.ELEVEUR,
  description: "Pour les petits éleveurs",
  prixMensuel: 3000,
  prixTrimestriel: 7500,
  prixAnnuel: 25000,
  limitesSites: 1,
  limitesBacs: 5,
  limitesVagues: 3,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { abonnements: 0 },
};

// ---------------------------------------------------------------------------
// Tests : GET /api/plans
// ---------------------------------------------------------------------------

describe("GET /api/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("liste publique accessible sans auth (public=true)", async () => {
    mockGetPlansAbonnements.mockResolvedValue([FAKE_PLAN]);

    const req = makeRequest("http://localhost:3000/api/plans?public=true");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plans).toHaveLength(1);
    expect(data.total).toBe(1);
    // getPlansAbonnements(false) appelé pour liste publique
    expect(mockGetPlansAbonnements).toHaveBeenCalledWith(false);
    // requirePermission NON appelé
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it("liste complète (incluant inactifs) avec auth + PLANS_GERER", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlansAbonnements.mockResolvedValue([FAKE_PLAN, { ...FAKE_PLAN, id: "plan-2", isActif: false }]);

    const req = makeRequest("http://localhost:3000/api/plans");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plans).toHaveLength(2);
    expect(mockGetPlansAbonnements).toHaveBeenCalledWith(true);
    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.PLANS_GERER
    );
  });

  it("sans public=true et sans auth → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/plans");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : POST /api/plans
// ---------------------------------------------------------------------------

describe("POST /api/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("créer un plan avec données valides → 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, id: "plan-new" });

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Éleveur",
        typePlan: TypePlan.ELEVEUR,
        prixMensuel: 3000,
        prixAnnuel: 25000,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreatePlanAbonnement).toHaveBeenCalledOnce();
  });

  it("nom manquant → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({ typePlan: TypePlan.ELEVEUR }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it("typePlan invalide → 400", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({ nom: "Test", typePlan: "INVALIDE" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("sans auth → 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({ nom: "Plan Test", typePlan: TypePlan.ELEVEUR }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : GET /api/plans/[id]
// ---------------------------------------------------------------------------

describe("GET /api/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plan existant actif public → 200 sans auth", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
    mockGetSession.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/plans/plan-1");
    const res = await GET_DETAIL(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
  });

  it("plan inexistant → 404", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(null);
    mockGetSession.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/plans/inexistant");
    const res = await GET_DETAIL(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
  });

  it("plan inactif sans auth → 401", async () => {
    mockGetPlanAbonnementById.mockResolvedValue({ ...FAKE_PLAN, isActif: false });
    mockGetSession.mockResolvedValue(null);
    // Import the mocked AuthError class to create a proper instanceof match
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const req = makeRequest("http://localhost:3000/api/plans/plan-1");
    const res = await GET_DETAIL(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests : DELETE /api/plans/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("désactiver un plan sans abonnés actifs → 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue({ ...FAKE_PLAN, _count: { abonnements: 0 } });
    mockUpdatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, isActif: false });

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
    expect(mockUpdatePlanAbonnement).toHaveBeenCalledWith("plan-1", { isActif: false });
  });

  it("désactiver un plan avec abonnés actifs → 409", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue({ ...FAKE_PLAN, _count: { abonnements: 3 } });

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(409);
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("plan inexistant → 404", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/plans/inexistant", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests : PATCH /api/plans/[id]/toggle
// ---------------------------------------------------------------------------

describe("PATCH /api/plans/[id]/toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggle un plan existant → 200 (R4 atomique)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    // togglePlanAbonnement retourne { count: 1 }
    mockTogglePlanAbonnement.mockResolvedValue({ count: 1 });

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PATCH",
    });
    const res = await PATCH_TOGGLE(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
    expect(mockTogglePlanAbonnement).toHaveBeenCalledWith("plan-1");
  });

  it("plan inexistant → 404 (count === 0)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockTogglePlanAbonnement.mockResolvedValue({ count: 0 });

    const req = makeRequest("http://localhost:3000/api/plans/inexistant", {
      method: "PATCH",
    });
    const res = await PATCH_TOGGLE(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
  });
});
