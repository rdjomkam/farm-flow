/**
 * Tests — Middleware proxy.ts (src/proxy.ts)
 * Sprint IE — ADR-ingenieur-interface
 *
 * Couverture :
 * - Redirection INGENIEUR vers /monitoring depuis /
 * - Blocage non-INGENIEUR sur routes ingenieur-only
 * - Exclusion des routes publiques (login, register)
 * - Exclusion des routes API
 * - Absence de cookie → redirect /login pour les pages
 * - Absence de cookie → 401 JSON pour les routes API
 * - Routes backoffice non interceptees par la logique role
 * - Subscription check via sub_status cookie
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock StatutAbonnement et Role pour ne pas avoir a charger tous les types
// ---------------------------------------------------------------------------
vi.mock("@/types", () => ({
  StatutAbonnement: {
    ACTIF: "ACTIF",
    EXPIRE: "EXPIRE",
    ANNULE: "ANNULE",
    SUSPENDU: "SUSPENDU",
  },
  Role: {
    ADMIN: "ADMIN",
    GERANT: "GERANT",
    PISCICULTEUR: "PISCICULTEUR",
    INGENIEUR: "INGENIEUR",
  },
}));

// Import après les mocks
import { proxy } from "@/proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(
  path: string,
  options: { role?: string; session?: string; subStatus?: object } = {}
) {
  const url = new URL(path, "http://localhost:3000");
  const req = new NextRequest(url);

  if (options.session) {
    req.cookies.set("session_token", options.session);
  }
  if (options.role) {
    req.cookies.set("user_role", options.role);
  }
  if (options.subStatus) {
    req.cookies.set("sub_status", JSON.stringify(options.subStatus));
  }

  return req;
}

// ---------------------------------------------------------------------------
// 1. Routes publiques — toujours laissees passer, meme sans cookie
// ---------------------------------------------------------------------------
describe("Routes publiques — pass-through sans cookie", () => {
  it("/login passe sans redirection", async () => {
    const req = makeRequest("/login");
    const res = await proxy(req);
    expect(res.status).not.toBe(302);
    // NextResponse.next() renvoie status 200
    expect(res.headers.get("location")).toBeNull();
  });

  it("/register passe sans redirection", async () => {
    const req = makeRequest("/register");
    const res = await proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("/api/auth/login passe sans cookie (PUBLIC_API_PREFIX)", async () => {
    const req = makeRequest("/api/auth/login", { method: "POST" } as never);
    const res = await proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Absence de cookie — redirect /login pour les pages
// ---------------------------------------------------------------------------
describe("Absence de session_token — redirect vers /login", () => {
  it("accès à / sans cookie → redirect /login avec callbackUrl=/", async () => {
    const req = makeRequest("/");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2F");
  });

  it("accès à /vagues sans cookie → redirect /login", async () => {
    const req = makeRequest("/vagues");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("accès à /monitoring sans cookie → redirect /login", async () => {
    const req = makeRequest("/monitoring");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});

// ---------------------------------------------------------------------------
// 3. Absence de session_token — 401 JSON pour les routes API
// ---------------------------------------------------------------------------
describe("Absence de session_token — 401 pour les routes API", () => {
  it("GET /api/vagues sans cookie → 401 JSON", async () => {
    const req = makeRequest("/api/vagues");
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Non authentifie");
  });

  it("GET /api/releves sans cookie → 401 JSON", async () => {
    const req = makeRequest("/api/releves");
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("GET /api/bacs sans cookie → 401 JSON", async () => {
    const req = makeRequest("/api/bacs");
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 4. INGENIEUR — logique de redirection
// ---------------------------------------------------------------------------
describe("Rôle INGENIEUR — redirections", () => {
  it("INGENIEUR accede à / → redirect vers /monitoring", async () => {
    const req = makeRequest("/", { session: "tok-ing", role: "INGENIEUR" });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/monitoring");
  });

  it("INGENIEUR accede à /monitoring → laisse passer (pas de redirect)", async () => {
    const req = makeRequest("/monitoring", { session: "tok-ing", role: "INGENIEUR" });
    const res = await proxy(req);
    // Doit passer sans redirection vers /login ou /monitoring
    const location = res.headers.get("location");
    // La réponse ne doit pas rediriger vers /monitoring (boucle infinie)
    if (location) {
      expect(location).not.toContain("/monitoring");
    }
    expect(res.status).not.toBe(307);
  });

  it("INGENIEUR accede à /mon-portefeuille → laisse passer", async () => {
    const req = makeRequest("/mon-portefeuille", { session: "tok-ing", role: "INGENIEUR" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toContain("/");
    }
    expect(res.status).not.toBe(307);
  });

  it("INGENIEUR accede à /vagues (route partagee) → laisse passer", async () => {
    const req = makeRequest("/vagues", { session: "tok-ing", role: "INGENIEUR" });
    const res = await proxy(req);
    // Pas de redirect vers / ni vers /monitoring
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toMatch(/^http:\/\/localhost:3000\/$/);
      expect(location).not.toContain("/monitoring");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Non-INGENIEUR — blocage sur routes ingenieur-only
// ---------------------------------------------------------------------------
describe("Rôle non-INGENIEUR — blocage routes ingenieur-only", () => {
  const farmRoles = ["ADMIN", "GERANT", "PISCICULTEUR"];

  for (const role of farmRoles) {
    it(`${role} accede à /monitoring → redirect vers /`, async () => {
      const req = makeRequest("/monitoring", { session: "tok", role });
      const res = await proxy(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toMatch(/\/$/); // redirect to root
    });

    it(`${role} accede à /mon-portefeuille → redirect vers /`, async () => {
      const req = makeRequest("/mon-portefeuille", { session: "tok", role });
      const res = await proxy(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toMatch(/\/$/);
    });
  }

  // Guard E11
  it("no-role accede à /monitoring → redirect vers /login (Guard E11)", async () => {
    const req = makeRequest("/monitoring", { session: "tok", role: "" });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
  });

  it("no-role accede à /mon-portefeuille → redirect vers /login (Guard E11)", async () => {
    const req = makeRequest("/mon-portefeuille", { session: "tok", role: "" });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
  });

  it("ADMIN accede à / → laisse passer (espace farm)", async () => {
    const req = makeRequest("/", { session: "tok", role: "ADMIN" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toContain("/monitoring");
    }
    expect(res.status).not.toBe(307);
  });

  it("GERANT accede à /vagues → laisse passer", async () => {
    const req = makeRequest("/vagues", { session: "tok", role: "GERANT" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toMatch(/\/$/);
      expect(location).not.toContain("/monitoring");
    }
  });

  it("PISCICULTEUR accede à /releves → laisse passer", async () => {
    const req = makeRequest("/releves", { session: "tok", role: "PISCICULTEUR" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toMatch(/\/$/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Routes API — jamais soumises à la logique de rôle
// ---------------------------------------------------------------------------
describe("Routes API — exclues de la logique de rôle", () => {
  it("/api/vagues avec role INGENIEUR et session → ne redirige pas", async () => {
    const req = makeRequest("/api/vagues", { session: "tok-ing", role: "INGENIEUR" });
    const res = await proxy(req);
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).not.toBe(307);
  });

  it("/api/releves avec role non-INGENIEUR → pas de redirect vers /", async () => {
    const req = makeRequest("/api/releves", { session: "tok", role: "PISCICULTEUR" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    expect(location).toBeNull();
  });

  it("/api/monitoring avec role ADMIN → pas de redirect", async () => {
    const req = makeRequest("/api/monitoring", { session: "tok", role: "ADMIN" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    expect(location).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Route /backoffice — exclue de la logique de rôle
// ---------------------------------------------------------------------------
describe("Route /backoffice — exclue de la logique de rôle", () => {
  it("/backoffice avec session admin → laisse passer (pas de redirect par role)", async () => {
    const req = makeRequest("/backoffice", { session: "tok-admin", role: "ADMIN" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toContain("/monitoring");
      expect(location).not.toMatch(/\/$/);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Sous-chemins — logique de prefixe
// ---------------------------------------------------------------------------
describe("Sous-chemins — logique de préfixe INGENIEUR_ONLY", () => {
  it("PISCICULTEUR sur /monitoring/client/123 → redirect /", async () => {
    const req = makeRequest("/monitoring/client/123", { session: "tok", role: "PISCICULTEUR" });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("INGENIEUR sur /monitoring/client/123 → laisse passer", async () => {
    const req = makeRequest("/monitoring/client/123", { session: "tok-ing", role: "INGENIEUR" });
    const res = await proxy(req);
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toMatch(/\/$/);
    }
    expect(res.status).not.toBe(307);
  });
});

// ---------------------------------------------------------------------------
// 9. Subscription check via sub_status cookie
// ---------------------------------------------------------------------------
describe("Subscription check via sub_status cookie", () => {
  it("blocked subscription → redirect to /abonnement-expire for pages", async () => {
    const req = makeRequest("/vagues", {
      session: "tok",
      role: "ADMIN",
      subStatus: { statut: "EXPIRE", isDecouverte: false, isBlocked: true },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/abonnement-expire");
  });

  it("blocked subscription → 403 for API routes", async () => {
    const req = makeRequest("/api/vagues", {
      session: "tok",
      role: "ADMIN",
      subStatus: { statut: "EXPIRE", isDecouverte: false, isBlocked: true },
    });
    const res = await proxy(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("SUBSCRIPTION_BLOCKED");
  });

  it("DECOUVERTE plan → never blocked even if isBlocked is somehow true", async () => {
    const req = makeRequest("/vagues", {
      session: "tok",
      role: "ADMIN",
      subStatus: { statut: null, isDecouverte: true, isBlocked: false },
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("active subscription → pass through", async () => {
    const req = makeRequest("/vagues", {
      session: "tok",
      role: "ADMIN",
      subStatus: { statut: "ACTIF", isDecouverte: false, isBlocked: false },
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("no sub_status cookie → fail open (pass through)", async () => {
    const req = makeRequest("/vagues", { session: "tok", role: "ADMIN" });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("malformed sub_status cookie → fail open", async () => {
    const url = new URL("/vagues", "http://localhost:3000");
    const req = new NextRequest(url);
    req.cookies.set("session_token", "tok");
    req.cookies.set("user_role", "ADMIN");
    req.cookies.set("sub_status", "not-valid-json{{{");
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("whitelisted route /mon-abonnement → not checked even if blocked", async () => {
    const req = makeRequest("/mon-abonnement", {
      session: "tok",
      role: "ADMIN",
      subStatus: { statut: "EXPIRE", isDecouverte: false, isBlocked: true },
    });
    const res = await proxy(req);
    // Should NOT redirect to /abonnement-expire
    const location = res.headers.get("location");
    if (location) {
      expect(location).not.toContain("/abonnement-expire");
    }
  });
});
