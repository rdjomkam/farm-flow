import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/activites/route";
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/activites/[id]/route";
import { GET as GET_INSTRUCTIONS } from "@/app/api/activites/[id]/instructions/route";
import { GET as GET_AUJOURDHUI } from "@/app/api/activites/aujourdhui/route";
import { POST as POST_COMPLETE } from "@/app/api/activites/[id]/complete/route";
import { GET as GET_MES_TACHES } from "@/app/api/activites/mes-taches/route";
import { GET as GET_MES_TACHES_COUNT } from "@/app/api/activites/mes-taches/count/route";
import { NextRequest } from "next/server";
import { Permission, TypeActivite, StatutActivite, Recurrence } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetActivites = vi.fn();
const mockCreateActivite = vi.fn();
const mockGetActiviteById = vi.fn();
const mockUpdateActivite = vi.fn();
const mockDeleteActivite = vi.fn();
const mockGetActivitesAujourdhui = vi.fn();
const mockCompleteActivite = vi.fn();
const mockGetMyTasks = vi.fn();
const mockGetPendingTaskCount = vi.fn();

vi.mock("@/lib/queries", () => ({
  getActivites: (...args: unknown[]) => mockGetActivites(...args),
  createActivite: (...args: unknown[]) => mockCreateActivite(...args),
  getActiviteById: (...args: unknown[]) => mockGetActiviteById(...args),
  updateActivite: (...args: unknown[]) => mockUpdateActivite(...args),
  deleteActivite: (...args: unknown[]) => mockDeleteActivite(...args),
  getActivitesAujourdhui: (...args: unknown[]) => mockGetActivitesAujourdhui(...args),
  completeActivite: (...args: unknown[]) => mockCompleteActivite(...args),
  getMyTasks: (...args: unknown[]) => mockGetMyTasks(...args),
  getPendingTaskCount: (...args: unknown[]) => mockGetPendingTaskCount(...args),
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
  globalRole: "ADMIN",
  activeSiteId: "site-1",
  siteRole: "ADMIN",
  permissions: [Permission.PLANNING_VOIR, Permission.PLANNING_GERER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_ACTIVITE = {
  id: "activite-1",
  titre: "Distribution aliments matin",
  description: "Donner les granules 3mm",
  typeActivite: TypeActivite.ALIMENTATION,
  statut: StatutActivite.PLANIFIEE,
  recurrence: Recurrence.QUOTIDIEN,
  dateDebut: new Date("2026-03-11T08:00:00Z"),
  dateFin: null,
  vagueId: "vague-1",
  bacId: null,
  assigneAId: null,
  releveId: null,
  dateTerminee: null,
  noteCompletion: null,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  vague: { id: "vague-1", code: "V-2026-001" },
  bac: null,
  assigneA: null,
};

// ---------------------------------------------------------------------------
// GET /api/activites
// ---------------------------------------------------------------------------
describe("GET /api/activites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des activites avec le total", async () => {
    mockGetActivites.mockResolvedValue({ data: [FAKE_ACTIVITE], total: 1 });

    const response = await GET(makeRequest("/api/activites"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
    expect(mockGetActivites).toHaveBeenCalledWith("site-1", {
      dateDebut: undefined,
      dateFin: undefined,
      statut: undefined,
      typeActivite: undefined,
      vagueId: undefined,
      assigneAId: undefined,
    }, expect.any(Object));
  });

  it("passe les filtres a la query", async () => {
    mockGetActivites.mockResolvedValue({ data: [], total: 0 });

    await GET(
      makeRequest(
        "/api/activites?statut=PLANIFIEE&typeActivite=ALIMENTATION&vagueId=vague-1"
      )
    );

    expect(mockGetActivites).toHaveBeenCalledWith("site-1", {
      dateDebut: undefined,
      dateFin: undefined,
      statut: "PLANIFIEE",
      typeActivite: "ALIMENTATION",
      vagueId: "vague-1",
      assigneAId: undefined,
    }, expect.any(Object));
  });

  it("filtre par assigneAId", async () => {
    mockGetActivites.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/activites?assigneAId=user-2"));

    expect(mockGetActivites).toHaveBeenCalledWith("site-1", {
      dateDebut: undefined,
      dateFin: undefined,
      statut: undefined,
      typeActivite: undefined,
      vagueId: undefined,
      assigneAId: "user-2",
    }, expect.any(Object));
  });

  it("filtre par plage de dates", async () => {
    mockGetActivites.mockResolvedValue({ data: [], total: 0 });

    await GET(
      makeRequest("/api/activites?dateDebut=2026-03-01&dateFin=2026-03-31")
    );

    expect(mockGetActivites).toHaveBeenCalledWith("site-1", {
      dateDebut: "2026-03-01",
      dateFin: "2026-03-31",
      statut: undefined,
      typeActivite: undefined,
      vagueId: undefined,
      assigneAId: undefined,
    }, expect.any(Object));
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/activites"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/activites"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetActivites.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/activites"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/activites
// ---------------------------------------------------------------------------
describe("POST /api/activites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    titre: "Distribution aliments matin",
    description: "Granules 3mm",
    typeActivite: TypeActivite.ALIMENTATION,
    dateDebut: "2026-03-11T08:00:00Z",
    recurrence: Recurrence.QUOTIDIEN,
  };

  it("cree une activite (happy path)", async () => {
    mockCreateActivite.mockResolvedValue(FAKE_ACTIVITE);

    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("activite-1");
    expect(mockCreateActivite).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({
        titre: "Distribution aliments matin",
        typeActivite: TypeActivite.ALIMENTATION,
        dateDebut: "2026-03-11T08:00:00Z",
      })
    );
  });

  it("cree une activite avec tous les champs optionnels", async () => {
    mockCreateActivite.mockResolvedValue(FAKE_ACTIVITE);

    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          statut: StatutActivite.PLANIFIEE,
          dateFin: "2026-03-11T09:00:00Z",
          vagueId: "vague-1",
          bacId: "bac-1",
          assigneAId: "user-2",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("retourne 400 si titre manquant", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ ...validBody, titre: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "titre" })])
    );
  });

  it("retourne 400 si titre est vide", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ ...validBody, titre: "   " }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "titre" })])
    );
  });

  it("retourne 400 si typeActivite manquant", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ ...validBody, typeActivite: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "typeActivite" })])
    );
  });

  it("retourne 400 si typeActivite invalide", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ ...validBody, typeActivite: "TYPE_INCONNU" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "typeActivite" })])
    );
  });

  it("retourne 400 si dateDebut manquante", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ ...validBody, dateDebut: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateDebut" })])
    );
  });

  it("retourne 400 si dateDebut n'est pas une date ISO valide", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ ...validBody, dateDebut: "pas-une-date" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateDebut" })])
    );
  });

  it("retourne 400 avec plusieurs erreurs de validation", async () => {
    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify({ typeActivite: "INVALIDE" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission PLANNING_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST(
      makeRequest("/api/activites", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/activites/[id]
// ---------------------------------------------------------------------------
describe("GET /api/activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne l'activite par ID", async () => {
    mockGetActiviteById.mockResolvedValue(FAKE_ACTIVITE);

    const response = await GET_DETAIL(makeRequest("/api/activites/activite-1"), {
      params: Promise.resolve({ id: "activite-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("activite-1");
    expect(mockGetActiviteById).toHaveBeenCalledWith("site-1", "activite-1");
  });

  it("retourne 404 si activite introuvable", async () => {
    mockGetActiviteById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/activites/inexistant"), {
      params: Promise.resolve({ id: "inexistant" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(makeRequest("/api/activites/activite-1"), {
      params: Promise.resolve({ id: "activite-1" }),
    });
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/activites/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour le titre d'une activite", async () => {
    const updated = { ...FAKE_ACTIVITE, titre: "Nouveau titre" };
    mockUpdateActivite.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ titre: "Nouveau titre" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.titre).toBe("Nouveau titre");
  });

  it("complete une activite via PUT statut=TERMINEE avec noteCompletion", async () => {
    const completed = {
      ...FAKE_ACTIVITE,
      typeActivite: TypeActivite.NETTOYAGE,
      statut: StatutActivite.TERMINEE,
      noteCompletion: "Nettoyage effectue avec soin.",
      dateTerminee: new Date(),
    };
    mockCompleteActivite.mockResolvedValue(completed);

    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({
          statut: StatutActivite.TERMINEE,
          noteCompletion: "Nettoyage effectue avec soin.",
        }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutActivite.TERMINEE);
    expect(mockCompleteActivite).toHaveBeenCalledWith("site-1", "activite-1", {
      noteCompletion: "Nettoyage effectue avec soin.",
    });
  });

  it("complete une activite via PUT statut=TERMINEE avec releveId", async () => {
    const completed = {
      ...FAKE_ACTIVITE,
      statut: StatutActivite.TERMINEE,
      releveId: "releve-1",
      dateTerminee: new Date(),
    };
    mockCompleteActivite.mockResolvedValue(completed);

    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({
          statut: StatutActivite.TERMINEE,
          releveId: "releve-1",
        }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutActivite.TERMINEE);
    expect(mockCompleteActivite).toHaveBeenCalledWith("site-1", "activite-1", {
      releveId: "releve-1",
    });
  });

  it("retourne 400 si completion requiert noteCompletion absente (type non-releve)", async () => {
    mockCompleteActivite.mockRejectedValue(
      new Error("Une note de completion (minimum 10 caracteres) est requise pour ce type d'activite")
    );

    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutActivite.TERMINEE }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si activite deja terminee lors d'une completion via PUT", async () => {
    mockCompleteActivite.mockRejectedValue(
      new Error("Seules les activites PLANIFIEE ou EN_RETARD peuvent etre completees")
    );

    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutActivite.TERMINEE, noteCompletion: "test" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si titre vide en update", async () => {
    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ titre: "" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "titre" })])
    );
  });

  it("retourne 400 si statut invalide en update", async () => {
    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ statut: "STATUT_INCONNU" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "statut" })])
    );
  });

  it("retourne 400 si dateDebut invalide en update", async () => {
    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ dateDebut: "pas-une-date" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateDebut" })])
    );
  });

  it("retourne 400 si dateFin invalide en update", async () => {
    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ dateFin: "pas-une-date" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateFin" })])
    );
  });

  it("retourne 404 si activite introuvable", async () => {
    mockUpdateActivite.mockRejectedValue(new Error("Activite introuvable"));

    const response = await PUT(
      makeRequest("/api/activites/inexistant", {
        method: "PUT",
        body: JSON.stringify({ titre: "Test" }),
      }),
      { params: Promise.resolve({ id: "inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PUT(
      makeRequest("/api/activites/activite-1", {
        method: "PUT",
        body: JSON.stringify({ titre: "Test" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/activites/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime une activite", async () => {
    mockDeleteActivite.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/activites/activite-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteActivite).toHaveBeenCalledWith("site-1", "activite-1");
  });

  it("retourne 404 si activite introuvable", async () => {
    mockDeleteActivite.mockRejectedValue(new Error("Activite introuvable"));

    const response = await DELETE(
      makeRequest("/api/activites/inexistant", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(
      makeRequest("/api/activites/activite-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission PLANNING_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/activites/activite-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/activites/[id]/instructions
// ---------------------------------------------------------------------------
describe("GET /api/activites/[id]/instructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne les instructions detaillees d'une activite auto-generee", async () => {
    const activiteAvecInstructions = {
      ...FAKE_ACTIVITE,
      instructionsDetaillees:
        "## Instructions\n\nDistribuer **2,50 kg** d'aliment granules 3mm.\n\nVague : V-2026-001.",
      conseilIA: "FCR élevé : réduire la ration de 10%.",
      produitRecommandeId: "produit-1",
      quantiteRecommandee: 2500,
      priorite: 2,
      phaseElevage: "GROSSISSEMENT",
    };
    mockGetActiviteById.mockResolvedValue(activiteAvecInstructions);

    const response = await GET_INSTRUCTIONS(
      makeRequest("/api/activites/activite-1/instructions"),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("activite-1");
    expect(data.titre).toBe("Distribution aliments matin");
    expect(data.instructions).toContain("2,50 kg");
    expect(data.conseilIA).toBe("FCR élevé : réduire la ration de 10%.");
    expect(data.produitRecommandeId).toBe("produit-1");
    expect(data.quantiteRecommandee).toBe(2500);
    expect(data.priorite).toBe(2);
    expect(data.phaseElevage).toBe("GROSSISSEMENT");
    expect(mockGetActiviteById).toHaveBeenCalledWith("site-1", "activite-1");
  });

  it("retourne instructions=null pour une activite sans template", async () => {
    mockGetActiviteById.mockResolvedValue(FAKE_ACTIVITE);

    const response = await GET_INSTRUCTIONS(
      makeRequest("/api/activites/activite-1/instructions"),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.instructions).toBeNull();
    expect(data.conseilIA).toBeNull();
  });

  it("retourne 404 si activite introuvable", async () => {
    mockGetActiviteById.mockResolvedValue(null);

    const response = await GET_INSTRUCTIONS(
      makeRequest("/api/activites/inexistant/instructions"),
      { params: Promise.resolve({ id: "inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_INSTRUCTIONS(
      makeRequest("/api/activites/activite-1/instructions"),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission PLANNING_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_INSTRUCTIONS(
      makeRequest("/api/activites/activite-1/instructions"),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetActiviteById.mockRejectedValue(new Error("DB error"));

    const response = await GET_INSTRUCTIONS(
      makeRequest("/api/activites/activite-1/instructions"),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/activites/aujourdhui
// ---------------------------------------------------------------------------
describe("GET /api/activites/aujourdhui", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne les activites du jour", async () => {
    mockGetActivitesAujourdhui.mockResolvedValue([FAKE_ACTIVITE]);

    const response = await GET_AUJOURDHUI(makeRequest("/api/activites/aujourdhui"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetActivitesAujourdhui).toHaveBeenCalledWith("site-1");
  });

  it("retourne une liste vide si aucune activite aujourd'hui", async () => {
    mockGetActivitesAujourdhui.mockResolvedValue([]);

    const response = await GET_AUJOURDHUI(makeRequest("/api/activites/aujourdhui"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_AUJOURDHUI(makeRequest("/api/activites/aujourdhui"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_AUJOURDHUI(makeRequest("/api/activites/aujourdhui"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetActivitesAujourdhui.mockRejectedValue(new Error("DB error"));

    const response = await GET_AUJOURDHUI(makeRequest("/api/activites/aujourdhui"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/activites/[id]/complete
// ---------------------------------------------------------------------------
describe("POST /api/activites/[id]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("complete une activite avec noteCompletion (type non-releve)", async () => {
    const completed = {
      ...FAKE_ACTIVITE,
      typeActivite: TypeActivite.NETTOYAGE,
      statut: StatutActivite.TERMINEE,
      noteCompletion: "Nettoyage effectue avec soin",
      dateTerminee: new Date(),
    };
    mockCompleteActivite.mockResolvedValue(completed);

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({ noteCompletion: "Nettoyage effectue avec soin" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutActivite.TERMINEE);
    expect(data.noteCompletion).toBe("Nettoyage effectue avec soin");
    expect(mockCompleteActivite).toHaveBeenCalledWith("site-1", "activite-1", {
      noteCompletion: "Nettoyage effectue avec soin",
    });
  });

  it("complete une activite avec releveId (type releve-compatible)", async () => {
    const completed = {
      ...FAKE_ACTIVITE,
      statut: StatutActivite.TERMINEE,
      releveId: "releve-1",
      dateTerminee: new Date(),
    };
    mockCompleteActivite.mockResolvedValue(completed);

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({ releveId: "releve-1" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutActivite.TERMINEE);
    expect(mockCompleteActivite).toHaveBeenCalledWith("site-1", "activite-1", {
      releveId: "releve-1",
    });
  });

  it("retourne 400 si noteCompletion requise mais absente", async () => {
    mockCompleteActivite.mockRejectedValue(
      new Error("noteCompletion requis pour ce type d'activite")
    );

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si activite introuvable", async () => {
    mockCompleteActivite.mockRejectedValue(
      new Error("Activite introuvable")
    );

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({ noteCompletion: "Done" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 400 si activite deja terminee (pas PLANIFIEE/EN_RETARD)", async () => {
    mockCompleteActivite.mockRejectedValue(
      new Error("Seules les activites PLANIFIEE ou EN_RETARD peuvent etre completees")
    );

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({ noteCompletion: "test" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({ noteCompletion: "test" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST_COMPLETE(
      makeRequest("/api/activites/activite-1", {
        method: "POST",
        body: JSON.stringify({ noteCompletion: "test" }),
      }),
      { params: Promise.resolve({ id: "activite-1" }) }
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/activites/mes-taches
// ---------------------------------------------------------------------------
describe("GET /api/activites/mes-taches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne les taches de l'utilisateur connecte", async () => {
    const tasks = [FAKE_ACTIVITE, { ...FAKE_ACTIVITE, id: "activite-2" }];
    mockGetMyTasks.mockResolvedValue(tasks);

    const response = await GET_MES_TACHES(makeRequest("/api/activites/mes-taches"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(mockGetMyTasks).toHaveBeenCalledWith("site-1", "user-1");
  });

  it("retourne une liste vide si aucune tache", async () => {
    mockGetMyTasks.mockResolvedValue([]);

    const response = await GET_MES_TACHES(makeRequest("/api/activites/mes-taches"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_MES_TACHES(makeRequest("/api/activites/mes-taches"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_MES_TACHES(makeRequest("/api/activites/mes-taches"));
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/activites/mes-taches/count
// ---------------------------------------------------------------------------
describe("GET /api/activites/mes-taches/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le nombre de taches en attente", async () => {
    mockGetPendingTaskCount.mockResolvedValue(5);

    const response = await GET_MES_TACHES_COUNT(makeRequest("/api/activites/mes-taches/count"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(5);
    expect(mockGetPendingTaskCount).toHaveBeenCalledWith("site-1", "user-1");
  });

  it("retourne 0 si aucune tache", async () => {
    mockGetPendingTaskCount.mockResolvedValue(0);

    const response = await GET_MES_TACHES_COUNT(makeRequest("/api/activites/mes-taches/count"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_MES_TACHES_COUNT(makeRequest("/api/activites/mes-taches/count"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_MES_TACHES_COUNT(makeRequest("/api/activites/mes-taches/count"));
    expect(response.status).toBe(403);
  });
});
