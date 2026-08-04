// @vitest-environment jsdom
/**
 * Tests — RattacherVagueDialog (Sprint PR2, story PR2.3, ADR-053 décision 2)
 *
 * Composant : src/components/previsions/rattacher-vague-dialog.tsx
 *
 * Couverture :
 * 1. R5 — le bouton trigger utilise DialogTrigger asChild (rendu correct, un
 *    seul <button> DOM, pas de bouton imbriqué)
 * 2. Cas nominal : POST réussi, callback onRattachee appelé, dialog fermé
 * 3. Cas 409 avec code VAGUE_PREVUE_DEJA_RATTACHEE : onDejaRattachee appelé
 *    IMMÉDIATEMENT (exigence ADR décision 2), dialog fermé, PAS de toast
 *    d'erreur générique affiché à la place
 * 4. Cas d'erreur qui NE DOIT PAS déclencher la scission : 409 générique
 *    (code différent ou absent), 403, 500 — message d'erreur affiché,
 *    onDejaRattachee jamais appelé
 * 5. Le sélecteur ne propose que les vagues candidates libres
 *    (vaguePrevueId === null)
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RattacherVagueDialog } from "@/components/previsions/rattacher-vague-dialog";
import type { VaguePrevueListItemDTO, VagueCandidateDTO } from "@/components/previsions/api-types";
import { StatutVaguePrevue } from "@/types";
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

// Radix Select (@radix-ui/react-select) appelle `hasPointerCapture`/
// `scrollIntoView`, absents de jsdom — polyfill minimal nécessaire pour
// simuler l'ouverture du Select via userEvent, comme documenté par Radix
// pour les environnements de test jsdom.
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

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

const vaguePrevue: VaguePrevueListItemDTO = {
  id: "vp-1",
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

const candidates: VagueCandidateDTO[] = [
  { id: "vague-1", code: "VAG-001", statut: "EN_COURS", vaguePrevueId: null },
  { id: "vague-2", code: "VAG-002", statut: "EN_COURS", vaguePrevueId: "vp-autre" },
];

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

function mockFetchJson(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /Rattacher une vague réelle/i }));
}

/**
 * Sélectionne une vague candidate — le composant Select du dépôt est
 * `@radix-ui/react-select` (pas un <select> natif), donc l'interaction passe
 * par un clic sur le trigger (role="combobox") puis un clic sur l'option
 * affichée (role="option"), pas un `fireEvent.change`.
 */
async function selectVague(codeVisible: string) {
  const user = userEvent.setup({ delay: null });
  const trigger = screen.getByRole("combobox");
  await user.click(trigger);
  const option = await screen.findByRole("option", { name: new RegExp(codeVisible) });
  await user.click(option);
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

// ---------------------------------------------------------------------------
// Suite 1 — R5, structure du trigger
// ---------------------------------------------------------------------------

describe("RattacherVagueDialog — R5 DialogTrigger asChild", () => {
  it("le trigger est rendu comme un unique <button>, pas un bouton imbriqué dans un autre bouton", () => {
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    const boutons = screen.getAllByRole("button", { name: /Rattacher une vague réelle/i });
    expect(boutons).toHaveLength(1);
    expect(boutons[0].tagName).toBe("BUTTON");
    // asChild : aucun <button> imbriqué en interne (un DialogTrigger sans
    // asChild rendrait <button><button>...</button></button>)
    expect(boutons[0].querySelector("button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Cas nominal de rattachement
// ---------------------------------------------------------------------------

describe("RattacherVagueDialog — rattachement nominal", () => {
  it("n'affiche que les vagues candidates libres (vaguePrevueId === null)", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText(/VAG-001/)).toBeInTheDocument();
    expect(screen.queryByText(/VAG-002/)).not.toBeInTheDocument();
  });

  it("POST réussi : appelle onRattachee avec l'id de la vaguePrevue et ferme le dialog", async () => {
    mockFetchJson(200, { id: "vp-1" });
    const onRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={onRattachee}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(onRattachee).toHaveBeenCalledWith("vp-1");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/previsions/vagues-prevues/vp-1/rattacher",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ vagueId: "vague-1" }),
      })
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Rattacher" })).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — 409 VAGUE_PREVUE_DEJA_RATTACHEE déclenche la scission
// ---------------------------------------------------------------------------

describe("RattacherVagueDialog — 409 VAGUE_PREVUE_DEJA_RATTACHEE déclenche la scission", () => {
  it("appelle onDejaRattachee immédiatement et ferme le dialog de rattachement, sans passer par onRattachee", async () => {
    mockFetchJson(409, {
      status: 409,
      message: "Cette vague planifiee est deja rattachee.",
      code: "VAGUE_PREVUE_DEJA_RATTACHEE",
      vaguePrevueId: "vp-1",
    });
    const onRattachee = vi.fn();
    const onDejaRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={onRattachee}
        onDejaRattachee={onDejaRattachee}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(onDejaRattachee).toHaveBeenCalledWith("vp-1");
    });

    expect(onRattachee).not.toHaveBeenCalled();

    // Le dialog de rattachement se ferme (pas de message d'erreur générique laissé affiché)
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Rattacher" })).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Erreurs qui NE DOIVENT PAS déclencher la scission
// ---------------------------------------------------------------------------

describe("RattacherVagueDialog — erreurs qui ne déclenchent PAS la scission", () => {
  it("409 générique (sans code métier attendu) : affiche un message d'erreur, n'appelle pas onDejaRattachee", async () => {
    mockFetchJson(409, { message: "Conflit générique." });
    const onDejaRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={onDejaRattachee}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(screen.getByText("Conflit générique.")).toBeInTheDocument();
    });
    expect(onDejaRattachee).not.toHaveBeenCalled();
  });

  it("409 avec un code différent (ex. AUTRE_CONFLIT) n'ouvre pas la scission", async () => {
    mockFetchJson(409, { message: "Autre conflit.", code: "AUTRE_CONFLIT" });
    const onDejaRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={onDejaRattachee}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(screen.getByText("Autre conflit.")).toBeInTheDocument();
    });
    expect(onDejaRattachee).not.toHaveBeenCalled();
  });

  it("403 (permission refusée) : affiche l'erreur, n'ouvre pas la scission", async () => {
    mockFetchJson(403, { message: "Permission refusee." });
    const onDejaRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={onDejaRattachee}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(screen.getByText("Permission refusee.")).toBeInTheDocument();
    });
    expect(onDejaRattachee).not.toHaveBeenCalled();
  });

  it("500 (erreur serveur) : affiche l'erreur, n'ouvre pas la scission", async () => {
    mockFetchJson(500, { message: "Erreur interne." });
    const onDejaRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={onDejaRattachee}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur interne.")).toBeInTheDocument();
    });
    expect(onDejaRattachee).not.toHaveBeenCalled();
  });

  it("erreur réseau (fetch rejette) : affiche un message générique, n'ouvre pas la scission", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const onDejaRattachee = vi.fn();

    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={onDejaRattachee}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur réseau/i)).toBeInTheDocument();
    });
    expect(onDejaRattachee).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Bug B (PR2ter.2) : reinitialisation a la fermeture (impact
// faible ici, un seul champ Select, mais meme correction que les 9 autres
// dialogues du module par cohesion).
// ---------------------------------------------------------------------------

describe("RattacherVagueDialog — Bug B (PR2ter.2) : reinitialisation a la fermeture", () => {
  it("ouvrir -> selectionner une vague -> Annuler -> rouvrir : le select est vide (placeholder)", async () => {
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    await selectVague("VAG-001");
    expect(screen.getByRole("combobox")).toHaveTextContent("VAG-001");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    openDialog();
    expect(screen.getByRole("combobox")).not.toHaveTextContent("VAG-001");
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Bug A (PR2ter.2) : garde de fermeture quand une vague est
// selectionnee.
// ---------------------------------------------------------------------------

describe("RattacherVagueDialog — Bug A (PR2ter.2) : garde de fermeture quand une vague est selectionnee", () => {
  it("un dialogue sans selection se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  it("apres selection d'une vague, Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    await selectVague("VAG-001");

    await user.keyboard("{Escape}");

    expect(screen.getByRole("combobox")).toHaveTextContent("VAG-001");
  });

  it("le bouton Annuler reste fonctionnel meme apres selection d'une vague", async () => {
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    await selectVague("VAG-001");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  it("un dialogue sans selection se ferme normalement au clic exterieur", async () => {
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    await cliquerHorsDialogue();

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  it("apres selection d'une vague, un clic exterieur ne ferme PAS le dialogue", async () => {
    render(
      <RattacherVagueDialog
        vaguePrevue={vaguePrevue}
        vaguesCandidates={candidates}
        onRattachee={vi.fn()}
        onDejaRattachee={vi.fn()}
      />
    );

    openDialog();
    await selectVague("VAG-001");

    await cliquerHorsDialogue();

    expect(screen.getByRole("combobox")).toHaveTextContent("VAG-001");
  });
});
