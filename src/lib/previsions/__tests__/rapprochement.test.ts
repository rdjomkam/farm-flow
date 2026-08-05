/**
 * src/lib/previsions/__tests__/rapprochement.test.ts
 *
 * Tests du moteur de rapprochement prevu/reel (ADR-053 section 15,
 * amendement Sprint PR3, story PR3.4).
 *
 * DISCIPLINE OBLIGATOIRE (ADR-053 section 15.6, ERR-142/ERR-160/ERR-171) :
 * il n'existe AUCUN jeu d'or externe pour ce module. Chaque test ci-dessous
 * appelle EXCLUSIVEMENT les fonctions de production importees depuis
 * "../rapprochement" et compare a une valeur ATTENDUE ECRITE EN DUR,
 * calculee a la main dans le commentaire du test — jamais une
 * reimplementation locale de la formule (`reel.minus(prevu)` etc.) qui
 * "prouverait" le test contre lui-meme (ERR-171).
 *
 * Les fixtures (a)-(e) ci-dessous sont explicitement concues pour FAIRE
 * DIVERGER une implementation fautive (signe inverse, 0 au lieu de null,
 * mapping ignore silencieusement, sens favorable/defavorable permute) —
 * voir le rapport de falsification chiffree livre avec cette story.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  calculerEcart,
  calculerSensEcart,
  couleurPourSensEcart,
  construireLigneRapprochement,
  reconcilierPrevuEtReel,
  extraireBacNonRapproche,
  agregerParMois,
  agregerCumule,
  agregerParPoste,
  topEcartsDuMois,
  SEUILS_ECART_PAR_DEFAUT,
} from "../rapprochement";
import type {
  EntreePrevueRapprochement,
  EntreeReelleAgregee,
  MappingRapprochementActif,
} from "../rapprochement";
import type { LigneRapprochement } from "../types";

const d = (n: number | string) => new Decimal(n);

/* ==================================================================== *
 * 1. calculerEcart
 * ==================================================================== */

describe("calculerEcart", () => {
  it("(a) DEPENSE : reel > prevu -> ecartAbsolu positif", () => {
    const r = calculerEcart(d(100_000), d(120_000));
    expect(r.ecartAbsolu!.toNumber()).toBe(20_000); // 120000 - 100000, jamais 100000 - 120000
    expect(r.ecartPct!.toNumber()).toBeCloseTo(0.2, 10); // 20000 / |100000|
  });

  it("(a) DEPENSE : reel < prevu -> ecartAbsolu negatif", () => {
    const r = calculerEcart(d(100_000), d(80_000));
    expect(r.ecartAbsolu!.toNumber()).toBe(-20_000); // 80000 - 100000
    expect(r.ecartPct!.toNumber()).toBeCloseTo(-0.2, 10);
  });

  it("(a) QUANTITE/tonnage : reel > prevu -> ecartAbsolu positif (meme formule, signe non affecte par la nature)", () => {
    const r = calculerEcart(d(500), d(550)); // 500 kg prevu, 550 kg reel
    expect(r.ecartAbsolu!.toNumber()).toBe(50);
    expect(r.ecartPct!.toNumber()).toBeCloseTo(0.1, 10);
  });

  it("(a) QUANTITE/tonnage : reel < prevu -> ecartAbsolu negatif", () => {
    const r = calculerEcart(d(500), d(400));
    expect(r.ecartAbsolu!.toNumber()).toBe(-100);
    expect(r.ecartPct!.toNumber()).toBeCloseTo(-0.2, 10);
  });

  it("(b) prevu = 0, reel > 0 -> ecartAbsolu = reel, ecartPct = null (jamais Infinity/NaN/0)", () => {
    const r = calculerEcart(d(0), d(75_000));
    expect(r.ecartAbsolu!.toNumber()).toBe(75_000);
    expect(r.ecartPct).toBeNull();
    expect(Number.isFinite(r.ecartAbsolu!.toNumber())).toBe(true);
  });

  it("prevu = 0, reel = 0 -> ecartAbsolu = 0, ecartPct = null", () => {
    const r = calculerEcart(d(0), d(0));
    expect(r.ecartAbsolu!.toNumber()).toBe(0);
    expect(r.ecartPct).toBeNull();
  });

  it("(d) statut SANS_SOURCE_REELLE : reel = null -> ecartAbsolu et ecartPct null, jamais 0", () => {
    const r = calculerEcart(d(200_000), null);
    expect(r.ecartAbsolu).toBeNull();
    expect(r.ecartPct).toBeNull();
  });

  it("prevu negatif (rare mais possible, ex. tresorerie) : ecartPct utilise |prevu|", () => {
    const r = calculerEcart(d(-1000), d(-800)); // reel se rapproche de 0 : ecartAbsolu = 200
    expect(r.ecartAbsolu!.toNumber()).toBe(200);
    expect(r.ecartPct!.toNumber()).toBeCloseTo(0.2, 10); // 200 / |-1000|
  });
});

/* ==================================================================== *
 * 2. calculerSensEcart
 * ==================================================================== */

describe("calculerSensEcart", () => {
  it("(a) DEPENSE, reel > prevu -> DEFAVORABLE", () => {
    expect(calculerSensEcart("DEPENSE", d(20_000))).toBe("DEFAVORABLE");
  });

  it("(a) DEPENSE, reel < prevu -> FAVORABLE", () => {
    expect(calculerSensEcart("DEPENSE", d(-20_000))).toBe("FAVORABLE");
  });

  it("(a) ENTREE, reel > prevu -> FAVORABLE", () => {
    expect(calculerSensEcart("ENTREE", d(50_000))).toBe("FAVORABLE");
  });

  it("(a) ENTREE, reel < prevu -> DEFAVORABLE", () => {
    expect(calculerSensEcart("ENTREE", d(-50_000))).toBe("DEFAVORABLE");
  });

  it("(a) QUANTITE, reel > prevu -> FAVORABLE", () => {
    expect(calculerSensEcart("QUANTITE", d(50))).toBe("FAVORABLE");
  });

  it("(a) QUANTITE, reel < prevu -> DEFAVORABLE", () => {
    expect(calculerSensEcart("QUANTITE", d(-50))).toBe("DEFAVORABLE");
  });

  it("egalite stricte -> NEUTRE, quelle que soit la nature", () => {
    expect(calculerSensEcart("DEPENSE", d(0))).toBe("NEUTRE");
    expect(calculerSensEcart("ENTREE", d(0))).toBe("NEUTRE");
    expect(calculerSensEcart("QUANTITE", d(0))).toBe("NEUTRE");
  });

  it("(d) ecartAbsolu null (SANS_SOURCE_REELLE) -> NON_APPLICABLE, jamais un autre statut", () => {
    expect(calculerSensEcart("DEPENSE", null)).toBe("NON_APPLICABLE");
    expect(calculerSensEcart("ENTREE", null)).toBe("NON_APPLICABLE");
  });

  it("(b) prevu = 0, reel > 0, DEPENSE -> DEFAVORABLE (depense non budgetee, toujours signalee)", () => {
    const { ecartAbsolu } = calculerEcart(d(0), d(30_000));
    expect(calculerSensEcart("DEPENSE", ecartAbsolu)).toBe("DEFAVORABLE");
  });

  it("(b) prevu = 0, reel > 0, ENTREE -> FAVORABLE (recette non budgetee mais bien realisee)", () => {
    const { ecartAbsolu } = calculerEcart(d(0), d(30_000));
    expect(calculerSensEcart("ENTREE", ecartAbsolu)).toBe("FAVORABLE");
  });
});

/* ==================================================================== *
 * 3. couleurPourSensEcart
 * ==================================================================== */

describe("couleurPourSensEcart", () => {
  it("NEUTRE -> neutre", () => {
    expect(couleurPourSensEcart("NEUTRE", d(0))).toBe("neutre");
  });

  it("NON_APPLICABLE -> neutre, meme avec un ecartPct non null", () => {
    expect(couleurPourSensEcart("NON_APPLICABLE", d(0.5))).toBe("neutre");
  });

  it("(b) ecartPct null, DEFAVORABLE -> rouge (signale au niveau maximal, seuils ignores)", () => {
    expect(couleurPourSensEcart("DEFAVORABLE", null)).toBe("rouge");
  });

  it("(b) ecartPct null, FAVORABLE -> vert (signale au niveau maximal)", () => {
    expect(couleurPourSensEcart("FAVORABLE", null)).toBe("vert");
  });

  it("amplitude <= seuil vert (5%) : garde la teinte du sens", () => {
    expect(couleurPourSensEcart("FAVORABLE", d(0.03))).toBe("vert");
    expect(couleurPourSensEcart("DEFAVORABLE", d(-0.03))).toBe("rouge");
    // exactement au seuil (5%) : encore la teinte du sens (<=, pas <)
    expect(couleurPourSensEcart("FAVORABLE", d(0.05))).toBe("vert");
  });

  it("seuil vert < amplitude <= seuil orange (15%) : orange, quel que soit le sens", () => {
    expect(couleurPourSensEcart("FAVORABLE", d(0.1))).toBe("orange");
    expect(couleurPourSensEcart("DEFAVORABLE", d(-0.1))).toBe("orange");
    expect(couleurPourSensEcart("DEFAVORABLE", d(0.15))).toBe("orange"); // exactement au seuil
  });

  it("amplitude > seuil orange (15%) : teinte saturee du sens", () => {
    expect(couleurPourSensEcart("FAVORABLE", d(0.5))).toBe("vert");
    expect(couleurPourSensEcart("DEFAVORABLE", d(-0.5))).toBe("rouge");
  });

  it("seuils par defaut exposes et utilises implicitement", () => {
    expect(SEUILS_ECART_PAR_DEFAUT.vertPct.toNumber()).toBe(0.05);
    expect(SEUILS_ECART_PAR_DEFAUT.orangePct.toNumber()).toBe(0.15);
  });

  it("seuils personnalises respectes", () => {
    const seuils = { vertPct: d(0.01), orangePct: d(0.02) };
    expect(couleurPourSensEcart("FAVORABLE", d(0.015), seuils)).toBe("orange");
    expect(couleurPourSensEcart("FAVORABLE", d(0.005), seuils)).toBe("vert");
    expect(couleurPourSensEcart("FAVORABLE", d(0.05), seuils)).toBe("vert");
  });
});

/* ==================================================================== *
 * 4. construireLigneRapprochement
 * ==================================================================== */

describe("construireLigneRapprochement", () => {
  it("assemble ecarts + sens a partir d'une comparaison DEPENSE", () => {
    const ligne = construireLigneRapprochement({
      id: "poste-aliment::0",
      moisAbsolu: 0,
      libelle: "Aliment",
      natureGrandeur: "DEPENSE",
      prevu: d(500_000),
      reel: d(600_000),
      statutRapprochement: "RAPPROCHE",
    });
    expect(ligne.ecartAbsolu!.toNumber()).toBe(100_000);
    expect(ligne.ecartPct!.toNumber()).toBeCloseTo(0.2, 10);
    expect(ligne.sens).toBe("DEFAVORABLE");
  });

  it("(d) statutRapprochement SANS_SOURCE_REELLE force reel a null meme si l'appelant fournit une valeur par erreur", () => {
    const ligne = construireLigneRapprochement({
      id: "apport-subvention::3",
      moisAbsolu: 3,
      libelle: "Subvention",
      natureGrandeur: "ENTREE",
      prevu: d(1_000_000),
      reel: d(0), // fourni par erreur — ne doit JAMAIS etre affiche comme un reel = 0
      statutRapprochement: "SANS_SOURCE_REELLE",
    });
    expect(ligne.reel).toBeNull();
    expect(ligne.ecartAbsolu).toBeNull();
    expect(ligne.ecartPct).toBeNull();
    expect(ligne.sens).toBe("NON_APPLICABLE");
  });
});

/* ==================================================================== *
 * 5. reconcilierPrevuEtReel — (c) bac NON_RAPPROCHE, (d) SANS_SOURCE_REELLE
 * ==================================================================== */

describe("reconcilierPrevuEtReel", () => {
  const prevues: EntreePrevueRapprochement[] = [
    {
      cle: "poste-aliment",
      libelle: "Aliment",
      natureGrandeur: "DEPENSE",
      moisAbsolu: 0,
      montantPrevu: d(500_000),
    },
    {
      cle: "revenu-vente",
      libelle: "Vente prevue",
      natureGrandeur: "ENTREE",
      moisAbsolu: 0,
      montantPrevu: d(800_000),
    },
    {
      cle: "apport-subvention",
      libelle: "Subvention",
      natureGrandeur: "ENTREE",
      moisAbsolu: 0,
      montantPrevu: d(200_000),
      sansSourceReelle: true,
    },
  ];

  // ALIMENT mappe vers poste-aliment ; TRANSPORT (categorie reelle utilisee)
  // n'a AUCUNE entree de mapping -> doit finir dans NON_RAPPROCHE.
  const mapping: MappingRapprochementActif[] = [
    { sourceCle: "ALIMENT", cibleCle: "poste-aliment" },
    { sourceCle: "VENTE", cibleCle: "revenu-vente" },
  ];

  const reelles: EntreeReelleAgregee[] = [
    { categorieCle: "ALIMENT", moisAbsolu: 0, montantReel: d(520_000), natureGrandeur: "DEPENSE" },
    { categorieCle: "VENTE", moisAbsolu: 0, montantReel: d(750_000), natureGrandeur: "ENTREE" },
    // (c) categorie reelle sans mapping actif
    { categorieCle: "TRANSPORT", moisAbsolu: 0, montantReel: d(45_000), natureGrandeur: "DEPENSE" },
  ];

  it("(c) une categorie reelle sans mapping actif apparait dans NON_RAPPROCHE, jamais absorbee ni ignoree", () => {
    const lignes = reconcilierPrevuEtReel(prevues, reelles, mapping);
    const nonRapproche = lignes.filter((l) => l.statutRapprochement === "NON_RAPPROCHE");
    expect(nonRapproche).toHaveLength(1);
    expect(nonRapproche[0].libelle).toContain("TRANSPORT");
    expect(nonRapproche[0].reel!.toNumber()).toBe(45_000);
    expect(nonRapproche[0].prevu.toNumber()).toBe(0);
  });

  it("(c) la ligne NON_RAPPROCHE EST comptee dans le total reel agrege (jamais silencieusement absente)", () => {
    const lignes = reconcilierPrevuEtReel(prevues, reelles, mapping);
    const agregat = agregerCumule(lignes);
    // total reel = 520000 (aliment) + 750000 (vente) + 45000 (non rapproche, TRANSPORT)
    // — la subvention SANS_SOURCE_REELLE (reel=null) est exclue.
    expect(agregat.totalReel.toNumber()).toBe(520_000 + 750_000 + 45_000);
    expect(agregat.nombreLignesNonRapprochees).toBe(1);
  });

  it("(d) la ligne SANS_SOURCE_REELLE garde reel=null et n'apparait jamais comme 0", () => {
    const lignes = reconcilierPrevuEtReel(prevues, reelles, mapping);
    const sansSource = lignes.find((l) => l.statutRapprochement === "SANS_SOURCE_REELLE");
    expect(sansSource).toBeDefined();
    expect(sansSource!.libelle).toBe("Subvention");
    expect(sansSource!.reel).toBeNull();
    expect(sansSource!.ecartAbsolu).toBeNull();
  });

  it("(d) la ligne SANS_SOURCE_REELLE est exclue de l'agregation du total reel", () => {
    const lignes = reconcilierPrevuEtReel(prevues, reelles, mapping);
    const agregat = agregerCumule(lignes);
    expect(agregat.nombreLignesSansSourceReelle).toBe(1);
    // Contre-preuve explicite : si la subvention avait ete comptee comme 0,
    // le total reel resterait identique par coincidence (0 additif) — donc
    // on verifie EXPLICITEMENT le compteur dedie, pas seulement la somme.
  });

  it("ligne prevue rapprochable sans donnee reelle ce mois-ci -> RAPPROCHE avec reel = 0 (pas SANS_SOURCE_REELLE)", () => {
    const prevuesSeules: EntreePrevueRapprochement[] = [
      {
        cle: "poste-electricite",
        libelle: "Electricite",
        natureGrandeur: "DEPENSE",
        moisAbsolu: 0,
        montantPrevu: d(50_000),
      },
    ];
    const lignes = reconcilierPrevuEtReel(prevuesSeules, [], []);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].statutRapprochement).toBe("RAPPROCHE");
    expect(lignes[0].reel!.toNumber()).toBe(0);
    expect(lignes[0].ecartAbsolu!.toNumber()).toBe(-50_000);
  });

  it("mapping cible explicitement null -> NON_RAPPROCHE (pas seulement l'absence de mapping)", () => {
    const lignes = reconcilierPrevuEtReel(
      [],
      [{ categorieCle: "AUTRE", moisAbsolu: 0, montantReel: d(10_000), natureGrandeur: "DEPENSE" }],
      [{ sourceCle: "AUTRE", cibleCle: null }],
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0].statutRapprochement).toBe("NON_RAPPROCHE");
  });
});

describe("extraireBacNonRapproche", () => {
  it("filtre uniquement les lignes NON_RAPPROCHE", () => {
    const lignes: LigneRapprochement[] = [
      construireLigneRapprochement({
        id: "a::0",
        moisAbsolu: 0,
        libelle: "A",
        natureGrandeur: "DEPENSE",
        prevu: d(100),
        reel: d(100),
        statutRapprochement: "RAPPROCHE",
      }),
      construireLigneRapprochement({
        id: "NON_RAPPROCHE::B::0",
        moisAbsolu: 0,
        libelle: "Non rapproché — B",
        natureGrandeur: "DEPENSE",
        prevu: d(0),
        reel: d(50),
        statutRapprochement: "NON_RAPPROCHE",
      }),
    ];
    const bac = extraireBacNonRapproche(lignes);
    expect(bac).toHaveLength(1);
    expect(bac[0].libelle).toBe("Non rapproché — B");
  });
});

/* ==================================================================== *
 * 6. Agregations par mois / cumulee / par poste
 * ==================================================================== */

describe("agregerParMois", () => {
  it("agrege par mois, triees par mois croissant, exclut SANS_SOURCE_REELLE du total reel", () => {
    const lignes: LigneRapprochement[] = [
      construireLigneRapprochement({
        id: "aliment::1",
        moisAbsolu: 1,
        libelle: "Aliment",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(110_000),
        statutRapprochement: "RAPPROCHE",
      }),
      construireLigneRapprochement({
        id: "aliment::0",
        moisAbsolu: 0,
        libelle: "Aliment",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(90_000),
        statutRapprochement: "RAPPROCHE",
      }),
      construireLigneRapprochement({
        id: "subvention::0",
        moisAbsolu: 0,
        libelle: "Subvention",
        natureGrandeur: "ENTREE",
        prevu: d(50_000),
        reel: null,
        statutRapprochement: "SANS_SOURCE_REELLE",
      }),
    ];

    const agregats = agregerParMois(lignes);
    expect(agregats.map((a) => a.moisAbsolu)).toEqual([0, 1]); // tri croissant, pas l'ordre d'insertion

    const mois0 = agregats[0];
    expect(mois0.totalPrevu.toNumber()).toBe(150_000); // 100000 + 50000
    expect(mois0.totalReel.toNumber()).toBe(90_000); // subvention (null) exclue
    expect(mois0.nombreLignesSansSourceReelle).toBe(1);

    const mois1 = agregats[1];
    expect(mois1.totalReel.toNumber()).toBe(110_000);
  });
});

describe("agregerCumule", () => {
  const lignes: LigneRapprochement[] = [0, 1, 2].map((mois) =>
    construireLigneRapprochement({
      id: `poste::${mois}`,
      moisAbsolu: mois,
      libelle: "Poste",
      natureGrandeur: "DEPENSE",
      prevu: d(100_000),
      reel: d(100_000 + mois * 10_000),
      statutRapprochement: "RAPPROCHE",
    }),
  );

  it("cumule tout l'horizon fourni si jusquAMoisAbsolu est omis", () => {
    const agregat = agregerCumule(lignes);
    expect(agregat.totalReel.toNumber()).toBe(100_000 + 110_000 + 120_000);
  });

  it("cumule uniquement jusqu'au mois indique (inclus)", () => {
    const agregat = agregerCumule(lignes, 1);
    expect(agregat.totalReel.toNumber()).toBe(100_000 + 110_000);
  });
});

describe("agregerParPoste", () => {
  it("agrege toutes les lignes d'un meme poste, tous mois confondus", () => {
    const lignes: LigneRapprochement[] = [0, 1].map((mois) =>
      construireLigneRapprochement({
        id: `poste-aliment::${mois}`,
        moisAbsolu: mois,
        libelle: "Aliment",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(120_000),
        statutRapprochement: "RAPPROCHE",
      }),
    );
    lignes.push(
      construireLigneRapprochement({
        id: "poste-electricite::0",
        moisAbsolu: 0,
        libelle: "Electricite",
        natureGrandeur: "DEPENSE",
        prevu: d(30_000),
        reel: d(28_000),
        statutRapprochement: "RAPPROCHE",
      }),
    );

    const parPoste = agregerParPoste(lignes);
    expect(parPoste).toHaveLength(2);
    const aliment = parPoste.find((p) => p.libelle === "Aliment")!;
    expect(aliment.totalPrevu.toNumber()).toBe(200_000); // 2 mois x 100000
    expect(aliment.totalReel.toNumber()).toBe(240_000); // 2 mois x 120000
  });

  it("distingue deux categories NON_RAPPROCHE differentes comme deux postes distincts", () => {
    const lignes = reconcilierPrevuEtReel(
      [],
      [
        { categorieCle: "TRANSPORT", moisAbsolu: 0, montantReel: d(10_000), natureGrandeur: "DEPENSE" },
        { categorieCle: "REPARATION", moisAbsolu: 0, montantReel: d(5_000), natureGrandeur: "DEPENSE" },
      ],
      [],
    );
    const parPoste = agregerParPoste(lignes);
    expect(parPoste).toHaveLength(2);
  });
});

/* ==================================================================== *
 * 7. topEcartsDuMois — (e) ordre, exactement n, departage deterministe
 * ==================================================================== */

describe("topEcartsDuMois", () => {
  it("(e) trie par |ecartAbsolu| decroissant et retourne exactement 5 par defaut", () => {
    const ecarts = [10_000, 90_000, 30_000, 70_000, 50_000, 20_000, 60_000]; // 7 candidats
    const lignes: LigneRapprochement[] = ecarts.map((montantEcart, i) =>
      construireLigneRapprochement({
        id: `poste-${i}::0`,
        moisAbsolu: 0,
        libelle: `Poste ${i}`,
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(100_000 + montantEcart),
        statutRapprochement: "RAPPROCHE",
      }),
    );

    const top = topEcartsDuMois(lignes, 0);
    expect(top).toHaveLength(5);
    expect(top.map((l) => l.ecartAbsolu!.toNumber())).toEqual([90_000, 70_000, 60_000, 50_000, 30_000]);
  });

  it("(e) departage deterministe par libelle puis id en cas d'ex aequo sur |ecartAbsolu|", () => {
    const lignes: LigneRapprochement[] = [
      construireLigneRapprochement({
        id: "poste-z::0",
        moisAbsolu: 0,
        libelle: "Zebre",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(150_000), // ecart +50000
        statutRapprochement: "RAPPROCHE",
      }),
      construireLigneRapprochement({
        id: "poste-a::0",
        moisAbsolu: 0,
        libelle: "Alpha",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(50_000), // ecart -50000, |ecart| identique
        statutRapprochement: "RAPPROCHE",
      }),
    ];

    const top = topEcartsDuMois(lignes, 0);
    // meme amplitude (50000) pour les deux -> departage par libelle croissant : Alpha avant Zebre
    expect(top.map((l) => l.libelle)).toEqual(["Alpha", "Zebre"]);

    // Rejoue avec l'ordre d'insertion inverse : le resultat doit rester
    // identique (tri stable/deterministe, jamais dependant de l'ordre d'entree).
    const topInverse = topEcartsDuMois([...lignes].reverse(), 0);
    expect(topInverse.map((l) => l.libelle)).toEqual(["Alpha", "Zebre"]);
  });

  it("(d) exclut les lignes SANS_SOURCE_REELLE du classement (aucune base de comparaison)", () => {
    const lignes: LigneRapprochement[] = [
      construireLigneRapprochement({
        id: "poste-a::0",
        moisAbsolu: 0,
        libelle: "Aliment",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(150_000),
        statutRapprochement: "RAPPROCHE",
      }),
      construireLigneRapprochement({
        id: "subvention::0",
        moisAbsolu: 0,
        libelle: "Subvention",
        natureGrandeur: "ENTREE",
        prevu: d(999_999_999), // ecart potentiellement enorme si mal exclu
        reel: null,
        statutRapprochement: "SANS_SOURCE_REELLE",
      }),
    ];
    const top = topEcartsDuMois(lignes, 0);
    expect(top).toHaveLength(1);
    expect(top[0].libelle).toBe("Aliment");
  });

  it("filtre sur le mois demande uniquement", () => {
    const lignes: LigneRapprochement[] = [0, 1].map((mois) =>
      construireLigneRapprochement({
        id: `poste::${mois}`,
        moisAbsolu: mois,
        libelle: "Poste",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(150_000),
        statutRapprochement: "RAPPROCHE",
      }),
    );
    expect(topEcartsDuMois(lignes, 0)).toHaveLength(1);
    expect(topEcartsDuMois(lignes, 5)).toHaveLength(0);
  });

  it("moins de 5 candidats -> retourne tous les candidats disponibles, pas une erreur", () => {
    const lignes: LigneRapprochement[] = [
      construireLigneRapprochement({
        id: "poste-a::0",
        moisAbsolu: 0,
        libelle: "Aliment",
        natureGrandeur: "DEPENSE",
        prevu: d(100_000),
        reel: d(110_000),
        statutRapprochement: "RAPPROCHE",
      }),
    ];
    expect(topEcartsDuMois(lignes, 0)).toHaveLength(1);
  });
});
