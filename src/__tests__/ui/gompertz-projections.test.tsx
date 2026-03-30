// @vitest-environment jsdom
/**
 * Tests G2.5 — UI Projections (non-regression)
 *
 * Couvre :
 *   1. Aucune donnee Gompertz — badges absents, pas de section Gompertz
 *      (la courbe Gompertz a ete deplacee sur la page de detail vague)
 *   2. INSUFFICIENT_DATA — la projection SGR de base fonctionne encore
 *   3. Non-regression — la carte de projection SGR classique fonctionne toujours
 *
 * Scenarios 3-6 (confiance LOW/MEDIUM/HIGH, details techniques par role) ont ete
 * supprimes car Gompertz n'est plus rendu dans le composant Projections du dashboard.
 * Ces fonctionnalites sont testees via poids-chart.tsx (page detail vague).
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Role } from "@/types";
import type { CourbeCroissancePoint, ProjectionVague } from "@/types/calculs";

// ---------------------------------------------------------------------------
// Mocks globaux
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// Recharts est charge dynamiquement (SSR disabled) — on le mocke en totalite
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="composed-chart" data-points={data?.length}>{children}</div>
  ),
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ x, y }: { x?: number; y?: number }) => (
    <div data-testid="reference-line" data-x={x} data-y={y} />
  ),
  Legend: () => <div data-testid="legend" />,
}));

// next/dynamic — retourne le composant directement (pas de loading state)
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: unknown } | unknown>) => {
    // Pour les imports recharts via .then(mod => mod.XXX), on redirige vers le mock
    return (props: Record<string, unknown>) => {
      // Ce mock simplifie : retourne null pour les composants dynamiques recharts
      return null;
    };
  },
}));

// Translation mock pour le namespace "analytics"
const analyticsTranslations: Record<string, string | ((p: Record<string, unknown>) => string)> = {
  // Projections generales
  "projections.title": "Projections de performance",
  "projections.notEnoughData": "Pas assez de donnees biometriques",
  "projections.noDataMessage": "Aucune donnee biometrique pour generer la projection.",
  "projections.hide": "Masquer",
  "projections.chart": "Graphique",
  "projections.currentWeight": "Poids actuel",
  "projections.target": "Objectif",
  "projections.inDays": (p) => `dans ${p.count} j`,
  "projections.insufficientData": "Donnees insuffisantes",
  "projections.estimatedHarvest": "Recolte estimee",
  "projections.remainingFeed": "Aliment restant",
  "projections.expectedRevenue": "Revenu attendu",
  "projections.growthCurve": "Courbe de croissance",
  "projections.chartLegend": "Ligne continue = mesures reelles",
  "projections.sgrHarvest": "Recolte SGR",
  "projections.gompertzHarvest": "Recolte Gompertz",
  "projections.harvestInDays": (p) => `~${p.count} j`,
  // Labels SGR
  "labels.sgrActuel": "TCS actuel",
  "labels.sgrRequis": "TCS requis",
  "labels.sgrUnit": "%/j",
  "labels.croissance": "Croissance (TCS)",
  "labels.enAvanceSurObjectif": "En avance sur l'objectif de croissance",
  "labels.enRetardSurObjectif": "En retard sur l'objectif de croissance",
};

vi.mock("next-intl", () => ({
  useTranslations: (_namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const val = analyticsTranslations[key];
    if (typeof val === "function") return val(params ?? {});
    if (typeof val === "string") return val;
    return key;
  },
}));

// ---------------------------------------------------------------------------
// Import du composant APRES les mocks
// ---------------------------------------------------------------------------

import { Projections } from "@/components/dashboard/projections";

// ---------------------------------------------------------------------------
// Helpers — generateurs de donnees mock
// ---------------------------------------------------------------------------

const BASE_CURVE: CourbeCroissancePoint[] = [
  { jour: 0, poidsReel: 5, poidsProjecte: null },
  { jour: 7, poidsReel: 12, poidsProjecte: null },
  { jour: 14, poidsReel: 25, poidsProjecte: null },
  { jour: 21, poidsReel: null, poidsProjecte: 45 },
  { jour: 28, poidsReel: null, poidsProjecte: 70 },
];

/** Base d'une projection SGR sans Gompertz */
function makeBaseProjection(overrides: Partial<ProjectionVague> = {}): ProjectionVague {
  return {
    vagueId: "vague-1",
    vagueCode: "V2026-001",
    sgrActuel: 2.1,
    sgrRequis: 1.8,
    enAvance: true,
    dateRecolteEstimee: new Date("2026-06-15"),
    joursRestantsEstimes: 78,
    alimentRestantEstime: 45,
    revenuAttendu: null,
    courbeProjection: BASE_CURVE,
    poidsMoyenActuel: 85,
    poidsObjectif: 500,
    joursEcoules: 14,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Aucune donnee Gompertz — badges absents du composant Projections
// ---------------------------------------------------------------------------

describe("Scenario 1 — Aucune donnee Gompertz dans le dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("n'affiche aucun badge Gompertz (Modele fiable / En construction / Estimation preliminaire)", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Modele fiable")).not.toBeInTheDocument();
    expect(screen.queryByText("En construction")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimation preliminaire")).not.toBeInTheDocument();
    expect(screen.queryByText("Donnees insuffisantes (min. 5 biometries)")).not.toBeInTheDocument();
  });

  it("n'affiche pas le label 'Recolte Gompertz'", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Recolte Gompertz")).not.toBeInTheDocument();
  });

  it("affiche quand meme le code de la vague et la date de recolte SGR", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("V2026-001")).toBeInTheDocument();
    expect(screen.getByText("Recolte estimee")).toBeInTheDocument();
  });

  it("n'affiche pas la section 'Modele de croissance' (parametres Gompertz metier)", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Modele de croissance")).not.toBeInTheDocument();
    expect(screen.queryByText("Poids plafond")).not.toBeInTheDocument();
  });

  it("n'affiche pas la section 'Details techniques'", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Projection sans donnees suffisantes (sgrActuel null)
// ---------------------------------------------------------------------------

describe("Scenario 2 — Projection sans donnees suffisantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche 'Pas assez de donnees biometriques' quand sgrActuel est null", () => {
    const projection = makeBaseProjection({ sgrActuel: null, sgrRequis: null, enAvance: null });
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Pas assez de donnees biometriques")).toBeInTheDocument();
  });

  it("n'affiche toujours pas de badge Gompertz ni de section technique", () => {
    const projection = makeBaseProjection({ sgrActuel: null, sgrRequis: null, enAvance: null });
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    expect(screen.queryByText("Modele fiable")).not.toBeInTheDocument();
    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
    expect(screen.queryByText("Modele de croissance")).not.toBeInTheDocument();
  });

  it("affiche quand meme le code de la vague", () => {
    const projection = makeBaseProjection({ sgrActuel: null, sgrRequis: null, enAvance: null });
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("V2026-001")).toBeInTheDocument();
    expect(screen.getByText("Recolte estimee")).toBeInTheDocument();
  });

  it("affiche 'Donnees insuffisantes' pour alimentRestantEstime null", () => {
    const projection = makeBaseProjection({ alimentRestantEstime: null });
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Donnees insuffisantes")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Non-regression — projection SGR classique
// ---------------------------------------------------------------------------

describe("Scenario 3 — Non-regression SGR classique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le titre de la section Projections", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("Projections de performance")).toBeInTheDocument();
  });

  it("affiche le code de vague dans la carte", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("V2026-001")).toBeInTheDocument();
  });

  it("affiche TCS actuel et TCS requis", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} />);

    expect(screen.getByText(/TCS actuel/)).toBeInTheDocument();
    expect(screen.getByText(/TCS requis/)).toBeInTheDocument();
  });

  it("affiche le statut 'En avance' quand sgrActuel >= sgrRequis", () => {
    const projection = makeBaseProjection({ sgrActuel: 2.1, sgrRequis: 1.8, enAvance: true });
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("En avance sur l'objectif de croissance")).toBeInTheDocument();
  });

  it("affiche le statut 'En retard' quand sgrActuel < sgrRequis", () => {
    const projection = makeBaseProjection({ sgrActuel: 1.2, sgrRequis: 1.8, enAvance: false });
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("En retard sur l'objectif de croissance")).toBeInTheDocument();
  });

  it("affiche 'Pas assez de donnees biometriques' quand sgrActuel est null", () => {
    const projection = makeBaseProjection({ sgrActuel: null, sgrRequis: null, enAvance: null });
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("Pas assez de donnees biometriques")).toBeInTheDocument();
  });

  it("affiche le poids actuel et l'objectif", () => {
    const projection = makeBaseProjection({ poidsMoyenActuel: 85, poidsObjectif: 500 });
    render(<Projections projections={[projection]} />);

    expect(screen.getByText(/Poids actuel/)).toBeInTheDocument();
    expect(screen.getByText(/Objectif/)).toBeInTheDocument();
  });

  it("affiche l'aliment restant en kg", () => {
    const projection = makeBaseProjection({ alimentRestantEstime: 45 });
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("45 kg")).toBeInTheDocument();
  });

  it("affiche 'Donnees insuffisantes' quand alimentRestantEstime est null", () => {
    const projection = makeBaseProjection({ alimentRestantEstime: null });
    render(<Projections projections={[projection]} />);

    expect(screen.getByText("Donnees insuffisantes")).toBeInTheDocument();
  });

  it("ne rend rien quand la liste de projections est vide", () => {
    const { container } = render(<Projections projections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("rend plusieurs cartes pour plusieurs vagues", () => {
    const p1 = makeBaseProjection({ vagueId: "v1", vagueCode: "V2026-001" });
    const p2 = makeBaseProjection({ vagueId: "v2", vagueCode: "V2026-002" });
    render(<Projections projections={[p1, p2]} />);

    expect(screen.getByText("V2026-001")).toBeInTheDocument();
    expect(screen.getByText("V2026-002")).toBeInTheDocument();
  });

  it("affiche le revenu attendu quand revenuAttendu est fourni", () => {
    const projection = makeBaseProjection({ revenuAttendu: 500000 });
    render(<Projections projections={[projection]} />);

    // toLocaleString("fr-FR") peut produire un espace fin insecable (\u202f) ou normal selon le runtime
    const el = screen.getByText(/500.000 CFA/);
    expect(el).toBeInTheDocument();
  });

  it("n'affiche pas le bloc revenu quand revenuAttendu est null", () => {
    const projection = makeBaseProjection({ revenuAttendu: null });
    render(<Projections projections={[projection]} />);

    expect(screen.queryByText("Revenu attendu")).not.toBeInTheDocument();
  });

  it("le bouton 'Graphique' est present et cliquable", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} />);

    const btn = screen.getByRole("button", { name: /graphique/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // Apres clic, "Courbe de croissance" apparait
    expect(screen.getByText("Courbe de croissance")).toBeInTheDocument();
  });
});
