/**
 * Tests unitaires — src/lib/auth/backoffice.ts (Story A.3, ADR-022)
 *
 * Couvre :
 * - requireSuperAdmin() — non authentifié → AuthError (401)
 * - requireSuperAdmin() — authentifié mais pas super-admin → ForbiddenError (403)
 * - requireSuperAdmin() — super-admin → retourne BackofficeSession
 * - checkBackofficeAccess() — non authentifié → null
 * - checkBackofficeAccess() — pas super-admin → null
 * - checkBackofficeAccess() — super-admin → retourne BackofficeSession
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { requireSuperAdmin, checkBackofficeAccess } from "@/lib/auth/backoffice";

// ---------------------------------------------------------------------------
// Mocks — @/lib/auth/session
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockGetServerSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Mocks — @/lib/permissions (ForbiddenError)
// ---------------------------------------------------------------------------

vi.mock("@/lib/permissions", () => ({
  ForbiddenError: class ForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Mocks — @/lib/db (prisma)
// ---------------------------------------------------------------------------

const mockUserFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/backoffice");
}

const SESSION_USER = {
  userId: "user-admin-1",
  email: "admin@dkfarm.com",
  phone: "+237600000001",
  name: "Super Admin",
  role: "ADMIN" as const,
  activeSiteId: null,
  isImpersonating: false,
  originalUserId: null,
  originalUserName: null,
};

const DB_USER_SUPER = {
  id: "user-admin-1",
  email: "admin@dkfarm.com",
  phone: "+237600000001",
  name: "Super Admin",
  isSuperAdmin: true,
};

const DB_USER_REGULAR = {
  id: "user-regular-1",
  email: "user@site.com",
  phone: null,
  name: "Eleveur Dupont",
  isSuperAdmin: false,
};

const SESSION_REGULAR = {
  ...SESSION_USER,
  userId: "user-regular-1",
  email: "user@site.com",
  name: "Eleveur Dupont",
};

// ---------------------------------------------------------------------------
// requireSuperAdmin
// ---------------------------------------------------------------------------

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("non authentifié → lance AuthError (status 401)", async () => {
    mockGetSession.mockResolvedValue(null);

    const request = makeRequest();
    await expect(requireSuperAdmin(request)).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
    });
  });

  it("utilisateur introuvable en DB → lance AuthError (status 401)", async () => {
    mockGetSession.mockResolvedValue(SESSION_USER);
    mockUserFindUnique.mockResolvedValue(null);

    const request = makeRequest();
    await expect(requireSuperAdmin(request)).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
    });
  });

  it("authentifié mais pas super-admin → lance ForbiddenError (status 403)", async () => {
    mockGetSession.mockResolvedValue(SESSION_REGULAR);
    mockUserFindUnique.mockResolvedValue(DB_USER_REGULAR);

    const request = makeRequest();
    await expect(requireSuperAdmin(request)).rejects.toMatchObject({
      name: "ForbiddenError",
      status: 403,
    });
  });

  it("super-admin → retourne BackofficeSession avec isSuperAdmin: true", async () => {
    mockGetSession.mockResolvedValue(SESSION_USER);
    mockUserFindUnique.mockResolvedValue(DB_USER_SUPER);

    const request = makeRequest();
    const result = await requireSuperAdmin(request);

    expect(result).toEqual({
      userId: "user-admin-1",
      email: "admin@dkfarm.com",
      phone: "+237600000001",
      name: "Super Admin",
      isSuperAdmin: true,
    });
  });

  it("super-admin — isSuperAdmin lu depuis DB (pas du cookie)", async () => {
    // Session does not expose isSuperAdmin — only the DB call does
    mockGetSession.mockResolvedValue(SESSION_USER);
    mockUserFindUnique.mockResolvedValue(DB_USER_SUPER);

    await requireSuperAdmin(makeRequest());

    // DB must have been queried with select.isSuperAdmin
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-admin-1" },
        select: expect.objectContaining({ isSuperAdmin: true }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// checkBackofficeAccess
// ---------------------------------------------------------------------------

describe("checkBackofficeAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("non authentifié → retourne null", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await checkBackofficeAccess();
    expect(result).toBeNull();
  });

  it("authentifié mais utilisateur introuvable en DB → retourne null", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_USER);
    mockUserFindUnique.mockResolvedValue(null);

    const result = await checkBackofficeAccess();
    expect(result).toBeNull();
  });

  it("authentifié mais pas super-admin → retourne null", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_REGULAR);
    mockUserFindUnique.mockResolvedValue(DB_USER_REGULAR);

    const result = await checkBackofficeAccess();
    expect(result).toBeNull();
  });

  it("super-admin → retourne BackofficeSession", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_USER);
    mockUserFindUnique.mockResolvedValue(DB_USER_SUPER);

    const result = await checkBackofficeAccess();

    expect(result).toEqual({
      userId: "user-admin-1",
      email: "admin@dkfarm.com",
      phone: "+237600000001",
      name: "Super Admin",
      isSuperAdmin: true,
    });
  });

  it("super-admin — ne lance pas d'exception", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_USER);
    mockUserFindUnique.mockResolvedValue(DB_USER_SUPER);

    await expect(checkBackofficeAccess()).resolves.not.toThrow();
  });

  it("non-superadmin — ne lance pas d'exception (retourne null seulement)", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_REGULAR);
    mockUserFindUnique.mockResolvedValue(DB_USER_REGULAR);

    await expect(checkBackofficeAccess()).resolves.toBeNull();
  });
});
