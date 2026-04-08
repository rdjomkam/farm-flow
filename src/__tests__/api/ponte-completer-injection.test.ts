/**
 * Tests API — PATCH /api/reproduction/pontes/[id] (Etape 1 : injection hormonale)
 *
 * Couvre :
 *   PATCH /api/reproduction/pontes/[id] — mise a jour des champs d'injection
 *     - Champs optionnels : typeHormone, doseHormone, doseMgKg, coutHormone,
 *       heureInjection, temperatureEauC, latenceTheorique, notes
 *     - Validation : heureInjection doit etre une date valide si fournie
 *     - Auth : 401 si non authentifie, 403 si permission manquante
 *     - 404 si ponte introuvable
 *     - 500 en cas d'erreur serveur
 *
 * Story : ponte-completer (Fix INC-2, INC-3, INC-4)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/reproduction/pontes/[id]/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateInjection = vi.fn();
const mockGetPonteById = vi.fn();
const mockDeletePonte = vi.fn();

vi.mock("@/lib/queries/pontes", () => ({
  getPonteById: (...args: unknown[]) => mockGetPonteById(...args),
  deletePonte: (...args: unknown[]) => mockDeletePonte(...args),
  updateInjection: (...args: unknown[]) => mockUpdateInjection(...args),
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  isSuperAdmin: false,
  permissions: [
    Permission.PONTES_VOIR,
    Permission.PONTES_GERER,
  ],
};

const FAKE_PONTE_UPDATED = {
  id: "ponte-1",
  code: "PONTE-2026-001",
  datePonte: new Date("2026-03-01"),
  femelleId: "rep-f-1",
  typeHormone: "OVAPRIM",
  doseHormone: 0.5,
  doseMgKg: 0.4,
  coutHormone: 5000,
  heureInjection: new Date("2026-03-01T08:30:00.000Z"),
  temperatureEauC: 27,
  latenceTheorique: 12,
  notes: "Injection realisee sans probleme",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/pontes/[id] — Injection Step 1
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/pontes/[id] — injection step 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // -------------------------------------------------------------------------
  // Succes — champs valides
  // -------------------------------------------------------------------------

  it("met a jour tous les champs d'injection optionnels", async () => {
    mockUpdateInjection.mockResolvedValue(FAKE_PONTE_UPDATED);

    const body = {
      typeHormone: "OVAPRIM",
      doseHormone: 0.5,
      doseMgKg: 0.4,
      coutHormone: 5000,
      heureInjection: "2026-03-01T08:30:00.000Z",
      temperatureEauC: 27,
      latenceTheorique: 12,
      notes: "Injection realisee sans probleme",
    };

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateInjection).toHaveBeenCalledWith(
      "ponte-1",
      "site-1",
      expect.objectContaining({
        typeHormone: "OVAPRIM",
        doseHormone: 0.5,
        doseMgKg: 0.4,
        coutHormone: 5000,
        heureInjection: "2026-03-01T08:30:00.000Z",
        temperatureEauC: 27,
        latenceTheorique: 12,
        notes: "Injection realisee sans probleme",
      })
    );
  });

  it("accepte un corps vide (tous les champs sont optionnels)", async () => {
    mockUpdateInjection.mockResolvedValue(FAKE_PONTE_UPDATED);

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateInjection).toHaveBeenCalledWith(
      "ponte-1",
      "site-1",
      {}
    );
  });

  it("accepte seulement le champ typeHormone avec une valeur valide", async () => {
    mockUpdateInjection.mockResolvedValue({ ...FAKE_PONTE_UPDATED, typeHormone: "HCG" });

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ typeHormone: "HCG" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateInjection).toHaveBeenCalledWith(
      "ponte-1",
      "site-1",
      expect.objectContaining({ typeHormone: "HCG" })
    );
  });

  it("retourne 400 si typeHormone est une valeur invalide", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ typeHormone: "VALEUR_INCONNUE" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "typeHormone" }),
      ])
    );
  });

  it("accepte seulement la temperature (calcul latence auto dans la query)", async () => {
    mockUpdateInjection.mockResolvedValue({ ...FAKE_PONTE_UPDATED, temperatureEauC: 25, latenceTheorique: 14 });

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ temperatureEauC: 25 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateInjection).toHaveBeenCalledWith(
      "ponte-1",
      "site-1",
      expect.objectContaining({ temperatureEauC: 25 })
    );
  });

  it("accepte heureInjection null (effacer la valeur)", async () => {
    mockUpdateInjection.mockResolvedValue({ ...FAKE_PONTE_UPDATED, heureInjection: null });

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ heureInjection: null }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    // null est valide — pas de validation d'erreur
    expect(response.status).toBe(200);
  });

  it("retourne les donnees de la ponte mises a jour", async () => {
    mockUpdateInjection.mockResolvedValue(FAKE_PONTE_UPDATED);

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ doseHormone: 0.6 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      id: "ponte-1",
      code: "PONTE-2026-001",
    });
  });

  // -------------------------------------------------------------------------
  // Validation — heureInjection
  // -------------------------------------------------------------------------

  it("retourne 400 si heureInjection n'est pas une string", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ heureInjection: 1234567890 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "heureInjection" }),
      ])
    );
  });

  it("retourne 400 si heureInjection est une string invalide", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ heureInjection: "pas-une-date" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "heureInjection" }),
      ])
    );
  });

  it("retourne 400 si heureInjection est une string vide", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ heureInjection: "" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    // Une string vide est parsee comme NaN par new Date("") → invalide
    expect(response.status).toBe(400);
  });

  it("accepte une heureInjection ISO valide (format Z)", async () => {
    mockUpdateInjection.mockResolvedValue(FAKE_PONTE_UPDATED);

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ heureInjection: "2026-03-01T08:30:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("accepte une heureInjection ISO valide (format +01:00)", async () => {
    mockUpdateInjection.mockResolvedValue(FAKE_PONTE_UPDATED);

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ heureInjection: "2026-03-01T09:30:00.000+01:00" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Validation — corps JSON
  // -------------------------------------------------------------------------

  it("retourne 400 si le corps n'est pas un JSON valide", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: "ceci-n-est-pas-du-json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Erreurs metier
  // -------------------------------------------------------------------------

  it("retourne 404 si la ponte est introuvable", async () => {
    mockUpdateInjection.mockRejectedValue(
      new Error("Ponte introuvable ou n'appartient pas a ce site")
    );

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/xxx", {
        method: "PATCH",
        body: JSON.stringify({ doseHormone: 0.5 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Authentification et permissions
  // -------------------------------------------------------------------------

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ doseHormone: 0.5 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
    expect(mockUpdateInjection).not.toHaveBeenCalled();
  });

  it("retourne 403 si permission PONTES_GERER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ doseHormone: 0.5 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mockUpdateInjection).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Erreur serveur
  // -------------------------------------------------------------------------

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockUpdateInjection.mockRejectedValue(new Error("Connexion DB perdue"));

    const response = await PATCH(
      makeRequest("/api/reproduction/pontes/ponte-1", {
        method: "PATCH",
        body: JSON.stringify({ doseHormone: 0.5 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(500);
  });
});
