/**
 * Tests unitaires — Mapping HTTP des validations bloquantes du module
 * Previsions (Sprint PR2, story PR2.2 ; mecanisme remplace Sprint PR3, story
 * PR3.2, ERR-165).
 *
 *  a. somme des pourcentages de repartition != 100% -> 422
 *  b. seuils de remise non strictement croissants -> 422
 *  c. valeur fractionnaire sur une colonne Int (assertEntierColonneInt) -> 400
 *  d. `sacsParTonneStandard` null pour une granulometrie utilisee -> 422
 *     (ADR-053 amendement Sprint PR2 §11 ; revrification story PR2.2 post-fix)
 *
 * ERR-165 (docs/knowledge/ERRORS-AND-FIXES.md) : le mecanisme historique
 * (`PREVISIONS_STATUS_MAP`, `_shared.ts`) deduisait le statut HTTP d'une
 * SOUS-CHAINE du message utilisateur — accentuer un message (correction
 * legitime dans une UI francaise) cassait silencieusement le lien et faisait
 * retomber le cas en 500. Remplace (ADR-053 §15.4, sprint PR3, story PR3.2)
 * par `BusinessRuleError` (`src/lib/errors.ts`), qui porte son `status` comme
 * DONNEE. `PREVISIONS_STATUS_MAP` est supprime — ce fichier verifie desormais
 * le contrat du nouveau mecanisme (section 1) puis son cablage reel sur une
 * route representative de chaque cas (section 2), et enfin, par
 * falsification, que le statut HTTP ne depend plus du texte du message
 * (section 3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { BusinessRuleError } from "@/lib/errors";
import { Decimal } from "@/lib/previsions/decimal-config";

// ---------------------------------------------------------------------------
// 1. Le contrat de BusinessRuleError + handleApiError, en isolation (rapide,
//    sans routes) — couvre les 7 sites de levee migres depuis
//    PREVISIONS_STATUS_MAP (ERR-165).
// ---------------------------------------------------------------------------

describe("BusinessRuleError + handleApiError — contrat de statut HTTP (ERR-165)", () => {
  it("BusinessRuleError(422) — somme des pourcentages de repartition != 100%", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError(
        "La somme des pourcentages de repartition doit valoir 100 pour ce mois de cycle.",
        422
      ),
      "fallback"
    );
    expect(response.status).toBe(422);
  });

  it("BusinessRuleError(422) — seuils de remise non strictement croissants", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError(
        "Les paliers de remise doivent avoir des seuils strictement croissants.",
        422
      ),
      "fallback"
    );
    expect(response.status).toBe(422);
  });

  it("BusinessRuleError(400) — valeur fractionnaire sur une colonne Prisma Int (assertEntierColonneInt)", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError("La valeur 3.7 doit etre un entier (colonne Prisma Int) pour sacsCalcules.", 400),
      "fallback"
    );
    expect(response.status).toBe(400);
  });

  it("BusinessRuleError(422) — sacsParTonneStandard non configure (rejet explicite GAP 1, ADR-053 amendement §11)", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError(
        'Impossible de calculer le besoin en aliment : sacsParTonneStandard non configure pour la granulometrie "2mm".',
        422
      ),
      "fallback"
    );
    expect(response.status).toBe(422);
  });

  it("BusinessRuleError(422) — ParametresPrevision absent pour le scenario", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError(
        "ParametresPrevision absent pour ce scenario. Renseignez l'onglet Parametres avant de generer un plan.",
        422
      ),
      "fallback"
    );
    expect(response.status).toBe(422);
  });

  it("BusinessRuleError(422) — produit(s) sans tailleGranule lors de la copie des aliments previsionnels", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError(
        "Impossible de copier les aliments previsionnels : produit(s) sans tailleGranule : Granule (id-1).",
        422
      ),
      "fallback"
    );
    expect(response.status).toBe(422);
  });

  it("BusinessRuleError(400) — deux paliers de remise partagent le meme ordre d'evaluation", () => {
    const response = handleApiError(
      "test",
      new BusinessRuleError(
        "Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation (ordre=2 apparait plusieurs fois).",
        400
      ),
      "fallback"
    );
    expect(response.status).toBe(400);
  });

  it("un Error nu (jamais une BusinessRuleError) retombe toujours en 500 — le filet de dernier recours reste actif", () => {
    const response = handleApiError(
      "test",
      new Error("La somme des pourcentages de repartition doit valoir 100 pour ce mois de cycle."),
      "fallback"
    );
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 2. Cablage reel sur des routes representatives — les queries levent
//    desormais BusinessRuleError, plus une Error nue.
// ---------------------------------------------------------------------------

const mockRequirePermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock("@/lib/auth", () => ({ AuthError: class AuthError extends Error {} }));

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

  it("PUT /aliments/[id]/repartitions renvoie 422 quand la query rejette avec une BusinessRuleError", async () => {
    mockReplaceRepartitionsMoisAliment.mockRejectedValue(
      new BusinessRuleError("La somme des pourcentages de repartition doit valoir 100 pour cet aliment.", 422)
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

  it("PUT /scenarios/[id]/paliers-remise renvoie 422 quand la query rejette avec une BusinessRuleError", async () => {
    mockReplacePaliersRemise.mockRejectedValue(
      new BusinessRuleError("Les paliers de remise doivent avoir des seuils strictement croissants.", 422)
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
   * Doublon d'`ordre` entre deux paliers — filet METIER de `replacePaliersRemise`
   * (query), pour les appelants NON-HTTP et si la garde zod venait a etre
   * relachee. Statut : 400 (correctif reserve M3, review PR2sept.4) — un
   * meme refus ne doit pas avoir deux codes selon le chemin emprunte, celui-ci
   * est aligne sur le chemin HTTP reel (garde zod, test suivant).
   */
  it("PUT /scenarios/[id]/paliers-remise renvoie 400 (jamais 500) quand la garde METIER de la query rejette un doublon d'ordre", async () => {
    mockReplacePaliersRemise.mockRejectedValue(
      new BusinessRuleError(
        "Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation (ordre=2 apparait plusieurs fois).",
        400
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
      new BusinessRuleError("La valeur 3.7 doit etre un entier (colonne Prisma Int) pour sacsCalcules.", 400)
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

// ---------------------------------------------------------------------------
// 3. Preuve par falsification (ERR-165, ADR-053 §15.4) : le statut HTTP ne
//    depend plus du texte du message. Meme protocole que les preuves par
//    falsification deja etablies dans ce module (ERR-142, ERR-160, ERR-171,
//    docs/knowledge/ERRORS-AND-FIXES.md) — on prouve l'absence de couplage en
//    MUTANT le message (ici : l'accentuer / le reformuler) et en verifiant
//    que le statut produit reste identique. Avec l'ANCIEN mecanisme
//    (`message.includes(...)` sur un texte sans accents), cette meme mutation
//    aurait fait retomber chacun de ces cas en 500 — c'est precisement le bug
//    ERR-165.
// ---------------------------------------------------------------------------

describe("Falsification — le statut HTTP ne depend plus du texte du message (ERR-165)", () => {
  it("statut 422 inchange quand le message 'doit valoir 100' est accentue et reformule", () => {
    const original = handleApiError(
      "test",
      new BusinessRuleError("La somme des pourcentages de repartition mensuelle doit valoir 100.", 422),
      "fallback"
    );
    const accentue = handleApiError(
      "test",
      // Message volontairement mute : accents ajoutés + reformulation ("mappage" au lieu de
      // "repartition", "%" ajouté) — exactement le type de correction légitime d'UI française
      // qui cassait silencieusement l'ancien PREVISIONS_STATUS_MAP.
      new BusinessRuleError("La somme des pourcentages de mappage mensuel doit valoir 100 %.", 422),
      "fallback"
    );

    expect(original.status).toBe(422);
    expect(accentue.status).toBe(422);
    expect(accentue.status).toBe(original.status);
  });

  it("statut 422 inchange quand le message 'non configure' est accentue en 'non configuré'", () => {
    const original = handleApiError(
      "test",
      new BusinessRuleError(
        'Impossible de calculer le besoin en aliment : sacsParTonneStandard non configure pour la granulometrie "2mm".',
        422
      ),
      "fallback"
    );
    const accentue = handleApiError(
      "test",
      new BusinessRuleError(
        'Impossible de calculer le besoin en aliment : le coefficient sacsParTonneStandard n\'est pas configuré pour la granulométrie "2mm".',
        422
      ),
      "fallback"
    );

    expect(original.status).toBe(422);
    expect(accentue.status).toBe(422);
    expect(accentue.status).toBe(original.status);
  });

  it("statut 400 inchange quand le message 'meme ordre d'evaluation' est accentue en 'même ordre d'évaluation'", () => {
    const original = handleApiError(
      "test",
      new BusinessRuleError(
        "Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation (ordre=2 apparait plusieurs fois).",
        400
      ),
      "fallback"
    );
    const accentue = handleApiError(
      "test",
      new BusinessRuleError(
        "Deux paliers de remise ne peuvent pas avoir le même ordre d'évaluation (ordre=2 apparaît plusieurs fois).",
        400
      ),
      "fallback"
    );

    expect(original.status).toBe(400);
    expect(accentue.status).toBe(400);
    expect(accentue.status).toBe(original.status);
  });

  it("statut 400 inchange quand le message 'doit etre un entier' est accentue en 'doit être un entier'", () => {
    const original = handleApiError(
      "test",
      new BusinessRuleError("ordre doit etre un entier (colonne Prisma Int) — valeur recue : 3.7.", 400),
      "fallback"
    );
    const accentue = handleApiError(
      "test",
      new BusinessRuleError("ordre doit être un entier (colonne Prisma Int) — valeur reçue : 3.7.", 400),
      "fallback"
    );

    expect(original.status).toBe(400);
    expect(accentue.status).toBe(400);
    expect(accentue.status).toBe(original.status);
  });
});
