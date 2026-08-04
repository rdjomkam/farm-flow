/**
 * Tests unitaires — Sprint PR2, story PR2.2 :
 *  - `auth.activeSiteId` threade dans les queries (R8), spot-check sur un
 *    representant de chaque groupe de modeles (pas les 22 routes, deja
 *    couvert par PR2.1 pour la logique de filtrage elle-meme — ici on
 *    verifie que la ROUTE transmet bien le siteId issu de l'auth, jamais un
 *    siteId du body/params).
 *  - Route de calcul : jamais de `Decimal` brut dans la reponse JSON.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/types";
import { Decimal } from "@/lib/previsions/decimal-config";

const mockRequirePermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock("@/lib/auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/errors", () => ({ ValidationError: class ValidationError extends Error {} }));

const mockGetScenarioById = vi.fn();
vi.mock("@/lib/queries/previsions-scenarios", () => ({
  getScenarioById: (...a: unknown[]) => mockGetScenarioById(...a),
  getScenarios: vi.fn(),
  createScenario: vi.fn(),
  updateParametresPrevision: vi.fn(),
  replacePaliersRemise: vi.fn(),
  archiverScenario: vi.fn(),
  activerScenario: vi.fn(),
}));

const mockGetVaguePrevueById = vi.fn();
vi.mock("@/lib/queries/previsions-vagues", () => ({
  getVaguePrevueById: (...a: unknown[]) => mockGetVaguePrevueById(...a),
  getVaguesPrevuesParScenario: vi.fn(),
  createVaguePrevue: vi.fn(),
  updateVaguePrevue: vi.fn(),
  annulerVaguePrevue: vi.fn(),
  scinderVaguePrevue: vi.fn(),
  rattacherVaguePrevue: vi.fn(),
  replaceAlimentsParVaguePrevue: vi.fn(),
  updateSacsSaisis: vi.fn(),
}));

const mockChargerScenarioPourMoteur = vi.fn();
vi.mock("@/lib/queries/previsions-scenario-loader", () => ({
  chargerScenarioPourMoteur: (...a: unknown[]) => mockChargerScenarioPourMoteur(...a),
}));

import { GET as scenarioDetailGET } from "@/app/api/previsions/scenarios/[id]/route";
import { GET as vaguePrevueDetailGET } from "@/app/api/previsions/vagues-prevues/[id]/route";
import { GET as calculerGET } from "@/app/api/previsions/scenarios/[id]/calculer/route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

const AUTH_CONTEXT_SITE_A = {
  userId: "user-1",
  activeSiteId: "site-A",
  permissions: Object.values(Permission),
};

describe("R8 — auth.activeSiteId threade dans les queries, jamais un autre site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_SITE_A);
  });

  it("GET /scenarios/[id] appelle getScenarioById avec l'activeSiteId de l'auth, pas un siteId arbitraire", async () => {
    mockGetScenarioById.mockResolvedValue({ id: "scenario-1", siteId: "site-A" });

    await scenarioDetailGET(makeRequest("/api/previsions/scenarios/scenario-1"), idParams("scenario-1"));

    expect(mockGetScenarioById).toHaveBeenCalledWith("scenario-1", "site-A");
  });

  it("GET /scenarios/[id] renvoie 404 (jamais le contenu) si le scenario appartient a un autre site", async () => {
    // Simule le comportement attendu de la query (PR2.1) : filtre siteId ->
    // ressource d'un autre site invisible, jamais retournee.
    mockGetScenarioById.mockResolvedValue(null);

    const response = await scenarioDetailGET(
      makeRequest("/api/previsions/scenarios/scenario-autre-site"),
      idParams("scenario-autre-site")
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain("introuvable");
  });

  it("GET /vagues-prevues/[id] appelle getVaguePrevueById avec l'activeSiteId de l'auth", async () => {
    mockGetVaguePrevueById.mockResolvedValue({ id: "vp-1", siteId: "site-A" });

    await vaguePrevueDetailGET(makeRequest("/api/previsions/vagues-prevues/vp-1"), idParams("vp-1"));

    expect(mockGetVaguePrevueById).toHaveBeenCalledWith("vp-1", "site-A");
  });

  it("GET /vagues-prevues/[id] renvoie 404 pour une VaguePrevue d'un autre site", async () => {
    mockGetVaguePrevueById.mockResolvedValue(null);

    const response = await vaguePrevueDetailGET(
      makeRequest("/api/previsions/vagues-prevues/vp-autre-site"),
      idParams("vp-autre-site")
    );

    expect(response.status).toBe(404);
  });

  it("GET /scenarios/[id]/calculer appelle chargerScenarioPourMoteur avec l'activeSiteId de l'auth", async () => {
    mockChargerScenarioPourMoteur.mockResolvedValue({
      id: "scenario-1",
      dateDebutPlan: new Date("2026-08-01"),
      parametres: {
        transportAliments: { capacite: new Decimal(1), coutUnitaireFCFA: new Decimal(0) },
        transportPoissons: { capacite: new Decimal(1), coutUnitaireFCFA: new Decimal(0) },
        transportAlevins: { capacite: new Decimal(1), coutUnitaireFCFA: new Decimal(0) },
        poidsObjectifG: new Decimal(800),
        prixVenteKgFCFA: new Decimal(1500),
        prixAlevinUnitaireFCFA: new Decimal(50),
      },
      paliersRemise: [],
      aliments: [],
      vaguesPrevues: [],
      postes: [],
      journal: [],
      apports: [],
    });

    await calculerGET(makeRequest("/api/previsions/scenarios/scenario-1/calculer"), idParams("scenario-1"));

    expect(mockChargerScenarioPourMoteur).toHaveBeenCalledWith("scenario-1", "site-A");
  });
});

describe("GET /scenarios/[id]/calculer — serialisation : aucun Decimal brut dans la reponse JSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_SITE_A);
  });

  it("tous les champs numeriques de la reponse sont des `number` JS, jamais un objet Decimal serialise", async () => {
    mockChargerScenarioPourMoteur.mockResolvedValue({
      id: "scenario-1",
      dateDebutPlan: new Date("2026-08-01"),
      parametres: {
        transportAliments: { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) },
        transportPoissons: { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) },
        transportAlevins: { capacite: new Decimal(1_000_000), coutUnitaireFCFA: new Decimal(0) },
        poidsObjectifG: new Decimal(800),
        prixVenteKgFCFA: new Decimal(1500),
        prixAlevinUnitaireFCFA: new Decimal(50),
        effectifAlevinsParVague: 5000,
        margeSecuriteAlevinsPct: new Decimal(10),
        tauxEpargnePct: new Decimal(30),
        poidsMoyenInitialG: new Decimal(5),
        nombreBacsSimultanesCible: 4,
        frequenceStockageMois: new Decimal(1),
      },
      paliersRemise: [],
      aliments: [
        {
          id: "aliment-1",
          tailleGranule: "G1",
          // Non-null : depuis l'amendement ADR-053 §11 (Sprint PR2), un `sacsParTonneStandard`
          // null pour une granulometrie utilisee est rejete explicitement (422) par
          // route-orchestration.ts. Ce test verifie la serialisation JSON, pas ce rejet — il a
          // donc besoin d'une valeur configuree pour atteindre une reponse 200.
          sacsParTonneStandard: new Decimal(8),
          ordre: 1,
          repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
          // ADR-053 §12.6 : cas nominal, un seul article a 100%.
          articles: [
            {
              id: "article-1",
              produitId: null,
              libelle: "2mm",
              poidsSacKg: new Decimal(15),
              prixSacFCFA: new Decimal(18000),
              sacsParTonneUnitaire: new Decimal(66.67),
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
      makeRequest("/api/previsions/scenarios/scenario-1/calculer"),
      idParams("scenario-1")
    );
    expect(response.status).toBe(200);

    const raw = await response.text();
    // Un Decimal serialise par JSON.stringify produirait un objet {"s":1,"e":3,"d":[...]}
    // (structure interne decimal.js) — jamais present dans une reponse propre.
    expect(raw).not.toMatch(/"d":\s*\[/);
    expect(raw).not.toMatch(/"s":\s*1,\s*"e":/);

    const data = JSON.parse(raw);
    expect(typeof data.pointBas === "object" || data.pointBas === null).toBe(true);
    for (const mois of data.mois) {
      expect(typeof mois.revenusFCFA).toBe("number");
      expect(typeof mois.depensesFCFA).toBe("number");
      expect(typeof mois.soldeFCFA).toBe("number");
    }
    expect(typeof data.budget.budgetTotalFCFA).toBe("number");
  });
});
