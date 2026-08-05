/**
 * Tests unitaires — routes `GET`/`POST /api/previsions/scenarios/[id]/clotures`
 * (Sprint PR3, story PR3.6). Reference ADR-053 §3.10/§15.3.
 *
 * Couvre : 401/403, permission EXACTE (VOIR en lecture, CLOTURER en
 * ecriture — jamais GERER ni PARAMETRER), 200/201 sur succes (thread
 * activeSiteId ET userId — R8), 400 (payload invalide), 404 (scenario
 * introuvable, propage), 409 (double cloture), 422 (hors horizon).
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
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public status: number = 400) {
      super(message);
    }
  },
  BusinessRuleError: class BusinessRuleError extends Error {
    constructor(message: string, public status: number, public code?: string) {
      super(message);
    }
  },
}));

const mockGetCloturesMois = vi.fn();
const mockCloturerMois = vi.fn();
vi.mock("@/lib/queries/previsions-cloture", () => ({
  getCloturesMois: (...a: unknown[]) => mockGetCloturesMois(...a),
  cloturerMois: (...a: unknown[]) => mockCloturerMois(...a),
}));

import { GET, POST } from "@/app/api/previsions/scenarios/[id]/clotures/route";
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

function getRequest() {
  return new NextRequest(new URL("/api/previsions/scenarios/scenario-1/clotures", "http://localhost:3000"), {
    method: "GET",
  });
}
function postRequest(body: unknown) {
  return new NextRequest(new URL("/api/previsions/scenarios/scenario-1/clotures", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const idParams = (id = "scenario-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/scenarios/[id]/clotures", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await GET(getRequest(), idParams());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_VOIR", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await GET(getRequest(), idParams());
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_VOIR, thread scenarioId + activeSiteId (R8), 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetCloturesMois.mockResolvedValue([
      { id: "c1", scenarioId: "scenario-1", moisAbsolu: 0, versionMapping: 1 },
    ]);

    const res = await GET(getRequest(), idParams());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    expect(mockGetCloturesMois).toHaveBeenCalledWith("scenario-1", "site-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/previsions/scenarios/[id]/clotures", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await POST(postRequest({ moisAbsolu: 0 }), idParams());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_CLOTURER (ex: possede seulement PREVISIONS_GERER)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await POST(postRequest({ moisAbsolu: 0 }), idParams());
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_CLOTURER (jamais GERER ni PARAMETRER), thread scenarioId + activeSiteId + userId (R8), 201", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCloturerMois.mockResolvedValue({
      id: "c1",
      scenarioId: "scenario-1",
      moisAbsolu: 0,
      versionMapping: 3,
      clotureeParId: "user-1",
    });

    const res = await POST(postRequest({ moisAbsolu: 0 }), idParams());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_CLOTURER);
    expect(mockCloturerMois).toHaveBeenCalledWith("scenario-1", "site-1", 0, "user-1");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.versionMapping).toBe(3);
  });

  it("400 si moisAbsolu est absent du payload", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(postRequest({}), idParams());
    expect(res.status).toBe(400);
    expect(mockCloturerMois).not.toHaveBeenCalled();
  });

  it("400 si moisAbsolu est fractionnaire", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(postRequest({ moisAbsolu: 1.5 }), idParams());
    expect(res.status).toBe(400);
    expect(mockCloturerMois).not.toHaveBeenCalled();
  });

  it("404 si le scenario est introuvable (propage depuis chargerScenarioPourMoteur)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCloturerMois.mockRejectedValue(new Error("Scenario introuvable"));
    const res = await POST(postRequest({ moisAbsolu: 0 }), idParams());
    expect(res.status).toBe(404);
  });

  it("409 si le mois est deja cloture — jamais une seconde cloture silencieuse", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCloturerMois.mockRejectedValue(
      new BusinessRuleError("Le mois 0 de ce scenario est deja cloture.", 409)
    );
    const res = await POST(postRequest({ moisAbsolu: 0 }), idParams());
    expect(res.status).toBe(409);
  });

  it("422 si le mois est hors de l'horizon du plan", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCloturerMois.mockRejectedValue(
      new BusinessRuleError("Le mois 99 est hors de l'horizon du plan (mois valides : 0 a 20).", 422)
    );
    const res = await POST(postRequest({ moisAbsolu: 99 }), idParams());
    expect(res.status).toBe(422);
  });
});
