import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import {
  calculerBesoinAlimentMensuel,
  determinerPourcentageRemise,
  appliquerPalierRemise,
  calculerCoutAlimentVague,
  apportionnerCoutAlimentMensuel,
  calculerCoutAlimentGranulometrieParMois,
  repartirSacsEntreArticles,
  calculerDetailConsommationMensuelle,
} from "../aliments";
import type {
  AlimentPrevisionCalcInput,
  PalierRemiseInput,
  RepartitionMoisInput,
} from "../types";

describe("calculerBesoinAlimentMensuel", () => {
  it("PIEGE MAJEUR : le ceil s'applique par granulometrie separement, jamais sur un agregat", () => {
    // Preuve verifiee par la pre-analyse : ceil(600/15) = 40 sur un agregat,
    // alors que la somme des ceil individuels donne 41 = 26 + 15 + 0.
    const aliments: AlimentPrevisionCalcInput[] = [
      {
        id: "a1",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(388), // ceil(388/15) = 26
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
      {
        id: "a2",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(212), // ceil(212/15) = 15 (212/15 = 14.13)
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
      {
        id: "a3",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(0),
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
    ];

    const resultats = calculerBesoinAlimentMensuel(aliments, 1);
    expect(resultats.map((r) => r.sacs)).toEqual([26, 15, 0]);

    const totalSacs = resultats.reduce((s, r) => s + r.sacs, 0);
    expect(totalSacs).toBe(41);

    // Contre-preuve explicite : ceil de l'agregat des kg donnerait 40, pas 41.
    const totalKg = resultats.reduce((s, r) => s.plus(r.quantiteKg), new Decimal(0));
    expect(totalKg.dividedBy(15).ceil().toNumber()).toBe(40);
    expect(totalKg.dividedBy(15).ceil().toNumber()).not.toBe(totalSacs);
  });

  it("pourcentage absent pour ce mois -> traite comme 0%, sacs = 0", () => {
    const aliments: AlimentPrevisionCalcInput[] = [
      {
        id: "a1",
        poidsSacKg: new Decimal(15),
        besoinTotalCycleKg: new Decimal(600),
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
      },
    ];
    const resultats = calculerBesoinAlimentMensuel(aliments, 2);
    expect(resultats[0].quantiteKg.equals(0)).toBe(true);
    expect(resultats[0].sacs).toBe(0);
  });

  it("cas limite : poidsSacKg = 0 -> sacs = 0, quantiteKg calculee normalement, pas de division par zero", () => {
    const aliments: AlimentPrevisionCalcInput[] = [
      {
        id: "a1",
        poidsSacKg: new Decimal(0),
        besoinTotalCycleKg: new Decimal(600),
        repartitions: [{ moisCycle: 1, pourcentage: new Decimal(50) }],
      },
    ];
    const resultats = calculerBesoinAlimentMensuel(aliments, 1);
    expect(resultats[0].quantiteKg.equals(300)).toBe(true);
    expect(resultats[0].sacs).toBe(0);
    expect(Number.isFinite(resultats[0].sacs)).toBe(true);
  });
});

/**
 * Story PR2sept.3 (ADR-053 §13.3, ERR-143) : la grandeur qui decide le
 * palier est le TONNAGE VISE DE LA VAGUE, en tonnes — plus jamais un nombre
 * de sacs. Les seuils ci-dessous sont donc des tonnages (5 t / 10 t / 15 t,
 * jeu du classeur), et le cout brut est passe DEJA AGREGE.
 */
describe("determinerPourcentageRemise", () => {
  const paliers: PalierRemiseInput[] = [
    { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
    { ordre: 2, seuilTonnes: new Decimal(5), pourcentageRemise: new Decimal(2) },
    { ordre: 3, seuilTonnes: new Decimal(10), pourcentageRemise: new Decimal(4) },
    { ordre: 4, seuilTonnes: new Decimal(15), pourcentageRemise: new Decimal(6) },
  ];

  it("retient le dernier palier atteint, dans l'ordre explicite (12 t -> 4 %)", () => {
    expect(determinerPourcentageRemise(new Decimal(12), paliers).equals(4)).toBe(true);
  });

  it("seuil atteint EXACTEMENT -> palier applicable (semantique >=) : 10 t -> 4 %, 15 t -> 6 %", () => {
    expect(determinerPourcentageRemise(new Decimal(10), paliers).equals(4)).toBe(true);
    expect(determinerPourcentageRemise(new Decimal(15), paliers).equals(6)).toBe(true);
  });

  it("tonnage sous le plus petit seuil -> aucun palier applicable -> 0 %", () => {
    const r = determinerPourcentageRemise(new Decimal(3), [
      { ordre: 1, seuilTonnes: new Decimal(5), pourcentageRemise: new Decimal(2) },
    ]);
    expect(r.equals(0)).toBe(true);
  });

  it("liste de paliers VIDE (etat reel de la base : 0 ligne dans PalierRemise) -> 0 %", () => {
    expect(determinerPourcentageRemise(new Decimal(15), []).equals(0)).toBe(true);
  });

  it("tonnage nul -> 0 t >= seuil 0 t : le palier a 0 t s'applique (0 %)", () => {
    expect(determinerPourcentageRemise(new Decimal(0), paliers).equals(0)).toBe(true);
  });

  it("tonnage negatif (impossible par construction, jamais rejete par le moteur pur) -> aucun palier, 0 %", () => {
    expect(determinerPourcentageRemise(new Decimal(-5), paliers).equals(0)).toBe(true);
  });

  it("l'ordre des paliers passe en parametre n'affecte pas le resultat (re-tri interne par `ordre`)", () => {
    const desordonnes = [...paliers].reverse();
    expect(determinerPourcentageRemise(new Decimal(12), desordonnes).equals(4)).toBe(true);
  });

  it("ERR-143 (non-regression) : deux vagues de MEME tonnage obtiennent le MEME taux, quel que soit le volume de sacs — la decision n'a plus AUCUNE entree en sacs", () => {
    // Le defaut d'origine (ERR-143) comparait un nombre de sacs d'UNE
    // granulometrie a un seuil unique : pour une meme vague de 15 t, 120 /
    // 270 / 750 sacs (2mm/3mm/4mm) tombaient dans trois paliers differents.
    // La signature actuelle rend ce defaut IMPOSSIBLE A EXPRIMER (aucun
    // parametre en sacs) ; ce test le fige au niveau du comportement, pour
    // qu'un futur elargissement de signature ne puisse pas le reintroduire
    // sans casser une assertion.
    const taux = determinerPourcentageRemise(new Decimal(15), paliers);
    expect(taux.equals(6)).toBe(true);
    // Aucune surface d'appel ne permet de faire varier ce taux autrement que
    // par le tonnage : meme tonnage -> meme taux, appel apres appel.
    expect(determinerPourcentageRemise(new Decimal(15), paliers).equals(taux)).toBe(true);
  });

  it("ERR-143 (non-regression) : un GROS volume de sacs sur une PETITE vague ne declenche aucune remise — c'est le tonnage qui decide, pas le volume achete", () => {
    // 4 t (V1/V2 du plan de reference) : sous le seuil de 5 t, donc 0 %,
    // meme si la vague consomme 4 x 50 = 200 sacs de 4mm. Sous l'ancienne
    // regle en sacs, 200 sacs auraient franchi tous les seuils.
    expect(determinerPourcentageRemise(new Decimal(4), paliers).equals(0)).toBe(true);
  });

  it("FRONTIERE ASSUMEE (ADR-053 §13.8) : le moteur pur ne revalide PAS la croissance des seuils — un `ordre` incoherent avec les seuils produit le dernier palier atteint dans l'ORDRE, pas le plus favorable", () => {
    // `validerPaliersRemiseCroissants` (validation.ts) est la seule garde, et
    // elle est appelee A L'ECRITURE (R4). Ce test fige la frontiere plutot
    // que de faire croire a une garantie qui n'existe pas ici.
    const incoherents: PalierRemiseInput[] = [
      { ordre: 1, seuilTonnes: new Decimal(15), pourcentageRemise: new Decimal(6) },
      { ordre: 2, seuilTonnes: new Decimal(5), pourcentageRemise: new Decimal(2) },
    ];
    expect(determinerPourcentageRemise(new Decimal(20), incoherents).equals(2)).toBe(true);
  });
});

describe("appliquerPalierRemise", () => {
  const paliers: PalierRemiseInput[] = [
    { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
    { ordre: 2, seuilTonnes: new Decimal(5), pourcentageRemise: new Decimal(2) },
    { ordre: 3, seuilTonnes: new Decimal(10), pourcentageRemise: new Decimal(4) },
  ];

  it("applique la remise du palier retenu au cout brut DEJA AGREGE", () => {
    const r = appliquerPalierRemise(new Decimal(8), new Decimal(1125000), paliers);
    expect(r.pourcentageRemiseApplique.equals(2)).toBe(true);
    expect(r.coutFCFA.equals(1102500)).toBe(true); // 1 125 000 * 0,98
  });

  it("aucun palier applicable -> cout brut inchange", () => {
    const r = appliquerPalierRemise(new Decimal(3), new Decimal(75000), [
      { ordre: 1, seuilTonnes: new Decimal(10), pourcentageRemise: new Decimal(5) },
    ]);
    expect(r.pourcentageRemiseApplique.equals(0)).toBe(true);
    expect(r.coutFCFA.equals(75000)).toBe(true);
  });

  it("liste de paliers vide -> 0 % de remise, cout = cout brut", () => {
    const r = appliquerPalierRemise(new Decimal(15), new Decimal(150000), []);
    expect(r.pourcentageRemiseApplique.equals(0)).toBe(true);
    expect(r.coutFCFA.equals(150000)).toBe(true);
  });
});

describe("calculerCoutAlimentVague", () => {
  const paliers: PalierRemiseInput[] = [
    { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
    { ordre: 2, seuilTonnes: new Decimal(10), pourcentageRemise: new Decimal(10) },
  ];

  it("utilise sacsCalcules quand sacsSaisis est null", () => {
    const total = calculerCoutAlimentVague(
      [{ alimentPrevisionId: "a1", sacsCalcules: 26, sacsSaisis: null, prixSacFCFA: new Decimal(15000) }],
      new Decimal(4), // 4 t, sous le seuil de 10 t -> pas de remise
      paliers
    );
    expect(total.equals(390000)).toBe(true); // 26 * 15000
  });

  it("COALESCE(sacsSaisis, sacsCalcules) : sacsSaisis prime toujours pour le MONTANT", () => {
    const total = calculerCoutAlimentVague(
      [{ alimentPrevisionId: "a1", sacsCalcules: 26, sacsSaisis: 50, prixSacFCFA: new Decimal(15000) }],
      new Decimal(4), // tonnage sous le seuil : la surcharge ne fait franchir aucun palier
      paliers
    );
    expect(total.equals(750000)).toBe(true); // 50 * 15000, aucune remise
  });

  it("la remise est decidee sur le TONNAGE de la vague, une seule fois, et s'applique au cout AGREGE de toutes les granulometries", () => {
    const total = calculerCoutAlimentVague(
      [
        { alimentPrevisionId: "a1", sacsCalcules: 26, sacsSaisis: null, prixSacFCFA: new Decimal(15000) },
        { alimentPrevisionId: "a2", sacsCalcules: 15, sacsSaisis: null, prixSacFCFA: new Decimal(12000) },
      ],
      new Decimal(12), // 12 t >= 10 t -> 10 % pour TOUTE la vague
      paliers
    );
    // (26*15000 + 15*12000) * 0,9 = 570 000 * 0,9 = 513 000
    expect(total.equals(513000)).toBe(true);
  });

  it("liste vide -> 0", () => {
    expect(calculerCoutAlimentVague([], new Decimal(15), paliers).equals(0)).toBe(true);
  });

  it("liste de paliers VIDE (etat reel de la base) -> cout brut, jamais NaN ni 0", () => {
    const total = calculerCoutAlimentVague(
      [{ alimentPrevisionId: "a1", sacsCalcules: 26, sacsSaisis: null, prixSacFCFA: new Decimal(15000) }],
      new Decimal(15),
      []
    );
    expect(total.equals(390000)).toBe(true);
  });

  it("ORDRE DES OPERATIONS (ADR-053 §13.3, points 3-4) : somme des couts bruts PUIS remise, AUCUN arrondi ne s'intercale — discrimine le candidat rejete « remise + arrondi par ligne, puis somme »", () => {
    // Choix des valeurs : un taux de 7 % sur des prix impairs produit des
    // montants FRACTIONNAIRES par ligne, ce qui rend les deux ordres
    // NUMERIQUEMENT DISTINCTS des qu'un arrondi par ligne existe (sans
    // arrondi, Sigma c_i(1-r) = (Sigma c_i)(1-r) est une identite, donc un
    // test qui ne compare que ces deux formes ne prouverait RIEN — meme
    // piege methodologique qu'ERR-148/ERR-155).
    const paliers7: PalierRemiseInput[] = [
      { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilTonnes: new Decimal(10), pourcentageRemise: new Decimal(7) },
    ];
    const lignes = [
      { alimentPrevisionId: "2mm", sacsCalcules: 1, sacsSaisis: null, prixSacFCFA: new Decimal(15001) },
      { alimentPrevisionId: "3mm", sacsCalcules: 1, sacsSaisis: null, prixSacFCFA: new Decimal(10001) },
    ];

    const total = calculerCoutAlimentVague(lignes, new Decimal(12), paliers7);

    // Attendu : (15001 + 10001) x 0,93 = 25002 x 0,93 = 23251,86 — exact,
    // conserve en Decimal, jamais arrondi par le moteur.
    expect(total.equals(new Decimal("23251.86"))).toBe(true);

    // Candidat REJETE : remise + arrondi FCFA entier par ligne, puis somme
    // -> round(13950,93) + round(9300,93) = 13951 + 9301 = 23252. Valeur
    // DIFFERENTE : le test discrimine reellement les deux ordres.
    const candidatRejete = lignes.reduce(
      (s, l) =>
        s.plus(
          l.prixSacFCFA
            .times(l.sacsCalcules)
            .times(new Decimal("0.93"))
            .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        ),
      new Decimal(0)
    );
    expect(candidatRejete.equals(23252)).toBe(true);
    expect(total.equals(candidatRejete)).toBe(false);
  });
});

describe("apportionnerCoutAlimentMensuel", () => {
  it("ventile un cout de cycle deja remise au prorata des pourcentages mensuels", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(80) },
      { moisCycle: 2, pourcentage: new Decimal(20) },
    ];
    const resultats = apportionnerCoutAlimentMensuel(new Decimal(2030400), repartitions);

    expect(resultats.map((r) => r.moisCycle)).toEqual([1, 2]);
    expect(resultats[0].montantFCFA.equals(1624320)).toBe(true); // 2030400 * 0.8
    expect(resultats[1].montantFCFA.equals(406080)).toBe(true); // 2030400 * 0.2
  });

  it("la somme des montants mensuels reconstitue exactement le total du cycle quand les pourcentages somment a 100", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(33) },
      { moisCycle: 2, pourcentage: new Decimal(33) },
      { moisCycle: 3, pourcentage: new Decimal(34) },
    ];
    const total = new Decimal(999999);
    const resultats = apportionnerCoutAlimentMensuel(total, repartitions);
    const sommeReconstituee = resultats.reduce((s, r) => s.plus(r.montantFCFA), new Decimal(0));
    expect(sommeReconstituee.equals(total)).toBe(true);
  });

  it("cas limite : coutCycleTotalRemiseFCFA = 0 -> chaque mois recoit 0", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(100) },
    ];
    const resultats = apportionnerCoutAlimentMensuel(new Decimal(0), repartitions);
    expect(resultats[0].montantFCFA.equals(0)).toBe(true);
  });

  it("cas limite : repartitions vide -> tableau vide", () => {
    expect(apportionnerCoutAlimentMensuel(new Decimal(500000), [])).toEqual([]);
  });

  it("un moisCycle absent des repartitions n'apparait simplement pas dans le resultat", () => {
    const resultats = apportionnerCoutAlimentMensuel(new Decimal(100000), [
      { moisCycle: 2, pourcentage: new Decimal(100) },
    ]);
    expect(resultats.map((r) => r.moisCycle)).toEqual([2]);
  });
});

describe("repartirSacsEntreArticles — ADR-053 §12.2 arbitrage 1 (revise), methode du plus fort reste (Hare-Niemeyer), amendement Sprint PR2-quater", () => {
  it("liste d'articles vide -> tableau vide", () => {
    expect(repartirSacsEntreArticles(100, [])).toEqual([]);
  });

  it("cas degenere N=1, part=100% : sacs = totalSacs exactement, aucun plancher/reste (non-regression byte-pour-byte de la recette, ADR-053 §12.2 preuve chiffree)", () => {
    const resultat = repartirSacsEntreArticles(120, [
      { id: "unique", ordre: 0, partApprovisionnementPct: new Decimal(100) },
    ]);
    expect(resultat).toEqual([{ id: "unique", sacs: 120 }]);
  });

  it("N=2, calcule a la main : totalSacs=101, parts 50/50 -> partExacte=50.5 chacun, ex aequo sur le reste -> depart par `ordre` croissant (l'article ordre=0 recoit le sac supplementaire)", () => {
    const resultat = repartirSacsEntreArticles(101, [
      { id: "article-A", ordre: 0, partApprovisionnementPct: new Decimal(50) },
      { id: "article-B", ordre: 1, partApprovisionnementPct: new Decimal(50) },
    ]);
    expect(resultat).toEqual([
      { id: "article-A", sacs: 51 },
      { id: "article-B", sacs: 50 },
    ]);
    expect(resultat.reduce((s, r) => s + r.sacs, 0)).toBe(101);
  });

  it("N=3, calcule a la main : totalSacs=10, parts 33/33/34 -> partExacte=3.3/3.3/3.4, planchers=3/3/3 (somme 9), le reste unique va au plus grand reste (article a 34%)", () => {
    const resultat = repartirSacsEntreArticles(10, [
      { id: "article-A", ordre: 0, partApprovisionnementPct: new Decimal(33) },
      { id: "article-B", ordre: 1, partApprovisionnementPct: new Decimal(33) },
      { id: "article-C", ordre: 2, partApprovisionnementPct: new Decimal(34) },
    ]);
    expect(resultat).toEqual([
      { id: "article-A", sacs: 3 },
      { id: "article-B", sacs: 3 },
      { id: "article-C", sacs: 4 },
    ]);
    expect(resultat.reduce((s, r) => s + r.sacs, 0)).toBe(10);
  });

  it("ex aequo EXPLICITE sur `ordre` (deux articles au meme `ordre`) : depart par `id` croissant (lexicographique)", () => {
    // totalSacs=3, parts 50/50 -> partExacte=1.5 chacun, planchers=1/1 (somme 2),
    // reste=1 a attribuer, restants egaux (0.5/0.5) ET ordre egal (0/0) ->
    // depart par id croissant : "a" < "b" recoit le sac supplementaire.
    const resultat = repartirSacsEntreArticles(3, [
      { id: "b", ordre: 0, partApprovisionnementPct: new Decimal(50) },
      { id: "a", ordre: 0, partApprovisionnementPct: new Decimal(50) },
    ]);
    expect(resultat.find((r) => r.id === "a")!.sacs).toBe(2);
    expect(resultat.find((r) => r.id === "b")!.sacs).toBe(1);
    expect(resultat.reduce((s, r) => s + r.sacs, 0)).toBe(3);
  });

  it("Sigma(sacs) = totalSacs exactement, jamais plus, jamais moins (preuve generale ADR-053 §12.2)", () => {
    const resultat = repartirSacsEntreArticles(37, [
      { id: "a", ordre: 0, partApprovisionnementPct: new Decimal(17) },
      { id: "b", ordre: 1, partApprovisionnementPct: new Decimal(29) },
      { id: "c", ordre: 2, partApprovisionnementPct: new Decimal(54) },
    ]);
    expect(resultat.reduce((s, r) => s + r.sacs, 0)).toBe(37);
  });

  it("conserve l'ORDRE des articles en entree dans le resultat (pas l'ordre de tri interne)", () => {
    const resultat = repartirSacsEntreArticles(10, [
      { id: "article-C", ordre: 2, partApprovisionnementPct: new Decimal(34) },
      { id: "article-A", ordre: 0, partApprovisionnementPct: new Decimal(33) },
      { id: "article-B", ordre: 1, partApprovisionnementPct: new Decimal(33) },
    ]);
    expect(resultat.map((r) => r.id)).toEqual(["article-C", "article-A", "article-B"]);
  });

  it("totalSacs=0 -> chaque article recoit 0, sans erreur", () => {
    const resultat = repartirSacsEntreArticles(0, [
      { id: "a", ordre: 0, partApprovisionnementPct: new Decimal(50) },
      { id: "b", ordre: 1, partApprovisionnementPct: new Decimal(50) },
    ]);
    expect(resultat).toEqual([
      { id: "a", sacs: 0 },
      { id: "b", sacs: 0 },
    ]);
  });

  it("cas limite : totalSacs=1 pour 3 articles, dont un a 0% -> le sac unique va au plus fort reste, l'article a 0% recoit toujours 0 (jamais un reste artificiel)", () => {
    // partExacte = 1*40/100=0.4, 1*60/100=0.6, 1*0/100=0. planchers tous 0
    // (somme 0), restantATtribuer = 1 -> va au plus grand reste (0.6, article B).
    const resultat = repartirSacsEntreArticles(1, [
      { id: "a", ordre: 0, partApprovisionnementPct: new Decimal(40) },
      { id: "b", ordre: 1, partApprovisionnementPct: new Decimal(60) },
      { id: "c", ordre: 2, partApprovisionnementPct: new Decimal(0) },
    ]);
    expect(resultat).toEqual([
      { id: "a", sacs: 0 },
      { id: "b", sacs: 1 },
      { id: "c", sacs: 0 },
    ]);
    expect(resultat.reduce((s, r) => s + r.sacs, 0)).toBe(1);
  });

  it("un article a 0% ne recoit jamais de sac, meme si son `ordre` le favoriserait au depart des ex aequo (le reste exact de 0% est 0, jamais candidat)", () => {
    // 50/50/0 sur 3 sacs : partExacte = 1.5/1.5/0, planchers 1/1/0 (somme 2),
    // restantATtribuer=1, ex aequo entre a et b (restant 0.5 chacun) -> depart
    // par ordre croissant -> a (ordre 0) recoit le sac supplementaire. c (0%)
    // n'entre jamais en lice (restant=0, toujours le plus petit).
    const resultat = repartirSacsEntreArticles(3, [
      { id: "a", ordre: 0, partApprovisionnementPct: new Decimal(50) },
      { id: "b", ordre: 1, partApprovisionnementPct: new Decimal(50) },
      { id: "c", ordre: 2, partApprovisionnementPct: new Decimal(0) },
    ]);
    expect(resultat.find((r) => r.id === "c")!.sacs).toBe(0);
    expect(resultat.reduce((s, r) => s + r.sacs, 0)).toBe(3);
  });

  it("determinisme : deux appels sur la MEME entree (nouveaux objets, mais valeurs identiques) produisent EXACTEMENT le meme resultat (reproductibilite exigee par ADR-053 §12.2 arbitrage 1)", () => {
    const construireArticles = () => [
      { id: "b", ordre: 0, partApprovisionnementPct: new Decimal(33.33) },
      { id: "a", ordre: 0, partApprovisionnementPct: new Decimal(33.33) },
      { id: "c", ordre: 1, partApprovisionnementPct: new Decimal(33.34) },
    ];
    const resultat1 = repartirSacsEntreArticles(17, construireArticles());
    const resultat2 = repartirSacsEntreArticles(17, construireArticles());
    expect(resultat1).toEqual(resultat2);
  });
});

describe("calculerCoutAlimentGranulometrieParMois", () => {
  it("V7 verifie par la recette PR1.4 (rapport-story-PR1.4.md section 4.3) : remise decidee UNE FOIS pour la vague (15 t -> 6 %), le montant deja remise etant ensuite ventile par mois", () => {
    const paliers: PalierRemiseInput[] = [
      { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilTonnes: new Decimal(15), pourcentageRemise: new Decimal(6) },
    ];
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(80) },
      { moisCycle: 2, pourcentage: new Decimal(20) },
    ];

    const resultats = calculerCoutAlimentGranulometrieParMois(
      {
        alimentPrevisionId: "2mm",
        sacsCalculesCycle: 120,
        sacsSaisisCycle: null,
        prixSacFCFA: new Decimal(18000),
        repartitions,
      },
      new Decimal(15), // tonnage vise de V7, seuil atteint EXACTEMENT
      paliers
    );

    const mois1 = resultats.find((r) => r.moisCycle === 1)!;
    // (120 * 18000 * 0.94) * 0.8 = 2 030 400 * 0.8 = 1 624 320
    expect(mois1.montantFCFA.equals(1624320)).toBe(true);
    expect(mois1.alimentPrevisionId).toBe("2mm");

    // Contre-preuve : le taux ne depend NI du volume mensuel NI du volume de
    // cycle — il ne depend que du tonnage de la vague. Sans remise, le mois 1
    // vaudrait 120*18000*0.8 = 1 728 000.
    expect(mois1.montantFCFA.equals(1728000)).toBe(false);
  });

  it("COALESCE(sacsSaisisCycle, sacsCalculesCycle) : la surcharge manuelle pilote le MONTANT, jamais le palier de remise (ADR-053 §13.7)", () => {
    // Reecriture prescrite par ADR-053 §13.7 : ce test figeait auparavant le
    // contraire (une surcharge de 50 sacs franchissait un seuil exprime en
    // sacs et declenchait la remise). Depuis le correctif d'ERR-143, le
    // palier ne depend QUE du tonnage vise de la vague. Les deux moities de
    // l'arbitrage sont figees ici, pour qu'aucune des deux lectures fausses
    // ne puisse se reinstaller silencieusement.
    const paliers: PalierRemiseInput[] = [
      { ordre: 1, seuilTonnes: new Decimal(0), pourcentageRemise: new Decimal(0) },
      { ordre: 2, seuilTonnes: new Decimal(10), pourcentageRemise: new Decimal(10) },
    ];
    const repartitions: RepartitionMoisInput[] = [{ moisCycle: 1, pourcentage: new Decimal(100) }];
    const ligne = {
      alimentPrevisionId: "a1",
      sacsCalculesCycle: 26,
      sacsSaisisCycle: 50, // surcharge manuelle
      prixSacFCFA: new Decimal(15000),
      repartitions,
    };

    // 1. Surcharge a la hausse, tonnage SOUS le seuil -> le montant suit la
    //    surcharge et AUCUNE remise ne s'applique : 50 * 15 000 = 750 000.
    const sousSeuil = calculerCoutAlimentGranulometrieParMois(ligne, new Decimal(4), paliers);
    expect(sousSeuil[0].montantFCFA.equals(750000)).toBe(true);

    // 2. Meme surcharge, tonnage AU-DESSUS du seuil -> la remise s'applique
    //    quand meme, sur le montant issu de la surcharge : 750 000 * 0,9.
    const auDessus = calculerCoutAlimentGranulometrieParMois(ligne, new Decimal(12), paliers);
    expect(auDessus[0].montantFCFA.equals(675000)).toBe(true);
  });

  it("cas limite : repartitions vide -> tableau vide", () => {
    const resultats = calculerCoutAlimentGranulometrieParMois(
      {
        alimentPrevisionId: "a1",
        sacsCalculesCycle: 10,
        sacsSaisisCycle: null,
        prixSacFCFA: new Decimal(15000),
        repartitions: [],
      },
      new Decimal(4),
      []
    );
    expect(resultats).toEqual([]);
  });
});

describe("calculerDetailConsommationMensuelle — story PR2sex.2 (ADR-053 §7/§12, jeu d'or besoinsAliments.detailParVagueSacs)", () => {
  it("cas nominal : ROUND(sacsEffectifsCycle x pourcentage / 100), half-away-from-zero", () => {
    const repartitions: RepartitionMoisInput[] = [
      { moisCycle: 1, pourcentage: new Decimal(80) },
      { moisCycle: 2, pourcentage: new Decimal(20) },
    ];
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: 32,
      repartitions,
    });
    // 32 * 80 / 100 = 25.6 -> ROUND (half-up) = 26
    expect(resultat.sacsConsommes).toBe(26);
    expect(resultat.alimentPrevisionId).toBe("2mm");
    expect(resultat.moisCycle).toBe(1);
  });

  it("accepte un Decimal deja somme par l'appelant (pas seulement un number)", () => {
    const repartitions: RepartitionMoisInput[] = [{ moisCycle: 2, pourcentage: new Decimal(50) }];
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "3mm",
      moisCycle: 2,
      sommeSacsEffectifsCycle: new Decimal(15),
      repartitions,
    });
    expect(resultat.sacsConsommes).toBe(8); // 15*0.5=7.5 -> ROUND half-up = 8
  });

  it("moisCycle absent de repartitions -> traite comme 0% (jamais un throw), meme discipline que calculerBesoinAlimentMensuel/apportionnerCoutAlimentMensuel", () => {
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "4mm",
      moisCycle: 5,
      sommeSacsEffectifsCycle: 999,
      repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
    });
    expect(resultat.sacsConsommes).toBe(0);
  });

  it("sommeSacsEffectifsCycle = 0 -> 0 sacs consommes, sans erreur", () => {
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: 0,
      repartitions: [{ moisCycle: 1, pourcentage: new Decimal(100) }],
    });
    expect(resultat.sacsConsommes).toBe(0);
  });

  it("repartitions vide -> 0% -> 0 sacs, sans throw", () => {
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: 500,
      repartitions: [],
    });
    expect(resultat.sacsConsommes).toBe(0);
  });

  /**
   * TEST SYNTHETIQUE DEDIE — protection de la decision sum-then-round
   * (pre-analyse PR2sex.2 §2, point 2 ; meme famille de piege que ERR-148).
   *
   * Le jeu d'or (les deux fixtures de recette) ne contient STRUCTURELLEMENT
   * aucun mois ou deux VaguePrevue partagent le meme moisStockageAbsolu (19
   * vagues, 19 mois d'empoissonnement strictement distincts) : il ne peut
   * donc PAS discriminer `ROUND(Σ)` (retenu, cf. lecture de la formule brute
   * du classeur `Previsions!B13`) de l'alternative rejetee `Σ ROUND()`. Ce
   * test construit un cas synthetique a DEUX vagues qui coincident (meme
   * position de cycle, meme mois calendaire), avec un pourcentage choisi
   * pour faire diverger numeriquement les deux candidats — sans lui, le
   * choix sum-then-round ne serait garde par AUCUN test.
   *
   * Deux vagues a 3 sacs chacune (calibre identique), pourcentage 16,66% :
   *   ROUND(Σ)   = ROUND((3+3) x 16.66 / 100) = ROUND(0.9996)  = 1
   *   Σ ROUND()  = ROUND(3 x 16.66 / 100) + ROUND(3 x 16.66 / 100)
   *              = ROUND(0.4998) + ROUND(0.4998) = 0 + 0 = 0
   * 1 != 0 : les deux candidats divergent reellement sur ce cas — la preuve
   * n'est pas vide.
   */
  it("PROTECTION sum-then-round : ROUND(Sigma sacsEffectifsCycle x pct) != Sigma ROUND(sacsEffectifsCycle x pct) sur un cas synthetique a deux vagues coincidentes", () => {
    const repartitions: RepartitionMoisInput[] = [{ moisCycle: 1, pourcentage: new Decimal(16.66) }];
    const sacsVagueA = 3;
    const sacsVagueB = 3;

    // Candidat retenu (implemente par calculerDetailConsommationMensuelle) :
    // la somme EXACTE des deux vagues est deja effectuee par l'appelant
    // AVANT l'appel (meme patron que GAP 2 de route-orchestration.ts), donc
    // UN SEUL round s'applique a la somme.
    const sommeAvantArrondi = new Decimal(sacsVagueA).plus(sacsVagueB);
    const resultatSumThenRound = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: sommeAvantArrondi,
      repartitions,
    });

    // Candidat REJETE (Sigma ROUND()) : arrondir CHAQUE vague separement
    // (un appel par vague, jamais celui retenu par cette story) puis sommer
    // les resultats DEJA arrondis.
    const resultatVagueA = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: sacsVagueA,
      repartitions,
    });
    const resultatVagueB = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: sacsVagueB,
      repartitions,
    });
    const sommeDesArrondisIndividuels = resultatVagueA.sacsConsommes + resultatVagueB.sacsConsommes;

    // Les deux candidats DIVERGENT reellement sur ce cas (sinon le test ne
    // prouverait rien, cf. ERR-148) :
    expect(resultatSumThenRound.sacsConsommes).not.toBe(sommeDesArrondisIndividuels);

    // Le candidat retenu par cette story est bien ROUND(Sigma), pas Sigma ROUND() :
    expect(resultatSumThenRound.sacsConsommes).toBe(1);
    expect(sommeDesArrondisIndividuels).toBe(0);
  });

  it("NON-CONTAMINATION CEIL/ROUND (ERR-138/ERR-139) : sur un cas ou CEIL et ROUND divergent numeriquement, cette fonction produit bien le ROUND, jamais le CEIL de calculerBesoinAlimentMensuel", () => {
    // Cas choisi pour que ceil(kg/poidsSacKg) diverge de ROUND(sacs x pct) :
    // 100 sacs a 33% -> 33 exactement (pas discriminant) ; on choisit plutot
    // un total qui produit une fraction non entiere strictement entre le
    // plancher et le plafond, ex. 101 sacs a 33% = 33.33 -> ROUND = 33,
    // alors qu'un CEIL sur la meme fraction donnerait 34 : preuve que cette
    // fonction n'arrondit pas au superieur.
    const repartitions: RepartitionMoisInput[] = [{ moisCycle: 1, pourcentage: new Decimal(33) }];
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: 101,
      repartitions,
    });
    const fractionExacte = new Decimal(101).times(33).dividedBy(100); // 33.33
    expect(resultat.sacsConsommes).toBe(33); // ROUND (half-up) = 33
    expect(resultat.sacsConsommes).not.toBe(fractionExacte.ceil().toNumber()); // CEIL aurait donne 34
  });

  /**
   * CAS LIMITE ADVERSE (@tester, verification post-implementation) — la
   * signature de la fonction n'interdit pas un `sommeSacsEffectifsCycle`
   * negatif (aucun `throw`, aucune borne >= 0 dans le code), donc le
   * contrat de la fonction PURE doit rester correct meme si un appelant
   * futur (hors du chemin actuel de route-orchestration.ts, qui ne produit
   * jamais de negatif) lui passe une valeur negative. `ROUND` d'Excel est
   * half-away-from-zero (`ROUND(-2.5,0) = -3`), STRICTEMENT DIFFERENT de
   * `Math.round(-2.5)` (natif JS, qui vaut -2, arrondi vers +Infini a
   * l'egalite) — piege documente par la pre-analyse §1. Ce test verifie que
   * `Decimal.ROUND_HALF_UP` (explicitement passe au point d'appel) produit
   * bien -3, jamais -2, sur un cas d'egalite negatif.
   */
  it("CAS LIMITE : half-away-from-zero sur une somme negative (-2,5 -> -3, jamais -2 comme Math.round natif)", () => {
    // -5 * 50% = -2.5, exactement a l'egalite : ROUND_HALF_UP (Excel) = -3,
    // Math.round natif JS donnerait -2 (verifie : Math.round(-2.5) === -2).
    expect(Math.round(-2.5)).toBe(-2); // rappel du piege JS natif, pour contraste
    const repartitions: RepartitionMoisInput[] = [{ moisCycle: 1, pourcentage: new Decimal(50) }];
    const resultat = calculerDetailConsommationMensuelle({
      alimentPrevisionId: "2mm",
      moisCycle: 1,
      sommeSacsEffectifsCycle: -5,
      repartitions,
    });
    expect(resultat.sacsConsommes).toBe(-3);
  });
});
