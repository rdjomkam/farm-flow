/**
 * Tests FD.7 — Composants AlerteRationCard et ScoreFournisseursCard (Sprint FD)
 *
 * Couvre :
 *   1. AlerteRationCard — rendu avec alertes SOUS_ALIMENTATION et SUR_ALIMENTATION
 *   2. AlerteRationCard — rendu sans alertes → message "Aucune alerte"
 *   3. AlerteRationCard — liens vers /vagues/{vagueId}/releves
 *   4. ScoreFournisseursCard — rendu avec fournisseurs
 *   5. ScoreFournisseursCard — rendu sans fournisseurs → message vide
 */

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlerteRationCard } from "@/components/analytics/alerte-ration-card";
import { ScoreFournisseursCard } from "@/components/analytics/score-fournisseurs-card";
import type { AlerteRation } from "@/types";

// ---------------------------------------------------------------------------
// Mocks navigation
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/analytics/aliments",
}));

// ---------------------------------------------------------------------------
// Traductions simulees
// ---------------------------------------------------------------------------

const analyticsTranslations: Record<string, string | ((params: Record<string, unknown>) => string)> = {
  "alertesRation.titre": "Alertes de ration",
  "alertesRation.aucune": "Aucune alerte de ration.",
  "alertesRation.sousAlimentation": "Sous-alimentation",
  "alertesRation.surAlimentation": "Sur-alimentation",
  "alertesRation.ecart": (p: Record<string, unknown>) =>
    `Ecart ${p.pct}% sur ${p.nb} releves`,
  "fournisseurs.titre": "Performance par fournisseur",
  "fournisseurs.aucun": "Aucun fournisseur disponible.",
  "fournisseurs.nombreProduits": (p: Record<string, unknown>) => `${p.count} produit(s)`,
  "fournisseurs.scoreMoyen": "Score moyen",
  "fournisseurs.fcrMoyen": "FCR moyen",
  "fournisseurs.nonDisponible": "N/A",
  "score.excellent": "Excellent",
  "score.bon": "Bon",
  "score.insuffisant": "Insuffisant",
  "score.sur10": "/10",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const val = analyticsTranslations[key];
    if (typeof val === "function") return val(params ?? {});
    if (typeof val === "string") return val;
    return key;
  },
}));

// ---------------------------------------------------------------------------
// Helpers donnees de test
// ---------------------------------------------------------------------------

function makeSousAlimentation(overrides: Partial<AlerteRation> = {}): AlerteRation {
  return {
    vagueId: "vague-1",
    vagueNom: "Vague Janvier 2026",
    type: "SOUS_ALIMENTATION",
    ecartMoyenPct: -25.5,
    relevesConsecutifs: 3,
    ...overrides,
  };
}

function makeSurAlimentation(overrides: Partial<AlerteRation> = {}): AlerteRation {
  return {
    vagueId: "vague-2",
    vagueNom: "Vague Mars 2026",
    type: "SUR_ALIMENTATION",
    ecartMoyenPct: 18.0,
    relevesConsecutifs: 4,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. AlerteRationCard — rendu sans alertes
// ---------------------------------------------------------------------------

describe("AlerteRationCard — rendu sans alertes", () => {
  it("affiche le titre 'Alertes de ration'", () => {
    render(<AlerteRationCard alertes={[]} />);
    expect(screen.getByText("Alertes de ration")).toBeInTheDocument();
  });

  it("affiche le message 'Aucune alerte de ration.' quand alertes=[]", () => {
    render(<AlerteRationCard alertes={[]} />);
    expect(screen.getByText("Aucune alerte de ration.")).toBeInTheDocument();
  });

  it("n'affiche pas de lien quand la liste est vide", () => {
    render(<AlerteRationCard alertes={[]} />);
    const links = screen.queryAllByRole("link");
    expect(links).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. AlerteRationCard — rendu avec alerte SOUS_ALIMENTATION
// ---------------------------------------------------------------------------

describe("AlerteRationCard — alerte SOUS_ALIMENTATION", () => {
  it("affiche le nom de la vague", () => {
    render(<AlerteRationCard alertes={[makeSousAlimentation()]} />);
    expect(screen.getByText("Vague Janvier 2026")).toBeInTheDocument();
  });

  it("affiche le badge 'Sous-alimentation'", () => {
    render(<AlerteRationCard alertes={[makeSousAlimentation()]} />);
    expect(screen.getByText("Sous-alimentation")).toBeInTheDocument();
  });

  it("n'affiche pas le message 'Aucune alerte' quand il y a une alerte", () => {
    render(<AlerteRationCard alertes={[makeSousAlimentation()]} />);
    expect(screen.queryByText("Aucune alerte de ration.")).not.toBeInTheDocument();
  });

  it("affiche les informations d'ecart (valeur absolue de pct)", () => {
    const alerte = makeSousAlimentation({ ecartMoyenPct: -25.5, relevesConsecutifs: 3 });
    render(<AlerteRationCard alertes={[alerte]} />);
    // Le composant utilise Math.abs(alerte.ecartMoyenPct).toFixed(1)
    expect(screen.getByText(/25\.5/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. AlerteRationCard — rendu avec alerte SUR_ALIMENTATION
// ---------------------------------------------------------------------------

describe("AlerteRationCard — alerte SUR_ALIMENTATION", () => {
  it("affiche le nom de la vague", () => {
    render(<AlerteRationCard alertes={[makeSurAlimentation()]} />);
    expect(screen.getByText("Vague Mars 2026")).toBeInTheDocument();
  });

  it("affiche le badge 'Sur-alimentation'", () => {
    render(<AlerteRationCard alertes={[makeSurAlimentation()]} />);
    expect(screen.getByText("Sur-alimentation")).toBeInTheDocument();
  });

  it("affiche les informations d'ecart pour la sur-alimentation", () => {
    const alerte = makeSurAlimentation({ ecartMoyenPct: 18.0, relevesConsecutifs: 4 });
    render(<AlerteRationCard alertes={[alerte]} />);
    expect(screen.getByText(/18\.0/)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. AlerteRationCard — liens vers /vagues/{vagueId}/releves
// ---------------------------------------------------------------------------

describe("AlerteRationCard — liens vers les releves de la vague", () => {
  it("lien pointe vers /vagues/{vagueId}/releves pour une sous-alimentation", () => {
    const alerte = makeSousAlimentation({ vagueId: "vague-abc" });
    render(<AlerteRationCard alertes={[alerte]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/vagues/vague-abc/releves");
  });

  it("lien pointe vers /vagues/{vagueId}/releves pour une sur-alimentation", () => {
    const alerte = makeSurAlimentation({ vagueId: "vague-xyz" });
    render(<AlerteRationCard alertes={[alerte]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/vagues/vague-xyz/releves");
  });

  it("plusieurs alertes = plusieurs liens distincts", () => {
    const alerte1 = makeSousAlimentation({ vagueId: "vague-1" });
    const alerte2 = makeSurAlimentation({ vagueId: "vague-2" });
    render(<AlerteRationCard alertes={[alerte1, alerte2]} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/vagues/vague-1/releves");
    expect(hrefs).toContain("/vagues/vague-2/releves");
  });

  it("chaque lien contient le nom de la vague correspondante", () => {
    const alerte1 = makeSousAlimentation({ vagueId: "vague-1", vagueNom: "Vague Alpha" });
    const alerte2 = makeSurAlimentation({ vagueId: "vague-2", vagueNom: "Vague Beta" });
    render(<AlerteRationCard alertes={[alerte1, alerte2]} />);
    expect(screen.getByText("Vague Alpha")).toBeInTheDocument();
    expect(screen.getByText("Vague Beta")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. AlerteRationCard — cas mixte (sous + sur)
// ---------------------------------------------------------------------------

describe("AlerteRationCard — alertes mixtes", () => {
  it("affiche les deux types d'alertes simultanement", () => {
    const sous = makeSousAlimentation({ vagueId: "vague-sous", vagueNom: "Vague Sous" });
    const sur = makeSurAlimentation({ vagueId: "vague-sur", vagueNom: "Vague Sur" });
    render(<AlerteRationCard alertes={[sous, sur]} />);
    expect(screen.getByText("Sous-alimentation")).toBeInTheDocument();
    expect(screen.getByText("Sur-alimentation")).toBeInTheDocument();
    expect(screen.getByText("Vague Sous")).toBeInTheDocument();
    expect(screen.getByText("Vague Sur")).toBeInTheDocument();
  });

  it("le message 'Aucune alerte' est absent quand la liste est non vide", () => {
    const alertes = [makeSousAlimentation(), makeSurAlimentation()];
    render(<AlerteRationCard alertes={alertes} />);
    expect(screen.queryByText("Aucune alerte de ration.")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. ScoreFournisseursCard — rendu sans fournisseurs
// ---------------------------------------------------------------------------

describe("ScoreFournisseursCard — rendu sans fournisseurs", () => {
  it("affiche le titre 'Performance par fournisseur'", () => {
    render(<ScoreFournisseursCard fournisseurs={[]} />);
    expect(screen.getByText("Performance par fournisseur")).toBeInTheDocument();
  });

  it("affiche 'Aucun fournisseur disponible.' quand la liste est vide", () => {
    render(<ScoreFournisseursCard fournisseurs={[]} />);
    expect(screen.getByText("Aucun fournisseur disponible.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. ScoreFournisseursCard — rendu avec fournisseurs
// ---------------------------------------------------------------------------

describe("ScoreFournisseursCard — rendu avec fournisseurs", () => {
  const fournisseurs = [
    {
      fournisseurId: "four-1",
      fournisseurNom: "AquaFeed Cameroun",
      nombreProduits: 3,
      scoreMoyen: 7.5,
      fcrMoyen: 1.52,
    },
    {
      fournisseurId: "four-2",
      fournisseurNom: "Coppens Agri",
      nombreProduits: 1,
      scoreMoyen: 5.8,
      fcrMoyen: 1.85,
    },
  ];

  it("affiche le nom de chaque fournisseur", () => {
    render(<ScoreFournisseursCard fournisseurs={fournisseurs} />);
    expect(screen.getByText("AquaFeed Cameroun")).toBeInTheDocument();
    expect(screen.getByText("Coppens Agri")).toBeInTheDocument();
  });

  it("affiche le nombre de produits de chaque fournisseur", () => {
    render(<ScoreFournisseursCard fournisseurs={fournisseurs} />);
    expect(screen.getByText("3 produit(s)")).toBeInTheDocument();
    expect(screen.getByText("1 produit(s)")).toBeInTheDocument();
  });

  it("affiche le score moyen avec une decimale", () => {
    render(<ScoreFournisseursCard fournisseurs={fournisseurs} />);
    // 7.5 et 5.8 formattés avec toFixed(1)
    expect(screen.getByText(/7\.5/)).toBeInTheDocument();
    expect(screen.getByText(/5\.8/)).toBeInTheDocument();
  });

  it("affiche le FCR moyen avec deux decimales", () => {
    render(<ScoreFournisseursCard fournisseurs={fournisseurs} />);
    expect(screen.getByText("1.52")).toBeInTheDocument();
    expect(screen.getByText("1.85")).toBeInTheDocument();
  });

  it("n'affiche pas le message 'Aucun fournisseur' quand la liste est non vide", () => {
    render(<ScoreFournisseursCard fournisseurs={fournisseurs} />);
    expect(screen.queryByText("Aucun fournisseur disponible.")).not.toBeInTheDocument();
  });

  it("affiche 'N/A' quand scoreMoyen est null", () => {
    const fournisseurSansScore = [
      {
        fournisseurId: "four-3",
        fournisseurNom: "Fournisseur Sans Score",
        nombreProduits: 1,
        scoreMoyen: null,
        fcrMoyen: null,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseurSansScore} />);
    // Deux "N/A" attendus : un pour score, un pour FCR
    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(2);
  });

  it("affiche 'N/A' quand fcrMoyen est null", () => {
    const fournisseurSansFCR = [
      {
        fournisseurId: "four-4",
        fournisseurNom: "Fournisseur Sans FCR",
        nombreProduits: 2,
        scoreMoyen: 6.0,
        fcrMoyen: null,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseurSansFCR} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. ScoreFournisseursCard — ScoreBadge couleur
// ---------------------------------------------------------------------------

describe("ScoreFournisseursCard — ScoreBadge qualification", () => {
  it("score >= 7 → affiche 'Excellent'", () => {
    const fournisseur = [
      {
        fournisseurId: "four-ex",
        fournisseurNom: "Top Fournisseur",
        nombreProduits: 1,
        scoreMoyen: 8.5,
        fcrMoyen: 1.3,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseur} />);
    expect(screen.getByText(/Excellent/)).toBeInTheDocument();
  });

  it("score entre 5 et 7 → affiche 'Bon'", () => {
    const fournisseur = [
      {
        fournisseurId: "four-score-moyen",
        fournisseurNom: "Fournisseur Ordinaire",
        nombreProduits: 1,
        scoreMoyen: 6.0,
        fcrMoyen: 1.7,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseur} />);
    // Utilise getAllByText pour tolerer les occurrences multiples eventuelles
    const bonElements = screen.getAllByText(/^.*Bon.*$/);
    expect(bonElements.length).toBeGreaterThanOrEqual(1);
    // Au moins un element doit contenir exactement "Bon" dans le badge
    const hasBonBadge = bonElements.some((el) => el.textContent?.includes("Bon"));
    expect(hasBonBadge).toBe(true);
  });

  it("score < 5 → affiche 'Insuffisant'", () => {
    const fournisseur = [
      {
        fournisseurId: "four-ins",
        fournisseurNom: "Mauvais Fournisseur",
        nombreProduits: 1,
        scoreMoyen: 3.5,
        fcrMoyen: 2.8,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseur} />);
    expect(screen.getByText(/Insuffisant/)).toBeInTheDocument();
  });

  it("score exactement 7 → affiche 'Excellent' (borne inclusive)", () => {
    const fournisseur = [
      {
        fournisseurId: "four-7",
        fournisseurNom: "Fournisseur Score 7",
        nombreProduits: 1,
        scoreMoyen: 7.0,
        fcrMoyen: 1.5,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseur} />);
    expect(screen.getByText(/Excellent/)).toBeInTheDocument();
  });

  it("score exactement 5 → affiche 'Bon' (borne inclusive)", () => {
    const fournisseur = [
      {
        fournisseurId: "four-5",
        fournisseurNom: "Fournisseur Score 5",
        nombreProduits: 1,
        scoreMoyen: 5.0,
        fcrMoyen: 2.0,
      },
    ];
    render(<ScoreFournisseursCard fournisseurs={fournisseur} />);
    expect(screen.getByText(/Bon/)).toBeInTheDocument();
  });
});
