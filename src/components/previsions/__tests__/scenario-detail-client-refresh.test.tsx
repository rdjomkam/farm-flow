// @vitest-environment jsdom
/**
 * Tests — ScenarioDetailClient, refresh de la projection apres mutation.
 *
 * Bug signale en conditions reelles : l'utilisateur modifie une donnee dans
 * un onglet (ex. l'effectif d'une VaguePrevue dans "Plan des vagues"), puis
 * bascule sur "Tableau de bord" SANS recharger la page — les indicateurs et
 * le graphique de tresorerie restent perimes, parce que `projection` est une
 * prop calculee une seule fois par le Server Component et que rien ne la
 * redemande apres une mutation client.
 *
 * Ce test exerce precisement le geste signale : "je saisis, puis je regarde
 * le resultat". Il ne verifie pas que la valeur numerique affichee change
 * (la projection est mockee de facon figee cote test, un fetch reseau reel
 * est hors de portee d'un test de composant) — il verifie le mecanisme
 * retenu pour la corriger : `router.refresh()` (App Router, refait tourner
 * le Server Component parent et lui fait recalculer `projection` avec les
 * donnees fraiches) est bien appele apres CHAQUE mutation reussie d'un
 * onglet qui alimente le calcul, jamais seulement apres l'edition d'une
 * vague — un correctif partiel reproduirait le meme defaut ailleurs.
 *
 * Composant : src/components/previsions/scenario-detail-client.tsx
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioDetailClient } from "@/components/previsions/scenario-detail-client";
import { Permission, StatutVaguePrevue, StatutScenarioPrevision } from "@/types";
import type { VaguePrevueListItemDTO, ScenarioPrevisionDetailDTO } from "@/components/previsions/api-types";
import type { ProjectionScenarioDTO } from "@/components/previsions/projection-types";
import type { RapprochementScenarioDTO } from "@/components/previsions/rapprochement-types";
import type { TresorerieTroisSeriesDTO } from "@/components/previsions/tresorerie-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";
import frStock from "@/messages/fr/stock.json";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
  stock: frStock,
  "common.buttons": (frCommon as { buttons: Record<string, unknown> }).buttons,
};

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") return (cur as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function interpolate(template: string, values?: Record<string, unknown>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const value = deepGet(DICTIONARIES[namespace], key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

const mockPut = vi.fn();
const mockPost = vi.fn();
const mockDel = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: mockPut, get: vi.fn(), patch: vi.fn(), del: mockDel }),
}));

vi.mock("@/components/previsions/tresorerie-chart", () => ({
  TresorerieChart: () => <div data-testid="tresorerie-chart" />,
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECTION_VIDE: ProjectionScenarioDTO = {
  horizonMois: 0,
  mois: [],
  vagues: [],
  pointBas: null,
  budget: {
    totalCoutsProductionFCFA: 0,
    totalChargesHorsProductionFCFA: 0,
    totalApportsFCFA: 0,
    budgetTotalFCFA: 0,
  },
};

const RAPPROCHEMENT_VIDE: RapprochementScenarioDTO = {
  horizonMois: 0,
  dateDebutPlan: "2026-09-01T00:00:00.000Z",
  moisDisponibles: [],
  lignesParMois: {},
  totalMoisMonetaireParMois: {},
  totalMoisQuantiteParMois: {},
  nonRapprocheParMois: {},
  cumuleGlobalMonetaireParMois: {},
  cumuleGlobalQuantiteParMois: {},
  cumuleParPosteParMois: {},
  topEcartsMonetaireParMois: {},
  topEcartsQuantiteParMois: {},
  vagues: [],
  calculeLe: "2026-09-01T00:00:00.000Z",
};

const TRESORERIE_VIDE: TresorerieTroisSeriesDTO = {
  scenarioId: "s1",
  horizonMois: 0,
  budgetInitialDisponible: false,
  series: [],
  reprevisionGlissante: [],
  caveatSerieReelleIncomplete: true,
  calculeLe: "2026-09-01T00:00:00.000Z",
};

function makeVague(overrides: Partial<VaguePrevueListItemDTO> = {}): VaguePrevueListItemDTO {
  return {
    id: "vp1",
    scenarioId: "s1",
    code: "V1",
    dateStockagePrevue: "2026-09-01T00:00:00.000Z",
    effectifAlevinsPrevu: 10000,
    poidsMoyenInitialG: 5,
    dureeCycleMoisFigee: 6,
    statut: StatutVaguePrevue.PLANIFIEE,
    vaguePrevueParentId: null,
    siteId: "site1",
    alevinsAchetes: false,
    ...overrides,
  };
}

const scenario: ScenarioPrevisionDetailDTO = {
  id: "s1",
  code: "PLAN-2026",
  nom: "Plan 2026",
  description: null,
  dureeCycleMois: 6,
  dateDebutPlan: "2026-01-01T00:00:00.000Z",
  statut: StatutScenarioPrevision.BROUILLON,
  userId: "u1",
  siteId: "site1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  parametres: null,
  paliersRemise: [],
};

const baseProps = {
  scenario,
  initialAliments: [],
  initialPostes: [],
  initialCharges: [],
  initialJournal: [],
  initialApports: [],
  vaguesCandidates: [],
  permissions: [Permission.PREVISIONS_GERER, Permission.PREVISIONS_VOIR, Permission.PREVISIONS_PARAMETRER],
  projection: PROJECTION_VIDE,
  rapprochement: RAPPROCHEMENT_VIDE,
  tresorerie: TRESORERIE_VIDE,
  erreurProjection: null,
};

describe("ScenarioDetailClient — refresh de la projection apres mutation", () => {
  it("appelle router.refresh() apres l'edition d'une VaguePrevue dans l'onglet Plan des vagues", async () => {
    const user = userEvent.setup({ delay: null });
    const vague = makeVague();
    mockPut.mockResolvedValueOnce({ ok: true, data: { ...vague, effectifAlevinsPrevu: 999999 } });

    render(<ScenarioDetailClient {...baseProps} initialVaguesPrevues={[vague]} />);

    // Bascule sur l'onglet "Plan des vagues" — l'onglet actif ne doit pas
    // etre reinitialise par le refresh qui suivra (verifie plus bas).
    await user.click(screen.getByRole("tab", { name: "Plan des vagues" }));

    fireEvent.click(screen.getByRole("button", { name: /Modifier/i }));
    const effectifInput = screen.getByLabelText(/Effectif d'alevins/i) as HTMLInputElement;
    fireEvent.change(effectifInput, { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    // C'est la garantie centrale de ce test : la mutation a bien redemande
    // la projection (via router.refresh(), qui refait tourner le Server
    // Component et recalcule `calculerProjectionScenario`) — pas seulement
    // mis a jour la liste locale des vagues.
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    // L'onglet actif reste "Plan des vagues" apres la mutation (pas de
    // reinitialisation sur l'onglet par defaut).
    expect(screen.getByRole("tab", { name: "Plan des vagues" })).toHaveAttribute("data-state", "active");
  });

  it("appelle router.refresh() apres l'annulation d'une VaguePrevue", async () => {
    const user = userEvent.setup({ delay: null });
    const vague = makeVague();
    mockPost.mockResolvedValueOnce({ ok: true });

    render(<ScenarioDetailClient {...baseProps} initialVaguesPrevues={[vague]} />);
    await user.click(screen.getByRole("tab", { name: "Plan des vagues" }));

    fireEvent.click(screen.getByRole("button", { name: /Annuler/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      "/api/previsions/vagues-prevues/vp1/annuler",
      {}
    ));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("appelle router.refresh() apres l'enregistrement des Parametres", async () => {
    const user = userEvent.setup({ delay: null });
    mockPut.mockResolvedValueOnce({ ok: true, data: {} });

    render(<ScenarioDetailClient {...baseProps} initialVaguesPrevues={[]} />);
    await user.click(screen.getByRole("tab", { name: "Paramètres" }));

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(
      "/api/previsions/scenarios/s1/parametres",
      expect.any(Object)
    ));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("n'appelle PAS router.refresh() si la mutation echoue (result.ok=false)", async () => {
    const user = userEvent.setup({ delay: null });
    mockPut.mockResolvedValueOnce({ ok: false });

    render(<ScenarioDetailClient {...baseProps} initialVaguesPrevues={[]} />);
    await user.click(screen.getByRole("tab", { name: "Paramètres" }));

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));

    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
