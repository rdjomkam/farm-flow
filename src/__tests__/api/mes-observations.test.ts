/**
 * Tests Sprint 23 — API Observations Client (POST/GET /api/mes-observations)
 *
 * Couvre :
 *   GET  /api/mes-observations — liste les observations du client
 *   POST /api/mes-observations — envoie une observation a l'ingenieur
 *
 * Regles testees :
 *   - Validation type obligatoire parmi les 5 valeurs acceptees
 *   - Validation observationTexte obligatoire
 *   - vagueId optionnel mais doit etre une string non vide si fourni
 *   - Titre construit automatiquement depuis le type
 *   - Retourne 400 si aucun site actif
 *   - Retourne 404 si ressource introuvable (message contenant "introuvable")
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/mes-observations/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetObservationsClient = vi.fn();
const mockCreateObservationClient = vi.fn();

vi.mock("@/lib/queries/notes", () => ({
  getObservationsClient: (...args: unknown[]) => mockGetObservationsClient(...args),
  createObservationClient: (...args: unknown[]) => mockCreateObservationClient(...args),
}));

const mockRequireAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_CLIENT = {
  userId: "user-client-1",
  email: "client@ferme-mbongo.cm",
  phone: null,
  name: "Jean Mbongo",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-client-1",
  siteRole: "PISCICULTEUR",
  permissions: [],
};

const FAKE_OBSERVATION = {
  id: "obs-1",
  titre: "[Mortalite] — J'ai trouve 5 poissons morts ce matin",
  contenu: "J'ai trouve 5 poissons morts ce matin",
  visibility: "INTERNE",
  isUrgent: false,
  isRead: false,
  isFromClient: true,
  observationTexte: "J'ai trouve 5 poissons morts ce matin",
  ingenieurId: "user-ingenieur-1",
  clientSiteId: "site-client-1",
  vagueId: null,
  siteId: "site-dkfarm",
  createdAt: new Date("2026-03-14"),
  updatedAt: new Date("2026-03-14"),
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

function makeJsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET /api/mes-observations
// ---------------------------------------------------------------------------

describe("GET /api/mes-observations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION_CLIENT);
  });

  it("retourne les observations du client avec total", async () => {
    mockGetObservationsClient.mockResolvedValue([FAKE_OBSERVATION]);

    const req = makeRequest("http://localhost:3000/api/mes-observations");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("utilise le siteId actif de la session", async () => {
    mockGetObservationsClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/mes-observations");
    await GET(req);

    expect(mockGetObservationsClient).toHaveBeenCalledWith("site-client-1");
  });

  it("retourne une liste vide si aucune observation", async () => {
    mockGetObservationsClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/mes-observations");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 400 si aucun site actif", async () => {
    mockRequireAuth.mockResolvedValue({ ...SESSION_CLIENT, activeSiteId: null });

    const req = makeRequest("http://localhost:3000/api/mes-observations");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("site actif");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireAuth.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeRequest("http://localhost:3000/api/mes-observations");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockGetObservationsClient.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/mes-observations");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/mes-observations
// ---------------------------------------------------------------------------

describe("POST /api/mes-observations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION_CLIENT);
  });

  const validBody = {
    observationTexte: "J'ai trouve 5 poissons morts ce matin",
    type: "mortalite",
  };

  it("cree une observation valide et retourne 201", async () => {
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      validBody
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("accepte le type 'mortalite'", async () => {
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, type: "mortalite" }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("accepte le type 'eau'", async () => {
    mockCreateObservationClient.mockResolvedValue({ ...FAKE_OBSERVATION, titre: "[Qualite de l'eau] — test" });

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, type: "eau" }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("accepte le type 'comportement'", async () => {
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, type: "comportement" }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("accepte le type 'alimentation'", async () => {
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, type: "alimentation" }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("accepte le type 'autre'", async () => {
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, type: "autre" }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("accepte vagueId optionnel", async () => {
    mockCreateObservationClient.mockResolvedValue({
      ...FAKE_OBSERVATION,
      vagueId: "vague-xyz",
    });

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, vagueId: "vague-xyz" }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateObservationClient).toHaveBeenCalledWith(
      "site-client-1",
      "user-client-1",
      expect.objectContaining({ vagueId: "vague-xyz" })
    );
  });

  it("le titre est construit automatiquement depuis le type mortalite", async () => {
    const texte = "Cinq poissons morts";
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { observationTexte: texte, type: "mortalite" }
    );
    await POST(req);

    expect(mockCreateObservationClient).toHaveBeenCalledWith(
      "site-client-1",
      "user-client-1",
      expect.objectContaining({
        titre: expect.stringContaining("[Mortalite]"),
      })
    );
  });

  it("tronque le titre a 60 caracteres + '...' si texte long", async () => {
    const longText = "A".repeat(80);
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { observationTexte: longText, type: "mortalite" }
    );
    await POST(req);

    const callArgs = mockCreateObservationClient.mock.calls[0][2];
    expect(callArgs.titre).toContain("...");
    // Titre max = "[Mortalite] — " (14) + 60 chars + "..." = 77 chars total
    expect(callArgs.titre.length).toBeLessThanOrEqual(80);
  });

  it("retourne 400 si observationTexte manquant", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { type: "mortalite" }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(
      data.errors.some((e: { field: string }) => e.field === "observationTexte")
    ).toBe(true);
  });

  it("retourne 400 si observationTexte est vide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { observationTexte: "   ", type: "mortalite" }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("retourne 400 si type manquant", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { observationTexte: "Test" }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "type")).toBe(true);
  });

  it("retourne 400 si type invalide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { observationTexte: "Test", type: "INVALIDE" }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "type")).toBe(true);
  });

  it("retourne 400 si vagueId fourni mais vide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, vagueId: "   " }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "vagueId")).toBe(true);
  });

  it("retourne 400 si vagueId fourni mais n'est pas une string", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, vagueId: 123 }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("vagueId null est accepte (pas de vague associee)", async () => {
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      { ...validBody, vagueId: null }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("retourne 400 si aucun site actif", async () => {
    mockRequireAuth.mockResolvedValue({ ...SESSION_CLIENT, activeSiteId: null });

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      validBody
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("retourne 404 si la ressource est introuvable (message 'introuvable')", async () => {
    mockCreateObservationClient.mockRejectedValue(
      new Error("Site ingenieur introuvable")
    );

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      validBody
    );
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireAuth.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      validBody
    );
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("retourne 500 si erreur serveur generique", async () => {
    mockCreateObservationClient.mockRejectedValue(new Error("DB error"));

    const req = makeJsonRequest(
      "http://localhost:3000/api/mes-observations",
      validBody
    );
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Validation des 5 types acceptes — test parametrique
// ---------------------------------------------------------------------------

describe("POST /api/mes-observations — les 5 types d'observation acceptes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION_CLIENT);
    mockCreateObservationClient.mockResolvedValue(FAKE_OBSERVATION);
  });

  const VALID_TYPES = ["mortalite", "eau", "comportement", "alimentation", "autre"];

  for (const type of VALID_TYPES) {
    it(`type '${type}' est accepte et retourne 201`, async () => {
      const req = makeJsonRequest(
        "http://localhost:3000/api/mes-observations",
        { observationTexte: "Test observation", type }
      );
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  }

  const INVALID_TYPES = ["MORTALITE", "Eau", "unknown", "", "NULL"];

  for (const type of INVALID_TYPES) {
    it(`type invalide '${type}' est rejete avec 400`, async () => {
      const req = makeJsonRequest(
        "http://localhost:3000/api/mes-observations",
        { observationTexte: "Test observation", type }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  }
});
