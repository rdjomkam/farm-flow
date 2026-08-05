// @vitest-environment jsdom
/**
 * Tests — ChargesTab (Sprint PR2, story PR2.3, finding de review #1)
 *
 * Le "Total du mois" (`totalMois`) est un chiffre calcule — l'exigence
 * non negociable §7.4 (ADR-053) exige qu'il soit explicable comme tout
 * autre chiffre calcule de l'ecran, pas affiche en texte brut. Ce test
 * verifie que le total est bien enveloppe dans `ValeurCalculee` (formule
 * en langage courant + detail par poste), et pas seulement present a
 * l'ecran (un total en texte brut aurait aussi passe un test naif sur le
 * texte affiche — cf. constat du rapport de review).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChargesTab } from "@/components/previsions/charges-tab";
import { Permission, TypePostePrevision } from "@/types";
import type { PostePrevisionDTO, ChargeMensuellePrevueDTO } from "@/components/previsions/api-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
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

vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const postes: PostePrevisionDTO[] = [
  {
    id: "poste-1",
    scenarioId: "scenario-1",
    libelle: "Electricite",
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: true,
    ordre: 0,
    siteId: "site-1",
    posteReferentielId: "ref-1",
    posteReferentiel: { libelle: "Electricite", actif: true },
  },
  {
    id: "poste-2",
    scenarioId: "scenario-1",
    libelle: "Transport",
    type: TypePostePrevision.LOGISTIQUE,
    inclusBaseRepartition: true,
    ordre: 1,
    siteId: "site-1",
    posteReferentielId: "ref-2",
    posteReferentiel: { libelle: "Transport", actif: true },
  },
];

const charges: ChargeMensuellePrevueDTO[] = [
  { id: "c1", scenarioId: "scenario-1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: 50000, siteId: "site-1" },
  { id: "c2", scenarioId: "scenario-1", posteId: "poste-2", moisAbsolu: 0, montantFCFA: 30000, siteId: "site-1" },
];

describe("ChargesTab — explicabilite du total du mois (§7.4, finding de review #1)", () => {
  it("le total du mois n'est jamais un texte brut : il expose un bouton d'explication accessible", () => {
    render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={postes}
        initialCharges={charges}
        permissions={[Permission.PREVISIONS_VOIR]}
        horizonMois={21}
        erreurProjection={null}
      />
    );

    expect(screen.getByRole("button", { name: "Expliquer le total du mois" })).toBeInTheDocument();
  });

  it("le popover d'explication affiche une formule en langage courant et le detail par poste", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={postes}
        initialCharges={charges}
        permissions={[Permission.PREVISIONS_VOIR]}
        horizonMois={21}
        erreurProjection={null}
      />
    );

    await user.click(screen.getByRole("button", { name: "Expliquer le total du mois" }));

    expect(await screen.findByText(/somme des montants de charge de chaque poste/i)).toBeInTheDocument();
    expect(screen.getAllByText("Electricite").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Transport").length).toBeGreaterThan(0);
  });
});

describe("ChargesTab — visibilité du rattachement au référentiel (ADR-053 §16.12, story A.5)", () => {
  const postesRattachement: PostePrevisionDTO[] = [
    {
      id: "poste-coincident",
      scenarioId: "scenario-1",
      libelle: "Electricite",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      inclusBaseRepartition: true,
      ordre: 0,
      siteId: "site-1",
      posteReferentielId: "ref-1",
      posteReferentiel: { libelle: "Electricite", actif: true },
    },
    {
      id: "poste-divergent",
      scenarioId: "scenario-1",
      libelle: "Transport equipe production",
      type: TypePostePrevision.LOGISTIQUE,
      inclusBaseRepartition: true,
      ordre: 1,
      siteId: "site-1",
      posteReferentielId: "ref-2",
      posteReferentiel: { libelle: "Transport", actif: true },
    },
    {
      id: "poste-inactif-divergent",
      scenarioId: "scenario-1",
      libelle: "Salaires terrain",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      inclusBaseRepartition: true,
      ordre: 2,
      siteId: "site-1",
      posteReferentielId: "ref-3",
      posteReferentiel: { libelle: "Salaires equipe", actif: false },
    },
    {
      id: "poste-inactif-coincident",
      scenarioId: "scenario-1",
      libelle: "Carburant",
      type: TypePostePrevision.LOGISTIQUE,
      inclusBaseRepartition: true,
      ordre: 3,
      siteId: "site-1",
      posteReferentielId: "ref-4",
      posteReferentiel: { libelle: "Carburant", actif: false },
    },
  ];

  const chargesRattachement: ChargeMensuellePrevueDTO[] = postesRattachement.map((p, i) => ({
    id: `c-${i}`,
    scenarioId: "scenario-1",
    posteId: p.id,
    moisAbsolu: 0,
    montantFCFA: 1000,
    siteId: "site-1",
  }));

  function renderChargesTab() {
    return render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={postesRattachement}
        initialCharges={chargesRattachement}
        permissions={[Permission.PREVISIONS_VOIR]}
        horizonMois={21}
        erreurProjection={null}
      />
    );
  }

  it("aucun signal n'est affiché quand le libellé coïncide et l'entrée référentiel est active (cas majoritaire)", () => {
    renderChargesTab();
    // "Electricite" ne doit porter aucune mention "Référentiel :" à côté de lui.
    const carte = screen.getByLabelText("Electricite").closest(".rounded-xl")!;
    expect(within(carte).queryByText(/Référentiel/)).not.toBeInTheDocument();
  });

  it("affiche « Référentiel : {libellé} » quand le libellé scénario diverge (entrée active)", () => {
    renderChargesTab();
    const carte = screen.getByLabelText("Transport equipe production").closest(".rounded-xl")!;
    const ligneRattachement = within(carte).getByText(/Référentiel :/);
    expect(ligneRattachement).toBeInTheDocument();
    expect(ligneRattachement.textContent).toContain("Transport");
    expect(within(carte).queryByText(/désactivé/)).not.toBeInTheDocument();
  });

  it("affiche « Référentiel : {libellé} · désactivé » quand l'entrée est désactivée ET divergente", () => {
    renderChargesTab();
    const carte = screen.getByLabelText("Salaires terrain").closest(".rounded-xl")!;
    expect(within(carte).getByText(/Référentiel :/)).toBeInTheDocument();
    expect(within(carte).getByText(/désactivé/)).toBeInTheDocument();
  });

  it("affiche le signal 'désactivé' même quand le libellé COÏNCIDE (règle non négociable §16.12 : la désactivation est toujours visible)", () => {
    renderChargesTab();
    const carte = screen.getByLabelText("Carburant").closest(".rounded-xl")!;
    expect(within(carte).getByText(/Référentiel :/)).toBeInTheDocument();
    expect(within(carte).getByText(/désactivé/)).toBeInTheDocument();
  });
});
