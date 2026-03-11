import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_RESUME } from "@/app/api/finances/resume/route";
import { GET as GET_PAR_VAGUE } from "@/app/api/finances/par-vague/route";
import { GET as GET_EVOLUTION } from "@/app/api/finances/evolution/route";
import { GET as GET_TOP_CLIENTS } from "@/app/api/finances/top-clients/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetResumeFinancier = vi.fn();
const mockGetRentabiliteParVague = vi.fn();
const mockGetEvolutionFinanciere = vi.fn();
const mockGetTopClients = vi.fn();

vi.mock("@/lib/queries", () => ({
  getResumeFinancier: (...args: unknown[]) => mockGetResumeFinancier(...args),
  getRentabiliteParVague: (...args: unknown[]) => mockGetRentabiliteParVague(...args),
  getEvolutionFinanciere: (...args: unknown[]) => mockGetEvolutionFinanciere(...args),
  getTopClients: (...args: unknown[]) => mockGetTopClients(...args),
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
  permissions: [Permission.FINANCES_VOIR],
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const FAKE_RESUME = {
  revenus: 1500000,
  coutsAliments: 300000,
  coutsIntrants: 50000,
  coutsEquipements: 100000,
  coutsTotaux: 450000,
  margeBrute: 1050000,
  tauxMarge: 70.0,
  encaissements: 1200000,
  creances: 300000,
  prixMoyenVenteKg: 2500.5,
  nombreVentes: 10,
  nombreFactures: 8,
};

const FAKE_RENTABILITE = {
  vagues: [
    {
      id: "vague-1",
      nom: "V-2026-001",
      code: "V-2026-001",
      statut: "EN_COURS",
      revenus: 800000,
      couts: 200000,
      marge: 600000,
      roi: 300.0,
      poidsTotalVendu: 320,
    },
    {
      id: "vague-2",
      nom: "V-2026-002",
      code: "V-2026-002",
      statut: "TERMINEE",
      revenus: 700000,
      couts: 250000,
      marge: 450000,
      roi: 180.0,
      poidsTotalVendu: 280,
    },
  ],
};

const FAKE_EVOLUTION = {
  evolution: [
    { mois: "2026-01", revenus: 500000, couts: 150000, marge: 350000, encaissements: 450000 },
    { mois: "2026-02", revenus: 600000, couts: 200000, marge: 400000, encaissements: 550000 },
    { mois: "2026-03", revenus: 400000, couts: 100000, marge: 300000, encaissements: 200000 },
  ],
};

const FAKE_TOP_CLIENTS = {
  clients: [
    {
      id: "client-1",
      nom: "Marche Central Yaounde",
      totalVentes: 800000,
      nombreVentes: 5,
      totalPaye: 750000,
    },
    {
      id: "client-2",
      nom: "Restaurant Le Silure",
      totalVentes: 700000,
      nombreVentes: 4,
      totalPaye: 700000,
    },
  ],
};

// ---------------------------------------------------------------------------
// GET /api/finances/resume
// ---------------------------------------------------------------------------
describe("GET /api/finances/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le resume financier complet", async () => {
    mockGetResumeFinancier.mockResolvedValue(FAKE_RESUME);

    const response = await GET_RESUME(makeRequest("/api/finances/resume"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("revenus");
    expect(data).toHaveProperty("coutsTotaux");
    expect(data).toHaveProperty("margeBrute");
    expect(data).toHaveProperty("tauxMarge");
    expect(data).toHaveProperty("encaissements");
    expect(data).toHaveProperty("creances");
    expect(data).toHaveProperty("prixMoyenVenteKg");
    expect(data).toHaveProperty("nombreVentes");
    expect(data).toHaveProperty("nombreFactures");
    expect(data.revenus).toBe(1500000);
    expect(data.margeBrute).toBe(1050000);
    expect(mockGetResumeFinancier).toHaveBeenCalledWith("site-1", undefined);
  });

  it("transmet les parametres de periode si fournis", async () => {
    mockGetResumeFinancier.mockResolvedValue(FAKE_RESUME);

    await GET_RESUME(
      makeRequest("/api/finances/resume?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(mockGetResumeFinancier).toHaveBeenCalledWith("site-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
  });

  it("ignore la periode si seulement dateFrom est fourni (sans dateTo)", async () => {
    mockGetResumeFinancier.mockResolvedValue(FAKE_RESUME);

    await GET_RESUME(makeRequest("/api/finances/resume?dateFrom=2026-01-01"));

    expect(mockGetResumeFinancier).toHaveBeenCalledWith("site-1", undefined);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_RESUME(makeRequest("/api/finances/resume"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission FINANCES_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_RESUME(makeRequest("/api/finances/resume"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetResumeFinancier.mockRejectedValue(new Error("DB error"));

    const response = await GET_RESUME(makeRequest("/api/finances/resume"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/finances/par-vague
// ---------------------------------------------------------------------------
describe("GET /api/finances/par-vague", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la rentabilite par vague avec le bon format", async () => {
    mockGetRentabiliteParVague.mockResolvedValue(FAKE_RENTABILITE);

    const response = await GET_PAR_VAGUE(makeRequest("/api/finances/par-vague"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("vagues");
    expect(data.vagues).toHaveLength(2);
    expect(data.vagues[0]).toHaveProperty("revenus");
    expect(data.vagues[0]).toHaveProperty("couts");
    expect(data.vagues[0]).toHaveProperty("marge");
    expect(data.vagues[0]).toHaveProperty("roi");
    expect(data.vagues[0]).toHaveProperty("poidsTotalVendu");
    expect(mockGetRentabiliteParVague).toHaveBeenCalledWith("site-1");
  });

  it("retourne une liste vide si aucune vague", async () => {
    mockGetRentabiliteParVague.mockResolvedValue({ vagues: [] });

    const response = await GET_PAR_VAGUE(makeRequest("/api/finances/par-vague"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vagues).toHaveLength(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_PAR_VAGUE(makeRequest("/api/finances/par-vague"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_PAR_VAGUE(makeRequest("/api/finances/par-vague"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetRentabiliteParVague.mockRejectedValue(new Error("DB error"));

    const response = await GET_PAR_VAGUE(makeRequest("/api/finances/par-vague"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/finances/evolution
// ---------------------------------------------------------------------------
describe("GET /api/finances/evolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne l'evolution financiere avec 12 mois par defaut", async () => {
    mockGetEvolutionFinanciere.mockResolvedValue(FAKE_EVOLUTION);

    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("evolution");
    expect(mockGetEvolutionFinanciere).toHaveBeenCalledWith("site-1", 12);
  });

  it("transmet le parametre mois personalise", async () => {
    mockGetEvolutionFinanciere.mockResolvedValue(FAKE_EVOLUTION);

    await GET_EVOLUTION(makeRequest("/api/finances/evolution?mois=6"));

    expect(mockGetEvolutionFinanciere).toHaveBeenCalledWith("site-1", 6);
  });

  it("accepte le maximum de 36 mois", async () => {
    mockGetEvolutionFinanciere.mockResolvedValue({ evolution: [] });

    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution?mois=36"));

    expect(response.status).toBe(200);
    expect(mockGetEvolutionFinanciere).toHaveBeenCalledWith("site-1", 36);
  });

  it("retourne les bonnes proprietes par mois", async () => {
    mockGetEvolutionFinanciere.mockResolvedValue(FAKE_EVOLUTION);

    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution"));
    const data = await response.json();

    expect(response.status).toBe(200);
    const premierMois = data.evolution[0];
    expect(premierMois).toHaveProperty("mois");
    expect(premierMois).toHaveProperty("revenus");
    expect(premierMois).toHaveProperty("couts");
    expect(premierMois).toHaveProperty("marge");
    expect(premierMois).toHaveProperty("encaissements");
  });

  it("retourne 400 si mois est inferieur a 1", async () => {
    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution?mois=0"));

    expect(response.status).toBe(400);
    expect(mockGetEvolutionFinanciere).not.toHaveBeenCalled();
  });

  it("retourne 400 si mois est superieur a 36", async () => {
    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution?mois=37"));

    expect(response.status).toBe(400);
    expect(mockGetEvolutionFinanciere).not.toHaveBeenCalled();
  });

  it("retourne 400 si mois n'est pas un entier", async () => {
    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution?mois=abc"));

    expect(response.status).toBe(400);
    expect(mockGetEvolutionFinanciere).not.toHaveBeenCalled();
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetEvolutionFinanciere.mockRejectedValue(new Error("DB error"));

    const response = await GET_EVOLUTION(makeRequest("/api/finances/evolution"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/finances/top-clients
// ---------------------------------------------------------------------------
describe("GET /api/finances/top-clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le top clients avec 5 par defaut", async () => {
    mockGetTopClients.mockResolvedValue(FAKE_TOP_CLIENTS);

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("clients");
    expect(mockGetTopClients).toHaveBeenCalledWith("site-1", 5);
  });

  it("transmet le parametre limit personalise", async () => {
    mockGetTopClients.mockResolvedValue(FAKE_TOP_CLIENTS);

    await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients?limit=10"));

    expect(mockGetTopClients).toHaveBeenCalledWith("site-1", 10);
  });

  it("accepte le maximum de 50 clients", async () => {
    mockGetTopClients.mockResolvedValue({ clients: [] });

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients?limit=50"));

    expect(response.status).toBe(200);
    expect(mockGetTopClients).toHaveBeenCalledWith("site-1", 50);
  });

  it("retourne les bonnes proprietes par client", async () => {
    mockGetTopClients.mockResolvedValue(FAKE_TOP_CLIENTS);

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients"));
    const data = await response.json();

    expect(response.status).toBe(200);
    const premierClient = data.clients[0];
    expect(premierClient).toHaveProperty("id");
    expect(premierClient).toHaveProperty("nom");
    expect(premierClient).toHaveProperty("totalVentes");
    expect(premierClient).toHaveProperty("nombreVentes");
    expect(premierClient).toHaveProperty("totalPaye");
  });

  it("retourne 400 si limit est inferieure a 1 (cas limite : 0)", async () => {
    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients?limit=0"));

    expect(response.status).toBe(400);
    expect(mockGetTopClients).not.toHaveBeenCalled();
  });

  it("retourne 400 si limit est superieure a 50 (cas limite : 51)", async () => {
    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients?limit=51"));

    expect(response.status).toBe(400);
    expect(mockGetTopClients).not.toHaveBeenCalled();
  });

  it("retourne 400 si limit est un nombre negatif", async () => {
    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients?limit=-5"));

    expect(response.status).toBe(400);
    expect(mockGetTopClients).not.toHaveBeenCalled();
  });

  it("retourne 400 si limit n'est pas un entier", async () => {
    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients?limit=abc"));

    expect(response.status).toBe(400);
    expect(mockGetTopClients).not.toHaveBeenCalled();
  });

  it("retourne une liste vide si aucun client", async () => {
    mockGetTopClients.mockResolvedValue({ clients: [] });

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.clients).toHaveLength(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission FINANCES_VOIR manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetTopClients.mockRejectedValue(new Error("DB error"));

    const response = await GET_TOP_CLIENTS(makeRequest("/api/finances/top-clients"));
    expect(response.status).toBe(500);
  });
});
