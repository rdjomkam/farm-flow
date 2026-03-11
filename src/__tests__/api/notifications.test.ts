import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/notifications/route";
import { GET as GET_COUNT } from "@/app/api/notifications/count/route";
import { PUT } from "@/app/api/notifications/[id]/route";
import { POST as POST_MARK_ALL } from "@/app/api/notifications/mark-all-read/route";
import { NextRequest } from "next/server";
import { Permission, StatutAlerte, TypeAlerte } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetNotifications = vi.fn();
const mockGetUnreadNotificationCount = vi.fn();
const mockUpdateNotificationStatut = vi.fn();
const mockMarkAllNotificationsRead = vi.fn();

vi.mock("@/lib/queries", () => ({
  getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
  getUnreadNotificationCount: (...args: unknown[]) => mockGetUnreadNotificationCount(...args),
  updateNotificationStatut: (...args: unknown[]) => mockUpdateNotificationStatut(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllNotificationsRead(...args),
}));

const mockRequirePermission = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
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

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "ADMIN",
  activeSiteId: "site-1",
  siteRole: "ADMIN",
  permissions: [Permission.ALERTES_VOIR],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_NOTIFICATION = {
  id: "notif-1",
  typeAlerte: TypeAlerte.MORTALITE_ELEVEE,
  statut: StatutAlerte.ACTIVE,
  titre: "Mortalite elevee detectee",
  message: "5 morts dans le bac Bac-1",
  lien: "/vagues/vague-1",
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------
describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des notifications avec le total", async () => {
    mockGetNotifications.mockResolvedValue([FAKE_NOTIFICATION]);

    const response = await GET(makeRequest("/api/notifications"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetNotifications).toHaveBeenCalledWith("site-1", "user-1", undefined);
  });

  it("filtre par statut ACTIVE", async () => {
    mockGetNotifications.mockResolvedValue([FAKE_NOTIFICATION]);

    const response = await GET(makeRequest("/api/notifications?statut=ACTIVE"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetNotifications).toHaveBeenCalledWith("site-1", "user-1", { statut: "ACTIVE" });
  });

  it("filtre par statut LUE", async () => {
    const notifLue = { ...FAKE_NOTIFICATION, statut: StatutAlerte.LUE };
    mockGetNotifications.mockResolvedValue([notifLue]);

    await GET(makeRequest("/api/notifications?statut=LUE"));

    expect(mockGetNotifications).toHaveBeenCalledWith("site-1", "user-1", { statut: "LUE" });
  });

  it("filtre par statut TRAITEE", async () => {
    mockGetNotifications.mockResolvedValue([]);

    await GET(makeRequest("/api/notifications?statut=TRAITEE"));

    expect(mockGetNotifications).toHaveBeenCalledWith("site-1", "user-1", { statut: "TRAITEE" });
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await GET(makeRequest("/api/notifications?statut=INVALIDE"));

    expect(response.status).toBe(400);
    expect(mockGetNotifications).not.toHaveBeenCalled();
  });

  it("retourne une liste vide si aucune notification", async () => {
    mockGetNotifications.mockResolvedValue([]);

    const response = await GET(makeRequest("/api/notifications"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/notifications"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/notifications"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetNotifications.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/notifications"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications/count
// ---------------------------------------------------------------------------
describe("GET /api/notifications/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le compteur de notifications non lues", async () => {
    mockGetUnreadNotificationCount.mockResolvedValue(7);

    const response = await GET_COUNT(makeRequest("/api/notifications/count"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(7);
    expect(mockGetUnreadNotificationCount).toHaveBeenCalledWith("site-1", "user-1");
  });

  it("retourne 0 si aucune notification non lue", async () => {
    mockGetUnreadNotificationCount.mockResolvedValue(0);

    const response = await GET_COUNT(makeRequest("/api/notifications/count"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(0);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_COUNT(makeRequest("/api/notifications/count"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_COUNT(makeRequest("/api/notifications/count"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetUnreadNotificationCount.mockRejectedValue(new Error("DB error"));

    const response = await GET_COUNT(makeRequest("/api/notifications/count"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("marque une notification comme lue", async () => {
    const notifLue = { ...FAKE_NOTIFICATION, statut: StatutAlerte.LUE };
    mockUpdateNotificationStatut.mockResolvedValue(notifLue);

    const response = await PUT(
      makeRequest("/api/notifications/notif-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutAlerte.LUE }),
      }),
      { params: Promise.resolve({ id: "notif-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutAlerte.LUE);
    expect(mockUpdateNotificationStatut).toHaveBeenCalledWith("site-1", "notif-1", StatutAlerte.LUE);
  });

  it("marque une notification comme traitee", async () => {
    const notifTraitee = { ...FAKE_NOTIFICATION, statut: StatutAlerte.TRAITEE };
    mockUpdateNotificationStatut.mockResolvedValue(notifTraitee);

    const response = await PUT(
      makeRequest("/api/notifications/notif-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutAlerte.TRAITEE }),
      }),
      { params: Promise.resolve({ id: "notif-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutAlerte.TRAITEE);
  });

  it("retourne 400 si statut manquant", async () => {
    const response = await PUT(
      makeRequest("/api/notifications/notif-1", {
        method: "PUT",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "notif-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await PUT(
      makeRequest("/api/notifications/notif-1", {
        method: "PUT",
        body: JSON.stringify({ statut: "STATUT_INCONNU" }),
      }),
      { params: Promise.resolve({ id: "notif-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si notification introuvable", async () => {
    mockUpdateNotificationStatut.mockRejectedValue(new Error("Notification introuvable"));

    const response = await PUT(
      makeRequest("/api/notifications/inexistant", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutAlerte.LUE }),
      }),
      { params: Promise.resolve({ id: "inexistant" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PUT(
      makeRequest("/api/notifications/notif-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutAlerte.LUE }),
      }),
      { params: Promise.resolve({ id: "notif-1" }) }
    );
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/mark-all-read
// ---------------------------------------------------------------------------
describe("POST /api/notifications/mark-all-read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("marque toutes les notifications comme lues", async () => {
    mockMarkAllNotificationsRead.mockResolvedValue(undefined);

    const response = await POST_MARK_ALL(
      makeRequest("/api/notifications/mark-all-read", { method: "POST" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith("site-1", "user-1");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST_MARK_ALL(
      makeRequest("/api/notifications/mark-all-read", { method: "POST" })
    );
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST_MARK_ALL(
      makeRequest("/api/notifications/mark-all-read", { method: "POST" })
    );
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockMarkAllNotificationsRead.mockRejectedValue(new Error("DB error"));

    const response = await POST_MARK_ALL(
      makeRequest("/api/notifications/mark-all-read", { method: "POST" })
    );
    expect(response.status).toBe(500);
  });
});
