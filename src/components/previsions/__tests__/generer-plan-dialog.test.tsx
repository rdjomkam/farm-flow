// @vitest-environment jsdom
/**
 * Tests — GenererPlanDialog (Sprint PR2-ter, story PR2ter.2)
 *
 * Composant : src/components/previsions/generer-plan-dialog.tsx
 * Aucun test dedie n'existait avant PR2ter.2 (pre-analyse section 6).
 *
 * Ce dialogue est le PATRON DE REFERENCE pour Bug B (`if (!next) reset()`
 * deja present avant PR2ter.2) — ce test documente/verifie sa non-regression,
 * ce n'est pas un fix. Bug A (garde clic exterieur/Echap) etait absent et
 * est ajoute ici par cohesion (pre-analyse section 2, impact pratique
 * faible : 1-2 champs, aucune ecriture avant confirmation).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenererPlanDialog } from "@/components/previsions/generer-plan-dialog";
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

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const value = deepGet(DICTIONARIES[namespace], key);
    return typeof value === "string" ? value : key;
  },
}));

const mockGet = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: vi.fn(), put: vi.fn(), get: mockGet, patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /générer un plan/i }));
}

/**
 * Simule un clic hors du dialogue (voir scenario-form-dialog.test.tsx pour le
 * detail du piege jsdom : Radix `DismissableLayer` n'attache son listener
 * natif `pointerdown` qu'apres un `setTimeout(fn, 0)`). Sans ce test, seul
 * Echap est verifie pour Bug A dans ce fichier.
 */
async function cliquerHorsDialogue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerId: 1, isPrimary: true });
}

describe("GenererPlanDialog — Bug B (patron de reference, non-regression)", () => {
  it("ouvrir -> saisir l'horizon -> Annuler -> rouvrir : le champ horizon est vide", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GenererPlanDialog scenarioId="s1" onGenerated={vi.fn()} />);

    openDialog();
    const horizonInput = screen.getByLabelText(/Horizon/i) as HTMLInputElement;
    await fillField(user, horizonInput, "21");
    expect(horizonInput.value).toBe("21");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/Horizon/i) as HTMLInputElement).value).toBe("");
  });
});

describe("GenererPlanDialog — Bug A : garde ajoutee par cohesion (impact pratique faible)", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GenererPlanDialog scenarioId="s1" onGenerated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/Horizon/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/Horizon/i)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie de l'horizon, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GenererPlanDialog scenarioId="s1" onGenerated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Horizon/i), "21");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/Horizon/i) as HTMLInputElement).value).toBe("21");
  });

  it("le bouton Annuler reste fonctionnel meme apres une saisie", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GenererPlanDialog scenarioId="s1" onGenerated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Horizon/i), "21");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/Horizon/i)).not.toBeInTheDocument();
    });
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(<GenererPlanDialog scenarioId="s1" onGenerated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/Horizon/i)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/Horizon/i)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie de l'horizon, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GenererPlanDialog scenarioId="s1" onGenerated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Horizon/i), "21");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/Horizon/i) as HTMLInputElement).value).toBe("21");
  });
});
