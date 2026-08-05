// @vitest-environment jsdom
/**
 * Tests — RapprochementLignesListe (Sprint PR3-ter, story C.2).
 *
 * Comble le trou de couverture releve a la cloture du sprint
 * (`docs/tests/rapport-falsification-sprint-PR3-ter.md`, ligne C.2) :
 * aucun test ne visait DIRECTEMENT ce composant, seulement la vue
 * d'ensemble via `RapprochementTab` (`rapprochement-tab.test.tsx`).
 *
 * Ce fichier verifie isolement :
 * 1. `formatValeurSelonNature` — une ligne `QUANTITE` s'affiche en kg
 *    (via `formatTonnagePrevision`, donc en TONNES avec suffixe " t"),
 *    une ligne `DEPENSE`/`ENTREE` s'affiche en FCFA (`formatMontantPrevision`).
 * 2. `formatValeurSelonUnite` — meme regle pour les totaux deja
 *    partitionnes (`TotalAffichableDTO.unite`).
 * 3. Les totaux monetaires et les totaux de quantite restent SEPARES —
 *    jamais additionnes sous un total unique.
 *
 * ERR-160 (piege documente) : la fixture ci-dessous est construite pour
 * qu'un formatage correct et un formatage "tout mélangé en FCFA" produisent
 * des sorties DIFFERENTES et discriminables :
 * - une ligne DEPENSE de 1 200 000 FCFA -> "1 200 000 FCFA" correctement
 *   formatee, mais aussi si elle etait (a tort) traitee comme QUANTITE ->
 *   "1 200,0 t" (kg/1000) — les deux textes ne se recouvrent JAMAIS ;
 * - une ligne QUANTITE de 1 200 000 (kg) -> "1 200,0 t" correctement
 *   formatee, mais si elle etait (a tort) traitee comme DEPENSE ->
 *   "1 200 000 FCFA" — meme valeur numerique, deux rendus textuels
 *   disjoints. Un test qui ne verifierait que la PRESENCE d'un nombre
 *   (sans le suffixe "t"/"FCFA") passerait dans les deux cas et ne
 *   prouverait rien (ERR-160) — d'ou les assertions `queryByText` NEGATIVES
 *   ci-dessous, pas seulement des assertions positives.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  RapprochementLignesListe,
  type TotalAffichableDTO,
} from "@/components/previsions/rapprochement-lignes-liste";
import type { LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";
import frPrevisions from "@/messages/fr/previsions.json";

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") return (cur as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

// Meme mock que rapprochement-tab.test.tsx — un seul namespace ("previsions")
// suffit ici, le composant n'utilise jamais les namespaces "stock"/"depenses".
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const value = deepGet(namespace === "previsions" ? frPrevisions : {}, key);
    return typeof value === "string" ? value : key;
  },
}));

/* ==================================================================== *
 * Fixture — valeur numerique IDENTIQUE (1 200 000) portee par une ligne
 * DEPENSE (FCFA attendu) et une ligne QUANTITE (kg attendu) : le piege
 * ERR-160. Si le formatage par nature disparaissait, les deux lignes
 * afficheraient exactement le meme texte ("1 200 000 FCFA" ou
 * "1 200,0 t", peu importe lequel des deux formatteurs "gagne") — au lieu
 * de deux textes disjoints.
 * ==================================================================== */

const LIGNE_DEPENSE: LigneRapprochementDTO = {
  id: "poste::depense",
  moisAbsolu: 0,
  libelle: "Aliments (poste)",
  natureGrandeur: "DEPENSE",
  prevu: 1_200_000,
  reel: 1_200_000,
  statutRapprochement: "RAPPROCHE",
  ecartAbsolu: 0,
  ecartPct: 0,
  sens: "NEUTRE",
  couleur: "neutre",
};

const LIGNE_QUANTITE: LigneRapprochementDTO = {
  id: "granulo::quantite",
  moisAbsolu: 0,
  libelle: "Granulés 4mm",
  natureGrandeur: "QUANTITE",
  prevu: 1_200_000,
  reel: 1_200_000,
  statutRapprochement: "RAPPROCHE",
  ecartAbsolu: 0,
  ecartPct: 0,
  sens: "NEUTRE",
  couleur: "neutre",
};

const LIGNE_ENTREE: LigneRapprochementDTO = {
  id: "apport::entree",
  moisAbsolu: 0,
  libelle: "Apport en capital",
  natureGrandeur: "ENTREE",
  prevu: 500_000,
  reel: 500_000,
  statutRapprochement: "RAPPROCHE",
  ecartAbsolu: 0,
  ecartPct: 0,
  sens: "NEUTRE",
  couleur: "neutre",
};

const TOTAL_MONETAIRE: TotalAffichableDTO = {
  agregat: {
    totalPrevu: 1_700_000,
    totalReel: 1_700_000,
    totalEcartAbsolu: 0,
    nombreLignes: 2,
    nombreLignesSansSourceReelle: 0,
    nombreLignesNonRapprochees: 0,
  },
  unite: "MONETAIRE",
  labelKey: "rapprochementTab.totalRowMonetaire",
};

const TOTAL_QUANTITE: TotalAffichableDTO = {
  agregat: {
    totalPrevu: 1_200_000,
    totalReel: 1_200_000,
    totalEcartAbsolu: 0,
    nombreLignes: 1,
    nombreLignesSansSourceReelle: 0,
    nombreLignesNonRapprochees: 0,
  },
  unite: "QUANTITE",
  labelKey: "rapprochementTab.totalRowQuantite",
};

describe("RapprochementLignesListe — formatage par nature (story C.2)", () => {
  it("une ligne QUANTITE s'affiche en tonnes (kg / 1000, suffixe 't'), jamais en FCFA", () => {
    render(<RapprochementLignesListe lignes={[LIGNE_QUANTITE]} emptyLabel="vide" />);

    // Formatage correct : formatTonnagePrevision(1_200_000) => "1 200,0 t".
    expect(screen.getAllByText("1 200,0 t").length).toBeGreaterThan(0);
    // Piege ERR-160 : le meme nombre NE doit JAMAIS apparaitre sous forme FCFA.
    expect(screen.queryByText("1 200 000 FCFA")).not.toBeInTheDocument();
  });

  it("une ligne DEPENSE s'affiche en FCFA, jamais en tonnes", () => {
    render(<RapprochementLignesListe lignes={[LIGNE_DEPENSE]} emptyLabel="vide" />);

    expect(screen.getAllByText("1 200 000 FCFA").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 200,0 t")).not.toBeInTheDocument();
  });

  it("une ligne ENTREE s'affiche en FCFA (meme regle que DEPENSE), jamais en tonnes", () => {
    render(<RapprochementLignesListe lignes={[LIGNE_ENTREE]} emptyLabel="vide" />);

    expect(screen.getAllByText("500 000 FCFA").length).toBeGreaterThan(0);
    // Aucune valeur formatee tonnage (motif "<nombre>,<decimale> t") — pas
    // une regex trop large sur "t" seul (collision possible avec des
    // libelles/en-tetes non numeriques comme "Écart").
    expect(screen.queryByText(/^\d[\d\s]*,\d t$/)).not.toBeInTheDocument();
  });

  it("DEPENSE et QUANTITE portant la MEME valeur numerique produisent deux rendus DISJOINTS (piège ERR-160)", () => {
    render(<RapprochementLignesListe lignes={[LIGNE_DEPENSE, LIGNE_QUANTITE]} emptyLabel="vide" />);

    // Les deux formats coexistent — aucun n'a ecrase l'autre.
    expect(screen.getAllByText("1 200 000 FCFA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 200,0 t").length).toBeGreaterThan(0);

    // La carte MOBILE de la ligne QUANTITE ("Granulés 4mm") ne contient
    // AUCUN texte "FCFA" — on prend la première occurrence (carte mobile,
    // affichée avant le tableau desktop dans le DOM).
    const carteQuantite = screen.getAllByText("Granulés 4mm")[0].closest(".rounded-lg")!;
    expect(within(carteQuantite as HTMLElement).queryByText(/FCFA/)).not.toBeInTheDocument();

    // La carte MOBILE de la ligne DEPENSE ("Aliments (poste)") ne contient
    // AUCUN texte "1 200,0 t".
    const carteDepense = screen.getAllByText("Aliments (poste)")[0].closest(".rounded-lg")!;
    expect(within(carteDepense as HTMLElement).queryByText("1 200,0 t")).not.toBeInTheDocument();
  });

  it("SANS_SOURCE_REELLE : le libellé explicite s'affiche à la place du montant réel, jamais un chiffre", () => {
    const ligneSansSource: LigneRapprochementDTO = {
      ...LIGNE_QUANTITE,
      id: "granulo::sans-source",
      prevu: 456_000,
      reel: null,
      statutRapprochement: "SANS_SOURCE_REELLE",
      ecartAbsolu: null,
      ecartPct: null,
      sens: "NON_APPLICABLE",
      couleur: "neutre",
    };
    render(<RapprochementLignesListe lignes={[ligneSansSource]} emptyLabel="vide" />);

    expect(
      screen.getAllByText("Pas de source réelle disponible pour ce poste").length
    ).toBeGreaterThan(0);
    // La colonne "prevu" (natureGrandeur QUANTITE) affiche bien 456,0 t —
    // seule la colonne "reel" (null) est remplacée par le libellé explicite.
    expect(screen.getAllByText("456,0 t").length).toBeGreaterThan(0);
    expect(screen.queryByText(/FCFA/)).not.toBeInTheDocument();
  });
});

describe("RapprochementLignesListe — totaux déjà partitionnés (story C.2)", () => {
  // Fixture dediee : les lignes portent des valeurs DISTINCTES des totaux
  // (aucun nombre partage) pour que chaque assertion negative ci-dessous
  // soit non ambigue — condition ERR-160 stricte.
  const LIGNE_DEPENSE_CONTEXTE: LigneRapprochementDTO = {
    ...LIGNE_DEPENSE,
    id: "poste::contexte",
    libelle: "Électricité (contexte)",
    prevu: 42_000,
    reel: 42_000,
  };
  const LIGNE_QUANTITE_CONTEXTE: LigneRapprochementDTO = {
    ...LIGNE_QUANTITE,
    id: "granulo::contexte",
    libelle: "Granulés (contexte)",
    prevu: 300_000,
    reel: 300_000,
  };

  it("un total MONETAIRE s'affiche en FCFA, un total QUANTITE s'affiche en tonnes — jamais mélangés dans une même ligne", () => {
    render(
      <RapprochementLignesListe
        lignes={[LIGNE_DEPENSE_CONTEXTE, LIGNE_QUANTITE_CONTEXTE]}
        totaux={[TOTAL_MONETAIRE, TOTAL_QUANTITE]}
        emptyLabel="vide"
      />
    );

    // Total monetaire : 1 700 000 FCFA (formate via formatMontantPrevision).
    expect(screen.getAllByText("1 700 000 FCFA").length).toBeGreaterThan(0);
    // Total quantite : 1 200 000 kg => 1 200,0 t (formate via formatTonnagePrevision).
    expect(screen.getAllByText("1 200,0 t").length).toBeGreaterThan(0);

    // Piège ERR-160 : le total monétaire n'affiche jamais "1 700 000" en
    // tonnes, et le total quantité n'affiche jamais "1 200 000" en FCFA —
    // la valeur croisée n'apparaît nulle part (elle prouverait un mélange).
    // Ces valeurs de total (1 700 000 / 1 200 000) ne collisionnent avec
    // aucune ligne de contexte (42 000 / 300 000) : l'absence est non ambiguë.
    expect(screen.queryByText("1 700,0 t")).not.toBeInTheDocument();
    expect(screen.queryByText("1 200 000 FCFA")).not.toBeInTheDocument();
  });

  it("les deux totaux restent des agrégats DISTINCTS (jamais additionnés en un seul chiffre)", () => {
    render(
      <RapprochementLignesListe
        lignes={[LIGNE_DEPENSE_CONTEXTE, LIGNE_QUANTITE_CONTEXTE]}
        totaux={[TOTAL_MONETAIRE, TOTAL_QUANTITE]}
        emptyLabel="vide"
      />
    );

    // Si les totaux avaient été additionnés (1 700 000 + 1 200 000 =
    // 2 900 000), ce texte apparaîtrait — il ne doit jamais apparaître,
    // sous aucun des deux formats.
    expect(screen.queryByText(/2 900 000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2 900,0 t/)).not.toBeInTheDocument();
  });

  it("un total avec nombreLignes = 0 est filtré (n'affiche aucune ligne de total)", () => {
    const totalVide: TotalAffichableDTO = {
      agregat: { ...TOTAL_QUANTITE.agregat, nombreLignes: 0 },
      unite: "QUANTITE",
      labelKey: "rapprochementTab.totalRowQuantite",
    };
    render(
      <RapprochementLignesListe
        lignes={[LIGNE_DEPENSE_CONTEXTE]}
        totaux={[TOTAL_MONETAIRE, totalVide]}
        emptyLabel="vide"
      />
    );

    // Le total monétaire (nombreLignes > 0) est affiché...
    expect(screen.getAllByText("1 700 000 FCFA").length).toBeGreaterThan(0);
    // ...mais le total quantité vide (nombreLignes = 0) ne l'est pas : la
    // valeur "1 200,0 t" du total filtré n'apparaît nulle part.
    expect(screen.queryByText("1 200,0 t")).not.toBeInTheDocument();
  });

  it("aucune ligne et aucun total affichable -> message vide explicite", () => {
    render(<RapprochementLignesListe lignes={[]} emptyLabel="Aucune donnée disponible" />);
    expect(screen.getByText("Aucune donnée disponible")).toBeInTheDocument();
  });
});
