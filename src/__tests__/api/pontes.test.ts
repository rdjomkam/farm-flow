import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/pontes/route";
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/pontes/[id]/route";
import { NextRequest } from "next/server";
import { Permission, StatutPonte } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPontes = vi.fn();
const mockCreatePonte = vi.fn();
const mockGetPonteById = vi.fn();
const mockUpdatePonte = vi.fn();
const mockDeletePonte = vi.fn();

vi.mock("@/lib/queries/pontes", () => ({
  getPontes: (...args: unknown[]) => mockGetPontes(...args),
  createPonte: (...args: unknown[]) => mockCreatePonte(...args),
  getPonteById: (...args: unknown[]) => mockGetPonteById(...args),
  updatePonte: (...args: unknown[]) => mockUpdatePonte(...args),
  deletePonte: (...args: unknown[]) => mockDeletePonte(...args),
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

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [
    Permission.ALEVINS_VOIR,
    Permission.ALEVINS_GERER,
    Permission.ALEVINS_CREER,
    Permission.ALEVINS_MODIFIER,
    Permission.ALEVINS_SUPPRIMER,
  ],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_PONTE = {
  id: "ponte-1",
  code: "PONTE-2026-001",
  femelleId: "rep-f-1",
  maleId: "rep-m-1",
  datePonte: new Date("2026-03-01"),
  nombreOeufs: 5000,
  tauxFecondation: 75.5,
  statut: StatutPonte.EN_COURS,
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  femelle: { id: "rep-f-1", code: "REP-F-001", sexe: "FEMELLE", poids: 1200 },
  male: { id: "rep-m-1", code: "REP-M-001", sexe: "MALE", poids: 900 },
  _count: { lots: 0 },
};

// ---------------------------------------------------------------------------
// GET /api/pontes
// ---------------------------------------------------------------------------
describe("GET /api/pontes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des pontes avec le total", async () => {
    mockGetPontes.mockResolvedValue({ data: [FAKE_PONTE], total: 1 });

    const response = await GET(makeRequest("/api/pontes"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetPontes).toHaveBeenCalledWith(
      "site-1",
      { statut: undefined, femelleId: undefined, search: undefined },
      { limit: 50, offset: 0 }
    );
  });

  it("passe le filtre statut valide", async () => {
    mockGetPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/pontes?statut=TERMINEE"));

    expect(mockGetPontes).toHaveBeenCalledWith(
      "site-1",
      { statut: StatutPonte.TERMINEE, femelleId: undefined, search: undefined },
      { limit: 50, offset: 0 }
    );
  });

  it("passe le filtre femelleId", async () => {
    mockGetPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/pontes?femelleId=rep-f-1"));

    expect(mockGetPontes).toHaveBeenCalledWith(
      "site-1",
      { statut: undefined, femelleId: "rep-f-1", search: undefined },
      { limit: 50, offset: 0 }
    );
  });

  it("passe le filtre search", async () => {
    mockGetPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/pontes?search=PONTE-2026"));

    expect(mockGetPontes).toHaveBeenCalledWith(
      "site-1",
      { statut: undefined, femelleId: undefined, search: "PONTE-2026" },
      { limit: 50, offset: 0 }
    );
  });

  it("ignore un statut invalide", async () => {
    mockGetPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/pontes?statut=INVALIDE"));

    expect(mockGetPontes).toHaveBeenCalledWith(
      "site-1",
      { statut: undefined, femelleId: undefined, search: undefined },
      { limit: 50, offset: 0 }
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/pontes"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/pontes"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetPontes.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/pontes"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/pontes
// ---------------------------------------------------------------------------
describe("POST /api/pontes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    code: "PONTE-2026-001",
    femelleId: "rep-f-1",
    maleId: "rep-m-1",
    datePonte: "2026-03-01T00:00:00.000Z",
    nombreOeufs: 5000,
    tauxFecondation: 75.5,
    notes: "Ponte de printemps",
  };

  it("cree une ponte avec tous les champs", async () => {
    const created = { ...FAKE_PONTE, id: "ponte-new" };
    mockCreatePonte.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("ponte-new");
    expect(mockCreatePonte).toHaveBeenCalledWith("site-1", {
      code: "PONTE-2026-001",
      femelleId: "rep-f-1",
      maleId: "rep-m-1",
      datePonte: "2026-03-01T00:00:00.000Z",
      nombreOeufs: 5000,
      tauxFecondation: 75.5,
      notes: "Ponte de printemps",
    });
  });

  it("cree une ponte avec seulement les champs obligatoires", async () => {
    mockCreatePonte.mockResolvedValue(FAKE_PONTE);

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({
          code: "PONTE-MIN",
          femelleId: "rep-f-1",
          datePonte: "2026-03-01T00:00:00.000Z",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreatePonte).toHaveBeenCalledWith("site-1", {
      code: "PONTE-MIN",
      femelleId: "rep-f-1",
      maleId: undefined,
      datePonte: "2026-03-01T00:00:00.000Z",
      nombreOeufs: undefined,
      tauxFecondation: undefined,
      notes: undefined,
    });
  });

  it("retourne 400 si code manquant", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({ femelleId: "rep-f-1", datePonte: "2026-03-01T00:00:00.000Z" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "code" })])
    );
  });

  it("retourne 400 si femelleId manquant", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({ code: "PONTE-001", datePonte: "2026-03-01T00:00:00.000Z" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "femelleId" })])
    );
  });

  it("retourne 400 si femelleId est vide", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({
          code: "PONTE-001",
          femelleId: "  ",
          datePonte: "2026-03-01T00:00:00.000Z",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si datePonte manquante", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({ code: "PONTE-001", femelleId: "rep-f-1" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "datePonte" })])
    );
  });

  it("retourne 400 si datePonte invalide", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({
          code: "PONTE-001",
          femelleId: "rep-f-1",
          datePonte: "pas-une-date",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si tauxFecondation > 100", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          tauxFecondation: 105,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "tauxFecondation" })])
    );
  });

  it("retourne 400 si tauxFecondation < 0", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          tauxFecondation: -5,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "tauxFecondation" })])
    );
  });

  it("accepte un tauxFecondation de 0", async () => {
    mockCreatePonte.mockResolvedValue({ ...FAKE_PONTE, tauxFecondation: 0 });

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, tauxFecondation: 0 }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("accepte un tauxFecondation de 100", async () => {
    mockCreatePonte.mockResolvedValue({ ...FAKE_PONTE, tauxFecondation: 100 });

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, tauxFecondation: 100 }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("retourne 400 si nombreOeufs <= 0", async () => {
    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, nombreOeufs: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nombreOeufs" })])
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(response.status).toBe(401);
  });

  it("retourne 409 si code deja utilise (erreur query)", async () => {
    mockCreatePonte.mockRejectedValue(
      new Error('Le code "PONTE-2026-001" est deja utilise')
    );

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 409 si la femelle n'est pas ACTIF", async () => {
    mockCreatePonte.mockRejectedValue(
      new Error("La femelle n'est pas ACTIF")
    );

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 404 si la femelle est introuvable", async () => {
    mockCreatePonte.mockRejectedValue(
      new Error("Reproducteur femelle introuvable")
    );

    const response = await POST(
      makeRequest("/api/pontes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/pontes/[id]
// ---------------------------------------------------------------------------
describe("GET /api/pontes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la ponte par ID avec ses details", async () => {
    const detail = { ...FAKE_PONTE, lots: [] };
    mockGetPonteById.mockResolvedValue(detail);

    const response = await GET_DETAIL(makeRequest("/api/pontes/ponte-1"), {
      params: Promise.resolve({ id: "ponte-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("ponte-1");
    expect(data.code).toBe("PONTE-2026-001");
    expect(mockGetPonteById).toHaveBeenCalledWith("ponte-1", "site-1");
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockGetPonteById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/pontes/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(makeRequest("/api/pontes/ponte-1"), {
      params: Promise.resolve({ id: "ponte-1" }),
    });

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/pontes/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/pontes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour une ponte", async () => {
    const updated = { ...FAKE_PONTE, statut: StatutPonte.TERMINEE, nombreOeufs: 6000 };
    mockUpdatePonte.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/pontes/ponte-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutPonte.TERMINEE, nombreOeufs: 6000 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutPonte.TERMINEE);
    expect(data.nombreOeufs).toBe(6000);
  });

  it("retourne 400 si tauxFecondation hors bornes (> 100)", async () => {
    const response = await PUT(
      makeRequest("/api/pontes/ponte-1", {
        method: "PUT",
        body: JSON.stringify({ tauxFecondation: 110 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "tauxFecondation" })])
    );
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await PUT(
      makeRequest("/api/pontes/ponte-1", {
        method: "PUT",
        body: JSON.stringify({ statut: "INVALIDE" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "statut" })])
    );
  });

  it("retourne 400 si datePonte invalide", async () => {
    const response = await PUT(
      makeRequest("/api/pontes/ponte-1", {
        method: "PUT",
        body: JSON.stringify({ datePonte: "pas-une-date" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "datePonte" })])
    );
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockUpdatePonte.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await PUT(
      makeRequest("/api/pontes/xxx", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutPonte.TERMINEE }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PUT(
      makeRequest("/api/pontes/ponte-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutPonte.TERMINEE }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pontes/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/pontes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime une ponte sans lots lies", async () => {
    mockDeletePonte.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeletePonte).toHaveBeenCalledWith("ponte-1", "site-1");
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockDeletePonte.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await DELETE(
      makeRequest("/api/pontes/xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si la ponte a des lots d'alevins lies", async () => {
    mockDeletePonte.mockRejectedValue(
      new Error("Impossible de supprimer : cette ponte a 3 lot(s) d'alevins lie(s)")
    );

    const response = await DELETE(
      makeRequest("/api/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(
      makeRequest("/api/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(403);
  });
});
