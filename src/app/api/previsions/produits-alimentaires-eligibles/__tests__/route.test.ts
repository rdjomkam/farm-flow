/**
 * Tests unitaires — route `GET /api/previsions/produits-alimentaires-eligibles`
 * (ADR-053 §18.1). Couvre : 401/403, permission EXACTE (PREVISIONS_GERER,
 * jamais STOCK_VOIR — un Gestionnaire Previsions n'a aucune garantie d'avoir
 * des droits Stock), 200 avec threading de `activeSiteId` (R8), forme exacte
 * de la reponse (`{ data: ProduitAlimentaireEligibleDTO[] }`), tableau vide
 * (site sans aucun Produit ALIMENT actif, ADR-053 §18.2(a)), et 500 explicite
 * si la query echoue.
 *
 * Complement du test de la matrice auth/permissions
 * (`src/__tests__/api/previsions-auth-permissions.test.ts`) qui ne verifie
 * que le statut 401/403/200 sur un payload mocke vide — ce fichier verifie
 * en plus la forme exacte du corps de reponse et le threading de siteId,
 * suivant le patron de
 * `src/app/api/previsions/postes-referentiel/__tests__/route.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, TailleGranule, RaisonInvaliditeProduitPrevision } from "@/types";

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
vi.mock("@/lib/errors", () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public status: number = 400) {
      super(message);
    }
  },
  BusinessRuleError: class BusinessRuleError extends Error {
    constructor(message: string, public status: number, public code?: string) {
      super(message);
    }
  },
}));

const mockGetProduitsAlimentairesEligibles = vi.fn();
vi.mock("@/lib/queries/previsions-scenarios", () => ({
  getProduitsAlimentairesEligibles: (...a: unknown[]) =>
    mockGetProduitsAlimentairesEligibles(...a),
}));

import { GET } from "@/app/api/previsions/produits-alimentaires-eligibles/route";
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
    new URL("/api/previsions/produits-alimentaires-eligibles", "http://localhost:3000"),
    { method: "GET" }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/previsions/produits-alimentaires-eligibles", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_GERER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await GET(getRequest());
    expect(res.status).toBe(403);
  });

  it("exige exactement PREVISIONS_GERER (jamais STOCK_VOIR), thread activeSiteId (R8), 200 avec la liste complete (eligibles ET non-eligibles, jamais filtree)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetProduitsAlimentairesEligibles.mockResolvedValue([
      {
        id: "p1",
        nom: "Granule A",
        tailleGranule: TailleGranule.G1,
        contenance: 25,
        prixUnitaire: 15000,
        eligible: true,
        raisonsInvalidite: [],
      },
      {
        id: "p2",
        nom: "Sans granule",
        tailleGranule: null,
        contenance: 25,
        prixUnitaire: 12000,
        eligible: false,
        raisonsInvalidite: [RaisonInvaliditeProduitPrevision.TAILLE_GRANULE_MANQUANTE],
      },
    ]);

    const res = await GET(getRequest());

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_GERER);
    // R8 : le filtre passe TOUJOURS par activeSiteId de la session.
    expect(mockGetProduitsAlimentairesEligibles).toHaveBeenCalledWith("site-1");
    expect(mockGetProduitsAlimentairesEligibles).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // Le produit non-eligible reste present dans la reponse (ERR-173/ERR-185
    // : une liste filtree ne peut pas servir de base a une conclusion sur ce
    // qu'elle cache) — jamais retire.
    const p2 = body.data.find((p: { id: string }) => p.id === "p2");
    expect(p2.eligible).toBe(false);
    expect(p2.raisonsInvalidite).toEqual(["TAILLE_GRANULE_MANQUANTE"]);
  });

  it("200 avec un tableau vide quand le site n'a aucun Produit ALIMENT actif (signal non ambigu, ADR-053 §18.2(a))", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetProduitsAlimentairesEligibles.mockResolvedValue([]);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("500 explicite (jamais un ecran blanc) si la query echoue", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetProduitsAlimentairesEligibles.mockRejectedValue(new Error("DB down"));

    const res = await GET(getRequest());
    expect(res.status).toBe(500);
  });
});
