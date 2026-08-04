// @vitest-environment jsdom
/**
 * src/components/previsions/__tests__/tresorerie-chart.test.tsx
 *
 * Tests UI — story PR2.4, verification par le @tester. Cible le calcul de
 * l'offset du gradient SVG qui colore la zone sous zero de la courbe de
 * tresorerie (pre-analyse PR2.4 §3.1, mission du sprint : "un NaN d'offset
 * casserait le rendu SVG silencieusement").
 *
 * Recharts est mocke (patron deja utilise par
 * src/__tests__/ui/gompertz-projections.test.tsx) pour eviter de dependre
 * du rendu SVG reel de la librairie ; en revanche `<defs>`,
 * `<linearGradient>` et `<stop>` sont des elements SVG NATIFS ecrits en dur
 * dans le composant (pas des imports recharts) — ils sont donc bien rendus
 * tels quels et inspectables via le DOM une fois que le composant
 * dynamique "AreaChart" mocke rend ses enfants. Ce test exerce donc le VRAI
 * calcul d'offset du composant, pas une reimplementation parallele.
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
  AreaChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => (
    <div data-testid="area-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ y }: { y?: number }) => <div data-testid="reference-line" data-y={y} />,
}));

// next/dynamic ({ ssr: false }) — chaque `dynamic(loader)` appele au chargement
// du module `tresorerie-chart.tsx` (des `const` de haut de fichier, executees
// UNE SEULE FOIS a l'import du module) est enregistre ici avec sa `loader`.
// `beforeAll` resout ensuite chaque promesse mockee de "recharts" de maniere
// synchrone AVANT le premier rendu de test, pour eviter toute dependance a
// `waitFor`/effets asynchrones dans les assertions (le composant reel utilise
// `next/dynamic` uniquement pour desactiver le SSR de Recharts, pas pour du
// vrai code-splitting a tester ici).
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

import { TresorerieChart } from "@/components/previsions/tresorerie-chart";

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

describe("TresorerieChart — calcul de l'offset du gradient sous-zero", () => {
  it("serie vide -> message explicite, aucun graphique rendu", () => {
    const { getByText, queryByTestId } = render(
      <TresorerieChart dateDebutPlan={new Date(2026, 0, 1)} mois={[]} />
    );
    expect(getByText(/Aucune donnée à projeter/)).toBeInTheDocument();
    expect(queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("serie entierement POSITIVE -> offset = 1 (aucune zone rouge)", () => {
    const { container } = render(
      <TresorerieChart
        dateDebutPlan={new Date(2026, 0, 1)}
        mois={[
          { moisAbsolu: 0, soldeFCFA: 100000 },
          { moisAbsolu: 1, soldeFCFA: 500000 },
          { moisAbsolu: 2, soldeFCFA: 250000 },
        ]}
      />
    );
    const stops = getGradientStops(container);
    // 4 stops : [0, offset, offset, 1] -> les deux stops du milieu doivent
    // valoir 1 (bascule verte/rouge repoussee tout en bas, donc invisible).
    expect(stops[1]).toBe(1);
    expect(stops[2]).toBe(1);
    expect(stops.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("serie entierement NEGATIVE -> offset = 0 (toute la zone est rouge)", async () => {
    const { container } = render(
      <TresorerieChart
        dateDebutPlan={new Date(2026, 0, 1)}
        mois={[
          { moisAbsolu: 0, soldeFCFA: -100000 },
          { moisAbsolu: 1, soldeFCFA: -500000 },
        ]}
      />
    );
    const stops = getGradientStops(container);
    expect(stops[1]).toBe(0);
    expect(stops[2]).toBe(0);
    expect(stops.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("serie PLATE a zero -> pas de division par zero, offset fini (pas NaN)", async () => {
    const { container } = render(
      <TresorerieChart
        dateDebutPlan={new Date(2026, 0, 1)}
        mois={[
          { moisAbsolu: 0, soldeFCFA: 0 },
          { moisAbsolu: 1, soldeFCFA: 0 },
        ]}
      />
    );
    const stops = getGradientStops(container);
    expect(stops.every((v) => Number.isFinite(v))).toBe(true);
    expect(stops.some((v) => Number.isNaN(v))).toBe(false);
  });

  it("serie a un SEUL point positif -> offset fini, pas NaN", async () => {
    const { container } = render(
      <TresorerieChart dateDebutPlan={new Date(2026, 0, 1)} mois={[{ moisAbsolu: 0, soldeFCFA: 750000 }]} />
    );
    const stops = getGradientStops(container);
    expect(stops.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("serie a un SEUL point negatif -> offset fini, pas NaN", async () => {
    const { container } = render(
      <TresorerieChart dateDebutPlan={new Date(2026, 0, 1)} mois={[{ moisAbsolu: 0, soldeFCFA: -750000 }]} />
    );
    const stops = getGradientStops(container);
    expect(stops.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("serie MIXTE (positive puis negative) -> offset strictement entre 0 et 1", async () => {
    const { container } = render(
      <TresorerieChart
        dateDebutPlan={new Date(2026, 0, 1)}
        mois={[
          { moisAbsolu: 0, soldeFCFA: 2000000 },
          { moisAbsolu: 1, soldeFCFA: -1000000 },
          { moisAbsolu: 2, soldeFCFA: 500000 },
        ]}
      />
    );
    const stops = getGradientStops(container);
    // maxSolde=2000000, minSolde=-1000000 -> offset = 2000000/3000000 = 0.6666...
    expect(stops[1]).toBeCloseTo(2000000 / 3000000, 10);
    expect(stops[1]).toBeGreaterThan(0);
    expect(stops[1]).toBeLessThan(1);
  });

  it("ReferenceLine y=0 toujours presente, quelle que soit la serie", async () => {
    const { getByTestId } = render(
      <TresorerieChart
        dateDebutPlan={new Date(2026, 0, 1)}
        mois={[{ moisAbsolu: 0, soldeFCFA: -1000 }]}
      />
    );
    expect(getByTestId("reference-line").getAttribute("data-y")).toBe("0");
  });
});
