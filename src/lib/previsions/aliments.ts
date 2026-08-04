/**
 * Moteur Previsions — Besoin en aliments, remises, cout aliment par vague.
 *
 * Etapes 2-4 (ADR-053 section 4) :
 *   calculerBesoinAlimentMensuel — Etape 2
 *   determinerPourcentageRemise  — Etape 3a : DECISION du palier (regle
 *                                  §4.3 des exigences fonctionnelles, prise
 *                                  UNE FOIS PAR VAGUE sur son tonnage vise,
 *                                  ADR-053 §13.3 / ERR-143)
 *   appliquerTauxRemise          — Etape 3b : APPLICATION du taux deja
 *                                  decide a un cout brut (unique ecriture de
 *                                  la formule `x (1 - r/100)` du depot)
 *   appliquerPalierRemise        — Etape 3 : composition 3a + 3b
 *   calculerCoutAlimentVague     — Etape 4
 *
 * Comble aussi le gap signale par la recette PR1.4
 * (docs/tests/rapport-story-PR1.4.md, section 4.3) : aucune fonction ne
 * ventilait le cout aliment remise d'une vague (calculerCoutAlimentVague,
 * total sur tout le cycle) par mois — necessaire pour
 * `depenses.aliments[mois]` (serie calendaire) et
 * `AlimentParVaguePrevue.coutCalculeFCFA` (grain vague x granulometrie x
 * mois, ADR-053 section 3.6) :
 *   apportionnerCoutAlimentMensuel        — primitive de repartition (%)
 *   calculerCoutAlimentGranulometrieParMois — grain vague x granulometrie x mois
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";
import type { AlimentPrevisionCalcInput, PalierRemiseInput, RepartitionMoisInput } from "./types";

export interface BesoinAlimentMensuelResult {
  alimentPrevisionId: string;
  moisCycle: number;
  quantiteKg: Decimal;
  /** ceil(quantiteKg / poidsSacKg), calcule PAR granulometrie separement — voir piege majeur ci-dessous */
  sacs: number;
}

/**
 * calculerBesoinAlimentMensuel — Etape 2 du moteur (ADR-053 section 4).
 *
 * Calcule, pour un mois de cycle donne, le besoin en kg puis en sacs de
 * CHAQUE granulometrie (AlimentPrevision) fournie, prise separement.
 *
 * PIEGE MAJEUR (identifie par la pre-analyse de la story PR1.3, verifie
 * numeriquement contre le jeu d'or) : le `ceil` s'applique PAR
 * granulometrie, JAMAIS sur un besoin total agrege au prealable. Preuve :
 * `ceil(600/15) = 40` sur un besoin agrege, alors que la fixture donne
 * `41 = ceil(x/15) + ceil(y/15) + ceil(z/15)` sur trois granulometries
 * distinctes du meme mois. Cette fonction retourne donc UN resultat par
 * AlimentPrevision fourni — jamais une somme prealable des `quantiteKg`
 * suivie d'un unique `ceil`.
 *
 * Cas limite (ADR-053 section 8) : `poidsSacKg = 0` -> granulometrie
 * ignoree pour l'achat (`sacs = 0`), `quantiteKg` reste calculee
 * normalement -> jamais de division par zero, jamais de `NaN`/`Infinity`.
 *
 * @param aliments - granulometries a evaluer pour ce mois de cycle
 * @param moisCycle - mois du cycle (1..dureeCycleMois de la VaguePrevue)
 * @returns un resultat par AlimentPrevision fourni (pourcentage absent pour ce mois -> traite comme 0%)
 */
export function calculerBesoinAlimentMensuel(
  aliments: AlimentPrevisionCalcInput[],
  moisCycle: number
): BesoinAlimentMensuelResult[] {
  return aliments.map((aliment) => {
    const repartition = aliment.repartitions.find((r) => r.moisCycle === moisCycle);
    const pourcentage = repartition?.pourcentage ?? new Decimal(0);
    const quantiteKg = aliment.besoinTotalCycleKg.times(pourcentage).dividedBy(100);

    const sacs = aliment.poidsSacKg.lte(0)
      ? 0
      : quantiteKg.dividedBy(aliment.poidsSacKg).ceil().toNumber();

    return {
      alimentPrevisionId: aliment.id,
      moisCycle,
      quantiteKg,
      sacs,
    };
  });
}

export interface RemiseAppliqueeResult {
  coutFCFA: Decimal;
  pourcentageRemiseApplique: Decimal;
}

/**
 * determinerPourcentageRemise — DECISION de palier (ADR-053 §13.3, story
 * PR2sept.3, ERR-143). Isolee du calcul de cout pour que la grandeur qui
 * decide soit visible dans la signature : un TONNAGE de vague, jamais un
 * nombre de sacs.
 *
 * Regle des exigences fonctionnelles §4.3, restauree ici :
 *   remise = pourcentage du palier dont le seuil (en TONNES) est le plus
 *            grand parmi ceux <= tonnage vise de la vague ; 0 si aucun.
 *
 * Trois proprietes, chacune opposee a un piege deja paye par ce module :
 *  - la grandeur comparee est un TONNAGE (ERR-143 : c'etait un nombre de
 *    sacs d'UNE granulometrie, ce qui rendait la regle inexprimable depuis
 *    l'interface — 120 / 270 / 750 sacs pour une meme vague de 15 t ne
 *    peuvent pas tomber dans le meme palier avec un jeu de seuils unique) ;
 *  - la decision est prise UNE FOIS PAR VAGUE, jamais par calibre, jamais
 *    par article, jamais sur un total mensuel toutes vagues confondues ;
 *  - les paliers sont evalues dans leur ordre EXPLICITE (`PalierRemise.ordre`),
 *    jamais un tri implicite sur `seuilTonnes` (ADR-053 section 3.4). Le
 *    palier retenu est le DERNIER, dans cet ordre, dont
 *    `seuilTonnes <= tonnageVagueT` — hypothese valide uniquement si les
 *    seuils sont strictement croissants dans cet ordre, ce que
 *    `validerPaliersRemiseCroissants` (validation.ts) garantit en amont, a
 *    l'ecriture (R4 : validation et ecriture dans la meme transaction).
 *    Le moteur pur ne REVALIDE PAS cette coherence — frontiere assumee
 *    (ADR-053 §13.8, dernier paragraphe), figee par un test de cas limite.
 *
 * Cas limites : liste de paliers vide -> 0 % (c'est l'etat reel de la base
 * aujourd'hui : `PalierRemise` ne contient aucune ligne). Tonnage nul ->
 * 0 t >= seuil 0 t, donc le palier a 0 t (souvent 0 %) s'applique. Tonnage
 * negatif : impossible par construction, jamais rejete ici (aucun `throw`
 * dans le moteur pur — doctrine 422 a la charge de l'orchestration).
 *
 * @param tonnageVagueT - tonnage VISE de la vague, en TONNES (`effectifAlevinsPrevu x poidsObjectifG / 1 000 000`) — jamais un nombre de sacs, jamais des kg
 * @param paliers - paliers de remise du SCENARIO, dans un ordre quelconque (re-tries ici par `ordre`)
 * @returns pourcentage de remise retenu, sur 0..100 (jamais une fraction 0..1)
 */
export function determinerPourcentageRemise(
  tonnageVagueT: Decimal,
  paliers: PalierRemiseInput[]
): Decimal {
  const sorted = [...paliers].sort((a, b) => a.ordre - b.ordre);

  let pourcentageRemiseApplique = new Decimal(0);
  for (const palier of sorted) {
    if (tonnageVagueT.gte(palier.seuilTonnes)) {
      pourcentageRemiseApplique = palier.pourcentageRemise;
    }
  }

  return pourcentageRemiseApplique;
}

/**
 * appliquerTauxRemise — APPLICATION d'un taux DEJA DECIDE (etape 3b).
 *
 * Unique ecriture de la formule `cout x (1 - r/100)` dans le depot. Extraite
 * en primitive (reserve M1 de la review de la story PR2sept.3) parce que
 * `route-orchestration.ts` avait besoin d'appliquer, PAR CALIBRE, le taux
 * decide UNE SEULE FOIS pour la vague, et la reecrivait donc a la main : deux
 * ecritures de la meme regle metier, qui pouvaient diverger silencieusement.
 *
 * FRONTIERE A NE JAMAIS FRANCHIR (ERR-143) : cette fonction ne DECIDE rien.
 * Elle ne recoit ni tonnage, ni paliers, ni nombre de sacs — uniquement un
 * taux deja arrete par `determinerPourcentageRemise` au niveau de la VAGUE.
 * Un appelant qui boucle sur les granulometries doit hisser l'appel a
 * `determinerPourcentageRemise` HORS de sa boucle et n'appeler QUE cette
 * primitive a l'interieur ; rappeler `appliquerPalierRemise` par calibre
 * reintroduirait exactement la forme condamnee par ERR-143.
 *
 * Aucun arrondi ici : le resultat reste un `Decimal` exact (ADR-053 §13.3,
 * point 4 — « aucun arrondi ne s'intercale »), l'arrondi FCFA eventuel est a
 * la charge du point de sortie.
 *
 * @param coutBrutFCFA - cout AVANT remise (agregat de vague, ou cout d'un seul calibre quand le taux de la vague est deja decide)
 * @param pourcentageRemise - taux sur 0..100 (jamais une fraction 0..1), deja decide par `determinerPourcentageRemise`
 * @returns cout apres remise, exact, non arrondi
 */
export function appliquerTauxRemise(coutBrutFCFA: Decimal, pourcentageRemise: Decimal): Decimal {
  return coutBrutFCFA.times(new Decimal(1).minus(pourcentageRemise.dividedBy(100)));
}

/**
 * appliquerPalierRemise — Etape 3 du moteur (ADR-053 section 4, amendee par
 * §13.3).
 *
 * Applique au COUT BRUT DEJA AGREGE la remise decidee par
 * `determinerPourcentageRemise` a partir du tonnage vise de la vague.
 *
 * ORDRE DES OPERATIONS, non negociable (README des fixtures, « Verifications
 * numeriques effectuees », points 1 et 2) :
 *   1. `ceil` PAR GRANULOMETRIE sur les sacs (jamais sur un besoin agrege) ;
 *   2. cout brut ligne par ligne (sacs x prix du sac de l'article) ;
 *   3. SOMME des couts bruts (ADR-053 §12.2 arbitrage 1, inchange) ;
 *   4. remise appliquee EN DERNIER, une seule fois, sur cet agregat.
 * Aucun arrondi ne s'intercale entre 3 et 4.
 *
 * Ce que la story PR2sept.3 a change : le NIVEAU DE DECISION du palier est
 * remonte du calibre a la vague. Le champ `sacs` du resultat a ete SUPPRIME
 * (ADR-053 §13.8, point 1) : la fonction ne recoit plus de nombre de sacs,
 * un tel champ n'aurait plus de referent et ajouterait une troisieme
 * homonymie a un module qui en documente deja deux.
 *
 * @param tonnageVagueT - tonnage VISE de la vague, en TONNES (decide le palier)
 * @param coutBrutFCFA - cout d'aliment AVANT remise, deja agrege par l'appelant (somme article par article)
 * @param paliers - paliers de remise du scenario, dans un ordre quelconque (re-tries par `ordre`)
 * @returns cout apres remise et pourcentage de remise applique
 */
export function appliquerPalierRemise(
  tonnageVagueT: Decimal,
  coutBrutFCFA: Decimal,
  paliers: PalierRemiseInput[]
): RemiseAppliqueeResult {
  const pourcentageRemiseApplique = determinerPourcentageRemise(tonnageVagueT, paliers);
  const coutFCFA = appliquerTauxRemise(coutBrutFCFA, pourcentageRemiseApplique);

  return { coutFCFA, pourcentageRemiseApplique };
}

/**
 * HOMONYMIE `sacsCalcules` — reserve 6 de PR1, tranchee par documentation
 * seule (pas de renommage, cf. pre-analyse story PR2.1). Ce champ porte le
 * MEME NOM que la colonne Prisma `AlimentParVaguePrevue.sacsCalcules`, mais
 * ce N'EST PAS la meme garantie de type : la colonne DB est un `Int` STRICT
 * (sortie `ceil()` de `calculerBesoinAlimentMensuel`, jamais editee
 * directement), alors que ce champ `number` en memoire NE GARANTIT PAS un
 * entier au niveau du type TS — seul l'appelant garantit cette invariance en
 * pratique :
 * - dans le CHEMIN APPLICATIF REEL (queries `src/lib/queries/
 *   previsions-vagues.ts`, `replaceAlimentsParVaguePrevue`), ce champ est
 *   toujours alimente par un entier reel (issu de `calculerBesoinAlimentMensuel`,
 *   deja `ceil`, ou de la colonne `Int` deja persistee) ;
 * - dans la RECETTE (`__tests__/recette/orchestration.ts`), ce champ est
 *   desormais lui aussi un ENTIER (`objectifTonnes.times(sacsParTonneStandard).ceil()`).
 *   La branche « proxy d'echelle fractionnaire » qui figurait ici a disparu
 *   avec le contournement qu'elle decrivait : la recette ne fabrique plus de
 *   `sacsCalcules` fractionnaire pour reproduire, par un rapport de sacs, la
 *   decision de palier du classeur — cette decision se prend maintenant
 *   directement sur le tonnage de la vague (ADR-053 §13.3/§13.4, story
 *   PR2sept.3). Le `ceil` est celui du README des fixtures (point 1),
 *   applique par granulometrie.
 *
 * CORRECTIF (story PR2.1, section 9 du rapport de test) — l'affirmation
 * precedente de ce commentaire etait FAUSSE et a ete corrigee : une ecriture
 * Prisma d'une valeur fractionnaire dans la colonne `Int` N'ECHOUE PAS
 * bruyamment. Verifie empiriquement contre un vrai Postgres (test DB-gated
 * `src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts`) :
 * le client Prisma TRONQUE SILENCIEUSEMENT (`Math.trunc`, ex. `3.7` -> `3`)
 * la valeur avant meme qu'elle n'atteigne Postgres — aucune exception n'est
 * levee. Le driver `pg` nu, lui, rejette bien la meme valeur sur une vraie
 * colonne `integer` (`22P02`), mais ce rejet n'est jamais atteint : Prisma a
 * deja tronque en amont. La SEULE protection reelle contre cette corruption
 * silencieuse est desormais une garde applicative explicite
 * (`assertEntierColonneInt`, `Number.isInteger`) posee dans
 * `src/lib/queries/previsions-vagues.ts` (`replaceAlimentsParVaguePrevue`,
 * `updateSacsSaisis`), qui rejette bruyamment toute valeur non entiere AVANT
 * l'ecriture Prisma. Ce champ TS, pris isolement, ne l'empeche pas au niveau
 * du type — c'est pourquoi ce commentaire existe, plutot qu'un renommage qui
 * obligerait a retoucher ce fichier, `orchestration.ts` (recette a
 * 842 tests / 0 ecart) et `aliments.test.ts` pour un risque qui n'existe pas
 * dans le chemin applicatif reel.
 */
export interface AlimentParVagueCalcInput {
  alimentPrevisionId: string;
  /** sortie du moteur (calculerBesoinAlimentMensuel) — jamais editee directement (ADR-053 section 3.6). Voir JSDoc de l'interface sur l'homonymie avec la colonne DB `Int`. */
  sacsCalcules: number;
  /**
   * surcharge manuelle. `null` = utiliser `sacsCalcules`. Non-null =
   * l'utilisateur a ajuste le besoin reel constate sur le terrain sans
   * repasser par un recalcul complet du scenario (ADR-053 section 3.6).
   */
  sacsSaisis: number | null;
  prixSacFCFA: Decimal;
}

/**
 * calculerCoutAlimentVague — Etape 4 du moteur (ADR-053 section 4, amendee
 * par §13.3).
 *
 * Cout aliment d'une VaguePrevue sur tout son cycle :
 *
 *   cout = (1 - remisePct/100) x Σ_lignes (COALESCE(sacsSaisis, sacsCalcules) x prixSacFCFA)
 *
 * Deux garanties distinctes, a ne jamais confondre (ADR-053 §13.7) :
 *  - le MONTANT respecte `COALESCE(sacsSaisis, sacsCalcules)` ligne par
 *    ligne (§3.6, INCHANGE et integralement en vigueur) : une surcharge
 *    manuelle prime TOUJOURS sur la sortie du moteur, jamais l'inverse,
 *    jamais un melange sur une meme ligne ;
 *  - la DECISION DE PALIER ne prend plus de nombre de sacs du tout : son
 *    unique entree est `tonnageVagueT`. Consequence assumee et voulue :
 *    **un utilisateur qui surcharge les sacs d'une vague en change le cout,
 *    mais pas le taux de remise.**
 *
 * Les paliers sont un parametre de la FONCTION, jamais un champ de chaque
 * ligne : c'est structurel, cela rend impossible de decider un palier
 * different par calibre ou par article (le defaut ERR-143).
 *
 * @param alimentsParVague - une ligne par (AlimentPrevision, moisCycle) de la vague
 * @param tonnageVagueT - tonnage VISE de la vague, en tonnes — decide le palier, une seule fois pour toute la vague
 * @param paliers - paliers de remise du scenario
 * @returns cout total aliment de la vague sur tout le cycle, apres remise
 */
export function calculerCoutAlimentVague(
  alimentsParVague: AlimentParVagueCalcInput[],
  tonnageVagueT: Decimal,
  paliers: PalierRemiseInput[]
): Decimal {
  const coutBrutFCFA = alimentsParVague.reduce((total, ligne) => {
    const sacsEffectifs = ligne.sacsSaisis ?? ligne.sacsCalcules;
    return total.plus(ligne.prixSacFCFA.times(sacsEffectifs));
  }, new Decimal(0));

  return appliquerPalierRemise(tonnageVagueT, coutBrutFCFA, paliers).coutFCFA;
}

export interface CoutAlimentMoisResult {
  moisCycle: number;
  montantFCFA: Decimal;
}

/**
 * apportionnerCoutAlimentMensuel — ventile un cout de cycle DEJA REMISE
 * (sortie de `appliquerPalierRemise`/`calculerCoutAlimentVague`) sur les
 * mois du cycle, au prorata des pourcentages de `RepartitionMoisAliment`.
 *
 * SEMANTIQUE VERIFIEE NUMERIQUEMENT PAR LA RECETTE PR1.4 (V7, 15 tonnes,
 * remise 6%, docs/tests/rapport-story-PR1.4.md section 4.3), a respecter
 * scrupuleusement : la remise est decidee UNE SEULE FOIS pour la vague
 * entiere, SUR SON TONNAGE VISE (ADR-053 §13.3 — plus jamais sur un nombre
 * de sacs, ni de cycle ni de mois, cf. `determinerPourcentageRemise`), PUIS
 * le montant deja remise est reparti par les pourcentages mensuels — la
 * remise n'est JAMAIS recalculee mois par mois. Exemple verifie : le cout du
 * mois 1 (2mm) de V7 vaut `coutCycleTotalRemiseFCFA * repartitionMois1%`
 * (1 624 320 FCFA), PAS `sacsMois1 * prixSac * (remise recalculee sur le
 * seul volume du mois 1)` — cette derniere forme ferait dependre le taux du
 * decoupage mensuel, alors qu'il ne depend que de la vague.
 *
 * Aucun arrondi n'est applique ligne par ligne ici (le montant reste un
 * `Decimal` non arrondi) : arrondir a chaque mois introduirait une derive
 * cumulative face au total du cycle si la somme des pourcentages vaut
 * exactement 100 (garanti par `validerSommeRepartitionMoisAliment` en
 * amont, validation.ts) — l'arrondi final (FCFA entier), si necessaire,
 * est a la charge de l'appelant, au point de sortie uniquement.
 *
 * Cas limites (documentes ici, absents de l'ADR-053 section 8) :
 * `coutCycleTotalRemiseFCFA = 0` -> chaque mois recoit `0`, sans erreur.
 * `repartitions` vide -> tableau vide (aucun mois a ventiler).
 * Un mois absent des `repartitions` n'apparait simplement pas dans le
 * resultat (pas de mois a 0% implicite) — coherent avec
 * `calculerBesoinAlimentMensuel` qui traite un mois absent comme 0%.
 *
 * @param coutCycleTotalRemiseFCFA - cout total, DEJA remise, d'UNE granulometrie sur TOUT le cycle d'UNE vague
 * @param repartitions - pourcentages mensuels de CETTE granulometrie (RepartitionMoisAliment), doivent sommer a 100 (valide en amont, validation.ts)
 * @returns un montant par mois de cycle present dans `repartitions`
 */
export function apportionnerCoutAlimentMensuel(
  coutCycleTotalRemiseFCFA: Decimal,
  repartitions: RepartitionMoisInput[]
): CoutAlimentMoisResult[] {
  return repartitions.map((r) => ({
    moisCycle: r.moisCycle,
    montantFCFA: coutCycleTotalRemiseFCFA.times(r.pourcentage).dividedBy(100),
  }));
}

/**
 * Meme homonymie que `AlimentParVagueCalcInput.sacsCalcules` (voir JSDoc
 * ci-dessus) : `sacsCalculesCycle` ne garantit pas un entier au niveau du
 * type TS, seul le chemin applicatif reel (queries PR2.1) garantit qu'il
 * recoit toujours un entier avant toute ecriture Prisma (colonne `Int`).
 */
export interface AlimentParVagueMensuelCalcInput {
  alimentPrevisionId: string;
  /** total de sacs de CETTE granulometrie sur TOUT le cycle de la vague (pas un total mensuel — la ventilation par mois est faite par `apportionnerCoutAlimentMensuel`, a partir des `repartitions` ci-dessous) */
  sacsCalculesCycle: number;
  /** surcharge manuelle du total cycle — memes regles que AlimentParVagueCalcInput.sacsSaisis (ADR-053 section 3.6) */
  sacsSaisisCycle: number | null;
  prixSacFCFA: Decimal;
  /** pourcentages mensuels de repartition de CETTE granulometrie (RepartitionMoisAliment) */
  repartitions: RepartitionMoisInput[];
}

export interface CoutAlimentGranulometrieMoisResult {
  alimentPrevisionId: string;
  moisCycle: number;
  montantFCFA: Decimal;
}

/**
 * calculerCoutAlimentGranulometrieParMois — cout aliment REMISE, ventile
 * par mois, pour UNE granulometrie d'UNE vague : grain exact de
 * `AlimentParVaguePrevue.coutCalculeFCFA` (ADR-053 section 3.6, vague x
 * granulometrie x moisCycle).
 *
 * Compose `appliquerPalierRemise` (remise decidee UNE FOIS pour la vague,
 * sur son TONNAGE VISE — jamais sur un volume de sacs, ni mensuel ni de
 * cycle, ADR-053 §13.3) puis `apportionnerCoutAlimentMensuel` (ventilation
 * par les pourcentages mensuels du montant deja remise). Ne reimplemente
 * aucune formule : ne fait que chainer les deux etapes deja exposees par ce
 * module.
 *
 * Le taux etant le MEME pour tous les calibres de la vague, appliquer la
 * remise au cout de ce calibre puis sommer les calibres est identique a
 * remiser le cout agrege de la vague (`Σ cᵢ(1−r) = (Σ cᵢ)(1−r)`) : le
 * niveau de DECISION reste bien la vague, ce n'est que la multiplication
 * qui se distribue.
 *
 * @param ligne - sacs du cycle complet (calcules ou surcharges), prix et repartition mensuelle d'UNE granulometrie d'UNE vague
 * @param tonnageVagueT - tonnage VISE de la vague, en tonnes (decide le palier, une fois pour toute la vague)
 * @param paliers - paliers de remise du scenario
 * @returns un montant par mois de cycle present dans `ligne.repartitions`
 */
export function calculerCoutAlimentGranulometrieParMois(
  ligne: AlimentParVagueMensuelCalcInput,
  tonnageVagueT: Decimal,
  paliers: PalierRemiseInput[]
): CoutAlimentGranulometrieMoisResult[] {
  const sacsEffectifsCycle = ligne.sacsSaisisCycle ?? ligne.sacsCalculesCycle;
  const coutBrutFCFA = ligne.prixSacFCFA.times(sacsEffectifsCycle);
  const { coutFCFA } = appliquerPalierRemise(tonnageVagueT, coutBrutFCFA, paliers);

  return apportionnerCoutAlimentMensuel(coutFCFA, ligne.repartitions).map((r) => ({
    alimentPrevisionId: ligne.alimentPrevisionId,
    moisCycle: r.moisCycle,
    montantFCFA: r.montantFCFA,
  }));
}

/**
 * repartirSacsEntreArticles — ADR-053 §12.2, arbitrage 1 (revise 2026-08-03),
 * amendement Sprint PR2-quater. FONCTION AJOUTEE, ne remplace ni ne modifie
 * aucune fonction existante de ce fichier (§12.4).
 *
 * Repartit un total ENTIER de sacs d'UN calibre (deja `ceil` en amont par
 * l'appelant, jamais recalcule ici) entre les articles de ce calibre, au
 * prorata de `partApprovisionnementPct` (Decimal, Sigma = 100 exactement,
 * validee a l'ecriture par `validerSommeApprovisionnementArticles`,
 * validation.ts) — methode du plus fort reste (Hare-Niemeyer), deterministe,
 * SANS JAMAIS depasser `totalSacs`.
 *
 * Algorithme (ADR-053 §12.2, arbitrage 1) :
 *   1. partiExacte_i = totalSacs * partPct_i / 100 (Decimal exact)
 *   2. plancher_i = floor(partiExacte_i)
 *   3. restant_i = partiExacte_i - plancher_i, dans [0, 1[
 *   4. restantATtribuer = totalSacs - Sigma(plancher_i) — entier dans [0, n-1]
 *   5. Tri par restant_i DECROISSANT, depart des ex aequo par `ordre`
 *      CROISSANT puis `id` CROISSANT (lexicographique) — deterministe.
 *   6. +1 aux `restantATtribuer` premiers articles de ce tri.
 *
 * Preuve : Sigma(sacs_i) = totalSacs EXACTEMENT (jamais un second arrondi).
 * Cas degenere N=1, part=100% : sacs_1 = totalSacs exactement, aucun
 * plancher/reste — identite byte-pour-byte avec le calcul d'avant
 * l'amendement §12 (recette 1270 tests / 0 ecart preservee).
 *
 * @param totalSacs - nombre ENTIER de sacs du calibre, deja `ceil` par l'appelant (jamais recalcule ici)
 * @param articles - articles du calibre, avec leur part d'approvisionnement (Decimal, Sigma = 100)
 * @returns un nombre de sacs entier par article, dans le MEME ordre que `articles`, dont la somme vaut exactement `totalSacs`
 */
export interface ArticleRepartitionInput {
  id: string;
  /** depart des ex aequo (ADR-053 §12.2, arbitrage 1, etape 5) */
  ordre: number;
  /** 0..100, Sigma sur tous les articles du meme calibre = 100 exactement (valide en amont) */
  partApprovisionnementPct: Decimal;
}

export interface ArticleRepartitionResult {
  id: string;
  sacs: number;
}

/**
 * calculerDetailConsommationMensuelle — Sprint PR2-sexies (story PR2sex.2).
 *
 * Serie « DETAIL PAR VAGUE — sacs consommes dans le mois (indicatif) »
 * (`Previsions!A11:V23` du classeur, jeu d'or `besoinsAliments.detailParVagueSacs`,
 * story PR2sex.1). Repond a une question DIFFERENTE de
 * `calculerBesoinAlimentMensuel` (« combien de sacs ACHETER », CEIL, lignes
 * 7-10 du classeur) : celle-ci repond a « combien de sacs sont CONSOMMES ce
 * mois, pour cette position dans le cycle, toutes vagues coincidentes
 * confondues » — un ROUND, jamais un CEIL. NE JAMAIS reutiliser
 * `calculerBesoinAlimentMensuel` ni son resultat `sacs` comme source de cette
 * fonction, ni faire entrer `quantiteKg`/`poidsSacKg` dans son calcul — c'est
 * precisement le glissement qui a cause le bug de facteur ~8300 (ERR-138/
 * ERR-139). La source legitime est `sacsEffectifsCycle`
 * (`COALESCE(sacsSaisisCycle, sacsCalculesCycle)`, deja calcule au niveau du
 * CALIBRE par `route-orchestration.ts`), jamais un article.
 *
 * FORMULE, sum-then-round, UN SEUL arrondi enveloppant toute l'expression
 * (lecture de la formule brute du classeur, `Previsions!B13` :
 * `=ROUND(SUMIFS(...)*pourcentage,0)` — SUMIFS s'execute avant le ROUND) :
 *
 *   sacsConsommes(g, M, k) = ROUND( Σ sacsEffectifsCycle(g, vague) × pct_k(g) / 100 )
 *
 * ou la somme porte sur TOUTES les vagues empoissonnees le meme mois
 * calendaire M-(k-1) (donc partageant la meme position de cycle k pour la
 * cellule (M, k)) — jamais un arrondi par vague suivi d'une somme des
 * arrondis (`Σ ROUND(...)`), qui diverge numeriquement des que plus d'une
 * vague coincide. Cette fonction reçoit la somme DEJA effectuee par
 * l'appelant (meme patron que `ceilViaMoteur`/GAP 2 de
 * `route-orchestration.ts` : sommer AVANT d'appeler la fonction du moteur qui
 * arrondit, jamais arrondir puis sommer) — c'est ce qui protege
 * structurellement l'invariant sum-then-round : aucun appelant ne peut
 * arrondir par vague sans changer la signature de cette fonction.
 *
 * LIMITE DE PREUVE, a ne jamais presenter comme « validee a 0 ecart » sans
 * cette reserve (docs/analysis/pre-analysis-story-PR2sex.2.md §2) : le jeu
 * d'or (les deux fixtures de recette) ne contient AUCUN mois ou deux
 * `VaguePrevue` partagent le meme `moisStockageAbsolu` — la somme Σ ne
 * contient donc jamais plus d'un terme sur toute la recette disponible, et
 * ne peut PAS, a elle seule, discriminer `ROUND(Σ)` de `Σ ROUND()`. Le choix
 * sum-then-round est justifie par la lecture directe de la formule source du
 * classeur (ci-dessus), jamais par la recette — voir le test synthetique
 * dedie a deux vagues coincidentes divergentes dans `__tests__/aliments.test.ts`,
 * seule protection reelle de cet invariant contre une regression silencieuse
 * (meme famille de piege que ERR-148/ERR-149).
 *
 * Arrondi : half-away-from-zero, identique a `ROUND` d'Excel — rendu
 * EXPLICITE ici (`Decimal.ROUND_HALF_UP` passe en argument a
 * `toDecimalPlaces`) bien que ce soit deja le mode global par defaut
 * (`decimal-config.ts`), pour que ce point d'appel reste lisible et correct
 * meme si la configuration globale change un jour.
 *
 * Cas limite (ADR-053 §11.2 point 2, doctrine 422 — respectee par la couche
 * ORCHESTRATION, jamais par le moteur pur, voir pre-analyse §3) : un
 * `moisCycle` absent de `repartitions` est traite comme 0% (jamais un
 * `throw`), exactement le comportement deja etabli par
 * `calculerBesoinAlimentMensuel`/`apportionnerCoutAlimentMensuel`.
 *
 * @param ligne.alimentPrevisionId - tracabilite du resultat uniquement, jamais lue comme FK
 * @param ligne.moisCycle - position dans le cycle, 1..dureeCycleMois (jamais un `3` en dur, jamais une cle `moisCycleN` figee — indexation par entier generique)
 * @param ligne.sommeSacsEffectifsCycle - Σ DEJA EFFECTUEE par l'appelant des `sacsEffectifsCycle` (calibre) de TOUTES les vagues empoissonnees le mois calendaire correspondant a cette position de cycle — jamais un total deja arrondi par vague
 * @param ligne.repartitions - pourcentages mensuels de CETTE granulometrie (RepartitionMoisAliment)
 */
export interface DetailConsommationCycleInput {
  alimentPrevisionId: string;
  moisCycle: number;
  sommeSacsEffectifsCycle: Decimal | number;
  repartitions: RepartitionMoisInput[];
}

export interface DetailConsommationMoisResult {
  alimentPrevisionId: string;
  moisCycle: number;
  /** ROUND(Σ sacsEffectifsCycle × pourcentage / 100), sum-then-round, un seul arrondi. */
  sacsConsommes: number;
}

export function calculerDetailConsommationMensuelle(
  ligne: DetailConsommationCycleInput
): DetailConsommationMoisResult {
  const repartition = ligne.repartitions.find((r) => r.moisCycle === ligne.moisCycle);
  const pourcentage = repartition?.pourcentage ?? new Decimal(0);
  const somme =
    ligne.sommeSacsEffectifsCycle instanceof Decimal
      ? ligne.sommeSacsEffectifsCycle
      : new Decimal(ligne.sommeSacsEffectifsCycle);

  const sacsConsommes = somme
    .times(pourcentage)
    .dividedBy(100)
    // Half-away-from-zero explicite au point d'appel (identique a ROUND
    // d'Excel) — voir JSDoc ci-dessus.
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  return {
    alimentPrevisionId: ligne.alimentPrevisionId,
    moisCycle: ligne.moisCycle,
    sacsConsommes,
  };
}

export function repartirSacsEntreArticles(
  totalSacs: number,
  articles: ArticleRepartitionInput[]
): ArticleRepartitionResult[] {
  if (articles.length === 0) {
    return [];
  }

  const total = new Decimal(totalSacs);

  const decomposes = articles.map((article) => {
    const partExacte = total.times(article.partApprovisionnementPct).dividedBy(100);
    const plancher = partExacte.floor();
    const restant = partExacte.minus(plancher);
    return { article, plancher, restant };
  });

  const sommePlanchers = decomposes.reduce((s, d) => s.plus(d.plancher), new Decimal(0));
  const restantATtribuer = total.minus(sommePlanchers).toNumber();

  const tries = [...decomposes].sort((a, b) => {
    const cmpRestant = b.restant.comparedTo(a.restant); // decroissant
    if (cmpRestant !== 0) return cmpRestant;
    if (a.article.ordre !== b.article.ordre) return a.article.ordre - b.article.ordre;
    return a.article.id < b.article.id ? -1 : a.article.id > b.article.id ? 1 : 0;
  });

  const sacsParId = new Map<string, Decimal>();
  for (const d of decomposes) {
    sacsParId.set(d.article.id, d.plancher);
  }
  for (let i = 0; i < restantATtribuer; i++) {
    const id = tries[i].article.id;
    sacsParId.set(id, sacsParId.get(id)!.plus(1));
  }

  return articles.map((article) => ({
    id: article.id,
    sacs: sacsParId.get(article.id)!.toNumber(),
  }));
}
