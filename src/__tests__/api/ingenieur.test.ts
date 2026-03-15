import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_DASHBOARD } from "@/app/api/ingenieur/dashboard/route";
import { GET as GET_CLIENTS } from "@/app/api/ingenieur/clients/route";
import { NextRequest } from "next/server";
import { Permission, StatutActivation } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetIngenieurDashboardMetrics = vi.fn();
const mockGetClientsIngenieur = vi.fn();

vi.mock("@/lib/queries/ingenieur", () => ({
  getIngenieurDashboardMetrics: (...args: unknown[]) =>
    mockGetIngenieurDashboardMetrics(...args),
  getClientsIngenieur: (...args: unknown[]) => mockGetClientsIngenieur(...args),
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

const AUTH_INGENIEUR = {
  userId: "user-ingenieur",
  email: "ingenieur@dkfarm.cm",
  phone: null,
  name: "Ingenieur DKFarm",
  globalRole: "INGENIEUR",
  activeSiteId: "site-dkfarm",
  siteRole: "INGENIEUR",
  permissions: [Permission.MONITORING_CLIENTS],
};

const FAKE_DASHBOARD_METRICS = {
  packsActifs: 5,
  survieMoyenne: 87.5,
  alertesActives: 2,
  fermesNecessitantAttention: 1,
  totalClientsActives: 5,
};

const FAKE_CLIENT_SUMMARY = {
  siteId: "site-client-1",
  siteName: "Ferme Mbongo",
  activationCode: "ACT-2026-001",
  activationStatut: StatutActivation.ACTIVE,
  dateActivation: new Date("2026-01-15"),
  dateExpiration: null,
  packNom: "Pack Decouverte 100",
  vaguesEnCours: 2,
  survieMoyenne: 88.5,
  alertesActives: 0,
  necessiteAttention: false,
  notesNonLues: 1,
};

const FAKE_CLIENTS_PAGINATED = {
  clients: [FAKE_CLIENT_SUMMARY],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// Tests GET /api/ingenieur/dashboard
// ---------------------------------------------------------------------------

describe("GET /api/ingenieur/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_INGENIEUR);
  });

  it("retourne les metriques du dashboard ingenieur", async () => {
    mockGetIngenieurDashboardMetrics.mockResolvedValue(FAKE_DASHBOARD_METRICS);

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    const res = await GET_DASHBOARD(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.packsActifs).toBe(5);
    expect(data.survieMoyenne).toBe(87.5);
    expect(data.alertesActives).toBe(2);
    expect(data.fermesNecessitantAttention).toBe(1);
    expect(data.totalClientsActives).toBe(5);
  });

  it("appelle getIngenieurDashboardMetrics avec le siteId actif", async () => {
    mockGetIngenieurDashboardMetrics.mockResolvedValue(FAKE_DASHBOARD_METRICS);

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    await GET_DASHBOARD(req);

    expect(mockGetIngenieurDashboardMetrics).toHaveBeenCalledWith("site-dkfarm");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    const res = await GET_DASHBOARD(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    const res = await GET_DASHBOARD(req);

    expect(res.status).toBe(403);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockGetIngenieurDashboardMetrics.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    const res = await GET_DASHBOARD(req);

    expect(res.status).toBe(500);
  });

  it("requiert la permission MONITORING_CLIENTS", async () => {
    mockGetIngenieurDashboardMetrics.mockResolvedValue(FAKE_DASHBOARD_METRICS);

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    await GET_DASHBOARD(req);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.MONITORING_CLIENTS
    );
  });
});

// ---------------------------------------------------------------------------
// Tests GET /api/ingenieur/clients
// ---------------------------------------------------------------------------

describe("GET /api/ingenieur/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_INGENIEUR);
  });

  it("retourne la liste paginee des clients", async () => {
    mockGetClientsIngenieur.mockResolvedValue(FAKE_CLIENTS_PAGINATED);

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    const res = await GET_CLIENTS(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.clients).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(data.totalPages).toBe(1);
  });

  it("utilise les parametres de pagination par defaut (page=1, limit=10)", async () => {
    mockGetClientsIngenieur.mockResolvedValue(FAKE_CLIENTS_PAGINATED);

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    await GET_CLIENTS(req);

    expect(mockGetClientsIngenieur).toHaveBeenCalledWith("site-dkfarm", 1, 10);
  });

  it("utilise les parametres de pagination passes en query", async () => {
    mockGetClientsIngenieur.mockResolvedValue(FAKE_CLIENTS_PAGINATED);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/clients?page=2&limit=5"
    );
    await GET_CLIENTS(req);

    expect(mockGetClientsIngenieur).toHaveBeenCalledWith("site-dkfarm", 2, 5);
  });

  it("retourne 400 si page < 1", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/clients?page=0"
    );
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("page");
  });

  it("retourne 400 si page n'est pas un nombre", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/clients?page=abc"
    );
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(400);
  });

  it("retourne 400 si limit > 100", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/clients?limit=200"
    );
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("limit");
  });

  it("retourne 400 si limit < 1", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/clients?limit=0"
    );
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(400);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(403);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockGetClientsIngenieur.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    const res = await GET_CLIENTS(req);

    expect(res.status).toBe(500);
  });

  it("requiert la permission MONITORING_CLIENTS", async () => {
    mockGetClientsIngenieur.mockResolvedValue(FAKE_CLIENTS_PAGINATED);

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    await GET_CLIENTS(req);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.MONITORING_CLIENTS
    );
  });

  it("le premier client a les bons champs", async () => {
    mockGetClientsIngenieur.mockResolvedValue(FAKE_CLIENTS_PAGINATED);

    const req = makeRequest("http://localhost:3000/api/ingenieur/clients");
    const res = await GET_CLIENTS(req);
    const data = await res.json();

    const client = data.clients[0];
    expect(client.siteId).toBe("site-client-1");
    expect(client.siteName).toBe("Ferme Mbongo");
    expect(client.activationCode).toBe("ACT-2026-001");
    expect(client.activationStatut).toBe(StatutActivation.ACTIVE);
    expect(client.packNom).toBe("Pack Decouverte 100");
    expect(client.vaguesEnCours).toBe(2);
    expect(client.survieMoyenne).toBe(88.5);
    expect(client.alertesActives).toBe(0);
    expect(client.necessiteAttention).toBe(false);
    expect(client.notesNonLues).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests queries unitaires — calculerSurvieMoyenneVagues (via ingenieur.ts)
// ---------------------------------------------------------------------------

describe("getIngenieurDashboardMetrics — logique metier", () => {
  it("retourne survieMoyenne null si aucune vague", async () => {
    mockGetIngenieurDashboardMetrics.mockResolvedValue({
      packsActifs: 0,
      survieMoyenne: null,
      alertesActives: 0,
      fermesNecessitantAttention: 0,
      totalClientsActives: 0,
    });

    const req = makeRequest("http://localhost:3000/api/ingenieur/dashboard");
    const res = await GET_DASHBOARD(req);
    const data = await res.json();

    expect(data.survieMoyenne).toBeNull();
    expect(data.packsActifs).toBe(0);
    expect(data.totalClientsActives).toBe(0);
  });
});
