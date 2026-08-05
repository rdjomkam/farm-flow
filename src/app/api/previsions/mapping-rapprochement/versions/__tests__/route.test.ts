/**
 * Tests unitaires — route `GET /api/previsions/mapping-rapprochement/versions`
 * (Sprint PR3-ter, story C.3). Couvre : 401/403, permission EXACTE
 * (PREVISIONS_VOIR), 200 sur succes (thread activeSiteId — R8), liste vide,
 * ordre decroissant transmis tel quel (jamais retrie ici).
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

const mockGetVersionsDisponibles = vi.fn();
vi.mock("@/lib/queries/previsions-rapprochement-mapping", () => ({
  getVersionsDisponibles: (...a: unknown[]) => mockGetVersionsDisponibles(...a),
}));

import { GET } from "@/app/api/previsions/mapping-rapprochement/versions/route";
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
  return new NextRequest(new URL("/api/previsions/mapping-rapprochement/versions", "http://localhost:3000"), {
    method: "GET",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/mapping-rapprochement/versions", () => {
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

  it("exige exactement PREVISIONS_VOIR, thread activeSiteId (R8), 200 avec les versions DECROISSANTES telles que renvoyees par la query", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetVersionsDisponibles.mockResolvedValue([3, 2, 1]);

    const res = await GET(getRequest());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    expect(mockGetVersionsDisponibles).toHaveBeenCalledWith("site-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([3, 2, 1]);
  });

  it("200 avec un tableau vide quand aucun mapping n'a jamais ete cree pour ce site", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetVersionsDisponibles.mockResolvedValue([]);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
