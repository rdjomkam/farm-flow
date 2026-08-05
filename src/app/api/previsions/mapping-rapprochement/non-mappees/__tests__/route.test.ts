/**
 * Tests unitaires — route `GET /api/previsions/mapping-rapprochement/non-mappees`
 * (Sprint PR3, story PR3.6). Couvre : 401/403, permission EXACTE
 * (PREVISIONS_VOIR), 200 sur succes (thread activeSiteId — R8), bac vide.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, SourceRapprochement } from "@/types";

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

const mockGetCategoriesReellesNonMappees = vi.fn();
vi.mock("@/lib/queries/previsions-rapprochement-mapping", () => ({
  getCategoriesReellesNonMappees: (...a: unknown[]) => mockGetCategoriesReellesNonMappees(...a),
}));

import { GET } from "@/app/api/previsions/mapping-rapprochement/non-mappees/route";
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
  return new NextRequest(new URL("/api/previsions/mapping-rapprochement/non-mappees", "http://localhost:3000"), {
    method: "GET",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/mapping-rapprochement/non-mappees", () => {
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

  it("exige exactement PREVISIONS_VOIR, thread activeSiteId (R8), 200 avec le bac non-mappe", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetCategoriesReellesNonMappees.mockResolvedValue([
      { sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" },
    ]);

    const res = await GET(getRequest());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    expect(mockGetCategoriesReellesNonMappees).toHaveBeenCalledWith("site-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }]);
  });

  it("200 avec une categorie MOUVEMENT_STOCK (granulometrie) dans le bac non-mappe", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetCategoriesReellesNonMappees.mockResolvedValue([
      { sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G2" },
    ]);

    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G2" }]);
  });

  it("200 avec un tableau vide quand tout est deja mappe (jamais une erreur)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetCategoriesReellesNonMappees.mockResolvedValue([]);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
