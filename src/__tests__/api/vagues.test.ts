import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/vagues/route";
import { GET as GET_DETAIL, PUT } from "@/app/api/vagues/[id]/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetVagues = vi.fn();
const mockCreateVague = vi.fn();
const mockGetVagueById = vi.fn();
const mockUpdateVague = vi.fn();
const mockGetIndicateursVague = vi.fn();

vi.mock("@/lib/queries/vagues", () => ({
  getVagues: (...args: unknown[]) => mockGetVagues(...args),
  createVague: (...args: unknown[]) => mockCreateVague(...args),
  getVagueById: (...args: unknown[]) => mockGetVagueById(...args),
  updateVague: (...args: unknown[]) => mockUpdateVague(...args),
}));

vi.mock("@/lib/queries/indicateurs", () => ({
  getIndicateursVague: (...args: unknown[]) => mockGetIndicateursVague(...args),
}));

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const now = new Date("2026-03-08T10:00:00Z");
const pastDate = new Date("2026-01-15T00:00:00Z");

// ---------------------------------------------------------------------------
// GET /api/vagues
// ---------------------------------------------------------------------------
describe("GET /api/vagues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne la liste des vagues avec le total", async () => {
    mockGetVagues.mockResolvedValue([
      {
        id: "vague-1",
        code: "VAGUE-2026-001",
        dateDebut: pastDate,
        dateFin: null,
        statut: "EN_COURS",
        nombreInitial: 500,
        poidsMoyenInitial: 5.0,
        origineAlevins: "Ecloserie Douala",
        createdAt: pastDate,
        updatedAt: now,
        _count: { bacs: 3, releves: 10 },
      },
    ]);

    const request = makeRequest("/api/vagues");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vagues).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.vagues[0].code).toBe("VAGUE-2026-001");
    expect(data.vagues[0].nombreBacs).toBe(3);
    expect(data.vagues[0].joursEcoules).toBeGreaterThanOrEqual(0);
  });

  it("filtre les vagues par statut EN_COURS", async () => {
    // getVagues filtre côté DB — le mock retourne déjà le résultat filtré
    mockGetVagues.mockResolvedValue([
      {
        id: "vague-1",
        code: "VAGUE-2026-001",
        dateDebut: pastDate,
        dateFin: null,
        statut: "EN_COURS",
        nombreInitial: 500,
        poidsMoyenInitial: 5.0,
        origineAlevins: null,
        createdAt: pastDate,
        updatedAt: now,
        _count: { bacs: 2, releves: 5 },
      },
    ]);

    const request = makeRequest("/api/vagues?statut=EN_COURS");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vagues).toHaveLength(1);
    expect(data.vagues[0].statut).toBe("EN_COURS");
    expect(mockGetVagues).toHaveBeenCalledWith({ statut: "EN_COURS" });
  });

  it("retourne une liste vide quand pas de vagues", async () => {
    mockGetVagues.mockResolvedValue([]);

    const request = makeRequest("/api/vagues");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vagues).toHaveLength(0);
    expect(data.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/vagues
// ---------------------------------------------------------------------------
describe("POST /api/vagues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    code: "VAGUE-2026-003",
    dateDebut: "2026-03-01",
    nombreInitial: 1000,
    poidsMoyenInitial: 3.5,
    origineAlevins: "Production locale",
    bacIds: ["bac-1", "bac-2"],
  };

  it("crée une vague avec des données valides", async () => {
    mockCreateVague.mockResolvedValue({
      id: "vague-new",
      code: "VAGUE-2026-003",
      dateDebut: new Date("2026-03-01"),
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 1000,
      poidsMoyenInitial: 3.5,
      origineAlevins: "Production locale",
      createdAt: now,
      updatedAt: now,
      bacs: [{ id: "bac-1" }, { id: "bac-2" }],
    });

    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.code).toBe("VAGUE-2026-003");
    expect(data.nombreBacs).toBe(2);
  });

  it("retourne 400 si le code est manquant", async () => {
    const body = { ...validBody, code: undefined };
    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "code")).toBe(true);
  });

  it("retourne 400 si dateDebut est invalide", async () => {
    const body = { ...validBody, dateDebut: "not-a-date" };
    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "dateDebut")).toBe(true);
  });

  it("retourne 400 si nombreInitial est 0 ou négatif", async () => {
    const body = { ...validBody, nombreInitial: 0 };
    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "nombreInitial")).toBe(true);
  });

  it("retourne 400 si nombreInitial n'est pas un entier", async () => {
    const body = { ...validBody, nombreInitial: 3.5 };
    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "nombreInitial")).toBe(true);
  });

  it("retourne 400 si poidsMoyenInitial est manquant", async () => {
    const body = { ...validBody, poidsMoyenInitial: undefined };
    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "poidsMoyenInitial")
    ).toBe(true);
  });

  it("retourne 400 si bacIds est vide", async () => {
    const body = { ...validBody, bacIds: [] };
    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "bacIds")).toBe(true);
  });

  it("retourne 409 quand un bac est déjà assigné", async () => {
    mockCreateVague.mockRejectedValue(
      new Error("Bacs déjà assignés à une vague : Bac 1")
    );

    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("déjà assigné");
  });

  it("retourne 409 quand le code est déjà utilisé", async () => {
    mockCreateVague.mockRejectedValue(
      new Error('Le code "VAGUE-2026-003" est déjà utilisé')
    );

    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("déjà utilisé");
  });

  it("retourne 404 quand un bac est introuvable", async () => {
    mockCreateVague.mockRejectedValue(
      new Error("Un ou plusieurs bacs sont introuvables")
    );

    const request = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });
});

// ---------------------------------------------------------------------------
// GET /api/vagues/[id]
// ---------------------------------------------------------------------------
describe("GET /api/vagues/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne le détail d'une vague avec indicateurs", async () => {
    const vagueData = {
      id: "vague-1",
      code: "VAGUE-2026-001",
      dateDebut: pastDate,
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 500,
      poidsMoyenInitial: 5.0,
      origineAlevins: "Ecloserie Douala",
      createdAt: pastDate,
      updatedAt: now,
      bacs: [{ id: "bac-1", nom: "Bac 1", volume: 1000 }],
      releves: [],
    };
    mockGetVagueById.mockResolvedValue(vagueData);
    mockGetIndicateursVague.mockResolvedValue({
      tauxSurvie: 92.5,
      fcr: 1.3,
      sgr: 2.1,
      biomasse: 45.6,
      poidsMoyen: 98.5,
      tailleMoyenne: 22.3,
      nombreVivants: 463,
      totalMortalites: 37,
      totalAliment: 28.5,
      gainPoids: 93.5,
      joursEcoules: 45,
    });

    const request = makeRequest("/api/vagues/vague-1");
    const response = await GET_DETAIL(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vague.code).toBe("VAGUE-2026-001");
    expect(data.bacs).toHaveLength(1);
    expect(data.indicateurs.tauxSurvie).toBe(92.5);
    expect(data.indicateurs.fcr).toBe(1.3);
  });

  it("retourne des indicateurs par défaut quand aucune donnée", async () => {
    mockGetVagueById.mockResolvedValue({
      id: "vague-1",
      code: "VAGUE-2026-001",
      dateDebut: pastDate,
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 500,
      poidsMoyenInitial: 5.0,
      origineAlevins: null,
      createdAt: pastDate,
      updatedAt: now,
      bacs: [],
      releves: [],
    });
    mockGetIndicateursVague.mockResolvedValue(null);

    const request = makeRequest("/api/vagues/vague-1");
    const response = await GET_DETAIL(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.indicateurs.tauxSurvie).toBeNull();
    expect(data.indicateurs.totalMortalites).toBe(0);
    expect(data.indicateurs.totalAliment).toBe(0);
  });

  it("retourne 404 pour une vague inexistante", async () => {
    mockGetVagueById.mockResolvedValue(null);

    const request = makeRequest("/api/vagues/unknown-id");
    const response = await GET_DETAIL(request, {
      params: Promise.resolve({ id: "unknown-id" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/vagues/[id] — Clôture et modification
// ---------------------------------------------------------------------------
describe("PUT /api/vagues/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clôture une vague avec statut TERMINEE et dateFin", async () => {
    mockUpdateVague.mockResolvedValue({
      id: "vague-1",
      code: "VAGUE-2026-001",
      dateDebut: pastDate,
      dateFin: now,
      statut: "TERMINEE",
      nombreInitial: 500,
      poidsMoyenInitial: 5.0,
      origineAlevins: "Ecloserie Douala",
      createdAt: pastDate,
      updatedAt: now,
      _count: { bacs: 0 },
    });

    const request = makeRequest("/api/vagues/vague-1", {
      method: "PUT",
      body: JSON.stringify({
        statut: "TERMINEE",
        dateFin: "2026-03-08",
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe("TERMINEE");
  });

  it("retourne 400 si statut TERMINEE sans dateFin", async () => {
    const request = makeRequest("/api/vagues/vague-1", {
      method: "PUT",
      body: JSON.stringify({ statut: "TERMINEE" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "dateFin")).toBe(true);
  });

  it("retourne 400 si statut invalide", async () => {
    const request = makeRequest("/api/vagues/vague-1", {
      method: "PUT",
      body: JSON.stringify({ statut: "INVALIDE" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "statut")).toBe(true);
  });

  it("retourne 404 pour une vague inexistante", async () => {
    mockUpdateVague.mockRejectedValue(new Error("Vague introuvable"));

    const request = makeRequest("/api/vagues/unknown-id", {
      method: "PUT",
      body: JSON.stringify({ statut: "TERMINEE", dateFin: "2026-03-08" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "unknown-id" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 409 quand on tente de clôturer une vague déjà clôturée", async () => {
    mockUpdateVague.mockRejectedValue(
      new Error("Seule une vague en cours peut être clôturée")
    );

    const request = makeRequest("/api/vagues/vague-1", {
      method: "PUT",
      body: JSON.stringify({ statut: "TERMINEE", dateFin: "2026-03-08" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("clôturée");
  });

  it("ajoute des bacs à une vague", async () => {
    mockUpdateVague.mockResolvedValue({
      id: "vague-1",
      code: "VAGUE-2026-001",
      dateDebut: pastDate,
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 500,
      poidsMoyenInitial: 5.0,
      origineAlevins: null,
      createdAt: pastDate,
      updatedAt: now,
      _count: { bacs: 3 },
    });

    const request = makeRequest("/api/vagues/vague-1", {
      method: "PUT",
      body: JSON.stringify({ addBacIds: ["bac-3"] }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateVague).toHaveBeenCalledWith("vague-1", {
      addBacIds: ["bac-3"],
    });
    expect(data.code).toBe("VAGUE-2026-001");
  });

  it("retourne 409 si bac à ajouter est déjà assigné", async () => {
    mockUpdateVague.mockRejectedValue(
      new Error("Bacs déjà assignés : Bac 3")
    );

    const request = makeRequest("/api/vagues/vague-1", {
      method: "PUT",
      body: JSON.stringify({ addBacIds: ["bac-3"] }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "vague-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("déjà assigné");
  });
});
