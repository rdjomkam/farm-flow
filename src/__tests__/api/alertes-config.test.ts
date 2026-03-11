import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/alertes/config/route";
import { PUT, DELETE } from "@/app/api/alertes/config/[id]/route";
import { GET as GET_CHECK } from "@/app/api/alertes/check/route";
import { NextRequest } from "next/server";
import { Permission, TypeAlerte } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetConfigAlertes = vi.fn();
const mockCreateConfigAlerte = vi.fn();
const mockUpdateConfigAlerte = vi.fn();
const mockDeleteConfigAlerte = vi.fn();

vi.mock("@/lib/queries", () => ({
  getConfigAlertes: (...args: unknown[]) => mockGetConfigAlertes(...args),
  createConfigAlerte: (...args: unknown[]) => mockCreateConfigAlerte(...args),
  updateConfigAlerte: (...args: unknown[]) => mockUpdateConfigAlerte(...args),
  deleteConfigAlerte: (...args: unknown[]) => mockDeleteConfigAlerte(...args),
}));

const mockVerifierAlertes = vi.fn();

vi.mock("@/lib/alertes", () => ({
  verifierAlertes: (...args: unknown[]) => mockVerifierAlertes(...args),
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
  permissions: [Permission.ALERTES_VOIR, Permission.ALERTES_CONFIGURER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_CONFIG = {
  id: "config-1",
  typeAlerte: TypeAlerte.MORTALITE_ELEVEE,
  seuilValeur: 5,
  seuilPourcentage: null,
  enabled: true,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// GET /api/alertes/config
// ---------------------------------------------------------------------------
describe("GET /api/alertes/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des configurations avec le total", async () => {
    mockGetConfigAlertes.mockResolvedValue([FAKE_CONFIG]);

    const response = await GET(makeRequest("/api/alertes/config"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.configs).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetConfigAlertes).toHaveBeenCalledWith("site-1", "user-1");
  });

  it("retourne une liste vide si aucune configuration", async () => {
    mockGetConfigAlertes.mockResolvedValue([]);

    const response = await GET(makeRequest("/api/alertes/config"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.configs).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/alertes/config"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/alertes/config"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetConfigAlertes.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/alertes/config"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/alertes/config
// ---------------------------------------------------------------------------
describe("POST /api/alertes/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree une configuration d'alerte (happy path)", async () => {
    mockCreateConfigAlerte.mockResolvedValue(FAKE_CONFIG);

    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({
          typeAlerte: TypeAlerte.MORTALITE_ELEVEE,
          seuilValeur: 5,
          enabled: true,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("config-1");
    expect(mockCreateConfigAlerte).toHaveBeenCalledWith("site-1", "user-1", {
      typeAlerte: TypeAlerte.MORTALITE_ELEVEE,
      seuilValeur: 5,
      seuilPourcentage: undefined,
      enabled: true,
    });
  });

  it("cree une configuration avec seuilPourcentage", async () => {
    const configPct = { ...FAKE_CONFIG, seuilValeur: null, seuilPourcentage: 20 };
    mockCreateConfigAlerte.mockResolvedValue(configPct);

    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({
          typeAlerte: TypeAlerte.QUALITE_EAU,
          seuilPourcentage: 20,
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("retourne 400 si typeAlerte manquant", async () => {
    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({ seuilValeur: 5 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "typeAlerte" })])
    );
  });

  it("retourne 400 si typeAlerte invalide", async () => {
    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({ typeAlerte: "TYPE_INEXISTANT" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "typeAlerte" })])
    );
  });

  it("retourne 400 si seuilValeur est negatif", async () => {
    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({
          typeAlerte: TypeAlerte.MORTALITE_ELEVEE,
          seuilValeur: -1,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "seuilValeur" })])
    );
  });

  it("retourne 400 si seuilPourcentage est negatif", async () => {
    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({
          typeAlerte: TypeAlerte.QUALITE_EAU,
          seuilPourcentage: -5,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "seuilPourcentage" })])
    );
  });

  it("retourne 400 si seuilPourcentage depasse 100", async () => {
    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({
          typeAlerte: TypeAlerte.QUALITE_EAU,
          seuilPourcentage: 150,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "seuilPourcentage" })])
    );
  });

  it("retourne 400 si enabled n'est pas un booleen", async () => {
    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({
          typeAlerte: TypeAlerte.STOCK_BAS,
          enabled: "oui",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "enabled" })])
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({ typeAlerte: TypeAlerte.STOCK_BAS }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission ALERTES_CONFIGURER manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST(
      makeRequest("/api/alertes/config", {
        method: "POST",
        body: JSON.stringify({ typeAlerte: TypeAlerte.STOCK_BAS }),
      })
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/alertes/config/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/alertes/config/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour le seuil d'une configuration", async () => {
    const updated = { ...FAKE_CONFIG, seuilValeur: 10 };
    mockUpdateConfigAlerte.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/alertes/config/config-1", {
        method: "PUT",
        body: JSON.stringify({ seuilValeur: 10 }),
      }),
      { params: Promise.resolve({ id: "config-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.seuilValeur).toBe(10);
    expect(mockUpdateConfigAlerte).toHaveBeenCalledWith("site-1", "config-1", {
      seuilValeur: 10,
      seuilPourcentage: undefined,
      enabled: undefined,
    });
  });

  it("desactive une configuration (enabled: false)", async () => {
    const updated = { ...FAKE_CONFIG, enabled: false };
    mockUpdateConfigAlerte.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/alertes/config/config-1", {
        method: "PUT",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ id: "config-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabled).toBe(false);
  });

  it("retourne 400 si seuilValeur negatif en update", async () => {
    const response = await PUT(
      makeRequest("/api/alertes/config/config-1", {
        method: "PUT",
        body: JSON.stringify({ seuilValeur: -1 }),
      }),
      { params: Promise.resolve({ id: "config-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "seuilValeur" })])
    );
  });

  it("retourne 400 si seuilPourcentage hors bornes en update", async () => {
    const response = await PUT(
      makeRequest("/api/alertes/config/config-1", {
        method: "PUT",
        body: JSON.stringify({ seuilPourcentage: 200 }),
      }),
      { params: Promise.resolve({ id: "config-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si enabled non booleen en update", async () => {
    const response = await PUT(
      makeRequest("/api/alertes/config/config-1", {
        method: "PUT",
        body: JSON.stringify({ enabled: "non" }),
      }),
      { params: Promise.resolve({ id: "config-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si configuration introuvable", async () => {
    mockUpdateConfigAlerte.mockRejectedValue(new Error("Configuration d'alerte introuvable"));

    const response = await PUT(
      makeRequest("/api/alertes/config/inexistant", {
        method: "PUT",
        body: JSON.stringify({ seuilValeur: 5 }),
      }),
      { params: Promise.resolve({ id: "inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PUT(
      makeRequest("/api/alertes/config/config-1", {
        method: "PUT",
        body: JSON.stringify({ seuilValeur: 5 }),
      }),
      { params: Promise.resolve({ id: "config-1" }) }
    );
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/alertes/config/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/alertes/config/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime une configuration d'alerte", async () => {
    mockDeleteConfigAlerte.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/alertes/config/config-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "config-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteConfigAlerte).toHaveBeenCalledWith("site-1", "config-1");
  });

  it("retourne 404 si configuration introuvable", async () => {
    mockDeleteConfigAlerte.mockRejectedValue(new Error("Configuration d'alerte introuvable"));

    const response = await DELETE(
      makeRequest("/api/alertes/config/inexistant", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/alertes/config/config-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "config-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/alertes/check
// ---------------------------------------------------------------------------
describe("GET /api/alertes/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("verifie les alertes et retourne success", async () => {
    mockVerifierAlertes.mockResolvedValue(undefined);

    const response = await GET_CHECK(makeRequest("/api/alertes/check"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockVerifierAlertes).toHaveBeenCalledWith("site-1", "user-1");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_CHECK(makeRequest("/api/alertes/check"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_CHECK(makeRequest("/api/alertes/check"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 si la verification echoue", async () => {
    mockVerifierAlertes.mockRejectedValue(new Error("Erreur verification"));

    const response = await GET_CHECK(makeRequest("/api/alertes/check"));
    expect(response.status).toBe(500);
  });
});
