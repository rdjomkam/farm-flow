// @vitest-environment jsdom
/**
 * Tests — PosteFormDialog (Sprint PR2-ter, story PR2ter.2, Bug A / Bug B)
 *
 * Composant : src/components/previsions/poste-form-dialog.tsx
 * Aucun test dedie n'existait avant PR2ter.2 (pre-analyse section 6).
 * Bug B (avant fix) : le Select `type` n'etait jamais reinitialise, meme au
 * succes (seul `libelle` l'etait).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PosteFormDialog } from "@/components/previsions/poste-form-dialog";
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

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /nouveau poste/i }));
}

async function selectType(user: ReturnType<typeof userEvent.setup>, label: string) {
  const trigger = screen.getByRole("combobox");
  await user.click(trigger);
  const option = await screen.findByRole("option", { name: label });
  await user.click(option);
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

describe("PosteFormDialog — Bug B : reinitialisation du libelle ET du type (le Select n'etait jamais reset avant PR2ter.2)", () => {
  it("ouvrir -> saisir -> changer le type -> Annuler -> rouvrir : libelle vide, type revenu a la valeur par defaut", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Carburant");
    await selectType(user, "Logistique");
    expect(screen.getByRole("combobox")).toHaveTextContent("Logistique");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("combobox")).toHaveTextContent("Charge d'exploitation");
  });

  it("soumission reussie : reinitialise aussi le type (pas seulement le libelle)", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "p1", libelle: "Carburant", type: "LOGISTIQUE" } });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={onCreated} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Carburant");
    await selectType(user, "Logistique");

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("combobox")).toHaveTextContent("Charge d'exploitation");
  });
});

describe("PosteFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Carburant");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Carburant");
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Carburant");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Carburant");
  });
});
