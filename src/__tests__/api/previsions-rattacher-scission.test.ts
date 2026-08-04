/**
 * Tests unitaires — Flux de scission (ADR-053 decision 2, Sprint PR2, story
 * PR2.2) : `POST /vagues-prevues/[id]/rattacher` doit distinguer le P2002
 * specifique a `Vague.vaguePrevueId` (deja rattachee -> flux de scission) de
 * tout autre P2002 generique du module (traitement indistinct existant).
 *
 * Couvre aussi `POST /vagues-prevues/[id]/scinder` (le parent passe a
 * ANNULEE, les enfants portent vaguePrevueParentId) et l'absence structurelle
 * de toute route DELETE sur vagues-prevues.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

const mockRequirePermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock("@/lib/auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/errors", () => ({ ValidationError: class ValidationError extends Error {} }));

const mockRattacherVaguePrevue = vi.fn();
const mockScinderVaguePrevue = vi.fn();
vi.mock("@/lib/queries/previsions-vagues", () => ({
  rattacherVaguePrevue: (...a: unknown[]) => mockRattacherVaguePrevue(...a),
  scinderVaguePrevue: (...a: unknown[]) => mockScinderVaguePrevue(...a),
  getVaguesPrevuesParScenario: vi.fn(),
  createVaguePrevue: vi.fn(),
  getVaguePrevueById: vi.fn(),
  updateVaguePrevue: vi.fn(),
  annulerVaguePrevue: vi.fn(),
  replaceAlimentsParVaguePrevue: vi.fn(),
  updateSacsSaisis: vi.fn(),
}));

import { POST as rattacherPOST } from "@/app/api/previsions/vagues-prevues/[id]/rattacher/route";
import { POST as scinderPOST } from "@/app/api/previsions/vagues-prevues/[id]/scinder/route";

const AUTH_CONTEXT = {
  userId: "user-1",
  activeSiteId: "site-1",
  permissions: Object.values(Permission),
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method, body: JSON.stringify(body) });
}
const idParams = { params: Promise.resolve({ id: "vp-7" }) };

class PrismaKnownError extends Error {
  code: string;
  meta?: { target?: string[] };
  constructor(message: string, code: string, meta?: { target?: string[] }) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

describe("POST /vagues-prevues/[id]/rattacher — flux de scission (ADR-053 decision 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("rattache avec succes une premiere vague reelle (200, pas de code d'erreur)", async () => {
    mockRattacherVaguePrevue.mockResolvedValue({ id: "vague-1", vaguePrevueId: "vp-7" });

    const response = await rattacherPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/rattacher", "POST", { vagueId: "vague-1" }),
      idParams
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).toBeUndefined();
  });

  it("P2002 specifique sur vaguePrevueId -> 409 avec code VAGUE_PREVUE_DEJA_RATTACHEE et vaguePrevueId dans le corps", async () => {
    mockRattacherVaguePrevue.mockRejectedValue(
      new PrismaKnownError("Unique constraint failed", "P2002", { target: ["vaguePrevueId"] })
    );

    const response = await rattacherPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/rattacher", "POST", { vagueId: "vague-2" }),
      idParams
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe("VAGUE_PREVUE_DEJA_RATTACHEE");
    expect(data.vaguePrevueId).toBe("vp-7");
  });

  it("un P2002 sur un AUTRE champ (ex. code de scenario dupliqué au meme instant) reste le traitement generique, pas le code de scission", async () => {
    mockRattacherVaguePrevue.mockRejectedValue(
      new PrismaKnownError("Unique constraint failed", "P2002", { target: ["code"] })
    );

    const response = await rattacherPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/rattacher", "POST", { vagueId: "vague-2" }),
      idParams
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).not.toBe("VAGUE_PREVUE_DEJA_RATTACHEE");
  });

  it("400 si le body ne contient pas vagueId (validation zod)", async () => {
    const response = await rattacherPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/rattacher", "POST", {}),
      idParams
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /vagues-prevues/[id]/scinder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("scinde V7 en V7a + V7b, retourne 201 avec les deux enfants portant vaguePrevueParentId", async () => {
    mockScinderVaguePrevue.mockResolvedValue([
      { id: "v7a", code: "V7a", vaguePrevueParentId: "vp-7" },
      { id: "v7b", code: "V7b", vaguePrevueParentId: "vp-7" },
    ]);

    const response = await scinderPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/scinder", "POST", {
        scissions: [
          { code: "V7a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
          { code: "V7b", dateStockagePrevue: "2026-08-15", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
        ],
      }),
      idParams
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toHaveLength(2);
    expect(data.data.every((v: { vaguePrevueParentId: string }) => v.vaguePrevueParentId === "vp-7")).toBe(true);
  });

  it("400 si moins de 2 scissions sont fournies", async () => {
    const response = await scinderPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/scinder", "POST", {
        scissions: [
          { code: "V7a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
        ],
      }),
      idParams
    );
    expect(response.status).toBe(400);
  });

  it("409 quand la query rejette pour un statut incompatible (ex. VaguePrevue deja realisee)", async () => {
    mockScinderVaguePrevue.mockRejectedValue(new Error("Impossible de scinder une VaguePrevue deja realisee."));

    const response = await scinderPOST(
      jsonRequest("/api/previsions/vagues-prevues/vp-7/scinder", "POST", {
        scissions: [
          { code: "V7a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
          { code: "V7b", dateStockagePrevue: "2026-08-15", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
        ],
      }),
      idParams
    );
    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Aucune route DELETE sur vagues-prevues — verification structurelle
// ---------------------------------------------------------------------------

describe("Aucune route DELETE sur /api/previsions/vagues-prevues/[id]", () => {
  it("le module de route ne module pas d'export DELETE", async () => {
    const routeModule = await import("@/app/api/previsions/vagues-prevues/[id]/route");
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
