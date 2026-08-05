/**
 * Tests unitaires — route `GET /api/previsions/postes-referentiel`
 * (ADR-053 §16, story A.4). Couvre : 401/403, permission EXACTE
 * (PREVISIONS_VOIR), 200 sur succes (thread activeSiteId — R8, jamais un
 * scenarioId ni aucun id d'un autre site), bac vide.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

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

const mockListerPostesReferentielActifs = vi.fn();
vi.mock("@/lib/queries/previsions-postes-referentiel", () => ({
  listerPostesReferentielActifs: (...a: unknown[]) => mockListerPostesReferentielActifs(...a),
}));

import { GET } from "@/app/api/previsions/postes-referentiel/route";
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
  return new NextRequest(new URL("/api/previsions/postes-referentiel", "http://localhost:3000"), {
    method: "GET",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/postes-referentiel", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_VOIR", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await GET(getRequest());
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_VOIR, thread activeSiteId (R8 — jamais un scenarioId, cette route est SITE-scope), 200 avec le referentiel", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListerPostesReferentielActifs.mockResolvedValue([
      { id: "ref-1", siteId: "site-1", code: "salaires", libelle: "Salaires", actif: true },
    ]);

    const res = await GET(getRequest());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    // R8 : le filtre passe TOUJOURS par activeSiteId de la session — jamais
    // un id fourni par la query string (aucun parametre scenarioId n'existe
    // pour cette route, contrairement a GET /mapping-rapprochement).
    expect(mockListerPostesReferentielActifs).toHaveBeenCalledWith("site-1");
    expect(mockListerPostesReferentielActifs).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([{ id: "ref-1", siteId: "site-1", code: "salaires", libelle: "Salaires", actif: true }]);
  });

  it("200 avec un tableau vide quand aucune entree referentiel n'existe encore sur ce site (jamais une erreur)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListerPostesReferentielActifs.mockResolvedValue([]);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("500 explicite (jamais un ecran blanc) si la query echoue", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListerPostesReferentielActifs.mockRejectedValue(new Error("DB down"));

    const res = await GET(getRequest());
    expect(res.status).toBe(500);
  });
});
