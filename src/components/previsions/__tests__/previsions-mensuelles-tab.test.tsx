// @vitest-environment jsdom
/**
 * Tests — PrevisionsMensuellesTab.
 *
 * Story PR2q.3 (compléter la vue Prévisions mensuelle, 22 lignes
 * supplémentaires) a introduit un regroupement en 4 sections repliables
 * ("Résultat" dépliée par défaut, "Production" / "Aliments" / "Entrées &
 * dépenses détaillées" repliées) — ce fichier a été adapté en conséquence :
 * les anciennes assertions sur des index de ligne fixes dans un unique
 * `<tbody>` ne sont plus valides (chaque section produit desormais son
 * propre `<tbody>`, avec une ligne d'en-tete repliable en premiere position).
 *
 * Correctif post-livraison (retour utilisateur, remplace la carte mobile) :
 * il n'existe plus qu'UN SEUL rendu (le tableau), a toutes les tailles
 * d'ecran — les anciens tests scopes sur `.md\\:hidden` (carte par mois,
 * navigation precedent/suivant) ont ete supprimes, il n'y a plus qu'un seul
 * `<table>` a recuperer, plus besoin de `within(table)` pour distinguer
 * "desktop" de "mobile" (il n'y a qu'un rendu). Ce que jsdom NE PEUT PAS
 * prouver ici (largeur reelle de la colonne collante a 375px, troncature,
 * degrade de bord, comportement du defilement au doigt) est verifie en
 * navigateur reel (Chromium, scenario EXCEL-V12) — voir le rapport de
 * verification associe a ce correctif, jamais affirme par un test jsdom
 * (cf. ERR-157).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrevisionsMensuellesTab } from "@/components/previsions/previsions-mensuelles-tab";
import type { MoisProjectionDTO } from "@/components/previsions/projection-types";
import type {
  ApportCapitalDTO,
  ChargeMensuellePrevueDTO,
  PostePrevisionDTO,
  JournalDepensePrevueDTO,
} from "@/components/previsions/api-types";
import { TypeApportCapital, TypePostePrevision, CategorieJournalPrevu } from "@/types";
import frPrevisions from "@/messages/fr/previsions.json";
import frStock from "@/messages/fr/stock.json";

const NAMESPACES: Record<string, unknown> = { previsions: frPrevisions, stock: frStock };

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
    const value = deepGet(NAMESPACES[namespace], key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

function buildMois(overrides: Partial<MoisProjectionDTO>): MoisProjectionDTO {
  return {
    moisAbsolu: 0,
    revenusFCFA: 0,
    coutAlimentsFCFA: 0,
    coutAlevinsFCFA: 0,
    baseRepartitionFCFA: 0,
    investissementsFCFA: 0,
    depensesFCFA: 0,
    apportsFCFA: 0,
    resultatFCFA: 0,
    epargneFCFA: 0,
    soldeFCFA: 0,
    empoissonneKg: 0,
    ventesKg: 0,
    alevinsACommanderNb: 0,
    besoinAlimentsTotalKg: 0,
    sacsAlimentsTotal: 0,
    sacsParGranulometrie: {},
    detailParVagueSacs: {},
    logistique: { voyagesAliments: 0, voyagesPoissons: 0, voyagesAlevins: 0, sousTotalFCFA: 0 },
    ...overrides,
  };
}

const mois: MoisProjectionDTO[] = [
  buildMois({
    moisAbsolu: 0,
    coutAlimentsFCFA: 10000,
    coutAlevinsFCFA: 50000,
    depensesFCFA: 60000,
    resultatFCFA: -60000,
    soldeFCFA: -60000,
    empoissonneKg: 4000,
    ventesKg: 0,
    alevinsACommanderNb: 11000,
    besoinAlimentsTotalKg: 600,
    sacsAlimentsTotal: 41,
    sacsParGranulometrie: { G1: 26, G2: 15 },
  }),
  buildMois({
    moisAbsolu: 1,
    coutAlimentsFCFA: 20000,
    depensesFCFA: 20000,
    resultatFCFA: -20000,
    soldeFCFA: -80000,
    empoissonneKg: 0,
    ventesKg: 4000,
    alevinsACommanderNb: 0,
    besoinAlimentsTotalKg: 2760,
    sacsAlimentsTotal: 184,
    sacsParGranulometrie: { G1: 32, G2: 152 },
  }),
];

/**
 * Story PR2q.4 — donnees BRUTES de ventilation (apports par type, charges
 * par poste). Mois de reference : moisAbsolu 0 = 2026-09 (dateDebutPlan des
 * tests ci-dessus), moisAbsolu 1 = 2026-10.
 */
const apports: ApportCapitalDTO[] = [
  {
    id: "apport-1",
    scenarioId: "scenario-1",
    date: "2026-09-10T00:00:00.000Z",
    libelle: "Apport fondateur",
    montantFCFA: 100000,
    type: TypeApportCapital.CAPITAL,
    siteId: "site-1",
  },
  {
    id: "apport-2",
    scenarioId: "scenario-1",
    date: "2026-09-15T00:00:00.000Z",
    libelle: "Emprunt bancaire",
    montantFCFA: 50000,
    type: TypeApportCapital.CREDIT,
    siteId: "site-1",
  },
];

const postes: PostePrevisionDTO[] = [
  {
    id: "poste-1",
    scenarioId: "scenario-1",
    libelle: "Loyer",
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: true,
    ordre: 1,
    siteId: "site-1",
    posteReferentielId: "ref-1",
    posteReferentiel: { libelle: "Loyer", actif: true },
  },
  {
    id: "poste-2",
    scenarioId: "scenario-1",
    libelle: "Poste hors base (memo)",
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: false,
    ordre: 2,
    siteId: "site-1",
    posteReferentielId: "ref-2",
    posteReferentiel: { libelle: "Poste hors base (memo)", actif: true },
  },
  {
    id: "poste-3",
    scenarioId: "scenario-1",
    libelle: "Salaires terrain",
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: true,
    ordre: 3,
    siteId: "site-1",
    posteReferentielId: "ref-3",
    // ADR-053 §16.12 — divergence deliberee (libelle scenario != libelle
    // referentiel) pour prouver que le suffixe compact "(réf. …)" apparait
    // bien dans "Dépenses — {poste}" (previsions-mensuelles-tab.tsx §579-585).
    posteReferentiel: { libelle: "Salaires équipe production", actif: true },
  },
];

const charges: ChargeMensuellePrevueDTO[] = [
  { id: "charge-1", scenarioId: "scenario-1", posteId: "poste-1", moisAbsolu: 0, montantFCFA: 70000, siteId: "site-1" },
  { id: "charge-2", scenarioId: "scenario-1", posteId: "poste-2", moisAbsolu: 0, montantFCFA: 999999, siteId: "site-1" },
  { id: "charge-3", scenarioId: "scenario-1", posteId: "poste-3", moisAbsolu: 0, montantFCFA: 30000, siteId: "site-1" },
];

const journal: JournalDepensePrevueDTO[] = [
  {
    id: "journal-1",
    scenarioId: "scenario-1",
    date: "2026-09-12T00:00:00.000Z",
    libelle: "Depense generale",
    categorie: CategorieJournalPrevu.OPERATIONNEL,
    montantFCFA: 15000,
    vaguePrevueId: null,
    siteId: "site-1",
  },
];

/**
 * Rend le composant et retourne son unique `<table>` — depuis le correctif
 * post-livraison, il n'y a plus qu'un seul rendu a toutes les tailles
 * d'ecran (plus de carte mobile distincte), donc plus de risque de "Found
 * multiple elements" par duplication de libelle : `within(table)` reste
 * utilise par habitude de scoping, pas par necessite de desambiguisation.
 */
function renderEtRecupererTable(moisProps: MoisProjectionDTO[] = mois) {
  const { container } = render(
    <PrevisionsMensuellesTab
      dateDebutPlan="2026-09-01T00:00:00.000Z"
      mois={moisProps}
      erreurProjection={null}
      apports={apports}
      charges={charges}
      postes={postes}
      journal={journal}
    />
  );
  const table = container.querySelector("table")!;
  expect(table).not.toBeNull();
  return { container, table };
}

describe("PrevisionsMensuellesTab — sections repliables (story PR2q.3)", () => {
  it("la section Résultat est dépliée par défaut, les 4 autres sont repliées", () => {
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    expect(dansTable.getByRole("button", { name: "Résultat" })).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Production", "Aliments", "Entrées & dépenses détaillées", "Ventilations (par type d'apport, par poste)"]) {
      expect(dansTable.getByRole("button", { name: label })).toHaveAttribute("aria-expanded", "false");
    }

    // La ligne "Total des entrées" (section Résultat, dépliée) est visible sans interaction.
    expect(dansTable.getByText("Total des entrées (FCFA)")).toBeInTheDocument();
    // La ligne "Coût aliments" (section repliée) n'est pas rendue tant que la section n'est pas ouverte.
    expect(dansTable.queryByText("Coût aliments (FCFA)")).not.toBeInTheDocument();
  });

  it("ouvrir la section Entrées & dépenses détaillées révèle ses lignes, y compris l'explication du coût alevins", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Entrées & dépenses détaillées" }));

    expect(dansTable.getByText("Coût alevins (FCFA)")).toBeInTheDocument();

    const bouton = dansTable.getByRole("button", { name: "Expliquer la ligne Coût alevins (FCFA)" });
    await user.click(bouton);

    const explication = await screen.findAllByText(/nombre d'alevins à commander/i);
    expect(explication.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/marge de sécurité alevins .*est appliquée ici/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/pas au revenu prévu ni au besoin en aliment/i).length
    ).toBeGreaterThan(0);
  });

  it("ouvrir la section Production révèle Empoissonné/Ventes en tonnes et Alevins à commander en entier", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Production" }));

    const ligneEmpoissonne = dansTable.getByText("Empoissonné (t)").closest("tr");
    expect(ligneEmpoissonne).not.toBeNull();
    // 4000 kg (mois 0) + 0 kg (mois 1) = 4,0 t au total (mois 1 affiché "–").
    // La colonne Total EST la meme valeur (somme, un seul mois non nul) : 2 occurrences attendues.
    expect(within(ligneEmpoissonne!).getAllByText(/4,0 t/)).toHaveLength(2);

    const ligneAlevins = dansTable.getByText("Alevins à commander (nb)").closest("tr");
    expect(ligneAlevins).not.toBeNull();
    // 11000 (mois 0) + 0 (mois 1) = 11 000, format entier (pas de décimale).
    // La colonne Total EST la meme valeur (somme, un seul mois non nul) : 2 occurrences attendues.
    expect(within(ligneAlevins!).getAllByText("11 000")).toHaveLength(2);
  });

  it("ouvrir la section Aliments révèle le détail par granulométrie (dynamique, pas codé en dur)", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));

    expect(dansTable.getByText("Besoin en aliments (kg)")).toBeInTheDocument();
    expect(dansTable.getByText("Sacs à acheter (total)")).toBeInTheDocument();
    // G1 -> "G1 — Granulé 2mm", G2 -> "G2 — Granulé 3mm" (cf. stock.json), jamais "2mm"/"3mm" en dur.
    expect(dansTable.getByText(/dont sacs G1 — Granulé 2mm/)).toBeInTheDocument();
    expect(dansTable.getByText(/dont sacs G2 — Granulé 3mm/)).toBeInTheDocument();
    // G3 n'apparait dans aucun mois de la fixture : aucune ligne ne doit le mentionner.
    expect(dansTable.queryByText(/dont sacs G3/)).not.toBeInTheDocument();
  });
});

describe("PrevisionsMensuellesTab — sous-section 'Détail par mois de cycle' (story PR2sex.3)", () => {
  /**
   * Fixture dediee : 2 mois, positions de cycle {1, 2, 3} et granulometries
   * {G1, G2} presentes de facon variable selon le mois/la position — pour
   * verifier que la construction est bien un produit "positions reellement
   * presentes x granulometries reellement presentes" (jamais 1..3/2-3-4mm
   * codes en dur), avec des cles absentes traitees comme 0 (`?? 0`).
   */
  const moisDetail: MoisProjectionDTO[] = [
    buildMois({
      moisAbsolu: 0,
      sacsParGranulometrie: { G1: 26, G2: 15 },
      detailParVagueSacs: { 1: { G1: 100, G2: 50 }, 2: { G1: 10 } },
    }),
    buildMois({
      moisAbsolu: 1,
      sacsParGranulometrie: { G1: 32, G2: 152 },
      detailParVagueSacs: { 1: { G1: 20, G2: 5 }, 2: { G1: 30 }, 3: { G2: 7 } },
    }),
  ];

  it("est repliée par défaut sous 'Aliments', même une fois 'Aliments' ouverte", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));

    expect(dansTable.getByRole("button", { name: "Détail par mois de cycle" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(dansTable.queryByText(/consommés \(indicatif\)/)).not.toBeInTheDocument();
  });

  it("ouvrir la sous-section révèle les lignes dans l'ordre du classeur (position croissante x granulométrie)", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const libelles = Array.from(table.querySelectorAll("tbody tr td:first-child span.truncate"))
      .map((el) => el.textContent)
      .filter((texte): texte is string => !!texte && texte.includes("consommés"));

    // positions {1,2,3} (union réellement présente) x granulométries {G1,G2}
    // (union réellement présente), dans cet ordre — jamais 1..3/2-3-4mm codés en dur.
    expect(libelles).toEqual([
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle",
      "Sacs G2 — Granulé 3mm consommés (indicatif) — Mois 1 du cycle",
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 2 du cycle",
      "Sacs G2 — Granulé 3mm consommés (indicatif) — Mois 2 du cycle",
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 3 du cycle",
      "Sacs G2 — Granulé 3mm consommés (indicatif) — Mois 3 du cycle",
    ]);
  });

  it("totalMode 'somme' : le total de la ligne (position 1, G1) reproduit la somme des mois (100 + 20 = 120)", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const ligne = dansTable
      .getByText("Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle")
      .closest("tr")!;
    const cellules = Array.from(ligne.querySelectorAll("td")).map((td) => td.textContent ?? "");
    // libelle + 2 mois (100, 20) + total (120), format entier, sans décimale.
    expect(cellules).toHaveLength(4);
    expect(cellules[1]).toBe("100");
    expect(cellules[2]).toBe("20");
    expect(cellules[3]).toBe("120");
  });

  it("une combinaison (position, granulométrie) sans donnée sur aucun mois affiche 0 formaté en tiret (–), jamais une ligne absente", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    // Position 2 / G2 : jamais présente dans la fixture (0 sur les 2 mois).
    const ligne = dansTable
      .getByText("Sacs G2 — Granulé 3mm consommés (indicatif) — Mois 2 du cycle")
      .closest("tr")!;
    const cellules = Array.from(ligne.querySelectorAll("td")).map((td) => td.textContent ?? "");
    expect(cellules[1]).toBe("–");
    expect(cellules[2]).toBe("–");
    expect(cellules[3]).toBe("–");
  });

  it("chaque ligne du détail porte un bouton d'explication mentionnant ROUND, la position, et la distinction avec 'à acheter' (ceil)", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const label = "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle";
    await user.click(dansTable.getByRole("button", { name: `Expliquer la ligne ${label}` }));

    expect(await screen.findAllByText(/ROUND/)).not.toHaveLength(0);
    expect(screen.getAllByText(/À ACHETER/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/arrondi PAR EXCÈS, ceil/).length).toBeGreaterThan(0);
  });
});

describe("PrevisionsMensuellesTab — cycle paramétrable (vérification adverse @tester, story PR2sex.3)", () => {
  /**
   * Pré-analyse §2/§4 et plan numéroté point 4 : "jamais 1..3 codé en dur,
   * le cycle est paramétrable (`dureeCycleMois` peut différer de 3)". Ces
   * tests construisent des fixtures à N positions de cycle DIFFÉRENT de 3
   * (4 positions, puis 1 seule) pour prouver que `lignesDetailParVague`
   * dérive bien le nombre de lignes des données, jamais d'une constante.
   */
  it("un cycle à 4 positions (dureeCycleMois=4) rend 4 lignes (une par position), jamais 3", async () => {
    const user = userEvent.setup({ delay: null });
    const moisCycle4: MoisProjectionDTO[] = [
      buildMois({
        moisAbsolu: 0,
        sacsParGranulometrie: { G1: 10 },
        detailParVagueSacs: {
          1: { G1: 11 },
          2: { G1: 22 },
          3: { G1: 33 },
          4: { G1: 44 },
        },
      }),
    ];
    const { table } = renderEtRecupererTable(moisCycle4);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const libelles = Array.from(table.querySelectorAll("tbody tr td:first-child span.truncate"))
      .map((el) => el.textContent)
      .filter((texte): texte is string => !!texte && texte.includes("consommés"));

    expect(libelles).toEqual([
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle",
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 2 du cycle",
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 3 du cycle",
      "Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 4 du cycle",
    ]);
    // Aucune 5e ligne, aucun "Mois 5" — la borne vient des données, pas d'une constante.
    expect(dansTable.queryByText(/Mois 5 du cycle/)).not.toBeInTheDocument();
  });

  it("un cycle à 1 seule position rend UNE seule ligne, jamais 3 lignes avec 2 vides en dur", async () => {
    const user = userEvent.setup({ delay: null });
    const moisCycle1: MoisProjectionDTO[] = [
      buildMois({
        moisAbsolu: 0,
        sacsParGranulometrie: { G1: 10 },
        detailParVagueSacs: { 1: { G1: 99 } },
      }),
    ];
    const { table } = renderEtRecupererTable(moisCycle1);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const libelles = Array.from(table.querySelectorAll("tbody tr td:first-child span.truncate"))
      .map((el) => el.textContent)
      .filter((texte): texte is string => !!texte && texte.includes("consommés"));

    expect(libelles).toEqual(["Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle"]);
    expect(dansTable.queryByText(/Mois 2 du cycle/)).not.toBeInTheDocument();
    expect(dansTable.queryByText(/Mois 3 du cycle/)).not.toBeInTheDocument();
  });
});

describe("PrevisionsMensuellesTab — formats §7.4 : caractères Unicode EXACTS (vérification adverse @tester)", () => {
  /**
   * §7.4 exige : espace fine insécable U+202F comme séparateur de milliers,
   * zéro affiché en tiret U+2013 (PAS un simple hyphen-minus U+002D), aucune
   * décimale. Un test qui compare seulement l'apparence visuelle laisserait
   * passer un mauvais caractère (ex. espace normal U+0020, ou "-" U+002D) —
   * ce test compare les points de code un par un.
   */
  it("une valeur ≥ 1000 utilise U+202F (espace fine insécable) comme séparateur de milliers, jamais U+0020", async () => {
    const user = userEvent.setup({ delay: null });
    const moisDetail: MoisProjectionDTO[] = [
      buildMois({
        moisAbsolu: 0,
        sacsParGranulometrie: { G1: 10 },
        detailParVagueSacs: { 1: { G1: 1543 } },
      }),
    ];
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);
    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const cellule = dansTable.getAllByText(/1.543/)[0].textContent!;
    expect(cellule).toBe("1 543");
    expect(cellule).not.toContain(" ");
    expect(cellule).not.toMatch(/\d,\d/); // aucune décimale
  });

  it("une valeur nulle affiche le tiret U+2013 (en dash), jamais un hyphen-minus U+002D", async () => {
    const user = userEvent.setup({ delay: null });
    const moisDetail: MoisProjectionDTO[] = [
      buildMois({ moisAbsolu: 0, sacsParGranulometrie: { G1: 10 }, detailParVagueSacs: { 1: { G1: 0 } } }),
    ];
    const { table } = renderEtRecupererTable(moisDetail);
    const dansTable = within(table);
    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const ligne = dansTable
      .getByText("Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle")
      .closest("tr")!;
    const celluleValeur = ligne.querySelectorAll("td")[1];
    expect(celluleValeur.textContent).toBe("–");
    expect(celluleValeur.textContent).not.toBe("-");
  });

  it("le libellé de la ligne porte 'Sacs' comme unité — aucune unité répétée dans les cellules de valeur", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable([
      buildMois({
        moisAbsolu: 0,
        sacsParGranulometrie: { G1: 10 },
        detailParVagueSacs: { 1: { G1: 42 } },
      }),
    ]);
    const dansTable = within(table);
    await user.click(dansTable.getByRole("button", { name: "Aliments" }));
    await user.click(dansTable.getByRole("button", { name: "Détail par mois de cycle" }));

    const ligne = dansTable
      .getByText("Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle")
      .closest("tr")!;
    expect(ligne.textContent).toContain("Sacs");
    const cellulesValeurs = Array.from(ligne.querySelectorAll("td")).slice(1);
    cellulesValeurs.forEach((td) => expect(td.textContent).not.toMatch(/[Ss]acs/));
  });
});

describe("PrevisionsMensuellesTab — en-tete de section collant (correctif post-livraison, rendu reel Chromium)", () => {
  /**
   * Ce que jsdom NE PEUT PAS prouver ici : jsdom ne fait aucune mise en page
   * (pas de calcul de boite, pas de `position: sticky` reel, pas de defilement
   * horizontal). Ces tests verifient donc uniquement la STRUCTURE du DOM — une
   * cellule collante distincte, etroite, plutot qu'un unique `colSpan` couvrant
   * toute la largeur du tableau — jamais la position effective a l'ecran apres
   * defilement. Seule une verification de rendu reel (Chromium/Playwright,
   * scenario EXCEL-V12, deja effectuee pour ce correctif) peut confirmer que le
   * titre reste visible a `scrollLeft` maximum.
   */
  it("la cellule collante du titre de section ne couvre PAS toute la largeur (pas de colSpan {mois.length+2})", () => {
    const { table } = renderEtRecupererTable();
    const ligneEntete = within(table).getByRole("button", { name: "Résultat" }).closest("tr")!;
    const cellules = Array.from(ligneEntete.querySelectorAll("td"));

    // Exactement 2 cellules : la cellule collante (titre) + la bande de fond non collante.
    expect(cellules).toHaveLength(2);

    const [celluleCollante, celluleFond] = cellules;
    // La cellule qui porte le titre est collante et n'a AUCUN colSpan qui l'etale
    // sur les colonnes de mois (ancien bug : colSpan={mois.length + 2}).
    expect(celluleCollante.classList.contains("sticky")).toBe(true);
    expect(celluleCollante.hasAttribute("colspan")).toBe(false);
    expect(celluleCollante).toContainElement(within(ligneEntete).getByRole("button", { name: "Résultat" }));

    // La bande de fond couvre le reste (mois + colonne Total), jamais collante,
    // et ne porte aucun texte (le titre vit exclusivement dans la cellule collante).
    expect(celluleFond.classList.contains("sticky")).toBe(false);
    expect(celluleFond.getAttribute("colspan")).toBe(String(mois.length + 1));
    expect(celluleFond.textContent).toBe("");
  });

  it("le fond de la cellule collante est opaque (bg-muted), jamais semi-transparent", () => {
    const { table } = renderEtRecupererTable();
    const ligneEntete = within(table).getByRole("button", { name: "Résultat" }).closest("tr")!;
    const celluleCollante = ligneEntete.querySelector("td")!;

    expect(celluleCollante.classList.contains("bg-muted")).toBe(true);
    expect(celluleCollante.classList.contains("bg-muted/60")).toBe(false);
  });

  it("chaque section (pas seulement Résultat) suit la meme structure a 2 cellules", () => {
    const { table } = renderEtRecupererTable();
    for (const label of ["Production", "Aliments", "Entrées & dépenses détaillées", "Ventilations (par type d'apport, par poste)"]) {
      const ligneEntete = within(table).getByRole("button", { name: label }).closest("tr")!;
      expect(ligneEntete.querySelectorAll("td")).toHaveLength(2);
    }
  });

  it("la sous-section 'Détail par mois de cycle' (story PR2sex.3) réutilise EXACTEMENT le même motif à 2 cellules, jamais un colSpan pleine largeur", async () => {
    const user = userEvent.setup({ delay: null });
    const moisAvecDetail = [
      buildMois({ moisAbsolu: 0, sacsParGranulometrie: { G1: 26 }, detailParVagueSacs: { 1: { G1: 100 } } }),
    ];
    const { table } = renderEtRecupererTable(moisAvecDetail);
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Aliments" }));

    const ligneEnteteGroupe = dansTable.getByRole("button", { name: "Détail par mois de cycle" }).closest("tr")!;
    const cellules = Array.from(ligneEnteteGroupe.querySelectorAll("td"));

    expect(cellules).toHaveLength(2);
    const [celluleCollante, celluleFond] = cellules;
    expect(celluleCollante.classList.contains("sticky")).toBe(true);
    expect(celluleCollante.classList.contains("bg-muted")).toBe(true);
    expect(celluleCollante.hasAttribute("colspan")).toBe(false);
    expect(celluleFond.classList.contains("sticky")).toBe(false);
    expect(celluleFond.getAttribute("colspan")).toBe(String(moisAvecDetail.length + 1));
    expect(celluleFond.textContent).toBe("");
  });
});

describe("PrevisionsMensuellesTab — orientation du tableau desktop (correctif mise en forme)", () => {
  it("affiche un indicateur par ligne et un mois par colonne, pas l'inverse", () => {
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    // En-tete de colonnes : une colonne "Indicateur" (collante), une par mois, puis "Total".
    const headerCells = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(headerCells[0]).toBe("Indicateur");
    expect(headerCells).toContain("sept. 2026");
    expect(headerCells).toContain("oct. 2026");
    expect(headerCells[headerCells.length - 1]).toBe("Total");
    // 1 colonne indicateur + 2 mois + 1 colonne total = 4 colonnes.
    expect(headerCells).toHaveLength(4);

    // Ligne "Total des entrées" (section Résultat, dépliée par défaut) : 4 cellules
    // (libelle + 2 mois + total), l'unite FCFA n'apparait qu'une fois, dans le libelle.
    const ligneTotalEntrees = dansTable.getByText("Total des entrées (FCFA)").closest("tr")!;
    const cellules = Array.from(ligneTotalEntrees.querySelectorAll("td")).map((td) => td.textContent ?? "");
    expect(cellules).toHaveLength(4);
    expect(cellules[0]).toContain("Total des entrées (FCFA)");
    cellules.slice(1).forEach((texte) => {
      expect(texte).not.toMatch(/FCFA/);
    });
  });
});

describe("PrevisionsMensuellesTab — tableau unique a toutes les tailles (correctif post-livraison, remplace la carte mobile)", () => {
  /**
   * Ce que jsdom NE PEUT PAS prouver ici : la largeur reelle rendue de la
   * colonne collante a 375px, si le libelle est visuellement tronque, et si
   * le degrade de bord est effectivement visible plutot que recouvert.
   * Ces tests verifient uniquement la STRUCTURE : les classes de largeur/
   * troncature/defilement sont posees, et l'attribut `title` (filet de
   * secours accessible pour un libelle tronque) est present. La preuve de
   * rendu reel (Chromium, 375/768/1280px, scenario EXCEL-V12) est
   * documentee separement (cf. ERR-157).
   */
  it("n'affiche plus de vue carte mobile ni de navigation mois precedent/suivant : un seul <table>", () => {
    const { container } = renderEtRecupererTable();
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Mois précédent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mois suivant" })).not.toBeInTheDocument();
  });

  it("le conteneur de defilement confine le geste horizontal (overscroll-x-contain) pour ne jamais declencher la navigation du navigateur", () => {
    const { table } = renderEtRecupererTable();
    const conteneur = table.parentElement!;
    expect(conteneur.classList.contains("overflow-x-auto")).toBe(true);
    expect(conteneur.classList.contains("overscroll-x-contain")).toBe(true);
    expect(conteneur.classList.contains("touch-pan-x")).toBe(true);
  });

  it("la colonne collante porte un attribut title (filet accessible) et un libelle tronque (span truncate), sur les lignes comme sur les en-tetes de section", () => {
    const { table } = renderEtRecupererTable();
    const ligneTotalEntrees = within(table).getByText("Total des entrées (FCFA)").closest("td")!;
    expect(ligneTotalEntrees).toHaveAttribute("title", "Total des entrées (FCFA)");
    expect(ligneTotalEntrees.querySelector("span.truncate")).not.toBeNull();

    const celluleSection = within(table).getByRole("button", { name: "Résultat" }).closest("td")!;
    const boutonSection = within(table).getByRole("button", { name: "Résultat" });
    expect(boutonSection).toHaveAttribute("title", "Résultat");
    expect(celluleSection.querySelector("span.truncate")).not.toBeNull();
  });

  it("un indicateur de defilement (degrade de bord) est rendu, non interactif", () => {
    const { container } = renderEtRecupererTable();
    const degrade = container.querySelector('[aria-hidden="true"].pointer-events-none');
    expect(degrade).not.toBeNull();
  });
});

describe("PrevisionsMensuellesTab — colonne Total de la ligne cumulative (bugfix PR2q.1)", () => {
  it("la ligne 'Solde cumulé' totalise sur la dernière valeur mensuelle, pas une somme (réf. Prévisions!W35 = V35)", () => {
    const { table } = renderEtRecupererTable();
    const ligneSolde = within(table).getByText("Solde cumulé (FCFA)").closest("tr")!;
    const cellules = Array.from(ligneSolde.querySelectorAll("td")).map((td) => td.textContent ?? "");

    // Valeurs mensuelles de la fixture : soldeFCFA = -60000 puis -80000.
    // Somme (comportement buggé) = -140000. Dernière valeur (attendu) = -80000.
    const totalAffiche = cellules[cellules.length - 1];
    expect(totalAffiche).toContain("-80");
    expect(totalAffiche).not.toContain("-140");
  });

  it("le résultat cumulé (ligne 'Résultat du mois', totalMode somme) reproduit cumuls.resultatCumule du jeu d'or", () => {
    const { table } = renderEtRecupererTable();
    // -60000 (mois 0) + -20000 (mois 1) = -80000.
    const ligneResultat = within(table).getByText("Résultat du mois (FCFA)").closest("tr")!;
    const cellules = Array.from(ligneResultat.querySelectorAll("td")).map((td) => td.textContent ?? "");
    const totalAffiche = cellules[cellules.length - 1];
    expect(totalAffiche).toContain("-80");
  });

  it("une ligne non cumulative (ex. Dépenses totales) totalise bien par une somme des mois", () => {
    const { table } = renderEtRecupererTable();
    // 60000 (mois 0) + 20000 (mois 1) = 80000.
    const ligneDepenses = within(table).getByText("Dépenses totales (FCFA)").closest("tr")!;
    const cellules = Array.from(ligneDepenses.querySelectorAll("td")).map((td) => td.textContent ?? "");
    const totalAffiche = cellules[cellules.length - 1];
    expect(totalAffiche).toContain("80");
  });
});

describe("PrevisionsMensuellesTab — section Ventilations (story PR2q.4, apports par type / dépenses par poste)", () => {
  it("est repliée par défaut (§7.1 : jamais dépliée au premier écran)", () => {
    const { table } = renderEtRecupererTable();
    expect(
      within(table).getByRole("button", { name: "Ventilations (par type d'apport, par poste)" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(within(table).queryByText(/Apports — Capital propre/)).not.toBeInTheDocument();
  });

  it("ouvrir la section révèle la ventilation des apports par type et des dépenses par poste, avec les bonnes valeurs mensuelles", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Ventilations (par type d'apport, par poste)" }));

    // Apport-1 (100 000, CAPITAL) + apport-2 (50 000, CREDIT), tous deux en
    // moisAbsolu 0 (2026-09) — la fixture ne porte aucun apport en 2026-10.
    const ligneCapital = dansTable.getByText("Apports — Capital propre (FCFA)").closest("tr")!;
    expect(within(ligneCapital).getAllByText("100 000")[0]).toBeInTheDocument();

    const ligneCredit = dansTable.getByText("Apports — Crédit encaissé (FCFA)").closest("tr")!;
    expect(within(ligneCredit).getAllByText("50 000")[0]).toBeInTheDocument();

    // Charge du poste "Loyer" (inclusBaseRepartition = true) : 70 000 en moisAbsolu 0.
    const lignePoste = dansTable.getByText("Dépenses — Loyer (FCFA)").closest("tr")!;
    expect(within(lignePoste).getAllByText("70 000")[0]).toBeInTheDocument();

    // Journal général (OPERATIONNEL, sans vague) : 15 000 en moisAbsolu 0.
    const ligneJournal = dansTable
      .getByText("Dépenses — Journal général, non affecté à une vague (FCFA)")
      .closest("tr")!;
    expect(within(ligneJournal).getAllByText("15 000")[0]).toBeInTheDocument();

    // Le poste "Poste hors base (memo)" (inclusBaseRepartition = false) n'est
    // JAMAIS ventilé — comme il est exclu de baseRepartitionFCFA par le moteur
    // (calculerBaseRepartition, charges.ts).
    expect(dansTable.queryByText(/Poste hors base \(memo\)/)).not.toBeInTheDocument();
  });

  it("chaque ligne de ventilation porte son bouton d'explication (\"d'où vient ce nombre\")", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Ventilations (par type d'apport, par poste)" }));
    await user.click(dansTable.getByRole("button", { name: "Expliquer la ligne Dépenses — Loyer (FCFA)" }));

    const explication = await screen.findAllByText(/base de répartition/i);
    expect(explication.length).toBeGreaterThan(0);
  });

  it("ADR-053 §16.12 : le libellé d'une ligne « Dépenses — {poste} » porte le suffixe compact de rattachement quand le libellé scénario diverge du référentiel", async () => {
    const user = userEvent.setup({ delay: null });
    const { table } = renderEtRecupererTable();
    const dansTable = within(table);

    await user.click(dansTable.getByRole("button", { name: "Ventilations (par type d'apport, par poste)" }));

    // poste-3 ("Salaires terrain") a un referentiel divergent ("Salaires
    // équipe production") — le suffixe compact "(réf. …)" DOIT apparaitre
    // dans le libelle de la ligne, sans quoi le rattachement devient
    // invisible sur cet ecran (ERR-185 rejoue).
    const ligneDivergente = dansTable
      .getByText("Dépenses — Salaires terrain (réf. Salaires équipe production) (FCFA)")
      .closest("tr")!;
    expect(within(ligneDivergente).getAllByText("30 000")[0]).toBeInTheDocument();

    // Le poste "Loyer" (libelle == referentiel, actif) ne porte, lui,
    // JAMAIS de suffixe — sinon l'ecran serait surcharge d'une ligne
    // redondante sur le cas majoritaire (§16.12).
    expect(dansTable.getByText("Dépenses — Loyer (FCFA)")).toBeInTheDocument();
    expect(dansTable.queryByText(/Loyer \(réf\./)).not.toBeInTheDocument();
  });
});
