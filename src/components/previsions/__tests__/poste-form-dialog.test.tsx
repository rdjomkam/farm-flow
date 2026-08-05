// @vitest-environment jsdom
/**
 * Tests — PosteFormDialog, parcours a DEUX TEMPS (ADR-053 §16.6/§16.10/
 * §16.12, story A.5). REECRITURE COMPLETE (story A.5) : le champ texte
 * unique historique (Sprint PR2-ter) est remplace par deux onglets
 * Rechercher/Creer + une etape 2 commune (libelle/type), qui n'apparait
 * qu'apres une selection (onglet Rechercher) ou une saisie (onglet Creer).
 *
 * Composant : src/components/previsions/poste-form-dialog.tsx
 *
 * Couvre :
 * - rendu des deux onglets, etape 2 masquee tant qu'aucun choix n'est fait ;
 * - onglet Rechercher : GET au montage, filtrage local, selection ->
 *   pre-remplissage du libelle (editable ensuite), payload
 *   `posteReferentielId` a la soumission ;
 * - onglet Creer : saisie -> etape 2 visible, payload
 *   `nouveauPosteReferentielLibelle` a la soumission ;
 * - 409 POSTE_REFERENTIEL_CODE_COLLISION : message + bouton "Lier celle-ci"
 *   qui bascule sur l'onglet Rechercher avec l'entree deja selectionnee,
 *   permettant une resoumission reussie sans round-trip supplementaire ;
 * - 409 POSTE_REFERENTIEL_INACTIF (branche creer) + lien vers l'ecran
 *   d'administration ;
 * - Bug A (garde de fermeture) / Bug B (reset complet libelle + type),
 *   adaptes au nouveau parcours (l'etape 2 n'est atteignable qu'en passant
 *   par l'onglet Creer, plus rapide a piloter dans un test que la recherche).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const value = deepGet(DICTIONARIES[namespace], key);
    if (typeof value !== "string") return key;
    if (!values) return value;
    return Object.entries(values).reduce(
      (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
      value
    );
  },
}));

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: vi.fn(), get: mockGet, patch: vi.fn(), del: vi.fn() }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const REFERENTIEL_SALAIRES = { id: "ref-1", siteId: "s1", code: "salaires", libelle: "Salaires", actif: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ ok: true, data: { data: [REFERENTIEL_SALAIRES] } });
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

/** Ouvre le dialogue, bascule sur l'onglet "Creer", saisit le libelle de creation (fait apparaitre l'etape 2). */
async function ouvrirEtCreer(user: ReturnType<typeof userEvent.setup>, libelle: string) {
  openDialog();
  await user.click(screen.getByRole("tab", { name: "Créer une nouvelle entrée" }));
  await fillField(user, screen.getByLabelText(/^Libellé de la nouvelle entrée/), libelle);
}

/**
 * Simule un clic hors du dialogue (voir scenario-form-dialog.test.tsx pour le
 * detail du piege jsdom : Radix `DismissableLayer` n'attache son listener
 * natif `pointerdown` qu'apres un `setTimeout(fn, 0)`).
 */
async function cliquerHorsDialogue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerId: 1, isPrimary: true });
}

describe("PosteFormDialog — parcours a deux temps (etape 2 masquee par defaut)", () => {
  it("affiche les deux onglets et masque l'etape 2 (libelle/type) tant qu'aucun choix n'est fait", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);
    openDialog();

    expect(screen.getByRole("tab", { name: "Rechercher dans le référentiel" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Créer une nouvelle entrée" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Libellé\*?$/)).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "Créer" });
    expect(submit).toBeDisabled();
  });

  it("declenche GET /api/previsions/postes-referentiel a l'ouverture (liste pour l'onglet Rechercher)", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);
    openDialog();
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/api/previsions/postes-referentiel", expect.anything()));
  });
});

describe("PosteFormDialog — onglet Rechercher (branche a, posteReferentielId)", () => {
  it("selectionner une entree pre-remplit le libelle scenario-local et rend l'etape 2 visible", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);
    openDialog();

    const entry = await screen.findByText("Salaires");
    fireEvent.click(entry);

    const libelleInput = (await screen.findByLabelText(/^Libellé\*?$/)) as HTMLInputElement;
    expect(libelleInput.value).toBe("Salaires");
  });

  it("soumission envoie posteReferentielId (jamais nouveauPosteReferentielLibelle)", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "p1",
        libelle: "Salaires",
        type: "CHARGE_EXPLOITATION",
        posteReferentielId: "ref-1",
        reutilise: true,
        posteReferentiel: { libelle: "Salaires", actif: true },
      },
    });
    const onCreated = vi.fn();
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={3} onCreated={onCreated} />);
    openDialog();

    fireEvent.click(await screen.findByText("Salaires"));
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith(
      "/api/previsions/scenarios/s1/postes",
      { libelle: "Salaires", type: "CHARGE_EXPLOITATION", ordre: 3, posteReferentielId: "ref-1" },
      { silentError: true }
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("le libelle scenario-local reste editable independamment apres selection (jamais derive silencieusement)", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);
    openDialog();

    fireEvent.click(await screen.findByText("Salaires"));
    const user = userEvent.setup({ delay: null });
    const libelleInput = screen.getByLabelText(/^Libellé\*?$/) as HTMLInputElement;
    await fillField(user, libelleInput, "Salaires equipe production");

    expect(libelleInput.value).toBe("Salaires equipe production");
  });
});

describe("PosteFormDialog — onglet Creer (branche b, nouveauPosteReferentielLibelle)", () => {
  it("saisir un libelle de creation rend l'etape 2 visible et pre-remplit le libelle scenario-local", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    await ouvrirEtCreer(user, "Carburant");

    const libelleInput = screen.getByLabelText(/^Libellé\*?$/) as HTMLInputElement;
    expect(libelleInput.value).toBe("Carburant");
  });

  it("soumission envoie nouveauPosteReferentielLibelle (jamais posteReferentielId)", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "p2",
        libelle: "Carburant",
        type: "LOGISTIQUE",
        posteReferentielId: "ref-2",
        reutilise: false,
        posteReferentiel: { libelle: "Carburant", actif: true },
      },
    });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={2} onCreated={onCreated} />);

    await ouvrirEtCreer(user, "Carburant");
    await selectType(user, "Logistique");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith(
      "/api/previsions/scenarios/s1/postes",
      { libelle: "Carburant", type: "LOGISTIQUE", ordre: 2, nouveauPosteReferentielLibelle: "Carburant" },
      { silentError: true }
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("409 POSTE_REFERENTIEL_CODE_COLLISION : affiche le message et propose « Lier celle-ci », qui bascule sur Rechercher avec l'entree deja selectionnee", async () => {
    mockPost.mockResolvedValueOnce({
      ok: false,
      code: "POSTE_REFERENTIEL_CODE_COLLISION",
      error: "collision",
      details: { posteReferentielExistant: { id: "ref-1", libelle: "Salaires" } },
    });
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    await ouvrirEtCreer(user, "Salaires");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/existe déjà dans le référentiel/)).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Lier celle-ci" }));

    // Retombe sur l'onglet Rechercher, entree deja selectionnee (posteReferentielId = ref-1).
    expect(screen.getByRole("tab", { name: "Rechercher dans le référentiel", selected: true })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Une resoumission reussit desormais (posteReferentielId, plus de collision).
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "p3",
        libelle: "Salaires",
        type: "CHARGE_EXPLOITATION",
        posteReferentielId: "ref-1",
        reutilise: true,
        posteReferentiel: { libelle: "Salaires", actif: true },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenLastCalledWith(
        "/api/previsions/scenarios/s1/postes",
        expect.objectContaining({ posteReferentielId: "ref-1" }),
        { silentError: true }
      )
    );
  });

  it("409 POSTE_REFERENTIEL_INACTIF (branche creer) : message dedie + lien vers l'ecran d'administration", async () => {
    mockPost.mockResolvedValueOnce({
      ok: false,
      code: "POSTE_REFERENTIEL_INACTIF",
      error: "inactif",
    });
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    await ouvrirEtCreer(user, "Loyer");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() =>
      expect(screen.getAllByText(/Une entrée désactivée existe déjà pour ce libellé/).length).toBeGreaterThan(0)
    );
    expect(screen.getByRole("link", { name: /Gérer le référentiel/ })).toHaveAttribute(
      "href",
      "/previsions/postes-referentiel"
    );
  });
});

describe("PosteFormDialog — Bug B : reinitialisation du libelle ET du type", () => {
  it("ouvrir -> onglet Creer -> saisir -> changer le type -> Annuler -> rouvrir : formulaire entierement reinitialise (onglet Rechercher, etape 2 masquee)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    await ouvrirEtCreer(user, "Carburant");
    await selectType(user, "Logistique");
    expect(screen.getByRole("combobox")).toHaveTextContent("Logistique");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect(screen.getByRole("tab", { name: "Rechercher dans le référentiel", selected: true })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Libellé\*?$/)).not.toBeInTheDocument();
  });

  it("soumission reussie : reinitialise aussi le type (pas seulement le libelle et l'onglet)", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "p1",
        libelle: "Carburant",
        type: "LOGISTIQUE",
        posteReferentielId: "ref-2",
        reutilise: false,
        posteReferentiel: { libelle: "Carburant", actif: true },
      },
    });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={onCreated} />);

    await ouvrirEtCreer(user, "Carburant");
    await selectType(user, "Logistique");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    openDialog();
    expect(screen.getByRole("tab", { name: "Rechercher dans le référentiel", selected: true })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Libellé\*?$/)).not.toBeInTheDocument();
  });
});

describe("PosteFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByRole("tab", { name: "Rechercher dans le référentiel" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "Rechercher dans le référentiel" })).not.toBeInTheDocument();
    });
  });

  it("apres une saisie (onglet Creer), Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    await ouvrirEtCreer(user, "Carburant");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/^Libellé\*?$/) as HTMLInputElement).value).toBe("Carburant");
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByRole("tab", { name: "Rechercher dans le référentiel" })).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "Rechercher dans le référentiel" })).not.toBeInTheDocument();
    });
  });

  it("apres une saisie (onglet Creer), un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    await ouvrirEtCreer(user, "Carburant");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/^Libellé\*?$/) as HTMLInputElement).value).toBe("Carburant");
  });

  it("selectionner une entree du referentiel (onglet Rechercher) compte aussi comme 'touche' : Echap ne ferme pas le dialogue", async () => {
    render(<PosteFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);
    openDialog();

    fireEvent.click(await screen.findByText("Salaires"));

    const user = userEvent.setup({ delay: null });
    await user.keyboard("{Escape}");

    expect(screen.getByLabelText(/^Libellé\*?$/)).toBeInTheDocument();
  });
});
