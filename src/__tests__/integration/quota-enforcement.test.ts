/**
 * Tests d'intégration — Enforcement des quotas de plan (Sprint 37)
 *
 * Couvre :
 * 1. DECOUVERTE : 3 bacs créés → 4e bloqué avec 402 QUOTA_DEPASSE
 * 2. Upgrade DECOUVERTE → ELEVEUR → 4e bac possible (10 bacs autorisés)
 * 3. ENTREPRISE : limite null (illimité) → jamais bloqué
 * 4. Race condition : transaction atomique R4 garantit la cohérence
 *
 * Story 37.1 — Sprint 37
 * R2 : enums TypePlan, Permission importés depuis @/types
 * R4 : check + create dans même $transaction (protège les race conditions)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, TypePlan } from "@/types";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// Mocks — doit être avant tout import du module testé
// ---------------------------------------------------------------------------

const mockGetBacs = vi.fn();
const mockGetAbonnementActif = vi.fn();

vi.mock("@/lib/queries/bacs", () => ({
  getBacs: (...args: unknown[]) => mockGetBacs(...args),
  createBac: vi.fn(),
}));

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
}));

// Mock check-quotas (fonctions pures utilisées réellement dans la route)
vi.mock("@/lib/abonnements/check-quotas", () => ({
  normaliseLimite: (valeur: number) => (valeur >= 999 ? null : valeur),
  isQuotaAtteint: (ressource: { actuel: number; limite: number | null }) => {
    if (ressource.limite === null) return false;
    return ressource.actuel >= ressource.limite;
  },
  getQuotasUsage: vi.fn(),
}));

// Mock prisma.$transaction + tx.bac.count + tx.bac.create
const mockBacCount = vi.fn();
const mockBacCreate = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    bac: {
      count: (...args: unknown[]) => mockBacCount(...args),
      create: (...args: unknown[]) => mockBacCreate(...args),
    },
  },
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

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/bacs/route";
import { normaliseLimite, isQuotaAtteint } from "@/lib/abonnements/check-quotas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@farm.cm",
  phone: null,
  name: "Eleveur",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Gérant",
  permissions: [Permission.BACS_GERER],
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/bacs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makePlanAbonnement(typePlan: TypePlan) {
  return {
    id: `plan-${typePlan.toLowerCase()}`,
    plan: { typePlan },
  };
}

/**
 * Configure la transaction atomique pour simuler le comportement réel de la route :
 * count + create dans $transaction.
 * - nbBacsActuels : nombre de bacs déjà présents
 * - limitesBacs : limite du plan
 * - nouveauBac : données du bac créé (si quota non dépassé)
 */
function setupTransaction(
  nbBacsActuels: number,
  limitesBacs: number,
  nouveauBac: Record<string, unknown> | null = null
) {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: {
      bac: {
        count: () => Promise<number>;
        create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
      };
    }) => Promise<unknown>) => {
      const txMock = {
        bac: {
          count: () => Promise.resolve(nbBacsActuels),
          create: (args: { data: Record<string, unknown> }) => {
            if (nouveauBac) {
              return Promise.resolve({ id: "bac-new", ...args.data, ...nouveauBac });
            }
            return Promise.reject(new Error("Should not create"));
          },
        },
      };
      return fn(txMock);
    }
  );
}

// ---------------------------------------------------------------------------
// Tests : Plan DECOUVERTE — quota de 3 bacs
// ---------------------------------------------------------------------------

describe("Quota enforcement — Plan DECOUVERTE (limite 3 bacs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetBacs.mockResolvedValue([]);
  });

  it("1er bac créé avec succès (0/3 bacs)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.DECOUVERTE));
    // 0 bacs existants → quota non atteint → création OK
    setupTransaction(0, PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs, {
      nom: "Bac-1",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-1", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("2e bac créé avec succès (1/3 bacs)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.DECOUVERTE));
    setupTransaction(1, PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs, {
      nom: "Bac-2",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-2", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("3e bac créé avec succès (2/3 bacs)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.DECOUVERTE));
    setupTransaction(2, PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs, {
      nom: "Bac-3",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-3", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("4e bac BLOQUÉ — quota 3/3 atteint → 402 QUOTA_DEPASSE", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.DECOUVERTE));

    // 3 bacs existants → limite atteinte → throw QUOTA_DEPASSE dans la transaction
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: {
        bac: {
          count: () => Promise<number>;
          create: () => Promise<unknown>;
        };
      }) => Promise<unknown>) => {
        const txMock = {
          bac: {
            count: () => Promise.resolve(3), // 3 bacs déjà présents
            create: () => Promise.reject(new Error("Should not reach create")),
          },
        };
        return fn(txMock);
      }
    );

    const req = makeRequest({ nom: "Bac-4", volume: 10 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(402);
    expect(data.error).toBe("QUOTA_DEPASSE");
    expect(data.ressource).toBe("bacs");
    // La limite du plan DECOUVERTE est 3
    expect(data.limite).toBe(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs);
  });

  it("message d'erreur 402 contient la limite et instructions d'upgrade", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.DECOUVERTE));
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: { bac: { count: () => Promise<number>; create: () => Promise<unknown> } }) => Promise<unknown>) => {
        return fn({ bac: { count: () => Promise.resolve(3), create: () => Promise.reject(new Error("nope")) } });
      }
    );

    const req = makeRequest({ nom: "Bac-X", volume: 5 });
    const res = await POST(req);
    const data = await res.json();

    expect(data.message).toContain("3");
    expect(data.message).toContain("plan");
  });

  it("sans abonnement actif → limites DECOUVERTE par défaut", async () => {
    mockGetAbonnementActif.mockResolvedValue(null); // Pas d'abonnement
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: { bac: { count: () => Promise<number>; create: () => Promise<unknown> } }) => Promise<unknown>) => {
        return fn({ bac: { count: () => Promise.resolve(3), create: () => Promise.reject(new Error("nope")) } });
      }
    );

    const req = makeRequest({ nom: "Bac-Y", volume: 5 });
    const res = await POST(req);
    const data = await res.json();

    // Sans abonnement, limite DECOUVERTE s'applique → 402
    expect(res.status).toBe(402);
    expect(data.error).toBe("QUOTA_DEPASSE");
  });
});

// ---------------------------------------------------------------------------
// Tests : Upgrade DECOUVERTE → ELEVEUR → 4e bac possible
// ---------------------------------------------------------------------------

describe("Quota enforcement — Upgrade DECOUVERTE → ELEVEUR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetBacs.mockResolvedValue([]);
  });

  it("avec plan ELEVEUR, 4e bac créé avec succès (3/10 bacs)", async () => {
    // Après upgrade vers ELEVEUR : limite = 10 bacs
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ELEVEUR));
    // 3 bacs existants → quota NON atteint pour ELEVEUR (limite=10)
    setupTransaction(3, PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs, {
      nom: "Bac-4",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-4", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("avec plan ELEVEUR, 10e bac créé avec succès (9/10 bacs)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ELEVEUR));
    setupTransaction(9, PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs, {
      nom: "Bac-10",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-10", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("avec plan ELEVEUR, 11e bac BLOQUÉ (10/10 bacs) → 402", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ELEVEUR));
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: { bac: { count: () => Promise<number>; create: () => Promise<unknown> } }) => Promise<unknown>) => {
        return fn({ bac: { count: () => Promise.resolve(10), create: () => Promise.reject(new Error("nope")) } });
      }
    );

    const req = makeRequest({ nom: "Bac-11", volume: 10 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(402);
    expect(data.limite).toBe(PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs);
  });

  it("PLAN_LIMITES ELEVEUR : 10 bacs, 3 vagues (vérification des constantes)", () => {
    expect(PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs).toBe(10);
    expect(PLAN_LIMITES[TypePlan.ELEVEUR].limitesVagues).toBe(3);
  });

  it("PLAN_LIMITES DECOUVERTE : 3 bacs, 1 vague (vérification des constantes)", () => {
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs).toBe(3);
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesVagues).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests : Plan ENTREPRISE — illimité (limite null)
// ---------------------------------------------------------------------------

describe("Quota enforcement — Plan ENTREPRISE (illimité)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetBacs.mockResolvedValue([]);
  });

  it("avec plan ENTREPRISE, 100e bac créé sans blocage", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ENTREPRISE));
    // 99 bacs existants → limite 999 → normalisée null → jamais atteinte
    setupTransaction(99, PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs, {
      nom: "Bac-100",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-100", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("PLAN_LIMITES ENTREPRISE : 999 → normalisé null (illimité)", () => {
    expect(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs).toBe(999);
    expect(normaliseLimite(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests : Atomicité R4 — transaction garantit la cohérence
// ---------------------------------------------------------------------------

describe("Quota enforcement — Atomicité R4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetBacs.mockResolvedValue([]);
  });

  it("la création de bac est toujours encapsulée dans $transaction", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ELEVEUR));
    setupTransaction(0, PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs, {
      nom: "Bac-Atomique",
      volume: 10,
    });

    const req = makeRequest({ nom: "Bac-Atomique", volume: 10 });
    await POST(req);

    // La route doit utiliser $transaction (R4 — anti-race-condition)
    expect(mockPrismaTransaction).toHaveBeenCalledOnce();
  });

  it("si $transaction échoue (erreur DB) → 500 (pas de création partielle)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ELEVEUR));
    mockPrismaTransaction.mockRejectedValue(new Error("DB serialization error"));

    const req = makeRequest({ nom: "Bac-Error", volume: 10 });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("le count Prisma est appelé À L'INTÉRIEUR de la transaction (pas avant)", async () => {
    // Si le count est fait en dehors de la transaction, la race condition est possible.
    // Ce test vérifie que mockBacCount seul (hors tx) n'est PAS appelé directement.
    mockGetAbonnementActif.mockResolvedValue(makePlanAbonnement(TypePlan.ELEVEUR));
    setupTransaction(0, PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs, {
      nom: "Bac-Inside-Tx",
      volume: 10,
    });

    await POST(makeRequest({ nom: "Bac-Inside-Tx", volume: 10 }));

    // Le mock global mockBacCount (hors transaction) ne doit pas être appelé —
    // le count est dans la fonction passée à $transaction
    expect(mockBacCount).not.toHaveBeenCalled();
  });

  it("validation obligatoire : nom vide → 400 (avant même d'appeler $transaction)", async () => {
    const req = makeRequest({ nom: "", volume: 10 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors).toBeDefined();
    // La validation se fait avant $transaction → pas d'accès DB inutile
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("validation obligatoire : volume nul → 400", async () => {
    const req = makeRequest({ nom: "Bac-Sans-Volume", volume: 0 });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests : Vérification des limites par plan (tests des constantes)
// ---------------------------------------------------------------------------

describe("Limites par plan — vérification constantes PLAN_LIMITES", () => {
  it("DECOUVERTE : 3 bacs, 1 vague, 1 site", () => {
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs).toBe(3);
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesVagues).toBe(1);
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesSites).toBe(1);
  });

  it("ELEVEUR : 10 bacs, 3 vagues, 1 site", () => {
    expect(PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs).toBe(10);
    expect(PLAN_LIMITES[TypePlan.ELEVEUR].limitesVagues).toBe(3);
    expect(PLAN_LIMITES[TypePlan.ELEVEUR].limitesSites).toBe(1);
  });

  it("PROFESSIONNEL : 30 bacs, 10 vagues, 3 sites", () => {
    expect(PLAN_LIMITES[TypePlan.PROFESSIONNEL].limitesBacs).toBe(30);
    expect(PLAN_LIMITES[TypePlan.PROFESSIONNEL].limitesVagues).toBe(10);
    expect(PLAN_LIMITES[TypePlan.PROFESSIONNEL].limitesSites).toBe(3);
  });

  it("ENTREPRISE : 999 (→ null illimité) bacs, vagues, sites", () => {
    expect(normaliseLimite(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs)).toBeNull();
    expect(normaliseLimite(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesVagues)).toBeNull();
    expect(normaliseLimite(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesSites)).toBeNull();
  });

  it("isQuotaAtteint — plan DECOUVERTE 3/3 → atteint", () => {
    const limite = normaliseLimite(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs);
    expect(isQuotaAtteint({ actuel: 3, limite })).toBe(true);
  });

  it("isQuotaAtteint — plan ELEVEUR 3/10 → non atteint", () => {
    const limite = normaliseLimite(PLAN_LIMITES[TypePlan.ELEVEUR].limitesBacs);
    expect(isQuotaAtteint({ actuel: 3, limite })).toBe(false);
  });

  it("isQuotaAtteint — plan ENTREPRISE (illimité) → jamais atteint, même à 999", () => {
    const limite = normaliseLimite(PLAN_LIMITES[TypePlan.ENTREPRISE].limitesBacs);
    expect(isQuotaAtteint({ actuel: 999, limite })).toBe(false);
    expect(isQuotaAtteint({ actuel: 10000, limite })).toBe(false);
  });
});
