// @vitest-environment jsdom
/**
 * src/components/previsions/__tests__/tresorerie-tab.test.tsx
 *
 * Tests — TresorerieTab (Sprint PR3-ter, story B.5, ADR-053 §6.5). Verifie
 * la FRANCHISE non negociable exigee par le sprint : le caveat
 * "serie REEL structurellement incomplete" est TOUJOURS affiche (jamais
 * filtre), et l'absence de budget initial est dite explicitement plutot
 * que masquee par une courbe a zero. Verifie aussi l'interaction de
 * bascule "Reprevision".
 *
 * ERR-157 : jsdom ne prouve aucune garantie de mise en page (couleur
 * reellement rendue, disposition a 375px/1280px) — seule la STRUCTURE du
 * DOM (texte present, `aria-pressed`) est verifiee ici. La verification
 * visuelle reelle est faite separement en navigateur (cf. rapport de
 * livraison de la story).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TresorerieTab } from "@/components/previsions/tresorerie-tab";
import type { TresorerieTroisSeriesDTO } from "@/components/previsions/tresorerie-types";
import frPrevisions from "@/messages/fr/previsions.json";

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
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const value = deepGet(frPrevisions, key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

// Le graphique lui-meme (Recharts) est deja teste isolement dans
// `tresorerie-trois-series-chart.test.tsx` — mocke ici pour que ce fichier
// teste UNIQUEMENT l'orchestration de l'onglet (bandeaux, bascule), jamais
// une reimplementation parallele du rendu du graphique.
vi.mock("@/components/previsions/tresorerie-trois-series-chart", () => ({
  TresorerieTroisSeriesChart: ({ reprevisionActive }: { reprevisionActive: boolean }) => (
    <div data-testid="tresorerie-chart-mock" data-reprevision-active={String(reprevisionActive)} />
  ),
}));

const SERIES: TresorerieTroisSeriesDTO["series"] = [
  { moisAbsolu: 0, budgetInitialFCFA: 1_000_000, previsionActualiseeFCFA: 1_200_000, reelFCFA: 900_000, caveatApportsReelsNonModelises: true },
  { moisAbsolu: 1, budgetInitialFCFA: 1_100_000, previsionActualiseeFCFA: 1_300_000, reelFCFA: 1_000_000, caveatApportsReelsNonModelises: true },
];

const REPREVISION: TresorerieTroisSeriesDTO["reprevisionGlissante"] = [
  { moisAbsolu: 0, source: "REEL", soldeMensuelFCFA: 900_000, soldeCumuleFCFA: 900_000, caveatSerieReelleIncomplete: true },
  { moisAbsolu: 1, source: "PREVISION_ACTUALISEE", soldeMensuelFCFA: 1_300_000, soldeCumuleFCFA: 2_200_000, caveatSerieReelleIncomplete: true },
];

function fixture(overrides: Partial<TresorerieTroisSeriesDTO> = {}): TresorerieTroisSeriesDTO {
  return {
    scenarioId: "s1",
    horizonMois: 2,
    budgetInitialDisponible: true,
    series: SERIES,
    reprevisionGlissante: REPREVISION,
    caveatSerieReelleIncomplete: true,
    calculeLe: "2026-08-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("TresorerieTab", () => {
  it("affiche TOUJOURS le caveat de la serie REEL incomplete (jamais filtre)", () => {
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture()} />);
    expect(
      screen.getByText(/Le « réel » de trésorerie est structurellement incomplet/)
    ).toBeInTheDocument();
  });

  it("budgetInitialDisponible=true -> AUCUN bandeau 'budget initial indisponible'", () => {
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture({ budgetInitialDisponible: true })} />);
    expect(screen.queryByText(/Aucun budget initial figé pour ce scénario/)).not.toBeInTheDocument();
  });

  it("budgetInitialDisponible=false -> le bandeau explicite est affiche, JAMAIS masque en silence", () => {
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture({ budgetInitialDisponible: false })} />);
    expect(screen.getByText(/Aucun budget initial figé pour ce scénario/)).toBeInTheDocument();
    expect(screen.getByText(/ce n'est pas un budget initial nul/)).toBeInTheDocument();
  });

  it("affiche le bandeau de fraicheur avec l'instant du calcul", () => {
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture()} />);
    expect(screen.getByText(/pas une photo figée d'un import passé/)).toBeInTheDocument();
  });

  it("etat vide : aucun mois dans l'horizon -> message explicite, pas de crash, pas de graphique", () => {
    render(
      <TresorerieTab
        dateDebutPlan="2026-01-01T00:00:00.000Z"
        tresorerie={fixture({ series: [], horizonMois: 0 })}
      />
    );
    expect(screen.getByText(/Aucune donnée de trésorerie disponible/)).toBeInTheDocument();
    expect(screen.queryByTestId("tresorerie-chart-mock")).not.toBeInTheDocument();
  });

  it("bascule Reprevision : etat initial OFF (aria-pressed=false), le graphique recoit reprevisionActive=false", () => {
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture()} />);
    const toggle = screen.getByRole("button", { name: "Reprévision" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("tresorerie-chart-mock")).toHaveAttribute("data-reprevision-active", "false");
  });

  it("bascule Reprevision : un clic passe a ON (aria-pressed=true), le graphique recoit reprevisionActive=true, et la legende change de texte", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture()} />);

    const toggle = screen.getByRole("button", { name: "Reprévision" });
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("tresorerie-chart-mock")).toHaveAttribute("data-reprevision-active", "true");
    // La legende du graphique doit refleter explicitement la Reprevision —
    // jamais le meme texte que l'etat OFF (sinon la bascule serait
    // cosmetique, sans effet visible sur ce que l'utilisateur comprend).
    expect(screen.getByText(/trésorerie négative sur la Reprévision glissante/)).toBeInTheDocument();
  });

  it("un second clic repasse la bascule a OFF (toggle veritable, pas un bouton a sens unique)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TresorerieTab dateDebutPlan="2026-01-01T00:00:00.000Z" tresorerie={fixture()} />);

    const toggle = screen.getByRole("button", { name: "Reprévision" });
    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("tresorerie-chart-mock")).toHaveAttribute("data-reprevision-active", "false");
  });
});
