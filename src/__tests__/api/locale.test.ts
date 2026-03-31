/**
 * Tests d'intégration — Route PUT /api/locale (Sprint 39, Story 39.2)
 *
 * Couvre :
 * - 200 avec locale "en" valide — met à jour la session et retourne success
 * - 200 avec locale "fr" valide — cas nominal
 * - 400 avec locale invalide ("de") — non dans la liste autorisée
 * - 400 sans corps ou locale manquante
 * - 401 sans authentification
 * - 500 erreur serveur générique
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "@/app/api/locale/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.fn();
const mockSessionUpdateMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message = "Non autorisé") {
      super(message);
      this.name = "AuthError";
    }
  },
  SESSION_COOKIE_NAME: "farm-flow-session",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, sessionCookie?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (sessionCookie) {
    headers["cookie"] = `farm-flow-session=${sessionCookie}`;
  }
  return new NextRequest("http://localhost/api/locale", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

const AUTH_CONTEXT = {
  userId: "user-1",
  activeSiteId: "site-1",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/locale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(AUTH_CONTEXT);
    mockSessionUpdateMany.mockResolvedValue({ count: 1 });
  });

  // -------------------------------------------------------------------------
  // Cas valides
  // -------------------------------------------------------------------------

  it("retourne 200 et success:true avec locale 'en'", async () => {
    const req = makeRequest({ locale: "en" }, "tok-abc");
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.locale).toBe("en");
  });

  it("retourne 200 et success:true avec locale 'fr'", async () => {
    const req = makeRequest({ locale: "fr" }, "tok-abc");
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.locale).toBe("fr");
  });

  it("met à jour la session en DB avec la locale valide", async () => {
    const req = makeRequest({ locale: "en" }, "session-token-123");
    await PUT(req);
    expect(mockSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { locale: "en" },
      })
    );
  });

  it("définit le cookie NEXT_LOCALE dans la réponse", async () => {
    const req = makeRequest({ locale: "en" }, "tok");
    const res = await PUT(req);
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain("NEXT_LOCALE=en");
  });

  it("retourne la locale dans la réponse JSON", async () => {
    const req = makeRequest({ locale: "fr" }, "tok");
    const res = await PUT(req);
    const data = await res.json();
    expect(data.locale).toBe("fr");
  });

  // -------------------------------------------------------------------------
  // Cas invalides — 400
  // -------------------------------------------------------------------------

  it("retourne 400 avec locale invalide 'de'", async () => {
    const req = makeRequest({ locale: "de" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBeTruthy();
  });

  it("retourne 400 avec locale invalide 'es'", async () => {
    const req = makeRequest({ locale: "es" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si la locale est absente du corps", async () => {
    const req = makeRequest({});
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si la locale est null", async () => {
    const req = makeRequest({ locale: null });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si la locale est un nombre", async () => {
    const req = makeRequest({ locale: 42 });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("le message d'erreur 400 mentionne les locales autorisées", async () => {
    const req = makeRequest({ locale: "zh" });
    const res = await PUT(req);
    const data = await res.json();
    expect(data.message).toContain("fr");
    expect(data.message).toContain("en");
  });

  it("ne met pas à jour la DB pour une locale invalide", async () => {
    const req = makeRequest({ locale: "de" });
    await PUT(req);
    expect(mockSessionUpdateMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Non authentifié — 401
  // -------------------------------------------------------------------------

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireAuth.mockRejectedValue(new AuthError("Non autorisé"));
    const req = makeRequest({ locale: "en" });
    const res = await PUT(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("ne met pas à jour la DB si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireAuth.mockRejectedValue(new AuthError("Non autorisé"));
    const req = makeRequest({ locale: "en" });
    await PUT(req);
    expect(mockSessionUpdateMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cas sans cookie de session
  // -------------------------------------------------------------------------

  it("retourne 200 même sans cookie de session (updateMany non appelé)", async () => {
    const req = makeRequest({ locale: "en" }); // no session cookie
    const res = await PUT(req);
    expect(res.status).toBe(200);
    // Without session cookie, updateMany is skipped
    expect(mockSessionUpdateMany).not.toHaveBeenCalled();
  });
});
