// @vitest-environment jsdom
/**
 * Tests — RapprochementTab et ses 4 vues (Sprint PR3, story PR3.7, ADR-053
 * section 15, §6.4 des exigences fonctionnelles).
 *
 * DISCIPLINE (ADR-053 section 15.6, ERR-171) : la fixture ci-dessous porte
 * DEJA `sens`/`couleur`/`ecartAbsolu`/`ecartPct` tranches (exactement ce
 * qu'une route/page Server produirait via `rapprochement-dto.ts`, qui
 * appelle exclusivement le moteur) — ce fichier ne verifie donc PAS le
 * moteur (deja couvert par `rapprochement.test.ts`/
 * `rapprochement-vagues.test.ts`), il verifie que le RENDU respecte ces
 * champs deja tranches sans les recalculer ni les inverser.
 *
 * ERR-157 : jsdom ne prouve AUCUNE garantie de mise en page (cartes
 * empilees sous `md:`, tableau a partir de `md:`, defilement horizontal,
 * couleur reellement RENDUE a l'ecran) — seule la STRUCTURE du DOM (texte
 * present, classes CSS posees) est verifiee ici. La verification visuelle
 * reelle a 375px/1280px est hors perimetre de ce fichier.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RapprochementTab } from "@/components/previsions/rapprochement-tab";
import type { RapprochementScenarioDTO } from "@/components/previsions/rapprochement-types";
import { StatutVaguePrevue, Permission } from "@/types";
import frPrevisions from "@/messages/fr/previsions.json";
import frStock from "@/messages/fr/stock.json";
import frDepenses from "@/messages/fr/depenses.json";

const NAMESPACES: Record<string, unknown> = {
  previsions: frPrevisions,
  stock: frStock,
  depenses: frDepenses,
};

// `RapprochementMappingTab` (5e sous-onglet) fait ses propres appels API au
// montage — non exercee tant que l'onglet "Mapping" n'est pas clique dans
// CE fichier de test (couvert par `rapprochement-mapping-tab.test.tsx`).
// `usePrevisionsApi` est neanmoins mocke ici pour eviter tout appel `fetch`
// reel si un test venait a cliquer sur cet onglet.
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({
    get: vi.fn().mockResolvedValue({ ok: true, data: { data: [] }, error: null }),
    post: vi.fn().mockResolvedValue({ ok: true, data: { data: [] }, error: null }),
    put: vi.fn().mockResolvedValue({ ok: true, data: null, error: null }),
    patch: vi.fn().mockResolvedValue({ ok: true, data: null, error: null }),
    del: vi.fn().mockResolvedValue({ ok: true, data: null, error: null }),
  }),
}));

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

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

/* ==================================================================== *
 * Fixture — deja tranchee (moteur), jamais recalculee dans ce fichier
 * ==================================================================== */

const DATE_DEBUT_PLAN = "2026-01-01T00:00:00.000Z";

const FIXTURE: RapprochementScenarioDTO = {
  horizonMois: 2,
  dateDebutPlan: DATE_DEBUT_PLAN,
  moisDisponibles: [0, 1],
  lignesParMois: {
    0: [
      {
        id: "posteA::0",
        moisAbsolu: 0,
        libelle: "Électricité",
        natureGrandeur: "DEPENSE",
        prevu: 100_000,
        reel: 150_000,
        statutRapprochement: "RAPPROCHE",
        ecartAbsolu: 50_000,
        ecartPct: 0.5,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
      {
        id: "vente::0",
        moisAbsolu: 0,
        libelle: "Tonnage récolté",
        natureGrandeur: "QUANTITE",
        prevu: 1000,
        reel: 1200,
        statutRapprochement: "RAPPROCHE",
        ecartAbsolu: 200,
        ecartPct: 0.2,
        sens: "FAVORABLE",
        couleur: "vert",
      },
      {
        id: "posteNonBudgete::0",
        moisAbsolu: 0,
        libelle: "Carburant (non budgété)",
        natureGrandeur: "DEPENSE",
        prevu: 0,
        reel: 75_000,
        statutRapprochement: "RAPPROCHE",
        ecartAbsolu: 75_000,
        ecartPct: null,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
      {
        id: "APPORT_CAPITAL::0",
        moisAbsolu: 0,
        libelle: "Apports en capital",
        natureGrandeur: "ENTREE",
        prevu: 300_000,
        reel: null,
        statutRapprochement: "SANS_SOURCE_REELLE",
        ecartAbsolu: null,
        ecartPct: null,
        sens: "NON_APPLICABLE",
        couleur: "neutre",
      },
    ],
    1: [],
  },
  // Story C.2 (PR3-ter) : deux totaux DISJOINTS — le total monetaire (FCFA,
  // lignes DEPENSE/ENTREE) exclut la ligne QUANTITE (tonnage recolte, 1000
  // prevu / 1200 reel dans `lignesParMois[0]`) ; le total quantite ne
  // contient QUE cette derniere. Un bug qui les remelangerait ferait
  // apparaitre 1000/1200 dans le total monetaire (valeurs `total*Monetaire`
  // ci-dessous ne les incluent PAS, contrairement a l'ancien
  // `totalMoisParMois` a un seul total qui les additionnait).
  totalMoisMonetaireParMois: {
    0: {
      totalPrevu: 400_000,
      totalReel: 465_000,
      totalEcartAbsolu: 63_800,
      nombreLignes: 4,
      nombreLignesSansSourceReelle: 1,
      nombreLignesNonRapprochees: 1,
    },
  },
  totalMoisQuantiteParMois: {
    0: {
      totalPrevu: 1000,
      totalReel: 1200,
      totalEcartAbsolu: 200,
      nombreLignes: 1,
      nombreLignesSansSourceReelle: 0,
      nombreLignesNonRapprochees: 0,
    },
  },
  nonRapprocheParMois: {
    0: [
      {
        id: "NON_RAPPROCHE::TRANSPORT::0",
        moisAbsolu: 0,
        libelle: "Non rapproché — TRANSPORT",
        natureGrandeur: "DEPENSE",
        prevu: 0,
        reel: 40_000,
        statutRapprochement: "NON_RAPPROCHE",
        ecartAbsolu: 40_000,
        ecartPct: null,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
    ],
    1: [],
  },
  // Story C.2 : memes bornes que le total mensuel, DEUX totaux cumules disjoints.
  cumuleGlobalMonetaireParMois: {
    0: {
      totalPrevu: 400_000,
      totalReel: 465_000,
      totalEcartAbsolu: 63_800,
      nombreLignes: 4,
      nombreLignesSansSourceReelle: 1,
      nombreLignesNonRapprochees: 1,
    },
    1: {
      totalPrevu: 400_000,
      totalReel: 465_000,
      totalEcartAbsolu: 63_800,
      nombreLignes: 4,
      nombreLignesSansSourceReelle: 1,
      nombreLignesNonRapprochees: 1,
    },
  },
  cumuleGlobalQuantiteParMois: {
    0: {
      totalPrevu: 1000,
      totalReel: 1200,
      totalEcartAbsolu: 200,
      nombreLignes: 1,
      nombreLignesSansSourceReelle: 0,
      nombreLignesNonRapprochees: 0,
    },
    1: {
      totalPrevu: 1000,
      totalReel: 1200,
      totalEcartAbsolu: 200,
      nombreLignes: 1,
      nombreLignesSansSourceReelle: 0,
      nombreLignesNonRapprochees: 0,
    },
  },
  cumuleParPosteParMois: {
    0: [
      {
        cle: "posteA",
        libelle: "Électricité",
        totalPrevu: 100_000,
        totalReel: 150_000,
        totalEcartAbsolu: 50_000,
        nombreLignes: 1,
        nombreLignesSansSourceReelle: 0,
        nombreLignesNonRapprochees: 0,
        natureGrandeur: "DEPENSE",
        ecartPct: 0.5,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
    ],
    1: [],
  },
  // Story C.2 (PR3-ter) : deux classements DISJOINTS — le monetaire (FCFA)
  // ne contient JAMAIS "Tonnage récolté" (kg), le classement quantite ne
  // contient QUE cette derniere.
  topEcartsMonetaireParMois: {
    0: [
      {
        id: "posteNonBudgete::0",
        moisAbsolu: 0,
        libelle: "Carburant (non budgété)",
        natureGrandeur: "DEPENSE",
        prevu: 0,
        reel: 75_000,
        statutRapprochement: "RAPPROCHE",
        ecartAbsolu: 75_000,
        ecartPct: null,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
      {
        id: "posteA::0",
        moisAbsolu: 0,
        libelle: "Électricité",
        natureGrandeur: "DEPENSE",
        prevu: 100_000,
        reel: 150_000,
        statutRapprochement: "RAPPROCHE",
        ecartAbsolu: 50_000,
        ecartPct: 0.5,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
    ],
    1: [],
  },
  topEcartsQuantiteParMois: {
    0: [
      {
        id: "vente::0",
        moisAbsolu: 0,
        libelle: "Tonnage récolté",
        natureGrandeur: "QUANTITE",
        prevu: 1000,
        reel: 1200,
        statutRapprochement: "RAPPROCHE",
        ecartAbsolu: 200,
        ecartPct: 0.2,
        sens: "FAVORABLE",
        couleur: "vert",
      },
    ],
    1: [],
  },
  vagues: [
    {
      vaguePrevueId: "vp1",
      codePrevu: "V1",
      statut: StatutVaguePrevue.REALISEE,
      vagueReelleId: "v1",
      codeReel: "V1R",
      realisee: true,
      coutComplet: {
        prevu: 1_000_000,
        reel: 1_200_000,
        ecartAbsolu: 200_000,
        ecartPct: 0.2,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
      marge: {
        prevu: 500_000,
        reel: 300_000,
        ecartAbsolu: -200_000,
        ecartPct: -0.4,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
      coutAuKg: {
        prevu: 2000,
        reel: 2400,
        ecartAbsolu: 400,
        ecartPct: 0.2,
        sens: "DEFAVORABLE",
        couleur: "rouge",
      },
    },
    {
      vaguePrevueId: "vp2",
      codePrevu: "V2",
      statut: StatutVaguePrevue.PLANIFIEE,
      vagueReelleId: null,
      codeReel: null,
      realisee: false,
      coutComplet: { prevu: 500_000, reel: null, ecartAbsolu: null, ecartPct: null, sens: "NON_APPLICABLE", couleur: "neutre" },
      marge: { prevu: 250_000, reel: null, ecartAbsolu: null, ecartPct: null, sens: "NON_APPLICABLE", couleur: "neutre" },
      coutAuKg: { prevu: 1500, reel: null, ecartAbsolu: null, ecartPct: null, sens: "NON_APPLICABLE", couleur: "neutre" },
    },
  ],
  calculeLe: "2026-08-05T10:30:00.000Z",
};

function renderTab(fixture: RapprochementScenarioDTO = FIXTURE) {
  return render(
    <RapprochementTab
      rapprochement={fixture}
      scenarioId="scenario-1"
      scenarioNom="Scenario Test"
      permissions={[Permission.PREVISIONS_VOIR, Permission.PREVISIONS_PARAMETRER]}
    />
  );
}

/**
 * Selectionne un mois explicitement (jamais le mois par defaut du
 * selecteur, qui depend du mois calendaire COURANT au moment ou le test
 * s'execute — cf. `moisParDefaut`, `rapprochement-tab.tsx` — un test ne
 * doit jamais dependre de la date reelle du jour ou il tourne).
 */
async function selectMonth(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("RapprochementTab", () => {
  it("affiche le bandeau de fraicheur avec l'instant du calcul", () => {
    renderTab();
    expect(screen.getByText(/pas une photo figée d'un import passé/)).toBeInTheDocument();
  });

  it("vue mensuelle : affiche les lignes du mois selectionne, exclut NON_RAPPROCHE de la liste principale", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    expect(screen.getAllByText("Électricité").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tonnage récolté").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carburant (non budgété)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Apports en capital").length).toBeGreaterThan(0);
  });

  it("le bac Non rapproché est VISIBLE et non vide quand une categorie existe", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    expect(screen.getAllByText("Non rapproché").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Non rapproché — TRANSPORT").length).toBeGreaterThan(0);
  });

  it("le bac Non rapproché affiche explicitement 'aucune categorie' quand il est vide (mois 1)", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /fevr\.? 2026/i);

    expect(screen.getAllByText("Aucune catégorie non rapprochée ce mois.").length).toBeGreaterThan(0);
  });

  it("SANS_SOURCE_REELLE : affiche le libelle explicite, jamais un montant ni '0'", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    const messages = screen.getAllByText("Pas de source réelle disponible pour ce poste");
    expect(messages.length).toBeGreaterThan(0);
  });

  it("prevu = 0, reel > 0 : ecart % affiche N/A, jamais 0 %, NaN ou Infinity", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    const naTexts = screen.getAllByText("N/A");
    expect(naTexts.length).toBeGreaterThan(0);
    expect(screen.queryByText("0 %")).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity|∞/)).not.toBeInTheDocument();
  });

  it("sens defavorable rendu avec la classe rouge (text-danger), sens favorable avec la classe verte (text-success)", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    // Badge "Défavorable" pour l'Électricité (au moins un, mobile+desktop tous deux dans le DOM jsdom)
    const badgesDefavorable = screen.getAllByText("Défavorable");
    expect(badgesDefavorable.length).toBeGreaterThan(0);
    expect(badgesDefavorable[0].className).toMatch(/text-danger/);

    const badgesFavorable = screen.getAllByText("Favorable");
    expect(badgesFavorable.length).toBeGreaterThan(0);
    expect(badgesFavorable[0].className).toMatch(/text-success/);
  });

  it("vue par vague : distingue une vague realisee (code reel affiche) d'une vague non realisee (badge dedie, aucun chiffre reel)", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();

    await user.click(screen.getByRole("tab", { name: "Par vague" }));

    expect(screen.getAllByText("V1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vague réelle : V1R/).length).toBeGreaterThan(0);

    expect(screen.getAllByText("V2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Non réalisée").length).toBeGreaterThan(0);

    // V2 n'a AUCUN chiffre "reel" — les cellules "reel" de sa carte mobile
    // affichent "–", jamais "0" (verifie sur la premiere occurrence de V2,
    // la carte mobile empilee).
    const carteV2 = screen.getAllByText("V2")[0].closest("div")!;
    expect(within(carteV2.parentElement!).queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("bascule entre les 4 vues via les onglets", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    await user.click(screen.getByRole("tab", { name: "Vue cumulée" }));
    expect(screen.getAllByText(/Vue cumulée/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: "Top écarts" }));
    expect(screen.getAllByText(/Top 5 des écarts/).length).toBeGreaterThan(0);
    // Le poste non budgete (75 000) doit apparaitre avant l'Electricite (50 000)
    // dans le classement — deja trie par le moteur, jamais retrie ici.
    expect(screen.getAllByText("Carburant (non budgété)").length).toBeGreaterThan(0);
  });

  it("etat vide : aucun mois disponible -> message explicite, pas de crash", () => {
    renderTab({
      ...FIXTURE,
      moisDisponibles: [],
    });
    expect(screen.getByText(/Aucun rapprochement disponible/)).toBeInTheDocument();
  });

  it("etat vide : aucun mois disponible -> le sous-onglet Mapping reste accessible (site-scope, pas mensuel)", () => {
    renderTab({
      ...FIXTURE,
      moisDisponibles: [],
    });
    expect(screen.getByRole("tab", { name: "Mapping" })).toBeInTheDocument();
  });

  /* ==================================================================== *
   * Story C.2 (PR3-ter) : FCFA et kg ne sont jamais melanges sous un total
   * ou un classement unique.
   * ==================================================================== */

  it("vue mensuelle : 'Tonnage récolté' (kg) est formaté en tonnes, jamais en FCFA — et deux totaux distincts (FCFA / kg) sont affichés", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);

    // La ligne QUANTITE (1200 kg) est formatee "1,2 t", JAMAIS "1 200 FCFA".
    expect(screen.getAllByText("1,2 t").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 200 FCFA")).not.toBeInTheDocument();

    // Deux totaux distincts, jamais un seul total melangeant FCFA et kg.
    expect(screen.getAllByText(/Total du mois — montants \(FCFA\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Total du mois — quantités \(t\)/).length).toBeGreaterThan(0);
  });

  it("vue cumulée : deux totaux globaux distincts (FCFA / kg), jamais un total unique", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);
    await user.click(screen.getByRole("tab", { name: "Vue cumulée" }));

    expect(screen.getAllByText(/Total cumulé — montants \(FCFA\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Total cumulé — quantités \(t\)/).length).toBeGreaterThan(0);
  });

  it("Top écarts : deux classements DISJOINTS — 'Tonnage récolté' (kg) n'apparaît QUE dans la section quantités, jamais dans la section montants FCFA", async () => {
    const user = userEvent.setup({ delay: null });
    renderTab();
    await selectMonth(user, /janv\.? 2026/i);
    await user.click(screen.getByRole("tab", { name: "Top écarts" }));

    // Deux titres de section distincts, chacun avec son unite explicite.
    expect(screen.getAllByText(/Top 5 des écarts — montants FCFA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Top 5 des écarts — quantités \(t\)/).length).toBeGreaterThan(0);

    // La section "montants FCFA" ne contient NI "Tonnage récolté" NI "1,2 t"
    // — seule la section "quantités kg" les affiche.
    const sectionMonetaire = screen
      .getByText(/Top 5 des écarts — montants FCFA/)
      .closest(".rounded-xl") as HTMLElement;
    expect(within(sectionMonetaire).queryByText("Tonnage récolté")).not.toBeInTheDocument();

    const sectionQuantite = screen
      .getByText(/Top 5 des écarts — quantités \(t\)/)
      .closest(".rounded-xl") as HTMLElement;
    expect(within(sectionQuantite).getAllByText("Tonnage récolté").length).toBeGreaterThan(0);
    expect(within(sectionQuantite).getAllByText("1,2 t").length).toBeGreaterThan(0);
  });
});
