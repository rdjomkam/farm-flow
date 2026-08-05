/**
 * Tests unitaires — route `GET /api/previsions/scenarios/[id]/tresorerie`
 * (Sprint PR3-ter, story B.3). Reference ADR-053 §6.5, §15.1(b), §15.2.
 *
 * Couvre : 401/403, permission EXACTE (PREVISIONS_VOIR), 200 sur succes
 * (thread scenarioId + activeSiteId — R8), serialisation Decimal -> number
 * (y compris `budgetInitialFCFA: null`), propagation des DEUX caveats
 * (jamais avales), 404 (scenario introuvable, propage).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";
import { Decimal } from "@/lib/previsions/decimal-config";

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

const mockGetTresorerieTroisSeries = vi.fn();
vi.mock("@/lib/queries/previsions-tresorerie-trois-series", () => ({
  getTresorerieTroisSeries: (...a: unknown[]) => mockGetTresorerieTroisSeries(...a),
}));

import { GET } from "@/app/api/previsions/scenarios/[id]/tresorerie/route";
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
  return new NextRequest(
    new URL("/api/previsions/scenarios/scenario-1/tresorerie", "http://localhost:3000"),
    { method: "GET" }
  );
}
const idParams = (id = "scenario-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/scenarios/[id]/tresorerie", () => {
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

  it("404 si le scenario est introuvable (propage depuis chargerScenarioPourMoteur)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetTresorerieTroisSeries.mockRejectedValue(new Error("Scenario introuvable"));
    const res = await GET(getRequest(), idParams());
    expect(res.status).toBe(404);
  });

  it("exige exactement PREVISIONS_VOIR, thread scenarioId + activeSiteId (R8), 200", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetTresorerieTroisSeries.mockResolvedValue({
      scenarioId: "scenario-1",
      horizonMois: 2,
      budgetInitialDisponible: true,
      series: [
        {
          moisAbsolu: 0,
          budgetInitialFCFA: new Decimal(100000),
          previsionActualiseeFCFA: new Decimal(120000),
          reelFCFA: new Decimal(90000),
          caveatApportsReelsNonModelises: true,
        },
        {
          moisAbsolu: 1,
          budgetInitialFCFA: null,
          previsionActualiseeFCFA: new Decimal(200000),
          reelFCFA: new Decimal(0),
          caveatApportsReelsNonModelises: true,
        },
      ],
      reprevisionGlissante: [
        {
          moisAbsolu: 0,
          source: "REEL",
          soldeMensuelFCFA: new Decimal(90000),
          soldeCumuleFCFA: new Decimal(90000),
          caveatSerieReelleIncomplete: true,
        },
        {
          moisAbsolu: 1,
          source: "PREVISION_ACTUALISEE",
          soldeMensuelFCFA: new Decimal(80000),
          soldeCumuleFCFA: new Decimal(170000),
          caveatSerieReelleIncomplete: true,
        },
      ],
      caveatSerieReelleIncomplete: true,
      calculeLe: new Date("2026-08-05T00:00:00.000Z"),
    });

    const res = await GET(getRequest(), idParams());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_VOIR);
    expect(mockGetTresorerieTroisSeries).toHaveBeenCalledWith("scenario-1", "site-1");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.horizonMois).toBe(2);
    expect(body.budgetInitialDisponible).toBe(true);

    // Serialisation Decimal -> number, y compris le cas null explicite
    // (budget initial jamais fige sur un mois post-activation) :
    expect(body.series[0].budgetInitialFCFA).toBe(100000);
    expect(body.series[0].previsionActualiseeFCFA).toBe(120000);
    expect(body.series[0].reelFCFA).toBe(90000);
    expect(body.series[1].budgetInitialFCFA).toBeNull();

    // Les DEUX caveats sont propages JUSQU'AU JSON, jamais avales :
    expect(body.series[0].caveatApportsReelsNonModelises).toBe(true);
    expect(body.series[1].caveatApportsReelsNonModelises).toBe(true);
    expect(body.caveatSerieReelleIncomplete).toBe(true);
    expect(body.reprevisionGlissante[0].caveatSerieReelleIncomplete).toBe(true);

    // PRÉVISION ACTUALISÉE != Reprevision : source distincte par mois, pas
    // une simple copie de la serie prevision actualisee.
    expect(body.reprevisionGlissante[0].source).toBe("REEL");
    expect(body.reprevisionGlissante[0].soldeMensuelFCFA).toBe(90000);
    expect(body.reprevisionGlissante[1].source).toBe("PREVISION_ACTUALISEE");
  });
});
