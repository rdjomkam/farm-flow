// @vitest-environment jsdom
/**
 * Tests — ScissionDialog (Sprint PR2, story PR2.3, ADR-053 décision 2)
 *
 * Composant : src/components/previsions/scission-dialog.tsx
 *
 * Couverture :
 * 1. Minimum 2 lignes filles imposé : pré-rempli à 2 par défaut, le bouton
 *    de suppression n'apparaît pas tant qu'il n'y a que 2 lignes (ne peut pas
 *    descendre sous 2)
 * 2. Champs requis par ligne : code, date de stockage, effectif — le bouton
 *    de confirmation reste désactivé tant qu'une ligne est incomplète
 * 3. Ajout d'une 3e ligne fait apparaître le bouton de suppression sur
 *    toutes les lignes
 * 4. Soumission : construit le payload attendu par l'API (scissions[])
 * 5. Fully-controlled sans DialogTrigger — accessibilité malgré l'absence
 *    de trigger (le contenu du dialog est bien accessible/focus dès l'ouverture)
 * 6. parent === null ne rend rien (pas de crash)
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScissionDialog } from "@/components/previsions/scission-dialog";
import type { VaguePrevueListItemDTO } from "@/components/previsions/api-types";
import { StatutVaguePrevue } from "@/types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";

const mockPost = vi.fn();

vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, get: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

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

const parent: VaguePrevueListItemDTO = {
  id: "vp-7",
  scenarioId: "scenario-1",
  code: "V7",
  dateStockagePrevue: "2026-09-01T00:00:00.000Z",
  effectifAlevinsPrevu: 5000,
  poidsMoyenInitialG: 5,
  dureeCycleMoisFigee: 7,
  statut: StatutVaguePrevue.PLANIFIEE,
  vaguePrevueParentId: null,
  siteId: "site-1",
  alevinsAchetes: false,
};

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

/**
 * Simule un clic hors du dialogue (voir scenario-form-dialog.test.tsx pour le
 * detail du piege jsdom : Radix `DismissableLayer` n'attache son listener
 * natif `pointerdown` qu'apres un `setTimeout(fn, 0)`). Sans ce test, seul
 * Echap est verifie pour Bug A dans ce fichier — ce dialogue est
 * fully-controlled (pas de `DialogTrigger`) mais reste un vrai Radix Dialog
 * (`open` toujours `true`, controle par `parent`), donc le meme piege
 * s'applique.
 */
async function cliquerHorsDialogue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerId: 1, isPrimary: true });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 — Minimum 2 lignes filles
// ---------------------------------------------------------------------------

describe("ScissionDialog — minimum 2 lignes filles", () => {
  it("pré-remplit exactement 2 lignes filles par défaut, code suggéré {parent}a/{parent}b", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    expect(screen.getByDisplayValue("V7a")).toBeInTheDocument();
    expect(screen.getByDisplayValue("V7b")).toBeInTheDocument();
    expect(screen.getAllByText(/Vague fille/)).toHaveLength(2);
  });

  it("ne propose pas de bouton de suppression quand il n'y a que 2 lignes (garde le minimum)", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    expect(screen.queryByLabelText(/Supprimer la vague fille/)).not.toBeInTheDocument();
  });

  it("répartit l'effectif moitié-moitié par défaut", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    const effectifInputs = screen.getAllByLabelText(/Effectif d'alevins/) as HTMLInputElement[];
    expect(effectifInputs[0].value).toBe("2500");
    expect(effectifInputs[1].value).toBe("2500");
  });

  it("répartit correctement un effectif impair (moitié + reste, aucune perte d'alevin)", () => {
    const parentImpair = { ...parent, effectifAlevinsPrevu: 5001 };
    render(<ScissionDialog parent={parentImpair} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    const effectifInputs = screen.getAllByLabelText(/Effectif d'alevins/) as HTMLInputElement[];
    const total = Number(effectifInputs[0].value) + Number(effectifInputs[1].value);
    expect(total).toBe(5001);
  });

  it("ajouter une ligne fait apparaître les 3 boutons de suppression (n>2)", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une vague fille/i }));

    expect(screen.getAllByText(/Vague fille/)).toHaveLength(3);
    expect(screen.getAllByLabelText(/Supprimer la vague fille/)).toHaveLength(3);
  });

  it("supprimer une ligne quand il y en a 3 revient à 2, et fait disparaître les boutons de suppression", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une vague fille/i }));
    expect(screen.getAllByText(/Vague fille/)).toHaveLength(3);

    fireEvent.click(screen.getByLabelText("Supprimer la vague fille 3"));

    expect(screen.getAllByText(/Vague fille/)).toHaveLength(2);
    expect(screen.queryByLabelText(/Supprimer la vague fille/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Champs requis / bouton de confirmation
// ---------------------------------------------------------------------------

describe("ScissionDialog — validation des champs requis avant soumission", () => {
  it("le bouton de confirmation est actif par défaut (2 lignes valides pré-remplies)", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Confirmer la scission" })).not.toBeDisabled();
  });

  it("vider le code d'une ligne désactive le bouton de confirmation", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    const codeInputs = screen.getAllByLabelText(/^Code/) as HTMLInputElement[];
    fireEvent.change(codeInputs[0], { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Confirmer la scission" })).toBeDisabled();
  });

  it("mettre l'effectif d'une ligne à 0 désactive le bouton de confirmation", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    const effectifInputs = screen.getAllByLabelText(/Effectif d'alevins/) as HTMLInputElement[];
    fireEvent.change(effectifInputs[0], { target: { value: "0" } });

    expect(screen.getByRole("button", { name: "Confirmer la scission" })).toBeDisabled();
  });

  it("vider la date de stockage d'une ligne désactive le bouton de confirmation", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    const dateInputs = screen.getAllByLabelText(/Date de stockage/) as HTMLInputElement[];
    fireEvent.change(dateInputs[0], { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Confirmer la scission" })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Soumission : payload envoyé à l'API
// ---------------------------------------------------------------------------

describe("ScissionDialog — soumission", () => {
  it("appelle POST .../scinder avec un tableau de 2 scissions par défaut", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: [{ id: "vp-7a" }, { id: "vp-7b" }] });
    const onScinde = vi.fn();

    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={onScinde} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmer la scission" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/previsions/vagues-prevues/vp-7/scinder",
        expect.objectContaining({
          scissions: expect.arrayContaining([
            expect.objectContaining({ code: "V7a", effectifAlevinsPrevu: 2500 }),
            expect.objectContaining({ code: "V7b", effectifAlevinsPrevu: 2500 }),
          ]),
        })
      );
    });

    const payload = mockPost.mock.calls[0][1] as { scissions: unknown[] };
    expect(payload.scissions).toHaveLength(2);

    await waitFor(() => {
      expect(onScinde).toHaveBeenCalledWith(
        [{ id: "vp-7a" }, { id: "vp-7b" }],
        "vp-7"
      );
    });
  });

  it("n'appelle pas onScinde si l'API échoue", async () => {
    mockPost.mockResolvedValueOnce({ ok: false, data: null });
    const onScinde = vi.fn();

    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={onScinde} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmer la scission" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    expect(onScinde).not.toHaveBeenCalled();
  });

  it("le total réparti indicatif est affiché et n'empêche pas la soumission même s'il diverge de l'effectif du parent", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: [] });

    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    const effectifInputs = screen.getAllByLabelText(/Effectif d'alevins/) as HTMLInputElement[];
    fireEvent.change(effectifInputs[0], { target: { value: "100" } });

    // Le total ne correspond plus (2600 != 5000) mais l'indicateur reste informatif
    expect(screen.getByText(/L&apos;API n&apos;exige pas|N'exige pas|n'exige pas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer la scission" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmer la scission" }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Fully-controlled, sans DialogTrigger
// ---------------------------------------------------------------------------

describe("ScissionDialog — dialog fully-controlled sans DialogTrigger", () => {
  it("s'affiche directement au montage quand parent est non-null (pas de trigger nécessaire)", () => {
    render(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    expect(screen.getByText("Scinder V7")).toBeInTheDocument();
    // Le contenu est bien accessible/focusable malgré l'absence de DialogTrigger
    expect(screen.getByRole("button", { name: "Confirmer la scission" })).toBeInTheDocument();
  });

  it("ne rend rien quand parent est null (pas de crash)", () => {
    const { container } = render(
      <ScissionDialog parent={null} onOpenChange={vi.fn()} onScinde={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("le bouton Annuler appelle onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<ScissionDialog parent={parent} onOpenChange={onOpenChange} onScinde={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("re-initialise les lignes quand une nouvelle VaguePrevue devient la cible (changement de parent)", () => {
    const { rerender } = render(
      <ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />
    );
    expect(screen.getByDisplayValue("V7a")).toBeInTheDocument();

    const autreParent: VaguePrevueListItemDTO = { ...parent, id: "vp-9", code: "V9", effectifAlevinsPrevu: 8000 };
    rerender(<ScissionDialog parent={autreParent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    expect(screen.getByDisplayValue("V9a")).toBeInTheDocument();
    expect(screen.getByDisplayValue("V9b")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("V7a")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Bug B variante (PR2ter.2) : reouverture de la MEME cible apres
// un Annuler ne reaffichait jamais les valeurs par defaut (seul un
// CHANGEMENT de cible reinitialisait les lignes avant le fix).
// ---------------------------------------------------------------------------

describe("ScissionDialog — Bug B variante (PR2ter.2) : reouverture de la MEME cible apres fermeture", () => {
  it("fermer (parent -> null) puis rouvrir la MEME cible reinitialise les lignes abandonnees", () => {
    const { rerender } = render(
      <ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />
    );

    const codeInputs = screen.getAllByLabelText(/^Code/) as HTMLInputElement[];
    fireEvent.change(codeInputs[0], { target: { value: "V7-EDITE" } });
    expect(screen.getByDisplayValue("V7-EDITE")).toBeInTheDocument();

    // Fermeture : le parent (plan-vagues-tab.tsx) passe `parent` a null.
    rerender(<ScissionDialog parent={null} onOpenChange={vi.fn()} onScinde={vi.fn()} />);
    expect(screen.queryByDisplayValue("V7-EDITE")).not.toBeInTheDocument();

    // Reouverture de la MEME cible (meme `id`, avant le fix : la condition
    // de reset ne se redeclenchait que sur un CHANGEMENT de cible).
    rerender(<ScissionDialog parent={parent} onOpenChange={vi.fn()} onScinde={vi.fn()} />);

    expect(screen.getByDisplayValue("V7a")).toBeInTheDocument();
    expect(screen.getByDisplayValue("V7b")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("V7-EDITE")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Bug A (PR2ter.2) : garde de fermeture quand des lignes sont
// touchees.
// ---------------------------------------------------------------------------

describe("ScissionDialog — Bug A : garde de fermeture quand les lignes sont touchees", () => {
  it("un dialogue non touche se ferme normalement par Echap (onOpenChange(false) appele)", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    render(<ScissionDialog parent={parent} onOpenChange={onOpenChange} onScinde={vi.fn()} />);

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("apres une modification d'une ligne, Echap n'appelle PAS onOpenChange (perte silencieuse bloquee)", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    render(<ScissionDialog parent={parent} onOpenChange={onOpenChange} onScinde={vi.fn()} />);

    const codeInputs = screen.getAllByLabelText(/^Code/) as HTMLInputElement[];
    fireEvent.change(codeInputs[0], { target: { value: "V7-EDITE" } });

    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("le bouton Annuler reste fonctionnel meme apres une modification", () => {
    const onOpenChange = vi.fn();
    render(<ScissionDialog parent={parent} onOpenChange={onOpenChange} onScinde={vi.fn()} />);

    const codeInputs = screen.getAllByLabelText(/^Code/) as HTMLInputElement[];
    fireEvent.change(codeInputs[0], { target: { value: "V7-EDITE" } });

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("un dialogue non touche se ferme normalement au clic exterieur", async () => {
    const onOpenChange = vi.fn();
    render(<ScissionDialog parent={parent} onOpenChange={onOpenChange} onScinde={vi.fn()} />);

    await cliquerHorsDialogue();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("apres une modification d'une ligne, un clic exterieur n'appelle PAS onOpenChange", async () => {
    const onOpenChange = vi.fn();
    render(<ScissionDialog parent={parent} onOpenChange={onOpenChange} onScinde={vi.fn()} />);

    const codeInputs = screen.getAllByLabelText(/^Code/) as HTMLInputElement[];
    fireEvent.change(codeInputs[0], { target: { value: "V7-EDITE" } });

    await cliquerHorsDialogue();

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
