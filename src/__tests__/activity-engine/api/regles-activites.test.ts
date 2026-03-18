/**
 * Tests API — /api/regles-activites (Sprint 21, Story S15-10)
 *
 * Couvre :
 *   GET  /api/regles-activites     — liste site + globales
 *   POST /api/regles-activites     — creation avec validation
 *   GET  /api/regles-activites/[id] — detail
 *   PUT  /api/regles-activites/[id] — interdit sur regles globales
 *   DELETE /api/regles-activites/[id] — interdit sur regles globales
 */

import { NextRequest } from "next/server";
import { TypeActivite, TypeDeclencheur, Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReglesActivites = vi.fn();
const mockCreateRegleActivite = vi.fn();
const mockGetRegleActiviteById = vi.fn();
const mockUpdateRegleActivite = vi.fn();
const mockDeleteRegleActivite = vi.fn();

vi.mock("@/lib/queries/regles-activites", () => ({
  getReglesActivites: (...args: unknown[]) => mockGetReglesActivites(...args),
  createRegleActivite: (...args: unknown[]) => mockCreateRegleActivite(...args),
  getRegleActiviteById: (...args: unknown[]) => mockGetRegleActiviteById(...args),
  updateRegleActivite: (...args: unknown[]) => mockUpdateRegleActivite(...args),
  deleteRegleActivite: (...args: unknown[]) => mockDeleteRegleActivite(...args),
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

vi.mock("@/lib/regles-activites-constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/regles-activites-constants")>();
  return {
    ...actual,
    validateTemplatePlaceholders: vi.fn().mockReturnValue({ valid: true, unknown: [] }),
  };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  activeSiteId: "site-1",
  permissions: Object.values(Permission),
  email: "admin@test.com",
  phone: null,
  name: "Admin",
  globalRole: "ADMIN",
  siteRoleId: "role-1",
  siteRoleName: "Administrateur",
};

const FAKE_REGLE = {
  id: "regle-1",
  nom: "Biometrie hebdomadaire",
  description: null,
  typeActivite: TypeActivite.BIOMETRIE,
  typeDeclencheur: TypeDeclencheur.RECURRENT,
  conditionValeur: null,
  conditionValeur2: null,
  phaseMin: null,
  phaseMax: null,
  intervalleJours: 7,
  titreTemplate: "Biometrie semaine {semaine}",
  descriptionTemplate: null,
  instructionsTemplate: null,
  priorite: 5,
  isActive: true,
  firedOnce: false,
  siteId: "site-1",
  userId: "user-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  site: { id: "site-1", name: "Ferme Test" },
  user: { id: "user-1", name: "Admin" },
  _count: { activites: 0 },
};

const FAKE_REGLE_GLOBALE = {
  ...FAKE_REGLE,
  id: "regle-global",
  nom: "Regle globale DKFarm",
  siteId: null,
  userId: null,
  site: null,
  user: null,
};

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// Imports des routes
// ---------------------------------------------------------------------------

import { GET as GET_LIST, POST } from "@/app/api/regles-activites/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "@/app/api/regles-activites/[id]/route";

// ---------------------------------------------------------------------------
// GET /api/regles-activites
// ---------------------------------------------------------------------------

describe("GET /api/regles-activites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReglesActivites.mockResolvedValue([FAKE_REGLE, FAKE_REGLE_GLOBALE]);
  });

  it("retourne 200 avec la liste des regles (site + globales)", async () => {
    const response = await GET_LIST(makeRequest("/api/regles-activites"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.regles).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("appelle getReglesActivites avec le siteId du contexte auth", async () => {
    await GET_LIST(makeRequest("/api/regles-activites"));
    expect(mockGetReglesActivites).toHaveBeenCalledWith("site-1", expect.any(Object));
  });

  it("filtre par typeActivite si fourni en query param", async () => {
    mockGetReglesActivites.mockResolvedValue([FAKE_REGLE]);
    const response = await GET_LIST(
      makeRequest(`/api/regles-activites?typeActivite=${TypeActivite.BIOMETRIE}`)
    );
    expect(response.status).toBe(200);
    expect(mockGetReglesActivites).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ typeActivite: TypeActivite.BIOMETRIE })
    );
  });

  it("filtre par isActive=true si fourni en query param", async () => {
    await GET_LIST(makeRequest("/api/regles-activites?isActive=true"));
    expect(mockGetReglesActivites).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ isActive: true })
    );
  });

  it("retourne 403 sans permission PLANNING_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await GET_LIST(makeRequest("/api/regles-activites"));
    expect(response.status).toBe(403);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const response = await GET_LIST(makeRequest("/api/regles-activites"));
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/regles-activites
// ---------------------------------------------------------------------------

describe("POST /api/regles-activites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreateRegleActivite.mockResolvedValue(FAKE_REGLE);
  });

  it("retourne 201 avec la regle creee", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Biometrie hebdomadaire",
          typeActivite: TypeActivite.BIOMETRIE,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          titreTemplate: "Biometrie semaine {semaine}",
          intervalleJours: 7,
        }),
      })
    );
    expect(response.status).toBe(201);
  });

  it("retourne 400 si nom manquant", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeActivite: TypeActivite.BIOMETRIE,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          titreTemplate: "Test {semaine}",
          intervalleJours: 7,
        }),
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nom" }),
      ])
    );
  });

  it("retourne 400 si typeActivite manquant", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Test",
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          titreTemplate: "Test {semaine}",
          intervalleJours: 7,
        }),
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "typeActivite" }),
      ])
    );
  });

  it("retourne 400 si typeDeclencheur manquant", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Test",
          typeActivite: TypeActivite.BIOMETRIE,
          titreTemplate: "Test {semaine}",
        }),
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "typeDeclencheur" }),
      ])
    );
  });

  it("retourne 400 si titreTemplate manquant", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Test",
          typeActivite: TypeActivite.BIOMETRIE,
          typeDeclencheur: TypeDeclencheur.CALENDRIER,
          intervalleJours: 7,
        }),
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "titreTemplate" }),
      ])
    );
  });

  it("retourne 400 si intervalleJours manquant pour RECURRENT", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Test Recurrent",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          titreTemplate: "Alimentation {semaine}",
          // intervalleJours manquant
        }),
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "intervalleJours" }),
      ])
    );
  });

  it("retourne 400 si priorite hors [1,10]", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Test",
          typeActivite: TypeActivite.BIOMETRIE,
          typeDeclencheur: TypeDeclencheur.CALENDRIER,
          titreTemplate: "Test {semaine}",
          priorite: 15,
        }),
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "priorite" }),
      ])
    );
  });

  it("retourne 403 sans permission GERER_REGLES_ACTIVITES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: "Test",
          typeActivite: TypeActivite.BIOMETRIE,
          typeDeclencheur: TypeDeclencheur.CALENDRIER,
          titreTemplate: "Test {semaine}",
        }),
      })
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/regles-activites/[id]
// ---------------------------------------------------------------------------

describe("GET /api/regles-activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetRegleActiviteById.mockResolvedValue({
      ...FAKE_REGLE,
      activites: [],
    });
  });

  it("retourne 200 avec la regle", async () => {
    const response = await GET_BY_ID(
      makeRequest("/api/regles-activites/regle-1"),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.regle.id).toBe("regle-1");
  });

  it("permet l'acces aux regles globales (siteId=null)", async () => {
    mockGetRegleActiviteById.mockResolvedValue({
      ...FAKE_REGLE_GLOBALE,
      activites: [],
    });
    const response = await GET_BY_ID(
      makeRequest("/api/regles-activites/regle-global"),
      { params: Promise.resolve({ id: "regle-global" }) }
    );
    expect(response.status).toBe(200);
  });

  it("retourne 404 si regle introuvable", async () => {
    mockGetRegleActiviteById.mockResolvedValue(null);
    const response = await GET_BY_ID(
      makeRequest("/api/regles-activites/regle-xxx"),
      { params: Promise.resolve({ id: "regle-xxx" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 403 sans permission PLANNING_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await GET_BY_ID(
      makeRequest("/api/regles-activites/regle-1"),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/regles-activites/[id] — interdit sur regles globales
// ---------------------------------------------------------------------------

describe("PUT /api/regles-activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne 200 si mise a jour reussie sur une regle du site", async () => {
    mockUpdateRegleActivite.mockResolvedValue({ ...FAKE_REGLE, nom: "Mise a jour" });
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: "Mise a jour" }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(200);
  });

  it("retourne 403 si la regle est globale (message contient 'globales')", async () => {
    mockUpdateRegleActivite.mockRejectedValue(
      new Error("Les regles globales DKFarm ne peuvent pas etre modifiees.")
    );
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-global", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: "Tentative modification" }),
      }),
      { params: Promise.resolve({ id: "regle-global" }) }
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("globales");
  });

  it("retourne 404 si regle introuvable pour ce site", async () => {
    mockUpdateRegleActivite.mockRejectedValue(new Error("Regle introuvable."));
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-xxx", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: "Test" }),
      }),
      { params: Promise.resolve({ id: "regle-xxx" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 400 si titreTemplate est une chaine vide", async () => {
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titreTemplate: "" }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "titreTemplate" }),
      ])
    );
  });

  it("retourne 400 si intervalleJours <= 0", async () => {
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalleJours: -1 }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "intervalleJours" }),
      ])
    );
  });

  it("retourne 403 sans permission GERER_REGLES_ACTIVITES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: "Test" }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/regles-activites/[id] — interdit sur regles globales
// ---------------------------------------------------------------------------

describe("DELETE /api/regles-activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne 200 si suppression reussie sur une regle du site", async () => {
    mockDeleteRegleActivite.mockResolvedValue({ success: true });
    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(200);
  });

  it("retourne 409 si la regle est globale (message contient 'globales')", async () => {
    mockDeleteRegleActivite.mockResolvedValue({ error: "global" });
    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-global", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-global" }) }
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain("globales");
  });

  it("retourne 404 si regle introuvable", async () => {
    mockDeleteRegleActivite.mockRejectedValue(new Error("Regle introuvable."));
    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-xxx" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 403 sans permission GERER_REGLES_ACTIVITES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    expect(response.status).toBe(403);
  });
});
