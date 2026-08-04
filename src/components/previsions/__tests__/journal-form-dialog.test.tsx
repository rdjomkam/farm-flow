// @vitest-environment jsdom
/**
 * Tests — JournalFormDialog (Sprint PR2-ter, story PR2ter.2, Bug A / Bug B)
 *
 * Composant : src/components/previsions/journal-form-dialog.tsx
 * Aucun test dedie n'existait avant PR2ter.2 (pre-analyse section 6).
 *
 * Bug B ETAIT AGGRAVE sur ce dialogue (pre-analyse section 2) : AUCUN reset
 * n'existait meme apres un succes. Ce dialogue a aussi un mode edition
 * (`existant`) : le reset doit restaurer les valeurs de l'entite, jamais un
 * formulaire vide — et, en edition, restaurer les valeurs FRAICHES issues de
 * la reponse API (pas l'ancien prop `existant`, encore stale au moment du
 * reset synchrone).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalFormDialog } from "@/components/previsions/journal-form-dialog";
import { CategorieJournalPrevu } from "@/types";
import type { JournalDepensePrevueDTO } from "@/components/previsions/api-types";
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
const mockPut = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: mockPut, get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

const existant: JournalDepensePrevueDTO = {
  id: "j1",
  scenarioId: "s1",
  date: "2026-09-01T00:00:00.000Z",
  libelle: "Facture electricite",
  categorie: CategorieJournalPrevu.OPERATIONNEL,
  montantFCFA: 25000,
  vaguePrevueId: null,
  siteId: "site-1",
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
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

describe("JournalFormDialog — mode creation — Bug B aggrave (aucun reset n'existait, meme au succes)", () => {
  it("ouvrir -> saisir -> Annuler -> rouvrir : les champs sont vides", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Depense test");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
  });

  it("soumission reussie : reinitialise le formulaire (Bug B aggrave — aucun reset n'existait avant PR2ter.2, meme au succes)", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: { ...existant, id: "j2", libelle: "Depense test" },
    });
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        onSaved={onSaved}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    await fillField(user, screen.getByLabelText(/^Date/), "2026-09-01");
    await fillField(user, screen.getByLabelText(/^Libellé/), "Depense test");

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Date/) as HTMLInputElement).value).toBe("");
  });
});

describe("JournalFormDialog — mode edition — le reset restaure l'entite, jamais un formulaire vide", () => {
  it("ouvrir -> modifier le libelle -> Annuler -> rouvrir : le libelle redevient celui de `existant`", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        existant={existant}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    const libelleInput = screen.getByLabelText(/^Libellé/) as HTMLInputElement;
    expect(libelleInput.value).toBe("Facture electricite");
    await user.clear(libelleInput);
    await fillField(user, libelleInput, "Valeur abandonnee");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Facture electricite");
  });

  it("soumission reussie : restaure les valeurs FRAICHES de la reponse API, pas l'ancien `existant` (encore stale au moment du reset)", async () => {
    mockPut.mockResolvedValueOnce({
      ok: true,
      data: { ...existant, libelle: "Facture electricite (revisee)", montantFCFA: 30000 },
    });
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        existant={existant}
        onSaved={onSaved}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    const libelleInput = screen.getByLabelText(/^Libellé/) as HTMLInputElement;
    await user.clear(libelleInput);
    await fillField(user, libelleInput, "Facture electricite (revisee)");
    const montantInput = screen.getByLabelText(/Montant/i) as HTMLInputElement;
    await user.clear(montantInput);
    await fillField(user, montantInput, "30000");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    // Reouverture : le composant reste monte (meme `existant` prop, pas
    // encore rafraichi par le parent dans ce test) — il doit malgre tout
    // afficher les valeurs FRAICHEMENT enregistrees, pas revenir a
    // "Facture electricite" / 25000 (l'ancien `existant`).
    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe(
      "Facture electricite (revisee)"
    );
    expect((screen.getByLabelText(/Montant/i) as HTMLInputElement).value).toBe("30000");
  });
});

describe("JournalFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Depense test");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Depense test");
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <JournalFormDialog
        scenarioId="s1"
        vaguesPrevues={[]}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Depense test");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Depense test");
  });
});
