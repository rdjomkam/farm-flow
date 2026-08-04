/**
 * Tests unitaires — Mapping HTTP des trois validations bloquantes du §8 de
 * l'ADR-053 (Sprint PR2, story PR2.2) : elles doivent produire un 4xx, jamais
 * un 500 (risque n°1 identifie par la pre-analyse PR2.2, §8 point 1).
 *
 *  a. somme des pourcentages de repartition != 100% -> 422
 *  b. seuils de remise non strictement croissants -> 422
 *  c. valeur fractionnaire sur une colonne Int (assertEntierColonneInt) -> 400
 *  d. `sacsParTonneStandard` null pour une granulometrie utilisee -> 422
 *     (ADR-053 amendement Sprint PR2 §11 ; revrification story PR2.2 post-fix)
 *
 * Verifie a la fois le contrat de `PREVISIONS_STATUS_MAP` (_shared.ts) et son
 * cablage reel sur une route representative de chaque cas (pas seulement le
 * mapping en isolation).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";
import { PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";
import { handleApiError } from "@/lib/api-utils";
import { Decimal } from "@/lib/previsions/decimal-config";

// ---------------------------------------------------------------------------
// 1. Le contrat du statusMap partage, en isolation (rapide, sans routes)
// ---------------------------------------------------------------------------

describe("PREVISIONS_STATUS_MAP — contrat de mapping HTTP", () => {
  it("mappe 'doit valoir 100' a 422 (repartition != 100%)", () => {
    const response = handleApiError(
      "test",
      new Error("La somme des pourcentages de repartition doit valoir 100 pour ce mois de cycle."),
      "fallback",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
    expect(response.status).toBe(422);
  });

  it("mappe 'seuils strictement croissants' a 422 (paliers de remise non croissants)", () => {
    const response = handleApiError(
      "test",
      new Error("Les paliers de remise doivent avoir des seuils strictement croissants."),
      "fallback",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
    expect(response.status).toBe(422);
  });

  it("mappe 'doit etre un entier (colonne Prisma Int)' a 400 (garde assertEntierColonneInt)", () => {
    const response = handleApiError(
      "test",
      new Error("La valeur 3.7 doit etre un entier (colonne Prisma Int) pour sacsCalcules."),
      "fallback",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
    expect(response.status).toBe(400);
  });

  it("mappe 'sacsParTonneStandard non configure' a 422 (rejet explicite GAP 1, ADR-053 amendement §11)", () => {
    const response = handleApiError(
      "test",
      new Error(
        'Impossible de calculer le besoin en aliment : sacsParTonneStandard non configure pour la granulometrie "2mm".'
      ),
      "fallback",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
    expect(response.status).toBe(422);
  });

  it("sans statusMap, un Error nu tomberait en 500 (preuve du risque documente par la pre-analyse)", () => {
    // Verifie explicitement que le risque etait reel : sans statusMap, le
    // meme message qui produit un 422 ci-dessus retombe en 500.
    const response = handleApiError(
      "test",
      new Error("La somme des pourcentages de repartition doit valoir 100 pour ce mois de cycle."),
      "fallback"
      // pas de statusMap
    );
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 2. Cablage reel sur des routes representatives
// ---------------------------------------------------------------------------

const mockRequirePermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock("@/lib/auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/errors", () => ({ ValidationError: class ValidationError extends Error {} }));

const mockReplaceRepartitionsMoisAliment = vi.fn();
const mockCreateAlimentPrevision = vi.fn();
vi.mock("@/lib/queries/previsions-aliments", () => ({
  replaceRepartitionsMoisAliment: (...a: unknown[]) => mockReplaceRepartitionsMoisAliment(...a),
  createAlimentPrevision: (...a: unknown[]) => mockCreateAlimentPrevision(...a),
  getAlimentPrevisionById: vi.fn(),
  deleteAlimentPrevision: vi.fn(),
  getAlimentsPrevisionParScenario: vi.fn(),
}));

const mockReplacePaliersRemise = vi.fn();
vi.mock("@/lib/queries/previsions-scenarios", () => ({
  replacePaliersRemise: (...a: unknown[]) => mockReplacePaliersRemise(...a),
  getScenarios: vi.fn(),
  createScenario: vi.fn(),
  getScenarioById: vi.fn(),
  updateParametresPrevision: vi.fn(),
  archiverScenario: vi.fn(),
  activerScenario: vi.fn(),
}));

const mockReplaceAlimentsParVaguePrevue = vi.fn();
vi.mock("@/lib/queries/previsions-vagues", () => ({
  replaceAlimentsParVaguePrevue: (...a: unknown[]) => mockReplaceAlimentsParVaguePrevue(...a),
  getVaguesPrevuesParScenario: vi.fn(),
  createVaguePrevue: vi.fn(),
  getVaguePrevueById: vi.fn(),
  updateVaguePrevue: vi.fn(),
  annulerVaguePrevue: vi.fn(),
  scinderVaguePrevue: vi.fn(),
  rattacherVaguePrevue: vi.fn(),
  updateSacsSaisis: vi.fn(),
}));

const mockChargerScenarioPourMoteur = vi.fn();
vi.mock("@/lib/queries/previsions-scenario-loader", () => ({
  chargerScenarioPourMoteur: (...a: unknown[]) => mockChargerScenarioPourMoteur(...a),
}));

import { PUT as repartitionsPUT } from "@/app/api/previsions/aliments/[id]/repartitions/route";
import { PUT as paliersPUT } from "@/app/api/previsions/scenarios/[id]/paliers-remise/route";
import { PUT as vaguePrevueAlimentsPUT } from "@/app/api/previsions/vagues-prevues/[id]/aliments/route";
import { GET as calculerGET } from "@/app/api/previsions/scenarios/[id]/calculer/route";

const AUTH_CONTEXT = {
  userId: "user-1",
  activeSiteId: "site-1",
  permissions: Object.values(Permission),
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method, body: JSON.stringify(body) });
}
const idParams = { params: Promise.resolve({ id: "id-1" }) };

describe("Cablage reel — somme des pourcentages != 100% -> 422, pas 500", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("PUT /aliments/[id]/repartitions renvoie 422 quand la query rejette avec le message metier", async () => {
    mockReplaceRepartitionsMoisAliment.mockRejectedValue(
      new Error("La somme des pourcentages de repartition doit valoir 100 pour cet aliment.")
    );

    const response = await repartitionsPUT(
      jsonRequest("/api/previsions/aliments/id-1/repartitions", "PUT", {
        repartitions: [{ moisCycle: 1, pourcentage: 60 }],
      }),
      idParams
    );

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.message).toContain("doit valoir 100");
  });
});

describe("Cablage reel — seuils de remise non strictement croissants -> 422, pas 500", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("PUT /scenarios/[id]/paliers-remise renvoie 422 quand la query rejette avec le message metier", async () => {
    mockReplacePaliersRemise.mockRejectedValue(
      new Error("Les paliers de remise doivent avoir des seuils strictement croissants.")
    );

    const response = await paliersPUT(
      jsonRequest("/api/previsions/scenarios/id-1/paliers-remise", "PUT", {
        paliers: [
          { seuilTonnes: 20, pourcentageRemise: 5, ordre: 1 },
          { seuilTonnes: 10, pourcentageRemise: 8, ordre: 2 },
        ],
      }),
      idParams
    );

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.message).toContain("seuils strictement croissants");
  });

  /**
   * Ajout @tester (sprint PR2-septies) — trou de couverture reel : l'entree
   * `{ match: "meme ordre d'evaluation", status: 422 }` de
   * `PREVISIONS_STATUS_MAP` n'etait exercee par AUCUN test. La garde metier de
   * `replacePaliersRemise` est bien testee au niveau query
   * (`previsions-scenarios.test.ts`), et la garde zod au niveau route (test
   * suivant), mais rien ne verifiait que l'erreur de la garde metier, quand
   * elle remonte a la route (chemin reel des appelants HORS route, et filet de
   * securite si la garde zod venait a etre relachee), sort bien en 4xx avec le
   * message metier — sans cette entree de map, elle sortirait en 500.
   *
   * Statut attendu : 400, pas 422 (correctif reserve M3, review PR2sept.4).
   * Le meme refus metier passe par zod sur le chemin HTTP reel et y sort en
   * 400 (test suivant) : un unique refus ne peut pas avoir deux codes selon
   * le chemin emprunte. `PREVISIONS_STATUS_MAP` a donc ete aligne sur 400.
   */
  it("PUT /scenarios/[id]/paliers-remise renvoie 400 (jamais 500) quand la garde METIER de la query rejette un doublon d'ordre", async () => {
    mockReplacePaliersRemise.mockRejectedValue(
      new Error(
        "Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation (ordre=2 apparait plusieurs fois)."
      )
    );

    const response = await paliersPUT(
      jsonRequest("/api/previsions/scenarios/id-1/paliers-remise", "PUT", {
        paliers: [
          { seuilTonnes: 5, pourcentageRemise: 2, ordre: 1 },
          { seuilTonnes: 10, pourcentageRemise: 4, ordre: 2 },
        ],
      }),
      idParams
    );

    expect(response.status).toBe(400);
    // Jamais une erreur serveur : c'est un refus de saisie, pas un incident.
    expect(response.status).not.toBe(500);
    const data = await response.json();
    expect(data.message).toContain("meme ordre d'evaluation");
    // Aucun message Prisma ne doit transparaitre.
    expect(data.message).not.toContain("Cette valeur existe deja");
    expect(JSON.stringify(data)).not.toContain("P2002");
  });

  /**
   * Doublon d'`ordre` : sans la garde metier, zod passait,
   * `validerPaliersRemiseCroissants` passait (elle ne verifie que les seuils),
   * puis `createMany` echouait sur `@@unique([scenarioId, ordre])` en P2002 —
   * l'utilisateur lisait "Cette valeur existe deja (scenarioId, ordre)", un
   * message de base de donnees dans une UI francaise (409 opaque).
   */
  it("PUT /scenarios/[id]/paliers-remise renvoie 400 metier (pas 409 P2002) quand deux paliers partagent le meme ordre", async () => {
    const response = await paliersPUT(
      jsonRequest("/api/previsions/scenarios/id-1/paliers-remise", "PUT", {
        paliers: [
          { seuilTonnes: 5, pourcentageRemise: 2, ordre: 1 },
          { seuilTonnes: 10, pourcentageRemise: 4, ordre: 1 },
        ],
      }),
      idParams
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toEqual([
      {
        field: "paliers.1.ordre",
        message: expect.stringContaining("meme ordre d'evaluation"),
      },
    ]);
    // La query n'est meme pas atteinte : le payload est refuse en amont.
    expect(mockReplacePaliersRemise).not.toHaveBeenCalled();
  });
});

describe("Cablage reel — valeur fractionnaire sur colonne Int -> 400, pas 500", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("PUT /vagues-prevues/[id]/aliments renvoie 400 quand la garde assertEntierColonneInt rejette", async () => {
    mockReplaceAlimentsParVaguePrevue.mockRejectedValue(
      new Error("La valeur 3.7 doit etre un entier (colonne Prisma Int) pour sacsCalcules.")
    );

    const response = await vaguePrevueAlimentsPUT(
      jsonRequest("/api/previsions/vagues-prevues/id-1/aliments", "PUT", {
        lignes: [
          {
            alimentPrevisionId: "aliment-1",
            moisCycle: 1,
            sacsCalcules: 10,
            sacsSaisis: null,
            quantiteKgCalculee: 150,
            coutCalculeFCFA: 180000,
          },
        ],
      }),
      idParams
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain("colonne Prisma Int");
  });
});

describe("Cablage reel — GET /scenarios/[id]/calculer, sacsParTonneStandard null -> 422, pas 500", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  function transportNul() {
    return { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) };
  }

  it(
    "renvoie 422 (jamais 500 ni un chiffre silencieux) quand un aliment reellement utilise " +
      "par une VaguePrevue active porte sacsParTonneStandard = null — verifie EN PASSANT PAR LA " +
      "VRAIE ROUTE (requirePermission -> chargerScenarioPourMoteur -> calculerProjectionScenario " +
      "-> handleApiError), pas seulement au niveau de la fonction pure d'orchestration",
    async () => {
      mockChargerScenarioPourMoteur.mockResolvedValue({
        id: "scenario-1",
        dateDebutPlan: new Date("2026-08-01"),
        parametres: {
          effectifAlevinsParVague: 5000,
          margeSecuriteAlevinsPct: new Decimal(10),
          tauxEpargnePct: new Decimal(30),
          poidsMoyenInitialG: new Decimal(5),
          poidsObjectifG: new Decimal(800),
          prixAlevinUnitaireFCFA: new Decimal(50),
          prixVenteKgFCFA: new Decimal(1500),
          nombreBacsSimultanesCible: 4,
          frequenceStockageMois: new Decimal(1),
          transportAliments: transportNul(),
          transportPoissons: transportNul(),
          transportAlevins: transportNul(),
        },
        paliersRemise: [],
        aliments: [
          {
            id: "aliment-2mm",
            tailleGranule: "G1",
            sacsParTonneStandard: null, // non configure — doit rejeter, jamais un defaut silencieux
            ordre: 1,
            repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
            articles: [
              {
                id: "article-2mm",
                produitId: null,
                libelle: "2mm",
                poidsSacKg: new Decimal(15),
                prixSacFCFA: new Decimal(18000),
                sacsParTonneUnitaire: new Decimal(1000).dividedBy(15),
                partApprovisionnementPct: new Decimal(100),
                ordre: 0,
              },
            ],
          },
        ],
        vaguesPrevues: [
          {
            id: "vp-1",
            code: "V1",
            dateStockagePrevue: new Date("2026-08-01"),
            effectifAlevinsPrevu: 5000,
            poidsMoyenInitialG: new Decimal(5),
            dureeCycleMoisFigee: 3,
            statut: "PLANIFIEE",
            vaguePrevueParentId: null,
            vagueReelleId: null,
            alimentsParMois: [],
          },
        ],
        postes: [],
        journal: [],
        apports: [],
      });

      const response = await calculerGET(
        new NextRequest(new URL("/api/previsions/scenarios/scenario-1/calculer", "http://localhost:3000")),
        { params: Promise.resolve({ id: "scenario-1" }) }
      );

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.message).toContain("sacsParTonneStandard");
      expect(data.message).toContain("G1");
    }
  );
});
