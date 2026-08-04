// @vitest-environment jsdom
/**
 * Tests — ScenarioFormDialog (story PR2bis.3, fix ERR-141/ERR-142 ; etendu
 * story PR2ter.2 — Bug A / Bug B cycle de vie du dialogue)
 *
 * Composant : src/components/previsions/scenario-form-dialog.tsx
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioFormDialog } from "@/components/previsions/scenario-form-dialog";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";
import { fillField } from "./test-utils";

/**
 * Mock `next-intl` en resolvant reellement les cles dans les fichiers de
 * messages fr (plutot que de renvoyer la cle brute) : ce composant affiche
 * desormais du texte francais reel (Story PR2bis.1), et ce test asserte sur
 * ce texte (nom du bouton, contenu de l'aide contextuelle).
 */
const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
  // `src/components/ui/dialog.tsx` (croix de fermeture) appelle
  // `useTranslations("common.buttons")`, un namespace imbrique distinct de
  // "common" pour ce mock a resolution reelle des cles.
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

// Radix Dialog (`DismissableLayer`) ecoute `pointerdown` sur `document` —
// jsdom n'implemente que partiellement `PointerEvent`/`hasPointerCapture`,
// meme piege que documente pour Radix Select (rattacher-vague-dialog.test.tsx).
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  vi.clearAllMocks();
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /nouveau scénario/i }));
}

/**
 * Simule un clic hors du dialogue, en tenant compte d'un piege jsdom precis
 * (pre-analyse PR2ter.2 section 5) : Radix (`usePointerDownOutside`,
 * `@radix-ui/react-dismissable-layer`) n'attache son listener natif
 * `pointerdown` sur `document` qu'apres un `window.setTimeout(fn, 0)` — pas
 * synchronement au montage. Sans laisser ce delai s'ecouler, l'evenement
 * dispatche ici arrive AVANT que Radix n'ecoute, et le clic exterieur ne
 * produit alors aucun effet observable, quel que soit le code applicatif
 * (faux negatif de test, pas une preuve d'absence de bug). Verifie
 * experimentalement : sans ce `await`, le dialogue reste ouvert meme pour un
 * clic exterieur sur un formulaire vierge qui DEVRAIT se fermer.
 */
async function cliquerHorsDialogue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerId: 1, isPrimary: true });
}

describe("ScenarioFormDialog — aide honnete sur la marge de securite alevins (post-fix ERR-141/ERR-142)", () => {
  it("affirme que la marge absorbe la mortalite en s'appliquant au nombre d'alevins a commander, jamais au calcul de besoin en aliment ou de revenu", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /nouveau scénario/i }));

    expect(screen.getByText(/absorbe la mortalité/i)).toBeInTheDocument();
    expect(screen.getByText(/alevins à commander/i)).toBeInTheDocument();
    expect(screen.queryByText(/pas encore appliqu[ée]e? au calcul/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Bug B (pre-analyse PR2ter.2 section 1) — reinitialisation a la fermeture
// ---------------------------------------------------------------------------

describe("ScenarioFormDialog — Bug B : reinitialisation a chaque fermeture (pas seulement au succes)", () => {
  it("ouvrir -> saisir -> Annuler -> rouvrir : les champs sont vides (pas de concatenation residuelle)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    const codeInput = screen.getByLabelText(/^Code/) as HTMLInputElement;
    await fillField(user, codeInput, "EXCEL-V12");
    expect(codeInput.value).toBe("EXCEL-V12");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    const codeInputReouvert = screen.getByLabelText(/^Code/) as HTMLInputElement;
    expect(codeInputReouvert.value).toBe("");
  });

  it("ouvrir -> Echap (dialogue vierge) -> rouvrir : les champs restent vides", async () => {
    // Le garde Bug A (section suivante) bloque volontairement Echap une fois
    // le formulaire touche — ce test verifie donc le reset via Echap sur un
    // dialogue encore vierge, complementaire au test Annuler ci-dessus qui
    // couvre deja le cas "apres saisie".
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Code/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });

    openDialog();
    const codeInputReouvert = screen.getByLabelText(/^Code/) as HTMLInputElement;
    expect(codeInputReouvert.value).toBe("");
  });

  it("ouvrir -> saisir -> fermer via la croix -> rouvrir : les champs sont vides", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    const codeInput = screen.getByLabelText(/^Code/) as HTMLInputElement;
    await fillField(user, codeInput, "EXCEL-V12");
    expect(codeInput.value).toBe("EXCEL-V12");

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });

    openDialog();
    const codeInputReouvert = screen.getByLabelText(/^Code/) as HTMLInputElement;
    expect(codeInputReouvert.value).toBe("");
  });

  it("soumission reussie : reinitialise aussi (deja couvert avant PR2ter.2, non-regression)", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "s1" } });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={onCreated} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Code/), "EXCEL-V12");
    await fillField(user, screen.getByLabelText(/^Nom(?!b)/), "Plan de reference Excel v12");
    await fillField(user, screen.getByLabelText(/Date de début/i), "2026-09-01");
    await fillField(user, screen.getByLabelText(/Effectif d.alevins par vague/i), "5000");
    await fillField(user, screen.getByLabelText(/Marge de sécurité/i), "10");
    await fillField(user, screen.getByLabelText(/Poids moyen initial/i), "5");
    await fillField(user, screen.getByLabelText(/Poids objectif/i), "1000");
    await fillField(user, screen.getByLabelText(/Prix alevin unitaire/i), "50");
    await fillField(user, screen.getByLabelText(/Prix de vente/i), "1500");
    await fillField(user, screen.getByLabelText(/Nombre de bacs/i), "4");
    await fillField(user, screen.getByLabelText(/Fréquence de stockage/i), "2");

    fireEvent.click(screen.getByRole("button", { name: "Créer le scénario" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    openDialog();
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Bug A (pre-analyse PR2ter.2 section 3) — garde sur clic exterieur/Echap
// ---------------------------------------------------------------------------

describe("ScenarioFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue encore vierge se ferme normalement au clic exterieur (aucune friction sur le cas nominal)", async () => {
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Code/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue (Bug A — perte silencieuse bloquee)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Code/), "EXCEL-V12");

    await cliquerHorsDialogue();

    // Le dialogue reste ouvert avec la saisie intacte : ni perte silencieuse
    // ni fermeture inattendue.
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe("EXCEL-V12");
  });

  it("un dialogue encore vierge se ferme normalement par Echap (aucune friction sur le cas nominal)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Code/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, Echap ne ferme PAS le dialogue (perte silencieuse bloquee)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Code/), "EXCEL-V12");

    await user.keyboard("{Escape}");

    // Le dialogue reste ouvert : le champ code est toujours present ET
    // conserve sa valeur (aucune perte de saisie).
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe("EXCEL-V12");
  });

  it("le bouton Annuler reste fonctionnel meme apres une saisie (le garde ne piege jamais l'utilisateur)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Code/), "EXCEL-V12");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });

  it("la croix de fermeture reste fonctionnelle meme apres une saisie", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Code/), "EXCEL-V12");

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    });
  });
});

