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
import userEvent from "@testing-library/user-event";
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
  /** Story C.3 (PR3-ter) : versions distinctes disponibles, decroissant — la premiere est la version active. */
  versions?: number[];
  /** Permet de fournir un mapping DIFFERENT quand `?version=` est explicitement demande (consultation historique). */
  mappingParVersion?: Record<number, unknown[]>;
}) {
  mockGet.mockImplementation((url: string) => {
    if (options.fail) return Promise.resolve({ ok: false, data: null, error: "erreur" });
    if (url.includes("/non-mappees")) {
      return Promise.resolve({ ok: true, data: { data: options.nonMappees ?? [] } });
    }
    // Verifier "/versions" AVANT le check generique "/mapping-rapprochement"
    // (substring commun aux deux routes) — sinon la route versions ne serait
    // jamais atteinte.
    if (url.includes("/mapping-rapprochement/versions")) {
      return Promise.resolve({ ok: true, data: { data: options.versions ?? [] } });
    }
    if (url.includes("/mapping-rapprochement")) {
      const matchVersion = url.match(/[?&]version=(\d+)/);
      if (matchVersion && options.mappingParVersion) {
        const v = Number(matchVersion[1]);
        return Promise.resolve({ ok: true, data: { data: options.mappingParVersion[v] ?? [], version: v } });
      }
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

describe("RapprochementMappingTab — Sprint PR3-ter story A.2 : cible orpheline (filet de securite non negociable)", () => {
  it("le GET du mapping actif porte ?scenarioId= (declenche l'augmentation cibleOrpheline cote serveur)", async () => {
    mockApi({});
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/previsions\/mapping-rapprochement\?scenarioId=s1$/),
        expect.anything()
      );
    });
  });

  it("une ligne cibleOrpheline: true affiche le message explicite dedie — distinct de 'Cible introuvable dans ce scénario' (formulaire) et de NON_RAPPROCHE", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 5,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.POSTE_PREVISION,
          cibleId: "poste-mort",
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          cibleOrpheline: true,
          cibleCleResolue: "poste-mort",
        },
      ],
      version: 5,
      postes: [],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(
      await screen.findByText(
        "Cible introuvable dans le plan actif — le montant réel associé n'apparaît dans aucun total"
      )
    ).toBeInTheDocument();
  });

  it("une ligne cibleOrpheline: false (ou absente) n'affiche JAMAIS le message d'orphelinite", async () => {
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
          cibleOrpheline: false,
        },
      ],
      version: 5,
      postes: [{ id: "poste-1", libelle: "Electricite du site" }],
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    await screen.findByText("Electricite du site");
    expect(
      screen.queryByText("Cible introuvable dans le plan actif — le montant réel associé n'apparaît dans aucun total")
    ).not.toBeInTheDocument();
  });

  it("FALSIFICATION — un mapping NON_RAPPROCHE (aucune cible) n'affiche jamais le message d'orphelinite, meme sans cibleOrpheline explicite", async () => {
    mockApi({
      mappingActif: [
        {
          id: "m2",
          siteId: "site-1",
          version: 5,
          sourceType: SourceRapprochement.PRODUIT_CATEGORIE,
          sourceCle: "EQUIPEMENT",
          cibleType: CibleRapprochement.NON_RAPPROCHE,
          cibleId: null,
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    await screen.findByText("Non rapproché (aucune cible)");
    expect(
      screen.queryByText("Cible introuvable dans le plan actif — le montant réel associé n'apparaît dans aucun total")
    ).not.toBeInTheDocument();
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

describe("RapprochementMappingTab — Sprint PR3-ter, story C.3 : navigation dans l'historique du mapping", () => {
  it("aucun mapping n'a jamais ete cree -> aucun selecteur de version affiche", async () => {
    mockApi({ versions: [] });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    await screen.findByText("Aucun mapping actif sur ce site pour le moment.");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("une seule version existe -> le selecteur affiche 'Version active (v1)', pas de bandeau de lecture seule", async () => {
    mockApi({
      versions: [1],
      mappingActif: [
        {
          id: "m1",
          siteId: "site-1",
          version: 1,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.NON_RAPPROCHE,
          cibleId: null,
          actif: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      version: 1,
    });
    render(<RapprochementMappingTab scenarioId="s1" scenarioNom="Cycle 2026-A" permissions={[Permission.PREVISIONS_VOIR]} />);

    expect(await screen.findByText("Version active (v1)")).toBeInTheDocument();
    expect(screen.queryByText(/affichage en lecture seule/)).not.toBeInTheDocument();
  });

  it("selectionner une version PASSEE affiche le bandeau de lecture seule, masque la carte 'categories non mappees' et le bouton Modifier", async () => {
    mockApi({
      versions: [2, 1],
      mappingActif: [
        {
          id: "m2",
          siteId: "site-1",
          version: 2,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.NON_RAPPROCHE,
          cibleId: null,
          actif: true,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      version: 2,
      mappingParVersion: {
        1: [
          {
            id: "m1",
            siteId: "site-1",
            version: 1,
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "TRANSPORT",
            cibleType: CibleRapprochement.NON_RAPPROCHE,
            cibleId: null,
            actif: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      nonMappees: [{ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: "EAU" }],
    });
    const user = userEvent.setup({ delay: null });
    render(
      <RapprochementMappingTab
        scenarioId="s1"
        scenarioNom="Cycle 2026-A"
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_PARAMETRER]}
      />
    );

    // Etat initial : version active (v2), carte "non mappees" visible, bouton Modifier present.
    await screen.findByText("Version active (v2)");
    expect(screen.getByText("Eau")).toBeInTheDocument(); // categorie non mappee (via referentiel depenses.categories)
    expect(await screen.findByRole("button", { name: /Modifier/ })).toBeInTheDocument();

    // Selectionne la version 1 (historique).
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Version 1 (historique)" }));

    // Bandeau explicite de lecture seule, mentionnant la version consultee ET la version active.
    expect(await screen.findByText(/Vous consultez la version 1/)).toBeInTheDocument();
    expect(screen.getByText(/La version active est la 2/)).toBeInTheDocument();

    // Le contenu affiche est celui de la version 1 (TRANSPORT), plus celui de v2 (ELECTRICITE).
    expect(await screen.findByText("Transport")).toBeInTheDocument();
    expect(screen.queryByText("Électricité")).not.toBeInTheDocument();

    // Carte "categories non mappees" masquee pendant la consultation d'une version passee.
    expect(screen.queryByText("Eau")).not.toBeInTheDocument();

    // Bouton Modifier masque en lecture seule stricte (ADR-053 §6.2), meme avec PREVISIONS_PARAMETRER.
    expect(screen.queryByRole("button", { name: /Modifier/ })).not.toBeInTheDocument();
  });

  it("FALSIFICATION — revenir a 'Version active' apres avoir consulte l'historique retire le bandeau et restaure les controles d'edition", async () => {
    mockApi({
      versions: [2, 1],
      mappingActif: [
        {
          id: "m2",
          siteId: "site-1",
          version: 2,
          sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
          sourceCle: "ELECTRICITE",
          cibleType: CibleRapprochement.NON_RAPPROCHE,
          cibleId: null,
          actif: true,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      version: 2,
      mappingParVersion: {
        1: [
          {
            id: "m1",
            siteId: "site-1",
            version: 1,
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "TRANSPORT",
            cibleType: CibleRapprochement.NON_RAPPROCHE,
            cibleId: null,
            actif: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });
    const user = userEvent.setup({ delay: null });
    render(
      <RapprochementMappingTab
        scenarioId="s1"
        scenarioNom="Cycle 2026-A"
        permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_PARAMETRER]}
      />
    );

    await screen.findByText("Version active (v2)");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Version 1 (historique)" }));
    expect(await screen.findByText(/Vous consultez la version 1/)).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Version active (v2)" }));

    expect(await screen.findByText("Électricité")).toBeInTheDocument();
    expect(screen.queryByText(/Vous consultez la version/)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Modifier/ })).toBeInTheDocument();
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
