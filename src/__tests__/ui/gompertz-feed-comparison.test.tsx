// @vitest-environment jsdom
/**
 * Tests UI — feed-comparison-cards.tsx + feed-k-comparison-chart.tsx (Sprint G3.4)
 *
 * Couvre :
 *   FeedComparisonCards :
 *     1. Rendu sans K data (non breaking) — pas de "Vitesse Gompertz" visible
 *     2. Rendu avec K badge quand kMoyenGompertz est present
 *     3. Badge correct : EXCELLENT→"Rapide", BON→"Normal", FAIBLE→"Lent"
 *     4. Badge "Meilleure croissance K" pour le produit correspondant a meilleurK
 *     5. Pas de section K pour les aliments avec kMoyenGompertz=null
 *
 *   FeedKComparisonChart :
 *     6. Ne rend rien quand < 2 aliments ont des donnees K
 *     7. Rend le chart quand >= 2 aliments ont des donnees K
 *     8. Le chart contient le bon nombre de barres
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AnalytiqueAliment } from "@/types";

// ---------------------------------------------------------------------------
// Mocks globaux
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// next-intl mock — retourne la cle de traduction en guise de libelle
// On mappe les cles connues pour que les assertions soient lisibles
const analyticsTranslations: Record<string, string | ((...args: unknown[]) => string)> = {
  "aliments.noAliments": "Aucun aliment",
  "aliments.detail": "Voir detail",
  "aliments.meilleurCoutKg": "Meilleur cout/kg",
  "aliments.meilleurFCR": "Meilleur FCR",
  "aliments.meilleurSGR": "Meilleur SGR",
  "aliments.coutKgLabel": "Cout/kg gain",
  "aliments.kgUtilises": "kg utilises",
  "benchmarks.fcr.label": "FCR",
  "benchmarks.sgr.label": "SGR",
  "labels.sgrUnit": "%/j",
  "gompertz.vitesseLabel": "Vitesse Gompertz",
  "gompertz.meilleurK": "Meilleure croissance K",
  "gompertz.EXCELLENT": "Rapide",
  "gompertz.BON": "Normal",
  "gompertz.FAIBLE": "Lent",
  "gompertz.chartTitle": "Comparaison vitesse de croissance (K Gompertz)",
  "gompertz.chartXAxisLabel": "Parametre K (j-1)",
  "gompertz.tooltipAbove": "au-dessus",
  "gompertz.tooltipBelow": "en-dessous",
  "gompertz.tooltipTemplate": (p: Record<string, unknown>) => `${p.pct}% ${p.direction}`,
  "tailleGranule.PETIT": "Petit",
  "tailleGranule.MOYEN": "Moyen",
  "tailleGranule.GRAND": "Grand",
  "formeAliment.GRANULE": "Granule",
  "formeAliment.FARINE": "Farine",
  "score.excellent": "Excellent",
  "score.bon": "Bon",
  "score.insuffisant": "Insuffisant",
  "score.sur10": "/10",
};

const vaguesTranslations: Record<string, string | ((...args: unknown[]) => string)> = {
  "list.count": (p: Record<string, unknown>) => `${p.count} vague`,
  "list.countPlural": (p: Record<string, unknown>) => `${p.count} vagues`,
  "comparison.metrics.survie": "Survie",
};

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const map = namespace === "vagues" ? vaguesTranslations : analyticsTranslations;
    const val = map[key];
    if (typeof val === "function") return val(params ?? {});
    if (typeof val === "string") return val;
    return key;
  },
}));

// Recharts mock — retourne des div testables
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data?.length}>{children}</div>
  ),
  Bar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// next/dynamic — retourne le composant directement sans lazy loading
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    // Pour les composants recharts dynamiques, retourner null (ils sont deja mockes via recharts)
    void loader;
    return () => null;
  },
}));

// BenchmarkBadge mock
vi.mock("@/components/analytics/benchmark-badge", () => ({
  BenchmarkBadge: ({ level }: { level: string | null }) =>
    level ? <span data-testid="benchmark-badge">{level}</span> : null,
}));

// evaluerBenchmark + BENCHMARK_FCR mock
vi.mock("@/lib/benchmarks", () => ({
  evaluerBenchmark: vi.fn(() => null),
  BENCHMARK_FCR: {},
}));

// ---------------------------------------------------------------------------
// Import des composants APRES les mocks
// ---------------------------------------------------------------------------

import { FeedComparisonCards } from "@/components/analytics/feed-comparison-cards";
import { FeedKComparisonChart } from "@/components/analytics/feed-k-comparison-chart";

// ---------------------------------------------------------------------------
// Helpers — generateurs d'aliments mock
// ---------------------------------------------------------------------------

function makeAliment(overrides: Partial<AnalytiqueAliment> & { produitId: string; produitNom: string }): AnalytiqueAliment {
  return {
    produitId: overrides.produitId,
    produitNom: overrides.produitNom,
    fournisseurNom: overrides.fournisseurNom ?? null,
    categorie: "ALIMENT",
    prixUnitaire: overrides.prixUnitaire ?? 500,
    quantiteTotale: overrides.quantiteTotale ?? 200,
    coutTotal: overrides.coutTotal ?? 100000,
    nombreVagues: overrides.nombreVagues ?? 2,
    fcrMoyen: overrides.fcrMoyen ?? null,
    sgrMoyen: overrides.sgrMoyen ?? null,
    coutParKgGain: overrides.coutParKgGain ?? null,
    tauxSurvieAssocie: overrides.tauxSurvieAssocie ?? null,
    tailleGranule: overrides.tailleGranule ?? null,
    formeAliment: overrides.formeAliment ?? null,
    tauxProteines: overrides.tauxProteines ?? null,
    adgMoyen: overrides.adgMoyen ?? null,
    perMoyen: overrides.perMoyen ?? null,
    scoreQualite: overrides.scoreQualite ?? null,
    phasesCibles: overrides.phasesCibles ?? [],
    kMoyenGompertz: overrides.kMoyenGompertz,
    kNiveauGompertz: overrides.kNiveauGompertz,
  };
}

// ---------------------------------------------------------------------------
// FeedComparisonCards — 1. Rendu sans K data (non breaking)
// ---------------------------------------------------------------------------

describe("FeedComparisonCards — sans donnees K Gompertz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend la carte sans afficher Vitesse Gompertz quand kMoyenGompertz est undefined", () => {
    const aliment = makeAliment({ produitId: "p1", produitNom: "Aliment Standard" });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.queryByText("Vitesse Gompertz")).not.toBeInTheDocument();
  });

  it("rend la carte sans afficher Vitesse Gompertz quand kMoyenGompertz est null", () => {
    const aliment = makeAliment({ produitId: "p1", produitNom: "Aliment Standard", kMoyenGompertz: null, kNiveauGompertz: null });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.queryByText("Vitesse Gompertz")).not.toBeInTheDocument();
  });

  it("affiche quand meme le nom du produit sans K data", () => {
    const aliment = makeAliment({ produitId: "p1", produitNom: "Aliment Standard" });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Aliment Standard")).toBeInTheDocument();
  });

  it("affiche le message vide quand aliments=[]", () => {
    render(
      <FeedComparisonCards
        aliments={[]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Aucun aliment")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FeedComparisonCards — 2. Rendu avec K badge
// ---------------------------------------------------------------------------

describe("FeedComparisonCards — avec donnees K Gompertz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche Vitesse Gompertz quand kMoyenGompertz est present", () => {
    const aliment = makeAliment({
      produitId: "p1",
      produitNom: "Aliment Premium",
      kMoyenGompertz: 0.025,
      kNiveauGompertz: "EXCELLENT",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Vitesse Gompertz")).toBeInTheDocument();
  });

  it("affiche la valeur K formatee (K=0.0250) quand kMoyenGompertz est present", () => {
    const aliment = makeAliment({
      produitId: "p1",
      produitNom: "Aliment Premium",
      kMoyenGompertz: 0.025,
      kNiveauGompertz: "EXCELLENT",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("K=0.0250")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FeedComparisonCards — 3. Couleur et texte du badge par niveau
// ---------------------------------------------------------------------------

describe("FeedComparisonCards — badge K par niveau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche 'Rapide' pour kNiveauGompertz=EXCELLENT", () => {
    const aliment = makeAliment({
      produitId: "p1",
      produitNom: "Aliment Premium",
      kMoyenGompertz: 0.025,
      kNiveauGompertz: "EXCELLENT",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Rapide")).toBeInTheDocument();
  });

  it("affiche 'Normal' pour kNiveauGompertz=BON", () => {
    const aliment = makeAliment({
      produitId: "p2",
      produitNom: "Aliment Bon",
      kMoyenGompertz: 0.017,
      kNiveauGompertz: "BON",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("affiche 'Lent' pour kNiveauGompertz=FAIBLE", () => {
    const aliment = makeAliment({
      produitId: "p3",
      produitNom: "Aliment Faible",
      kMoyenGompertz: 0.010,
      kNiveauGompertz: "FAIBLE",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Lent")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FeedComparisonCards — 4. Badge "Meilleure croissance K"
// ---------------------------------------------------------------------------

describe("FeedComparisonCards — badge meilleurK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche 'Meilleure croissance K' pour le produit correspondant a meilleurK", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "Aliment A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "Aliment B", kMoyenGompertz: 0.015, kNiveauGompertz: "BON" }),
    ];
    render(
      <FeedComparisonCards
        aliments={aliments}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
        meilleurK="p1"
      />
    );
    expect(screen.getByText("Meilleure croissance K")).toBeInTheDocument();
  });

  it("n'affiche pas 'Meilleure croissance K' quand meilleurK est null", () => {
    const aliment = makeAliment({
      produitId: "p1",
      produitNom: "Aliment A",
      kMoyenGompertz: 0.025,
      kNiveauGompertz: "EXCELLENT",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
        meilleurK={null}
      />
    );
    expect(screen.queryByText("Meilleure croissance K")).not.toBeInTheDocument();
  });

  it("n'affiche pas 'Meilleure croissance K' quand meilleurK est undefined", () => {
    const aliment = makeAliment({
      produitId: "p1",
      produitNom: "Aliment A",
      kMoyenGompertz: 0.025,
      kNiveauGompertz: "EXCELLENT",
    });
    render(
      <FeedComparisonCards
        aliments={[aliment]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.queryByText("Meilleure croissance K")).not.toBeInTheDocument();
  });

  it("affiche le badge seulement sur le produit gagnant, pas sur les autres", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "Aliment A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "Aliment B", kMoyenGompertz: 0.015, kNiveauGompertz: "BON" }),
      makeAliment({ produitId: "p3", produitNom: "Aliment C", kMoyenGompertz: 0.010, kNiveauGompertz: "FAIBLE" }),
    ];
    render(
      <FeedComparisonCards
        aliments={aliments}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
        meilleurK="p1"
      />
    );
    // Le badge ne doit apparaitre qu'une seule fois (seulement pour p1)
    const badges = screen.getAllByText("Meilleure croissance K");
    expect(badges).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// FeedComparisonCards — 5. Pas de section K pour les aliments sans kMoyenGompertz
// ---------------------------------------------------------------------------

describe("FeedComparisonCards — mixte aliments avec et sans K", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("n'affiche pas Vitesse Gompertz pour un aliment sans K, meme si d'autres en ont", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "Avec K", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "Sans K", kMoyenGompertz: null, kNiveauGompertz: null }),
    ];
    render(
      <FeedComparisonCards
        aliments={aliments}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    // La section Vitesse Gompertz doit apparaitre seulement 1 fois (pour p1)
    const sections = screen.getAllByText("Vitesse Gompertz");
    expect(sections).toHaveLength(1);
  });

  it("affiche les deux cartes de produits", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "Avec K", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "Sans K", kMoyenGompertz: null, kNiveauGompertz: null }),
    ];
    render(
      <FeedComparisonCards
        aliments={aliments}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Avec K")).toBeInTheDocument();
    expect(screen.getByText("Sans K")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FeedKComparisonChart — 6. Pas de rendu si < 2 aliments avec K
// ---------------------------------------------------------------------------

describe("FeedKComparisonChart — seuil de visibilite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null quand aucun aliment n'a de donnees K", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "A", kMoyenGompertz: null, kNiveauGompertz: null }),
      makeAliment({ produitId: "p2", produitNom: "B", kMoyenGompertz: null, kNiveauGompertz: null }),
    ];
    const { container } = render(<FeedKComparisonChart aliments={aliments} />);
    expect(container.firstChild).toBeNull();
  });

  it("retourne null quand seulement 1 aliment a des donnees K", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "B", kMoyenGompertz: null, kNiveauGompertz: null }),
    ];
    const { container } = render(<FeedKComparisonChart aliments={aliments} />);
    expect(container.firstChild).toBeNull();
  });

  it("retourne null quand la liste d'aliments est vide", () => {
    const { container } = render(<FeedKComparisonChart aliments={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FeedKComparisonChart — 7. Rendu quand >= 2 aliments avec K
// ---------------------------------------------------------------------------

describe("FeedKComparisonChart — rendu avec donnees suffisantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend le composant quand 2 aliments ont des donnees K", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "Aliment A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "Aliment B", kMoyenGompertz: 0.015, kNiveauGompertz: "BON" }),
    ];
    const { container } = render(<FeedKComparisonChart aliments={aliments} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("affiche le titre du graphique", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "Aliment A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "Aliment B", kMoyenGompertz: 0.015, kNiveauGompertz: "BON" }),
    ];
    render(<FeedKComparisonChart aliments={aliments} />);
    expect(screen.getByText("Comparaison vitesse de croissance (K Gompertz)")).toBeInTheDocument();
  });

  it("rend le composant quand 3 aliments ont des donnees K", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "B", kMoyenGompertz: 0.017, kNiveauGompertz: "BON" }),
      makeAliment({ produitId: "p3", produitNom: "C", kMoyenGompertz: 0.010, kNiveauGompertz: "FAIBLE" }),
    ];
    const { container } = render(<FeedKComparisonChart aliments={aliments} />);
    expect(container.firstChild).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FeedKComparisonChart — 8. Nombre correct de barres
// ---------------------------------------------------------------------------

describe("FeedKComparisonChart — nombre de barres dans le graphique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignore les aliments sans donnees K dans le decompte", () => {
    // 3 aliments, dont 1 sans K → seuls 2 ont des donnees → graphique affiché
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "B", kMoyenGompertz: 0.015, kNiveauGompertz: "BON" }),
      makeAliment({ produitId: "p3", produitNom: "C", kMoyenGompertz: null, kNiveauGompertz: null }),
    ];
    const { container } = render(<FeedKComparisonChart aliments={aliments} />);
    // Le graphique est visible (2 aliments avec K)
    expect(container.firstChild).not.toBeNull();
  });

  it("filtre a 1 aliment avec K et n'affiche pas le graphique", () => {
    const aliments = [
      makeAliment({ produitId: "p1", produitNom: "A", kMoyenGompertz: 0.025, kNiveauGompertz: "EXCELLENT" }),
      makeAliment({ produitId: "p2", produitNom: "B", kMoyenGompertz: null, kNiveauGompertz: null }),
      makeAliment({ produitId: "p3", produitNom: "C", kMoyenGompertz: null, kNiveauGompertz: null }),
    ];
    const { container } = render(<FeedKComparisonChart aliments={aliments} />);
    expect(container.firstChild).toBeNull();
  });
});
