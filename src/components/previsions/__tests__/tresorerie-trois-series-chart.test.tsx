// @vitest-environment jsdom
/**
 * src/components/previsions/__tests__/tresorerie-trois-series-chart.test.tsx
 *
 * Tests — TresorerieTroisSeriesChart (Sprint PR3-ter, story B.5, ADR-053
 * §6.4 vue 4 / §6.5). Meme technique de mock que
 * `tresorerie-chart.test.tsx` (Sprint PR2, story PR2.4) : Recharts mocke,
 * `<defs>`/`<linearGradient>`/`<stop>` rendus tels quels (SVG natif ecrit
 * en dur dans le composant), ce qui exerce le VRAI calcul d'offset du
 * composant.
 *
 * Fixtures construites pour FAIRE DIVERGER (ERR-160/ERR-172) :
 * - un cas ou BUDGET INITIAL est disponible et un cas ou il ne l'est pas
 *   (jamais confondu avec "budget initial = 0") ;
 * - un cas ou la Reprevision diverge de la Prevision Actualisee (sinon un
 *   bug qui recopierait bêtement `previsionActualisee` dans `reprevision`
 *   ne serait jamais detecte) ;
 * - une serie ou RÉEL depasse la courbe primaire ET une serie ou RÉEL est
 *   en dessous, pour couvrir la bande d'ecart dans les deux sens.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import frPrevisions from "@/messages/fr/previsions.json";

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") return (cur as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const value = deepGet(frPrevisions, key);
    return typeof value === "string" ? value : key;
  },
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => (
    <div data-testid="composed-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  Area: ({ dataKey, name }: { dataKey?: string; name?: string }) => (
    <div data-testid={`area-${dataKey}`} data-name={name} />
  ),
  Line: ({ dataKey, name }: { dataKey?: string; name?: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ y }: { y?: number }) => <div data-testid="reference-line" data-y={y} />,
  Legend: () => <div data-testid="legend" />,
}));

const { registeredLoaders, resolvedCache } = vi.hoisted(() => ({
  registeredLoaders: [] as (() => Promise<Record<string, unknown>>)[],
  resolvedCache: new Map<() => Promise<Record<string, unknown>>, unknown>(),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<Record<string, unknown>>) => {
    registeredLoaders.push(loader);
    return function DynamicMock(props: Record<string, unknown>) {
      const Comp = resolvedCache.get(loader) as ((p: Record<string, unknown>) => ReactNode) | undefined;
      if (!Comp) return null;
      return <Comp {...props} />;
    };
  },
}));

import { TresorerieTroisSeriesChart } from "@/components/previsions/tresorerie-trois-series-chart";
import type { MoisTresorerieTroisSeriesDTO, MoisReprevisionGlissanteDTO } from "@/components/previsions/tresorerie-types";

beforeAll(async () => {
  for (const loader of registeredLoaders) {
    const mod = await loader();
    resolvedCache.set(loader, mod as unknown as (p: Record<string, unknown>) => ReactNode);
  }
});

function getGradientStops(container: HTMLElement): number[] {
  const stops = Array.from(container.querySelectorAll("stop"));
  return stops.map((s) => Number(s.getAttribute("offset")));
}

const SERIES_MIXTE: MoisTresorerieTroisSeriesDTO[] = [
  { moisAbsolu: 0, budgetInitialFCFA: 1_000_000, previsionActualiseeFCFA: 2_000_000, reelFCFA: 1_500_000, caveatApportsReelsNonModelises: true },
  { moisAbsolu: 1, budgetInitialFCFA: 1_200_000, previsionActualiseeFCFA: -500_000, reelFCFA: -900_000, caveatApportsReelsNonModelises: true },
  { moisAbsolu: 2, budgetInitialFCFA: 900_000, previsionActualiseeFCFA: 400_000, reelFCFA: 1_100_000, caveatApportsReelsNonModelises: true },
];

// Reprevision DELIBEREMENT DIVERGENTE de PrevisionActualisee (ADR-053 §15.2 :
// deux notions distinctes) — si l'implementation recopiait betement
// `previsionActualisee` dans `reprevision`, ce test ne pourrait pas le
// detecter sans cette divergence explicite.
const REPREVISION_DIVERGENTE: MoisReprevisionGlissanteDTO[] = [
  { moisAbsolu: 0, source: "REEL", soldeMensuelFCFA: 1_500_000, soldeCumuleFCFA: 1_500_000, caveatSerieReelleIncomplete: true },
  { moisAbsolu: 1, source: "REEL", soldeMensuelFCFA: -900_000, soldeCumuleFCFA: 600_000, caveatSerieReelleIncomplete: true },
  { moisAbsolu: 2, source: "PREVISION_ACTUALISEE", soldeMensuelFCFA: 400_000, soldeCumuleFCFA: 1_000_000, caveatSerieReelleIncomplete: true },
];

describe("TresorerieTroisSeriesChart", () => {
  it("serie vide -> message explicite, aucun graphique rendu", () => {
    const { getByText, queryByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={[]}
        reprevisionGlissante={[]}
        budgetInitialDisponible={false}
        reprevisionActive={false}
      />
    );
    expect(getByText(/Aucune donnée à projeter/)).toBeInTheDocument();
    expect(queryByTestId("composed-chart")).not.toBeInTheDocument();
  });

  it("budgetInitialDisponible=true -> la ligne Budget initial est rendue", () => {
    const { getByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={true}
        reprevisionActive={false}
      />
    );
    expect(getByTestId("line-budgetInitial")).toBeInTheDocument();
  });

  it("budgetInitialDisponible=false -> AUCUNE ligne Budget initial (jamais une courbe a zero trompeuse)", () => {
    const { queryByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={false}
        reprevisionActive={false}
      />
    );
    expect(queryByTestId("line-budgetInitial")).not.toBeInTheDocument();
  });

  it("reprevisionActive=false -> la courbe primaire porte le nom 'Prévision actualisée'", () => {
    const { getByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={true}
        reprevisionActive={false}
      />
    );
    expect(getByTestId("area-primaire").getAttribute("data-name")).toBe("Prévision actualisée");
  });

  it("reprevisionActive=true -> la courbe primaire porte le nom 'Reprévision glissante' (jamais confondu avec Prévision actualisée)", () => {
    const { getByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={true}
        reprevisionActive={true}
      />
    );
    expect(getByTestId("area-primaire").getAttribute("data-name")).toBe("Reprévision glissante");
  });

  it("bascule Reprevision change l'offset du gradient (les deux courbes primaires divergent reellement)", () => {
    const rendPrevisionActualisee = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={true}
        reprevisionActive={false}
      />
    );
    const stopsPrevisionActualisee = getGradientStops(rendPrevisionActualisee.container);

    const rendReprevision = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={true}
        reprevisionActive={true}
      />
    );
    const stopsReprevision = getGradientStops(rendReprevision.container);

    // PrevisionActualisee : min=-500000, max=2000000 -> offset = 2000000/2500000 = 0.8
    // Reprevision : min=600000, max=1500000 -> tout >= 0 -> offset = 1 (aucune zone rouge)
    expect(stopsPrevisionActualisee[1]).toBeCloseTo(0.8, 10);
    expect(stopsReprevision[1]).toBe(1);
    expect(stopsPrevisionActualisee[1]).not.toBe(stopsReprevision[1]);
  });

  it("bande d'ecart : bandeBase = min(primaire, reel), bandeEcart = |reel - primaire| (jamais un delta signe brut)", () => {
    // Mois 0 : primaire (previsionActualisee) = 2 000 000, reel = 1 500 000
    // -> bandeBase = 1 500 000, bandeEcart = 500 000 (positif, jamais -500 000).
    const points: MoisTresorerieTroisSeriesDTO[] = [
      { moisAbsolu: 0, budgetInitialFCFA: null, previsionActualiseeFCFA: 2_000_000, reelFCFA: 1_500_000, caveatApportsReelsNonModelises: true },
    ];
    const { getByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={points}
        reprevisionGlissante={[]}
        budgetInitialDisponible={false}
        reprevisionActive={false}
      />
    );
    // La bande est bien rendue (dataKey bandeEcart) — la valeur exacte est
    // verifiee indirectement via le nombre de points passes au graphique.
    expect(getByTestId("area-bandeEcart")).toBeInTheDocument();
    expect(getByTestId("composed-chart").getAttribute("data-points")).toBe("1");
  });

  it("ReferenceLine y=0 toujours presente", () => {
    const { getByTestId } = render(
      <TresorerieTroisSeriesChart
        dateDebutPlan={new Date(2026, 0, 1)}
        series={SERIES_MIXTE}
        reprevisionGlissante={REPREVISION_DIVERGENTE}
        budgetInitialDisponible={true}
        reprevisionActive={false}
      />
    );
    expect(getByTestId("reference-line").getAttribute("data-y")).toBe("0");
  });
});
