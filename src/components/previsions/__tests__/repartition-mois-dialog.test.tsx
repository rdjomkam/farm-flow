// @vitest-environment jsdom
/**
 * Tests — RepartitionMoisDialog (Sprint PR2-ter, story PR2ter.2, Bug A / Bug B)
 *
 * Composant : src/components/previsions/repartition-mois-dialog.tsx
 * Aucun test dedie n'existait avant PR2ter.2 (pre-analyse section 6).
 *
 * Bug B variante (avant fix) : `valeurs` n'etait initialise que par lazy
 * `useState` au tout premier montage — jamais reinitialise sur Annuler ni
 * clic exterieur. Le reset doit restaurer les `repartitions` (source de
 * verite serveur), pas un tableau vide.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepartitionMoisDialog } from "@/components/previsions/repartition-mois-dialog";
import type { RepartitionMoisAlimentDTO } from "@/components/previsions/api-types";
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

const mockPut = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: vi.fn(), put: mockPut, get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

const repartitions: RepartitionMoisAlimentDTO[] = [
  { id: "r1", alimentPrevisionId: "al1", moisCycle: 1, pourcentage: 50, siteId: "site-1" },
  { id: "r2", alimentPrevisionId: "al1", moisCycle: 2, pourcentage: 50, siteId: "site-1" },
];

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

describe("RepartitionMoisDialog — Bug B variante : `valeurs` n'etait jamais reinitialise (lazy useState au premier montage seulement)", () => {
  it("ouvrir -> modifier -> Annuler -> rouvrir : les valeurs redeviennent celles de `repartitions` (pas la saisie abandonnee)", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RepartitionMoisDialog
        alimentPrevisionId="al1"
        libelle="Granule 2mm"
        dureeCycleMois={2}
        repartitions={repartitions}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    const mois1 = screen.getByLabelText(/Mois 1/) as HTMLInputElement;
    expect(mois1.value).toBe("50");
    await user.clear(mois1);
    await fillField(user, mois1, "10");
    expect(mois1.value).toBe("10");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect((screen.getByLabelText(/Mois 1/) as HTMLInputElement).value).toBe("50");
  });

  it("soumission reussie : garde les valeurs fraichement enregistrees a la reouverture", async () => {
    mockPut.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: "r1", alimentPrevisionId: "al1", moisCycle: 1, pourcentage: 30, siteId: "site-1" },
        { id: "r2", alimentPrevisionId: "al1", moisCycle: 2, pourcentage: 70, siteId: "site-1" },
      ],
    });
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <RepartitionMoisDialog
        alimentPrevisionId="al1"
        libelle="Granule 2mm"
        dureeCycleMois={2}
        repartitions={repartitions}
        onSaved={onSaved}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    const mois1 = screen.getByLabelText(/Mois 1/) as HTMLInputElement;
    await user.clear(mois1);
    await fillField(user, mois1, "30");
    const mois2 = screen.getByLabelText(/Mois 2/) as HTMLInputElement;
    await user.clear(mois2);
    await fillField(user, mois2, "70");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la répartition" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    openDialog();
    expect((screen.getByLabelText(/Mois 1/) as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText(/Mois 2/) as HTMLInputElement).value).toBe("70");
  });
});

describe("RepartitionMoisDialog — Bug A : garde de fermeture quand le formulaire est touche", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RepartitionMoisDialog
        alimentPrevisionId="al1"
        libelle="Granule 2mm"
        dureeCycleMois={2}
        repartitions={repartitions}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    expect(screen.getByLabelText(/Mois 1/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText(/Mois 1/)).not.toBeInTheDocument();
    });
  });

  it("apres une modification, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RepartitionMoisDialog
        alimentPrevisionId="al1"
        libelle="Granule 2mm"
        dureeCycleMois={2}
        repartitions={repartitions}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    const mois1 = screen.getByLabelText(/Mois 1/) as HTMLInputElement;
    await user.clear(mois1);
    await fillField(user, mois1, "10");

    await user.keyboard("{Escape}");

    expect((screen.getByLabelText(/Mois 1/) as HTMLInputElement).value).toBe("10");
  });

  it("un dialogue vierge se ferme normalement au clic exterieur", async () => {
    render(
      <RepartitionMoisDialog
        alimentPrevisionId="al1"
        libelle="Granule 2mm"
        dureeCycleMois={2}
        repartitions={repartitions}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    expect(screen.getByLabelText(/Mois 1/)).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByLabelText(/Mois 1/)).not.toBeInTheDocument();
    });
  });

  it("apres une modification, un clic exterieur ne ferme PAS le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RepartitionMoisDialog
        alimentPrevisionId="al1"
        libelle="Granule 2mm"
        dureeCycleMois={2}
        repartitions={repartitions}
        onSaved={vi.fn()}
        trigger={<button>Ouvrir</button>}
      />
    );

    openDialog();
    const mois1 = screen.getByLabelText(/Mois 1/) as HTMLInputElement;
    await user.clear(mois1);
    await fillField(user, mois1, "10");

    await cliquerHorsDialogue();

    expect((screen.getByLabelText(/Mois 1/) as HTMLInputElement).value).toBe("10");
  });
});
