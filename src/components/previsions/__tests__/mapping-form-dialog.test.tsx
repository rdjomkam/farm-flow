// @vitest-environment jsdom
/**
 * Tests — MappingFormDialog (Sprint PR3-bis, stories PR3bis.4/PR3bis.5,
 * ADR-053 section 3.9).
 *
 * PIEGE CENTRAL (pre-analyse section "PIEGE CENTRAL", cf. en-tete du
 * composant) : le POST doit TOUJOURS porter le mapping actif COMPLET,
 * jamais une seule ligne — c'est le coeur de ce fichier de test.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MappingFormDialog } from "@/components/previsions/mapping-form-dialog";
import { SourceRapprochement, CibleRapprochement } from "@/types";
import frPrevisions from "@/messages/fr/previsions.json";
import frCommon from "@/messages/fr/common.json";
import frStock from "@/messages/fr/stock.json";
import frDepenses from "@/messages/fr/depenses.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  common: frCommon,
  stock: frStock,
  depenses: frDepenses,
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

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ get: mockGet, post: mockPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const MAPPING_ACTIF_EXISTANT = [
  {
    id: "m1",
    siteId: "site-1",
    version: 3,
    sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
    sourceCle: "ELECTRICITE",
    cibleType: CibleRapprochement.POSTE_PREVISION,
    cibleId: "poste-1",
    actif: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "m2",
    siteId: "site-1",
    version: 3,
    sourceType: SourceRapprochement.PRODUIT_CATEGORIE,
    sourceCle: "EQUIPEMENT",
    cibleType: CibleRapprochement.NON_RAPPROCHE,
    cibleId: null,
    actif: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    if (url.includes("/postes")) {
      return Promise.resolve({ ok: true, data: { data: [{ id: "poste-1", libelle: "Aliment", type: "CHARGE_EXPLOITATION", inclusBaseRepartition: true, ordre: 0, scenarioId: "s1", siteId: "site-1" }] } });
    }
    if (url.includes("/aliments")) {
      return Promise.resolve({ ok: true, data: { data: [] } });
    }
    if (url.includes("/mapping-rapprochement")) {
      return Promise.resolve({ ok: true, data: { data: MAPPING_ACTIF_EXISTANT, version: 3 } });
    }
    return Promise.resolve({ ok: true, data: { data: [] } });
  });
  mockPost.mockResolvedValue({ ok: true, data: { data: [...MAPPING_ACTIF_EXISTANT] } });
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
}

describe("MappingFormDialog — remplacement en bloc, jamais un POST partiel", () => {
  it("creation : le POST porte le mapping actif COMPLET (2 lignes existantes) + la nouvelle ligne (3 au total)", async () => {
    const user = userEvent.setup({ delay: null });
    const onSaved = vi.fn();
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }}
        trigger={<button>Ouvrir</button>}
        onSaved={onSaved}
      />
    );

    openDialog();

    // Choisir NON_RAPPROCHE — pas de cibleId requis, chemin le plus simple.
    const cibleTypeTrigger = screen.getByRole("combobox", { name: /^Cible\*/ });
    await user.click(cibleTypeTrigger);
    await user.click(await screen.findByRole("option", { name: "Non rapproché (aucune cible)" }));

    await user.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [, body] = mockPost.mock.calls[0];
    expect(body.lignes).toHaveLength(3);
    expect(body.lignes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "ELECTRICITE" }),
        expect.objectContaining({ sourceType: SourceRapprochement.PRODUIT_CATEGORIE, sourceCle: "EQUIPEMENT" }),
        expect.objectContaining({
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "TRANSPORT",
          cibleType: CibleRapprochement.NON_RAPPROCHE,
          cibleId: null,
        }),
      ])
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("edition : la ligne existante est REMPLACEE (meme sourceType+sourceCle), pas dupliquee — le total reste a 2", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "ELECTRICITE" }}
        existant={{ cibleType: CibleRapprochement.POSTE_PREVISION, cibleId: "poste-1" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [, body] = mockPost.mock.calls[0];
    expect(body.lignes).toHaveLength(2);
    const ligneElectricite = body.lignes.filter((l: { sourceCle: string }) => l.sourceCle === "ELECTRICITE");
    expect(ligneElectricite).toHaveLength(1);
  });

  it("POSTE_PREVISION sans cibleId choisi : la soumission est bloquee, aucun POST", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    const cibleTypeTrigger = screen.getByRole("combobox", { name: /^Cible\*/ });
    await user.click(cibleTypeTrigger);
    await user.click(await screen.findByRole("option", { name: "Poste de charge prévisionnel" }));

    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(await screen.findByText("Choisissez une cible précise pour ce type.")).toBeInTheDocument();
  });

  it("l'avertissement de portee scenario est affiche quand une cible precise est requise", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    const cibleTypeTrigger = screen.getByRole("combobox", { name: /^Cible\*/ });
    await user.click(cibleTypeTrigger);
    await user.click(await screen.findByRole("option", { name: "Poste de charge prévisionnel" }));

    expect(await screen.findByText(/Scenario A/)).toBeInTheDocument();
  });

  it("CORRECTIF C1/A.4 : pour POSTE_PREVISION, une cible referentiel introuvable/desactivee declenche l'avertissement DEDIE (jamais celui, scenario-scope, d'ALIMENT_PREVISION)", async () => {
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "ELECTRICITE" }}
        existant={{ cibleType: CibleRapprochement.POSTE_PREVISION, cibleId: "poste-referentiel-desactive-ou-absent" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();

    // "poste-1" est la seule entree PosteReferentiel chargee (cf. beforeEach,
    // site-scopee depuis A.4) — "poste-referentiel-desactive-ou-absent" n'y
    // figure pas : POSTE_PREVISION est desormais SITE-scope (ADR-053 §16),
    // donc ce n'est plus "un autre scenario" (message reserve a
    // ALIMENT_PREVISION, toujours scenario-scope) mais une entree referentiel
    // introuvable/desactivee — message DEDIE, texte distinct.
    expect(
      await screen.findByText(/ne correspond à aucune entrée active du référentiel des postes du site/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/n'appartient pas au scénario/)).not.toBeInTheDocument();
    expect(screen.getByText("Cible actuelle indisponible")).toBeInTheDocument();
  });

  it("CORRECTIF C1 : une cible existante appartenant a CE scenario ne declenche PAS l'avertissement hors-scenario", async () => {
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "ELECTRICITE" }}
        existant={{ cibleType: CibleRapprochement.POSTE_PREVISION, cibleId: "poste-1" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    await screen.findByRole("combobox", { name: /^Cible\*/ });

    expect(screen.queryByText(/n'appartient pas au scénario/)).not.toBeInTheDocument();
  });
});

describe("MappingFormDialog — correctif C3 : la relecture du mapping actif echoue au submit", () => {
  it("aucun POST n'est envoye si le GET du mapping actif echoue, un message d'erreur est affiche", async () => {
    // Falsification (a executer manuellement pour verifier ce test) : si le
    // garde `if (!mappingActuel.ok || !mappingActuel.data) { ...; return; }`
    // de mapping-form-dialog.tsx est retire, ce test echoue (soit parce que
    // `mockPost` est appele, soit parce qu'une exception non geree se
    // produit en essayant de lire `mappingActuel.data.data` sur `null`).
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/postes")) {
        return Promise.resolve({ ok: true, data: { data: [{ id: "poste-1", libelle: "Aliment", type: "CHARGE_EXPLOITATION", inclusBaseRepartition: true, ordre: 0, scenarioId: "s1", siteId: "site-1" }] } });
      }
      if (url.includes("/aliments")) {
        return Promise.resolve({ ok: true, data: { data: [] } });
      }
      if (url.includes("/mapping-rapprochement")) {
        return Promise.resolve({ ok: false, data: null, error: "erreur reseau" });
      }
      return Promise.resolve({ ok: true, data: { data: [] } });
    });

    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    // NON_RAPPROCHE est la valeur par defaut du selecteur : aucune saisie
    // supplementaire requise pour atteindre le submit le plus vite possible.
    await user.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(screen.getByText("Impossible de charger le mapping de rapprochement.")).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("MappingFormDialog — Sprint PR3-ter story A.2 : format compose ALIMENT_PREVISION (tailleGranule::id)", () => {
  const ALIMENTS_SCENARIO_COURANT = [
    { id: "aliment-g2", tailleGranule: "G2", scenarioId: "s1", siteId: "site-1", sacsParTonneStandard: null, ordre: 0, repartitions: [], articles: [] },
    { id: "aliment-g3", tailleGranule: "G3", scenarioId: "s1", siteId: "site-1", sacsParTonneStandard: null, ordre: 0, repartitions: [], articles: [] },
  ];

  function mockAvecAliments() {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/postes")) {
        return Promise.resolve({ ok: true, data: { data: [] } });
      }
      if (url.includes("/aliments")) {
        return Promise.resolve({ ok: true, data: { data: ALIMENTS_SCENARIO_COURANT } });
      }
      if (url.includes("/mapping-rapprochement")) {
        return Promise.resolve({ ok: true, data: { data: MAPPING_ACTIF_EXISTANT, version: 3 } });
      }
      return Promise.resolve({ ok: true, data: { data: [] } });
    });
  }

  it("creation : le cibleId POSTe pour ALIMENT_PREVISION est le format compose 'tailleGranule::id', jamais l'id brut du Select", async () => {
    mockAvecAliments();
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G3" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    const cibleTypeTrigger = screen.getByRole("combobox", { name: /^Cible\*/ });
    await user.click(cibleTypeTrigger);
    await user.click(await screen.findByRole("option", { name: "Calibre d'aliment prévisionnel" }));

    const cibleIdTrigger = screen.getByRole("combobox", { name: /Cible précise/ });
    await user.click(cibleIdTrigger);
    await user.click(await screen.findByRole("option", { name: "G3 — Granulé 4mm" }));

    await user.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [, body] = mockPost.mock.calls[0];
    const ligne = body.lignes.find((l: { sourceCle: string }) => l.sourceCle === "G3");
    expect(ligne.cibleId).toBe("G3::aliment-g3");
  });

  it("edition : une cible ALIMENT_PREVISION valide (tailleGranule presente dans le scenario courant) est resolue et reconstruite au format compose, meme si l'id d'origine differe", async () => {
    mockAvecAliments();
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G3" }}
        // cibleId compose porte l'id d'un AUTRE scenario ("aliment-scenario-a")
        // — la resolution doit passer par la tailleGranule G3, pas cet id.
        existant={{ cibleType: CibleRapprochement.ALIMENT_PREVISION, cibleId: "G3::aliment-scenario-a" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    // Aucun avertissement "hors scenario" : la tailleGranule G3 existe bien
    // dans le scenario courant (resolue vers aliment-g3).
    await screen.findByRole("combobox", { name: /Cible précise/ });
    expect(screen.queryByText("Cible actuelle hors de ce scénario")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [, body] = mockPost.mock.calls[0];
    const ligne = body.lignes.find((l: { sourceCle: string }) => l.sourceCle === "G3");
    // Recompose avec l'id DU SCENARIO COURANT (aliment-g3), jamais l'id
    // d'origine (aliment-scenario-a) porte par le cibleId compose existant.
    expect(ligne.cibleId).toBe("G3::aliment-g3");
  });

  it("edition : une cible ALIMENT_PREVISION ORPHELINE (tailleGranule absente du scenario courant) declenche l'avertissement hors-scenario et bloque la soumission tant qu'aucune nouvelle cible n'est choisie", async () => {
    mockAvecAliments();
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G5" }}
        // G5 n'existe pas dans ALIMENTS_SCENARIO_COURANT (seuls G2/G3) — orphelin.
        existant={{ cibleType: CibleRapprochement.ALIMENT_PREVISION, cibleId: "G5::aliment-ailleurs" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    expect(await screen.findByText("Cible actuelle indisponible")).toBeInTheDocument();
    expect(screen.getByText(/n'appartient pas au scénario/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    // Le sentinel orphelin n'est jamais une selection valide : aucun POST.
    expect(mockPost).not.toHaveBeenCalled();
    expect(await screen.findByText("Choisissez une cible précise pour ce type.")).toBeInTheDocument();
  });

  it("edition orpheline : choisir une NOUVELLE cible valide dans le scenario courant remplace la cible orpheline et compose le format attendu", async () => {
    mockAvecAliments();
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G5" }}
        existant={{ cibleType: CibleRapprochement.ALIMENT_PREVISION, cibleId: "G5::aliment-ailleurs" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    await screen.findByText("Cible actuelle indisponible");

    const cibleIdTrigger = screen.getByRole("combobox", { name: /Cible précise/ });
    await user.click(cibleIdTrigger);
    await user.click(await screen.findByRole("option", { name: "G2 — Granulé 3mm" }));

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [, body] = mockPost.mock.calls[0];
    const ligne = body.lignes.find((l: { sourceCle: string }) => l.sourceCle === "G5");
    expect(ligne.cibleId).toBe("G2::aliment-g2");
  });
});

describe("MappingFormDialog — garde de fermeture (ERR-145/ERR-146)", () => {
  it("un dialogue non touche se ferme normalement par Echap", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    expect(screen.getByRole("combobox", { name: /^Cible\*/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: /^Cible\*/ })).not.toBeInTheDocument();
    });
  });

  it("apres une modification (cibleType change), Echap ne ferme pas le dialogue", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MappingFormDialog
        scenarioId="s1"
        scenarioNom="Scenario A"
        source={{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }}
        trigger={<button>Ouvrir</button>}
        onSaved={vi.fn()}
      />
    );

    openDialog();
    // Le defaut du selecteur est deja NON_RAPPROCHE — choisir une AUTRE
    // valeur pour que `onValueChange` se declenche reellement (Radix ne le
    // declenche pas si l'option choisie est deja la valeur courante).
    const cibleTypeTrigger = screen.getByRole("combobox", { name: /^Cible\*/ });
    await user.click(cibleTypeTrigger);
    await user.click(await screen.findByRole("option", { name: "Poste de charge prévisionnel" }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("combobox", { name: /^Cible\*/ })).toBeInTheDocument();
  });
});
