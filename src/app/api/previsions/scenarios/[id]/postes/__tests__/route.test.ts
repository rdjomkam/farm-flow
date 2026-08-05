/**
 * Tests unitaires — routes `GET`/`POST /api/previsions/scenarios/[id]/postes`
 * (ADR-053 §16.6/§16.12, story A.5, "Contrat des routes"). Couvre le contrat
 * XOR ACTIVE au niveau HTTP : 400 si aucun champ, 400 si les deux, 201 sur
 * chaque branche valide, 404 (posteReferentielId introuvable/autre site),
 * 409 (inactif, collision) — la validation Zod (`createPostePrevisionSchema`)
 * couvre CHAMP_REQUIS ; `createPostePrevision` (mocke ici) couvre le reste,
 * cf. `previsions-charges.test.ts` pour la logique elle-meme.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, TypePostePrevision } from "@/types";

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
    constructor(message: string, public status: number, public code?: string, public details?: unknown) {
      super(message);
    }
  },
}));

const mockGetPostesPrevisionParScenario = vi.fn();
const mockCreatePostePrevision = vi.fn();
vi.mock("@/lib/queries/previsions-charges", () => ({
  getPostesPrevisionParScenario: (...a: unknown[]) => mockGetPostesPrevisionParScenario(...a),
  createPostePrevision: (...a: unknown[]) => mockCreatePostePrevision(...a),
}));

import { POST } from "@/app/api/previsions/scenarios/[id]/postes/route";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { BusinessRuleError } from "@/lib/errors";

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

function postRequest(body: unknown) {
  return new NextRequest(new URL("/api/previsions/scenarios/s1/postes", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const idParams = (id = "s1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
});

describe("POST /api/previsions/scenarios/[id]/postes — contrat XOR", () => {
  it("400 (validation Zod, code POSTE_REFERENTIEL_CHAMP_REQUIS propage) si aucun des deux champs XOR n'est fourni", async () => {
    // Review story A.5, ecart Moyenne #1 : ce 400 est produit par le refine
    // Zod (court-circuite AVANT createPostePrevision, jamais appelee) — sans
    // params.code sur le refine + relai generique par parseBody, ce test
    // passerait quand meme (le statut 400 est correct) alors que le contrat
    // ADR-053 §16.12 (code machine expose au client) serait rompu. Assertion
    // sur body.code, pas seulement sur le statut, pour que ce test casse si
    // la regression revient.
    const res = await POST(
      postRequest({ libelle: "Salaires", type: TypePostePrevision.CHARGE_EXPLOITATION, ordre: 0 }),
      idParams()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("POSTE_REFERENTIEL_CHAMP_REQUIS");
    expect(mockCreatePostePrevision).not.toHaveBeenCalled();
  });

  it("400 (BusinessRuleError CHAMPS_EXCLUSIFS, remonte par createPostePrevision) si les deux champs XOR sont fournis", async () => {
    mockCreatePostePrevision.mockRejectedValue(
      new BusinessRuleError("Choisissez soit une entree referentiel existante, soit un nouveau libelle.", 400, "POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS")
    );
    const res = await POST(
      postRequest({
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-1",
        nouveauPosteReferentielLibelle: "Salaires",
      }),
      idParams()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS");
  });

  it("201 branche (a) : posteReferentielId seul, reutilise=true dans la reponse", async () => {
    mockCreatePostePrevision.mockResolvedValue({
      poste: {
        id: "p1",
        scenarioId: "s1",
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        siteId: "site-1",
        posteReferentielId: "ref-1",
        posteReferentiel: { libelle: "Salaires", actif: true },
      },
      reutilise: true,
    });
    const res = await POST(
      postRequest({
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-1",
      }),
      idParams()
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reutilise).toBe(true);
    expect(body.posteReferentielId).toBe("ref-1");
  });

  it("201 branche (b) : nouveauPosteReferentielLibelle seul, reutilise=false dans la reponse", async () => {
    mockCreatePostePrevision.mockResolvedValue({
      poste: {
        id: "p2",
        scenarioId: "s1",
        libelle: "Carburant",
        type: TypePostePrevision.LOGISTIQUE,
        ordre: 1,
        siteId: "site-1",
        posteReferentielId: "ref-2",
        posteReferentiel: { libelle: "Carburant", actif: true },
      },
      reutilise: false,
    });
    const res = await POST(
      postRequest({
        libelle: "Carburant",
        type: TypePostePrevision.LOGISTIQUE,
        ordre: 1,
        nouveauPosteReferentielLibelle: "Carburant",
      }),
      idParams()
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reutilise).toBe(false);
  });

  it("404 (jamais 403) si posteReferentielId est introuvable ou d'un autre site", async () => {
    mockCreatePostePrevision.mockRejectedValue(
      new BusinessRuleError("Entree referentiel introuvable.", 404, "POSTE_REFERENTIEL_INTROUVABLE")
    );
    const res = await POST(
      postRequest({
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-autre-site",
      }),
      idParams()
    );
    expect(res.status).toBe(404);
  });

  it("409 (POSTE_REFERENTIEL_INACTIF) si posteReferentielId pointe une entree desactivee", async () => {
    mockCreatePostePrevision.mockRejectedValue(
      new BusinessRuleError("Entree referentiel desactivee.", 409, "POSTE_REFERENTIEL_INACTIF")
    );
    const res = await POST(
      postRequest({
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-inactif",
      }),
      idParams()
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("POSTE_REFERENTIEL_INACTIF");
  });

  it("409 (POSTE_REFERENTIEL_CODE_COLLISION) si le slug de nouveauPosteReferentielLibelle matche une entree ACTIVE, avec details.posteReferentielExistant", async () => {
    mockCreatePostePrevision.mockRejectedValue(
      new BusinessRuleError(
        "Un poste referentiel actif existe deja.",
        409,
        "POSTE_REFERENTIEL_CODE_COLLISION",
        { posteReferentielExistant: { id: "ref-1", libelle: "Salaires" } }
      )
    );
    const res = await POST(
      postRequest({
        libelle: "Salaires (bis)",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        nouveauPosteReferentielLibelle: "Salaires",
      }),
      idParams()
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("POSTE_REFERENTIEL_CODE_COLLISION");
    expect(body.details).toEqual({ posteReferentielExistant: { id: "ref-1", libelle: "Salaires" } });
  });
});

describe("POST /api/previsions/scenarios/[id]/postes — auth", () => {
  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const res = await POST(
      postRequest({
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        nouveauPosteReferentielLibelle: "Salaires",
      }),
      idParams()
    );
    expect(res.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const res = await POST(
      postRequest({
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        nouveauPosteReferentielLibelle: "Salaires",
      }),
      idParams()
    );
    expect(res.status).toBe(403);
  });
});
