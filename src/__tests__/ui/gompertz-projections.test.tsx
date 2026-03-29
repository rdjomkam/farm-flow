// @vitest-environment jsdom
/**
 * Tests G2.5 — UI Projections Gompertz
 *
 * Couvre :
 *   1. Aucune donnee Gompertz (gompertzParams undefined/null) — badge absent, pas de ligne Gompertz
 *   2. INSUFFICIENT_DATA — texte "Donnees insuffisantes" present, pas de badge colore
 *   3. Confiance LOW — badge "Estimation preliminaire" affiché
 *   4. Confiance MEDIUM — badge "En construction" affiché
 *   5. Confiance HIGH — badge "Modele fiable" affiché
 *   6. Visibilite details techniques — ADMIN/INGENIEUR voient la section, GERANT ne la voit pas
 *   7. Non-regression — la carte de projection SGR classique fonctionne toujours
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Role } from "@/types";
import type { ProjectionVagueV2, CourbeCroissancePoint } from "@/types/calculs";
import type { GompertzParams } from "@/lib/gompertz";

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
      // On recupere le nom du composant depuis la chaine de l'import
      // Ce mock simplifie : retourne null pour les composants dynamiques recharts
      // Le test de graphique vérifie via data-testid injectes par le mock recharts ci-dessus
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
  // Badges Gompertz
  "projections.gompertzBadge.HIGH": "Modele fiable",
  "projections.gompertzBadge.MEDIUM": "En construction",
  "projections.gompertzBadge.LOW": "Estimation preliminaire",
  "projections.gompertzBadge.INSUFFICIENT_DATA": "Donnees insuffisantes (min. 5 biometries)",
  // Params metier
  "projections.gompertzParams.title": "Modele de croissance",
  "projections.gompertzParams.ceilingWeight": "Poids plafond",
  "projections.gompertzParams.speedRapide": "Rapide",
  "projections.gompertzParams.speedNormale": "Normale",
  "projections.gompertzParams.speedLente": "Lente",
  "projections.gompertzParams.speedLabel": "Vitesse",
  "projections.gompertzParams.growthPeak": "Pic de croissance",
  "projections.gompertzParams.dayUnit": (p) => `jour ${p.day}`,
  // Details techniques
  "projections.technicalDetails.title": "Details techniques",
  "projections.technicalDetails.wInfinity": "W∞ (poids asymptotique)",
  "projections.technicalDetails.kRate": "K (taux de croissance)",
  "projections.technicalDetails.tiInflection": "ti (point d'inflexion)",
  "projections.technicalDetails.r2": "R²",
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

// Note : on importe les sous-composants exportes individuellement depuis le module.
// Projections et ProjectionCard ne sont pas exportes nommément — on importe Projections.
import { Projections } from "@/components/dashboard/projections";

// ---------------------------------------------------------------------------
// Helpers — generateurs de donnees mock
// ---------------------------------------------------------------------------

const BASE_CURVE: CourbeCroissancePoint[] = [
  { jour: 0, poidsReel: 5, poidsProjecte: null, poidsGompertz: null },
  { jour: 7, poidsReel: 12, poidsProjecte: null, poidsGompertz: null },
  { jour: 14, poidsReel: 25, poidsProjecte: null, poidsGompertz: null },
  { jour: 21, poidsReel: null, poidsProjecte: 45, poidsGompertz: null },
  { jour: 28, poidsReel: null, poidsProjecte: 70, poidsGompertz: null },
];

const GOMPERTZ_CURVE: CourbeCroissancePoint[] = [
  { jour: 0, poidsReel: 5, poidsProjecte: null, poidsGompertz: 5.2 },
  { jour: 7, poidsReel: 12, poidsProjecte: null, poidsGompertz: 13.1 },
  { jour: 14, poidsReel: 25, poidsProjecte: null, poidsGompertz: 26.4 },
  { jour: 21, poidsReel: null, poidsProjecte: 45, poidsGompertz: 47.8 },
  { jour: 28, poidsReel: null, poidsProjecte: 70, poidsGompertz: 72.3 },
];

const GOMPERTZ_PARAMS: GompertzParams = {
  wInfinity: 1200,
  k: 0.025,
  ti: 70,
};

/** Base d'une projection sans Gompertz */
function makeBaseProjection(overrides: Partial<ProjectionVagueV2> = {}): ProjectionVagueV2 {
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
    gompertzParams: undefined,
    gompertzR2: undefined,
    gompertzConfidence: undefined,
    dateRecolteGompertz: undefined,
    ...overrides,
  };
}

/** Projection avec Gompertz calibre a confiance HIGH */
function makeGompertzHighProjection(overrides: Partial<ProjectionVagueV2> = {}): ProjectionVagueV2 {
  return makeBaseProjection({
    courbeProjection: GOMPERTZ_CURVE,
    gompertzParams: GOMPERTZ_PARAMS,
    gompertzR2: 0.982,
    gompertzConfidence: "HIGH",
    dateRecolteGompertz: 72,
    ...overrides,
  });
}

/** Projection avec Gompertz calibre a confiance MEDIUM */
function makeGompertzMediumProjection(overrides: Partial<ProjectionVagueV2> = {}): ProjectionVagueV2 {
  return makeBaseProjection({
    courbeProjection: GOMPERTZ_CURVE,
    gompertzParams: GOMPERTZ_PARAMS,
    gompertzR2: 0.875,
    gompertzConfidence: "MEDIUM",
    dateRecolteGompertz: 80,
    ...overrides,
  });
}

/** Projection avec Gompertz calibre a confiance LOW */
function makeGompertzLowProjection(overrides: Partial<ProjectionVagueV2> = {}): ProjectionVagueV2 {
  return makeBaseProjection({
    courbeProjection: GOMPERTZ_CURVE,
    gompertzParams: GOMPERTZ_PARAMS,
    gompertzR2: 0.72,
    gompertzConfidence: "LOW",
    dateRecolteGompertz: 90,
    ...overrides,
  });
}

/** Projection avec Gompertz INSUFFICIENT_DATA */
function makeGompertzInsufficientProjection(overrides: Partial<ProjectionVagueV2> = {}): ProjectionVagueV2 {
  return makeBaseProjection({
    courbeProjection: BASE_CURVE,
    gompertzParams: null,
    gompertzR2: null,
    gompertzConfidence: "INSUFFICIENT_DATA",
    dateRecolteGompertz: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. Aucune donnee Gompertz (gompertzParams undefined)
// ---------------------------------------------------------------------------

describe("Scenario 1 — Aucune donnee Gompertz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("n'affiche aucun badge Gompertz quand gompertzParams est undefined", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Modele fiable")).not.toBeInTheDocument();
    expect(screen.queryByText("En construction")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimation preliminaire")).not.toBeInTheDocument();
    expect(screen.queryByText("Donnees insuffisantes (min. 5 biometries)")).not.toBeInTheDocument();
  });

  it("n'affiche pas le bloc Recolte Gompertz quand gompertzParams est undefined", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Recolte Gompertz")).not.toBeInTheDocument();
    expect(screen.queryByText("Recolte SGR")).not.toBeInTheDocument();
  });

  it("affiche quand meme le code de la vague et la date de recolte SGR", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("V2026-001")).toBeInTheDocument();
    expect(screen.getByText("Recolte estimee")).toBeInTheDocument();
  });

  it("n'affiche pas la section parametres Gompertz metier", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Modele de croissance")).not.toBeInTheDocument();
    expect(screen.queryByText("Poids plafond")).not.toBeInTheDocument();
  });

  it("n'affiche pas la section details techniques", () => {
    const projection = makeBaseProjection();
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. INSUFFICIENT_DATA
// ---------------------------------------------------------------------------

describe("Scenario 2 — INSUFFICIENT_DATA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le texte 'Donnees insuffisantes (min. 5 biometries)' en italique", () => {
    const projection = makeGompertzInsufficientProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(
      screen.getByText("Donnees insuffisantes (min. 5 biometries)")
    ).toBeInTheDocument();
  });

  it("n'affiche pas un badge colore (vert/ambre/gris-defaut) pour INSUFFICIENT_DATA", () => {
    const projection = makeGompertzInsufficientProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Modele fiable")).not.toBeInTheDocument();
    expect(screen.queryByText("En construction")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimation preliminaire")).not.toBeInTheDocument();
  });

  it("n'affiche pas la date de recolte Gompertz pour INSUFFICIENT_DATA", () => {
    const projection = makeGompertzInsufficientProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Recolte Gompertz")).not.toBeInTheDocument();
  });

  it("n'affiche pas la section parametres Gompertz metier pour INSUFFICIENT_DATA", () => {
    const projection = makeGompertzInsufficientProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Modele de croissance")).not.toBeInTheDocument();
  });

  it("n'affiche pas la section details techniques pour INSUFFICIENT_DATA", () => {
    const projection = makeGompertzInsufficientProjection();
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });

  it("affiche quand meme les donnees SGR de base", () => {
    const projection = makeGompertzInsufficientProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("V2026-001")).toBeInTheDocument();
    expect(screen.getByText("Recolte estimee")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Confiance LOW
// ---------------------------------------------------------------------------

describe("Scenario 3 — Confiance LOW", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le badge 'Estimation preliminaire' pour LOW", () => {
    const projection = makeGompertzLowProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Estimation preliminaire")).toBeInTheDocument();
  });

  it("affiche le bloc parametres Gompertz metier pour LOW", () => {
    const projection = makeGompertzLowProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Modele de croissance")).toBeInTheDocument();
    expect(screen.getByText("Poids plafond")).toBeInTheDocument();
  });

  it("affiche la date de recolte Gompertz pour LOW (dateRecolteGompertz present)", () => {
    const projection = makeGompertzLowProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Recolte Gompertz")).toBeInTheDocument();
    expect(screen.getByText("~90 j")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Confiance MEDIUM
// ---------------------------------------------------------------------------

describe("Scenario 4 — Confiance MEDIUM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le badge 'En construction' pour MEDIUM", () => {
    const projection = makeGompertzMediumProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("En construction")).toBeInTheDocument();
  });

  it("affiche le bloc parametres Gompertz metier pour MEDIUM", () => {
    const projection = makeGompertzMediumProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Modele de croissance")).toBeInTheDocument();
    expect(screen.getByText("Vitesse")).toBeInTheDocument();
  });

  it("affiche la date de recolte Gompertz pour MEDIUM", () => {
    const projection = makeGompertzMediumProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Recolte Gompertz")).toBeInTheDocument();
    expect(screen.getByText("~80 j")).toBeInTheDocument();
  });

  it("n'affiche pas le badge LOW ou HIGH pour MEDIUM", () => {
    const projection = makeGompertzMediumProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Estimation preliminaire")).not.toBeInTheDocument();
    expect(screen.queryByText("Modele fiable")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Confiance HIGH
// ---------------------------------------------------------------------------

describe("Scenario 5 — Confiance HIGH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le badge 'Modele fiable' pour HIGH", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Modele fiable")).toBeInTheDocument();
  });

  it("affiche les deux labels de recolte SGR et Gompertz pour HIGH", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Recolte SGR")).toBeInTheDocument();
    expect(screen.getByText("Recolte Gompertz")).toBeInTheDocument();
    expect(screen.getByText("~72 j")).toBeInTheDocument();
  });

  it("affiche le bloc parametres Gompertz metier pour HIGH", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Modele de croissance")).toBeInTheDocument();
    expect(screen.getByText("Poids plafond")).toBeInTheDocument();
    expect(screen.getByText("Vitesse")).toBeInTheDocument();
    expect(screen.getByText("Pic de croissance")).toBeInTheDocument();
  });

  it("affiche le poids plafond arrondi (1200 g)", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("1200 g")).toBeInTheDocument();
  });

  it("affiche la vitesse 'Rapide' pour k=0.025 (>= 0.020)", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("Rapide")).toBeInTheDocument();
  });

  it("affiche le pic de croissance au jour 70", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.getByText("jour 70")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Visibilite des details techniques par role
// ---------------------------------------------------------------------------

describe("Scenario 6 — Visibilite details techniques par role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ADMIN voit le bouton 'Details techniques' quand Gompertz est calibre", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    expect(screen.getByText("Details techniques")).toBeInTheDocument();
  });

  it("INGENIEUR voit le bouton 'Details techniques' quand Gompertz est calibre", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.INGENIEUR} />);

    expect(screen.getByText("Details techniques")).toBeInTheDocument();
  });

  it("GERANT ne voit pas la section details techniques", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.GERANT} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });

  it("PISCICULTEUR ne voit pas la section details techniques", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.PISCICULTEUR} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });

  it("role undefined ne voit pas la section details techniques", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={undefined} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });

  it("ADMIN peut deployer les details techniques et voir W∞, K, ti, R²", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    const btn = screen.getByText("Details techniques");
    fireEvent.click(btn.closest("button") ?? btn);

    expect(screen.getByText("W∞ (poids asymptotique)")).toBeInTheDocument();
    expect(screen.getByText("K (taux de croissance)")).toBeInTheDocument();
    expect(screen.getByText("ti (point d'inflexion)")).toBeInTheDocument();
    expect(screen.getByText("R²")).toBeInTheDocument();
  });

  it("ADMIN voit les valeurs brutes W∞=1200.0 g, K=0.0250 j⁻¹, ti=70.0 j apres deploiement", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    const btn = screen.getByText("Details techniques");
    fireEvent.click(btn.closest("button") ?? btn);

    expect(screen.getByText("1200.0 g")).toBeInTheDocument();
    expect(screen.getByText("0.0250 j⁻¹")).toBeInTheDocument();
    expect(screen.getByText("70.0 j")).toBeInTheDocument();
    expect(screen.getByText("0.982")).toBeInTheDocument();
  });

  it("INGENIEUR ne voit pas les valeurs brutes tant que non deploye", () => {
    const projection = makeGompertzHighProjection();
    render(<Projections projections={[projection]} userRole={Role.INGENIEUR} />);

    expect(screen.queryByText("W∞ (poids asymptotique)")).not.toBeInTheDocument();
  });

  it("ADMIN ne voit pas les details si Gompertz non calibre (null)", () => {
    const projection = makeBaseProjection({ gompertzParams: null, gompertzConfidence: null });
    render(<Projections projections={[projection]} userRole={Role.ADMIN} />);

    expect(screen.queryByText("Details techniques")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Non-regression — projection SGR classique
// ---------------------------------------------------------------------------

describe("Scenario 7 — Non-regression SGR classique", () => {
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
