/**
 * Tests API — PUT /api/sites/[id] validation des documents (BL.2)
 *
 * Couvre :
 * - Acceptation d'une image base64 valide pour signaturePromoteur / cachet
 * - Rejet d'une image trop volumineuse (> 500KB)
 * - Rejet d'une chaine qui n'est pas une data URL d'image
 * - Acceptation de null (suppression de l'image)
 * - Champ absent du body -> inchange (non transmis a updateSite)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

const {
  mockRequireAuth,
  mockGetSiteMember,
  mockUpdateSite,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetSiteMember: vi.fn(),
  mockUpdateSite: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
  SESSION_COOKIE_NAME: "session_token",
}));

vi.mock("@/lib/permissions", () => {
  class MockForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  }
  return {
    requirePermission: vi.fn(),
    ForbiddenError: MockForbiddenError,
  };
});

vi.mock("@/lib/queries/sites", () => ({
  getUserSites: vi.fn(),
  createSite: vi.fn(),
  getSiteById: vi.fn(),
  updateSite: (...args: unknown[]) => mockUpdateSite(...args),
  getSiteMember: (...args: unknown[]) => mockGetSiteMember(...args),
  addMember: vi.fn(),
  updateMemberSiteRole: vi.fn(),
  removeMember: vi.fn(),
}));

import { PUT as putSite } from "@/app/api/sites/[id]/route";

function makeRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

const ALL_PERMISSIONS = Object.values(Permission);
const now = new Date();

const SESSION = {
  userId: "user-admin",
  email: "admin@ferme.cm",
  phone: null,
  name: "Admin Ferme",
  role: "ADMIN",
  activeSiteId: "site-1",
};

function makeCallerMember(perms: Permission[], isActive = true) {
  return {
    id: "member-caller",
    userId: SESSION.userId,
    siteId: "site-1",
    siteRoleId: "sr-admin-1",
    siteRole: {
      id: "sr-admin-1",
      name: "Administrateur",
      permissions: perms,
      isSystem: true,
      siteId: "site-1",
    },
    isActive,
    createdAt: now,
    updatedAt: now,
  };
}

const VALID_IMAGE = `data:image/png;base64,${"A".repeat(100)}`;
const TOO_LARGE_IMAGE = `data:image/png;base64,${"A".repeat(500_000)}`;

function baseUpdatedSite(overrides: Record<string, unknown> = {}) {
  return {
    id: "site-1",
    name: "Ferme A",
    address: "Douala",
    isActive: true,
    enabledModules: [],
    signaturePromoteur: null,
    cachet: null,
    updatedAt: now,
    ...overrides,
  };
}

describe("PUT /api/sites/[id] — validation documents (signaturePromoteur / cachet)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION);
    mockGetSiteMember.mockResolvedValue(makeCallerMember(ALL_PERMISSIONS));
  });

  it("accepte une image base64 valide pour signaturePromoteur", async () => {
    mockUpdateSite.mockResolvedValue(
      baseUpdatedSite({ signaturePromoteur: VALID_IMAGE })
    );

    const request = makeRequest("/api/sites/site-1", {
      signaturePromoteur: VALID_IMAGE,
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.signaturePromoteur).toBe(VALID_IMAGE);
    expect(mockUpdateSite).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ signaturePromoteur: VALID_IMAGE })
    );
  });

  it("accepte une image base64 valide pour cachet", async () => {
    mockUpdateSite.mockResolvedValue(baseUpdatedSite({ cachet: VALID_IMAGE }));

    const request = makeRequest("/api/sites/site-1", { cachet: VALID_IMAGE });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cachet).toBe(VALID_IMAGE);
  });

  it("rejette une image trop volumineuse (> 500KB) avec 400", async () => {
    const request = makeRequest("/api/sites/site-1", {
      signaturePromoteur: TOO_LARGE_IMAGE,
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
    expect(mockUpdateSite).not.toHaveBeenCalled();
  });

  it("rejette une chaine qui n'est pas une data URL d'image", async () => {
    const request = makeRequest("/api/sites/site-1", {
      cachet: "not-a-data-url",
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(400);
    expect(mockUpdateSite).not.toHaveBeenCalled();
  });

  it("accepte null pour supprimer la signature", async () => {
    mockUpdateSite.mockResolvedValue(baseUpdatedSite({ signaturePromoteur: null }));

    const request = makeRequest("/api/sites/site-1", {
      signaturePromoteur: null,
    });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.signaturePromoteur).toBeNull();
    expect(mockUpdateSite).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ signaturePromoteur: null })
    );
  });

  it("champ absent du body -> non transmis a updateSite (inchange)", async () => {
    mockUpdateSite.mockResolvedValue(baseUpdatedSite({ name: "Ferme B" }));

    const request = makeRequest("/api/sites/site-1", { name: "Ferme B" });

    const response = await putSite(request, {
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(response.status).toBe(200);
    const callArgs = mockUpdateSite.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty("signaturePromoteur");
    expect(callArgs).not.toHaveProperty("cachet");
  });
});
