/**
 * Tests unitaires — route `GET`/`POST /api/previsions/scenarios/[id]/vagues/generer`
 * (Sprint PR2bis, story PR2bis.2).
 *
 * Cable enfin `genererPlanEmpoissonnement` (moteur pur, jusqu'ici teste
 * unitairement mais jamais appele depuis une route). Couvre :
 *  - 401 / 403 (auth/permissions), permission EXACTE (PREVISIONS_VOIR pour le
 *    dry-run GET, PREVISIONS_GERER pour l'ecriture POST).
 *  - 200/201 sur succes.
 *  - 400 sur payload invalide (horizonMois manquant/negatif/fractionnaire).
 *  - 404 (scenario introuvable, mappe par le pattern generique "introuvable").
 *  - 422 (ParametresPrevision absent — cas explicitement exige par la story).
 *  - Que le mode par defaut ("ajouter") est bien applique si omis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";
import { BusinessRuleError } from "@/lib/errors";

const mockRequirePermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
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
vi.mock("@/lib/errors", () => ({
  ValidationError: class ValidationError extends Error { constructor(message: string, public status: number = 400) { super(message); } },
  BusinessRuleError: class BusinessRuleError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } },
}));

const mockApercuGenerationPlan = vi.fn();
const mockGenererPlanVaguesPrevues = vi.fn();
vi.mock("@/lib/queries/previsions-vagues", () => ({
  apercuGenerationPlan: (...a: unknown[]) => mockApercuGenerationPlan(...a),
  genererPlanVaguesPrevues: (...a: unknown[]) => mockGenererPlanVaguesPrevues(...a),
}));

import { GET, POST } from "@/app/api/previsions/scenarios/[id]/vagues/generer/route";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "GERANT",
  activeSiteId: "site-1",
  siteRole: "GERANT",
  isSuperAdmin: false,
  permissions: Object.values(Permission),
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function jsonRequest(url: string, method: string, body: unknown) {
  return makeRequest(url, { method, body: JSON.stringify(body) });
}

const idParams = (id = "scenario-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET (aperçu, dry-run) — PREVISIONS_VOIR
// ---------------------------------------------------------------------------

describe("GET /api/previsions/scenarios/[id]/vagues/generer — aperçu", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3"),
      idParams()
    );
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_VOIR", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3"),
      idParams()
    );
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_VOIR et renvoie 200 avec le decompte", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockApercuGenerationPlan.mockResolvedValue({
      horizonMois: 3,
      mode: "ajouter",
      nombreVaguesRattacheesConservees: 0,
      nombreVaguesAnnuleesEtRemplacees: 0,
      nombreNouvellesVagues: 4,
      premiereDateStockagePrevue: "2026-08-01T00:00:00.000Z",
      derniereDateStockagePrevue: "2026-11-01T00:00:00.000Z",
      codesGeneres: ["V1", "V2", "V3", "V4"],
    });

    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3&mode=ajouter"),
      idParams()
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombreNouvellesVagues).toBe(4);
    expect(mockApercuGenerationPlan).toHaveBeenCalledWith("scenario-1", "site-1", 3, "ajouter");
  });

  it("400 si horizonMois est absent", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await GET(makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer"), idParams());
    expect(res.status).toBe(400);
    expect(mockApercuGenerationPlan).not.toHaveBeenCalled();
  });

  it("400 si horizonMois est negatif", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=-1"),
      idParams()
    );
    expect(res.status).toBe(400);
  });

  it("400 si horizonMois est fractionnaire", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3.5"),
      idParams()
    );
    expect(res.status).toBe(400);
  });

  it("mode par defaut 'ajouter' si omis", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockApercuGenerationPlan.mockResolvedValue({
      horizonMois: 3,
      mode: "ajouter",
      nombreVaguesRattacheesConservees: 0,
      nombreVaguesAnnuleesEtRemplacees: 0,
      nombreNouvellesVagues: 0,
      premiereDateStockagePrevue: null,
      derniereDateStockagePrevue: null,
      codesGeneres: [],
    });

    await GET(makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3"), idParams());

    expect(mockApercuGenerationPlan).toHaveBeenCalledWith("scenario-1", "site-1", 3, "ajouter");
  });

  it("404 si le scenario est introuvable", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockApercuGenerationPlan.mockRejectedValue(new Error("Scenario introuvable"));

    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3"),
      idParams()
    );
    expect(res.status).toBe(404);
  });

  it("422 si ParametresPrevision est absent pour ce scenario", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockApercuGenerationPlan.mockRejectedValue(
      new BusinessRuleError("ParametresPrevision absent pour ce scenario. Renseignez l'onglet Parametres avant de generer un plan.", 422)
    );

    const res = await GET(
      makeRequest("/api/previsions/scenarios/scenario-1/vagues/generer?horizonMois=3"),
      idParams()
    );
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST (generation reelle) — PREVISIONS_GERER
// ---------------------------------------------------------------------------

describe("POST /api/previsions/scenarios/[id]/vagues/generer — generation", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", { horizonMois: 3 }),
      idParams()
    );
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_GERER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", { horizonMois: 3 }),
      idParams()
    );
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_GERER, thread activeSiteId (R8), et renvoie 201 avec les vagues creees", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGenererPlanVaguesPrevues.mockResolvedValue([{ id: "vp-1", code: "V1" }, { id: "vp-2", code: "V2" }]);

    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", {
        horizonMois: 3,
        mode: "ajouter",
      }),
      idParams()
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_GERER);
    expect(mockGenererPlanVaguesPrevues).toHaveBeenCalledWith("scenario-1", "site-1", 3, "ajouter");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it("mode par defaut 'ajouter' si omis du payload", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGenererPlanVaguesPrevues.mockResolvedValue([]);

    await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", { horizonMois: 3 }),
      idParams()
    );

    expect(mockGenererPlanVaguesPrevues).toHaveBeenCalledWith("scenario-1", "site-1", 3, "ajouter");
  });

  it("400 si horizonMois est absent du payload", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", {}),
      idParams()
    );
    expect(res.status).toBe(400);
    expect(mockGenererPlanVaguesPrevues).not.toHaveBeenCalled();
  });

  it("400 si mode a une valeur hors enum", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", {
        horizonMois: 3,
        mode: "purger",
      }),
      idParams()
    );
    expect(res.status).toBe(400);
  });

  it("404 si le scenario est introuvable (aucune vague generee cote query, propage tel quel)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGenererPlanVaguesPrevues.mockRejectedValue(new Error("Scenario introuvable"));

    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", { horizonMois: 3 }),
      idParams()
    );
    expect(res.status).toBe(404);
  });

  it("422 si ParametresPrevision est absent pour ce scenario", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGenererPlanVaguesPrevues.mockRejectedValue(
      new BusinessRuleError("ParametresPrevision absent pour ce scenario. Renseignez l'onglet Parametres avant de generer un plan.", 422)
    );

    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", { horizonMois: 3 }),
      idParams()
    );
    expect(res.status).toBe(422);
  });

  it("201 avec un tableau vide si aucune nouvelle vague n'est generee (horizon deja couvert)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGenererPlanVaguesPrevues.mockResolvedValue([]);

    const res = await POST(
      jsonRequest("/api/previsions/scenarios/scenario-1/vagues/generer", "POST", { horizonMois: 0 }),
      idParams()
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
