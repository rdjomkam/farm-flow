// @vitest-environment jsdom
/**
 * Tests — RapprochementMappingTab (Sprint PR3-bis, story PR3bis.3, ADR-053
 * section 15, pre-analyse section 3).
 *
 * Couvre : rendu de la liste des categories non mappees, traduction de la
 * granulometrie en mm (jamais le code "G2" brut), etat vide explicite,
 * bandeau de portee site TOUJOURS visible, actions masquees sans
 * PREVISIONS_PARAMETRER.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RapprochementMappingTab } from "@/components/previsions/rapprochement-mapping-tab";
import { Permission, SourceRapprochement, CibleRapprochement } from "@/types";
import frPrevisions from "@/messages/fr/previsions.json";
import frStock from "@/messages/fr/stock.json";
import frDepenses from "@/messages/fr/depenses.json";
import frCommon from "@/messages/fr/common.json";

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  previsions: frPrevisions,
  stock: frStock,
  depenses: frDepenses,
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

const mockGet = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ get: mockGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

function mockApi(options: {
  nonMappees?: Array<{ sourceType: SourceRapprochement; sourceCle: string }>;
  mappingActif?: unknown[];
  version?: number | null;
  fail?: boolean;
  /**
   * CORRECTIF D2 : echec ISOLE de `postes`/`aliments` — `nonMappees` et
   * `mapping-rapprochement` reussissent quand meme (distinct de `fail`, qui
   * fait tout echouer).
   */
  failCibles?: boolean;
  postes?: Array<{ id: string; libelle: string }>;
  aliments?: Array<{ id: string; tailleGranule: string }>;
}) {
  mockGet.mockImplementation((url: string) => {
    if (options.fail) return Promise.resolve({ ok: false, data: null, error: "erreur" });
    if (url.includes("/non-mappees")) {
      return Promise.resolve({ ok: true, data: { data: options.nonMappees ?? [] } });
    }
    if (url.includes("/mapping-rapprochement")) {
      return Promise.resolve({ ok: true, data: { data: options.mappingActif ?? [], version: options.version ?? null } });
    }
    if (url.includes("/postes")) {
      if (options.failCibles) return Promise.resolve({ ok: false, data: null, error: "erreur reseau" });
      return Promise.resolve({ ok: true, data: { data: options.postes ?? [] } });
    }
    if (url.includes("/aliments")) {
      if (options.failCibles) return Promise.resolve({ ok: false, data: null, error: "erreur reseau" });
      return Promise.resolve({ ok: true, data: { data: options.aliments ?? [] } });
    }
    return Promise.resolve({ ok: true, data: { data: [] } });
  });
}

describe("RapprochementMappingTab — bandeau de portee (site, pas scenario)", () => {
  it("le bandeau de portee est toujours visible", async () => {
    mockApi({});
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText(/TOUT LE SITE/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle 2026-A/)).toBeInTheDocument();
  });
});

describe("RapprochementMappingTab — categories non mappees", () => {
  it("etat vide explicite : 'tout est mappe', jamais un tableau blanc", async () => {
    mockApi({ nonMappees: [] });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("Tout est mappé : aucune catégorie réelle sans correspondance sur ce site.")).toBeInTheDocument();
  });

  it("une granulometrie MOUVEMENT_STOCK est affichee en mm, jamais le code brut 'G3'", async () => {
    mockApi({
      nonMappees: [{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "G3" }],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("G3 — Granulé 4mm")).toBeInTheDocument();
    expect(screen.queryByText("G3", { exact: true })).not.toBeInTheDocument();
  });

  it("la granulometrie INCONNUE utilise la cle dediee, pas un code brut", async () => {
    mockApi({
      nonMappees: [{ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: "INCONNU" }],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("Granulométrie inconnue")).toBeInTheDocument();
  });

  it("une CategorieDepense non mappee est traduite via le referentiel depenses.categories existant", async () => {
    mockApi({
      nonMappees: [{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("Transport")).toBeInTheDocument();
  });

  it("le bouton Mapper n'apparait que si PREVISIONS_PARAMETRER est accordee", async () => {
    mockApi({
      nonMappees: [{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }],
    });

    const { rerender } = render(
      <RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />
    );
    await screen.findByText("Transport");
    expect(screen.queryByRole("button", { name: /Mapper/ })).not.toBeInTheDocument();

    rerender(
      <RapprochementMappingTab
        scenarioId="s1"
        scenarioNom="Cycle 2026-A"
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_PARAMETRER]}
      />
    );
    expect(await screen.findByRole("button", { name: /Mapper/ })).toBeInTheDocument();
  });
});

describe("RapprochementMappingTab — mapping actif", () => {
  it("affiche la version du mapping actif et ses lignes", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 5,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.POSTE_PREVISION,
          cibleId: "poste-1",
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText(/Version 5/)).toBeInTheDocument();
    expect(screen.getByText("Électricité")).toBeInTheDocument();
  });

  it("etat vide explicite quand aucun mapping actif n'existe sur le site", async () => {
    mockApi({ mappingActif: [], version: null });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect((await screen.findAllByText("Aucun mapping actif sur ce site pour le moment.")).length).toBeGreaterThan(0);
  });

  it("CORRECTIF C5 : le message d'etat vide n'apparait qu'UNE SEULE FOIS (pas en sous-titre ET en contenu)", async () => {
    mockApi({ mappingActif: [], version: null });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findAllByText("Aucun mapping actif sur ce site pour le moment.")).toHaveLength(1);
  });

  // Trou detecte pendant la verification finale (@tester, sprint PR3-bis-bis) :
  // le test precedent asserte sur le message d'etat vide du CONTENU, jamais
  // sur l'ABSENCE du sous-titre "Version {version}" lui-meme. Falsifier la
  // garde `version !== null` (l'afficher inconditionnellement) fait tomber
  // 0 test tant que ce test-ci n'existe pas, car le sous-titre affiche alors
  // "Version {version} — ..." (texte distinct du message d'etat vide), pas
  // un doublon de celui-ci. Ce test cible directement le sous-titre.
  it("CORRECTIF C5 (renforce) : aucun sous-titre de version n'est affiche quand version est null", async () => {
    mockApi({ mappingActif: [], version: null });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    await screen.findByText("Aucun mapping actif sur ce site pour le moment.");
    expect(screen.queryByText(/en vigueur pour tous les mois/)).not.toBeInTheDocument();
  });

  it("CORRECTIF C6 : deux mappings vers deux postes differents affichent des libelles differents, pas le meme badge indistinct", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 5,
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
          version: 5,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "TRANSPORT",
          cibleType: CibleRapprochement.POSTE_PREVISION,
          cibleId: "poste-2",
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
      postes: [
        { id: "poste-1", libelle: "Electricite du site" },
        { id: "poste-2", libelle: "Transport aliments" },
      ],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("Electricite du site")).toBeInTheDocument();
    expect(await screen.findByText("Transport aliments")).toBeInTheDocument();
  });

  it("CORRECTIF C6/C1 : une cible introuvable dans ce scenario (autre scenario) affiche un libelle explicite, jamais un id brut ni un vide silencieux", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 5,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.POSTE_PREVISION,
          cibleId: "poste-autre-scenario",
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
      postes: [{ id: "poste-1", libelle: "Electricite du site" }],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("Cible introuvable dans ce scénario")).toBeInTheDocument();
    expect(screen.queryByText("poste-autre-scenario")).not.toBeInTheDocument();
  });

  it("CORRECTIF D2 : quand postes/aliments echouent SEULS (nonMappees/mappingActif reussissent), l'ecran reste affiche et le libelle n'est jamais le mensonge 'introuvable dans ce scenario'", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 5,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.POSTE_PREVISION,
          cibleId: "poste-1",
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
      nonMappees: [{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }],
      failCibles: true,
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    // L'ecran reste utilisable : pas d'ecran d'erreur global, la liste des
    // non-mappees et le mapping actif restent visibles.
    expect(await screen.findByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("Électricité")).toBeInTheDocument();
    expect(screen.queryByText("Impossible de charger le mapping de rapprochement.")).not.toBeInTheDocument();

    // Le libelle honnete distingue "non chargee" de "introuvable dans ce
    // scenario" — le second mentirait sur la cause reelle (echec reseau).
    expect(screen.getByText("Cible non chargée")).toBeInTheDocument();
    expect(screen.queryByText("Cible introuvable dans ce scénario")).not.toBeInTheDocument();
  });

  it("le bouton Modifier n'apparait que si PREVISIONS_PARAMETRER est accordee", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 5,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.POSTE_PREVISION,
          cibleId: "poste-1",
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
    });

    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);
    await screen.findByText("Électricité");
    expect(screen.queryByRole("button", { name: /Modifier/ })).not.toBeInTheDocument();
  });
});

describe("RapprochementMappingTab — erreur reseau", () => {
  it("affiche un message d'erreur explicite (jamais un alert() nu, jamais un ecran vide silencieux)", async () => {
    mockApi({ fail: true });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    await waitFor(() => {
      expect(screen.getByText("Impossible de charger le mapping de rapprochement.")).toBeInTheDocument();
    });
  });
});

describe("RapprochementMappingTab — mobile-first (375px)", () => {
  it("aucun tableau, uniquement des cartes empilees", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    mockApi({
      nonMappees: [{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "TRANSPORT" }],
    });

    const { container } = render(
      <RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />
    );
    await screen.findByText("Transport");

    expect(container.querySelectorAll("table").length).toBe(0);
  });
});
