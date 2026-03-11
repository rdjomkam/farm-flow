import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/reproducteurs/route";
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/reproducteurs/[id]/route";
import { NextRequest } from "next/server";
import { Permission, SexeReproducteur, StatutReproducteur } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReproducteurs = vi.fn();
const mockCreateReproducteur = vi.fn();
const mockGetReproducteurById = vi.fn();
const mockUpdateReproducteur = vi.fn();
const mockDeleteReproducteur = vi.fn();

vi.mock("@/lib/queries/reproducteurs", () => ({
  getReproducteurs: (...args: unknown[]) => mockGetReproducteurs(...args),
  createReproducteur: (...args: unknown[]) => mockCreateReproducteur(...args),
  getReproducteurById: (...args: unknown[]) => mockGetReproducteurById(...args),
  updateReproducteur: (...args: unknown[]) => mockUpdateReproducteur(...args),
  deleteReproducteur: (...args: unknown[]) => mockDeleteReproducteur(...args),
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

const FAKE_REPRODUCTEUR = {
  id: "rep-1",
  code: "REP-F-001",
  sexe: SexeReproducteur.FEMELLE,
  poids: 1200,
  age: 18,
  origine: "Ecloserie Douala",
  statut: StatutReproducteur.ACTIF,
  dateAcquisition: new Date("2024-06-01"),
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { pontesAsFemelle: 2, pontesAsMale: 0 },
};

// ---------------------------------------------------------------------------
// GET /api/reproducteurs
// ---------------------------------------------------------------------------
describe("GET /api/reproducteurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des reproducteurs avec le total", async () => {
    mockGetReproducteurs.mockResolvedValue([FAKE_REPRODUCTEUR]);

    const response = await GET(makeRequest("/api/reproducteurs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reproducteurs).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetReproducteurs).toHaveBeenCalledWith("site-1", {
      sexe: undefined,
      statut: undefined,
      search: undefined,
    });
  });

  it("passe le filtre sexe valide", async () => {
    mockGetReproducteurs.mockResolvedValue([]);

    await GET(makeRequest("/api/reproducteurs?sexe=FEMELLE"));

    expect(mockGetReproducteurs).toHaveBeenCalledWith("site-1", {
      sexe: SexeReproducteur.FEMELLE,
      statut: undefined,
      search: undefined,
    });
  });

  it("passe le filtre statut valide", async () => {
    mockGetReproducteurs.mockResolvedValue([]);

    await GET(makeRequest("/api/reproducteurs?statut=ACTIF"));

    expect(mockGetReproducteurs).toHaveBeenCalledWith("site-1", {
      sexe: undefined,
      statut: StatutReproducteur.ACTIF,
      search: undefined,
    });
  });

  it("passe le filtre search", async () => {
    mockGetReproducteurs.mockResolvedValue([]);

    await GET(makeRequest("/api/reproducteurs?search=REP-F"));

    expect(mockGetReproducteurs).toHaveBeenCalledWith("site-1", {
      sexe: undefined,
      statut: undefined,
      search: "REP-F",
    });
  });

  it("ignore un sexe invalide", async () => {
    mockGetReproducteurs.mockResolvedValue([]);

    await GET(makeRequest("/api/reproducteurs?sexe=HERMAPHRODITE"));

    expect(mockGetReproducteurs).toHaveBeenCalledWith("site-1", {
      sexe: undefined,
      statut: undefined,
      search: undefined,
    });
  });

  it("ignore un statut invalide", async () => {
    mockGetReproducteurs.mockResolvedValue([]);

    await GET(makeRequest("/api/reproducteurs?statut=INVALIDE"));

    expect(mockGetReproducteurs).toHaveBeenCalledWith("site-1", {
      sexe: undefined,
      statut: undefined,
      search: undefined,
    });
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/reproducteurs"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/reproducteurs"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetReproducteurs.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/reproducteurs"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproducteurs
// ---------------------------------------------------------------------------
describe("POST /api/reproducteurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    code: "REP-F-001",
    sexe: SexeReproducteur.FEMELLE,
    poids: 1200,
    age: 18,
    origine: "Ecloserie Douala",
    dateAcquisition: "2024-06-01T00:00:00.000Z",
    notes: "Bonne reproductrice",
  };

  it("cree un reproducteur avec tous les champs", async () => {
    const created = { ...FAKE_REPRODUCTEUR, id: "rep-new" };
    mockCreateReproducteur.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("rep-new");
    expect(mockCreateReproducteur).toHaveBeenCalledWith("site-1", {
      code: "REP-F-001",
      sexe: SexeReproducteur.FEMELLE,
      poids: 1200,
      age: 18,
      origine: "Ecloserie Douala",
      dateAcquisition: "2024-06-01T00:00:00.000Z",
      notes: "Bonne reproductrice",
    });
  });

  it("cree un reproducteur avec seulement les champs obligatoires", async () => {
    mockCreateReproducteur.mockResolvedValue(FAKE_REPRODUCTEUR);

    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({
          code: "REP-M-001",
          sexe: SexeReproducteur.MALE,
          poids: 900,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateReproducteur).toHaveBeenCalledWith("site-1", {
      code: "REP-M-001",
      sexe: SexeReproducteur.MALE,
      poids: 900,
      age: undefined,
      origine: undefined,
      dateAcquisition: undefined,
      notes: undefined,
    });
  });

  it("retourne 400 si code manquant", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({ sexe: SexeReproducteur.FEMELLE, poids: 1200 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "code" })])
    );
  });

  it("retourne 400 si code est vide", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({ code: "  ", sexe: SexeReproducteur.FEMELLE, poids: 1200 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si sexe manquant", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({ code: "REP-001", poids: 1200 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sexe" })])
    );
  });

  it("retourne 400 si sexe invalide", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({ code: "REP-001", sexe: "NEUTRE", poids: 1200 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sexe" })])
    );
  });

  it("retourne 400 si poids manquant", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({ code: "REP-001", sexe: SexeReproducteur.FEMELLE }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poids" })])
    );
  });

  it("retourne 400 si poids <= 0", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({ code: "REP-001", sexe: SexeReproducteur.FEMELLE, poids: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poids" })])
    );
  });

  it("retourne 400 si age negatif", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({
          code: "REP-001",
          sexe: SexeReproducteur.FEMELLE,
          poids: 1200,
          age: -1,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "age" })])
    );
  });

  it("retourne 400 si dateAcquisition invalide", async () => {
    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify({
          code: "REP-001",
          sexe: SexeReproducteur.FEMELLE,
          poids: 1200,
          dateAcquisition: "pas-une-date",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateAcquisition" })])
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(response.status).toBe(401);
  });

  it("retourne 409 si code deja utilise (erreur query)", async () => {
    mockCreateReproducteur.mockRejectedValue(
      new Error('Le code "REP-F-001" est deja utilise')
    );

    const response = await POST(
      makeRequest("/api/reproducteurs", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproducteurs/[id]
// ---------------------------------------------------------------------------
describe("GET /api/reproducteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le reproducteur par ID", async () => {
    const detail = {
      ...FAKE_REPRODUCTEUR,
      pontesAsFemelle: [],
      pontesAsMale: [],
    };
    mockGetReproducteurById.mockResolvedValue(detail);

    const response = await GET_DETAIL(makeRequest("/api/reproducteurs/rep-1"), {
      params: Promise.resolve({ id: "rep-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("rep-1");
    expect(data.code).toBe("REP-F-001");
    expect(mockGetReproducteurById).toHaveBeenCalledWith("rep-1", "site-1");
  });

  it("retourne 404 si reproducteur introuvable", async () => {
    mockGetReproducteurById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/reproducteurs/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(makeRequest("/api/reproducteurs/rep-1"), {
      params: Promise.resolve({ id: "rep-1" }),
    });

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/reproducteurs/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/reproducteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour un reproducteur", async () => {
    const updated = { ...FAKE_REPRODUCTEUR, poids: 1350, statut: StatutReproducteur.REFORME };
    mockUpdateReproducteur.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/reproducteurs/rep-1", {
        method: "PUT",
        body: JSON.stringify({ poids: 1350, statut: StatutReproducteur.REFORME }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.poids).toBe(1350);
    expect(data.statut).toBe(StatutReproducteur.REFORME);
    expect(mockUpdateReproducteur).toHaveBeenCalledWith("rep-1", "site-1", {
      poids: 1350,
      statut: StatutReproducteur.REFORME,
    });
  });

  it("retourne 400 si code vide", async () => {
    const response = await PUT(
      makeRequest("/api/reproducteurs/rep-1", {
        method: "PUT",
        body: JSON.stringify({ code: "" }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "code" })])
    );
  });

  it("retourne 400 si sexe invalide", async () => {
    const response = await PUT(
      makeRequest("/api/reproducteurs/rep-1", {
        method: "PUT",
        body: JSON.stringify({ sexe: "NEUTRE" }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sexe" })])
    );
  });

  it("retourne 400 si poids <= 0", async () => {
    const response = await PUT(
      makeRequest("/api/reproducteurs/rep-1", {
        method: "PUT",
        body: JSON.stringify({ poids: -100 }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poids" })])
    );
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await PUT(
      makeRequest("/api/reproducteurs/rep-1", {
        method: "PUT",
        body: JSON.stringify({ statut: "INCONNU" }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "statut" })])
    );
  });

  it("retourne 404 si reproducteur introuvable", async () => {
    mockUpdateReproducteur.mockRejectedValue(new Error("Reproducteur introuvable"));

    const response = await PUT(
      makeRequest("/api/reproducteurs/xxx", {
        method: "PUT",
        body: JSON.stringify({ poids: 1000 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PUT(
      makeRequest("/api/reproducteurs/rep-1", {
        method: "PUT",
        body: JSON.stringify({ poids: 1000 }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reproducteurs/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/reproducteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime un reproducteur sans pontes liees", async () => {
    mockDeleteReproducteur.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/reproducteurs/rep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteReproducteur).toHaveBeenCalledWith("rep-1", "site-1");
  });

  it("retourne 404 si reproducteur introuvable", async () => {
    mockDeleteReproducteur.mockRejectedValue(new Error("Reproducteur introuvable"));

    const response = await DELETE(
      makeRequest("/api/reproducteurs/xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si le reproducteur a des pontes liees", async () => {
    mockDeleteReproducteur.mockRejectedValue(
      new Error("Impossible de supprimer : ce reproducteur a 2 ponte(s) liee(s)")
    );

    const response = await DELETE(
      makeRequest("/api/reproducteurs/rep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(
      makeRequest("/api/reproducteurs/rep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/reproducteurs/rep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );

    expect(response.status).toBe(403);
  });
});
