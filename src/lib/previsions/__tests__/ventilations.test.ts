/**
 * Story PR2q.4 — ventilations demandees par l'utilisateur (apports par
 * type, depenses par poste), au-dela du classeur de reference.
 *
 * Garanties testees :
 *  1. somme(ventilation par type d'apport) === apportsFCFA du mois — sur
 *     les 2 fixtures du jeu d'or ET sur un cas synthetique a 2 types
 *     (CAPITAL + CREDIT). Nuance importante (a ne pas laisser dans le
 *     flou, cf. consigne du sprint) : le classeur Excel de reference n'a
 *     qu'UNE seule ligne d'apports (`resultats.apportsCapital[mois]`,
 *     TOTAL, sans type) — aucune des 2 fixtures ne porte de repartition
 *     CAPITAL/CREDIT reelle. `plan-v12-corrige.json` a des totaux mensuels
 *     NON nuls (rapprochable : la somme des types reconstruit exactement
 *     ce total, meme si la repartition entre les 2 types est FORCEMENT
 *     inventee pour le test, cf. ERR-147 sur les distinctions absentes du
 *     jeu d'or) ; `annexe-b-corrigee.json` a un total nul sur les 21 mois
 *     (cas degenere, 0 === 0, qui a lui seul ne demontrerait rien — ce que
 *     couvre `plan-v12-corrige.json` en complement). Le cas synthetique a
 *     2 types reste la seule couverture reelle de la PARTITION par type.
 *  2. somme(ventilation par poste) + journalGeneral === baseRepartitionFCFA
 *     — y compris le cas NON degenere du piege 2 de la pre-analyse : un
 *     journal OPERATIONNEL avec `vaguePrevueId` non nul, qui doit rester
 *     HORS de la ventilation (comme il reste hors de `baseRepartitionFCFA`
 *     via `calculerBaseRepartition`).
 */
import { describe, it, expect } from "vitest";
import { CategorieJournalPrevu, TypeApportCapital } from "@/types";
import { Decimal } from "../decimal-config";
import { calculerBaseRepartition } from "../charges";
import {
  ventilerApportsParType,
  ventilerDepensesParPoste,
  type ApportVentilationInput,
  type ChargeVentilationInput,
  type PosteVentilationInput,
  type JournalVentilationInput,
} from "../ventilations";
import { loadGoldenFixture } from "./recette/helpers";

// `moisAbsoluDepuis` (route-orchestration.ts) compare des dates via
// `getFullYear()`/`getMonth()` — heure LOCALE, jamais UTC. Toutes les dates
// de ce fichier sont donc construites via le constructeur local
// `new Date(annee, moisIndex, jour)`, jamais une chaine ISO avec heure UTC
// implicite (qui glisserait de mois selon le fuseau de la machine qui
// execute le test).
const DATE_DEBUT = new Date(2026, 7, 1); // 2026-08-01, local

function sommeVentilationApports(
  ventilation: Record<string, Map<number, number>>,
  moisAbsolu: number
): number {
  return Object.values(ventilation).reduce((acc, m) => acc + (m.get(moisAbsolu) ?? 0), 0);
}

describe("ventilerApportsParType", () => {
  describe("jeu d'or — somme des types reconstruit exactement resultats.apportsCapital[mois] (total agrege, jamais la partition par type : le classeur n'a qu'une ligne d'apports)", () => {
    for (const fixtureName of ["plan-v12-corrige.json", "annexe-b-corrigee.json"] as const) {
      it(`${fixtureName}`, () => {
        const fixture = loadGoldenFixture(fixtureName);
        // Repartition CAPITAL/CREDIT INVENTEE (absente du classeur, cf.
        // JSDoc d'en-tete) : chaque mois non nul devient une seule ligne
        // d'apport, alternant de type pour exercer les 2 branches — seul
        // le TOTAL par mois est une vraie donnee du jeu d'or.
        const apports: ApportVentilationInput[] = fixture.resultats.apportsCapital
          .map((montant, moisAbsolu) => ({ montant, moisAbsolu }))
          .filter((x) => x.montant !== 0)
          .map(({ montant, moisAbsolu }, i) => ({
            date: new Date(DATE_DEBUT.getFullYear(), DATE_DEBUT.getMonth() + moisAbsolu, 15),
            montantFCFA: montant,
            type: i % 2 === 0 ? TypeApportCapital.CAPITAL : TypeApportCapital.CREDIT,
          }));

        const ventilation = ventilerApportsParType(apports, DATE_DEBUT);

        fixture.resultats.apportsCapital.forEach((attendu, moisAbsolu) => {
          expect(sommeVentilationApports(ventilation, moisAbsolu)).toBe(attendu);
        });
      });
    }
  });

  it("cas synthetique a 2 types — la somme des types vaut exactement apportsFCFA du mois, pour chaque mois", () => {
    const apports: ApportVentilationInput[] = [
      { date: new Date(2026, 7, 15), montantFCFA: 5_000_000, type: TypeApportCapital.CAPITAL },
      { date: new Date(2026, 7, 20), montantFCFA: 2_000_000, type: TypeApportCapital.CREDIT },
      { date: new Date(2026, 8, 5), montantFCFA: 1_500_000, type: TypeApportCapital.CAPITAL },
      { date: new Date(2026, 9, 1), montantFCFA: 0, type: TypeApportCapital.CREDIT },
    ];
    // apportsFCFA[mois] tel que le calculerait le moteur (route-orchestration.ts :
    // somme brute des montants du mois, quel que soit le type).
    const attenduParMois: Record<number, number> = { 0: 7_000_000, 1: 1_500_000, 2: 0 };

    const ventilation = ventilerApportsParType(apports, DATE_DEBUT);

    for (const [moisAbsolu, attendu] of Object.entries(attenduParMois)) {
      expect(sommeVentilationApports(ventilation, Number(moisAbsolu))).toBe(attendu);
    }
    // Les 2 types sont bien distingues (pas fusionnes en une seule cle).
    expect(ventilation[TypeApportCapital.CAPITAL]?.get(0)).toBe(5_000_000);
    expect(ventilation[TypeApportCapital.CREDIT]?.get(0)).toBe(2_000_000);
  });

  it("aucun apport — ventilation vide, somme 0", () => {
    const ventilation = ventilerApportsParType([], DATE_DEBUT);
    expect(sommeVentilationApports(ventilation, 0)).toBe(0);
    expect(Object.keys(ventilation)).toHaveLength(0);
  });
});

describe("ventilerDepensesParPoste", () => {
  it("cas simple, sans journal — somme(parPoste) + journalGeneral === calculerBaseRepartition du mois", () => {
    const postes: PosteVentilationInput[] = [
      { id: "poste-1", libelle: "Main-d'oeuvre", inclusBaseRepartition: true },
      { id: "poste-2", libelle: "Energie", inclusBaseRepartition: true },
      { id: "poste-3", libelle: "Poste hors base (memo)", inclusBaseRepartition: false },
    ];
    const charges: ChargeVentilationInput[] = [
      { posteId: "poste-1", moisAbsolu: 0, montantFCFA: 300_000 },
      { posteId: "poste-2", moisAbsolu: 0, montantFCFA: 150_000 },
      { posteId: "poste-3", moisAbsolu: 0, montantFCFA: 999_999 }, // hors base — ne doit apparaitre nulle part
    ];
    const journal: JournalVentilationInput[] = [];

    const { parPoste, journalGeneral } = ventilerDepensesParPoste(charges, postes, journal, DATE_DEBUT);

    const sommeVentilation =
      parPoste.reduce((acc, p) => acc + (p.parMois.get(0) ?? 0), 0) + (journalGeneral.get(0) ?? 0);

    // Reference moteur : calculerBaseRepartition (charges.ts), inchangee.
    const attendu = calculerBaseRepartition(
      [
        { montantFCFA: new Decimal(300_000), inclusBaseRepartition: true },
        { montantFCFA: new Decimal(150_000), inclusBaseRepartition: true },
        { montantFCFA: new Decimal(999_999), inclusBaseRepartition: false },
      ],
      []
    );

    expect(sommeVentilation).toBe(attendu.toNumber());
    expect(attendu.toNumber()).toBe(450_000);
    // Le poste hors base de repartition n'apparait dans aucune entree.
    expect(parPoste.find((p) => p.posteId === "poste-3")).toBeUndefined();
  });

  it("piege 2 (pre-analyse PR2q.4) — un journal OPERATIONNEL affecte a une vague reste HORS ventilation, comme il reste hors baseRepartitionFCFA (ADR-053 decision 6, ERR-154)", () => {
    const postes: PosteVentilationInput[] = [
      { id: "poste-1", libelle: "Loyer", inclusBaseRepartition: true },
    ];
    const charges: ChargeVentilationInput[] = [{ posteId: "poste-1", moisAbsolu: 0, montantFCFA: 200_000 }];
    const journal: JournalVentilationInput[] = [
      // General (pas de vague) — DOIT entrer dans journalGeneral.
      {
        date: new Date(2026, 7, 10),
        montantFCFA: 80_000,
        categorie: CategorieJournalPrevu.OPERATIONNEL,
        vaguePrevueId: null,
      },
      // Affecte a une vague — NE DOIT PAS entrer dans la ventilation (deja
      // compte dans la quote-part directe de cette vague, cf. ADR-053
      // decision 6 / calculerBaseRepartition).
      {
        date: new Date(2026, 7, 12),
        montantFCFA: 500_000,
        categorie: CategorieJournalPrevu.OPERATIONNEL,
        vaguePrevueId: "vague-prevue-1",
      },
      // Investissement — jamais quote-parte, hors ventilation.
      {
        date: new Date(2026, 7, 14),
        montantFCFA: 1_000_000,
        categorie: CategorieJournalPrevu.INVESTISSEMENT,
        vaguePrevueId: null,
      },
    ];

    const { parPoste, journalGeneral } = ventilerDepensesParPoste(charges, postes, journal, DATE_DEBUT);
    const sommeVentilation =
      parPoste.reduce((acc, p) => acc + (p.parMois.get(0) ?? 0), 0) + (journalGeneral.get(0) ?? 0);

    const attendu = calculerBaseRepartition(
      [{ montantFCFA: new Decimal(200_000), inclusBaseRepartition: true }],
      [
        { montantFCFA: new Decimal(80_000), categorie: CategorieJournalPrevu.OPERATIONNEL, vaguePrevueId: null },
        {
          montantFCFA: new Decimal(500_000),
          categorie: CategorieJournalPrevu.OPERATIONNEL,
          vaguePrevueId: "vague-prevue-1",
        },
        {
          montantFCFA: new Decimal(1_000_000),
          categorie: CategorieJournalPrevu.INVESTISSEMENT,
          vaguePrevueId: null,
        },
      ]
    );

    // 200 000 (poste) + 80 000 (journal general) = 280 000 — ni les 500 000
    // affectes a la vague, ni le 1 000 000 d'investissement.
    expect(attendu.toNumber()).toBe(280_000);
    expect(sommeVentilation).toBe(attendu.toNumber());
    expect(journalGeneral.get(0)).toBe(80_000);
  });
});
