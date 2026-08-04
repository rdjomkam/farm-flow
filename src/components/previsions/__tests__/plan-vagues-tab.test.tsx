// @vitest-environment jsdom
/**
 * Tests — PlanVaguesTab, action "Modifier" une VaguePrevue.
 *
 * Manque constate a l'ecran (rapport de bug) : la carte de vague planifiee
 * n'exposait que RattacherVagueDialog/Scinder/Annuler, jamais Modifier — donc
 * aucun moyen de corriger l'effectif d'alevins prevu apres generation d'un
 * plan. Ce fichier verifie (1) que l'action est presente et ouvre le
 * dialogue d'edition en PLANIFIEE, (2) la restriction de statut/rattachement
 * retenue : le bouton disparait (et un motif explicite est affiche) des que
 * la vague n'est plus PLANIFIEE ou qu'une vague reelle lui est deja
 * rattachee — jamais un bouton qui echouerait silencieusement au clic.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanVaguesTab } from "@/components/previsions/plan-vagues-tab";
import { Permission, StatutVaguePrevue } from "@/types";
import type { VaguePrevueListItemDTO } from "@/components/previsions/api-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
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

const mockPost = vi.fn();
const mockPut = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: mockPut, get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

function mockFetchJson(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

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

const baseProps = {
  scenarioId: "s1",
  vaguesCandidates: [],
  permissions: [Permission.PREVISIONS_GERER],
  parametres: null,
  dateDebutPlan: "2026-01-01T00:00:00.000Z",
  dureeCycleMois: 6,
};

describe("PlanVaguesTab — action Modifier sur une vague PLANIFIEE", () => {
  it("est proposee et ouvre le dialogue d'edition pre-rempli", () => {
    const vague = makeVague();
    render(<PlanVaguesTab {...baseProps} vaguesPrevues={[vague]} onVaguesPrevuesChange={vi.fn()} />);

    const modifierButton = screen.getByRole("button", { name: /Modifier/i });
    fireEvent.click(modifierButton);

    expect(screen.getByText("Modifier la vague planifiée")).toBeInTheDocument();
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe("V1");
    expect((screen.getByLabelText(/Effectif d'alevins/i) as HTMLInputElement).value).toBe("10000");
  });

  it("appelle PUT et repercute la mise a jour dans la liste au parent", async () => {
    const vague = makeVague();
    mockPut.mockResolvedValueOnce({
      ok: true,
      data: { ...vague, effectifAlevinsPrevu: 15000 },
    });
    const onVaguesPrevuesChange = vi.fn();
    render(
      <PlanVaguesTab {...baseProps} vaguesPrevues={[vague]} onVaguesPrevuesChange={onVaguesPrevuesChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Modifier/i }));
    const effectifInput = screen.getByLabelText(/Effectif d'alevins/i) as HTMLInputElement;
    fireEvent.change(effectifInput, { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(
      "/api/previsions/vagues-prevues/vp1",
      expect.objectContaining({ effectifAlevinsPrevu: 15000 })
    ));
    await waitFor(() => expect(onVaguesPrevuesChange).toHaveBeenCalled());
  });
});

/**
 * Story PR2oct.4 — badge de lecture seule sur chaque carte de vague planifiee
 * (`alevinsAchetes`, ADR-053 §14 / ERR-170). Bonus signale par la
 * pre-analyse §4 : pas d'action associee, juste un `Badge` informatif.
 */
describe("PlanVaguesTab — badge alevinsAchetes (lecture seule)", () => {
  it("affiche « Alevins achetés » quand la vague a le drapeau a true", () => {
    const vague = makeVague({ alevinsAchetes: true });
    render(<PlanVaguesTab {...baseProps} vaguesPrevues={[vague]} onVaguesPrevuesChange={vi.fn()} />);

    expect(screen.getByText("Alevins achetés")).toBeInTheDocument();
    expect(screen.queryByText("Production interne")).not.toBeInTheDocument();
  });

  it("affiche « Production interne » quand la vague a le drapeau a false", () => {
    const vague = makeVague({ alevinsAchetes: false });
    render(<PlanVaguesTab {...baseProps} vaguesPrevues={[vague]} onVaguesPrevuesChange={vi.fn()} />);

    expect(screen.getByText("Production interne")).toBeInTheDocument();
    expect(screen.queryByText("Alevins achetés")).not.toBeInTheDocument();
  });

  it("affiche un badge par vague, coherent avec le drapeau propre a chacune", () => {
    const achetee = makeVague({ id: "vp1", code: "V1", alevinsAchetes: true });
    const interne = makeVague({ id: "vp2", code: "V2", alevinsAchetes: false });
    render(
      <PlanVaguesTab {...baseProps} vaguesPrevues={[achetee, interne]} onVaguesPrevuesChange={vi.fn()} />
    );

    expect(screen.getByText("Alevins achetés")).toBeInTheDocument();
    expect(screen.getByText("Production interne")).toBeInTheDocument();
  });
});

describe("PlanVaguesTab — restriction de l'action Modifier", () => {
  it("n'est pas proposee sur une vague ANNULEE : le motif de statut est affiche a la place", () => {
    const vague = makeVague({ statut: StatutVaguePrevue.ANNULEE });
    render(<PlanVaguesTab {...baseProps} vaguesPrevues={[vague]} onVaguesPrevuesChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /^Modifier$/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("Modification indisponible : seules les vagues encore Planifiées peuvent être modifiées.")
    ).toBeInTheDocument();
  });

  it("n'est plus proposee une fois la vague rattachee a une vague reelle : le motif dedie est affiche", async () => {
    const user = userEvent.setup({ delay: null });
    const vague = makeVague();
    mockFetchJson(200, { id: "vp1" });
    render(
      <PlanVaguesTab
        {...baseProps}
        vaguesPrevues={[vague]}
        onVaguesPrevuesChange={vi.fn()}
        vaguesCandidates={[{ id: "vr1", code: "VR1", statut: "ACTIF", vaguePrevueId: null }]}
      />
    );

    expect(screen.getByRole("button", { name: /^Modifier$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rattacher une vague réelle" }));
    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: /VR1/ });
    await user.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Modifier$/i })).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Modification indisponible : une vague réelle est déjà rattachée.")
    ).toBeInTheDocument();
  });

  it("n'apparait jamais sans permission PREVISIONS_GERER", () => {
    const vague = makeVague();
    render(
      <PlanVaguesTab {...baseProps} permissions={[]} vaguesPrevues={[vague]} onVaguesPrevuesChange={vi.fn()} />
    );

    expect(screen.queryByRole("button", { name: /Modifier/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Modification indisponible/)).not.toBeInTheDocument();
  });
});
