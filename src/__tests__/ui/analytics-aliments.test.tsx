// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedComparisonCards } from "@/components/analytics/feed-comparison-cards";
import { RecommendationCard } from "@/components/analytics/recommendation-card";
import type { AnalytiqueAliment } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/analytics/aliments",
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const fakeAliment1: AnalytiqueAliment = {
  produitId: "prod-1",
  produitNom: "Raanan 42%",
  fournisseurNom: "AquaFeed Cameroun",
  categorie: "ALIMENT",
  prixUnitaire: 2000,
  quantiteTotale: 120,
  coutTotal: 240000,
  nombreVagues: 2,
  fcrMoyen: 1.52,
  sgrMoyen: 1.8,
  coutParKgGain: 2280,
  tauxSurvieAssocie: 91.5,
};

const fakeAliment2: AnalytiqueAliment = {
  produitId: "prod-2",
  produitNom: "Coppens Catfish",
  fournisseurNom: "CoppensAgri",
  categorie: "ALIMENT",
  prixUnitaire: 2500,
  quantiteTotale: 80,
  coutTotal: 200000,
  nombreVagues: 1,
  fcrMoyen: 1.85,
  sgrMoyen: 1.5,
  coutParKgGain: 2960,
  tauxSurvieAssocie: 88,
};

const fakeAlimentNoData: AnalytiqueAliment = {
  produitId: "prod-3",
  produitNom: "Aliment Local",
  fournisseurNom: null,
  categorie: "ALIMENT",
  prixUnitaire: 1000,
  quantiteTotale: 50,
  coutTotal: 50000,
  nombreVagues: 1,
  fcrMoyen: null,
  sgrMoyen: null,
  coutParKgGain: null,
  tauxSurvieAssocie: null,
};

// ---------------------------------------------------------------------------
// RecommendationCard
// ---------------------------------------------------------------------------
describe("RecommendationCard", () => {
  it("affiche la recommandation quand elle est fournie", () => {
    render(
      <RecommendationCard recommandation="L'aliment 'Raanan 42%' a le meilleur rapport qualite/prix." />
    );
    expect(screen.getByText("Recommandation")).toBeInTheDocument();
    expect(
      screen.getByText("L'aliment 'Raanan 42%' a le meilleur rapport qualite/prix.")
    ).toBeInTheDocument();
  });

  it("n'affiche rien quand recommandation est null", () => {
    const { container } = render(<RecommendationCard recommandation={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FeedComparisonCards
// ---------------------------------------------------------------------------
describe("FeedComparisonCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche un message quand aucun aliment", () => {
    render(
      <FeedComparisonCards
        aliments={[]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Aucun aliment utilise sur ce site.")).toBeInTheDocument();
  });

  it("affiche le nom de chaque aliment", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1, fakeAliment2]}
        meilleurFCR="prod-1"
        meilleurCoutKg="prod-1"
        meilleurSGR="prod-1"
      />
    );
    expect(screen.getByText("Raanan 42%")).toBeInTheDocument();
    expect(screen.getByText("Coppens Catfish")).toBeInTheDocument();
  });

  it("affiche le nom du fournisseur", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1]}
        meilleurFCR="prod-1"
        meilleurCoutKg="prod-1"
        meilleurSGR="prod-1"
      />
    );
    expect(screen.getByText("AquaFeed Cameroun")).toBeInTheDocument();
  });

  it("affiche les badges 'Meilleur' pour le gagnant", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1, fakeAliment2]}
        meilleurFCR="prod-1"
        meilleurCoutKg="prod-1"
        meilleurSGR="prod-1"
      />
    );
    expect(screen.getByText("Meilleur cout/kg")).toBeInTheDocument();
    expect(screen.getByText("Meilleur FCR")).toBeInTheDocument();
    expect(screen.getByText("Meilleur SGR")).toBeInTheDocument();
  });

  it("affiche les metriques FCR, Cout/kg et SGR", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("FCR")).toBeInTheDocument();
    expect(screen.getByText("Cout/kg")).toBeInTheDocument();
    expect(screen.getByText("SGR")).toBeInTheDocument();
  });

  it("affiche un tiret pour les metriques null", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAlimentNoData]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("affiche le rang (1, 2) pour chaque aliment", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1, fakeAliment2]}
        meilleurFCR="prod-1"
        meilleurCoutKg="prod-1"
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("affiche le lien Detail pour chaque aliment", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1, fakeAliment2]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    const links = screen.getAllByText("Detail");
    expect(links).toHaveLength(2);
  });

  it("affiche le prix, la quantite et le nombre de vagues", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText(/2[\s\u00a0]?000 CFA\/kg/)).toBeInTheDocument();
    expect(screen.getByText("120 kg utilises")).toBeInTheDocument();
    expect(screen.getByText("2 vagues")).toBeInTheDocument();
  });

  it("affiche le benchmark FCR quand fcrMoyen est renseigne", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    // FCR 1.52 → EXCELLENT (≤ 1.5 is excellent, 1.5-1.8 is BON)
    expect(screen.getByText("Bon")).toBeInTheDocument();
  });

  it("affiche la survie associee quand disponible", () => {
    render(
      <FeedComparisonCards
        aliments={[fakeAliment1]}
        meilleurFCR={null}
        meilleurCoutKg={null}
        meilleurSGR={null}
      />
    );
    expect(screen.getByText("Survie : 91.5%")).toBeInTheDocument();
  });
});
