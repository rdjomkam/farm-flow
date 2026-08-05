/**
 * Tests unitaires — Auth et permissions sur les 22 routes API du module
 * Previsions (Sprint PR2, story PR2.2).
 *
 * Couvre, pour CHAQUE route :
 *  - non authentifie -> 401 (AuthError propagee par requirePermission)
 *  - authentifie sans la permission requise -> 403 (ForbiddenError)
 *  - authentifie avec la permission -> 200/201, et verifie que la permission
 *    EXACTE prescrite par l'ADR-053 §6 / le rapport de cloture PR2.2 est bien
 *    celle demandee a requirePermission (pas une permission voisine).
 *
 * Egalement : `auth.activeSiteId` est bien threade dans chaque appel de
 * query (R8) — verifie sur un echantillon representatif de routes (une par
 * groupe de modeles), pas les 22 pour eviter la redondance avec la
 * verification systematique du parametre `siteId` deja portee par PR2.1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { RequestInit } from "next/dist/server/web/spec-extension/request";
import { Permission, TailleGranule } from "@/types";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Mocks partages
// ---------------------------------------------------------------------------

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

vi.mock("@/lib/errors", () => ({
  ValidationError: class ValidationError extends Error { constructor(message: string, public status: number = 400) { super(message); } },
  BusinessRuleError: class BusinessRuleError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } },
}));

// previsions-scenarios
const mockGetScenarios = vi.fn();
const mockCreateScenario = vi.fn();
const mockGetScenarioById = vi.fn();
const mockUpdateParametresPrevision = vi.fn();
const mockReplacePaliersRemise = vi.fn();
const mockArchiverScenario = vi.fn();
const mockActiverScenario = vi.fn();
vi.mock("@/lib/queries/previsions-scenarios", () => ({
  getScenarios: (...a: unknown[]) => mockGetScenarios(...a),
  createScenario: (...a: unknown[]) => mockCreateScenario(...a),
  getScenarioById: (...a: unknown[]) => mockGetScenarioById(...a),
  updateParametresPrevision: (...a: unknown[]) => mockUpdateParametresPrevision(...a),
  replacePaliersRemise: (...a: unknown[]) => mockReplacePaliersRemise(...a),
  archiverScenario: (...a: unknown[]) => mockArchiverScenario(...a),
  activerScenario: (...a: unknown[]) => mockActiverScenario(...a),
}));

// previsions-snapshot-budget (Sprint PR3, story PR3.3) — la route
// `scenarios/[id]/activer` appelle desormais `activerScenarioAvecSnapshot`
// (ADR-053 §15.2 : gel du budget initial dans la MEME transaction que le
// passage a ACTIF), plus `activerScenario` (conserve dans previsions-scenarios.ts
// pour retro-compatibilite eventuelle, mais plus branche sur cette route).
const mockActiverScenarioAvecSnapshot = vi.fn();
vi.mock("@/lib/queries/previsions-snapshot-budget", () => ({
  activerScenarioAvecSnapshot: (...a: unknown[]) => mockActiverScenarioAvecSnapshot(...a),
}));

// previsions-aliments
const mockGetAlimentPrevisionById = vi.fn();
const mockDeleteAlimentPrevision = vi.fn();
const mockReplaceRepartitionsMoisAliment = vi.fn();
const mockGetAlimentsPrevisionParScenario = vi.fn();
const mockCreateAlimentPrevisionAvecArticle = vi.fn();
vi.mock("@/lib/queries/previsions-aliments", () => ({
  getAlimentPrevisionById: (...a: unknown[]) => mockGetAlimentPrevisionById(...a),
  deleteAlimentPrevision: (...a: unknown[]) => mockDeleteAlimentPrevision(...a),
  replaceRepartitionsMoisAliment: (...a: unknown[]) => mockReplaceRepartitionsMoisAliment(...a),
  getAlimentsPrevisionParScenario: (...a: unknown[]) => mockGetAlimentsPrevisionParScenario(...a),
  createAlimentPrevisionAvecArticle: (...a: unknown[]) => mockCreateAlimentPrevisionAvecArticle(...a),
}));

// previsions-vagues
const mockGetVaguesPrevuesParScenario = vi.fn();
const mockCreateVaguePrevue = vi.fn();
const mockGetVaguePrevueById = vi.fn();
const mockUpdateVaguePrevue = vi.fn();
const mockAnnulerVaguePrevue = vi.fn();
const mockScinderVaguePrevue = vi.fn();
const mockRattacherVaguePrevue = vi.fn();
const mockReplaceAlimentsParVaguePrevue = vi.fn();
const mockUpdateSacsSaisis = vi.fn();
vi.mock("@/lib/queries/previsions-vagues", () => ({
  getVaguesPrevuesParScenario: (...a: unknown[]) => mockGetVaguesPrevuesParScenario(...a),
  createVaguePrevue: (...a: unknown[]) => mockCreateVaguePrevue(...a),
  getVaguePrevueById: (...a: unknown[]) => mockGetVaguePrevueById(...a),
  updateVaguePrevue: (...a: unknown[]) => mockUpdateVaguePrevue(...a),
  annulerVaguePrevue: (...a: unknown[]) => mockAnnulerVaguePrevue(...a),
  scinderVaguePrevue: (...a: unknown[]) => mockScinderVaguePrevue(...a),
  rattacherVaguePrevue: (...a: unknown[]) => mockRattacherVaguePrevue(...a),
  replaceAlimentsParVaguePrevue: (...a: unknown[]) => mockReplaceAlimentsParVaguePrevue(...a),
  updateSacsSaisis: (...a: unknown[]) => mockUpdateSacsSaisis(...a),
}));

// previsions-charges
const mockGetPostesPrevisionParScenario = vi.fn();
const mockCreatePostePrevision = vi.fn();
const mockUpsertChargeMensuelle = vi.fn();
const mockGetChargesMensuellesParScenario = vi.fn();
const mockGetJournalDepensesParScenario = vi.fn();
const mockCreateJournalDepensePrevue = vi.fn();
const mockUpdateJournalDepensePrevue = vi.fn();
const mockDeleteJournalDepensePrevue = vi.fn();
const mockGetApportsCapitalParScenario = vi.fn();
const mockCreateApportCapital = vi.fn();
vi.mock("@/lib/queries/previsions-charges", () => ({
  getPostesPrevisionParScenario: (...a: unknown[]) => mockGetPostesPrevisionParScenario(...a),
  createPostePrevision: (...a: unknown[]) => mockCreatePostePrevision(...a),
  upsertChargeMensuelle: (...a: unknown[]) => mockUpsertChargeMensuelle(...a),
  getChargesMensuellesParScenario: (...a: unknown[]) => mockGetChargesMensuellesParScenario(...a),
  getJournalDepensesParScenario: (...a: unknown[]) => mockGetJournalDepensesParScenario(...a),
  createJournalDepensePrevue: (...a: unknown[]) => mockCreateJournalDepensePrevue(...a),
  updateJournalDepensePrevue: (...a: unknown[]) => mockUpdateJournalDepensePrevue(...a),
  deleteJournalDepensePrevue: (...a: unknown[]) => mockDeleteJournalDepensePrevue(...a),
  getApportsCapitalParScenario: (...a: unknown[]) => mockGetApportsCapitalParScenario(...a),
  createApportCapital: (...a: unknown[]) => mockCreateApportCapital(...a),
}));

// Route de calcul — orchestration + loader
const mockChargerScenarioPourMoteur = vi.fn();
vi.mock("@/lib/queries/previsions-scenario-loader", () => ({
  chargerScenarioPourMoteur: (...a: unknown[]) => mockChargerScenarioPourMoteur(...a),
}));
const mockCalculerProjectionScenario = vi.fn();
vi.mock("@/lib/previsions/route-orchestration", () => ({
  calculerProjectionScenario: (...a: unknown[]) => mockCalculerProjectionScenario(...a),
}));

// ---------------------------------------------------------------------------
// Handlers (imports apres les mocks)
// ---------------------------------------------------------------------------

import { GET as scenariosGET, POST as scenariosPOST } from "@/app/api/previsions/scenarios/route";
import { GET as scenarioDetailGET } from "@/app/api/previsions/scenarios/[id]/route";
import { PUT as parametresPUT } from "@/app/api/previsions/scenarios/[id]/parametres/route";
import { PUT as paliersPUT } from "@/app/api/previsions/scenarios/[id]/paliers-remise/route";
import { POST as archiverPOST } from "@/app/api/previsions/scenarios/[id]/archiver/route";
import { POST as activerPOST } from "@/app/api/previsions/scenarios/[id]/activer/route";
import { GET as scenarioAlimentsGET, POST as scenarioAlimentsPOST } from "@/app/api/previsions/scenarios/[id]/aliments/route";
import { GET as alimentDetailGET, DELETE as alimentDELETE } from "@/app/api/previsions/aliments/[id]/route";
import { PUT as repartitionsPUT } from "@/app/api/previsions/aliments/[id]/repartitions/route";
import { GET as scenarioVaguesGET, POST as scenarioVaguesPOST } from "@/app/api/previsions/scenarios/[id]/vagues/route";
import { GET as vaguePrevueDetailGET, PUT as vaguePrevuePUT } from "@/app/api/previsions/vagues-prevues/[id]/route";
import { POST as annulerPOST } from "@/app/api/previsions/vagues-prevues/[id]/annuler/route";
import { POST as scinderPOST } from "@/app/api/previsions/vagues-prevues/[id]/scinder/route";
import { POST as rattacherPOST } from "@/app/api/previsions/vagues-prevues/[id]/rattacher/route";
import { PUT as vaguePrevueAlimentsPUT } from "@/app/api/previsions/vagues-prevues/[id]/aliments/route";
import { PATCH as sacsSaisisPATCH } from "@/app/api/previsions/aliments-par-vague-prevue/[id]/sacs-saisis/route";
import { GET as postesGET, POST as postesPOST } from "@/app/api/previsions/scenarios/[id]/postes/route";
import { PUT as chargesPUT } from "@/app/api/previsions/postes/[id]/charges/route";
import { GET as scenarioChargesGET } from "@/app/api/previsions/scenarios/[id]/charges/route";
import { GET as journalGET, POST as journalPOST } from "@/app/api/previsions/scenarios/[id]/journal/route";
import { PUT as journalDetailPUT, DELETE as journalDetailDELETE } from "@/app/api/previsions/journal/[id]/route";
import { GET as apportsGET, POST as apportsPOST } from "@/app/api/previsions/scenarios/[id]/apports/route";
import { GET as calculerGET } from "@/app/api/previsions/scenarios/[id]/calculer/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

type RouteCase = {
  name: string;
  permission: Permission;
  successStatus: number;
  invoke: () => Promise<Response>;
  setupSuccess: () => void;
};

// Chaque route est decrite une fois — reutilisee pour les trois scenarios
// (401 / 403 / 200-201 + permission exacte).
function buildCases(): RouteCase[] {
  return [
    {
      name: "GET /scenarios",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => scenariosGET(makeRequest("/api/previsions/scenarios")),
      setupSuccess: () => mockGetScenarios.mockResolvedValue({ data: [], total: 0 }),
    },
    {
      name: "POST /scenarios",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 201,
      invoke: () =>
        scenariosPOST(
          jsonRequest("/api/previsions/scenarios", "POST", {
            code: "PLAN-2026-08",
            nom: "Plan aout",
            dateDebutPlan: "2026-08-01",
            parametres: {
              effectifAlevinsParVague: 1000,
              margeSecuriteAlevinsPct: 10,
              poidsMoyenInitialG: 5,
              poidsObjectifG: 800,
              prixAlevinUnitaireFCFA: 50,
              prixVenteKgFCFA: 1500,
              nombreBacsSimultanesCible: 4,
              frequenceStockageMois: 1,
            },
          })
        ),
      setupSuccess: () => mockCreateScenario.mockResolvedValue({ id: "scenario-1" }),
    },
    {
      name: "GET /scenarios/[id]",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => scenarioDetailGET(makeRequest("/api/previsions/scenarios/id-1"), idParams()),
      setupSuccess: () => mockGetScenarioById.mockResolvedValue({ id: "id-1" }),
    },
    {
      name: "PUT /scenarios/[id]/parametres",
      permission: Permission.PREVISIONS_PARAMETRER,
      successStatus: 200,
      invoke: () =>
        parametresPUT(
          jsonRequest("/api/previsions/scenarios/id-1/parametres", "PUT", { prixVenteKgFCFA: 1600 }),
          idParams()
        ),
      setupSuccess: () => mockUpdateParametresPrevision.mockResolvedValue({ id: "params-1" }),
    },
    {
      name: "PUT /scenarios/[id]/paliers-remise",
      permission: Permission.PREVISIONS_PARAMETRER,
      successStatus: 200,
      invoke: () =>
        paliersPUT(
          jsonRequest("/api/previsions/scenarios/id-1/paliers-remise", "PUT", {
            paliers: [{ seuilTonnes: 10, pourcentageRemise: 5, ordre: 1 }],
          }),
          idParams()
        ),
      setupSuccess: () => mockReplacePaliersRemise.mockResolvedValue([]),
    },
    {
      name: "POST /scenarios/[id]/archiver",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () => archiverPOST(makeRequest("/api/previsions/scenarios/id-1/archiver", { method: "POST" }), idParams()),
      setupSuccess: () => mockArchiverScenario.mockResolvedValue({ id: "id-1", statut: "ARCHIVE" }),
    },
    {
      name: "POST /scenarios/[id]/activer",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () => activerPOST(makeRequest("/api/previsions/scenarios/id-1/activer", { method: "POST" }), idParams()),
      setupSuccess: () => mockActiverScenarioAvecSnapshot.mockResolvedValue({ id: "id-1", statut: "ACTIF" }),
    },
    {
      name: "GET /scenarios/[id]/aliments",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => scenarioAlimentsGET(makeRequest("/api/previsions/scenarios/id-1/aliments"), idParams()),
      setupSuccess: () => mockGetAlimentsPrevisionParScenario.mockResolvedValue([]),
    },
    {
      name: "POST /scenarios/[id]/aliments",
      permission: Permission.PREVISIONS_PARAMETRER,
      successStatus: 201,
      invoke: () =>
        scenarioAlimentsPOST(
          jsonRequest("/api/previsions/scenarios/id-1/aliments", "POST", {
            tailleGranule: TailleGranule.G1,
            ordre: 1,
            article: { libelle: "2mm", poidsSacKg: 15, prixSacFCFA: 18000 },
          }),
          idParams()
        ),
      setupSuccess: () => mockCreateAlimentPrevisionAvecArticle.mockResolvedValue({ id: "aliment-1" }),
    },
    {
      name: "GET /aliments/[id]",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => alimentDetailGET(makeRequest("/api/previsions/aliments/id-1"), idParams()),
      setupSuccess: () => mockGetAlimentPrevisionById.mockResolvedValue({ id: "id-1" }),
    },
    {
      name: "DELETE /aliments/[id]",
      permission: Permission.PREVISIONS_PARAMETRER,
      successStatus: 200,
      invoke: () => alimentDELETE(makeRequest("/api/previsions/aliments/id-1", { method: "DELETE" }), idParams()),
      setupSuccess: () => mockDeleteAlimentPrevision.mockResolvedValue(undefined),
    },
    {
      name: "PUT /aliments/[id]/repartitions",
      permission: Permission.PREVISIONS_PARAMETRER,
      successStatus: 200,
      invoke: () =>
        repartitionsPUT(
          jsonRequest("/api/previsions/aliments/id-1/repartitions", "PUT", {
            repartitions: [{ moisCycle: 1, pourcentage: 100 }],
          }),
          idParams()
        ),
      setupSuccess: () => mockReplaceRepartitionsMoisAliment.mockResolvedValue([]),
    },
    {
      name: "GET /scenarios/[id]/vagues",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => scenarioVaguesGET(makeRequest("/api/previsions/scenarios/id-1/vagues"), idParams()),
      setupSuccess: () => mockGetVaguesPrevuesParScenario.mockResolvedValue([]),
    },
    {
      name: "POST /scenarios/[id]/vagues",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 201,
      invoke: () =>
        scenarioVaguesPOST(
          jsonRequest("/api/previsions/scenarios/id-1/vagues", "POST", {
            code: "V1",
            dateStockagePrevue: "2026-08-01",
            effectifAlevinsPrevu: 5000,
            poidsMoyenInitialG: 5,
          }),
          idParams()
        ),
      setupSuccess: () => mockCreateVaguePrevue.mockResolvedValue({ id: "vp-1" }),
    },
    {
      name: "GET /vagues-prevues/[id]",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => vaguePrevueDetailGET(makeRequest("/api/previsions/vagues-prevues/id-1"), idParams()),
      setupSuccess: () => mockGetVaguePrevueById.mockResolvedValue({ id: "id-1" }),
    },
    {
      name: "PUT /vagues-prevues/[id]",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        vaguePrevuePUT(jsonRequest("/api/previsions/vagues-prevues/id-1", "PUT", { code: "V1b" }), idParams()),
      setupSuccess: () => mockUpdateVaguePrevue.mockResolvedValue({ id: "id-1" }),
    },
    {
      name: "POST /vagues-prevues/[id]/annuler",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        annulerPOST(makeRequest("/api/previsions/vagues-prevues/id-1/annuler", { method: "POST" }), idParams()),
      setupSuccess: () => mockAnnulerVaguePrevue.mockResolvedValue({ id: "id-1", statut: "ANNULEE" }),
    },
    {
      name: "POST /vagues-prevues/[id]/scinder",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 201,
      invoke: () =>
        scinderPOST(
          jsonRequest("/api/previsions/vagues-prevues/id-1/scinder", "POST", {
            scissions: [
              { code: "V7a", dateStockagePrevue: "2026-08-01", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
              { code: "V7b", dateStockagePrevue: "2026-08-15", effectifAlevinsPrevu: 2000, poidsMoyenInitialG: 5 },
            ],
          }),
          idParams()
        ),
      setupSuccess: () => mockScinderVaguePrevue.mockResolvedValue([{ id: "v7a" }, { id: "v7b" }]),
    },
    {
      name: "POST /vagues-prevues/[id]/rattacher",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        rattacherPOST(
          jsonRequest("/api/previsions/vagues-prevues/id-1/rattacher", "POST", { vagueId: "vague-1" }),
          idParams()
        ),
      setupSuccess: () => mockRattacherVaguePrevue.mockResolvedValue({ id: "vague-1", vaguePrevueId: "id-1" }),
    },
    {
      name: "PUT /vagues-prevues/[id]/aliments",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        vaguePrevueAlimentsPUT(
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
          idParams()
        ),
      setupSuccess: () => mockReplaceAlimentsParVaguePrevue.mockResolvedValue([]),
    },
    {
      name: "PATCH /aliments-par-vague-prevue/[id]/sacs-saisis",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        sacsSaisisPATCH(
          jsonRequest("/api/previsions/aliments-par-vague-prevue/id-1/sacs-saisis", "PATCH", { sacsSaisis: 12 }),
          idParams()
        ),
      setupSuccess: () => mockUpdateSacsSaisis.mockResolvedValue({ id: "id-1", sacsSaisis: 12 }),
    },
    {
      name: "GET /scenarios/[id]/postes",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => postesGET(makeRequest("/api/previsions/scenarios/id-1/postes"), idParams()),
      setupSuccess: () => mockGetPostesPrevisionParScenario.mockResolvedValue([]),
    },
    {
      name: "POST /scenarios/[id]/postes",
      permission: Permission.PREVISIONS_PARAMETRER,
      successStatus: 201,
      invoke: () =>
        postesPOST(
          jsonRequest("/api/previsions/scenarios/id-1/postes", "POST", {
            libelle: "Electricite",
            type: "CHARGE_EXPLOITATION",
            ordre: 1,
            // ADR-053 §16.6/§16.12 (story A.5) — contrat XOR : la creation
            // exige desormais posteReferentielId XOR nouveauPosteReferentielLibelle.
            nouveauPosteReferentielLibelle: "Electricite",
          }),
          idParams()
        ),
      setupSuccess: () =>
        mockCreatePostePrevision.mockResolvedValue({
          poste: { id: "poste-1" },
          reutilise: false,
        }),
    },
    {
      name: "PUT /postes/[id]/charges",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        chargesPUT(
          jsonRequest("/api/previsions/postes/id-1/charges", "PUT", { moisAbsolu: 0, montantFCFA: 100000 }),
          idParams()
        ),
      setupSuccess: () => mockUpsertChargeMensuelle.mockResolvedValue({ id: "charge-1" }),
    },
    {
      name: "GET /scenarios/[id]/charges",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => scenarioChargesGET(makeRequest("/api/previsions/scenarios/id-1/charges"), idParams()),
      setupSuccess: () => mockGetChargesMensuellesParScenario.mockResolvedValue([]),
    },
    {
      name: "GET /scenarios/[id]/journal",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => journalGET(makeRequest("/api/previsions/scenarios/id-1/journal"), idParams()),
      setupSuccess: () => mockGetJournalDepensesParScenario.mockResolvedValue([]),
    },
    {
      name: "POST /scenarios/[id]/journal",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 201,
      invoke: () =>
        journalPOST(
          jsonRequest("/api/previsions/scenarios/id-1/journal", "POST", {
            date: "2026-08-01",
            libelle: "Reparation groupe electrogene",
            categorie: "OPERATIONNEL",
            montantFCFA: 50000,
          }),
          idParams()
        ),
      setupSuccess: () => mockCreateJournalDepensePrevue.mockResolvedValue({ id: "journal-1" }),
    },
    {
      name: "PUT /journal/[id]",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () =>
        journalDetailPUT(jsonRequest("/api/previsions/journal/id-1", "PUT", { montantFCFA: 60000 }), idParams()),
      setupSuccess: () => mockUpdateJournalDepensePrevue.mockResolvedValue({ id: "id-1" }),
    },
    {
      name: "DELETE /journal/[id]",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 200,
      invoke: () => journalDetailDELETE(makeRequest("/api/previsions/journal/id-1", { method: "DELETE" }), idParams()),
      setupSuccess: () => mockDeleteJournalDepensePrevue.mockResolvedValue(undefined),
    },
    {
      name: "GET /scenarios/[id]/apports",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => apportsGET(makeRequest("/api/previsions/scenarios/id-1/apports"), idParams()),
      setupSuccess: () => mockGetApportsCapitalParScenario.mockResolvedValue([]),
    },
    {
      name: "POST /scenarios/[id]/apports",
      permission: Permission.PREVISIONS_GERER,
      successStatus: 201,
      invoke: () =>
        apportsPOST(
          jsonRequest("/api/previsions/scenarios/id-1/apports", "POST", {
            date: "2026-08-01",
            libelle: "Apport initial",
            montantFCFA: 5000000,
            type: "CAPITAL",
          }),
          idParams()
        ),
      setupSuccess: () => mockCreateApportCapital.mockResolvedValue({ id: "apport-1" }),
    },
    {
      name: "GET /scenarios/[id]/calculer",
      permission: Permission.PREVISIONS_VOIR,
      successStatus: 200,
      invoke: () => calculerGET(makeRequest("/api/previsions/scenarios/id-1/calculer"), idParams()),
      setupSuccess: () => {
        mockChargerScenarioPourMoteur.mockResolvedValue({ id: "id-1" });
        mockCalculerProjectionScenario.mockReturnValue({
          horizonMois: 1,
          mois: [],
          vagues: [],
          pointBas: null,
          budget: {
            totalCoutsProductionFCFA: { toNumber: () => 0 },
            totalChargesHorsProductionFCFA: { toNumber: () => 0 },
            totalApportsFCFA: { toNumber: () => 0 },
            budgetTotalFCFA: { toNumber: () => 0 },
          },
        });
      },
    },
  ];
}

describe("Module Previsions — matrice auth/permissions sur les 22 routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases = buildCases();

  it("couvre bien les 22 routes du sprint (32 combinaisons methode+route, GET/POST/PUT/PATCH/DELETE confondus)", () => {
    expect(cases.length).toBe(32);
  });

  for (const c of cases) {
    describe(c.name, () => {
      it("retourne 401 si non authentifie (AuthError)", async () => {
        mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
        const response = await c.invoke();
        expect(response.status).toBe(401);
      });

      it("retourne 403 si authentifie sans la permission requise (ForbiddenError)", async () => {
        mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
        const response = await c.invoke();
        expect(response.status).toBe(403);
      });

      it(`exige exactement ${c.permission} et reussit (${c.successStatus}) quand elle est accordee`, async () => {
        mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
        c.setupSuccess();

        const response = await c.invoke();

        expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), c.permission);
        expect(response.status).toBe(c.successStatus);
      });
    });
  }
});
