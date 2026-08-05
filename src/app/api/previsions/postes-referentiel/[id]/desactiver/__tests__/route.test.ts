/**
 * Tests unitaires — route `POST /api/previsions/postes-referentiel/[id]/desactiver`
 * (ADR-053 §16.12, story A.5, "Arbitrage 2"). Couvre : 401/403, permission
 * EXACTE (PREVISIONS_PARAMETRER), site-scoping (404, jamais 403), 200 sur
 * succes ET sur idempotence (deja desactivee — jamais 409).
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

const mockDesactiverPosteReferentiel = vi.fn();
vi.mock("@/lib/queries/previsions-postes-referentiel", () => ({
  desactiverPosteReferentiel: (...a: unknown[]) => mockDesactiverPosteReferentiel(...a),
}));

import { POST } from "@/app/api/previsions/postes-referentiel/[id]/desactiver/route";
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

function postRequest() {
  return new NextRequest(new URL("/api/previsions/postes-referentiel/ref-1/desactiver", "http://localhost:3000"), {
    method: "POST",
  });
}

const idParams = (id = "ref-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/previsions/postes-referentiel/[id]/desactiver", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await POST(postRequest(), idParams());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await POST(postRequest(), idParams());
    expect(res.status).toBe(403);
  });

  it("200 : desactive via activeSiteId (R8), retourne l'entree desactivee avec ses decomptes (R3, ERR-188)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDesactiverPosteReferentiel.mockResolvedValue({
      id: "ref-1",
      siteId: "site-1",
      code: "salaires",
      libelle: "Salaires",
      actif: false,
      nbPostesRattaches: 2,
      nbMappingsRattaches: 1,
    });

    const res = await POST(postRequest(), idParams());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(mockDesactiverPosteReferentiel).toHaveBeenCalledWith("ref-1", "site-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actif).toBe(false);
    expect(body.nbPostesRattaches).toBe(2);
    expect(body.nbMappingsRattaches).toBe(1);
  });

  it("200 (idempotent, JAMAIS 409) si l'entree est deja desactivee — decomptes toujours presents (pas undefined)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDesactiverPosteReferentiel.mockResolvedValue({
      id: "ref-1",
      siteId: "site-1",
      code: "salaires",
      libelle: "Salaires",
      actif: false,
      nbPostesRattaches: 2,
      nbMappingsRattaches: 1,
    });

    const res = await POST(postRequest(), idParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nbPostesRattaches).toBe(2);
    expect(body.nbMappingsRattaches).toBe(1);
  });

  it("404 (jamais 403) si l'entree est introuvable ou d'un autre site", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDesactiverPosteReferentiel.mockRejectedValue(new Error("PosteReferentiel introuvable"));

    const res = await POST(postRequest(), idParams("ref-autre-site"));
    expect(res.status).toBe(404);
  });
});
