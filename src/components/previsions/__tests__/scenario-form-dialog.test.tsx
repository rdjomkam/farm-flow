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
const mockGet = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: mockPost, put: vi.fn(), get: mockGet, patch: vi.fn(), del: vi.fn() }),
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

  it("soumission reussie : reinitialise aussi (deja couvert avant PR2ter.2, non-regression ; etendu ADR-053 §18 pour l'etape produits)", async () => {
    mockGet.mockResolvedValueOnce({ ok: true, data: { data: [] } });
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: "s1", nombreCalibresAlimentsCrees: 0 } });
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

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Créer le scénario" })).not.toBeDisabled()
    );

    fireEvent.click(screen.getByRole("button", { name: "Créer le scénario" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    // Reponse avec nombreCalibresAlimentsCrees === 0 : le dialogue reste
    // ouvert sur la confirmation (ADR-053 §18.2(b)) plutot que de se fermer
    // silencieusement — on ferme explicitement avant de verifier le reset.
    // Deux boutons partagent le libelle "Fermer" (la croix du dialogue et le
    // bouton de confirmation du pied de page) — le premier est celui du pied
    // de page, rendu avant la croix dans l'arbre DOM.
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" })[0]);

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

// ---------------------------------------------------------------------------
// ADR-053 §18 — etape 2 : selection explicite des produits alimentaires
// ---------------------------------------------------------------------------

/**
 * Un produit VALIDE (pre-coche par defaut).
 */
const PRODUIT_VALIDE = {
  id: "prod-valide",
  nom: "Croissance 3mm",
  tailleGranule: "G2",
  contenance: 25,
  prixUnitaire: 15000,
  eligible: true,
  raisonsInvalidite: [] as string[],
};

/**
 * Invalide : `tailleGranule` manquante seule (ADR-053 §18.5).
 */
const PRODUIT_SANS_GRANULO = {
  id: "prod-sans-granulo",
  nom: "Sans granulometrie",
  tailleGranule: null,
  contenance: 25,
  prixUnitaire: 12000,
  eligible: false,
  raisonsInvalidite: ["TAILLE_GRANULE_MANQUANTE"],
};

/**
 * Invalide : `contenance` manquante seule (famille ERR-185 — produisait
 * auparavant silencieusement un article a 0 kg/sac).
 */
const PRODUIT_SANS_CONTENANCE = {
  id: "prod-sans-contenance",
  nom: "Sans contenance",
  tailleGranule: "P1",
  contenance: null,
  prixUnitaire: 8000,
  eligible: false,
  raisonsInvalidite: ["CONTENANCE_MANQUANTE"],
};

/**
 * Invalide : les DEUX raisons cumulees sur le meme produit (ADR-053 §18.3 —
 * `raisonsInvalidite` est un TABLEAU, jamais un code unique).
 */
const PRODUIT_SANS_RIEN = {
  id: "prod-sans-rien",
  nom: "Sans rien",
  tailleGranule: null,
  contenance: null,
  prixUnitaire: 5000,
  eligible: false,
  raisonsInvalidite: ["TAILLE_GRANULE_MANQUANTE", "CONTENANCE_MANQUANTE"],
};

/**
 * Renseigne l'integralite des champs obligatoires de l'etape 1 puis clique
 * "Suivant" pour atteindre l'etape 2 (produits). Reprend exactement la
 * sequence de champs deja exercee par le test de non-regression Bug B
 * ci-dessus.
 */
async function remplirEtapeFormulaireEtAvancer(user: ReturnType<typeof userEvent.setup>) {
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

  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
}

describe("ScenarioFormDialog — ADR-053 §18 : selection des produits alimentaires (etape 2)", () => {
  it("point 1 — un produit sans tailleGranule est VISIBLE dans la liste, marque, et sa case est NON COCHABLE", async () => {
    mockGet.mockResolvedValueOnce({
      ok: true,
      data: { data: [PRODUIT_VALIDE, PRODUIT_SANS_GRANULO] },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);

    // Visible.
    expect(await screen.findByText("Sans granulometrie")).toBeInTheDocument();
    // Non cochable.
    const checkbox = screen.getByRole("checkbox", { name: /Sans granulometrie/i });
    expect(checkbox).toBeDisabled();
  });

  it("point 2 — un produit sans contenance strictement positive est VISIBLE, marque, et NON COCHABLE (famille ERR-185)", async () => {
    mockGet.mockResolvedValueOnce({
      ok: true,
      data: { data: [PRODUIT_VALIDE, PRODUIT_SANS_CONTENANCE] },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);

    expect(await screen.findByText("Sans contenance")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: /Sans contenance/i });
    expect(checkbox).toBeDisabled();
  });

  it("point 3 — la raison d'invalidite est ecrite et lisible (traduite depuis l'enum), les DEUX raisons s'affichent quand elles sont cumulees", async () => {
    mockGet.mockResolvedValueOnce({
      ok: true,
      data: { data: [PRODUIT_SANS_RIEN] },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);

    await screen.findByText("Sans rien");
    // Traduction lisible (cle fr resolue), jamais le code d'enum brut.
    expect(screen.getByText("Granulométrie non renseignée")).toBeInTheDocument();
    expect(screen.getByText("Contenance du sac non renseignée")).toBeInTheDocument();
    // Le code d'enum brut ne doit jamais fuiter tel quel dans le rendu.
    expect(screen.queryByText("TAILLE_GRANULE_MANQUANTE")).not.toBeInTheDocument();
    expect(screen.queryByText("CONTENANCE_MANQUANTE")).not.toBeInTheDocument();
  });

  it("point 4 — le lien vers la fiche produit /stock/produits/{id} est present sur chaque produit invalide, avec le bon id", async () => {
    mockGet.mockResolvedValueOnce({
      ok: true,
      data: { data: [PRODUIT_SANS_GRANULO, PRODUIT_SANS_CONTENANCE] },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);

    await screen.findByText("Sans granulometrie");
    const liens = screen.getAllByRole("link", { name: /Corriger dans Stock/i });
    const hrefs = liens.map((lien) => lien.getAttribute("href"));
    expect(hrefs).toContain(`/stock/produits/${PRODUIT_SANS_GRANULO.id}`);
    expect(hrefs).toContain(`/stock/produits/${PRODUIT_SANS_CONTENANCE.id}`);
  });

  it("point 5 — pre-cochage par defaut : les produits valides sont pre-coches, les invalides decoches ET verrouilles", async () => {
    mockGet.mockResolvedValueOnce({
      ok: true,
      data: { data: [PRODUIT_VALIDE, PRODUIT_SANS_GRANULO] },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);

    await screen.findByText("Croissance 3mm");
    const checkboxValide = screen.getByRole("checkbox", { name: /Croissance 3mm/i });
    const checkboxInvalide = screen.getByRole("checkbox", { name: /Sans granulometrie/i });

    expect(checkboxValide).toBeChecked();
    expect(checkboxValide).not.toBeDisabled();
    expect(checkboxInvalide).not.toBeChecked();
    expect(checkboxInvalide).toBeDisabled();
  });

  it("point 6 — etat vide dedie quand le site n'a AUCUN produit alimentaire (data: [])", async () => {
    mockGet.mockResolvedValueOnce({ ok: true, data: { data: [] } });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);

    expect(
      await screen.findByText("Aucun produit alimentaire actif sur ce site")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Le scénario sera créé sans calibre d'aliment/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aller à Stock/i })).toHaveAttribute(
      "href",
      "/stock/produits"
    );
  });

  it("point 7 — decocher tous les produits valides n'empeche pas la soumission, et la mention de selection vide s'affiche", async () => {
    mockGet.mockResolvedValueOnce({ ok: true, data: { data: [PRODUIT_VALIDE] } });
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: { id: "s1", nombreCalibresAlimentsCrees: 0 },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);
    const checkboxValide = await screen.findByRole("checkbox", { name: /Croissance 3mm/i });
    expect(checkboxValide).toBeChecked();

    fireEvent.click(checkboxValide);
    expect(checkboxValide).not.toBeChecked();

    expect(
      screen.getByText(/Aucun produit sélectionné — le scénario sera créé sans calibre/i)
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Créer le scénario" });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  });

  it("point 8 — un bandeau explicite s'affiche apres creation quand nombreCalibresAlimentsCrees === 0", async () => {
    mockGet.mockResolvedValueOnce({ ok: true, data: { data: [] } });
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: { id: "s1", nombreCalibresAlimentsCrees: 0 },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Créer le scénario" })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Créer le scénario" }));

    expect(
      await screen.findByText(
        "Scénario créé sans calibre d'aliment — à saisir manuellement dans l'onglet Aliments."
      )
    ).toBeInTheDocument();
  });

  it("point 9 — le payload envoye contient produitIds avec exactement les ids coches (pas tous les produits listes)", async () => {
    mockGet.mockResolvedValueOnce({
      ok: true,
      data: { data: [PRODUIT_VALIDE, PRODUIT_SANS_GRANULO] },
    });
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: { id: "s1", nombreCalibresAlimentsCrees: 1 },
    });
    const user = userEvent.setup({ delay: null });
    render(<ScenarioFormDialog onCreated={vi.fn()} />);

    await remplirEtapeFormulaireEtAvancer(user);
    await screen.findByText("Croissance 3mm");

    fireEvent.click(screen.getByRole("button", { name: "Créer le scénario" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [, body] = mockPost.mock.calls[0];
    expect(body.produitIds).toEqual([PRODUIT_VALIDE.id]);
    expect(body.produitIds).not.toContain(PRODUIT_SANS_GRANULO.id);
  });
});

