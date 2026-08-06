// @vitest-environment jsdom
/**
 * Tests — PrevisionsScenarioDetailPage (Server Component), reserve R4
 * (PR2non.4). Comble le trou de couverture identifie par falsification
 * (ERR-189) : les DEUX `catch` muets (rapprochement, tresorerie) de
 * `previsions-scenario-detail-page.tsx` n'etaient exerces par AUCUN test
 * avant ce fichier — les tests de `rapprochement-tab.tsx`/`tresorerie-tab.tsx`
 * prouvent seulement le RENDU une fois `erreurRapprochement`/`erreurTresorerie`
 * deja construits ; ils ne prouvent rien sur le fait que la page les
 * construise reellement (message, propagation) ni qu'elle trace l'echec
 * cote serveur (`console.error`).
 *
 * Approche : la page est une fonction Server Component asynchrone, sans
 * runtime Next reel dans Vitest — on l'invoque directement
 * (`await PrevisionsScenarioDetailPage({ params })`) et on rend l'arbre
 * React obtenu. `ScenarioDetailClient` est mocke pour capturer les props
 * recues (dont `erreurRapprochement`/`erreurTresorerie`) sans avoir a
 * simuler tout le shell d'onglets. Tous les modules Prisma/queries sont
 * mockes — aucune base de donnees dans la boucle (ADR-053 §15.6 point 1,
 * meme discipline que le moteur, appliquee ici au niveau page).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — next/navigation, next-intl/server
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() ne doit pas etre appele dans ces tests (session/site actifs).");
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound() ne doit pas etre appele dans ces tests (scenario toujours trouve).");
  }),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Mocks — auth
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    activeSiteId: "site-1",
    role: "GERANT",
  }),
  checkPagePermission: vi.fn().mockResolvedValue([Permission.PREVISIONS_VOIR]),
}));

// ---------------------------------------------------------------------------
// Mocks — queries (donnees vides, hors perimetre de cette story)
// ---------------------------------------------------------------------------
const { SCENARIO, PROJECTION_MINIMALE } = vi.hoisted(() => ({
  SCENARIO: {
    id: "scenario-1",
    code: "SC-1",
    nom: "Scenario Test",
    description: null,
    dureeCycleMois: 6,
    dateDebutPlan: new Date("2026-01-01T00:00:00.000Z"),
    statut: "BROUILLON",
    userId: "user-1",
    siteId: "site-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    parametres: null,
    paliersRemise: [],
    _count: { aliments: 0 },
  },
  PROJECTION_MINIMALE: {
    horizonMois: 0,
    mois: [],
    vagues: [],
    pointBas: null,
    budget: {
      totalCoutsProductionFCFA: { toNumber: () => 0 },
      totalChargesHorsProductionFCFA: { toNumber: () => 0 },
      totalApportsFCFA: { toNumber: () => 0 },
      budgetTotalFCFA: { toNumber: () => 0 },
    },
  },
}));

vi.mock("@/lib/queries/previsions-scenarios", () => ({
  getScenarioById: vi.fn().mockResolvedValue(SCENARIO),
}));
vi.mock("@/lib/queries/previsions-aliments", () => ({
  getAlimentsPrevisionParScenario: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/queries/previsions-vagues", () => ({
  getVaguesPrevuesParScenario: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/queries/previsions-charges", () => ({
  getPostesPrevisionParScenario: vi.fn().mockResolvedValue([]),
  getChargesMensuellesParScenario: vi.fn().mockResolvedValue([]),
  getJournalDepensesParScenario: vi.fn().mockResolvedValue([]),
  getApportsCapitalParScenario: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    vague: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// ---------------------------------------------------------------------------
// Mocks — moteur / orchestration (calculerProjectionScenario mocke pour ne
// PAS dependre de la forme reelle de `ScenarioPourCalcul` — seul le succes
// du calcul de projection nous interesse ici, jamais recompose ni relu par
// ce fichier, cf. ADR-053 §15.6 point 2).
// ---------------------------------------------------------------------------
vi.mock("@/lib/queries/previsions-scenario-loader", () => ({
  chargerScenarioPourMoteur: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/previsions/route-orchestration", () => ({
  calculerProjectionScenario: vi.fn().mockReturnValue(PROJECTION_MINIMALE),
}));

// ---------------------------------------------------------------------------
// Mocks — rapprochement / tresorerie : chacun controle independamment par
// test (succes ou echec), c'est le coeur de cette story (reserve R4).
// ---------------------------------------------------------------------------
vi.mock("@/lib/queries/previsions-vue-rapprochement", () => ({
  chargerRapprochementScenario: vi.fn(),
}));
vi.mock("@/components/previsions/rapprochement-dto", () => ({
  construireRapprochementDTO: vi.fn().mockReturnValue({
    horizonMois: 0,
    dateDebutPlan: "2026-01-01T00:00:00.000Z",
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
    calculeLe: "2026-08-05T10:00:00.000Z",
  }),
}));
vi.mock("@/lib/queries/previsions-tresorerie-trois-series", () => ({
  getTresorerieTroisSeries: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock — ScenarioDetailClient : capture les props recues, jamais rendu
// reellement (le shell d'onglets est hors perimetre de ce fichier, deja
// couvert par `scenario-detail-client-refresh.test.tsx` et les tests des
// onglets Rapprochement/Tresorerie).
// ---------------------------------------------------------------------------
const scenarioDetailClientSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/previsions/scenario-detail-client", () => ({
  ScenarioDetailClient: (props: unknown) => {
    scenarioDetailClientSpy(props);
    return <div data-testid="scenario-detail-client-mock" />;
  },
}));

// Importe APRES les vi.mock (hoistes de toute facon par Vitest).
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { chargerRapprochementScenario } from "@/lib/queries/previsions-vue-rapprochement";
import { getTresorerieTroisSeries } from "@/lib/queries/previsions-tresorerie-trois-series";
import PrevisionsScenarioDetailPage from "@/components/pages/previsions-scenario-detail-page";

async function renderPage() {
  const element = await PrevisionsScenarioDetailPage({
    params: Promise.resolve({ id: "scenario-1" }),
  });
  render(element);
}

function lastProps(): Record<string, unknown> {
  const calls = scenarioDetailClientSpy.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe("PrevisionsScenarioDetailPage — reserve R4 (PR2non.4)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({
      userId: "user-1",
      activeSiteId: "site-1",
      role: "GERANT",
    } as never);
    vi.mocked(checkPagePermission).mockResolvedValue([Permission.PREVISIONS_VOIR]);
    scenarioDetailClientSpy.mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.mocked(chargerScenarioPourMoteur).mockReset();
    vi.mocked(chargerScenarioPourMoteur).mockResolvedValue({} as never);
    vi.mocked(chargerRapprochementScenario).mockReset();
    vi.mocked(getTresorerieTroisSeries).mockReset();
  });

  it("succes des deux calculs : erreurRapprochement/erreurTresorerie sont null, aucune trace console.error", async () => {
    vi.mocked(chargerRapprochementScenario).mockResolvedValue({
      horizonMois: 0,
      moisDisponibles: [],
      lignesParMois: new Map(),
      totalMoisMonetaireParMois: new Map(),
      totalMoisQuantiteParMois: new Map(),
      nonRapprocheParMois: new Map(),
      cumuleGlobalMonetaireParMois: new Map(),
      cumuleGlobalQuantiteParMois: new Map(),
      cumuleParPosteParMois: new Map(),
      topEcartsMonetaireParMois: new Map(),
      topEcartsQuantiteParMois: new Map(),
      vagues: [],
    } as never);
    vi.mocked(getTresorerieTroisSeries).mockResolvedValue({
      scenarioId: "scenario-1",
      horizonMois: 0,
      budgetInitialDisponible: false,
      series: [],
      reprevisionGlissante: [],
      caveatSerieReelleIncomplete: true,
      calculeLe: new Date("2026-08-05T10:00:00.000Z"),
    } as never);

    await renderPage();

    const props = lastProps();
    expect(props.erreurRapprochement).toBeNull();
    expect(props.erreurTresorerie).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("echec du calcul de rapprochement : erreurRapprochement porte le message reel, erreurTresorerie reste null (echecs independants), et l'echec est trace cote serveur avec le tag ET l'identification du scenario", async () => {
    vi.mocked(chargerRapprochementScenario).mockRejectedValue(
      new Error("Erreur simulee : mapping de rapprochement introuvable pour ce site.")
    );
    vi.mocked(getTresorerieTroisSeries).mockResolvedValue({
      scenarioId: "scenario-1",
      horizonMois: 0,
      budgetInitialDisponible: false,
      series: [],
      reprevisionGlissante: [],
      caveatSerieReelleIncomplete: true,
      calculeLe: new Date("2026-08-05T10:00:00.000Z"),
    } as never);

    await renderPage();

    const props = lastProps();
    expect(props.erreurRapprochement).toBe(
      "Erreur simulee : mapping de rapprochement introuvable pour ce site."
    );
    expect(props.erreurTresorerie).toBeNull();

    // Trace cote serveur (console.error) — tag ET identification du scenario,
    // jamais un log muet ni un log generique sans moyen de retrouver le
    // scenario en cause (reserve R4).
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [tag, context, error] = consoleErrorSpy.mock.calls[0];
    expect(tag).toBe("[PrevisionsScenarioDetailPage] rapprochement");
    expect(context).toMatchObject({ scenarioId: "scenario-1", siteId: "site-1" });
    expect((error as Error).message).toBe(
      "Erreur simulee : mapping de rapprochement introuvable pour ce site."
    );
  });

  it("echec du calcul de tresorerie : erreurTresorerie porte le message reel, erreurRapprochement reste null (echecs independants), et l'echec est trace cote serveur avec le tag ET l'identification du scenario", async () => {
    vi.mocked(chargerRapprochementScenario).mockResolvedValue({
      horizonMois: 0,
      moisDisponibles: [],
      lignesParMois: new Map(),
      totalMoisMonetaireParMois: new Map(),
      totalMoisQuantiteParMois: new Map(),
      nonRapprocheParMois: new Map(),
      cumuleGlobalMonetaireParMois: new Map(),
      cumuleGlobalQuantiteParMois: new Map(),
      cumuleParPosteParMois: new Map(),
      topEcartsMonetaireParMois: new Map(),
      topEcartsQuantiteParMois: new Map(),
      vagues: [],
    } as never);
    vi.mocked(getTresorerieTroisSeries).mockRejectedValue(
      new Error("Erreur simulee : snapshot budget initial indisponible.")
    );

    await renderPage();

    const props = lastProps();
    expect(props.erreurTresorerie).toBe("Erreur simulee : snapshot budget initial indisponible.");
    expect(props.erreurRapprochement).toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [tag, context, error] = consoleErrorSpy.mock.calls[0];
    expect(tag).toBe("[PrevisionsScenarioDetailPage] tresorerie");
    expect(context).toMatchObject({ scenarioId: "scenario-1", siteId: "site-1" });
    expect((error as Error).message).toBe("Erreur simulee : snapshot budget initial indisponible.");
  });

  it("echec des DEUX calculs simultanement : les deux erreurs sont propagees independamment, deux traces console.error distinctes (une par tag)", async () => {
    vi.mocked(chargerRapprochementScenario).mockRejectedValue(
      new Error("Erreur simulee rapprochement.")
    );
    vi.mocked(getTresorerieTroisSeries).mockRejectedValue(new Error("Erreur simulee tresorerie."));

    await renderPage();

    const props = lastProps();
    expect(props.erreurRapprochement).toBe("Erreur simulee rapprochement.");
    expect(props.erreurTresorerie).toBe("Erreur simulee tresorerie.");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    const tags = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(tags).toContain("[PrevisionsScenarioDetailPage] rapprochement");
    expect(tags).toContain("[PrevisionsScenarioDetailPage] tresorerie");
  });

  it("echec de la projection elle-meme (chargerScenarioPourMoteur leve) : le try du rapprochement n'a JAMAIS pu s'executer (catch externe, constat M1 review PR2non.4) — erreurProjection est renseigne ET erreurRapprochement n'est PAS null (jamais RAPPROCHEMENT_VIDE + erreurRapprochement:null, l'etat 'absence legitime' trompeur que la reserve R4 visait a eliminer), erreurTresorerie reste independant", async () => {
    vi.mocked(chargerScenarioPourMoteur).mockRejectedValue(
      new Error("Erreur simulee : granulometrie sans sacsParTonneStandard configure.")
    );
    vi.mocked(getTresorerieTroisSeries).mockResolvedValue({
      scenarioId: "scenario-1",
      horizonMois: 0,
      budgetInitialDisponible: false,
      series: [],
      reprevisionGlissante: [],
      caveatSerieReelleIncomplete: true,
      calculeLe: new Date("2026-08-05T10:00:00.000Z"),
    } as never);

    await renderPage();

    const props = lastProps();

    // Coeur du non-regression : la projection a echoue...
    expect(props.erreurProjection).toBe(
      "Erreur simulee : granulometrie sans sacsParTonneStandard configure."
    );
    // ...donc le rapprochement n'a jamais pu tourner : erreurRapprochement ne
    // doit JAMAIS retomber a null (ce qui ferait afficher a l'onglet
    // Rapprochement "Aucun rapprochement disponible pour ce scenario", un
    // message d'absence legitime alors que la cause reelle est cet echec).
    expect(props.erreurRapprochement).not.toBeNull();
    expect(props.erreurRapprochement).toBe(
      "Erreur simulee : granulometrie sans sacsParTonneStandard configure."
    );

    // Le rapprochement n'ayant jamais tourne, `chargerRapprochementScenario`
    // n'a pas ete appele — pas de trace console.error taguee "rapprochement".
    expect(chargerRapprochementScenario).not.toHaveBeenCalled();

    // La tresorerie reste un bloc totalement independant (try separe,
    // ~ligne 297 de la page) : son succes n'est pas affecte par l'echec de
    // la projection.
    expect(props.erreurTresorerie).toBeNull();
  });
});
