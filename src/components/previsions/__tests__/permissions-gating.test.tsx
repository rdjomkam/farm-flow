// @vitest-environment jsdom
/**
 * Tests — Permissions côté client (Sprint PR2, story PR2.3)
 *
 * Vérifie qu'un utilisateur avec seulement `PREVISIONS_VOIR` ne se voit
 * jamais proposer une action qui exige `PREVISIONS_GERER` ou
 * `PREVISIONS_PARAMETRER` (sinon l'utilisateur déclenche un 403 côté API
 * sans le comprendre, cf. patron `checkPagePermission` + conditionnel sur
 * `permissions.includes(...)` documenté par la pré-analyse PR2.3 §6).
 *
 * Composants couverts : PlanVaguesTab (PREVISIONS_GERER : créer, rattacher,
 * scinder, annuler) et ChargesTab (PREVISIONS_PARAMETRER : créer un poste ;
 * PREVISIONS_GERER : enregistrer un montant).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanVaguesTab } from "@/components/previsions/plan-vagues-tab";
import { ChargesTab } from "@/components/previsions/charges-tab";
import { Permission, StatutVaguePrevue, TypePostePrevision } from "@/types";
import type { VaguePrevueListItemDTO, VagueCandidateDTO } from "@/components/previsions/api-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
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

const mockPost = vi.fn();
const mockPut = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: mockPut, get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const vaguePrevue: VaguePrevueListItemDTO = {
  id: "vp-1",
  scenarioId: "scenario-1",
  code: "V1",
  dateStockagePrevue: "2026-09-01T00:00:00.000Z",
  effectifAlevinsPrevu: 5000,
  poidsMoyenInitialG: 5,
  dureeCycleMoisFigee: 7,
  statut: StatutVaguePrevue.PLANIFIEE,
  vaguePrevueParentId: null,
  siteId: "site-1",
  alevinsAchetes: false,
};

const candidates: VagueCandidateDTO[] = [
  { id: "vague-1", code: "VAG-001", statut: "EN_COURS", vaguePrevueId: null },
];

const parametresPrevision = {
  id: "param-1",
  scenarioId: "scenario-1",
  effectifAlevinsParVague: 5000,
  margeSecuriteAlevinsPct: 10,
  poidsMoyenInitialG: 5,
  poidsObjectifG: 800,
  prixAlevinUnitaireFCFA: 50,
  prixVenteKgFCFA: 1500,
  nombreBacsSimultanesCible: 4,
  frequenceStockageMois: 1,
  capaciteTransportAlimentsSacs: null,
  coutTransportAlimentsFCFA: null,
  capaciteTransportPoissonsKg: null,
  coutTransportPoissonsFCFA: null,
  capaciteTransportAlevinsNb: null,
  coutTransportAlevinsFCFA: null,
  tauxEpargnePct: 0,
  alevinsAchetesParDefaut: false,
};

const planVaguesTabDefaultProps = {
  scenarioId: "scenario-1",
  vaguesCandidates: candidates,
  parametres: parametresPrevision,
  dateDebutPlan: "2026-08-01T00:00:00.000Z",
  dureeCycleMois: 7,
};

// ---------------------------------------------------------------------------
// PlanVaguesTab
// ---------------------------------------------------------------------------

describe("PlanVaguesTab — permissions PREVISIONS_VOIR seule", () => {
  it("ne propose aucun bouton de création/rattachement/scission/annulation/génération avec PREVISIONS_VOIR seule", () => {
    render(
      <PlanVaguesTab
        {...planVaguesTabDefaultProps}
        vaguesPrevues={[vaguePrevue]}
        onVaguesPrevuesChange={vi.fn()}
        permissions={[Permission.PREVISIONS_VOIR]}
      />
    );

    expect(screen.queryByRole("button", { name: /Rattacher une vague réelle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Scinder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Annuler/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajouter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Générer un plan/i })).not.toBeInTheDocument();
  });

  it("propose bien les actions de mutation avec PREVISIONS_GERER", () => {
    render(
      <PlanVaguesTab
        {...planVaguesTabDefaultProps}
        vaguesPrevues={[vaguePrevue]}
        onVaguesPrevuesChange={vi.fn()}
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_GERER]}
      />
    );

    expect(screen.getByRole("button", { name: /Rattacher une vague réelle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scinder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Annuler/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Générer un plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Générer un plan/i })).not.toBeDisabled();
  });

  it("n'affiche toujours pas le rattachement pour une VaguePrevue déjà ANNULEE, même avec PREVISIONS_GERER", () => {
    const vagueAnnulee = { ...vaguePrevue, statut: StatutVaguePrevue.ANNULEE };
    render(
      <PlanVaguesTab
        {...planVaguesTabDefaultProps}
        vaguesPrevues={[vagueAnnulee]}
        onVaguesPrevuesChange={vi.fn()}
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_GERER]}
      />
    );

    expect(screen.queryByRole("button", { name: /Rattacher une vague réelle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Scinder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Annuler/i })).not.toBeInTheDocument();
  });

  it("désactive le bouton « Générer un plan » avec un motif explicite si ParametresPrevision est absent, même avec PREVISIONS_GERER", () => {
    render(
      <PlanVaguesTab
        {...planVaguesTabDefaultProps}
        parametres={null}
        vaguesPrevues={[vaguePrevue]}
        onVaguesPrevuesChange={vi.fn()}
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_GERER]}
      />
    );

    const bouton = screen.getByRole("button", { name: /Générer un plan/i });
    expect(bouton).toBeDisabled();
    expect(screen.getByText(/parametresManquants|Paramètres|paramètres/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ChargesTab
// ---------------------------------------------------------------------------

describe("ChargesTab — permissions PREVISIONS_VOIR seule", () => {
  const poste = {
    id: "poste-1",
    scenarioId: "scenario-1",
    libelle: "Electricite",
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: true,
    ordre: 0,
    siteId: "site-1",
    posteReferentielId: "ref-1",
    posteReferentiel: { libelle: "Electricite", actif: true },
  };

  it("le champ de saisie de charge est désactivé et aucun bouton Enregistrer/Créer un poste n'apparaît avec PREVISIONS_VOIR seule", () => {
    render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={[poste]}
        initialCharges={[]}
        permissions={[Permission.PREVISIONS_VOIR]}
        horizonMois={21}
        erreurProjection={null}
      />
    );

    const input = screen.getByLabelText("Electricite") as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajouter un poste|Nouveau poste/i })).not.toBeInTheDocument();
  });

  it("le champ de saisie est actif et le bouton Enregistrer apparaît avec PREVISIONS_GERER", () => {
    render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={[poste]}
        initialCharges={[]}
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_GERER]}
        horizonMois={21}
        erreurProjection={null}
      />
    );

    const input = screen.getByLabelText("Electricite") as HTMLInputElement;
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
  });

  it("le bouton 'Reporter sur plusieurs mois' n'apparait PAS avec PREVISIONS_VOIR seule (story PR2ter.1)", () => {
    render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={[poste]}
        initialCharges={[]}
        permissions={[Permission.PREVISIONS_VOIR]}
        horizonMois={21}
        erreurProjection={null}
      />
    );

    expect(
      screen.queryByRole("button", { name: /Reporter sur plusieurs mois/i })
    ).not.toBeInTheDocument();
  });

  it("le bouton 'Reporter sur plusieurs mois' apparait avec PREVISIONS_GERER (story PR2ter.1)", () => {
    render(
      <ChargesTab
        scenarioId="scenario-1"
        dateDebutPlan="2026-09-01T00:00:00.000Z"
        initialPostes={[poste]}
        initialCharges={[]}
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_GERER]}
        horizonMois={21}
        erreurProjection={null}
      />
    );

    expect(
      screen.getByRole("button", { name: /Reporter sur plusieurs mois/i })
    ).toBeInTheDocument();
  });
});
