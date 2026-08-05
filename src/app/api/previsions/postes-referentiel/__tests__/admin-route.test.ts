/**
 * Tests unitaires — route `GET /api/previsions/postes-referentiel/admin`
 * (ADR-053 §16.12, story A.5). Couvre : 401/403, permission EXACTE
 * (PREVISIONS_PARAMETRER, distincte de PREVISIONS_VOIR utilisee par la
 * route non-admin), thread activeSiteId (R8), 200 avec actives ET
 * inactives (contrairement a la route non-admin, actifs seuls).
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

const mockListerPostesReferentielAdmin = vi.fn();
vi.mock("@/lib/queries/previsions-postes-referentiel", () => ({
  listerPostesReferentielAdmin: (...a: unknown[]) => mockListerPostesReferentielAdmin(...a),
}));

import { GET } from "@/app/api/previsions/postes-referentiel/admin/route";
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
  return new NextRequest(new URL("/api/previsions/postes-referentiel/admin", "http://localhost:3000"), {
    method: "GET",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/postes-referentiel/admin", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await GET(getRequest());
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_PARAMETRER (distinct de PREVISIONS_VOIR), thread activeSiteId (R8), 200 avec actives ET inactives", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListerPostesReferentielAdmin.mockResolvedValue([
      { id: "ref-1", siteId: "site-1", code: "salaires", libelle: "Salaires", actif: true },
      { id: "ref-2", siteId: "site-1", code: "loyer", libelle: "Loyer", actif: false },
    ]);

    const res = await GET(getRequest());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(mockListerPostesReferentielAdmin).toHaveBeenCalledWith("site-1");
    expect(mockListerPostesReferentielAdmin).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data.some((e: { actif: boolean }) => !e.actif)).toBe(true);
  });

  it("500 explicite si la query echoue", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListerPostesReferentielAdmin.mockRejectedValue(new Error("DB down"));

    const res = await GET(getRequest());
    expect(res.status).toBe(500);
  });
});
