import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/releves/route";
import { GET as GET_BY_ID, PUT } from "@/app/api/releves/[id]/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReleves = vi.fn();
const mockCreateReleve = vi.fn();
const mockGetReleveById = vi.fn();
const mockUpdateReleve = vi.fn();

vi.mock("@/lib/queries/releves", () => ({
  getReleves: (...args: unknown[]) => mockGetReleves(...args),
  createReleve: (...args: unknown[]) => mockCreateReleve(...args),
  getReleveById: (...args: unknown[]) => mockGetReleveById(...args),
  updateReleve: (...args: unknown[]) => mockUpdateReleve(...args),
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
  permissions: [Permission.RELEVES_VOIR, Permission.RELEVES_CREER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const now = new Date("2026-03-08T10:00:00Z");

// ---------------------------------------------------------------------------
// GET /api/releves
// ---------------------------------------------------------------------------
describe("GET /api/releves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne tous les releves sans filtre", async () => {
    mockGetReleves.mockResolvedValue({
      releves: [
        { id: "rel-1", typeReleve: "BIOMETRIE", date: now },
        { id: "rel-2", typeReleve: "MORTALITE", date: now },
      ],
      total: 2,
    });

    const request = makeRequest("/api/releves");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.releves).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("filtre les releves par vagueId", async () => {
    mockGetReleves.mockResolvedValue({ releves: [], total: 0 });

    const request = makeRequest("/api/releves?vagueId=vague-1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ vagueId: "vague-1" })
    );
  });

  it("filtre les releves par typeReleve", async () => {
    mockGetReleves.mockResolvedValue({ releves: [], total: 0 });

    const request = makeRequest("/api/releves?typeReleve=BIOMETRIE");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ typeReleve: "BIOMETRIE" })
    );
  });

  it("filtre par bacId et plage de dates", async () => {
    mockGetReleves.mockResolvedValue({ releves: [], total: 0 });

    const request = makeRequest(
      "/api/releves?bacId=bac-1&dateFrom=2026-01-01&dateTo=2026-03-01"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        bacId: "bac-1",
        dateFrom: "2026-01-01",
        dateTo: "2026-03-01",
      })
    );
  });

  it("retourne 400 pour un typeReleve invalide", async () => {
    const request = makeRequest("/api/releves?typeReleve=INVALIDE");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("Type de releve invalide");
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Biometrie
// ---------------------------------------------------------------------------
describe("POST /api/releves — Biometrie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBiometrie = {
typeReleve: "BIOMETRIE",
    vagueId: "vague-1",
    bacId: "bac-1",
    poidsMoyen: 52.3,
    tailleMoyenne: 16.1,
    echantillonCount: 25,
  };

  it("cree un releve biometrie valide", async () => {
    const createdReleve = { id: "rel-new", ...validBiometrie, createdAt: now };
    mockCreateReleve.mockResolvedValue(createdReleve);

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(validBiometrie),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.typeReleve).toBe("BIOMETRIE");
    expect(data.poidsMoyen).toBe(52.3);
    expect(mockCreateReleve).toHaveBeenCalledWith("site-1", "user-1", expect.objectContaining({
      typeReleve: "BIOMETRIE",
      poidsMoyen: 52.3,
    }), undefined); // Sprint 13 : 4eme arg activiteId (undefined quand absent)
  });

  it("retourne 400 si poidsMoyen manquant pour biometrie", async () => {
    const body = { ...validBiometrie, poidsMoyen: undefined };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "poidsMoyen")).toBe(true);
  });

  it("retourne 400 si tailleMoyenne manquante pour biometrie", async () => {
    const body = { ...validBiometrie, tailleMoyenne: undefined };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "tailleMoyenne")).toBe(
      true
    );
  });

  it("retourne 400 si echantillonCount n'est pas un entier positif", async () => {
    const body = { ...validBiometrie, echantillonCount: 0 };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "echantillonCount")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Mortalite
// ---------------------------------------------------------------------------
describe("POST /api/releves — Mortalite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validMortalite = {
typeReleve: "MORTALITE",
    vagueId: "vague-1",
    bacId: "bac-1",
    nombreMorts: 5,
    causeMortalite: "MALADIE",
  };

  it("cree un releve mortalite valide", async () => {
    mockCreateReleve.mockResolvedValue({ id: "rel-m", ...validMortalite });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(validMortalite),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.typeReleve).toBe("MORTALITE");
    expect(data.nombreMorts).toBe(5);
  });

  it("retourne 400 si causeMortalite invalide", async () => {
    const body = { ...validMortalite, causeMortalite: "VOLCAN" };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "causeMortalite")
    ).toBe(true);
  });

  it("retourne 400 si nombreMorts est negatif", async () => {
    const body = { ...validMortalite, nombreMorts: -1 };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "nombreMorts")).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Alimentation
// ---------------------------------------------------------------------------
describe("POST /api/releves — Alimentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validAlimentation = {
typeReleve: "ALIMENTATION",
    vagueId: "vague-1",
    bacId: "bac-1",
    quantiteAliment: 2.5,
    typeAliment: "COMMERCIAL",
    frequenceAliment: 3,
  };

  it("cree un releve alimentation valide", async () => {
    mockCreateReleve.mockResolvedValue({ id: "rel-a", ...validAlimentation });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(validAlimentation),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.typeReleve).toBe("ALIMENTATION");
    expect(data.quantiteAliment).toBe(2.5);
  });

  it("retourne 400 si typeAliment invalide", async () => {
    const body = { ...validAlimentation, typeAliment: "VEGETAL" };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "typeAliment")).toBe(
      true
    );
  });

  it("retourne 400 si quantiteAliment est 0", async () => {
    const body = { ...validAlimentation, quantiteAliment: 0 };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "quantiteAliment")
    ).toBe(true);
  });

  it("retourne 400 si frequenceAliment n'est pas un entier", async () => {
    const body = { ...validAlimentation, frequenceAliment: 2.5 };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "frequenceAliment")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Qualite Eau
// ---------------------------------------------------------------------------
describe("POST /api/releves — Qualite Eau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree un releve qualite eau valide (champs optionnels)", async () => {
    const body = {
    typeReleve: "QUALITE_EAU",
      vagueId: "vague-1",
      bacId: "bac-1",
      temperature: 28.5,
      ph: 7.2,
      oxygene: 5.8,
      ammoniac: 0.02,
    };
    mockCreateReleve.mockResolvedValue({ id: "rel-q", ...body });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.typeReleve).toBe("QUALITE_EAU");
    expect(data.temperature).toBe(28.5);
  });

  it("cree un releve qualite eau sans champs optionnels", async () => {
    const body = {
    typeReleve: "QUALITE_EAU",
      vagueId: "vague-1",
      bacId: "bac-1",
    };
    mockCreateReleve.mockResolvedValue({ id: "rel-q2", ...body });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Comptage
// ---------------------------------------------------------------------------
describe("POST /api/releves — Comptage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validComptage = {
typeReleve: "COMPTAGE",
    vagueId: "vague-1",
    bacId: "bac-1",
    nombreCompte: 450,
    methodeComptage: "DIRECT",
  };

  it("cree un releve comptage valide", async () => {
    mockCreateReleve.mockResolvedValue({ id: "rel-c", ...validComptage });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(validComptage),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nombreCompte).toBe(450);
    expect(data.methodeComptage).toBe("DIRECT");
  });

  it("retourne 400 si methodeComptage invalide", async () => {
    const body = { ...validComptage, methodeComptage: "RADAR" };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "methodeComptage")
    ).toBe(true);
  });

  it("retourne 400 si nombreCompte est negatif", async () => {
    const body = { ...validComptage, nombreCompte: -1 };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "nombreCompte")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Observation
// ---------------------------------------------------------------------------
describe("POST /api/releves — Observation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree un releve observation valide", async () => {
    const body = {
    typeReleve: "OBSERVATION",
      vagueId: "vague-1",
      bacId: "bac-1",
      description: "Comportement normal, poissons actifs",
    };
    mockCreateReleve.mockResolvedValue({ id: "rel-o", ...body });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.description).toBe("Comportement normal, poissons actifs");
  });

  it("retourne 400 si description vide pour observation", async () => {
    const body = {
    typeReleve: "OBSERVATION",
      vagueId: "vague-1",
      bacId: "bac-1",
      description: "  ",
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "description")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Validation commune
// ---------------------------------------------------------------------------
describe("POST /api/releves — Validation commune", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne 400 si typeReleve est manquant", async () => {
    const body = {
    vagueId: "vague-1",
      bacId: "bac-1",
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "typeReleve")).toBe(
      true
    );
  });

  it("retourne 400 si typeReleve est invalide", async () => {
    const body = {
    typeReleve: "PHOTOSYNTHESE",
      vagueId: "vague-1",
      bacId: "bac-1",
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "typeReleve")).toBe(
      true
    );
  });

  it("accepte un POST sans date (date auto-generee par le backend)", async () => {
    const body = {
      typeReleve: "BIOMETRIE",
      vagueId: "vague-1",
      bacId: "bac-1",
      poidsMoyen: 50,
      tailleMoyenne: 15,
      echantillonCount: 20,
    };
    mockCreateReleve.mockResolvedValue({ id: "rel-auto", ...body, date: new Date() });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.not.objectContaining({ date: expect.anything() }),
      undefined // Sprint 13 : 4eme arg activiteId (undefined quand absent)
    );
  });

  it("retourne 400 si vagueId est manquant", async () => {
    const body = {
    typeReleve: "BIOMETRIE",
      bacId: "bac-1",
      poidsMoyen: 50,
      tailleMoyenne: 15,
      echantillonCount: 20,
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "vagueId")).toBe(true);
  });

  it("retourne 400 si bacId est manquant", async () => {
    const body = {
    typeReleve: "BIOMETRIE",
      vagueId: "vague-1",
      poidsMoyen: 50,
      tailleMoyenne: 15,
      echantillonCount: 20,
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "bacId")).toBe(true);
  });

  it("retourne 404 si la vague est introuvable", async () => {
    mockCreateReleve.mockRejectedValue(new Error("Vague introuvable"));

    const body = {
    typeReleve: "BIOMETRIE",
      vagueId: "vague-unknown",
      bacId: "bac-1",
      poidsMoyen: 50,
      tailleMoyenne: 15,
      echantillonCount: 20,
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 409 si le bac n'appartient pas a la vague", async () => {
    mockCreateReleve.mockRejectedValue(
      new Error("Ce bac n'appartient pas a la vague selectionnee")
    );

    const body = {
    typeReleve: "BIOMETRIE",
      vagueId: "vague-1",
      bacId: "bac-wrong",
      poidsMoyen: 50,
      tailleMoyenne: 15,
      echantillonCount: 20,
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("n'appartient pas");
  });

  it("retourne 409 si la vague est cloturee", async () => {
    mockCreateReleve.mockRejectedValue(
      new Error("Impossible d'ajouter un releve a une vague cloturee")
    );

    const body = {
    typeReleve: "OBSERVATION",
      vagueId: "vague-closed",
      bacId: "bac-1",
      description: "Test",
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("cloturee");
  });
});

// ---------------------------------------------------------------------------
// Non-regression BUG-011 : POST /api/releves avec consommations → 201
// ---------------------------------------------------------------------------
describe("POST /api/releves — avec consommations (non-regression BUG-011)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree un releve alimentation avec consommations et retourne 201", async () => {
    const body = {
      typeReleve: "ALIMENTATION",
      vagueId: "vague-1",
      bacId: "bac-1",
      quantiteAliment: 5,
      typeAliment: "COMMERCIAL",
      frequenceAliment: 2,
      consommations: [
        { produitId: "prod-1", quantite: 3.5 },
        { produitId: "prod-2", quantite: 1.5 },
      ],
    };
    const createdReleve = { id: "rel-conso", ...body };
    mockCreateReleve.mockResolvedValue(createdReleve);

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.typeReleve).toBe("ALIMENTATION");
    // Verifier que createReleve est appele avec les consommations
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({
        typeReleve: "ALIMENTATION",
        consommations: [
          { produitId: "prod-1", quantite: 3.5 },
          { produitId: "prod-2", quantite: 1.5 },
        ],
      }),
      undefined // Sprint 13 : 4eme arg activiteId (undefined quand absent)
    );
  });

  it("cree un releve sans consommations et retourne 201 (non-regression)", async () => {
    const body = {
      typeReleve: "ALIMENTATION",
      vagueId: "vague-1",
      bacId: "bac-1",
      quantiteAliment: 5,
      typeAliment: "COMMERCIAL",
      frequenceAliment: 2,
    };
    mockCreateReleve.mockResolvedValue({ id: "rel-no-conso", ...body });

    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("retourne 409 si stock insuffisant pour une consommation", async () => {
    mockCreateReleve.mockRejectedValue(
      new Error("Stock insuffisant pour \"Aliment Croissance\". Disponible : 2 KG, demande : 10")
    );

    const body = {
      typeReleve: "ALIMENTATION",
      vagueId: "vague-1",
      bacId: "bac-1",
      quantiteAliment: 10,
      typeAliment: "COMMERCIAL",
      frequenceAliment: 2,
      consommations: [{ produitId: "prod-1", quantite: 10 }],
    };
    const request = makeRequest("/api/releves", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("Stock insuffisant");
  });
});

// ---------------------------------------------------------------------------
// Non-regression BUG-016 : GET /api/releves/[id] inclut produit dans consommations
// ---------------------------------------------------------------------------
describe("GET /api/releves/[id] — avec consommations (non-regression BUG-016)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const makeParamsRequest = (id: string) =>
    new NextRequest(new URL(`/api/releves/${id}`, "http://localhost:3000"));

  it("retourne un releve avec ses consommations et le produit associe", async () => {
    const releveAvecConsommations = {
      id: "rel-1",
      typeReleve: "ALIMENTATION",
      vagueId: "vague-1",
      bacId: "bac-1",
      siteId: "site-1",
      quantiteAliment: 5,
      typeAliment: "COMMERCIAL",
      frequenceAliment: 2,
      consommations: [
        {
          id: "conso-1",
          releveId: "rel-1",
          produitId: "prod-1",
          quantite: 3.5,
          siteId: "site-1",
          createdAt: new Date(),
          produit: {
            id: "prod-1",
            nom: "Aliment Croissance 3mm",
            categorie: "ALIMENT",
            unite: "KG",
            stockActuel: 85,
            prixUnitaire: 1200,
          },
        },
      ],
    };
    mockGetReleveById.mockResolvedValue(releveAvecConsommations);

    const request = makeParamsRequest("rel-1");
    const response = await GET_BY_ID(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.consommations).toHaveLength(1);
    // Verifier que le produit est bien inclus (pas seulement produitId)
    expect(data.consommations[0].produit).toBeDefined();
    expect(data.consommations[0].produit.nom).toBe("Aliment Croissance 3mm");
    expect(data.consommations[0].produit.unite).toBe("KG");
    expect(mockGetReleveById).toHaveBeenCalledWith("site-1", "rel-1");
  });

  it("retourne un releve sans consommations (tableau vide)", async () => {
    const releve = {
      id: "rel-2",
      typeReleve: "BIOMETRIE",
      consommations: [],
    };
    mockGetReleveById.mockResolvedValue(releve);

    const request = makeParamsRequest("rel-2");
    const response = await GET_BY_ID(request, { params: Promise.resolve({ id: "rel-2" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.consommations).toHaveLength(0);
  });

  it("retourne 404 si le releve est introuvable", async () => {
    mockGetReleveById.mockResolvedValue(null);

    const request = makeParamsRequest("rel-unknown");
    const response = await GET_BY_ID(request, { params: Promise.resolve({ id: "rel-unknown" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/releves/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/releves/[id]", () => {
  const AUTH_CONTEXT_MODIFIER = {
    userId: "user-1",
    email: "test@dkfarm.cm",
    phone: null,
    name: "Test User",
    globalRole: "PISCICULTEUR",
    activeSiteId: "site-1",
    siteRole: "PISCICULTEUR",
    permissions: [Permission.RELEVES_MODIFIER],
  };

  const makePutRequest = (id: string, body: unknown) =>
    new NextRequest(new URL(`/api/releves/${id}`, "http://localhost:3000"), {
      method: "PUT",
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_MODIFIER);
  });

  // Test 1 : PUT avec consommations valides → 200
  it("retourne 200 avec consommations valides", async () => {
    const updatedReleve = {
      id: "rel-1",
      typeReleve: "ALIMENTATION",
      quantiteAliment: 5,
      consommations: [{ produitId: "prod-1", quantite: 3.5 }],
    };
    mockUpdateReleve.mockResolvedValue(updatedReleve);

    const request = makePutRequest("rel-1", {
      quantiteAliment: 5,
      consommations: [{ produitId: "prod-1", quantite: 3.5 }],
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.typeReleve).toBe("ALIMENTATION");
    expect(mockUpdateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      "rel-1",
      expect.objectContaining({
        consommations: [{ produitId: "prod-1", quantite: 3.5 }],
      })
    );
  });

  // Test 2 : PUT avec tableau de consommations vide (supprime tout) → 200
  it("retourne 200 avec consommations vide (supprime toutes les consommations)", async () => {
    const updatedReleve = { id: "rel-1", typeReleve: "ALIMENTATION", consommations: [] };
    mockUpdateReleve.mockResolvedValue(updatedReleve);

    const request = makePutRequest("rel-1", {
      quantiteAliment: 5,
      consommations: [],
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      "rel-1",
      expect.objectContaining({ consommations: [] })
    );
  });

  // Test 3 : PUT avec stock insuffisant → updateReleve lance une erreur → 500 (ou selon le message)
  it("propage l'erreur de stock insuffisant depuis updateReleve", async () => {
    mockUpdateReleve.mockRejectedValue(
      new Error(
        "Stock insuffisant pour \"Aliment Croissance\". Disponible : 2 KG, demande : 10"
      )
    );

    const request = makePutRequest("rel-1", {
      consommations: [{ produitId: "prod-1", quantite: 10 }],
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    // L'erreur contient "Stock insuffisant" → retourne 409
    expect(response.status).toBe(409);
    expect(data.message).toContain("Stock insuffisant");
  });

  // Test 4 : PUT avec typeReleve dans le body → 400 (champ immutable)
  it("retourne 400 si typeReleve est present dans le body", async () => {
    const request = makePutRequest("rel-1", {
      typeReleve: "BIOMETRIE",
      poidsMoyen: 50,
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "typeReleve" }),
      ])
    );
    expect(mockUpdateReleve).not.toHaveBeenCalled();
  });

  // Test 5 : PUT avec siteId dans le body → 400 (champ structurel immutable)
  it("retourne 400 si siteId est present dans le body", async () => {
    const request = makePutRequest("rel-1", {
      siteId: "site-autre",
      poidsMoyen: 50,
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "siteId" }),
      ])
    );
    expect(mockUpdateReleve).not.toHaveBeenCalled();
  });

  // Test 6 : PUT avec champs specifiques au type valides (sans consommations) → 200
  it("retourne 200 avec des champs specifiques au type valides sans consommations", async () => {
    const updatedReleve = {
      id: "rel-bio",
      typeReleve: "BIOMETRIE",
      poidsMoyen: 75.5,
      tailleMoyenne: 22.0,
      echantillonCount: 30,
    };
    mockUpdateReleve.mockResolvedValue(updatedReleve);

    const request = makePutRequest("rel-bio", {
      poidsMoyen: 75.5,
      tailleMoyenne: 22.0,
      echantillonCount: 30,
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-bio" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.poidsMoyen).toBe(75.5);
    expect(data.tailleMoyenne).toBe(22.0);
    expect(mockUpdateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      "rel-bio",
      expect.objectContaining({ poidsMoyen: 75.5, tailleMoyenne: 22.0, echantillonCount: 30 })
    );
  });

  // Test 7 : PUT sans aucun champ modifiable → 400 ("Aucun champ a modifier")
  it("retourne 400 si aucun champ modifiable n'est fourni", async () => {
    const request = makePutRequest("rel-1", {});
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Aucun champ a modifier.");
    expect(mockUpdateReleve).not.toHaveBeenCalled();
  });

  // Test supplementaire : PUT avec releve introuvable → 404
  it("retourne 404 si le releve est introuvable", async () => {
    mockUpdateReleve.mockRejectedValue(new Error("Releve introuvable"));

    const request = makePutRequest("rel-unknown", { notes: "Mise a jour" });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-unknown" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  // Test supplementaire : PUT sans autorisation → 401
  it("retourne 401 si l'utilisateur n'est pas authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const request = makePutRequest("rel-1", { poidsMoyen: 50 });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.status).toBe(401);
  });

  // Test supplementaire : PUT avec champ de validation invalide (poidsMoyen <= 0) → 400
  it("retourne 400 si poidsMoyen est invalide (zero ou negatif)", async () => {
    const request = makePutRequest("rel-1", { poidsMoyen: -5 });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "poidsMoyen" }),
      ])
    );
    expect(mockUpdateReleve).not.toHaveBeenCalled();
  });

  // Test supplementaire : PUT avec consommations non-tableau → 400
  it("retourne 400 si consommations n'est pas un tableau", async () => {
    const request = makePutRequest("rel-1", {
      consommations: "pas-un-tableau",
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "consommations" }),
      ])
    );
    expect(mockUpdateReleve).not.toHaveBeenCalled();
  });

  // Test supplementaire : PUT avec vagueId et bacId (champs structurels) → 400 avec plusieurs erreurs
  it("retourne 400 avec plusieurs erreurs si vagueId et bacId sont dans le body", async () => {
    const request = makePutRequest("rel-1", {
      vagueId: "vague-autre",
      bacId: "bac-autre",
      poidsMoyen: 50,
    });
    const response = await PUT(request, { params: Promise.resolve({ id: "rel-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "vagueId" }),
        expect.objectContaining({ field: "bacId" }),
      ])
    );
    expect(mockUpdateReleve).not.toHaveBeenCalled();
  });
});
