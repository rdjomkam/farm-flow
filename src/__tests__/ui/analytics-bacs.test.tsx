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
  biomasse: 45.2,
  poidsMoyen: 150,
  densite: 22.6,
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
  biomasse: 25,
  poidsMoyen: 100,
  densite: 16.7,
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
      />
    );
    expect(screen.getByText("Aucun bac assigné à cette vague.")).toBeInTheDocument();
  });

  it("affiche le nom de chaque bac", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac, fakeBac2]}
        alertes={[]}
      />
    );
    expect(screen.getByText("Bac A")).toBeInTheDocument();
    expect(screen.getByText("Bac B")).toBeInTheDocument();
  });

  it("affiche les labels de metriques monitoring", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac]}
        alertes={[]}
      />
    );
    expect(screen.getByText("Biomasse")).toBeInTheDocument();
    expect(screen.getByText("Densite")).toBeInTheDocument();
    expect(screen.getByText("Poids moyen")).toBeInTheDocument();
    expect(screen.getByText("Vivants")).toBeInTheDocument();
    expect(screen.getByText("Aliment")).toBeInTheDocument();
    expect(screen.getByText("Morts")).toBeInTheDocument();
  });

  it("affiche le banner info avec lien vers analytiques par vague", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac]}
        alertes={[]}
      />
    );
    expect(screen.getByText("Voir les analytiques par vague")).toBeInTheDocument();
  });

  it("affiche les alertes quand il y en a", () => {
    const alertes: AlerteBac[] = [
      {
        bacId: "bac-2",
        bacNom: "Bac B",
        type: "MORTALITE_HAUTE",
        message: "Mortalite elevee (22%) dans Bac B",
        valeur: 22,
        seuil: 10,
      },
      {
        bacId: "bac-2",
        bacNom: "Bac B",
        type: "DENSITE_ELEVEE",
        message: "Densite trop elevee (55 kg/m³) dans Bac B",
        valeur: 55,
        seuil: 50,
      },
    ];

    render(
      <BacComparisonCards
        bacs={[fakeBac, fakeBac2]}
        alertes={alertes}
      />
    );

    expect(screen.getByText("2 alertes")).toBeInTheDocument();
    expect(screen.getByText("Mortalite elevee (22%) dans Bac B")).toBeInTheDocument();
    expect(screen.getByText("Densite trop elevee (55 kg/m³) dans Bac B")).toBeInTheDocument();
  });

  it("affiche le lien Detail pour chaque bac", () => {
    render(
      <BacComparisonCards
        bacs={[fakeBac]}
        alertes={[]}
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
      />
    );
    expect(screen.getByText("2000L")).toBeInTheDocument();
    expect(screen.getByText("12 relevés")).toBeInTheDocument();
  });
});
