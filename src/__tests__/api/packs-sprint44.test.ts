/**
 * Tests API — Packs (Sprint 44)
 *
 * Valide les regles metier introduites dans Sprint 44 :
 * - POST /api/packs : planId obligatoire → 400 si absent ou vide
 * - POST /api/packs : creation reussie avec planId valide (201)
 * - PUT /api/packs/[id] : mise a jour avec planId → succes
 *
 * Story 44.2 — Sprint 44
 * R2 : enums importes depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/packs/route";
import { PUT } from "@/app/api/packs/[id]/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPacks = vi.fn();
const mockCreatePack = vi.fn();
const mockGetPackById = vi.fn();
const mockUpdatePack = vi.fn();
const mockDeletePack = vi.fn();

vi.mock("@/lib/queries/packs", () => ({
  getPacks: (...args: unknown[]) => mockGetPacks(...args),
  createPack: (...args: unknown[]) => mockCreatePack(...args),
  getPackById: (...args: unknown[]) => mockGetPackById(...args),
  updatePack: (...args: unknown[]) => mockUpdatePack(...args),
  deletePack: (...args: unknown[]) => mockDeletePack(...args),
  getPackProduits: vi.fn().mockResolvedValue([]),
  addPackProduit: vi.fn(),
  removePackProduit: vi.fn(),
  getPackActivations: vi.fn().mockResolvedValue([]),
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
  normalizePhone: vi.fn().mockReturnValue("699000001"),
}));

const AUTH_ADMIN = {
  userId: "user-admin",
  email: "admin@dkfarm.cm",
  phone: null,
  name: "Admin DKFarm",
  globalRole: "ADMIN",
  activeSiteId: "site-dkfarm",
  siteRole: "ADMIN",
  permissions: [
    Permission.DASHBOARD_VOIR,
    Permission.GERER_PACKS,
    Permission.ACTIVER_PACKS,
  ],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_PACK_WITH_PLAN = {
  id: "pack-1",
  nom: "Pack Professionnel 500",
  description: "Kit professionnel",
  nombreAlevins: 500,
  poidsMoyenInitial: 5.0,
  prixTotal: 250000,
  isActive: true,
  configElevageId: null,
  planId: "plan-pro",
  userId: "user-admin",
  siteId: "site-dkfarm",
  createdAt: new Date(),
  updatedAt: new Date(),
  configElevage: null,
  plan: {
    id: "plan-pro",
    nom: "Plan Professionnel",
    typePlan: "PROFESSIONNEL",
  },
  user: { id: "user-admin", name: "Admin DKFarm" },
  produits: [],
  _count: { activations: 0 },
};

// ---------------------------------------------------------------------------
// POST /api/packs — planId obligatoire (Sprint 44)
// ---------------------------------------------------------------------------

describe("POST /api/packs — Sprint 44 : planId obligatoire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("retourne 400 si planId est absent", async () => {
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Test",
        nombreAlevins: 100,
        prixTotal: 50000,
        // planId absent intentionnellement
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/plan/i);
  });

  it("retourne 400 si planId est une chaine vide", async () => {
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Test",
        nombreAlevins: 100,
        planId: "",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/plan/i);
  });

  it("retourne 400 si planId n'est pas une chaine", async () => {
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Test",
        nombreAlevins: 100,
        planId: 12345,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/plan/i);
  });

  it("cree un pack (201) quand planId est valide", async () => {
    mockCreatePack.mockResolvedValue(FAKE_PACK_WITH_PLAN);

    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Professionnel 500",
        nombreAlevins: 500,
        prixTotal: 250000,
        planId: "plan-pro",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.nom).toBe("Pack Professionnel 500");
    expect(data.planId).toBe("plan-pro");
  });

  it("passe planId a createPack", async () => {
    mockCreatePack.mockResolvedValue(FAKE_PACK_WITH_PLAN);

    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Decouverte 100",
        nombreAlevins: 100,
        planId: "plan-decouverte",
      }),
    });
    await POST(req);

    expect(mockCreatePack).toHaveBeenCalledWith(
      expect.objectContaining({ planId: "plan-decouverte" })
    );
  });
});

// ---------------------------------------------------------------------------
// PUT /api/packs/[id] — mise a jour planId (Sprint 44)
// ---------------------------------------------------------------------------

describe("PUT /api/packs/[id] — Sprint 44 : mise a jour planId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("met a jour le planId avec succes (200)", async () => {
    const updatedPack = { ...FAKE_PACK_WITH_PLAN, planId: "plan-eleveur" };
    mockUpdatePack.mockResolvedValue(updatedPack);

    const req = makeRequest("http://localhost:3000/api/packs/pack-1", {
      method: "PUT",
      body: JSON.stringify({ planId: "plan-eleveur" }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await PUT(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.planId).toBe("plan-eleveur");
  });

  it("passe planId a updatePack quand fourni", async () => {
    mockUpdatePack.mockResolvedValue({ ...FAKE_PACK_WITH_PLAN, planId: "plan-entreprise" });

    const req = makeRequest("http://localhost:3000/api/packs/pack-1", {
      method: "PUT",
      body: JSON.stringify({ nom: "Pack Modifie", planId: "plan-entreprise" }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    await PUT(req, { params });

    expect(mockUpdatePack).toHaveBeenCalledWith(
      "pack-1",
      AUTH_ADMIN.activeSiteId,
      expect.objectContaining({ planId: "plan-entreprise" })
    );
  });
});

// ---------------------------------------------------------------------------
// Verification : absence de enabledModules dans les corps de requete
// ---------------------------------------------------------------------------

describe("POST /api/packs — Sprint 44 : enabledModules non transmis a createPack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("createPack n'est pas appele avec enabledModules", async () => {
    mockCreatePack.mockResolvedValue(FAKE_PACK_WITH_PLAN);

    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Test Sprint 44",
        nombreAlevins: 200,
        planId: "plan-pro",
        // enabledModules n'est pas envoye
      }),
    });
    await POST(req);

    const createCall = mockCreatePack.mock.calls[0]?.[0];
    if (createCall) {
      expect(createCall).not.toHaveProperty("enabledModules");
    }
  });
});
