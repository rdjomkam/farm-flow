// @vitest-environment jsdom
/**
 * Tests — Distinction "erreur de calcul" vs "donnees reellement vides"
 * (Sprint PR2, story PR2.4, finding de review/test : le repli
 * "projection vide" attribuait a tort l'absence de donnees a une cause
 * metier — "aucune vague ni charge saisie", "le plan est deja entierement
 * passe" — meme quand la cause reelle est une exception de calcul (ex.
 * configuration d'aliment manquante). Un tableau de bord silencieusement
 * vide qui ressemble a "tout est a zero" oriente l'exploitant vers la
 * mauvaise action corrective.
 *
 * Composants : src/components/previsions/tableau-bord-tab.tsx,
 * src/components/previsions/previsions-mensuelles-tab.tsx
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableauBordTab } from "@/components/previsions/tableau-bord-tab";
import { PrevisionsMensuellesTab } from "@/components/previsions/previsions-mensuelles-tab";
import type { ProjectionScenarioDTO } from "@/components/previsions/projection-types";
import frPrevisions from "@/messages/fr/previsions.json";

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
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const value = deepGet(frPrevisions, key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

vi.mock("@/components/previsions/tresorerie-chart", () => ({
  TresorerieChart: () => <div data-testid="tresorerie-chart" />,
}));

const PROJECTION_VIDE: ProjectionScenarioDTO = {
  horizonMois: 0,
  mois: [],
  vagues: [],
  pointBas: null,
  budget: {
    totalCoutsProductionFCFA: 0,
    totalChargesHorsProductionFCFA: 0,
    totalApportsFCFA: 0,
    budgetTotalFCFA: 0,
  },
};

const MESSAGE_ERREUR =
  'Impossible de calculer le besoin en aliment : sacsParTonneStandard non configure pour la granulometrie "Granule 2mm".';

describe("TableauBordTab — distinction erreur de calcul / donnees vides", () => {
  it("affiche un message d'erreur explicite quand erreurProjection est renseigne, jamais les messages de l'etat vide legitime", () => {
    render(
      <TableauBordTab
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        projection={PROJECTION_VIDE}
        erreurProjection={MESSAGE_ERREUR}
      />
    );

    expect(screen.getByText("Calcul de la projection indisponible")).toBeInTheDocument();
    expect(screen.getByText(MESSAGE_ERREUR)).toBeInTheDocument();

    // Les messages de l'etat "reellement vide" ne doivent PAS apparaitre :
    // ils feraient croire a un probleme de saisie ou un plan perime plutot
    // qu'a une erreur de configuration.
    expect(
      screen.queryByText("Aucune donnée sur ce scénario (aucune vague ni charge saisie).")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Hors horizon du plan : le plan est déjà entièrement passé.")
    ).not.toBeInTheDocument();
  });

  it("sans erreurProjection, l'etat vide legitime affiche bien ses messages metier habituels", () => {
    render(
      <TableauBordTab
        dateDebutPlan="2020-01-01T00:00:00.000Z"
        projection={PROJECTION_VIDE}
        erreurProjection={null}
      />
    );

    expect(screen.getByText("Aucune donnée sur ce scénario (aucune vague ni charge saisie).")).toBeInTheDocument();
    expect(screen.getByText("Hors horizon du plan : le plan est déjà entièrement passé.")).toBeInTheDocument();
    expect(screen.queryByText("Calcul de la projection indisponible")).not.toBeInTheDocument();
  });
});

describe("PrevisionsMensuellesTab — distinction erreur de calcul / donnees vides", () => {
  it("affiche un message d'erreur explicite quand erreurProjection est renseigne, pas le message generique 'aucune donnee'", () => {
    render(
      <PrevisionsMensuellesTab
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        mois={[]}
        erreurProjection={MESSAGE_ERREUR}
        apports={[]}
        charges={[]}
        postes={[]}
        journal={[]}
      />
    );

    expect(screen.getByText("Calcul de la projection indisponible")).toBeInTheDocument();
    expect(screen.getByText(MESSAGE_ERREUR)).toBeInTheDocument();
    expect(screen.queryByText("Aucune donnée à afficher pour ce scénario.")).not.toBeInTheDocument();
  });

  it("sans erreurProjection, l'etat vide legitime affiche son message generique habituel", () => {
    render(
      <PrevisionsMensuellesTab
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        mois={[]}
        erreurProjection={null}
        apports={[]}
        charges={[]}
        postes={[]}
        journal={[]}
      />
    );

    expect(screen.getByText("Aucune donnée à afficher pour ce scénario.")).toBeInTheDocument();
    expect(screen.queryByText("Calcul de la projection indisponible")).not.toBeInTheDocument();
  });
});
