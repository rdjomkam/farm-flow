/**
 * Tests unitaires — route `POST /api/previsions/postes/[id]/charges/reporter`
 * (Sprint PR2-ter, story PR2ter.1).
 *
 * Couvre : 401/403 (auth/permissions), permission EXACTE (PREVISIONS_GERER),
 * 200 sur succes (thread activeSiteId — R8), 400 (payload invalide : montant
 * negatif, moisFinAbsolu < moisDebutAbsolu, mois fractionnaire), 404 (poste
 * introuvable), 400 (garde assertEntierColonneInt propagee par la query).
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

const mockReporterChargeMensuelle = vi.fn();
vi.mock("@/lib/queries/previsions-charges", () => ({
  reporterChargeMensuelle: (...a: unknown[]) => mockReporterChargeMensuelle(...a),
}));

import { POST } from "@/app/api/previsions/postes/[id]/charges/reporter/route";
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

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const idParams = (id = "poste-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/previsions/postes/[id]/charges/reporter", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 100000,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 5,
      }),
      idParams()
    );
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_GERER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 100000,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 5,
      }),
      idParams()
    );
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_GERER, thread activeSiteId (R8), et renvoie 200 avec les lignes creees", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockReporterChargeMensuelle.mockResolvedValue([
      { id: "c1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: 500000 },
      { id: "c2", posteId: "poste-1", moisAbsolu: 1, montantFCFA: 500000 },
    ]);

    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 500000,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 1,
      }),
      idParams()
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_GERER);
    expect(mockReporterChargeMensuelle).toHaveBeenCalledWith("poste-1", "site-1", 500000, 0, 1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it("400 si montantFCFA est negatif", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: -1,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 5,
      }),
      idParams()
    );
    expect(res.status).toBe(400);
    expect(mockReporterChargeMensuelle).not.toHaveBeenCalled();
  });

  it("400 si moisFinAbsolu < moisDebutAbsolu", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 100000,
        moisDebutAbsolu: 5,
        moisFinAbsolu: 2,
      }),
      idParams()
    );
    expect(res.status).toBe(400);
    expect(mockReporterChargeMensuelle).not.toHaveBeenCalled();
  });

  it("400 si moisDebutAbsolu est fractionnaire", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 100000,
        moisDebutAbsolu: 1.5,
        moisFinAbsolu: 5,
      }),
      idParams()
    );
    expect(res.status).toBe(400);
    expect(mockReporterChargeMensuelle).not.toHaveBeenCalled();
  });

  it("400 si les champs obligatoires sont absents du payload", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {}),
      idParams()
    );
    expect(res.status).toBe(400);
    expect(mockReporterChargeMensuelle).not.toHaveBeenCalled();
  });

  it("404 si le poste est introuvable", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockReporterChargeMensuelle.mockRejectedValue(new Error("PostePrevision introuvable"));

    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 100000,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 5,
      }),
      idParams()
    );
    expect(res.status).toBe(404);
  });

  it("propage en erreur (mappee 400) la garde assertEntierColonneInt levee cote query", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockReporterChargeMensuelle.mockRejectedValue(
      new BusinessRuleError("moisDebutAbsolu doit etre un entier (colonne Prisma Int) — valeur recue : 1.5.", 400)
    );

    const res = await POST(
      jsonRequest("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 100000,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 5,
      }),
      idParams()
    );
    expect(res.status).toBe(400);
  });
});
