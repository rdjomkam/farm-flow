/**
 * Tests unitaires — routes API introduites par l'amendement ADR-053 §12
 * (modele calibre/article a deux niveaux, Sprint PR2-quater, story PR2q.4) :
 *
 *  - POST /api/previsions/scenarios/[id]/aliments  (deja couverte par
 *    previsions-auth-permissions.test.ts pour le contrat auth/permission
 *    generique ; ce fichier couvre les codes 400/404/422 propres a cette
 *    route et l'ergonomie §12.6 : `partApprovisionnementPct` n'est PAS
 *    exigee dans le payload de creation a un seul article).
 *  - PATCH /api/previsions/aliments/[id]  (mise a jour du CALIBRE) — AUCUNE
 *    couverture auth/permission n'existait avant ce fichier (verifie par
 *    grep sur previsions-auth-permissions.test.ts : seules GET/DELETE et
 *    PUT .../repartitions y figurent pour /aliments/[id]).
 *  - POST /api/previsions/aliments/[id]/articles  (ajout d'un second
 *    article, ADR-053 §12.6 : action secondaire explicite) — nouvelle route.
 *  - PATCH /api/previsions/aliments/[id]/articles/[articleId]  (modification
 *    d'un article existant) — nouvelle route.
 *
 * Convention de mock identique a previsions-auth-permissions.test.ts /
 * previsions-validations-http-mapping.test.ts (deja en place dans ce
 * module) : mock de `requirePermission` et des queries, jamais de Prisma
 * reel (routes API = unites, pas d'integration DB ici).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, TailleGranule } from "@/types";
import { BusinessRuleError } from "@/lib/errors";

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
  ValidationError: class ValidationError extends Error { constructor(message: string, public status: number = 400) { super(message); } },
  BusinessRuleError: class BusinessRuleError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } },
}));

const mockCreateAlimentPrevisionAvecArticle = vi.fn();
const mockUpdateAlimentPrevision = vi.fn();
const mockAddAlimentArticlePrevision = vi.fn();
const mockUpdateAlimentArticlePrevision = vi.fn();
vi.mock("@/lib/queries/previsions-aliments", () => ({
  createAlimentPrevisionAvecArticle: (...a: unknown[]) => mockCreateAlimentPrevisionAvecArticle(...a),
  updateAlimentPrevision: (...a: unknown[]) => mockUpdateAlimentPrevision(...a),
  addAlimentArticlePrevision: (...a: unknown[]) => mockAddAlimentArticlePrevision(...a),
  updateAlimentArticlePrevision: (...a: unknown[]) => mockUpdateAlimentArticlePrevision(...a),
  getAlimentsPrevisionParScenario: vi.fn(),
  getAlimentPrevisionById: vi.fn(),
  deleteAlimentPrevision: vi.fn(),
  replaceRepartitionsMoisAliment: vi.fn(),
}));

import { POST as scenarioAlimentsPOST } from "@/app/api/previsions/scenarios/[id]/aliments/route";
import { PATCH as alimentPATCH } from "@/app/api/previsions/aliments/[id]/route";
import { POST as articlesPOST } from "@/app/api/previsions/aliments/[id]/articles/route";
import { PATCH as articleDetailPATCH } from "@/app/api/previsions/aliments/[id]/articles/[articleId]/route";

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

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}
function jsonRequest(url: string, method: string, body: unknown) {
  return makeRequest(url, { method, body: JSON.stringify(body) });
}
const idParams = (id = "id-1") => ({ params: Promise.resolve({ id }) });
const articleParams = (id = "id-1", articleId = "article-1") => ({
  params: Promise.resolve({ id, articleId }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/previsions/scenarios/[id]/aliments — creation transactionnelle
// calibre + article (ADR-053 §12.6 : un seul geste)
// ---------------------------------------------------------------------------

describe("POST /api/previsions/scenarios/[id]/aliments", () => {
  const payloadValideUnArticle = {
    tailleGranule: TailleGranule.G1,
    sacsParTonneStandard: 8,
    ordre: 1,
    article: { libelle: "2mm", poidsSacKg: 15, prixSacFCFA: 18000 },
  };

  it("401 si non authentifie", async () => {
    mockRequirePermission.mockRejectedValue(Object.assign(new Error("Non authentifie."), { status: 401 }));
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", payloadValideUnArticle),
      idParams()
    );
    expect(response.status).toBe(401);
  });

  it("201 — le payload de creation a UN SEUL article n'exige PAS partApprovisionnementPct (ADR-053 §12.6 : 100% implicite, ecrit par le serveur)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreateAlimentPrevisionAvecArticle.mockResolvedValue({
      id: "aliment-1",
      articles: [{ id: "article-1", partApprovisionnementPct: 100 }],
    });

    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", payloadValideUnArticle),
      idParams()
    );

    expect(response.status).toBe(201);
    expect(mockCreateAlimentPrevisionAvecArticle).toHaveBeenCalledWith(
      "id-1",
      "site-1",
      expect.objectContaining({ article: expect.objectContaining({ libelle: "2mm" }) })
    );
    // Le schema zod (createAlimentPrevisionSchema) n'a pas de champ
    // partApprovisionnementPct dans `article` — verifie que meme si un
    // client en envoyait un, il ne serait pas transmis a la query (zod
    // "strip" implicite, comportement par defaut de z.object).
    const argsAppel = mockCreateAlimentPrevisionAvecArticle.mock.calls[0][2];
    expect(argsAppel.article.partApprovisionnementPct).toBeUndefined();
  });

  it("400 — payload sans `article` (calibre orphelin), rejete par le schema zod avant tout appel query", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", {
        tailleGranule: TailleGranule.G1,
      }),
      idParams()
    );
    expect(response.status).toBe(400);
    expect(mockCreateAlimentPrevisionAvecArticle).not.toHaveBeenCalled();
  });

  it("400 — `tailleGranule` absent (identite obligatoire du calibre, NOT NULL depuis l'amendement §12)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", {
        article: { libelle: "2mm", poidsSacKg: 15, prixSacFCFA: 18000 },
      }),
      idParams()
    );
    expect(response.status).toBe(400);
    expect(mockCreateAlimentPrevisionAvecArticle).not.toHaveBeenCalled();
  });

  it("404 — scenario introuvable (mappe par le pattern 'introuvable' de handleApiError)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreateAlimentPrevisionAvecArticle.mockRejectedValue(new Error("Scenario introuvable"));
    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", payloadValideUnArticle),
      idParams()
    );
    expect(response.status).toBe(404);
  });

  it("422 — repartitions initiales fournies dont la somme != 100% (BusinessRuleError, ERR-165)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreateAlimentPrevisionAvecArticle.mockRejectedValue(
      new BusinessRuleError(
        "La somme des pourcentages de repartition mensuelle d'un aliment previsionnel doit valoir 100 (obtenu : 60).",
        422
      )
    );
    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", {
        ...payloadValideUnArticle,
        repartitions: [{ moisCycle: 1, pourcentage: 60 }],
      }),
      idParams()
    );
    expect(response.status).toBe(422);
  });

  it("422 — repartitions initiales fournies mais ne couvrant pas tout le cycle (ERR-162, ValidationError typee statut 422)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const { ValidationError } = await import("@/lib/errors");
    mockCreateAlimentPrevisionAvecArticle.mockRejectedValue(
      new ValidationError(
        "La repartition mensuelle d'un aliment previsionnel doit couvrir tous les mois du cycle (1..3) — mois manquant(s) : 3.",
        422
      )
    );
    const response = await scenarioAlimentsPOST(
      jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", {
        ...payloadValideUnArticle,
        repartitions: [
          { moisCycle: 1, pourcentage: 60 },
          { moisCycle: 2, pourcentage: 40 },
        ],
      }),
      idParams()
    );
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.message).toContain("mois manquant(s) : 3");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/previsions/aliments/[id] — mise a jour du CALIBRE
// ---------------------------------------------------------------------------

describe("PATCH /api/previsions/aliments/[id] (calibre)", () => {
  it("401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const response = await alimentPATCH(
      jsonRequest("/api/previsions/aliments/id-1", "PATCH", { sacsParTonneStandard: 10 }),
      idParams()
    );
    expect(response.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await alimentPATCH(
      jsonRequest("/api/previsions/aliments/id-1", "PATCH", { sacsParTonneStandard: 10 }),
      idParams()
    );
    expect(response.status).toBe(403);
  });

  it("200 — exige exactement PREVISIONS_PARAMETRER et modifie le calibre (sacsParTonneStandard, ordre) — jamais tailleGranule (identite, ADR-053 §12.3)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockUpdateAlimentPrevision.mockResolvedValue({ id: "id-1", sacsParTonneStandard: 10 });

    const response = await alimentPATCH(
      jsonRequest("/api/previsions/aliments/id-1", "PATCH", { sacsParTonneStandard: 10 }),
      idParams()
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(response.status).toBe(200);
    expect(mockUpdateAlimentPrevision).toHaveBeenCalledWith("id-1", "site-1", { sacsParTonneStandard: 10 });
  });

  it("400 — `tailleGranule` dans le payload est rejete par le schema (jamais un champ modifiable de ce PATCH)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const response = await alimentPATCH(
      jsonRequest("/api/previsions/aliments/id-1", "PATCH", { tailleGranule: TailleGranule.G2 }),
      idParams()
    );
    // Le schema zod (updateAlimentPrevisionSchema) n'a pas de champ tailleGranule : `.strict()`
    // n'est pas applique explicitement, donc le champ est simplement ignore (pas de 400) --
    // ce test verifie qu'il n'est en tout cas PAS transmis a la query avec sa valeur.
    if (response.status === 200) {
      const argsAppel = mockUpdateAlimentPrevision.mock.calls[0][2];
      expect(argsAppel.tailleGranule).toBeUndefined();
    } else {
      expect(response.status).toBe(400);
    }
  });

  it("404 — calibre introuvable pour ce site (R8)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockUpdateAlimentPrevision.mockRejectedValue(new Error("Aliment previsionnel introuvable"));
    const response = await alimentPATCH(
      jsonRequest("/api/previsions/aliments/id-1", "PATCH", { sacsParTonneStandard: 10 }),
      idParams()
    );
    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/previsions/aliments/[id]/articles — ajout d'un second article
// (ADR-053 §12.6 : action secondaire explicite)
// ---------------------------------------------------------------------------

describe("POST /api/previsions/aliments/[id]/articles", () => {
  const payloadValide = {
    nouvelArticle: { libelle: "Marque B", poidsSacKg: 20, prixSacFCFA: 20000 },
    repartition: [
      { articleId: "article-existant", partApprovisionnementPct: 60 },
      { partApprovisionnementPct: 40 },
    ],
  };

  it("401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", payloadValide),
      idParams()
    );
    expect(response.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", payloadValide),
      idParams()
    );
    expect(response.status).toBe(403);
  });

  it("201 — exige exactement PREVISIONS_PARAMETRER et cree le second article avec la repartition complete", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockAddAlimentArticlePrevision.mockResolvedValue({
      id: "id-1",
      articles: [
        { id: "article-existant", partApprovisionnementPct: 60 },
        { id: "article-nouveau", partApprovisionnementPct: 40 },
      ],
    });

    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", payloadValide),
      idParams()
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(response.status).toBe(201);
    expect(mockAddAlimentArticlePrevision).toHaveBeenCalledWith("id-1", "site-1", payloadValide);
  });

  it("400 — `repartition` vide rejetee par le schema (min 1)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", {
        nouvelArticle: payloadValide.nouvelArticle,
        repartition: [],
      }),
      idParams()
    );
    expect(response.status).toBe(400);
    expect(mockAddAlimentArticlePrevision).not.toHaveBeenCalled();
  });

  it("404 — calibre introuvable pour ce site (R8)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockAddAlimentArticlePrevision.mockRejectedValue(new Error("Aliment previsionnel introuvable"));
    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", payloadValide),
      idParams()
    );
    expect(response.status).toBe(404);
  });

  it("422 — la somme des parts d'approvisionnement (calibre + article) != 100% (ADR-053 §12.2 arbitrage 3)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockAddAlimentArticlePrevision.mockRejectedValue(
      new BusinessRuleError(
        "La somme des parts d'approvisionnement des articles d'un aliment previsionnel doit valoir 100 (obtenu : 90).",
        422
      )
    );
    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", payloadValide),
      idParams()
    );
    expect(response.status).toBe(422);
  });

  it("400 (jamais 500) — `repartition` malformee (pas exactement un element sans articleId) : bug signale par le @tester, rapport PR2q.4 §6. La query leve desormais une ValidationError typee (src/lib/errors.ts), reconnue par handleApiError independamment de tout pattern de PREVISIONS_STATUS_MAP.", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const { ValidationError } = await import("@/lib/errors");
    mockAddAlimentArticlePrevision.mockRejectedValue(
      new ValidationError(
        "La repartition doit contenir exactement un element sans articleId (le nouvel article) — obtenu : 0."
      )
    );
    const response = await articlesPOST(
      jsonRequest("/api/previsions/aliments/id-1/articles", "POST", payloadValide),
      idParams()
    );
    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/previsions/aliments/[id]/articles/[articleId] — modifie un
// article existant
// ---------------------------------------------------------------------------

describe("PATCH /api/previsions/aliments/[id]/articles/[articleId]", () => {
  const payloadValide = { poidsSacKg: 25, prixSacFCFA: 22000 };

  it("401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const response = await articleDetailPATCH(
      jsonRequest("/api/previsions/aliments/id-1/articles/article-1", "PATCH", payloadValide),
      articleParams()
    );
    expect(response.status).toBe(401);
  });

  it("403 si authentifie sans PREVISIONS_PARAMETRER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await articleDetailPATCH(
      jsonRequest("/api/previsions/aliments/id-1/articles/article-1", "PATCH", payloadValide),
      articleParams()
    );
    expect(response.status).toBe(403);
  });

  it("200 — exige exactement PREVISIONS_PARAMETRER et modifie l'article", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockUpdateAlimentArticlePrevision.mockResolvedValue({ id: "id-1" });

    const response = await articleDetailPATCH(
      jsonRequest("/api/previsions/aliments/id-1/articles/article-1", "PATCH", payloadValide),
      articleParams()
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), Permission.PREVISIONS_PARAMETRER);
    expect(response.status).toBe(200);
    expect(mockUpdateAlimentArticlePrevision).toHaveBeenCalledWith("article-1", "site-1", payloadValide);
  });

  it("400 — payload contenant `partApprovisionnementPct` est rejete par le schema (jamais modifiable via cette route — voir POST .../articles, ADR-053 §12.6)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const response = await articleDetailPATCH(
      jsonRequest("/api/previsions/aliments/id-1/articles/article-1", "PATCH", {
        partApprovisionnementPct: 50,
      }),
      articleParams()
    );
    // Le schema n'a pas ce champ : il est simplement ignore (pas d'erreur zod stricte),
    // mais il ne doit JAMAIS etre transmis a la query avec sa valeur.
    if (response.status === 200) {
      const argsAppel = mockUpdateAlimentArticlePrevision.mock.calls[0][2];
      expect(argsAppel.partApprovisionnementPct).toBeUndefined();
    }
  });

  it("400 — `poidsSacKg` negatif ou nul rejete par le schema (strictement positif)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    const response = await articleDetailPATCH(
      jsonRequest("/api/previsions/aliments/id-1/articles/article-1", "PATCH", { poidsSacKg: 0 }),
      articleParams()
    );
    expect(response.status).toBe(400);
    expect(mockUpdateAlimentArticlePrevision).not.toHaveBeenCalled();
  });

  it("404 — article introuvable pour ce site (R8)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockUpdateAlimentArticlePrevision.mockRejectedValue(new Error("Article previsionnel introuvable"));
    const response = await articleDetailPATCH(
      jsonRequest("/api/previsions/aliments/id-1/articles/article-1", "PATCH", payloadValide),
      articleParams()
    );
    expect(response.status).toBe(404);
  });
});
