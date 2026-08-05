/**
 * src/lib/previsions-presentation/__tests__/tresorerie-reelle-nette.test.ts
 *
 * Tests du netting mensuel/cumule de la serie RÉEL (ADR-053 §6.4/§6.5,
 * amendement §15.1/§15.5, sprint PR3-ter, story B.1).
 *
 * DISCIPLINE OBLIGATOIRE (meme protocole que
 * `src/lib/previsions/__tests__/rapprochement.test.ts`, ERR-142/ERR-160/
 * ERR-171/ERR-172) : aucun jeu d'or externe n'existe pour ce sous-module
 * (Depense/Vente/MouvementStock ne sont modelises dans aucune feuille du
 * classeur Previsions_Elevage_Silure_v12.xlsx). Chaque test appelle
 * EXCLUSIVEMENT les fonctions de production importees ci-dessous, sur des
 * `LigneRapprochement` construites via `construireLigneRapprochement`
 * (le vrai constructeur du moteur, jamais un objet litteral qui
 * contournerait ses garanties) — jamais une reimplementation locale du
 * netting dans le corps du test.
 *
 * Les fixtures sont concues pour FAIRE DIVERGER une implementation fautive
 * qui sommerait naivement `reel` sans distinguer signe/nature — voir le
 * tableau de falsification chiffree livre avec cette story.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../../previsions/decimal-config";
import { construireLigneRapprochement } from "../../previsions/rapprochement";
import type { LigneRapprochement } from "../../previsions/types";
import {
  netterTresorerieReelleParMois,
  netterTresorerieReelleCumulee,
} from "../tresorerie-reelle-nette";

const d = (n: number | string) => new Decimal(n);

/**
 * Fixture concue pour faire diverger un netting correct d'une simple somme
 * naive (ERR-160) : melange DEPENSE + ENTREE + QUANTITE + SANS_SOURCE_REELLE
 * sur un meme mois.
 */
function construireFixtureMois1(): LigneRapprochement[] {
  const depense = construireLigneRapprochement({
    id: "poste::alimentation::1",
    moisAbsolu: 1,
    libelle: "Alimentation",
    natureGrandeur: "DEPENSE",
    prevu: d(100_000),
    reel: d(80_000),
    statutRapprochement: "RAPPROCHE",
  });
  const entree = construireLigneRapprochement({
    id: "vente::ventePrevue::1",
    moisAbsolu: 1,
    libelle: "Ventes",
    natureGrandeur: "ENTREE",
    prevu: d(50_000),
    reel: d(200_000),
    statutRapprochement: "RAPPROCHE",
  });
  // QUANTITE : si melangee au FCFA, ferait exploser/fausser le solde monetaire
  // (story C2 du sprint : ne pas reproduire ce defaut ici).
  const quantite = construireLigneRapprochement({
    id: "granulometrie::G1::1",
    moisAbsolu: 1,
    libelle: "Aliment G1 (kg)",
    natureGrandeur: "QUANTITE",
    prevu: d(400),
    reel: d(500),
    statutRapprochement: "RAPPROCHE",
  });
  // SANS_SOURCE_REELLE : reel force a null par construireLigneRapprochement
  // (ADR-053 §15.1) — ne doit produire NI erreur NI contribution au solde.
  const sansSource = construireLigneRapprochement({
    id: "apport::subvention::1",
    moisAbsolu: 1,
    libelle: "Subvention (non modelisee cote reel)",
    natureGrandeur: "ENTREE",
    prevu: d(30_000),
    reel: d(999_999), // ignore : force a null par le constructeur (statut SANS_SOURCE_REELLE)
    statutRapprochement: "SANS_SOURCE_REELLE",
  });

  return [depense, entree, quantite, sansSource];
}

describe("netterTresorerieReelleParMois", () => {
  it("(a) nette DEPENSE (-) et ENTREE (+), exclut QUANTITE et SANS_SOURCE_REELLE — diverge d'une somme naive", () => {
    const lignes = construireFixtureMois1();
    const resultat = netterTresorerieReelleParMois(lignes);

    expect(resultat).toHaveLength(1);
    // Netting correct : -80 000 (DEPENSE) + 200 000 (ENTREE) = 120 000.
    // Une somme naive (agregerLignes-style, sans signe) donnerait
    // 80 000 + 200 000 = 280 000 — les deux valeurs DOIVENT diverger, sinon
    // ce test ne prouve rien (ERR-160).
    expect(resultat[0].moisAbsolu).toBe(1);
    expect(resultat[0].soldeNetFCFA.toNumber()).toBe(120_000);
    expect(resultat[0].soldeNetFCFA.toNumber()).not.toBe(280_000);
  });

  it("(b) porte le caveat des apports reels non modelises, non filtrable", () => {
    const resultat = netterTresorerieReelleParMois(construireFixtureMois1());
    expect(resultat[0].caveatApportsReelsNonModelises).toBe(true);
  });

  it("(c) une ligne DEPENSE seule produit un solde negatif (pas juste |reel|)", () => {
    const depenseSeule = construireLigneRapprochement({
      id: "poste::transport::2",
      moisAbsolu: 2,
      libelle: "Transport",
      natureGrandeur: "DEPENSE",
      prevu: d(10_000),
      reel: d(12_000),
      statutRapprochement: "RAPPROCHE",
    });
    const resultat = netterTresorerieReelleParMois([depenseSeule]);
    expect(resultat[0].soldeNetFCFA.toNumber()).toBe(-12_000);
  });

  it("(d) une ligne QUANTITE seule (sans aucune autre ligne monetaire) ne produit AUCUN mois", () => {
    const quantiteSeule = construireLigneRapprochement({
      id: "granulometrie::G2::3",
      moisAbsolu: 3,
      libelle: "Aliment G2 (kg)",
      natureGrandeur: "QUANTITE",
      prevu: d(200),
      reel: d(210),
      statutRapprochement: "RAPPROCHE",
    });
    const resultat = netterTresorerieReelleParMois([quantiteSeule]);
    expect(resultat).toHaveLength(0);
  });

  it("(e) tri par moisAbsolu croissant, plusieurs mois", () => {
    const mois5 = construireLigneRapprochement({
      id: "poste::x::5",
      moisAbsolu: 5,
      libelle: "X",
      natureGrandeur: "ENTREE",
      prevu: d(1_000),
      reel: d(1_000),
      statutRapprochement: "RAPPROCHE",
    });
    const mois2 = construireLigneRapprochement({
      id: "poste::y::2",
      moisAbsolu: 2,
      libelle: "Y",
      natureGrandeur: "DEPENSE",
      prevu: d(1_000),
      reel: d(1_000),
      statutRapprochement: "RAPPROCHE",
    });
    const resultat = netterTresorerieReelleParMois([mois5, mois2]);
    expect(resultat.map((r) => r.moisAbsolu)).toEqual([2, 5]);
  });
});

describe("netterTresorerieReelleCumulee", () => {
  /**
   * (f) LE PIEGE DE LA CUMULATION : le cumul doit etre la somme progressive
   * des deltas mensuels NETTES, pas une simple somme de |reel| ni un cumul
   * qui ignore le signe. Trois mois, DEPENSE puis ENTREE puis DEPENSE.
   */
  function construireFixtureTroisMois(): LigneRapprochement[] {
    const m1 = construireLigneRapprochement({
      id: "poste::a::1",
      moisAbsolu: 1,
      libelle: "A",
      natureGrandeur: "DEPENSE",
      prevu: d(50_000),
      reel: d(50_000),
      statutRapprochement: "RAPPROCHE",
    });
    const m2 = construireLigneRapprochement({
      id: "poste::b::2",
      moisAbsolu: 2,
      libelle: "B",
      natureGrandeur: "ENTREE",
      prevu: d(200_000),
      reel: d(200_000),
      statutRapprochement: "RAPPROCHE",
    });
    const m3 = construireLigneRapprochement({
      id: "poste::c::3",
      moisAbsolu: 3,
      libelle: "C",
      natureGrandeur: "DEPENSE",
      prevu: d(30_000),
      reel: d(30_000),
      statutRapprochement: "RAPPROCHE",
    });
    return [m1, m2, m3];
  }

  it("(f) cumul progressif nette — diverge d'un cumul de valeurs absolues", () => {
    const resultat = netterTresorerieReelleCumulee(construireFixtureTroisMois());

    expect(resultat).toHaveLength(3);
    // mois1 : -50 000
    expect(resultat[0].soldeNetFCFA.toNumber()).toBe(-50_000);
    // mois2 : -50 000 + 200 000 = 150 000
    expect(resultat[1].soldeNetFCFA.toNumber()).toBe(150_000);
    // mois3 : 150 000 - 30 000 = 120 000
    expect(resultat[2].soldeNetFCFA.toNumber()).toBe(120_000);

    // Un cumul de valeurs absolues (bug plausible) donnerait 50 000 / 250 000 / 280 000.
    expect(resultat[2].soldeNetFCFA.toNumber()).not.toBe(280_000);
  });

  it("(g) porte le caveat sur chaque ligne cumulee", () => {
    const resultat = netterTresorerieReelleCumulee(construireFixtureTroisMois());
    for (const ligne of resultat) {
      expect(ligne.caveatApportsReelsNonModelises).toBe(true);
    }
  });
});
