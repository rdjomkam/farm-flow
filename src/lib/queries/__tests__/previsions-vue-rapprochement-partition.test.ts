/**
 * src/lib/queries/__tests__/previsions-vue-rapprochement-partition.test.ts
 *
 * Sprint PR3-ter, story C.2 : preuve, par falsification (ERR-160/ERR-168),
 * que `partitionnerParGrandeur` (`previsions-vue-rapprochement.ts`) empeche
 * effectivement le melange FCFA/kg dans "Total du mois" et "Top ecarts".
 *
 * Test PUR (aucune DB) : appelle EXCLUSIVEMENT le moteur de production
 * (`agregerParMois`, `agregerCumule`, `topEcartsDuMois`,
 * `src/lib/previsions/rapprochement.ts`) et la fonction de partitionnement
 * de production (`partitionnerParGrandeur`, exportee pour ce test) — jamais
 * une reimplementation locale de la somme/du tri (ADR-053 §15.6 point 2,
 * ERR-171).
 *
 * Discipline ERR-160 : la fixture ci-dessous est concue pour FAIRE DIVERGER
 * "somme/tri naif sur les lignes melangees" et "somme/tri sur les lignes
 * partitionnees par nature" — un ecart QUANTITE (60 000, en kg) est
 * DELIBEREMENT plus grand qu'un des deux ecarts DEPENSE (50 000 FCFA) pour
 * qu'un top-2 naif evince ce dernier. Si les deux approches produisaient le
 * meme resultat, ce test ne prouverait rien (piege nomme explicitement par
 * ERR-160/ERR-172 dans le prompt de ce sprint).
 */
import { describe, it, expect } from "vitest";
import { agregerParMois, agregerCumule, topEcartsDuMois } from "@/lib/previsions/rapprochement";
import { Decimal } from "@/lib/previsions/decimal-config";
import type { LigneRapprochement } from "@/lib/previsions/types";
import { partitionnerParGrandeur } from "@/lib/queries/previsions-vue-rapprochement";

function ligne(partial: Partial<LigneRapprochement> & Pick<LigneRapprochement, "id" | "natureGrandeur" | "prevu" | "ecartAbsolu">): LigneRapprochement {
  return {
    moisAbsolu: 0,
    libelle: partial.id,
    reel: partial.prevu.plus(partial.ecartAbsolu ?? new Decimal(0)),
    statutRapprochement: "RAPPROCHE",
    ecartPct: null,
    sens: "NEUTRE",
    ...partial,
  };
}

// Deux lignes DEPENSE (FCFA) + une ligne QUANTITE (kg) — l'ecart QUANTITE
// (60 000) est PLUS GRAND que l'un des deux ecarts DEPENSE (50 000),
// deliberement, pour forcer une divergence de classement si les natures
// sont melangees (ERR-160).
const posteA = ligne({ id: "posteA", natureGrandeur: "DEPENSE", prevu: new Decimal(100_000), ecartAbsolu: new Decimal(50_000) });
const posteNonBudgete = ligne({ id: "posteNonBudgete", natureGrandeur: "DEPENSE", prevu: new Decimal(0), ecartAbsolu: new Decimal(75_000) });
const ligneQuantite = ligne({ id: "tonnage", natureGrandeur: "QUANTITE", prevu: new Decimal(1_000), ecartAbsolu: new Decimal(60_000) });

const lignesMelangees: LigneRapprochement[] = [posteA, posteNonBudgete, ligneQuantite];

describe("previsions-vue-rapprochement — partitionnerParGrandeur (story C.2, falsification ERR-160)", () => {
  it("separe strictement les lignes DEPENSE/ENTREE des lignes QUANTITE, sans perte ni doublon", () => {
    const { monetaires, quantites } = partitionnerParGrandeur(lignesMelangees);
    expect(monetaires.map((l) => l.id).sort()).toEqual(["posteA", "posteNonBudgete"]);
    expect(quantites.map((l) => l.id)).toEqual(["tonnage"]);
  });

  it("DIVERGENCE PROUVEE : agregerParMois sur les lignes MELANGEES produit un total FAUX (somme FCFA + kg) — different du total partitionne", () => {
    const totalMelange = agregerParMois(lignesMelangees)[0];
    const { monetaires } = partitionnerParGrandeur(lignesMelangees);
    const totalMonetairePartitionne = agregerParMois(monetaires)[0];

    // Le total melange inclut a tort le prevu QUANTITE (1000) dans la somme FCFA.
    expect(totalMelange.totalPrevu.toNumber()).toBe(101_000); // 100_000 (FCFA) + 1_000 (kg) — arithmetique sans sens
    expect(totalMonetairePartitionne.totalPrevu.toNumber()).toBe(100_000); // FCFA seul, correct

    // Les deux approches DIVERGENT — la preuve que la partition change reellement le resultat.
    expect(totalMelange.totalPrevu.toNumber()).not.toBe(totalMonetairePartitionne.totalPrevu.toNumber());
  });

  it("DIVERGENCE PROUVEE : agregerCumule sur les lignes MELANGEES produit un ecart cumule FAUX — different du cumul partitionne", () => {
    const cumulMelange = agregerCumule(lignesMelangees);
    const { monetaires, quantites } = partitionnerParGrandeur(lignesMelangees);
    const cumulMonetaire = agregerCumule(monetaires);
    const cumulQuantite = agregerCumule(quantites);

    // 50 000 (posteA) + 75 000 (posteNonBudgete) + 60 000 (tonnage, kg) = 185 000 — melange FCFA+kg.
    expect(cumulMelange.totalEcartAbsolu.toNumber()).toBe(185_000);
    expect(cumulMonetaire.totalEcartAbsolu.toNumber()).toBe(125_000); // FCFA seul
    expect(cumulQuantite.totalEcartAbsolu.toNumber()).toBe(60_000); // kg seul
    expect(cumulMelange.totalEcartAbsolu.toNumber()).not.toBe(cumulMonetaire.totalEcartAbsolu.toNumber());
  });

  it("DIVERGENCE PROUVEE (Top ecarts) : un top-2 NAIF sur les lignes MELANGEES evince un poste DEPENSE legitime au profit d'une ligne QUANTITE — le top-2 PARTITIONNE ne le fait jamais", () => {
    // Top-2 NAIF (bug potentiel) : trie TOUTES les lignes ensemble par |ecartAbsolu|.
    const topNaif = topEcartsDuMois(lignesMelangees, 0, 2);
    expect(topNaif.map((l) => l.id)).toEqual(["posteNonBudgete", "tonnage"]); // "posteA" (50 000 FCFA) EVINCE par "tonnage" (60 000 kg) !

    // Top-2 PARTITIONNE (fix, story C.2) : chaque nature a son propre classement.
    const { monetaires, quantites } = partitionnerParGrandeur(lignesMelangees);
    const topMonetaire = topEcartsDuMois(monetaires, 0, 2);
    const topQuantite = topEcartsDuMois(quantites, 0, 2);

    // "posteA" reste dans le classement monetaire (jamais evince par une ligne QUANTITE).
    expect(topMonetaire.map((l) => l.id)).toEqual(["posteNonBudgete", "posteA"]);
    expect(topQuantite.map((l) => l.id)).toEqual(["tonnage"]);

    // Preuve explicite de la divergence : le classement naif et le classement
    // monetaire partitionne ne contiennent PAS le meme ensemble de lignes.
    expect(topNaif.map((l) => l.id).sort()).not.toEqual(topMonetaire.map((l) => l.id).sort());
  });
});
