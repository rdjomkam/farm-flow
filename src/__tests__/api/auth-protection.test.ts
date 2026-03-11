import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — requirePermission lance AuthError ou ForbiddenError
// ---------------------------------------------------------------------------

const mockRequirePermission = vi.fn();

vi.mock("@/lib/auth", () => {
  class MockAuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  }
  return {
    requireAuth: vi.fn(),
    AuthError: MockAuthError,
  };
});

vi.mock("@/lib/permissions", () => {
  class MockForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  }
  return {
    requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
    ForbiddenError: MockForbiddenError,
  };
});

// Mock query modules pour eviter les appels DB
vi.mock("@/lib/queries/bacs", () => ({
  getBacs: vi.fn(),
  createBac: vi.fn(),
}));

vi.mock("@/lib/queries/vagues", () => ({
  getVagues: vi.fn(),
  createVague: vi.fn(),
  getVagueById: vi.fn(),
  updateVague: vi.fn(),
}));

vi.mock("@/lib/queries/releves", () => ({
  getReleves: vi.fn(),
  createReleve: vi.fn(),
}));

vi.mock("@/lib/queries/indicateurs", () => ({
  getIndicateursVague: vi.fn(),
}));

import { GET as getBacs, POST as postBac } from "@/app/api/bacs/route";
import { GET as getVagues, POST as postVague } from "@/app/api/vagues/route";
import { GET as getReleves, POST as postReleve } from "@/app/api/releves/route";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// Protection des routes API — 401 sans authentification
// ---------------------------------------------------------------------------
describe("Protection des routes API sans authentification (401)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockRejectedValue(
      new AuthError("Non authentifie. Veuillez vous connecter.")
    );
  });

  it("GET /api/bacs retourne 401 sans session", async () => {
    const response = await getBacs(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain("Non authentifie");
  });

  it("POST /api/bacs retourne 401 sans session", async () => {
    const response = await postBac(
      makeRequest("/api/bacs", {
        method: "POST",
        body: JSON.stringify({ nom: "Bac Test", volume: 1000 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain("Non authentifie");
  });

  it("GET /api/vagues retourne 401 sans session", async () => {
    const response = await getVagues(makeRequest("/api/vagues"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain("Non authentifie");
  });

  it("POST /api/vagues retourne 401 sans session", async () => {
    const response = await postVague(
      makeRequest("/api/vagues", {
        method: "POST",
        body: JSON.stringify({
          code: "V-TEST",
          dateDebut: "2026-03-01",
          nombreInitial: 100,
          poidsMoyenInitial: 5,
          bacIds: ["bac-1"],
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain("Non authentifie");
  });

  it("GET /api/releves retourne 401 sans session", async () => {
    const response = await getReleves(makeRequest("/api/releves"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain("Non authentifie");
  });

  it("POST /api/releves retourne 401 sans session", async () => {
    const response = await postReleve(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-03-08T09:00:00Z",
          typeReleve: "OBSERVATION",
          vagueId: "vague-1",
          bacId: "bac-1",
          description: "Test protection",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain("Non authentifie");
  });
});

// ---------------------------------------------------------------------------
// Protection des routes API — 403 sans permission
// ---------------------------------------------------------------------------
describe("Protection des routes API sans permission (403)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );
  });

  it("GET /api/bacs retourne 403 sans BACS_GERER", async () => {
    const response = await getBacs(makeRequest("/api/bacs"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission insuffisante");
  });

  it("POST /api/bacs retourne 403 sans BACS_GERER", async () => {
    const response = await postBac(
      makeRequest("/api/bacs", {
        method: "POST",
        body: JSON.stringify({ nom: "Bac Test", volume: 1000 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission insuffisante");
  });

  it("GET /api/vagues retourne 403 sans VAGUES_VOIR", async () => {
    const response = await getVagues(makeRequest("/api/vagues"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission insuffisante");
  });

  it("POST /api/vagues retourne 403 sans VAGUES_CREER", async () => {
    const response = await postVague(
      makeRequest("/api/vagues", {
        method: "POST",
        body: JSON.stringify({
          code: "V-TEST",
          dateDebut: "2026-03-01",
          nombreInitial: 100,
          poidsMoyenInitial: 5,
          bacIds: ["bac-1"],
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission insuffisante");
  });

  it("GET /api/releves retourne 403 sans RELEVES_VOIR", async () => {
    const response = await getReleves(makeRequest("/api/releves"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission insuffisante");
  });

  it("POST /api/releves retourne 403 sans RELEVES_CREER", async () => {
    const response = await postReleve(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-03-08T09:00:00Z",
          typeReleve: "OBSERVATION",
          vagueId: "vague-1",
          bacId: "bac-1",
          description: "Test protection",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission insuffisante");
  });
});
