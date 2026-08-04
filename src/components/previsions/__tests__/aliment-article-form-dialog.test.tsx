// @vitest-environment jsdom
/**
 * Tests — AlimentArticleFormDialog (Sprint PR2-quater, story PR2q.5)
 *
 * Composant : src/components/previsions/aliment-article-form-dialog.tsx
 * Action secondaire explicite (ADR-053 §12.6) : ajoute un second article a
 * un calibre existant — c'est le SEUL moment ou la part d'approvisionnement
 * devient visible/saisissable, pour TOUS les articles du calibre.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlimentArticleFormDialog } from "@/components/previsions/aliment-article-form-dialog";
import type { AlimentArticlePrevisionDTO } from "@/components/previsions/api-types";
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

const articleExistant: AlimentArticlePrevisionDTO = {
  id: "article-1",
  alimentCalibrePrevisionId: "aliment-1",
  produitId: null,
  libelle: "Marque A",
  poidsSacKg: 25,
  prixSacFCFA: 15000,
  sacsParTonneUnitaire: 40,
  partApprovisionnementPct: 100,
  ordre: 0,
  siteId: "site-1",
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un article" }));
}

async function remplirNouvelArticle(user: ReturnType<typeof userEvent.setup>) {
  await fillField(user, screen.getByLabelText(/^Libellé/), "Marque B");
  await fillField(user, screen.getByLabelText(/Poids du sac/i), "20");
  await fillField(user, screen.getByLabelText(/Prix du sac/i), "14000");
}

describe("AlimentArticleFormDialog — la part d'approvisionnement (ADR-053 §12.6)", () => {
  it("l'article existant expose sa part (100%) qui devient modifiable des l'ouverture", () => {
    render(
      <AlimentArticleFormDialog
        alimentPrevisionId="aliment-1"
        calibreLabel="G1 — Granulé 2mm"
        articlesExistants={[articleExistant]}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    const inputPart = screen.getByLabelText(/Part d'approvisionnement.*Marque A/i) as HTMLInputElement;
    expect(inputPart.value).toBe("100");
  });

  it("bloque la soumission si la somme des parts n'est pas egale a 100 %", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <AlimentArticleFormDialog
        alimentPrevisionId="aliment-1"
        calibreLabel="G1 — Granulé 2mm"
        articlesExistants={[articleExistant]}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    await remplirNouvelArticle(user);
    // La part de l'article existant reste a 100, la nouvelle est saisie a 50 -> somme 150
    const nouvellePart = screen.getByLabelText(/^Part d'approvisionnement \(%\)\*/);
    await fillField(user, nouvellePart, "50");

    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(
      await screen.findByText("La somme des parts d'approvisionnement doit être égale à 100 %.")
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("soumission reussie quand la somme des parts vaut 100 % : envoie articleId pour l'existant, aucun pour le nouveau", async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      data: { id: "aliment-1", articles: [articleExistant, { ...articleExistant, id: "article-2" }] },
    });
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <AlimentArticleFormDialog
        alimentPrevisionId="aliment-1"
        calibreLabel="G1 — Granulé 2mm"
        articlesExistants={[articleExistant]}
        onSaved={onSaved}
      />
    );

    openDialog();
    await remplirNouvelArticle(user);

    const partExistant = screen.getByLabelText(/Part d'approvisionnement.*Marque A/i) as HTMLInputElement;
    await user.clear(partExistant);
    await fillField(user, partExistant, "60");

    const nouvellePart = screen.getByLabelText(/^Part d'approvisionnement \(%\)\*/);
    await fillField(user, nouvellePart, "40");

    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(mockPost).toHaveBeenCalledWith(
      "/api/previsions/aliments/aliment-1/articles",
      expect.objectContaining({
        nouvelArticle: expect.objectContaining({ libelle: "Marque B", poidsSacKg: 20, prixSacFCFA: 14000 }),
        repartition: [
          { articleId: "article-1", partApprovisionnementPct: 60 },
          { partApprovisionnementPct: 40 },
        ],
      })
    );
  });
});
