import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHashPassword = vi.fn();
const mockVerifyPassword = vi.fn();
const mockCreateSession = vi.fn();
const mockSetSessionCookie = vi.fn();
const mockDeleteSession = vi.fn();
const mockClearSessionCookie = vi.fn();
const mockRequireAuth = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockGetUserByPhone = vi.fn();
const mockGetUserByIdentifier = vi.fn();
const mockCreateUser = vi.fn();

vi.mock("@/lib/auth", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  setSessionCookie: (...args: unknown[]) => mockSetSessionCookie(...args),
  setUserRoleCookie: vi.fn(),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  clearSessionCookie: (...args: unknown[]) => mockClearSessionCookie(...args),
  clearUserRoleCookie: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  normalizePhone: (input: string): string | null => {
    const cleaned = input.replace(/[\s\-().]/g, "");
    let digits: string;
    if (cleaned.startsWith("+237")) digits = cleaned.slice(4);
    else if (cleaned.startsWith("00237")) digits = cleaned.slice(5);
    else if (cleaned.startsWith("237") && cleaned.length === 12) digits = cleaned.slice(3);
    else digits = cleaned;
    if (/^[62]\d{8}$/.test(digits)) return `+237${digits}`;
    return null;
  },
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
  SESSION_COOKIE_NAME: "session_token",
}));

vi.mock("@/lib/queries/users", () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  getUserByPhone: (...args: unknown[]) => mockGetUserByPhone(...args),
  getUserByIdentifier: (...args: unknown[]) => mockGetUserByIdentifier(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
}));

import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { AuthError } from "@/lib/auth";

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBodyEmail = {
    email: "nouveau@dkfarm.cm",
    name: "Nouveau User",
    password: "password123",
  };

  const validBodyPhone = {
    phone: "+237691234567",
    name: "Pisciculteur Mobile",
    password: "password123",
  };

  const validBodyBoth = {
    email: "test@dkfarm.cm",
    phone: "+237691234567",
    name: "User Complet",
    password: "password123",
  };

  function mockSuccessfulCreate(overrides: Record<string, unknown> = {}) {
    mockCreateSession.mockResolvedValue({
      sessionToken: "session-token-123",
      expires: new Date(),
    });
    mockCreateUser.mockResolvedValue({
      id: "user-new",
      email: null,
      phone: null,
      name: "Test",
      role: "PISCICULTEUR",
      ...overrides,
    });
  }

  it("crée un utilisateur avec email et retourne 201", async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashed-password");
    mockSuccessfulCreate({ email: "nouveau@dkfarm.cm", name: "Nouveau User" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBodyEmail),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("nouveau@dkfarm.cm");
    expect(data.user.phone).toBeNull();
    expect(mockHashPassword).toHaveBeenCalledWith("password123");
    expect(mockSetSessionCookie).toHaveBeenCalled();
  });

  it("crée un utilisateur avec téléphone uniquement et retourne 201", async () => {
    mockGetUserByPhone.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashed-password");
    mockSuccessfulCreate({ phone: "+237691234567", name: "Pisciculteur Mobile" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBodyPhone),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.phone).toBe("+237691234567");
    expect(data.user.email).toBeNull();
  });

  it("crée un utilisateur avec email + téléphone et retourne 201", async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    mockGetUserByPhone.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashed-password");
    mockSuccessfulCreate({
      email: "test@dkfarm.cm",
      phone: "+237691234567",
      name: "User Complet",
    });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBodyBoth),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("test@dkfarm.cm");
    expect(data.user.phone).toBe("+237691234567");
  });

  it("retourne 409 si email déjà utilisé", async () => {
    mockGetUserByEmail.mockResolvedValue({ id: "existing" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBodyEmail),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain("email");
  });

  it("retourne 409 si téléphone déjà utilisé", async () => {
    mockGetUserByPhone.mockResolvedValue({ id: "existing" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(validBodyPhone),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain("telephone");
  });

  it("retourne 400 si ni email ni téléphone fourni", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Test", password: "password123" }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "email")).toBe(
      true
    );
  });

  it("retourne 400 si email invalide", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...validBodyEmail, email: "pas-un-email" }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "email")).toBe(
      true
    );
  });

  it("retourne 400 si format téléphone invalide (pas camerounais)", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...validBodyPhone, phone: "+33612345678" }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "phone")).toBe(
      true
    );
  });

  it("normalise un numero local et cree l'utilisateur (BUG-002)", async () => {
    mockGetUserByPhone.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashed");
    mockSuccessfulCreate({ phone: "+237691234567", name: "Pisciculteur Local" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "691234567",
        name: "Pisciculteur Local",
        password: "password123",
      }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    // Le phone est normalise en +237 avant stockage
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+237691234567" })
    );
  });

  it("retourne 400 pour un numero non camerounais", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "12345",
        name: "Test",
        password: "password123",
      }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "phone")).toBe(
      true
    );
  });

  it("accepte un telephone fixe camerounais (+237 2XX)", async () => {
    mockGetUserByPhone.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashed");
    mockSuccessfulCreate({ phone: "+237222123456", name: "Bureau" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "+237222123456",
        name: "Bureau",
        password: "password123",
      }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.user.phone).toBe("+237222123456");
  });

  it("accepte un numero fixe local sans prefixe (BUG-002)", async () => {
    mockGetUserByPhone.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashed");
    mockSuccessfulCreate({ phone: "+237222123456", name: "Bureau Local" });

    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "222123456",
        name: "Bureau Local",
        password: "password123",
      }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+237222123456" })
    );
  });

  it("retourne 400 si nom manquant", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "test@dkfarm.cm", password: "password123" }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "name")).toBe(
      true
    );
  });

  it("retourne 400 si mot de passe trop court", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...validBodyEmail, password: "abc" }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "password")
    ).toBe(true);
  });

  it("retourne 400 avec plusieurs erreurs si tous les champs manquent", async () => {
    const request = makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fakeUser = {
    id: "user-admin",
    email: "admin@dkfarm.cm",
    phone: null,
    name: "Admin",
    passwordHash: "bcrypt-hash",
    role: "ADMIN",
    isActive: true,
  };

  const fakeUserPhone = {
    id: "user-pisci",
    email: null,
    phone: "+237691234567",
    name: "Pisciculteur",
    passwordHash: "bcrypt-hash",
    role: "PISCICULTEUR",
    isActive: true,
  };

  it("connecte un utilisateur par email et retourne 200", async () => {
    mockGetUserByIdentifier.mockResolvedValue(fakeUser);
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({
      sessionToken: "login-token",
      expires: new Date(),
    });

    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "admin@dkfarm.cm", password: "admin123" }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("admin@dkfarm.cm");
    expect(data.user.role).toBe("ADMIN");
    expect(mockSetSessionCookie).toHaveBeenCalled();
  });

  it("connecte un utilisateur par téléphone et retourne 200", async () => {
    mockGetUserByIdentifier.mockResolvedValue(fakeUserPhone);
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({
      sessionToken: "phone-token",
      expires: new Date(),
    });

    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: "+237691234567",
        password: "password123",
      }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.phone).toBe("+237691234567");
    expect(data.user.email).toBeNull();
    expect(data.user.role).toBe("PISCICULTEUR");
  });

  it("normalise un numero local avant recherche en DB (BUG-002)", async () => {
    mockGetUserByIdentifier.mockResolvedValue(fakeUserPhone);
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({
      sessionToken: "local-phone-token",
      expires: new Date(),
    });

    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: "691234567",
        password: "password123",
      }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // L'identifier est normalise en +237 avant la recherche DB
    expect(mockGetUserByIdentifier).toHaveBeenCalledWith("+237691234567");
  });

  it("retourne 401 si identifiant inconnu (message générique)", async () => {
    mockGetUserByIdentifier.mockResolvedValue(null);

    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "inconnu@test.cm", password: "test" }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("incorrect");
  });

  it("retourne 401 si mot de passe incorrect (message générique)", async () => {
    mockGetUserByIdentifier.mockResolvedValue(fakeUser);
    mockVerifyPassword.mockResolvedValue(false);

    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "admin@dkfarm.cm", password: "wrong" }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("incorrect");
  });

  it("retourne 403 si compte désactivé", async () => {
    mockGetUserByIdentifier.mockResolvedValue({ ...fakeUser, isActive: false });

    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "admin@dkfarm.cm", password: "admin123" }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain("desactive");
  });

  it("retourne 400 si identifiant manquant", async () => {
    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "test123" }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "identifier")
    ).toBe(true);
  });

  it("retourne 400 si tous les champs manquent", async () => {
    const request = makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("déconnecte et retourne 200", async () => {
    mockDeleteSession.mockResolvedValue(undefined);

    const request = makeRequest("/api/auth/logout", {
      method: "POST",
      headers: { cookie: "session_token=active-token" },
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteSession).toHaveBeenCalledWith("active-token");
    expect(mockClearSessionCookie).toHaveBeenCalled();
  });

  it("retourne 200 même sans cookie de session", async () => {
    const request = makeRequest("/api/auth/logout", {
      method: "POST",
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne les données utilisateur pour une session valide", async () => {
    mockRequireAuth.mockResolvedValue({
      userId: "user-1",
      email: "test@dkfarm.cm",
      phone: null,
      name: "Test User",
      role: "PISCICULTEUR",
    });

    const request = makeRequest("/api/auth/me");
    const response = await meGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("test@dkfarm.cm");
    expect(data.user.role).toBe("PISCICULTEUR");
  });

  it("retourne les données avec téléphone pour un user sans email", async () => {
    mockRequireAuth.mockResolvedValue({
      userId: "user-2",
      email: null,
      phone: "+237691234567",
      name: "Pisciculteur",
      role: "PISCICULTEUR",
    });

    const request = makeRequest("/api/auth/me");
    const response = await meGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.phone).toBe("+237691234567");
    expect(data.user.email).toBeNull();
  });

  it("retourne 401 si pas de session valide", async () => {
    mockRequireAuth.mockRejectedValue(
      new AuthError("Non authentifie. Veuillez vous connecter.")
    );

    const request = makeRequest("/api/auth/me");
    const response = await meGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Non authentifie");
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockRequireAuth.mockRejectedValue(new Error("DB connection failed"));

    const request = makeRequest("/api/auth/me");
    const response = await meGET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});
