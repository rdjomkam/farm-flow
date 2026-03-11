import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSessionCreate = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionDelete = vi.fn();
const mockSessionDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      create: (...args: unknown[]) => mockSessionCreate(...args),
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      delete: (...args: unknown[]) => mockSessionDelete(...args),
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
  },
}));

import {
  createSession,
  getSession,
  requireAuth,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  AuthError,
} from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequestWithCookie(token: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    headers: { cookie: `session_token=${token}` },
  });
}

function makeRequestWithoutCookie(): NextRequest {
  return new NextRequest("http://localhost:3000/api/test");
}

const validUser = {
  id: "user-1",
  email: "test@dkfarm.cm",
  phone: null as string | null,
  name: "Test User",
  passwordHash: "hashed",
  role: "PISCICULTEUR",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validSession = {
  id: "session-1",
  sessionToken: "test-token",
  userId: "user-1",
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
  createdAt: new Date(),
  user: validUser,
};

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------
describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée un token UUID et une expiration à 30 jours", async () => {
    mockSessionCreate.mockResolvedValue({});

    const result = await createSession("user-1");

    expect(result.sessionToken).toBeDefined();
    expect(result.sessionToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(result.expires).toBeInstanceOf(Date);
    const diffDays =
      (result.expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("appelle prisma.session.create avec les bonnes données", async () => {
    mockSessionCreate.mockResolvedValue({});

    await createSession("user-1");

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        sessionToken: expect.any(String),
        expires: expect.any(Date),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------
describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null si pas de cookie session", async () => {
    const request = makeRequestWithoutCookie();
    const result = await getSession(request);
    expect(result).toBeNull();
    expect(mockSessionFindUnique).not.toHaveBeenCalled();
  });

  it("retourne null si session non trouvée en DB", async () => {
    mockSessionFindUnique.mockResolvedValue(null);

    const request = makeRequestWithCookie("unknown-token");
    const result = await getSession(request);

    expect(result).toBeNull();
  });

  it("retourne null et supprime la session si expirée", async () => {
    const expiredSession = {
      ...validSession,
      expires: new Date(Date.now() - 1000),
    };
    mockSessionFindUnique.mockResolvedValue(expiredSession);
    mockSessionDelete.mockResolvedValue({});

    const request = makeRequestWithCookie("test-token");
    const result = await getSession(request);

    expect(result).toBeNull();
    expect(mockSessionDelete).toHaveBeenCalledWith({
      where: { id: expiredSession.id },
    });
  });

  it("retourne null si l'utilisateur est inactif", async () => {
    const inactiveSession = {
      ...validSession,
      user: { ...validUser, isActive: false },
    };
    mockSessionFindUnique.mockResolvedValue(inactiveSession);

    const request = makeRequestWithCookie("test-token");
    const result = await getSession(request);

    expect(result).toBeNull();
  });

  it("retourne les données UserSession pour une session valide", async () => {
    mockSessionFindUnique.mockResolvedValue(validSession);

    const request = makeRequestWithCookie("test-token");
    const result = await getSession(request);

    expect(result).toEqual({
      userId: "user-1",
      email: "test@dkfarm.cm",
      phone: null,
      name: "Test User",
      role: "PISCICULTEUR",
    });
  });
});

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------
describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne UserSession pour une session valide", async () => {
    mockSessionFindUnique.mockResolvedValue(validSession);

    const request = makeRequestWithCookie("test-token");
    const result = await requireAuth(request);

    expect(result).toEqual({
      userId: "user-1",
      email: "test@dkfarm.cm",
      phone: null,
      name: "Test User",
      role: "PISCICULTEUR",
    });
  });

  it("lance AuthError si pas de session", async () => {
    const request = makeRequestWithoutCookie();

    try {
      await requireAuth(request);
      expect.fail("Aurait dû lancer AuthError");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).message).toContain("Non authentifie");
      expect((error as AuthError).status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------
describe("deleteSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supprime la session via prisma.session.deleteMany", async () => {
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });

    await deleteSession("token-to-delete");

    expect(mockSessionDeleteMany).toHaveBeenCalledWith({
      where: { sessionToken: "token-to-delete" },
    });
  });
});

// ---------------------------------------------------------------------------
// setSessionCookie / clearSessionCookie
// ---------------------------------------------------------------------------
describe("setSessionCookie", () => {
  it("définit le cookie session_token sur la réponse", () => {
    const response = NextResponse.json({ ok: true });
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    setSessionCookie(response, "token-abc", expires);

    const cookie = response.cookies.get("session_token");
    expect(cookie?.value).toBe("token-abc");
  });
});

describe("clearSessionCookie", () => {
  it("efface le cookie session_token", () => {
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);

    const cookie = response.cookies.get("session_token");
    expect(cookie?.value).toBe("");
  });
});
