// @vitest-environment jsdom
/**
 * Tests — AlimentFormDialog (Sprint PR2-ter, story PR2ter.2, Bug A / Bug B ;
 * Sprint PR2-quater, story PR2q.5 : calibre obligatoire + rattachement
 * produit optionnel, ADR-053 §12.6)
 *
 * Composant : src/components/previsions/aliment-form-dialog.tsx
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlimentFormDialog } from "@/components/previsions/aliment-form-dialog";
import { TailleGranule } from "@/types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";
import { fillField } from "./test-utils";
import frStock from "@/messages/fr/stock.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
  stock: frStock,
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

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ ok: true, data: { data: [] }, error: null });
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /nouvelle granulométrie/i }));
}

async function selectCalibre(user: ReturnType<typeof userEvent.setup>, label: string) {
  const trigger = screen.getByRole("combobox", { name: /Calibre/i });
  await user.click(trigger);
  const option = await screen.findByRole("option", { name: label });
  await user.click(option);
}

/**
 * Simule un clic hors du dialogue (voir scenario-form-dialog.test.tsx pour le
 * detail du piege jsdom : Radix `DismissableLayer` n'attache son listener
 * natif `pointerdown` qu'apres un `setTimeout(fn, 0)`). Sans ce test, seul
 * Echap est verifie pour Bug A — un oubli de branchement d'`onInteractOutside`
 * sur `DialogContent` (bug de cablage distinct de la logique du hook) ne
 * serait detecte par aucun test existant de ce fichier.
 */
async function cliquerHorsDialogue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body, { pointerId: 1, isPrimary: true });
}

async function remplirFormulaireValide(user: ReturnType<typeof userEvent.setup>) {
  await selectCalibre(user, "G1 — Granulé 2mm");
  await fillField(user, screen.getByLabelText(/^Libellé/), "Granule 2mm");
  await fillField(user, screen.getByLabelText(/Poids du sac/i), "25");
  await fillField(user, screen.getByLabelText(/Prix du sac/i), "15000");
}

describe("AlimentFormDialog — calibre obligatoire (ADR-053 §12.1/§12.3, story PR2q.5)", () => {
  it("la soumission est bloquee si aucun calibre n'est selectionne", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Granule 2mm");
    await fillField(user, screen.getByLabelText(/Poids du sac/i), "25");
    await fillField(user, screen.getByLabelText(/Prix du sac/i), "15000");

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    expect(await screen.findByText("Le calibre est obligatoire.")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("soumission reussie avec un calibre selectionne : envoie tailleGranule et l'article dans le meme appel", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "a1",
        tailleGranule: TailleGranule.G1,
        articles: [{ id: "art1", libelle: "Granule 2mm", poidsSacKg: 25, prixSacFCFA: 15000 }],
      },
    });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={onCreated} />);

    openDialog();
    await remplirFormulaireValide(user);

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    expect(mockPost).toHaveBeenCalledWith(
      "/api/previsions/scenarios/s1/aliments",
      expect.objectContaining({
        tailleGranule: TailleGranule.G1,
        article: expect.objectContaining({
          libelle: "Granule 2mm",
          poidsSacKg: 25,
          prixSacFCFA: 15000,
          produitId: null,
        }),
      })
    );
    // Le payload ne porte plus de part d'approvisionnement (100% implicite, ecrit par le serveur — ADR-053 §12.6)
    const payload = mockPost.mock.calls[0][1] as { article: Record<string, unknown> };
    expect(payload.article).not.toHaveProperty("partApprovisionnementPct");
  });

  it("les calibres deja utilises dans le scenario sont exclus des options", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <AlimentFormDialog
        scenarioId="s1"
        ordreSuivant={1}
        onCreated={vi.fn()}
        taillesGranuleUtilisees={[TailleGranule.G1]}
      />
    );

    openDialog();
    const trigger = screen.getByRole("combobox", { name: /Calibre/i });
    await user.click(trigger);

    expect(screen.queryByRole("option", { name: "G1 — Granulé 2mm" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "G2 — Granulé 3mm" })).toBeInTheDocument();
  });
});

describe("AlimentFormDialog — Bug B : reinitialisation a chaque fermeture", () => {
  it("ouvrir -> saisir -> Annuler -> rouvrir : le champ libelle est vide", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    const libelleInput = screen.getByLabelText(/^Libellé/) as HTMLInputElement;
    await fillField(user, libelleInput, "Granule 2mm");
    expect(libelleInput.value).toBe("Granule 2mm");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
  });

  it("soumission reussie : reinitialise le formulaire (y compris le calibre)", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: { id: "a1", tailleGranule: TailleGranule.G1, articles: [{ id: "art1", libelle: "Granule 2mm" }] },
    });
    const onCreated = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={onCreated} />);

    openDialog();
    await remplirFormulaireValide(user);

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    openDialog();
    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("combobox", { name: /Calibre/i })).not.toHaveTextContent("G1");
  });
});

describe("AlimentFormDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue vierge se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Granule 2mm");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Granule 2mm");
  });

  it("le bouton Annuler reste fonctionnel meme apres une saisie", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Granule 2mm");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("un dialogue vierge se ferme normalement au clic exterieur (aucune friction sur le cas nominal)", async () => {
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    expect(screen.getByLabelText(/^Libellé/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Libellé/)).not.toBeInTheDocument();
    });
  });

  it("apres une saisie, un clic exterieur ne ferme PAS le dialogue (Bug A — perte silencieuse bloquee)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AlimentFormDialog scenarioId="s1" ordreSuivant={1} onCreated={vi.fn()} />);

    openDialog();
    await fillField(user, screen.getByLabelText(/^Libellé/), "Granule 2mm");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/^Libellé/) as HTMLInputElement).value).toBe("Granule 2mm");
  });
});
