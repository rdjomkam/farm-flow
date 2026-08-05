/**
 * Tests unitaires — route `PATCH /api/previsions/postes-referentiel/[id]`
 * (ADR-053 §16.12, story A.5, "Arbitrage 1"). Couvre : 401/403, permission
 * EXACTE (PREVISIONS_PARAMETRER), site-scoping (404, jamais 403, pour une
 * entree d'un autre site ou absente), refus explicite de `code` dans le
 * body (schema `.strict()`), 200 sur succes (thread activeSiteId — R8).
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

const mockRenommerPosteReferentiel = vi.fn();
vi.mock("@/lib/queries/previsions-postes-referentiel", () => ({
  renommerPosteReferentiel: (...a: unknown[]) => mockRenommerPosteReferentiel(...a),
}));

import { PATCH } from "@/app/api/previsions/postes-referentiel/[id]/route";
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

function patchRequest(body: unknown) {
  return new NextRequest(new URL("/api/previsions/postes-referentiel/ref-1", "http://localhost:3000"), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const idParams = (id = "ref-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/previsions/postes-referentiel/[id]", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await PATCH(patchRequest({ libelle: "Salaires" }), idParams());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await PATCH(patchRequest({ libelle: "Salaires" }), idParams());
    expect(res.status).toBe(403);
  });

  it("400 si le body contient `code` (schema .strict() — refuse explicitement, ne l'ignore jamais silencieusement)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await PATCH(patchRequest({ libelle: "Salaires", code: "salaires-hack" }), idParams());
    expect(res.status).toBe(400);
    expect(mockRenommerPosteReferentiel).not.toHaveBeenCalled();
  });

  it("400 si libelle absent ou vide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await PATCH(patchRequest({}), idParams());
    expect(res.status).toBe(400);
    expect(mockRenommerPosteReferentiel).not.toHaveBeenCalled();
  });

  it("200 : renomme via activeSiteId (R8, jamais un siteId du body), retourne l'entree renommee avec ses decomptes (R3, ERR-188)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockRenommerPosteReferentiel.mockResolvedValue({
      id: "ref-1",
      siteId: "site-1",
      code: "salaires",
      libelle: "Salaires equipe",
      actif: true,
      nbPostesRattaches: 2,
      nbMappingsRattaches: 1,
    });

    const res = await PATCH(patchRequest({ libelle: "Salaires equipe" }), idParams());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(mockRenommerPosteReferentiel).toHaveBeenCalledWith("ref-1", "site-1", "Salaires equipe");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.libelle).toBe("Salaires equipe");
    expect(body.code).toBe("salaires"); // code inchange
    expect(body.nbPostesRattaches).toBe(2);
    expect(body.nbMappingsRattaches).toBe(1);
  });

  it("404 (jamais 403) si l'entree est introuvable ou d'un autre site", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockRenommerPosteReferentiel.mockRejectedValue(new Error("PosteReferentiel introuvable"));

    const res = await PATCH(patchRequest({ libelle: "Salaires" }), idParams("ref-autre-site"));
    expect(res.status).toBe(404);
  });
});
