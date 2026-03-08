import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/releves/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReleves = vi.fn();
const mockCreateReleve = vi.fn();

vi.mock("@/lib/queries/releves", () => ({
  getReleves: (...args: unknown[]) => mockGetReleves(...args),
  createReleve: (...args: unknown[]) => mockCreateReleve(...args),
}));

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
  });

  it("retourne tous les relevés sans filtre", async () => {
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

  it("filtre les relevés par vagueId", async () => {
    mockGetReleves.mockResolvedValue({ releves: [], total: 0 });

    const request = makeRequest("/api/releves?vagueId=vague-1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetReleves).toHaveBeenCalledWith(
      expect.objectContaining({ vagueId: "vague-1" })
    );
  });

  it("filtre les relevés par typeReleve", async () => {
    mockGetReleves.mockResolvedValue({ releves: [], total: 0 });

    const request = makeRequest("/api/releves?typeReleve=BIOMETRIE");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetReleves).toHaveBeenCalledWith(
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
    expect(data.message).toContain("Type de relevé invalide");
  });
});

// ---------------------------------------------------------------------------
// POST /api/releves — Biométrie
// ---------------------------------------------------------------------------
describe("POST /api/releves — Biométrie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBiometrie = {
    date: "2026-03-08T09:00:00Z",
    typeReleve: "BIOMETRIE",
    vagueId: "vague-1",
    bacId: "bac-1",
    poidsMoyen: 52.3,
    tailleMoyenne: 16.1,
    echantillonCount: 25,
  };

  it("crée un relevé biométrie valide", async () => {
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
  });

  it("retourne 400 si poidsMoyen manquant pour biométrie", async () => {
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

  it("retourne 400 si tailleMoyenne manquante pour biométrie", async () => {
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
// POST /api/releves — Mortalité
// ---------------------------------------------------------------------------
describe("POST /api/releves — Mortalité", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validMortalite = {
    date: "2026-03-08T09:00:00Z",
    typeReleve: "MORTALITE",
    vagueId: "vague-1",
    bacId: "bac-1",
    nombreMorts: 5,
    causeMortalite: "MALADIE",
  };

  it("crée un relevé mortalité valide", async () => {
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

  it("retourne 400 si nombreMorts est négatif", async () => {
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
  });

  const validAlimentation = {
    date: "2026-03-08T09:00:00Z",
    typeReleve: "ALIMENTATION",
    vagueId: "vague-1",
    bacId: "bac-1",
    quantiteAliment: 2.5,
    typeAliment: "COMMERCIAL",
    frequenceAliment: 3,
  };

  it("crée un relevé alimentation valide", async () => {
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
// POST /api/releves — Qualité Eau
// ---------------------------------------------------------------------------
describe("POST /api/releves — Qualité Eau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée un relevé qualité eau valide (champs optionnels)", async () => {
    const body = {
      date: "2026-03-08T09:00:00Z",
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

  it("crée un relevé qualité eau sans champs optionnels", async () => {
    const body = {
      date: "2026-03-08T09:00:00Z",
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
  });

  const validComptage = {
    date: "2026-03-08T09:00:00Z",
    typeReleve: "COMPTAGE",
    vagueId: "vague-1",
    bacId: "bac-1",
    nombreCompte: 450,
    methodeComptage: "DIRECT",
  };

  it("crée un relevé comptage valide", async () => {
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

  it("retourne 400 si nombreCompte est négatif", async () => {
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
  });

  it("crée un relevé observation valide", async () => {
    const body = {
      date: "2026-03-08T09:00:00Z",
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
      date: "2026-03-08T09:00:00Z",
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
  });

  it("retourne 400 si typeReleve est manquant", async () => {
    const body = {
      date: "2026-03-08T09:00:00Z",
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
      date: "2026-03-08T09:00:00Z",
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

  it("retourne 400 si date est manquante", async () => {
    const body = {
      typeReleve: "BIOMETRIE",
      vagueId: "vague-1",
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
    expect(data.errors.some((e: { field: string }) => e.field === "date")).toBe(true);
  });

  it("retourne 400 si vagueId est manquant", async () => {
    const body = {
      date: "2026-03-08T09:00:00Z",
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
      date: "2026-03-08T09:00:00Z",
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
      date: "2026-03-08T09:00:00Z",
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

  it("retourne 409 si le bac n'appartient pas à la vague", async () => {
    mockCreateReleve.mockRejectedValue(
      new Error("Ce bac n'appartient pas à la vague sélectionnée")
    );

    const body = {
      date: "2026-03-08T09:00:00Z",
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

  it("retourne 409 si la vague est clôturée", async () => {
    mockCreateReleve.mockRejectedValue(
      new Error("Impossible d'ajouter un relevé à une vague clôturée")
    );

    const body = {
      date: "2026-03-08T09:00:00Z",
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
    expect(data.message).toContain("clôturée");
  });
});
