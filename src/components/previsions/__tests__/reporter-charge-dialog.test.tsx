// @vitest-environment jsdom
/**
 * Tests — ReporterChargeDialog (Sprint PR2-ter, story PR2ter.1)
 *
 * Composant : src/components/previsions/reporter-charge-dialog.tsx
 *
 * Couvre le point le plus important de la story (pre-analyse section 4) :
 * l'apercu (mois concernes, mois ecrases avec ancien -> nouveau montant)
 * calcule SANS aucun appel reseau, affiche AVANT toute confirmation. Suit
 * aussi le patron de garde de fermeture (Bug A/B, PR2ter.2) : reset a la
 * reouverture, clic exterieur/Echap bloque uniquement si le formulaire a
 * ete touche.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReporterChargeDialog } from "@/components/previsions/reporter-charge-dialog";
import type { ChargeMensuellePrevueDTO } from "@/components/previsions/api-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";
import { fillField } from "./test-utils";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
  "common.buttons": (frCommon as { buttons: Record<string, unknown> }).buttons,
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
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: vi.fn(), get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

const charges: ChargeMensuellePrevueDTO[] = [
  { id: "c1", scenarioId: "s1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: 100000, siteId: "site-1" },
  { id: "c2", scenarioId: "s1", posteId: "poste-1", moisAbsolu: 2, montantFCFA: 250000, siteId: "site-1" },
  // Autre poste : ne doit jamais entrer dans l'apercu de "poste-1".
  { id: "c3", scenarioId: "s1", posteId: "poste-2", moisAbsolu: 1, montantFCFA: 999999, siteId: "site-1" },
];

const defaultProps = {
  posteId: "poste-1",
  libelle: "Electricite",
  moisCourant: 0,
  horizonMois: 5,
  erreurProjection: null,
  charges,
  dateDebutPlan: "2026-08-01T00:00:00.000Z",
  onReported: vi.fn(),
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /Reporter sur plusieurs mois/i }));
}

async function cliquerHorsDialogue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerId: 1, isPrimary: true });
}

describe("ReporterChargeDialog — apercu sans appel reseau (point le plus important de la story)", () => {
  it("plage 'depuis ce mois' : decompte les 5 mois (0..4) et liste les 2 mois deja saisis pour CE poste uniquement", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ReporterChargeDialog {...defaultProps} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");
    await user.click(screen.getByRole("button", { name: "Voir l'aperçu" }));

    expect(await screen.findByText(/5 mois concernés/i)).toBeInTheDocument();
    expect(screen.getByText(/2 mois seront écrasés/i)).toBeInTheDocument();
    // Poste-2 (mois 1) ne doit jamais apparaitre dans l'ecrasement de poste-1.
    expect(screen.queryByText(/999 999/)).not.toBeInTheDocument();
  });

  it("aucun ecrasement : message explicite (pas une absence de message)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ReporterChargeDialog {...defaultProps} moisCourant={3} horizonMois={5} charges={[]} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");
    await user.click(screen.getByRole("button", { name: "Voir l'aperçu" }));

    expect(await screen.findByText(/Aucun mois existant ne sera écrasé/i)).toBeInTheDocument();
  });

  it("plage 'tous les mois du plan' : repart de 0, pas du mois courant", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ReporterChargeDialog {...defaultProps} moisCourant={3} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Tous les mois du plan"));

    await user.click(screen.getByRole("button", { name: "Voir l'aperçu" }));

    expect(await screen.findByText(/5 mois concernés/i)).toBeInTheDocument();
  });

  it("confirmer envoie le montant et les bornes calculees, puis notifie le parent", async () => {
    const user = userEvent.setup({ delay: null });
    mockPost.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: "c1", scenarioId: "s1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: 500000, siteId: "site-1" }],
      },
    });
    const onReported = vi.fn();
    render(<ReporterChargeDialog {...defaultProps} moisCourant={0} onReported={onReported} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");
    await user.click(screen.getByRole("button", { name: "Voir l'aperçu" }));
    await screen.findByText(/mois concernés/i);
    await user.click(screen.getByRole("button", { name: "Appliquer" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/previsions/postes/poste-1/charges/reporter", {
        montantFCFA: 500000,
        moisDebutAbsolu: 0,
        moisFinAbsolu: 4,
      });
    });
    expect(onReported).toHaveBeenCalledWith([
      { id: "c1", scenarioId: "s1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: 500000, siteId: "site-1" },
    ]);
  });

  it("horizon indisponible (erreurProjection non nul) : le bouton d'apercu est desactive avec un message explicite", () => {
    render(<ReporterChargeDialog {...defaultProps} erreurProjection="Erreur de calcul" />);

    openDialog();
    expect(screen.getByText(/Horizon du plan indisponible/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir l'aperçu" })).toBeDisabled();
  });
});

describe("ReporterChargeDialog — cycle de vie du dialogue (patron PR2ter.2)", () => {
  it("ouvrir -> saisir -> Annuler -> rouvrir : le champ montant est vide", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ReporterChargeDialog {...defaultProps} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");
    expect((screen.getByLabelText(/Montant/i) as HTMLInputElement).value).toBe("500000");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/Montant/i) as HTMLInputElement).value).toBe("");
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(<ReporterChargeDialog {...defaultProps} />);

    openDialog();
    expect(screen.getByLabelText(/Montant/i)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/Montant/i)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ReporterChargeDialog {...defaultProps} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/Montant/i) as HTMLInputElement).value).toBe("500000");
  });
});
