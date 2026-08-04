// @vitest-environment jsdom
/**
 * Tests — ApportFormDialog (Sprint PR2-ter, story PR2ter.2, Bug A / Bug B)
 *
 * Composant : src/components/previsions/apport-form-dialog.tsx
 * Aucun test dedie n'existait avant PR2ter.2 (pre-analyse section 6).
 * Bug B (avant fix) : le Select `type` n'etait jamais reinitialise.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApportFormDialog } from "@/components/previsions/apport-form-dialog";
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
  fireEvent.click(screen.getByRole("button", { name: /nouvel apport/i }));
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

describe("ApportFormDialog — Bug B : reinitialisation de tous les champs, y compris le type", () => {
  it("ouvrir -> saisir -> changer le type -> Annuler -> rouvrir : tous les champs sont reinitialises", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ApportFormDialog scenarioId="s1" onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Date/), "2026-09-01");
    await fillField(user, screen.getByLabelText(/^Libellé/), "Apport initial");
    await fillField(user, screen.getByLabelText(/Montant/i), "500000");
    await selectType(user, "Crédit encaissé");
    expect(screen.getByRole("combobox")).toHaveTextContent("Crédit encaissé");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/^Date/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Montant/i) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("combobox")).toHaveTextContent("Capital propre");
  });

  it("soumission reussie : reinitialise aussi le type", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "ap1" } });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ApportFormDialog scenarioId="s1" onCreated={onCreated} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Date/), "2026-09-01");
    await fillField(user, screen.getByLabelText(/^Libellé/), "Apport initial");
    await selectType(user, "Crédit encaissé");

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    openDialog();
    expect(screen.getByRole("combobox")).toHaveTextContent("Capital propre");
  });
});

describe("ApportFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ApportFormDialog scenarioId="s1" onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ApportFormDialog scenarioId="s1" onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Apport initial");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Apport initial");
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(<ApportFormDialog scenarioId="s1" onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ApportFormDialog scenarioId="s1" onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Apport initial");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Apport initial");
  });
});
