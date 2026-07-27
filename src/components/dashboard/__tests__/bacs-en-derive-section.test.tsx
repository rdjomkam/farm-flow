// @vitest-environment jsdom
/**
 * Tests — BacsEnDeriveSection (Story BD.3)
 *
 * Composant : src/components/dashboard/bacs-en-derive-section.tsx
 * ADR de référence : docs/decisions/ADR-051-formulation-limite-detection-bacs-en-derive.md
 *
 * Couverture (cf. docs/TASKS.md section Sprint BD, story BD.3) :
 * 1. 0 résultat → la carte est totalement absente du DOM (pas d'état vide,
 *    pas de bandeau, pas de message rassurant — critère dur du cadrage acté).
 * 2. N résultats → une entrée par bac (nom du bac, vague, écart signé, date
 *    de première détection).
 * 3. Écart signé formaté qualitativement ("N poisson(s) en trop" /
 *    "N poisson(s) manquant(s)"), jamais le nombre brut signé (+3/-3),
 *    avec accord singulier/pluriel.
 * 4. Date absolue ("Détecté le JJ/MM/AAAA"), jamais une durée relative.
 * 5. Lien vers la fiche du bac (/bacs/<bacId>).
 * 6. Phrase de nuance ADR-051 présente à l'écran.
 * 7. Mobile 360px : cartes empilées, pas de <table>, pas de débordement horizontal.
 * 8. Aucun emoji dans le rendu.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BacsEnDeriveSection } from "@/components/dashboard/bacs-en-derive-section";
import { ContexteDetectionEcart } from "@/types";
import type { BacEnDerive } from "@/types";

function makeBacEnDerive(overrides: Partial<BacEnDerive> = {}): BacEnDerive {
  return {
    bacId: "bac-1",
    bacNom: "Bac 11",
    vagueId: "vague-1",
    vagueCode: "Vague-26-03-Prep",
    ecart: 3,
    premiereDetectionLe: new Date("2026-07-12T00:00:00.000Z"),
    derniereDetectionLe: new Date("2026-07-20T00:00:00.000Z"),
    dernierContexte: ContexteDetectionEcart.CALIBRAGE,
    ...overrides,
  };
}

// Détecte tout emoji (plage Unicode des symboles pictographiques/emoji).
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

describe("BacsEnDeriveSection — 0 résultat", () => {
  it("ne rend RIEN dans le DOM (pas de carte, pas d'état vide, pas de bandeau)", () => {
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend aucun texte, même un message rassurant implicite", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[]} />);
    expect(screen.queryByText(/dérive|écart|sain/i)).not.toBeInTheDocument();
  });
});

describe("BacsEnDeriveSection — N résultats", () => {
  it("affiche une entrée par bac avec nom du bac, vague, écart et date de détection", () => {
    const bacs = [
      makeBacEnDerive({ bacId: "bac-1", bacNom: "Bac 11", vagueCode: "Vague-26-03-Prep", ecart: 3 }),
      makeBacEnDerive({ bacId: "bac-2", bacNom: "Bac 4", vagueCode: "Vague-27-01", ecart: -1 }),
    ];
    render(<BacsEnDeriveSection bacsEnDerive={bacs} />);

    expect(screen.getByText(/Bac 11/)).toBeInTheDocument();
    expect(screen.getByText(/Vague-26-03-Prep/)).toBeInTheDocument();
    expect(screen.getByText(/Bac 4/)).toBeInTheDocument();
    expect(screen.getByText(/Vague-27-01/)).toBeInTheDocument();
  });

  it("affiche le titre de la carte tel qu'acté par ADR-051", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive()]} />);
    expect(screen.getByText("Écarts détectés sur des bacs")).toBeInTheDocument();
  });

  it("rend une carte distincte par bac, dans l'ordre fourni par la query", () => {
    const bacs = [
      makeBacEnDerive({ bacId: "bac-1", bacNom: "Bac A" }),
      makeBacEnDerive({ bacId: "bac-2", bacNom: "Bac B" }),
      makeBacEnDerive({ bacId: "bac-3", bacNom: "Bac C" }),
    ];
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={bacs} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toContain("Bac A");
    expect(links[1].textContent).toContain("Bac B");
    expect(links[2].textContent).toContain("Bac C");
  });
});

describe("BacsEnDeriveSection — écart signé qualitatif", () => {
  it("formate un écart positif en 'N poissons en trop' (pluriel), jamais '+3'", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive({ ecart: 3 })]} />);
    expect(screen.getByText("3 poissons en trop")).toBeInTheDocument();
    expect(screen.queryByText(/\+3/)).not.toBeInTheDocument();
  });

  it("formate un écart positif singulier en '1 poisson en trop'", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive({ ecart: 1 })]} />);
    expect(screen.getByText("1 poisson en trop")).toBeInTheDocument();
  });

  it("formate un écart négatif en 'N poissons manquants' (pluriel), jamais '-3'", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive({ ecart: -3 })]} />);
    expect(screen.getByText("3 poissons manquants")).toBeInTheDocument();
    expect(screen.queryByText(/-3/)).not.toBeInTheDocument();
  });

  it("formate un écart négatif singulier en '1 poisson manquant'", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive({ ecart: -1 })]} />);
    expect(screen.getByText("1 poisson manquant")).toBeInTheDocument();
  });
});

describe("BacsEnDeriveSection — date absolue", () => {
  it("affiche une date absolue 'Détecté le JJ/MM/AAAA', jamais une durée relative", () => {
    render(
      <BacsEnDeriveSection
        bacsEnDerive={[makeBacEnDerive({ premiereDetectionLe: new Date("2026-07-12T00:00:00.000Z") })]}
      />
    );
    expect(screen.getByText(/Détecté le/)).toBeInTheDocument();
    expect(screen.getByText(/12\/07\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/il y a|depuis \d+ (jour|heure|semaine)/i)).not.toBeInTheDocument();
  });
});

describe("BacsEnDeriveSection — lien vers la fiche du bac", () => {
  it("contient un lien pointant vers /bacs/<bacId>", () => {
    const { container } = render(
      <BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive({ bacId: "bac-42" })]} />
    );
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "/bacs/bac-42");
  });

  it("un lien distinct par bac, chacun vers son propre /bacs/<bacId>", () => {
    const bacs = [
      makeBacEnDerive({ bacId: "bac-1" }),
      makeBacEnDerive({ bacId: "bac-2" }),
    ];
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={bacs} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/bacs/bac-1", "/bacs/bac-2"]);
  });
});

describe("BacsEnDeriveSection — phrase de nuance ADR-051 (honnêteté de la limite de détection)", () => {
  it("affiche exactement la phrase de nuance actée par ADR-051", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive()]} />);
    expect(
      screen.getByText(
        "Constaté lors des dernières opérations enregistrées — un bac sans opération récente peut dériver sans apparaître ici."
      )
    ).toBeInTheDocument();
  });

  it("ne promet jamais une garantie d'exhaustivité ('tous les bacs', 'aucun bac ne dérive')", () => {
    render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive()]} />);
    expect(screen.queryByText(/tous les bacs|aucun bac ne dérive|liste complète/i)).not.toBeInTheDocument();
  });
});

describe("BacsEnDeriveSection — mobile-first (pas de tableau, cartes empilées)", () => {
  it("ne rend aucun élément <table>", () => {
    const bacs = [makeBacEnDerive({ bacId: "bac-1" }), makeBacEnDerive({ bacId: "bac-2" })];
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={bacs} />);
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(container.querySelector("thead")).not.toBeInTheDocument();
    expect(container.querySelector("tr")).not.toBeInTheDocument();
  });

  it("les entrées sont empilées verticalement (divide-y sur un conteneur flex/block, pas une grille horizontale forcée)", () => {
    const bacs = [makeBacEnDerive({ bacId: "bac-1" }), makeBacEnDerive({ bacId: "bac-2" })];
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={bacs} />);
    const list = container.querySelector(".divide-y");
    expect(list).toBeInTheDocument();
    // Pas de classe de grille horizontale multi-colonnes (grid-cols-2+, flex-row wrap large)
    expect(list?.className).not.toMatch(/grid-cols-[2-9]/);
  });

  it("n'utilise pas de largeurs fixes qui dépasseraient 360px (pas de w-[XXXpx] > 360 en dur)", () => {
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={[makeBacEnDerive()]} />);
    const html = container.innerHTML;
    const fixedWidths = html.match(/w-\[(\d+)px\]/g) ?? [];
    for (const match of fixedWidths) {
      const px = Number(match.match(/\d+/)?.[0]);
      expect(px).toBeLessThanOrEqual(360);
    }
  });
});

describe("BacsEnDeriveSection — aucun emoji", () => {
  it("le rendu ne contient aucun emoji, ni dans le titre/nuance ni dans les entrées", () => {
    const bacs = [
      makeBacEnDerive({ ecart: 3 }),
      makeBacEnDerive({ bacId: "bac-2", ecart: -1 }),
    ];
    const { container } = render(<BacsEnDeriveSection bacsEnDerive={bacs} />);
    expect(EMOJI_REGEX.test(container.textContent ?? "")).toBe(false);
  });
});
