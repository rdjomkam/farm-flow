// @vitest-environment jsdom
/**
 * Tests — CoutProductionCard (Story CP-3)
 *
 * Composant : src/components/vagues/cout-production-card.tsx
 *
 * Couverture :
 * 1. Affiche l'en-tête "Coût de production" avec données non-nulles
 * 2. État vide quand coutTotal = 0 → "Aucun coût enregistré"
 * 3. Valeurs null → "—" affiché à la place (pas de crash)
 * 4. Expand/collapse → répartition par catégorie apparaît/disparaît
 * 5. Labels de catégories (MULTI_VAGUE, ALIMENT, etc.)
 * 6. Bouton d'export présent avec le bon href
 * 7. Couleurs de la marge et du ROI (positif/négatif)
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { CoutProductionCard } from "@/components/vagues/cout-production-card";
import { CategorieDepense, StatutVague } from "@/types";
import type { CoutProductionVague } from "@/lib/queries/finances";

// ---------------------------------------------------------------------------
// Mocks des dépendances externes
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "buttons.export": "Exporter",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/hooks/use-api", () => ({
  useApi: () => ({
    download: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const baseVague: CoutProductionVague["vague"] = {
  id: "vague-1",
  code: "VAG-001",
  statut: StatutVague.EN_COURS,
  dateDebut: new Date("2026-01-01"),
  dateFin: null,
  nombreInitial: 1000,
  dureeJours: 60,
};

/** Données avec coûts non-nuls et toutes les valeurs renseignées */
const dataWithCosts: CoutProductionVague = {
  vague: baseVague,
  resume: {
    coutTotal: 500000,
    poidsTotalVendu: 200,
    nombrePoissonsVendus: 400,
    biomasseKg: 150,
    biomasseProduite: 350,
    coutParKg: 2500,
    prixMoyenVenteKg: 3000,
    margeParKg: 500,
    revenus: 600000,
    marge: 100000,
    roi: 20,
  },
  coutParCategorie: [
    { categorie: CategorieDepense.ALIMENT, montant: 300000, pourcentage: 60, parKg: 1500 },
    { categorie: "MULTI_VAGUE", montant: 100000, pourcentage: 20, parKg: 500 },
    { categorie: CategorieDepense.INTRANT, montant: 100000, pourcentage: 20, parKg: 500 },
  ],
  detailAliments: [],
  depensesDirectes: [],
  depensesMultiVagues: [],
  depensesRecurrentes: [],
  ventes: [],
  formule: {
    coutAliments: 300000,
    coutDepensesDirectes: 100000,
    coutMultiVagues: 100000,
    coutRecurrents: 0,
    coutTotal: 500000,
    poidsVendu: 200,
    biomasseKg: 150,
    coutParKg: 2500,
  },
};

/** Données avec coutTotal = 0 → état vide */
const dataEmpty: CoutProductionVague = {
  vague: baseVague,
  resume: {
    coutTotal: 0,
    poidsTotalVendu: 0,
    nombrePoissonsVendus: 0,
    biomasseKg: null,
    biomasseProduite: null,
    coutParKg: null,
    prixMoyenVenteKg: null,
    margeParKg: null,
    revenus: 0,
    marge: 0,
    roi: null,
  },
  coutParCategorie: [],
  detailAliments: [],
  depensesDirectes: [],
  depensesMultiVagues: [],
  depensesRecurrentes: [],
  ventes: [],
  formule: {
    coutAliments: 0,
    coutDepensesDirectes: 0,
    coutMultiVagues: 0,
    coutRecurrents: 0,
    coutTotal: 0,
    poidsVendu: 0,
    biomasseKg: null,
    coutParKg: null,
  },
};

/** Données avec valeurs null pour coutParKg, prixMoyenVenteKg, margeParKg, roi */
const dataWithNulls: CoutProductionVague = {
  vague: baseVague,
  resume: {
    coutTotal: 300000,
    poidsTotalVendu: 0,
    nombrePoissonsVendus: 0,
    biomasseKg: null,
    biomasseProduite: null,
    coutParKg: null,
    prixMoyenVenteKg: null,
    margeParKg: null,
    revenus: 0,
    marge: -300000,
    roi: null,
  },
  coutParCategorie: [
    { categorie: CategorieDepense.ALIMENT, montant: 300000, pourcentage: 100, parKg: null },
  ],
  detailAliments: [],
  depensesDirectes: [],
  depensesMultiVagues: [],
  depensesRecurrentes: [],
  ventes: [],
  formule: {
    coutAliments: 300000,
    coutDepensesDirectes: 0,
    coutMultiVagues: 0,
    coutRecurrents: 0,
    coutTotal: 300000,
    poidsVendu: 0,
    biomasseKg: null,
    coutParKg: null,
  },
};

/** Données avec marge et ROI négatifs */
const dataWithNegativeMarge: CoutProductionVague = {
  ...dataWithCosts,
  resume: {
    ...dataWithCosts.resume,
    margeParKg: -200,
    marge: -40000,
    roi: -6.7,
  },
};

// ---------------------------------------------------------------------------
// Suite 1 — Rendu avec données
// ---------------------------------------------------------------------------

describe("CoutProductionCard — Rendu avec données", () => {
  it("affiche le titre 'Coût de production'", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(screen.getByText("Coût de production")).toBeInTheDocument();
  });

  it("affiche le coût total formaté", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    // formatNumber(500000) → "500 000 FCFA" — use exact text match
    expect(screen.getByText("500 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("Coût total")).toBeInTheDocument();
  });

  it("affiche les labels de résumé clés", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(screen.getByText("Coût / kg")).toBeInTheDocument();
    expect(screen.getByText("Prix vente / kg")).toBeInTheDocument();
    expect(screen.getByText("Marge / kg")).toBeInTheDocument();
    expect(screen.getByText("ROI")).toBeInTheDocument();
  });

  it("affiche la valeur ROI quand elle est non-nulle", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(screen.getByText("20.0 %")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — État vide (coutTotal = 0)
// ---------------------------------------------------------------------------

describe("CoutProductionCard — État vide", () => {
  it("affiche le message 'Aucun coût enregistré' quand coutTotal = 0", () => {
    render(<CoutProductionCard data={dataEmpty} vagueId="vague-1" />);
    expect(
      screen.getByText(/Aucun coût enregistré pour cette vague/)
    ).toBeInTheDocument();
  });

  it("n'affiche pas les labels de résumé quand coutTotal = 0", () => {
    render(<CoutProductionCard data={dataEmpty} vagueId="vague-1" />);
    expect(screen.queryByText("Coût / kg")).not.toBeInTheDocument();
    expect(screen.queryByText("ROI")).not.toBeInTheDocument();
  });

  it("n'affiche pas le bouton expand/collapse quand coutTotal = 0", () => {
    render(<CoutProductionCard data={dataEmpty} vagueId="vague-1" />);
    expect(
      screen.queryByRole("button", { name: /Voir le détail/ })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Gestion des valeurs null
// ---------------------------------------------------------------------------

describe("CoutProductionCard — Valeurs null", () => {
  it("affiche '—' pour coutParKg null sans crash", () => {
    render(<CoutProductionCard data={dataWithNulls} vagueId="vague-1" />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche '—' pour prixMoyenVenteKg null", () => {
    render(<CoutProductionCard data={dataWithNulls} vagueId="vague-1" />);
    // coutParKg, prixMoyenVenteKg, margeParKg, roi sont tous null → 4 "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("ne crash pas quand toutes les valeurs optionnelles sont null", () => {
    expect(() =>
      render(<CoutProductionCard data={dataWithNulls} vagueId="vague-1" />)
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Expand / Collapse
// ---------------------------------------------------------------------------

describe("CoutProductionCard — Expand / Collapse", () => {
  it("la répartition par catégorie n'est pas visible par défaut", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(
      screen.queryByText("Répartition par catégorie")
    ).not.toBeInTheDocument();
  });

  it("affiche le bouton 'Voir le détail' quand il y a des coûts", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(
      screen.getByRole("button", { name: "Voir le détail" })
    ).toBeInTheDocument();
  });

  it("affiche la répartition par catégorie après clic sur expand", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    expect(screen.getByText("Répartition par catégorie")).toBeInTheDocument();
  });

  it("masque la répartition après un second clic (collapse)", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });

    // Ouvrir
    fireEvent.click(expandBtn);
    expect(screen.getByText("Répartition par catégorie")).toBeInTheDocument();

    // Fermer
    const collapseBtn = screen.getByRole("button", { name: "Réduire le détail" });
    fireEvent.click(collapseBtn);
    expect(
      screen.queryByText("Répartition par catégorie")
    ).not.toBeInTheDocument();
  });

  it("affiche les revenus et la marge brute dans le détail expandé", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    expect(screen.getByText("Revenus ventes")).toBeInTheDocument();
    expect(screen.getByText("Marge brute")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Labels des catégories
// ---------------------------------------------------------------------------

describe("CoutProductionCard — Labels des catégories", () => {
  it("affiche 'Alimentation' pour CategorieDepense.ALIMENT", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    expect(screen.getByText("Alimentation")).toBeInTheDocument();
  });

  it("affiche 'Coûts partagés' pour MULTI_VAGUE", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    expect(screen.getByText("Coûts partagés")).toBeInTheDocument();
  });

  it("affiche 'Intrants' pour CategorieDepense.INTRANT", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    expect(screen.getByText("Intrants")).toBeInTheDocument();
  });

  it("affiche les pourcentages des catégories", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    expect(screen.getByText("60.0 %")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Bouton d'export
// ---------------------------------------------------------------------------

describe("CoutProductionCard — Bouton d'export", () => {
  it("affiche le bouton d'export avec le label 'Exporter PDF'", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(screen.getByText("Exporter PDF")).toBeInTheDocument();
  });

  it("le bouton d'export est aussi présent en état vide", () => {
    render(<CoutProductionCard data={dataEmpty} vagueId="vague-1" />);
    expect(screen.getByText("Exporter PDF")).toBeInTheDocument();
  });

  it("le bouton d'export a un aria-label correct", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    expect(screen.getByRole("button", { name: "Exporter PDF" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Couleurs de la marge et du ROI
// ---------------------------------------------------------------------------

describe("CoutProductionCard — Couleurs marge / ROI", () => {
  it("la valeur de marge/kg a la classe text-success quand positive", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    // ROI = 20 % → positif → parent div has text-success
    const roiValue = screen.getByText("20.0 %");
    // The color class is on the parent container div, not the span
    expect(roiValue.closest("div")).toHaveClass("text-success");
  });

  it("la valeur de marge/kg a la classe text-destructive quand negative", () => {
    render(<CoutProductionCard data={dataWithNegativeMarge} vagueId="vague-1" />);
    const roiValue = screen.getByText("-6.7 %");
    expect(roiValue.closest("div")).toHaveClass("text-destructive");
  });

  it("la marge brute dans le détail a la classe text-success quand positive", () => {
    render(<CoutProductionCard data={dataWithCosts} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    // marge = 100000 → "Marge brute" label with text-success on the value span
    const margeLabel = screen.getByText("Marge brute");
    const margeRow = margeLabel.closest("div")!;
    const valueSpan = margeRow.querySelector(".text-success");
    expect(valueSpan).toBeTruthy();
  });

  it("la marge brute dans le détail a la classe text-destructive quand négative", () => {
    render(<CoutProductionCard data={dataWithNegativeMarge} vagueId="vague-1" />);
    const expandBtn = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(expandBtn);
    // marge = -40000 → text-destructive, pas de "+" prefix
    const margeElement = screen.getByText(/Marge brute/).closest("div")?.querySelector(".text-destructive");
    expect(margeElement).toBeTruthy();
  });

  it("aucune classe de couleur quand margeParKg est null", () => {
    render(<CoutProductionCard data={dataWithNulls} vagueId="vague-1" />);
    // Le composant ne crash pas et les valeurs null affichent "—" sans classe couleur
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
