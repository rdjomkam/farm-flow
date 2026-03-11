// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenchmarkBadge } from "@/components/analytics/benchmark-badge";
import { BacComparisonCards } from "@/components/analytics/bac-comparison-cards";
import type { IndicateursBac, AlerteBac } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/analytics/bacs",
}));

// ---------------------------------------------------------------------------
// BenchmarkBadge
// ---------------------------------------------------------------------------
describe("BenchmarkBadge", () => {
  it("affiche 'Excellent' pour le niveau EXCELLENT", () => {
    render(<BenchmarkBadge level="EXCELLENT" />);
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("affiche 'Bon' pour le niveau BON", () => {
    render(<BenchmarkBadge level="BON" />);
    expect(screen.getByText("Bon")).toBeInTheDocument();
  });

  it("affiche 'Acceptable' pour le niveau ACCEPTABLE", () => {
    render(<BenchmarkBadge level="ACCEPTABLE" />);
    expect(screen.getByText("Acceptable")).toBeInTheDocument();
  });

  it("affiche 'Mauvais' pour le niveau MAUVAIS", () => {
    render(<BenchmarkBadge level="MAUVAIS" />);
    expect(screen.getByText("Mauvais")).toBeInTheDocument();
  });

  it("affiche un tiret quand level est null", () => {
    render(<BenchmarkBadge level={null} />);
    const badge = screen.getByText("—");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-muted");
  });

  it("applique les classes vert pour EXCELLENT", () => {
    render(<BenchmarkBadge level="EXCELLENT" />);
    const badge = screen.getByText("Excellent");
    expect(badge.className).toContain("bg-accent-green-muted");
    expect(badge.className).toContain("text-accent-green");
  });

  it("applique les classes rouge pour MAUVAIS", () => {
    render(<BenchmarkBadge level="MAUVAIS" />);
    const badge = screen.getByText("Mauvais");
    expect(badge.className).toContain("bg-accent-red-muted");
    expect(badge.className).toContain("text-accent-red");
  });

  it("applique les classes jaune pour ACCEPTABLE", () => {
    render(<BenchmarkBadge level="ACCEPTABLE" />);
    const badge = screen.getByText("Acceptable");
    expect(badge.className).toContain("bg-accent-amber-muted");
    expect(badge.className).toContain("text-accent-amber");
  });
});

// ---------------------------------------------------------------------------
// BacComparisonCards
// ---------------------------------------------------------------------------

const fakeBac: IndicateursBac = {
  bacId: "bac-1",
  bacNom: "Bac A",
  vagueId: "vague-1",
  volume: 2000,
  tauxSurvie: 92.5,
  fcr: 1.3,
  sgr: 1.8,
  biomasse: 45.2,
  poidsMoyen: 150,
  densite: 22.6,
  tauxMortalite: 7.5,
  gainQuotidien: 0.5,
  nombreVivants: 301,
  totalMortalites: 24,
  totalAliment: 38,
  dernierReleve: new Date(),
  nombreReleves: 12,
};

const fakeBac2: IndicateursBac = {
  bacId: "bac-2",
  bacNom: "Bac B",
  vagueId: "vague-1",
  volume: 1500,
  tauxSurvie: 78,
  fcr: 2.5,
  sgr: 0.8,
  biomasse: 25,
  poidsMoyen: 100,
  densite: 16.7,
  tauxMortalite: 22,
  gainQuotidien: 0.3,
  nombreVivants: 250,
  totalMortalites: 70,
  totalAliment: 50,
  dernierReleve: new Date(),
  nombreReleves: 8,
};

describe("BacComparisonCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche un message quand aucun bac", () => {
    render(
      <BacComparisonCards
        bacs={[]}
        alertes={[]}
        meilleurFCR={null}
        meilleurSurvie={null}
      />
    );
    expect(screen.getByText("Aucun bac assigne a cette vague.")).toBeInTheDocument();
  });

  it("affiche le nom de chaque bac", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac, fakeBac2]}
        alertes={[]}
        meilleurFCR="bac-1"
        meilleurSurvie="bac-1"
      />
    );
    expect(screen.getByText("Bac A")).toBeInTheDocument();
    expect(screen.getByText("Bac B")).toBeInTheDocument();
  });

  it("affiche les labels de metriques", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac]}
        alertes={[]}
        meilleurFCR="bac-1"
        meilleurSurvie="bac-1"
      />
    );
    expect(screen.getByText("Survie")).toBeInTheDocument();
    expect(screen.getByText("FCR")).toBeInTheDocument();
    expect(screen.getByText("SGR")).toBeInTheDocument();
    expect(screen.getByText("Biomasse")).toBeInTheDocument();
    expect(screen.getByText("Mortalite")).toBeInTheDocument();
    expect(screen.getByText("Densite")).toBeInTheDocument();
  });

  it("affiche le badge 'Meilleure survie' pour le bac gagnant", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac, fakeBac2]}
        alertes={[]}
        meilleurFCR="bac-1"
        meilleurSurvie="bac-1"
      />
    );
    expect(screen.getByText("Meilleure survie")).toBeInTheDocument();
    expect(screen.getByText("Meilleur FCR")).toBeInTheDocument();
  });

  it("affiche les alertes quand il y en a", () => {
    const alertes: AlerteBac[] = [
      {
        bacId: "bac-2",
        bacNom: "Bac B",
        type: "SURVIE_BASSE",
        message: "Survie critique (78%) dans Bac B",
        valeur: 78,
        seuil: 80,
      },
      {
        bacId: "bac-2",
        bacNom: "Bac B",
        type: "MORTALITE_HAUTE",
        message: "Mortalite elevee (22%) dans Bac B",
        valeur: 22,
        seuil: 10,
      },
    ];

    render(
      <BacComparisonCards
        bacs={[fakeBac, fakeBac2]}
        alertes={alertes}
        meilleurFCR="bac-1"
        meilleurSurvie="bac-1"
      />
    );

    expect(screen.getByText("2 alertes")).toBeInTheDocument();
    expect(screen.getByText("Survie critique (78%) dans Bac B")).toBeInTheDocument();
    expect(screen.getByText("Mortalite elevee (22%) dans Bac B")).toBeInTheDocument();
  });

  it("affiche le lien Detail pour chaque bac", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac]}
        alertes={[]}
        meilleurFCR={null}
        meilleurSurvie={null}
      />
    );
    const links = screen.getAllByText("Detail");
    expect(links).toHaveLength(1);
  });

  it("affiche le volume et nombre de releves", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac]}
        alertes={[]}
        meilleurFCR={null}
        meilleurSurvie={null}
      />
    );
    expect(screen.getByText("2000L")).toBeInTheDocument();
    expect(screen.getByText("12 releves")).toBeInTheDocument();
  });
});
