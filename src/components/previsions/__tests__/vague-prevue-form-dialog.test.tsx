// @vitest-environment jsdom
/**
 * Tests — VaguePrevueFormDialog (Sprint PR2-ter, story PR2ter.2, Bug A / Bug B)
 *
 * Composant : src/components/previsions/vague-prevue-form-dialog.tsx
 * Aucun test dedie n'existait avant PR2ter.2 (pre-analyse section 6).
 *
 * Particularite de ce dialogue : le champ `code` est PRE-REMPLI depuis
 * `codeSuggere` (pas un formulaire vierge) — le reset doit restaurer cette
 * valeur suggeree, pas une chaine vide (pre-analyse point 1).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaguePrevueFormDialog } from "@/components/previsions/vague-prevue-form-dialog";
import { StatutVaguePrevue } from "@/types";
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
  fireEvent.click(screen.getByRole("button", { name: /nouvelle vague planifiée/i }));
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

describe("VaguePrevueFormDialog — Bug B : reinitialisation restaure `codeSuggere`, pas une chaine vide", () => {
  it("ouvrir -> modifier le code -> Annuler -> rouvrir : le code redevient codeSuggere", async () => {
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);

    openDialog();
    const codeInput = screen.getByLabelText(/^Code/) as HTMLInputElement;
    expect(codeInput.value).toBe("V8");
    await user.clear(codeInput);
    await fillField(user, codeInput, "V8-EDITE");
    expect(codeInput.value).toBe("V8-EDITE");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe("V8");
  });

  it("soumission reussie : le code redevient codeSuggere (pas vide)", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "vp1", code: "V8-EDITE" } });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={onCreated} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Date de stockage/i), "2026-09-01");
    await fillField(user, screen.getByLabelText(/Effectif d'alevins/i), "5000");

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    openDialog();
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe("V8");
  });
});

/**
 * Story PR2oct.4 — drapeau `alevinsAchetes` (ADR-053 §14 / ERR-170).
 *
 * Preremplissage : CREATION reprend `alevinsAchetesParDefaut` (le defaut du
 * scenario, fourni par le parent) ; EDITION reprend TOUJOURS
 * `existant.alevinsAchetes`, jamais le defaut du scenario (qui a pu changer
 * depuis la creation de cette vague precise) — cf. commentaire du composant,
 * lignes 81-86.
 */
describe("VaguePrevueFormDialog — drapeau alevinsAchetes (ADR-053 §14)", () => {
  it("la case a cocher est presente et decochee par defaut quand alevinsAchetesParDefaut n'est pas fourni", () => {
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);
    openDialog();

    const checkbox = screen.getByRole("checkbox", { name: /Alevins achetés/i }) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it("creation : la case est pre-remplie a `true` quand alevinsAchetesParDefaut du scenario vaut true", () => {
    render(
      <VaguePrevueFormDialog
        scenarioId="s1"
        codeSuggere="V8"
        alevinsAchetesParDefaut
        onCreated={vi.fn()}
      />
    );
    openDialog();

    const checkbox = screen.getByRole("checkbox", { name: /Alevins achetés/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("est cochable/decochable par l'utilisateur, independamment de la valeur par defaut", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" alevinsAchetesParDefaut onCreated={vi.fn()} />
    );
    openDialog();

    const checkbox = screen.getByRole("checkbox", { name: /Alevins achetés/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("la valeur cochee part bien dans le payload de creation (POST)", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "vp1", code: "V8" } });
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);
    openDialog();

    await fillField(user, screen.getByLabelText(/Date de stockage/i), "2026-09-01");
    await fillField(user, screen.getByLabelText(/Effectif d'alevins/i), "5000");
    await user.click(screen.getByRole("checkbox", { name: /Alevins achetés/i }));

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/previsions/scenarios/s1/vagues",
        expect.objectContaining({ alevinsAchetes: true })
      )
    );
  });

  it("la valeur decochee part aussi explicitement dans le payload (false, pas absente)", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "vp1", code: "V8" } });
    const user = userEvent.setup({ delay: null });
    render(
      <VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" alevinsAchetesParDefaut onCreated={vi.fn()} />
    );
    openDialog();

    await fillField(user, screen.getByLabelText(/Date de stockage/i), "2026-09-01");
    await fillField(user, screen.getByLabelText(/Effectif d'alevins/i), "5000");
    // Decoche le defaut pre-rempli a true.
    await user.click(screen.getByRole("checkbox", { name: /Alevins achetés/i }));

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/previsions/scenarios/s1/vagues",
        expect.objectContaining({ alevinsAchetes: false })
      )
    );
  });

  it("edition : la case reprend `existant.alevinsAchetes`, jamais le defaut du scenario meme s'ils divergent", () => {
    const existant = {
      id: "vp1",
      scenarioId: "s1",
      code: "V3",
      dateStockagePrevue: "2026-09-01T00:00:00.000Z",
      effectifAlevinsPrevu: 5000,
      poidsMoyenInitialG: 5,
      dureeCycleMoisFigee: 7,
      statut: StatutVaguePrevue.PLANIFIEE,
      vaguePrevueParentId: null,
      siteId: "site-1",
      alevinsAchetes: true,
    };
    // Le defaut du scenario est FALSE, la vague existante est TRUE : l'edition
    // doit refleter la vague, pas le defaut du scenario.
    render(
      <VaguePrevueFormDialog
        scenarioId="s1"
        codeSuggere="V3"
        existant={existant}
        alevinsAchetesParDefaut={false}
        trigger={<button type="button">Modifier</button>}
        onUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    const checkbox = screen.getByRole("checkbox", { name: /Alevins achetés/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("Annuler apres avoir touche la case restaure la valeur d'origine (`existant.alevinsAchetes`) a la reouverture", async () => {
    const existant = {
      id: "vp1",
      scenarioId: "s1",
      code: "V3",
      dateStockagePrevue: "2026-09-01T00:00:00.000Z",
      effectifAlevinsPrevu: 5000,
      poidsMoyenInitialG: 5,
      dureeCycleMoisFigee: 7,
      statut: StatutVaguePrevue.PLANIFIEE,
      vaguePrevueParentId: null,
      siteId: "site-1",
      alevinsAchetes: false,
    };
    const user = userEvent.setup({ delay: null });
    render(
      <VaguePrevueFormDialog
        scenarioId="s1"
        codeSuggere="V3"
        existant={existant}
        trigger={<button type="button">Modifier</button>}
        onUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    const checkboxAvant = screen.getByRole("checkbox", { name: /Alevins achetés/i }) as HTMLInputElement;
    expect(checkboxAvant.checked).toBe(false);
    await user.click(checkboxAvant);
    expect(checkboxAvant.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const checkboxApres = screen.getByRole("checkbox", { name: /Alevins achetés/i }) as HTMLInputElement;
    expect(checkboxApres.checked).toBe(false);
  });
});

describe("VaguePrevueFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Code/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Effectif d'alevins/i), "5000");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/Effectif d'alevins/i) as HTMLInputElement).value).toBe("5000");
  });

  it("le bouton Annuler reste fonctionnel meme apres une saisie", async () => {
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Effectif d'alevins/i), "5000");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Code/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<VaguePrevueFormDialog scenarioId="s1" codeSuggere="V8" onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/Effectif d'alevins/i), "5000");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/Effectif d'alevins/i) as HTMLInputElement).value).toBe("5000");
  });
});
