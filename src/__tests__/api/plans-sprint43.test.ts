/**
 * Tests d'intégration — modulesInclus dans /api/plans (Sprint 43)
 *
 * Couvre la validation de modulesInclus introduite au Sprint 43 :
 * - POST /api/plans avec modulesInclus valides → 201
 * - POST /api/plans avec modules platform (ABONNEMENTS, COMMISSIONS, REMISES) → 400
 * - POST /api/plans avec module inconnu → 400
 * - POST /api/plans avec modulesInclus non-tableau → 400
 * - POST /api/plans sans modulesInclus → 201 (défaut [] appliqué)
 * - POST /api/plans avec modulesInclus vide → 201
 * - PUT /api/plans/[id] avec modulesInclus valides → 200
 * - PUT /api/plans/[id] avec modules platform → 400 errorKey INVALID_PLATFORM_MODULE
 * - PUT /api/plans/[id] avec module inconnu → 400
 * - PUT /api/plans/[id] avec modulesInclus non-tableau → 400
 * - PUT /api/plans/[id] sans modulesInclus → 200 (champ ignoré)
 *
 * Story 43.2 — Sprint 43
 * R2 : enums SiteModule, TypePlan, Permission importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/plans/route";
import { PUT } from "@/app/api/plans/[id]/route";
import { NextRequest } from "next/server";
import { Permission, TypePlan, SiteModule } from "@/types";

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
  getSession: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

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

const FAKE_PLAN = {
  id: "plan-1",
  nom: "Plan Eleveur",
  typePlan: TypePlan.ELEVEUR,
  description: null,
  prixMensuel: 3000,
  prixTrimestriel: null,
  prixAnnuel: 25000,
  limitesSites: 1,
  limitesBacs: 5,
  limitesVagues: 3,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  modulesInclus: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { abonnements: 0 },
};

// Modules valides (site-level)
const VALID_MODULES = [SiteModule.GROSSISSEMENT, SiteModule.VENTES, SiteModule.INTRANTS];
// Modules platform (interdits dans un plan)
const PLATFORM_MODULES = [SiteModule.ABONNEMENTS, SiteModule.COMMISSIONS, SiteModule.REMISES];

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// POST /api/plans — validation modulesInclus (Sprint 43)
// ---------------------------------------------------------------------------

describe("POST /api/plans — modulesInclus (Sprint 43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("modulesInclus valides (site-level) → 201 et appel createPlanAbonnement avec bons modules", async () => {
    const expectedPlan = { ...FAKE_PLAN, id: "plan-new", modulesInclus: VALID_MODULES };
    mockCreatePlanAbonnement.mockResolvedValue(expectedPlan);

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Eleveur",
        typePlan: TypePlan.ELEVEUR,
        prixMensuel: 3000,
        modulesInclus: VALID_MODULES,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreatePlanAbonnement).toHaveBeenCalledOnce();
    const callArg = mockCreatePlanAbonnement.mock.calls[0][0];
    expect(callArg.modulesInclus).toEqual(VALID_MODULES);
  });

  it("module platform ABONNEMENTS dans modulesInclus → 400 avec errorKey INVALID_PLATFORM_MODULE", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: [SiteModule.ABONNEMENTS],
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errorKey).toBe("validation.invalidPlatformModule");
    expect(mockCreatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("module platform COMMISSIONS dans modulesInclus → 400", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: [SiteModule.COMMISSIONS, SiteModule.GROSSISSEMENT],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("module platform REMISES dans modulesInclus → 400", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: [SiteModule.REMISES],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("les trois modules platform simultanément → 400 avec message listant les trois modules", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: PLATFORM_MODULES,
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("ABONNEMENTS");
    expect(data.message).toContain("COMMISSIONS");
    expect(data.message).toContain("REMISES");
  });

  it("module inconnu (string arbitraire) → 400", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: ["MODULE_INEXISTANT"],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("modulesInclus non-tableau (string) → 400 avec erreur de validation", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: "GROSSISSEMENT",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors).toBeDefined();
    const modulesError = data.errors.find(
      (e: { field: string; message: string }) => e.field === "modulesInclus"
    );
    expect(modulesError).toBeDefined();
    expect(modulesError.message).toMatch(/tableau/);
  });

  it("modulesInclus absent → 201 avec modulesInclus défaut []", async () => {
    mockCreatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, id: "plan-new" });

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Eleveur",
        typePlan: TypePlan.ELEVEUR,
        prixMensuel: 3000,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const callArg = mockCreatePlanAbonnement.mock.calls[0][0];
    expect(callArg.modulesInclus).toEqual([]);
  });

  it("modulesInclus tableau vide → 201 (valide)", async () => {
    mockCreatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, id: "plan-new", modulesInclus: [] });

    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Decouverte",
        typePlan: TypePlan.DECOUVERTE,
        modulesInclus: [],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const callArg = mockCreatePlanAbonnement.mock.calls[0][0];
    expect(callArg.modulesInclus).toEqual([]);
  });

  it("mix module valide + platform → 400 (rejet global)", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: [SiteModule.GROSSISSEMENT, SiteModule.ABONNEMENTS],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("le message d'erreur indique les modules invalides et les modules acceptes", async () => {
    const req = makeRequest("http://localhost:3000/api/plans", {
      method: "POST",
      body: JSON.stringify({
        nom: "Plan Test",
        typePlan: TypePlan.ELEVEUR,
        modulesInclus: [SiteModule.ABONNEMENTS],
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.message).toMatch(/site-level/);
    expect(data.message).toContain("ABONNEMENTS");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/plans/[id] — validation modulesInclus (Sprint 43)
// ---------------------------------------------------------------------------

describe("PUT /api/plans/[id] — modulesInclus (Sprint 43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetPlanAbonnementById.mockResolvedValue(FAKE_PLAN);
  });

  it("modulesInclus valides → 200 et appel updatePlanAbonnement avec bons modules", async () => {
    const updatedPlan = { ...FAKE_PLAN, modulesInclus: VALID_MODULES };
    mockUpdatePlanAbonnement.mockResolvedValue(updatedPlan);

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: VALID_MODULES }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
    expect(mockUpdatePlanAbonnement).toHaveBeenCalledOnce();
    const callArg = mockUpdatePlanAbonnement.mock.calls[0][1];
    expect(callArg.modulesInclus).toEqual(VALID_MODULES);
  });

  it("module platform ABONNEMENTS → 400 avec errorKey INVALID_PLATFORM_MODULE", async () => {
    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: [SiteModule.ABONNEMENTS] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errorKey).toBe("validation.invalidPlatformModule");
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("module platform COMMISSIONS → 400", async () => {
    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: [SiteModule.COMMISSIONS] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(400);
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("module platform REMISES → 400", async () => {
    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: [SiteModule.REMISES] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(400);
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("module inconnu → 400", async () => {
    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: ["MODULE_INCONNU"] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(400);
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("modulesInclus non-tableau → 400 avec champ 'modulesInclus' dans les erreurs", async () => {
    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: 42 }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    const modulesError = data.errors?.find(
      (e: { field: string }) => e.field === "modulesInclus"
    );
    expect(modulesError).toBeDefined();
  });

  it("sans modulesInclus → 200 (champ non inclus dans le DTO)", async () => {
    mockUpdatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, prixMensuel: 5000 });

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ prixMensuel: 5000 }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
    const callArg = mockUpdatePlanAbonnement.mock.calls[0][1];
    expect(callArg.modulesInclus).toBeUndefined();
  });

  it("modulesInclus tableau vide → 200 (désactivation de tous les modules)", async () => {
    mockUpdatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, modulesInclus: [] });

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: [] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
    const callArg = mockUpdatePlanAbonnement.mock.calls[0][1];
    expect(callArg.modulesInclus).toEqual([]);
  });

  it("plan inexistant → 404 (vérification avant la validation modulesInclus)", async () => {
    mockGetPlanAbonnementById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/plans/inexistant", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: VALID_MODULES }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "inexistant" }) });

    expect(res.status).toBe(404);
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("mix module valide + inconnu → 400 (rejet global)", async () => {
    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({
        modulesInclus: [SiteModule.GROSSISSEMENT, "INEXISTANT"],
      }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(400);
    expect(mockUpdatePlanAbonnement).not.toHaveBeenCalled();
  });

  it("tous les modules site-level valides → 200", async () => {
    const allSiteModules = [
      SiteModule.REPRODUCTION,
      SiteModule.GROSSISSEMENT,
      SiteModule.INTRANTS,
      SiteModule.VENTES,
      SiteModule.ANALYSE_PILOTAGE,
      SiteModule.CONFIGURATION,
      SiteModule.INGENIEUR,
      SiteModule.NOTES,
    ];
    mockUpdatePlanAbonnement.mockResolvedValue({ ...FAKE_PLAN, modulesInclus: allSiteModules });

    const req = makeRequest("http://localhost:3000/api/plans/plan-1", {
      method: "PUT",
      body: JSON.stringify({ modulesInclus: allSiteModules }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "plan-1" }) });

    expect(res.status).toBe(200);
    const callArg = mockUpdatePlanAbonnement.mock.calls[0][1];
    expect(callArg.modulesInclus).toEqual(allSiteModules);
  });
});
