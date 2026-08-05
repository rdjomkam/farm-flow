/**
 * Tests unitaires — routes `GET`/`POST /api/previsions/mapping-rapprochement`
 * (Sprint PR3, story PR3.6). Reference ADR-053 §3.9/§15.3.
 *
 * Couvre : 401/403 (auth/permissions), permission EXACTE (VOIR en lecture,
 * PARAMETRER en ecriture), 200/201 sur succes (thread activeSiteId — R8),
 * lecture par version explicite (?version=N), 400 (payload/version invalide),
 * 422 propage (version vide, cf. `creerVersionMapping`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, SourceRapprochement, CibleRapprochement } from "@/types";
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

const mockGetMappingActif = vi.fn();
const mockGetMappingParVersion = vi.fn();
const mockCreerVersionMapping = vi.fn();
vi.mock("@/lib/queries/previsions-rapprochement-mapping", () => ({
  getMappingActif: (...a: unknown[]) => mockGetMappingActif(...a),
  getMappingParVersion: (...a: unknown[]) => mockGetMappingParVersion(...a),
  creerVersionMapping: (...a: unknown[]) => mockCreerVersionMapping(...a),
}));

import { GET, POST } from "@/app/api/previsions/mapping-rapprochement/route";
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

function getRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method: "GET" });
}
function postRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/mapping-rapprochement", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await GET(getRequest("/api/previsions/mapping-rapprochement"));
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_VOIR", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await GET(getRequest("/api/previsions/mapping-rapprochement"));
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_VOIR, thread activeSiteId (R8), et lit le mapping ACTIF sans query param", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetMappingActif.mockResolvedValue([
      { id: "m1", version: 2, sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "ALIMENT", cibleType: CibleRapprochement.POSTE_PREVISION, cibleId: "poste-1", actif: true },
    ]);

    const res = await GET(getRequest("/api/previsions/mapping-rapprochement"));

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    expect(mockGetMappingActif).toHaveBeenCalledWith("site-1");
    expect(mockGetMappingParVersion).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.version).toBe(2);
  });

  it("lit une version PRECISE quand ?version=N est fourni — jamais le mapping actif", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetMappingParVersion.mockResolvedValue([
      { id: "m0", version: 1, sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "ALIMENT", cibleType: CibleRapprochement.NON_RAPPROCHE, cibleId: null, actif: false },
    ]);

    const res = await GET(getRequest("/api/previsions/mapping-rapprochement?version=1"));

    expect(mockGetMappingParVersion).toHaveBeenCalledWith("site-1", 1);
    expect(mockGetMappingActif).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(1);
  });

  it("400 si le query param version n'est pas un entier", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await GET(getRequest("/api/previsions/mapping-rapprochement?version=abc"));
    expect(res.status).toBe(400);
    expect(mockGetMappingActif).not.toHaveBeenCalled();
    expect(mockGetMappingParVersion).not.toHaveBeenCalled();
  });
});

describe("POST /api/previsions/mapping-rapprochement", () => {
  const lignePayload = {
    sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
    sourceCle: "ALIMENT",
    cibleType: CibleRapprochement.POSTE_PREVISION,
    cibleId: "poste-1",
  };

  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await POST(postRequest("/api/previsions/mapping-rapprochement", { lignes: [lignePayload] }));
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await POST(postRequest("/api/previsions/mapping-rapprochement", { lignes: [lignePayload] }));
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_PARAMETRER (jamais PREVISIONS_GERER), thread activeSiteId (R8), 201 sur succes", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreerVersionMapping.mockResolvedValue([{ id: "m2", version: 2, ...lignePayload, actif: true }]);

    const res = await POST(postRequest("/api/previsions/mapping-rapprochement", { lignes: [lignePayload] }));

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(mockCreerVersionMapping).toHaveBeenCalledWith("site-1", [lignePayload]);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("400 si 'lignes' est absent du payload", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(postRequest("/api/previsions/mapping-rapprochement", {}));
    expect(res.status).toBe(400);
    expect(mockCreerVersionMapping).not.toHaveBeenCalled();
  });

  it("400 si 'lignes' est un tableau vide (garde cote zod, avant meme la query)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(postRequest("/api/previsions/mapping-rapprochement", { lignes: [] }));
    expect(res.status).toBe(400);
    expect(mockCreerVersionMapping).not.toHaveBeenCalled();
  });

  it("propage le statut 422 d'une BusinessRuleError levee par la query (filet de securite cote base)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreerVersionMapping.mockRejectedValue(
      new BusinessRuleError("Le mapping doit contenir au moins une ligne.", 422)
    );
    const res = await POST(postRequest("/api/previsions/mapping-rapprochement", { lignes: [lignePayload] }));
    expect(res.status).toBe(422);
  });
});
