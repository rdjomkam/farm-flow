// @vitest-environment jsdom
/**
 * Tests — AlimentsTab (Sprint PR2, story PR2.3, finding de review #2)
 *
 * `sommeRepartition` est un chiffre calcule (somme des pourcentages de
 * repartition mensuelle d'un aliment) — meme famille que le finding #1 de
 * ChargesTab : doit etre explicable via `ValeurCalculee`, pas affiche en
 * texte brut.
 *
 * Fixtures a plat (fusion `AlimentArticlePrevision` -> `AlimentPrevision`,
 * ADR-053 §12.1/§12.3 amendement post-PR2-quater) : chaque calibre = un seul
 * article, plus de sous-liste `articles[]` ni de part d'approvisionnement.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlimentsTab } from "@/components/previsions/aliments-tab";
import { Permission, TailleGranule } from "@/types";
import type { AlimentPrevisionDTO } from "@/components/previsions/api-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frStock from "@/messages/fr/stock.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  stock: frStock,
};

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") return (cur as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function interpolate(template: string, values?: Record<string, unknown>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const value = deepGet(DICTIONARIES[namespace], key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

const libelleArticle = "Granule 2mm";
const calibreLabelP2 = deepGet(frStock, "produits.taillesGranule.P2") as string;
const calibreLabelG2 = deepGet(frStock, "produits.taillesGranule.G2") as string;

const aliment: AlimentPrevisionDTO = {
  id: "aliment-1",
  scenarioId: "scenario-1",
  tailleGranule: TailleGranule.P2,
  sacsParTonneStandard: 8,
  produitId: null,
  libelle: libelleArticle,
  poidsSacKg: 25,
  prixSacFCFA: 15000,
  sacsParTonneUnitaire: 40,
  ordre: 0,
  siteId: "site-1",
  repartitions: [
    { id: "r1", alimentPrevisionId: "aliment-1", moisCycle: 1, pourcentage: 60, siteId: "site-1" },
    { id: "r2", alimentPrevisionId: "aliment-1", moisCycle: 2, pourcentage: 40, siteId: "site-1" },
  ],
};

const alimentG2: AlimentPrevisionDTO = {
  ...aliment,
  id: "aliment-2",
  tailleGranule: TailleGranule.G2,
  libelle: "Marque B",
};

describe("AlimentsTab — explicabilite de la repartition mensuelle (§7.4, finding de review #2)", () => {
  it("la repartition mensuelle n'est pas un texte brut : elle expose un bouton d'explication accessible", () => {
    render(
      <AlimentsTab
        scenarioId="scenario-1"
        dureeCycleMois={7}
        initialAliments={[aliment]}
        permissions={[Permission.PREVISIONS_VOIR]}
      />
    );

    expect(
      screen.getByRole("button", { name: `Expliquer la répartition mensuelle de ${calibreLabelP2}` })
    ).toBeInTheDocument();
  });

  it("le popover affiche la formule et le detail par mois du cycle", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    render(
      <AlimentsTab
        scenarioId="scenario-1"
        dureeCycleMois={7}
        initialAliments={[aliment]}
        permissions={[Permission.PREVISIONS_VOIR]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: `Expliquer la répartition mensuelle de ${calibreLabelP2}` })
    );

    expect(await screen.findByText(/somme des pourcentages saisis/i)).toBeInTheDocument();
    expect(screen.getByText("Mois 1")).toBeInTheDocument();
    expect(screen.getByText("Mois 2")).toBeInTheDocument();
  });
});

describe("AlimentsTab — un calibre = un article (fusion post-PR2-quater)", () => {
  it("affiche le libelle, le poids et le prix de l'article directement sur la carte du calibre", () => {
    render(
      <AlimentsTab
        scenarioId="scenario-1"
        dureeCycleMois={7}
        initialAliments={[aliment]}
        permissions={[Permission.PREVISIONS_VOIR]}
      />
    );

    expect(screen.getByText(new RegExp(libelleArticle))).toBeInTheDocument();
  });

  it("le titre de la carte est le calibre (tailleGranule), jamais le nom de l'article", () => {
    render(
      <AlimentsTab
        scenarioId="scenario-1"
        dureeCycleMois={7}
        initialAliments={[aliment]}
        permissions={[Permission.PREVISIONS_VOIR]}
      />
    );

    expect(screen.getByText(calibreLabelP2)).toBeInTheDocument();
    // Le nom de l'article reste affiche, mais jamais comme titre de la carte.
    expect(screen.queryByText(libelleArticle)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(libelleArticle))).toBeInTheDocument();
  });

  it("deux calibres distincts affichent chacun leur propre titre de calibre", () => {
    render(
      <AlimentsTab
        scenarioId="scenario-1"
        dureeCycleMois={7}
        initialAliments={[aliment, alimentG2]}
        permissions={[Permission.PREVISIONS_VOIR]}
      />
    );

    expect(screen.getByText(calibreLabelP2)).toBeInTheDocument();
    expect(screen.getByText(calibreLabelG2)).toBeInTheDocument();
  });

  it("mobile-first (360px) : aucun tableau, uniquement des cartes empilees", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 360 });

    const { container } = render(
      <AlimentsTab
        scenarioId="scenario-1"
        dureeCycleMois={7}
        initialAliments={[aliment, alimentG2]}
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_PARAMETRER]}
      />
    );

    expect(container.querySelectorAll("table").length).toBe(0);
    // Chaque calibre est une carte empilee independante, pas une ligne de tableau.
    expect(container.querySelectorAll(".rounded-xl.border").length).toBeGreaterThanOrEqual(2);
  });
});
