// @vitest-environment jsdom
/**
 * Tests — PostesReferentielAdminClient (story A.5, ADR-053 §16.12).
 *
 * Couvre : rendu liste (actives + inactives), rename, désactiver,
 * réactiver, état d'erreur (mutation échouée n'altère pas l'état local),
 * R5 (DialogTrigger asChild — un seul élément interactif par action, pas
 * bouton + wrapper), et absence de chaîne en dur (toutes les chaînes
 * passent par `t(...)`, vérifiable en comparant fr/en).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostesReferentielAdminClient } from "@/components/previsions/postes-referentiel-admin-client";
import type { PosteReferentielDTO } from "@/components/previsions/api-types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";

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

// `Intl.PluralRules("fr")` — pas `n === 1` — car le francais classe 0 dans la categorie
// "one" (singulier : "0 poste"), a la difference de l'anglais ("other" : "0 posts"). Un mock
// naif sur `n === 1` ferait mentir le test sur le rendu reel a `count = 0` (cas EXCEL-V12).
const pluralRulesFr = new Intl.PluralRules("fr");

function interpolate(template: string, values?: Record<string, unknown>): string {
  if (!values) return template;
  let result = template;
  // ICU plural minimal : `{name, plural, one {...} other {...}}` (patron utilise par
  // `posteReferentielAdmin.desactiverDialog.impact.*`, cf. `src/messages/fr/stock.json:37`).
  result = result.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
    (_, key: string, one: string, other: string) => {
      // PAS de `?? 0` ici : `Number(undefined)` doit rester `NaN`, exactement
      // comme le vrai `next-intl`/`Intl.PluralRules` en production. Un mock
      // qui "repare" silencieusement une valeur de decompte absente en 0
      // masquerait precisement le defaut que ce fichier de test doit pouvoir
      // detecter (ERR-188, reserve PR2non.3) : `Intl.PluralRules.select(NaN)`
      // retombe sur la categorie "other", et `#` formate en la chaine "NaN"
      // — donc "NaN postes de charge rattaches" si `count` est jamais fourni
      // `undefined` par un des 7 points de retour de mutation.
      const n = Number(values[key]);
      const chosen = pluralRulesFr.select(n) === "one" ? one : other;
      return chosen.replace(/#/g, String(n));
    }
  );
  return result.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const value = deepGet(DICTIONARIES[namespace], key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

const patchMock = vi.fn();
const postMock = vi.fn();

vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({
    get: vi.fn(),
    post: (...args: unknown[]) => postMock(...args),
    put: vi.fn(),
    patch: (...args: unknown[]) => patchMock(...args),
    del: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const entries: PosteReferentielDTO[] = [
  {
    id: "ref-1",
    siteId: "site-1",
    code: "electricite",
    libelle: "Electricite",
    actif: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    nbPostesRattaches: 3,
    nbMappingsRattaches: 2,
  },
  {
    id: "ref-2",
    siteId: "site-1",
    code: "salaires",
    libelle: "Salaires équipe",
    actif: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    nbPostesRattaches: 0,
    nbMappingsRattaches: 0,
  },
];

describe("PostesReferentielAdminClient — rendu de la liste", () => {
  it("affiche à la fois les entrées actives ET inactives", () => {
    render(<PostesReferentielAdminClient initialEntries={entries} />);
    expect(screen.getByText("Electricite")).toBeInTheDocument();
    expect(screen.getByText("Salaires équipe")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText("Désactivé")).toBeInTheDocument();
  });

  it("affiche l'état vide (EmptyState) quand aucune entrée n'existe", () => {
    render(<PostesReferentielAdminClient initialEntries={[]} />);
    expect(screen.getByText("Aucune entrée dans le référentiel des postes de ce site.")).toBeInTheDocument();
    expect(screen.queryByText("Electricite")).not.toBeInTheDocument();
  });

  it("affiche le code de chaque entrée", () => {
    render(<PostesReferentielAdminClient initialEntries={entries} />);
    expect(screen.getByText(/electricite/)).toBeInTheDocument();
    expect(screen.getByText(/salaires/)).toBeInTheDocument();
  });
});

describe("PostesReferentielAdminClient — R5 (DialogTrigger asChild)", () => {
  it("le bouton 'Renommer' est lui-même le déclencheur (pas de wrapper supplémentaire) — un seul <button> par carte et par action", () => {
    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);
    const boutonsRenommer = screen.getAllByRole("button", { name: /Renommer/i });
    expect(boutonsRenommer).toHaveLength(1);
    // Radix DialogTrigger + asChild fusionne les props sur le Button lui-même
    // (data-state porté directement par le <button>) — sans asChild, Radix
    // enveloppe le bouton, produisant un <button> supplémentaire imbriqué.
    expect(boutonsRenommer[0].tagName).toBe("BUTTON");
  });
});

describe("PostesReferentielAdminClient — renommer", () => {
  it("ouvre le dialogue, soumet un nouveau libellé, et reflète la mise à jour dans la liste", async () => {
    const user = userEvent.setup({ delay: null });
    // Objet EXPLICITE, pas un spread de `entries[0]` : le mock doit refleter
    // la forme REELLE de la reponse `PATCH .../[id]` en production (les deux
    // decomptes sont TOUJOURS presents, y compris sur ce point de retour non
    // idempotent — cf. `renommerPosteReferentiel` -> `getPosteReferentielAdmin`).
    // Un spread masquerait un regression silencieuse si ce point de retour
    // cessait un jour de les fournir (ERR-188).
    patchMock.mockResolvedValue({
      ok: true,
      data: {
        id: "ref-1",
        siteId: "site-1",
        code: "electricite",
        libelle: "Électricité générale",
        actif: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        nbPostesRattaches: 3,
        nbMappingsRattaches: 2,
      },
    });

    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    expect(screen.getByRole("heading", { name: "Renommer l'entrée" })).toBeInTheDocument();

    const input = screen.getByLabelText(/^Libellé\*?$/);
    await user.clear(input);
    await user.type(input, "Électricité générale");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(patchMock).toHaveBeenCalledWith("/api/previsions/postes-referentiel/ref-1", {
      libelle: "Électricité générale",
    });
    expect(await screen.findByText("Électricité générale")).toBeInTheDocument();
    expect(screen.queryByText("Electricite")).not.toBeInTheDocument();
  });

  it("apres un renommage, rouvrir 'Désactiver' affiche des decomptes NUMERIQUES (jamais NaN) — regression du defaut PR2non.3", async () => {
    const user = userEvent.setup({ delay: null });
    // Le point critique du defaut original : la reponse de renommage doit
    // porter les decomptes pour que `handleUpdated` (remplacement complet de
    // l'entree en state, pas un merge) ne les efface pas avant la reouverture
    // du dialogue de desactivation.
    patchMock.mockResolvedValue({
      ok: true,
      data: {
        id: "ref-1",
        siteId: "site-1",
        code: "electricite",
        libelle: "Électricité renommée",
        actif: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        nbPostesRattaches: 3,
        nbMappingsRattaches: 2,
      },
    });

    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    const input = screen.getByLabelText(/^Libellé\*?$/);
    await user.clear(input);
    await user.type(input, "Électricité renommée");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Électricité renommée")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("3 postes de charge rattachés")).toBeInTheDocument();
    expect(within(dialog).getByText("2 rapprochements rattachés")).toBeInTheDocument();
    expect(within(dialog).queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("rejette la soumission d'un libellé vide sans appeler l'API", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    const input = screen.getByLabelText(/^Libellé\*?$/);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Le libellé est obligatoire.")).toBeInTheDocument();
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("un échec de l'API laisse le libellé affiché inchangé (état d'erreur : pas de mise à jour optimiste)", async () => {
    const user = userEvent.setup({ delay: null });
    patchMock.mockResolvedValue({ ok: false, data: null, error: "Erreur serveur" });

    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    const input = screen.getByLabelText(/^Libellé\*?$/);
    await user.clear(input);
    await user.type(input, "Nouveau nom");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(patchMock).toHaveBeenCalled();
    // Le libellé d'origine reste affiché — aucune mise à jour locale tant
    // que l'API n'a pas renvoyé `ok: true`.
    expect(await screen.findByText("Electricite")).toBeInTheDocument();
    expect(screen.queryByText("Nouveau nom")).not.toBeInTheDocument();
  });
});

describe("PostesReferentielAdminClient — désactiver / réactiver", () => {
  it("propose 'Désactiver' pour une entrée active, et 'Réactiver' pour une entrée inactive", () => {
    render(<PostesReferentielAdminClient initialEntries={entries} />);
    expect(screen.getByRole("button", { name: /Désactiver/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réactiver/i })).toBeInTheDocument();
  });

  it("désactiver : confirme via le dialogue, appelle POST .../desactiver, et met à jour le badge", async () => {
    const user = userEvent.setup({ delay: null });
    // Objet EXPLICITE (pas un spread) — meme justification que le test de
    // renommage ci-dessus : la reponse `POST .../desactiver` porte TOUJOURS
    // les deux decomptes en production.
    postMock.mockResolvedValue({
      ok: true,
      data: {
        id: "ref-1",
        siteId: "site-1",
        code: "electricite",
        libelle: "Electricite",
        actif: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        nbPostesRattaches: 3,
        nbMappingsRattaches: 2,
      },
    });

    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    expect(screen.getByText("Désactiver cette entrée ?")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Désactiver" }));

    expect(postMock).toHaveBeenCalledWith("/api/previsions/postes-referentiel/ref-1/desactiver", {});
    expect(await screen.findByText("Désactivé")).toBeInTheDocument();
  });

  it("réactiver : confirme via le dialogue, appelle POST .../reactiver, et met à jour le badge", async () => {
    const user = userEvent.setup({ delay: null });
    postMock.mockResolvedValue({
      ok: true,
      data: {
        id: "ref-2",
        siteId: "site-1",
        code: "salaires",
        libelle: "Salaires équipe",
        actif: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        nbPostesRattaches: 0,
        nbMappingsRattaches: 0,
      },
    });

    render(<PostesReferentielAdminClient initialEntries={[entries[1]]} />);

    await user.click(screen.getByRole("button", { name: "Réactiver" }));
    expect(screen.getByText("Réactiver cette entrée ?")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Réactiver" }));

    expect(postMock).toHaveBeenCalledWith("/api/previsions/postes-referentiel/ref-2/reactiver", {});
    expect(await screen.findByText("Actif")).toBeInTheDocument();
  });

  it("cycle désactiver -> réactiver -> désactiver : les decomptes restent NUMERIQUES (jamais NaN) a chaque reouverture du dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    // Le point idempotent lui-meme (server-side) est couvert par les tests
    // de route et le test d'integration DB — ce test-ci verifie uniquement
    // que `handleUpdated` (remplacement complet de l'entree en state) ne
    // fait JAMAIS regresser les decomptes affiches d'un cycle a l'autre,
    // quelle que soit la reponse simulee ici.
    postMock.mockImplementation((url: unknown) => {
      const actif = String(url).endsWith("/reactiver");
      return Promise.resolve({
        ok: true,
        data: {
          id: "ref-1",
          siteId: "site-1",
          code: "electricite",
          libelle: "Electricite",
          actif,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          nbPostesRattaches: 3,
          nbMappingsRattaches: 2,
        },
      });
    });

    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Désactiver" }));
    await screen.findByText("Désactivé");

    await user.click(screen.getByRole("button", { name: "Réactiver" }));
    const dialog2 = screen.getByRole("dialog");
    await user.click(within(dialog2).getByRole("button", { name: "Réactiver" }));
    await screen.findByText("Actif");

    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    const dialog3 = screen.getByRole("dialog");
    expect(within(dialog3).getByText("3 postes de charge rattachés")).toBeInTheDocument();
    expect(within(dialog3).getByText("2 rapprochements rattachés")).toBeInTheDocument();
    expect(within(dialog3).queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("désactiver une entrée rattachée affiche le décompte des postes et mappings rattachés (R3) — valeurs non nulles", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Désactiver" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("3 postes de charge rattachés")).toBeInTheDocument();
    expect(within(dialog).getByText("2 rapprochements rattachés")).toBeInTheDocument();
  });

  it("désactiver une entrée sans aucun rattachement affiche '0 poste...' / '0 rapprochement...' de façon lisible (cas réel EXCEL-V12 : 0 mapping)", async () => {
    const user = userEvent.setup({ delay: null });
    const entreeSansRattachement: PosteReferentielDTO = {
      ...entries[0],
      id: "ref-3",
      nbPostesRattaches: 0,
      nbMappingsRattaches: 0,
    };
    render(<PostesReferentielAdminClient initialEntries={[entreeSansRattachement]} />);

    await user.click(screen.getByRole("button", { name: "Désactiver" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("0 poste de charge rattaché")).toBeInTheDocument();
    expect(within(dialog).getByText("0 rapprochement rattaché")).toBeInTheDocument();
  });

  it("réactiver n'affiche AUCUN décompte (le décompte ne concerne que la désactivation)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PostesReferentielAdminClient initialEntries={[entries[1]]} />);

    await user.click(screen.getByRole("button", { name: "Réactiver" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/rattaché/)).not.toBeInTheDocument();
  });

  it("un échec de l'API sur désactiver laisse le badge 'Actif' inchangé", async () => {
    const user = userEvent.setup({ delay: null });
    postMock.mockResolvedValue({ ok: false, data: null, error: "Erreur serveur" });

    render(<PostesReferentielAdminClient initialEntries={[entries[0]]} />);

    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Désactiver" }));

    expect(postMock).toHaveBeenCalled();
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });
});

describe("PostesReferentielAdminClient — i18n (aucune chaîne en dur)", () => {
  it("toutes les clés previsions.posteReferentielAdmin.* utilisées existent en fr ET en en", async () => {
    const enPrevisions = (await import("@/messages/en/previsions.json")).default as Record<string, unknown>;
    const keysUtilisees = [
      "posteReferentielAdmin.pageTitle",
      "posteReferentielAdmin.pageDescription",
      "posteReferentielAdmin.columns.code",
      "posteReferentielAdmin.actions.renommer",
      "posteReferentielAdmin.actions.desactiver",
      "posteReferentielAdmin.actions.reactiver",
      "posteReferentielAdmin.badges.actif",
      "posteReferentielAdmin.badges.inactif",
      "posteReferentielAdmin.renameDialog.title",
      "posteReferentielAdmin.renameDialog.fields.libelle.label",
      "posteReferentielAdmin.renameDialog.submit",
      "posteReferentielAdmin.renameDialog.submitting",
      "posteReferentielAdmin.desactiverDialog.confirmTitle",
      "posteReferentielAdmin.desactiverDialog.confirmDescription",
      "posteReferentielAdmin.desactiverDialog.confirmButton",
      "posteReferentielAdmin.desactiverDialog.impact.postes",
      "posteReferentielAdmin.desactiverDialog.impact.mappings",
      "posteReferentielAdmin.reactiverDialog.confirmTitle",
      "posteReferentielAdmin.reactiverDialog.confirmDescription",
      "posteReferentielAdmin.reactiverDialog.confirmButton",
      "posteReferentielAdmin.errors.libelleRequired",
      "posteReferentielAdmin.empty",
    ];
    for (const key of keysUtilisees) {
      expect(typeof deepGet(frPrevisions, key)).toBe("string");
      expect(typeof deepGet(enPrevisions, key)).toBe("string");
    }
  });
});
